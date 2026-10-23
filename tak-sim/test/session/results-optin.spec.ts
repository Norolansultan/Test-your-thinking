/**
 * SPEC/36: the step "Personal results after the study" in the session — the same in both audiences and every cell, after the
 * post-session questionnaire and before the debrief; one record `results_optin {optedIn}` and nothing else (no address); the profile
 * on screen only with `?profiili=heti`; the checkpoint and the resume step; the screen's send rule and wiring; the texts and the
 * debrief's paragraph.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogRecord } from "../../app/telemetry/log.js";
import { checkpointLabel } from "../../app/telemetry/session-checkpoint.js";
import { immediateProfileFromUrl } from "../../app/session/public-session.js";
import { shellResumeStep } from "../../app/session/shell-resume.js";
import { canSend } from "../../app/render/ui/components/ResultsOptInScreen.js";
import { RESULTS_DEBRIEF_PARAGRAPH, RESULTS_OPTIN_TEXT } from "../../app/i18n/results-texts.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { PUBLIC_TEXT } from "../../app/i18n/public-texts.js";
import { driveSession, newStudySession } from "../public/public-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** A whole session to its end, answering the results step with `optIn`; its records. */
async function run(options: Parameters<typeof newStudySession>[0], optIn: boolean): Promise<readonly LogRecord[]> {
  vi.setSystemTime(0);
  const { o, snap } = newStudySession(options);
  await o.start();
  await driveSession(o, snap, ["results_optin"]);
  expect(snap().step).toBe("results_optin");
  expect(o.engineState).toBe("DEBRIEF_HANDOFF");
  await driveSession(o, snap, [], optIn);
  return o.logRecords();
}

/** The records from the post-session questionnaire's submission to the end, without timing. */
const tail = (records: readonly LogRecord[]) => {
  const from = records.findIndex((r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "post");
  return records.slice(from + 1).map((r) => r.kind === "results_optin" ? { kind: r.kind, detail: r.detail } : { kind: r.kind });
};

describe("the results step in the session (SPEC/36 item 2)", () => {
  it("is the same step in both audiences and every cell: one `results_optin` record, then the debrief", async () => {
    const tails = [];
    for (const options of [{ cell: "radio" }, { cell: "reasoning_intent" }, { cell: "radio", audience: "public" }, { cell: "reasoning_once", audience: "public" }] as const) {
      const records = await run(options, true);
      tails.push(JSON.stringify(tail(records)));
      expect(records.filter((r) => r.kind === "results_optin").map((r) => r.detail)).toEqual([{ optedIn: true }]);
      expect(JSON.stringify(records)).not.toContain("@"); // no address can reach the log: the session never gets one
    }
    expect(new Set(tails).size).toBe(1);
    expect(JSON.parse(tails[0]!)).toEqual([
      { kind: "results_optin", detail: { optedIn: true } }, { kind: "debrief_shown" }, { kind: "debrief_closed" }, { kind: "state_transition" }, { kind: "session_completed" },
    ]);
  }, 240_000);

  it("Skip is logged as `optedIn: false`; the profile follows only with `?profiili=heti`, in either audience", async () => {
    expect((await run({}, false)).find((r) => r.kind === "results_optin")!.detail).toEqual({ optedIn: false });
    const withProfile = await run({ immediateProfile: true }, false);
    expect(withProfile[0]!.detail).toMatchObject({ audience: "expert", immediateProfile: true });
    const i = withProfile.findIndex((r) => r.kind === "results_optin");
    expect(withProfile.slice(i, i + 3).map((r) => r.kind)).toEqual(["results_optin", "profile_shown", "debrief_shown"]);
  }, 120_000);

  it("`?profiili=heti` sets the on-screen profile; anything else leaves it off", () => {
    expect(immediateProfileFromUrl("?profiili=heti")).toBe(true);
    expect(immediateProfileFromUrl("?yleiso&profiili=heti&laajuus=a")).toBe(true);
    for (const search of ["", "?yleiso", "?profiili", "?profiili=", "?profiili=later", "?tuotanto"]) expect(immediateProfileFromUrl(search), search).toBe(false);
    const app = code("app/render/ui/App.tsx");
    expect(app).toContain("immediateProfile={immediateProfileFromUrl(search)}");
  });

  it("is a checkpoint at the end (DEBRIEF_HANDOFF), and the resume returns to it until it is answered", () => {
    expect(checkpointLabel("results_optin", 14, "DEBRIEF_HANDOFF")).toBe("results_optin");
    expect(checkpointLabel("results_optin", 14, "RUNNING")).toBeNull();
    const rec = (kind: string, detail: unknown = {}) => ({ seq: 0, tVirtual: 0, tWallOffsetMs: 0, kind, detail }) as unknown as LogRecord;
    const post = [rec("questionnaire_submitted", { questionnaireId: "post" })];
    const session = { aiLiteracyOn: false, isPublic: false };
    expect(shellResumeStep({ kind: "complete" }, post, session)).toBe("results_optin");
    expect(shellResumeStep({ kind: "complete" }, [...post, rec("results_optin", { optedIn: true })], session)).toBe("debrief");
    expect(shellResumeStep({ kind: "complete" }, [...post, rec("results_optin", { optedIn: true })], { ...session, immediateProfile: true })).toBe("profile");
    expect(shellResumeStep({ kind: "complete" }, [...post, rec("results_optin"), rec("debrief_shown")], { ...session, immediateProfile: true })).toBe("debrief");
  });
});

describe("the step's screen (`ResultsOptInScreen.tsx`)", () => {
  it("Send needs a well-formed address AND the consent; never while sending", () => {
    expect(canSend("a@b.fi", true, "editing")).toBe(true);
    expect(canSend(" a@b.fi ", true, "failed")).toBe(true);
    expect(canSend("a@b.fi", false, "editing")).toBe(false);
    expect(canSend("a@b", true, "editing")).toBe(false);
    expect(canSend("", true, "editing")).toBe(false);
    expect(canSend("a@b.fi", true, "sending")).toBe(false);
  });

  it("Skip is as prominent as Send (the same style); the session learns only true/false; a failed send offers retry and continue", () => {
    const screen = code("app/render/ui/components/ResultsOptInScreen.tsx");
    expect(screen).toMatch(/data-testid="results-skip" style=\{choiceButton\(/);
    expect(screen).toMatch(/data-testid="results-send" style=\{choiceButton\(/);
    expect(screen).toContain(`if (outcome === "stored") decide(true);`);
    expect(screen).toContain("onClick={() => decide(false)}>{t.continueWithout}");
    expect(screen).toContain(`phase === "failed" ? t.retry : t.send`);
    const shell = code("app/render/ui/components/StudyShell.tsx");
    expect(shell).toContain("sessionId={orchestrator.logHeader.sessionId} onDecide={(optedIn) => orchestrator.decideResultsOptIn(optedIn)}");
  });
});

describe("the texts (SPEC/36 items 2 and 6)", () => {
  it("fi and en complete, with the consent wording the step promises", () => {
    for (const lang of ["fi", "en"] as const) {
      const t = RESULTS_OPTIN_TEXT[lang];
      for (const v of [t.title, t.emailLabel, t.consentCheckbox, t.send, t.skip, t.failed, t.retry, t.continueWithout, t.invalidEmail, t.sending]) expect(v.length, lang).toBeGreaterThan(1);
      expect(t.paragraphs).toHaveLength(4);
    }
    expect(RESULTS_OPTIN_TEXT.en.consentCheckbox).toBe("Send my personal results to this address after the study closes. My address is stored separately from my answers and deleted after sending.");
  });

  it("every debrief (expert cells, public scopes, fi and en) says when the results arrive, before the closing request", () => {
    for (const lang of ["fi", "en"] as const) {
      const debriefs = [
        ...(["radio", "reasoning_once", "reasoning_intent"] as const).map((cell) => STUDY_TEXT[lang].debrief.paragraphs(cell)),
        ...(["full", "phaseA"] as const).map((scope) => PUBLIC_TEXT[lang].debriefParagraphs(scope)),
      ];
      for (const d of debriefs) expect(d.at(-2)).toBe(RESULTS_DEBRIEF_PARAGRAPH[lang]);
    }
  });
});
