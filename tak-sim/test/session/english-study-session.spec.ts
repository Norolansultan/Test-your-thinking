/**
 * A whole English study session, end to end (final review, 6 Oct 2026): consent, the AI literacy
 * test (revision (ac), 9 Oct 2026), preflight, the pre-session item, the briefing, VP with its tour and practice SPAM, the training, V1–V14 with the
 * real study timing, every freeze, SPAM probe and visible probe (E, F, U) answered, the hinge and its
 * check, Thinker asked in every main view (its proxy failing, so the browser's fallback answers), the
 * post-session questionnaire, the debrief and the end — in each of the three cells.
 *
 * At every snapshot the screen's text is collected the way the components render it: each Finnish
 * scenario string the UI passes through `tr` must have English, each record shown must have its
 * English, and none of the English may contain Finnish words. Every snapshot is also checked for
 * truth keys (I4), and the log for the order of the shell around the run.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionResume, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { assertGapless, InMemoryLogSink, type LogHeader, type LogSink } from "../../app/telemetry/log.js";
import { conditionOfCell } from "../../app/session/preview.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import { hasLabelEn, recordEn, tr } from "../../app/i18n/text.js";
import { STUDY_TEXT } from "../../app/i18n/study-texts.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { assertNoTruthKeysPresent } from "../../app/boundary/render-boundary.js";
import type { Cell } from "../../app/scenario/types.js";
import { PLAN } from "./view-flow.js";

const scenario = buildDemoScenario();
/** Finnish words that never belong in English text (as `test/i18n/coverage.spec.ts`, plus a few the probes and shell use). */
const FINNISH = /\b(ja|ei|noin|klo|tie|tiellä|palo|palon|reuna|kärki|kärjen|vettä|säiliö|tehtävä|olemme|meillä|lohko|tuuli|savua|liekit|etenee|siirtyy|saapunut|kysyttäessä|Valmis|vastaamaan|jakso|harjoitus|kyllä|varmuus|mikä|mitä|missä|kuinka|onko|tai)\b/i;
const GOOD: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

interface Seen {
  /** Finnish scenario strings the screen passes through `tr`. */
  readonly labels: Set<string>;
  /** Record ids shown (message log, bubbles, Haku results). */
  readonly records: Set<string>;
  /** English text produced on screen by the language layer (Thinker's fallback answers, hinge notes). */
  readonly english: Set<string>;
  readonly steps: Set<string>;
  readonly probeTypes: Set<string>;
}

function collect(s: SessionSnapshot, seen: Seen): void {
  assertNoTruthKeysPresent(s); // I4: nothing on the screen side carries a truth key
  const json = JSON.stringify(s);
  expect(json).not.toMatch(/"(correct|mapKey|keyAtomIds|invariantId|isTrue|truth|fit|soundPostures)"\s*:/);
  seen.steps.add(s.step);
  const label = (fi: string | null | undefined) => { if (fi) seen.labels.add(fi); };
  if (s.spam && s.spam.phase !== "ready") { label(s.spam.promptFi); for (const o of s.spam.options) label(o.fi); }
  if (s.visibleProbe) { seen.probeTypes.add(s.visibleProbe.type); label(s.visibleProbe.promptFi); for (const o of s.visibleProbe.options) label(o.fi); }
  if (s.freeze && s.step === "freeze") for (const it of s.freeze.items) { label(it.promptFi); for (const o of it.options) label(o.labelFi); }
  label(s.hingeDirective);
  if (s.hingeCheck) { label(s.hingeCheck.promptFi); for (const o of s.hingeCheck.options) label(o.labelFi); }
  label(s.directiveInForce);
  for (const sec of s.allocation.sectors) label(sec.labelFi);
  for (const e of s.radioLog) { if (e.id) seen.records.add(e.id); else label(e.text); }
  for (const a of s.bubbleHistory) seen.records.add(a.id);
  if (s.questionnaire) {
    for (const o of s.questionnaire.retentionOptions) label(o.labelFi);
    for (const item of s.questionnaire.items) {
      const text = STUDY_TEXT.en.questionnaire.items[item.id];
      expect(text?.prompt, item.id).toBeTruthy();
      seen.english.add(text!.prompt);
      for (const v of Object.values(text!.options ?? {})) seen.english.add(v);
    }
  }
  if (s.debrief) for (const p of STUDY_TEXT.en.debrief.paragraphs(s.debrief.cell)) seen.english.add(p);
  if (s.aiLiteracy) for (const it of s.aiLiteracy.items) seen.english.add(it.text);
  for (const turn of s.aiChatHistory) for (const v of [turn.answer.answerFi, turn.answer.basisFi, turn.answer.certaintyFi, turn.answer.wouldChangeIfFi]) seen.english.add(v);
}

async function runEnglishSession(cell: Cell, participantCode = "P-3", run: { readonly sink?: LogSink; readonly resume?: SessionResume; readonly stopWhen?: (s: SessionSnapshot) => boolean } = {}) {
  const transport = vi.fn(async () => { throw new TypeError("network down"); });
  const o = new SessionOrchestrator(scenario, conditionOfCell(cell), {
    cell, language: "en", studyShell: true, visibleProbes: true, guidedTour: true, showProbeLevels: false, aiLiteracyTest: true,
    participantCode, realClockMs: () => Date.now(), thinker: { transport, wait: async () => undefined },
    ...(run.sink ? { sink: run.sink } : {}), ...(run.resume ? { resume: run.resume } : {}),
  });
  const seen: Seen = { labels: new Set(), records: new Set(), english: new Set(), steps: new Set(), probeTypes: new Set() };
  let snap: SessionSnapshot | null = null;
  o.subscribe((s) => { snap = s; collect(s, seen); });
  const now = () => snap!;
  await o.start();
  let askedIn = -1, revisedIn = -1, guard = 0;
  while (now().step !== "complete") {
    if (run.stopWhen?.(now())) return { o, seen, records: await o.logRecords(), transport, stopped: now() };
    if (++guard > 20_000) throw new Error(`stuck at ${now().step} in view ${now().currentCycle}`);
    const s = now();
    if (s.tour) { await o.completeTour(1); continue; }
    if (s.spam) {
      if (s.spam.phase === "ready") await o.spamReady();
      else if (s.spam.phase === "item") await o.answerSpam(s.spam.options[0]!.id);
      else await o.submitSpamConfidence(50);
      continue;
    }
    if (s.visibleProbe) {
      const p = s.visibleProbe;
      if (p.kind === "area") await o.submitProbeArea(true, ["north_edge"]);
      else if (p.kind === "choice") await o.submitProbeChoice(p.options[0]!.id, p.collectsConfidence ? 50 : undefined);
      else await o.submitProbeScale(50);
      continue;
    }
    // Thinker once per main view, while the tools are free (its proxy is down: the English fallback answers).
    if (s.aiAvailable && askedIn !== s.currentCycle && (s.step === "exploration" || s.step === "allocation") && !s.toolsLocked) {
      askedIn = s.currentCycle;
      const results = await o.searchAtoms("north edge");
      for (const r of results) seen.records.add(r.id);
      await o.askAiChat("Where is the fire heading?");
      continue;
    }
    switch (s.step) {
      case "consent": await o.decideConsent(true, true); break;
      case "ai_literacy": { // rate every statement on the screen, then Next
        const v = s.aiLiteracy!;
        const open = v.items.find((it) => v.ratings[it.id] === null);
        if (open) await o.answerAiLiteracy(open.id, 4); else await o.nextAiLiteracyPage();
        break;
      }
      case "preflight": await o.submitPreflight(GOOD); break;
      case "questionnaire": await o.submitQuestionnaire({}); break;
      case "training": await o.completeTraining(); break;
      case "hinge_pause":
        if (s.hingeCheck?.phase === "directive") await o.showHingeCheck();
        else if (s.hingeCheck?.phase === "item") await o.answerHingeCheck(s.hingeCheck.options[0]!.id);
        else await o.dismissHinge();
        break;
      case "debrief": await o.finishDebrief(); break;
      case "freeze": await o.submitFreeze([]); break;
      case "allocation": await o.submitAllocation(PLAN); break;
      case "awaiting_view_end":
        if (revisedIn !== s.currentCycle && !s.minimumReached) { revisedIn = s.currentCycle; await o.reviseAllocation(); break; }
        await vi.advanceTimersByTimeAsync(1_000); break;
      default: await vi.advanceTimersByTimeAsync(1_000);
    }
  }
  await o.completeSession();
  return { o, seen, records: await o.logRecords(), transport, stopped: null };
}

describe("a whole English study session (consent to the end)", () => {
  for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) {
    it(`${cell}: every participant-facing string is English, no truth key reaches the screen, the shell frames the run`, async () => {
      const { seen, records, o } = await runEnglishSession(cell);
      // The session went through everything.
      for (const step of ["consent", "ai_literacy", "preflight", "questionnaire", "briefing", "training", "exploration", "freeze", "allocation", "probe", "hinge_pause", "debrief", "complete"]) {
        expect(seen.steps.has(step), step).toBe(true);
      }
      expect([...seen.probeTypes].sort()).toEqual(["U"]);
      expect(o.engineState).toBe("COMPLETE");
      const kinds = records.map((r) => r.kind);
      expect(kinds[0]).toBe("session_started");
      expect(kinds[1]).toBe("consent_decided");
      // Revision (ac): the AI literacy test is the first data collected after consent, ended before the preflight.
      expect(kinds.indexOf("ai_literacy_started")).toBeGreaterThan(1);
      expect(kinds.slice(2, kinds.indexOf("ai_literacy_started"))).toEqual(["state_transition"]);
      expect(kinds.indexOf("ai_literacy_submitted")).toBeLessThan(kinds.indexOf("preflight_result"));
      expect(records.find((r) => r.kind === "ai_literacy_submitted")!.detail).toMatchObject({ endReason: "completed", answeredCount: 31, itemCount: 31 });
      expect(kinds.indexOf("preflight_result")).toBeLessThan(kinds.indexOf("cycle_start"));
      expect(kinds.lastIndexOf("cycle_end")).toBeLessThan(kinds.indexOf("debrief_shown"));
      expect(kinds.at(-1)).toBe("session_completed");
      expect(records.filter((r) => r.kind === "spam_ready").length).toBeGreaterThan(0);

      // Every Finnish label shown has English, and the English is not Finnish.
      const missing = [...seen.labels].filter((fi) => !hasLabelEn(fi));
      expect(missing).toEqual([]);
      const finnishInEnglish = [...seen.labels].map((fi) => tr("en", fi)).filter((en) => FINNISH.test(en));
      expect(finnishInEnglish).toEqual([]);
      // Every record shown has English without Finnish words.
      const noEnglish = [...seen.records].filter((id) => recordEn(id) === undefined);
      expect(noEnglish).toEqual([]);
      expect([...seen.records].filter((id) => FINNISH.test(recordEn(id)!))).toEqual([]);
      // Thinker's (fallback) answers, the questionnaire, the debrief and the hinge notes are English.
      expect([...seen.english].filter((t) => FINNISH.test(t))).toEqual([]);
      if (cell !== "radio") expect(records.some((r) => r.kind === "ai_chat_answer_received" && (r.detail as { retrievalLanguage: string }).retrievalLanguage === "en")).toBe(true);
    }, 120_000);
  }

  it("the interface and study texts in English carry no Finnish word", () => {
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") strings.push(v);
      else if (typeof v === "function") { try { const r = (v as (...a: unknown[]) => unknown)(1, 2, 3); walk(r); } catch { /* needs other arguments */ } }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(UI_TEXT.en);
    // The glossary names Finnish terms on purpose (its glosses are checked in `study-texts.spec.ts`).
    walk({ ...STUDY_TEXT.en, debrief: { ...STUDY_TEXT.en.debrief, paragraphs: null }, glossary: null });
    for (const cell of ["radio", "reasoning_once", "reasoning_intent"] as const) walk(STUDY_TEXT.en.debrief.paragraphs(cell));
    // Proper names (places, call signs) are not Finnish words; the regex lists only common words.
    expect(strings.filter((s) => FINNISH.test(s))).toEqual([]);
  });
});

describe("the same stimulus for every participant of a cell (determinism)", () => {
  it("two participants of the same cell get identical stimulus records, in the same order", async () => {
    const codes = ["P-3", "P-4"];
    const shown = new Set(["ai_literacy_started", "bubble_available", "duty_officer_message_delivered", "envelope_revealed", "probe_presented", "spam_prompt_shown", "freeze_started", "branch_list_presented", "questionnaire_presented", "hinge_check_presented", "hinge_cell_note_shown", "debrief_shown", "step_boundary_reached", "cycle_start"]);
    // Revision (ai): the one per-participant difference is the ORDER of the closed items' options (V13's area
    // item, the questionnaire's multi-select items); the option sets are the same, so they are compared sorted.
    const sameSet = (ids: readonly string[]) => [...ids].sort((x, y) => x.localeCompare(y));
    const orders: string[][] = [];
    const stimulus = async (code: string) => {
      const { records } = await runEnglishSession("reasoning_intent", code);
      const order: string[] = [];
      const out = records.filter((r) => shown.has(r.kind)).map((r) => {
        const d = r.detail as Record<string, unknown>;
        if (r.kind === "probe_presented" && d.probeId === "probe.u.cycle_13") { order.push(...(d.optionIds as string[])); return { kind: r.kind, tVirtual: r.tVirtual, detail: { ...d, optionIds: sameSet(d.optionIds as string[]) } }; }
        if (r.kind === "questionnaire_presented" && d.multiOptionOrders) {
          const multi = d.multiOptionOrders as { itemId: string; optionIds: string[] }[];
          for (const m of multi) order.push(...m.optionIds);
          return { kind: r.kind, tVirtual: r.tVirtual, detail: { ...d, multiOptionOrders: multi.map((m) => ({ itemId: m.itemId, optionIds: sameSet(m.optionIds) })) } };
        }
        return { kind: r.kind, tVirtual: r.tVirtual, detail: r.detail };
      });
      orders.push(order);
      return out;
    };
    const a = await stimulus(codes[0]!);
    const b = await stimulus(codes[1]!);
    expect(a.length).toBeGreaterThan(100);
    expect(b).toEqual(a);
    expect(orders[0]).toEqual(orders[1]); // one order for everyone (identical stimulus)
  }, 120_000);
});

describe("resume with the shell and the visible probes (English study session)", () => {
  /** Runs to `stopWhen`, "closes the tab", resumes from the durable records and runs to the end. */
  async function interruptAndResume(stopWhen: (s: SessionSnapshot) => boolean) {
    const sink = new InMemoryLogSink();
    const first = await runEnglishSession("reasoning_intent", "P-3", { sink, stopWhen });
    expect(first.stopped, "the interruption point was reached").not.toBeNull();
    const before = await sink.readAll();
    const header = before[0]!.detail as LogHeader;
    const second = await runEnglishSession("reasoning_intent", "P-3", { sink, resume: { header, records: before, interruptedForMs: 60_000 } });
    const all = await sink.readAll();
    assertGapless(all);
    const resumed = all.slice(before.length);
    expect(resumed.slice(0, 3).map((r) => r.kind)).toEqual(["fault", "fault_resolved", "session_resumed"]);
    expect(second.o.engineState).toBe("COMPLETE");
    expect(all.filter((r) => r.kind === "session_completed")).toHaveLength(1);
    expect(all.filter((r) => r.kind === "debrief_closed")).toHaveLength(1);
    expect([...second.seen.labels].filter((fi) => !hasLabelEn(fi))).toEqual([]);
    return { first, second, before, resumed, all };
  }

  it("interrupted while V13's open U probe is open: that view is replayed from its start and the probe is asked again", async () => {
    const { first, resumed } = await interruptAndResume((s) => s.currentCycle === 13 && s.visibleProbe?.type === "U");
    const view = first.stopped!.currentCycle;
    expect(resumed[2]!.detail).toMatchObject({ resumedAt: "view", cycleReplayed: view });
    expect(resumed[3]).toMatchObject({ kind: "cycle_start", detail: { cycle: view } });
    const u = resumed.filter((r) => r.kind === "probe_presented" && (r.detail as { probeId: string }).probeId === "probe.u.cycle_13");
    expect(u).toHaveLength(1);
    expect(resumed.some((r) => r.kind === "probe_submitted" && (r.detail as { probeId: string }).probeId === "probe.u.cycle_13")).toBe(true);
  }, 120_000);

  it("interrupted during V14's after-view probes: V14 is replayed, its after-view probes asked again, then the questionnaire", async () => {
    const { resumed } = await interruptAndResume((s) => s.currentCycle === 14 && s.step === "probe" && s.visibleProbe?.type === "U" && s.visibleProbe.kind !== "area");
    expect(resumed[2]!.detail).toMatchObject({ resumedAt: "view", cycleReplayed: 14 });
    const kinds = resumed.map((r) => r.kind);
    expect(kinds.indexOf("view_ended")).toBeLessThan(kinds.lastIndexOf("probe_submitted"));
    expect(kinds.lastIndexOf("probe_submitted")).toBeLessThan(kinds.indexOf("questionnaire_presented"));
  }, 120_000);

  it("interrupted in the post-session questionnaire: the questionnaire again, then the debrief and the end", async () => {
    const { resumed, all } = await interruptAndResume((s) => s.step === "questionnaire" && s.questionnaire?.id === "post");
    expect(resumed[2]!.detail).toMatchObject({ resumedAt: "questionnaire" });
    expect(resumed[3]).toMatchObject({ kind: "questionnaire_presented", detail: { questionnaireId: "post" } });
    expect(all.filter((r) => r.kind === "questionnaire_submitted" && (r.detail as { questionnaireId: string }).questionnaireId === "post")).toHaveLength(1);
    expect(all.filter((r) => r.kind === "cycle_start" && (r.detail as { cycle: number }).cycle === 14)).toHaveLength(1);
  }, 120_000);
});
