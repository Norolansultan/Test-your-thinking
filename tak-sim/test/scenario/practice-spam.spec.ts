/**
 * The practice SPAM item in VP (5 Oct 2026, `practice-spam.ts`): its key rests on a pushed VP record
 * found by content; it comes after VP's freeze and closes before VP's minimum; it carries no key;
 * it has English; and in the session it behaves as the main items do (revision (ag), so the tour
 * teaches the rule): the ready prompt waits, the search tool stays usable while answering, and a
 * prompt left up is forced before VP ends — the same in both conditions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { PRACTICE_SPAM_AUTHORED, PRACTICE_SPAM_ID, PRACTICE_SPAM_KEY_OPTION, PRACTICE_SPAM_OFFSET_MS, practiceSpamKeyRecordId } from "../../app/scenario/practice-spam.js";
import { SPAM_ANSWER_TIMEOUT_MS } from "../../app/scenario/demo-probes.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { hasLabelEn, tr } from "../../app/i18n/text.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { PLAN } from "../session/view-flow.js";
import { PRACTICE_VIEW_MIN_SECONDS } from "../../app/scenario/views.js";

const scenario = buildDemoScenario();
const probe = scenario.practice.spam!;

describe("the practice SPAM item", () => {
  it("rests on one pushed VP record, delivered when VP opens", () => {
    const id = practiceSpamKeyRecordId();
    expect(scenario.practice.cycle.pushedAtomIds).toContain(id);
    const record = SITE_SCENARIO.traffic.find((t) => t.id === id)!;
    expect(record.content).toContain("Haukilammelta (W1), noin 1,4 km luoteeseen");
    expect(PRACTICE_SPAM_AUTHORED.key).toBe("Haukilammelta (W1), noin 1,4 km luoteeseen");
    const options = probe.response.kind === "categorical" ? probe.response.options : [];
    expect(options.find((o) => o.id === PRACTICE_SPAM_KEY_OPTION)!.fi).toBe(PRACTICE_SPAM_AUTHORED.key);
  });

  it("comes after VP's freeze; said ready to at once, closes before VP's minimum (it never meets the freeze); the main items' windows", () => {
    const at = PRACTICE_SPAM_OFFSET_MS / 1000;
    expect(scenario.practice.cycle.freezeAtSeconds!).toBeLessThan(at);
    expect(at + SPAM_ANSWER_TIMEOUT_MS / 1000).toBeLessThan(scenario.practice.cycle.minViewSeconds);
    expect(probe).toMatchObject({ answerTimeoutMs: SPAM_ANSWER_TIMEOUT_MS });
    expect(probe).not.toHaveProperty("readyTimeoutMs"); // revision (ag): no expiry
  });

  it("carries no key, and is not a scored probe", () => {
    expect(probe).toMatchObject({ id: PRACTICE_SPAM_ID, type: "S", cycle: 0, mode: "ONLINE" });
    expect(JSON.stringify(probe)).not.toMatch(/correct|"key"|expected/);
    expect(scenario.probeSchedule.probes.map((p) => p.id)).not.toContain(PRACTICE_SPAM_ID);
    expect(scenario.invariants.map((i) => i.name)).not.toContain(probe.invariantName);
  });

  it("has English for the prompt and every option", () => {
    const options = probe.response.kind === "categorical" ? probe.response.options : [];
    for (const fi of [probe.prompt, ...options.map((o) => o.fi)]) {
      expect(hasLabelEn(fi), fi).toBe(true);
      expect(tr("en", fi)).not.toBe(fi);
    }
  });
});

describe("the practice SPAM item in the session", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  for (const condition of ["directed", "substitutive"] as const) {
    it(`${condition}: the ready prompt at 85 s after the freeze, waiting past the old 15 s; the search tool usable while the item is open, raw records`, async () => {
      const { o, snap } = await toPracticePrompt(condition);
      expect(snap().spam).toEqual({ phase: "ready", probeId: PRACTICE_SPAM_ID, collapsed: false });
      await vi.advanceTimersByTimeAsync(30_000); // revision (ag): no expiry
      expect(snap().spam).toMatchObject({ phase: "ready" });
      expect(o.searchAtoms("VPK")).toBeDefined();
      await o.spamReady();
      expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: true });
      await expect(o.searchAtoms("VPK")).resolves.toBeDefined(); // revision (ag): Haku usable while answering
      await o.answerSpam(PRACTICE_SPAM_KEY_OPTION);
      await o.submitSpamConfidence(100);
      expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: false });
      const records = (await o.logRecords()).filter((r) => /^spam_|recall_confidence/.test(r.kind));
      expect(records.map((r) => r.kind)).toEqual(["spam_prompt_shown", "spam_ready", "spam_answered", "recall_confidence_submitted", "spam_closed"]);
      expect(records[0]!.detail).toEqual({ probeId: PRACTICE_SPAM_ID, cycle: 0, atViewSeconds: 85 });
    });

    it(`${condition}: a prompt left up is forced before VP ends — the clock paused, the tools usable — and the training follows its answer`, async () => {
      const { o, snap } = await toPracticePrompt(condition);
      await o.submitAllocation(PLAN);
      while (snap().spam?.phase === "ready") await vi.advanceTimersByTimeAsync(1_000);
      expect(snap()).toMatchObject({ currentCycle: 0, spam: { phase: "item", forced: true }, decisionHeld: true, toolsLocked: false });
      const left = snap().secondsLeft;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(snap().secondsLeft).toBe(left); // the view's clock stands still
      await expect(o.searchAtoms("VPK")).resolves.toBeDefined();
      await o.answerSpam(PRACTICE_SPAM_KEY_OPTION);
      await o.submitSpamConfidence(75);
      expect(snap().step).toBe("training");
      const records = await o.logRecords();
      expect(records.find((r) => r.kind === "spam_ready")!.detail).toEqual({ probeId: PRACTICE_SPAM_ID, timedOut: false, forced: true, atViewSeconds: PRACTICE_VIEW_MIN_SECONDS, viewEndedBy: "minimum_length" });
      expect(records.find((r) => r.kind === "view_ended")!.detail).toEqual({ cycle: 0, viewSeconds: PRACTICE_VIEW_MIN_SECONDS, endedBy: "minimum_length" });
    });
  }
});

async function toPracticePrompt(condition: "directed" | "substitutive") {
  const o = new SessionOrchestrator(scenario, condition);
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  const snap = () => box.snap!;
  await o.start();
  expect(snap().currentCycle).toBe(0);
  while (snap().step !== "freeze") await vi.advanceTimersByTimeAsync(1_000);
  expect(snap().spam).toBeNull();
  await o.submitFreeze([]);
  while (!snap().spam) await vi.advanceTimersByTimeAsync(1_000);
  return { o, snap };
}
