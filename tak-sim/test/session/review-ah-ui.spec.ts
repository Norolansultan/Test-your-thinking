/**
 * Revision (ah), 9 Oct 2026: the review fixes in the browser. M3: record tags are shown without their
 * T-number. M6: a question over the cap is refused in the UI with a message, never thrown from the
 * click path, and its text kept. M2: the Search card names the tool in the session language. L3: both
 * chats come back on a resume. The resume offer asks before abandoning a session, and leaving a
 * running session asks first. The components are checked at the source, as the other UI specs do.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { displayAnswerText, questionRefusal } from "../../app/session/chat-display.js";
import { THINKER_MAX_QUESTION_CHARS, STRATEGY_FROM_VIEW } from "../../app/session/thinker-protocol.js";
import { SessionQueries } from "../../app/session/queries.js";
import { warnBeforeUnload } from "../../app/telemetry/session-registry.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import type { LogRecord } from "../../app/telemetry/log.js";

const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("M3: the record tags in a displayed answer", () => {
  it.each([
    ["DR1 confirmed SF2 [T7, 15:31].", "DR1 confirmed SF2 (15:31)."],
    ["EK12 reports low pressure [T9, 13.37, EK12] and more.", "EK12 reports low pressure (13.37, EK12) and more."],
    ["DR1 at 15.29 (T9), DR1 at 15.31 (T11)", "DR1 at 15.29, DR1 at 15.31"],
    ["8,8 m/min [T9, T10, 13.25/13.26]", "8,8 m/min (13.25/13.26)"],
    ["None of the records (T1–T8) mention it.", "None of the records mention it."],
    ["KY21 ilmoitti klo 16.20 (tietue T8), että", "KY21 ilmoitti klo 16.20, että"],
    ["vehicle locations [T7, 16:35; T14, 16:38]", "vehicle locations (16:35, 16:38)"],
  ])("%s", (raw, shown) => expect(displayAnswerText(raw)).toBe(shown));

  it("leaves text without tags as it is (a directive citation, unit ids, clocks)", () => {
    for (const s of ["aligns with the directive [P2, 16:40]", "EK11 (L2) at 13.20", "Tilanne (klo 15.31) on muuttunut."]) expect(displayAnswerText(s)).toBe(s);
  });

  it("the right panel displays both chats through it; the log keeps the raw text", () => {
    const src = code("app/render/ui/components/RightPanel.tsx");
    for (const field of ["answerFi", "basisFi", "certaintyFi", "wouldChangeIfFi"]) expect(src).toContain(`displayAnswerText(turn.answer.${field})`);
    expect(src).toContain("displayAnswerText(turn.answer)");
    expect(code("app/session/queries.ts")).not.toContain("displayAnswerText");
  });
});

describe("M6: a question the session would refuse", () => {
  it("is refused in the UI: blank, too long, or the tool busy", () => {
    expect(questionRefusal("  ", false)).toEqual({ kind: "empty" });
    expect(questionRefusal("x".repeat(THINKER_MAX_QUESTION_CHARS + 1), false)).toEqual({ kind: "too_long", length: THINKER_MAX_QUESTION_CHARS + 1 });
    expect(questionRefusal("x".repeat(THINKER_MAX_QUESTION_CHARS), false)).toBeNull();
    expect(questionRefusal("Missä kärki on?", true)).toEqual({ kind: "busy" });
    expect(questionRefusal("Missä kärki on?", false)).toBeNull();
  });

  it("shows a message in both languages, and the input keeps the text; the send is caught and the busy state cleared in finally", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(UI_TEXT[lang].questionTooLong(500, 612)).toMatch(/612\/500/);
      expect(UI_TEXT[lang].questionNotSent).not.toBe("");
    }
    const src = code("app/render/ui/components/RightPanel.tsx");
    const hook = src.slice(src.indexOf("function useQuestion"), src.indexOf("function QuestionInput"));
    expect(hook).toMatch(/const refusal = questionRefusal\(query, pending\);\s*if \(refusal\) \{[^}]*return;/);
    expect(hook).toMatch(/try \{\s*await send\(asked\);\s*\} catch \{[\s\S]*setQuery[\s\S]*\} finally \{\s*setPending\(false\);/);
    expect(src).not.toMatch(/void orchestrator\.ask(AiChat|OpenThinker)\(/); // no un-awaited send whose rejection escapes the click
    expect(src).not.toMatch(/maxLength=/); // a pasted long question is not silently cut: it is shown with the message
  });
});

describe("M2: the Search card's header", () => {
  it("is the tool's name in the session language", () => {
    const src = code("app/render/ui/components/RightPanel.tsx");
    expect(src).not.toMatch(/>Haku</);
    expect(src).toMatch(/fontWeight: 700, fontSize: 11 \}\}>\{t\.haku\}/);
    expect(UI_TEXT.en.haku).toBe("Search");
    expect(UI_TEXT.en.thinkerUnavailable).not.toMatch(/Haku/);
  });
});

describe("L3: both chats survive a resume", () => {
  const answer = (seq: number, tool: "haku" | "open_thinker", view: number, text: string, fallback = false): LogRecord => ({
    seq: seq as never, tVirtual: 0 as never, tWallOffsetMs: 0, kind: "ai_chat_answer_received",
    detail: { queryId: `q${seq}`, text, view, virtualTimeS: 0, retrieved: [], retrievalMode: "hybrid", modelId: "m", promptHash: "h",
      answer: { vastaus: `${text} — answer`, perusteet: tool === "haku" ? "p" : "", varmuus: tool === "haku" ? "v" : "", muuttaisi: tool === "haku" ? "m" : "" },
      latencyMs: 1, fallback, fallbackReason: fallback ? "timeout" : null, phase: "exploration", promptVariant: "standard", tool },
  });
  const records = [answer(1, "haku", 2, "h1"), answer(2, "open_thinker", 3, "o1"), answer(3, "open_thinker", 4, "o2", true), answer(4, "open_thinker", STRATEGY_FROM_VIEW, "o3"), answer(5, "haku", 9, "h2")];
  const queries = () => new SessionQueries({} as never, { transport: async () => { throw new Error("unused"); }, openTransport: async () => { throw new Error("unused"); } });

  it("before the hinge, every turn comes back in order, an unanswered one as unavailable", () => {
    const q = queries();
    q.restoreChats(records.slice(0, 3), 5);
    expect(q.aiChatHistory).toEqual([{ query: "h1", answer: { answerFi: "h1 — answer", basisFi: "p", certaintyFi: "v", wouldChangeIfFi: "m" } }]);
    expect(q.openThinkerHistory).toEqual([{ query: "o1", answer: "o1 — answer", unavailable: false }, { query: "o2", answer: "o2 — answer", unavailable: true }]);
  });

  it("at or after the hinge view, the Open Thinker keeps only the turns from the hinge on (the D6 clearing), Search keeps all", () => {
    const q = queries();
    q.restoreChats(records, 10);
    expect(q.openThinkerHistory.map((t) => t.query)).toEqual(["o3"]);
    expect(q.aiChatHistory.map((t) => t.query)).toEqual(["h1", "h2"]);
    q.startView(11); // the clearing has happened: a later view does not clear the restored turns
    expect(q.openThinkerHistory.map((t) => t.query)).toEqual(["o3"]);
  });

  it("the orchestrator restores them when it resumes", () => {
    expect(code("app/session/orchestrator.ts")).toMatch(/this\.queries\.restoreChats\(this\.resumeInfo\?\.records/);
  });
});

describe("leaving a session", () => {
  it("the resume offer asks before a new session abandons the unfinished one, and continuing is the primary action", () => {
    const src = code("app/render/ui/SessionLauncher.tsx");
    const offer = src.slice(src.indexOf("function ResumeOffer"), src.indexOf("function PendingUpload"));
    expect(offer).toMatch(/data-testid="resume-continue" style=\{primaryButtonStyle\}/);
    expect(offer).toMatch(/data-testid="resume-discard" style=\{secondaryButtonStyle\} onClick=\{\(\) => setConfirming\(true\)\}/);
    expect(offer).toMatch(/data-testid="resume-discard-yes" style=\{secondaryButtonStyle\} onClick=\{onDiscard\}/);
    expect(UI_TEXT.en.sessionData.resumeDiscardConfirm).toBe("This ends the unfinished session. Start a new one?");
    expect(UI_TEXT.fi.sessionData.resumeDiscardConfirm).toMatch(/keskeneräisen istunnon/);
  });

  it("asks (the browser's own prompt) while the session runs, not at its end, not after it ended before the run, never under automation", () => {
    for (const step of ["consent", "exploration", "freeze", "hinge_pause", "questionnaire", "debrief"]) expect(warnBeforeUnload(step, false), step).toBe(true);
    for (const step of ["complete", "consent_declined", "preflight_refused"]) expect(warnBeforeUnload(step, false), step).toBe(false);
    expect(warnBeforeUnload(null, false)).toBe(false);
    expect(warnBeforeUnload("exploration", true)).toBe(false);
    const view = code("app/render/ui/components/SessionView.tsx");
    expect(view).toMatch(/warnBeforeUnload\(step, typeof navigator !== "undefined" && navigator\.webdriver === true\)/);
    expect(view).toMatch(/addEventListener\("beforeunload"/);
    expect(view).toMatch(/removeEventListener\("beforeunload"/);
  });
});
