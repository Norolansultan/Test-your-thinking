/**
 * SPAM delivery and the hinge manipulation check in the running session (round 2, 4 Oct 2026, agent C;
 * `spam-delivery.ts`, brief D3/D4; revision (ag), 9 Oct 2026): the ready prompt at its moment, never with
 * a freeze or the hinge; no ready expiry; Haku and Thinker usable while the item is open (D4's lock
 * withdrawn), the decision panel held; raw records only; the answer timeout; the step boundary never
 * inside an open item; the view's end waiting for an open item; the keys in the message log by the
 * item's moment; the hinge check gating Continue; I4 (no key on the screen side). The forced item at
 * the view's end, collapsing, resume and the demonstration skip: `spam-forced.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { SPAM_KEY_ATOMS, SPAM_ANSWER_TIMEOUT_MS, SPAM_OFFSET_MS, SPAM_VIEWS } from "../../app/scenario/demo-probes.js";
import { hingeCheckMeasure, spamKeysOf, spamMeasures } from "../../app/telemetry/spam-measures.js";
import type { ThinkerResponse } from "../../app/session/thinker-protocol.js";
import type { ThinkerTransport } from "../../app/session/thinker-transport.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { allocateAndConfirm, passHinge, PLAN, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();
const keyOf = (view: number) => scenario.invariants.find((i) => i.name === `spam.cycle_${view}`)!.expected as string;
/** SPEC/30 §5.2: the key of a view's second item (`spam.cycle_<n>.b`; V3 and V6 since the content package filled them). */
const keyOf2 = (view: number) => scenario.invariants.find((i) => i.name === `spam.cycle_${view}.b`)!.expected as string;
const hingeKey = scenario.invariants.find((i) => i.name === scenario.hinge.manipulationCheck!.invariantName)!.expected as string;

const LIVE: ThinkerResponse = {
  answer: { vastaus: "Ei tietoa.", perusteet: "—", varmuus: "epävarma", muuttaisi: "—" },
  retrieved: [], modelId: "test-model", promptHash: "a".repeat(64), latencyMs: 3100, fallback: false, fallbackReason: null, retrievalMode: "hybrid", promptVariant: "standard",
};

function start(condition: "directed" | "substitutive" = "substitutive", transport?: ThinkerTransport) {
  const o = new SessionOrchestrator(scenario, condition, transport ? { thinker: { transport } } : {});
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
  if (snap().step === "hinge_pause") await passHinge(o);
}

/** Starts a session and runs every view before `view`; `view` has just opened (its clock at 0). */
async function at(view: number, condition: "directed" | "substitutive" = "substitutive", transport?: ThinkerTransport) {
  const s = start(condition, transport);
  await s.o.start();
  while (s.snap().currentCycle !== view) await completeView(s.o, s.snap);
  return s;
}

const kinds = (records: readonly LogRecord[]) => records.map((r) => r.kind);
/** The practice item's records (VP, not scored). */
// The practice delivery's records: its first item and (difficulty audit, 23 Oct 2026) its second, the measuring task.
const isPractice = (r: LogRecord) => /^probe\.s\.practice(?:\.b)?$/.test((r.detail as { probeId?: string }).probeId ?? "");
const offsetS = SPAM_OFFSET_MS / 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SPAM delivery", () => {
  it("shows the ready prompt at 25 s on the view's clock, in V3, V6, V8, V11 only, never in VP or a freeze view", async () => {
    const { o, snap } = start();
    await o.start();
    const promptedIn: number[] = [];
    for (let view = 0; view <= 14; view++) {
      expect(snap().currentCycle).toBe(view);
      await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS - 1);
      expect(snap().spam, `V${view} before 25 s`).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      if (snap().spam) {
        promptedIn.push(view);
        expect(snap().spam).toEqual({ phase: "ready", probeId: `probe.s.cycle_${view}`, collapsed: false });
        expect(snap().step).not.toBe("freeze");
      }
      await completeView(o, snap);
    }
    expect(promptedIn).toEqual([...SPAM_VIEWS].sort((a, b) => a - b));
    for (const v of promptedIn) expect(scenario.cycles.find((c) => c.index === v)!.hasFreeze).toBe(false);
    const allPrompts = (await o.logRecords()).filter((r) => r.kind === "spam_prompt_shown");
    // VP has its practice item (5 Oct 2026, `practice-spam.ts`), after its freeze, at 85 s since 11 Oct 2026 (was 45 s; the freeze moved from 29 to 69 s); not scored.
    expect(allPrompts[0]!.detail).toEqual({ probeId: "probe.s.practice", cycle: 0, atViewSeconds: 85 });
    const prompts = allPrompts.filter((r) => (r.detail as { cycle: number }).cycle !== 0);
    expect(prompts.map((r) => r.detail)).toEqual(promptedIn.map((v) => ({ probeId: `probe.s.cycle_${v}`, cycle: v, atViewSeconds: offsetS })));
  });

  it("keeps the map, the message log and the decision panel during the ready prompt; after 'ready' holds the panel, Haku and Thinker stay usable (revision (ag)); releases on close", async () => {
    const { o, snap } = await at(3);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    expect(snap().step).toBe("allocation"); // the panel opened at 20 s
    expect(snap().toolsLocked).toBe(false);
    expect(o.searchAtoms("EK11")).toBeDefined(); // Haku still usable during the ready prompt
    const log = snap().radioLog.length;

    await o.spamReady();
    expect(snap().spam).toMatchObject({ phase: "item", forced: false, promptFi: scenario.probeSchedule.probes.find((p) => p.id === "probe.s.cycle_3")!.prompt });
    expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: true });
    // Revision (ag): the tools at hand while answering (D4's lock withdrawn).
    await expect(o.searchAtoms("EK11")).resolves.toBeDefined();
    const asked = o.askAiChat("paljonko on palanut?"); // the Thinker too (its reply under the fake timers below)
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(asked).resolves.toBeDefined();
    await expect(o.logNavSlot("category", "fire")).resolves.toBeUndefined();
    await expect(o.navigateQuery({ category: "fire", sourceId: null, window: "latest" } as never)).resolves.toBeDefined();
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/SPAM item is open/);
    // Online: the map, the log and the clock run on.
    expect(snap().radioLog.length).toBe(log);
    expect(snap().renderTree.envelope).not.toBeNull();
    expect(snap().cyclePhase).toBe("decision");

    await o.answerSpam(keyOf(3));
    expect(snap().spam).toMatchObject({ phase: "confidence", chosen: keyOf(3) });
    expect(snap().decisionHeld).toBe(true);
    await expect(o.answerSpam("a")).rejects.toThrow(); // final
    await expect(o.submitSpamConfidence(60)).rejects.toThrow(RangeError); // the one scale
    await o.submitSpamConfidence(75);
    // SPEC/30 §5.2: V3's second item (`.b`) follows under the same "ready" — the panel still held, the tools at hand.
    expect(snap().spam).toMatchObject({ phase: "item", probeId: "probe.s.cycle_3.b", itemIndex: 2, itemCount: 2, forced: false, chosen: null });
    expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: true });
    await expect(o.searchAtoms("DR3")).resolves.toBeDefined();
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/SPAM item is open/);
    await o.answerSpam(keyOf2(3));
    expect(snap().spam).toMatchObject({ phase: "confidence", probeId: "probe.s.cycle_3.b", chosen: keyOf2(3) });
    await o.submitSpamConfidence(50);
    expect(snap().spam).toBeNull();
    expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: false });

    const records = await o.logRecords();
    const spam = records.filter((r) => /^spam_|recall_confidence/.test(r.kind) && !isPractice(r));
    expect(spam.map((r) => r.kind)).toEqual(["spam_prompt_shown", "spam_ready", "spam_answered", "recall_confidence_submitted", "spam_answered", "recall_confidence_submitted", "spam_closed"]);
    expect(spam.map((r) => r.detail)).toEqual([
      { probeId: "probe.s.cycle_3", cycle: 3, atViewSeconds: offsetS },
      { probeId: "probe.s.cycle_3", timedOut: false },
      { probeId: "probe.s.cycle_3", response: keyOf(3), timedOut: false },
      { probeId: "probe.s.cycle_3", value: 75 },
      { probeId: "probe.s.cycle_3.b", response: keyOf2(3), timedOut: false },
      { probeId: "probe.s.cycle_3.b", value: 50 },
      { probeId: "probe.s.cycle_3", cycle: 3 }, // once, after the second item, with the first item's id
    ]);
    for (const r of spam) expect(JSON.stringify(r.detail)).not.toMatch(/latency|correct|expected|isCorrect/i); // raw only
  });

  it("does not expire (revision (ag)): the ready prompt waits past the old 15 s; no answer within 60 s after 'ready' closes it", async () => {
    const { o, snap } = await at(3);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS + 60_000);
    expect(snap().spam).toEqual({ phase: "ready", probeId: "probe.s.cycle_3", collapsed: false });
    let records = await o.logRecords();
    expect(records.filter((r) => r.kind === "spam_ready" && !isPractice(r))).toEqual([]);
    await o.spamReady(); // 60 s late: still accepted, the item shown
    expect(snap().spam).toMatchObject({ phase: "item", forced: false });

    const s = await at(6);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await s.o.spamReady();
    expect(SPAM_ANSWER_TIMEOUT_MS).toBe(60_000);
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 1);
    expect(s.snap().spam?.phase).toBe("item");
    await vi.advanceTimersByTimeAsync(1);
    // SPEC/30 §5.2: the first item is closed (logged null); V6's second item follows at once, with its own 60 s window.
    expect(s.snap().spam).toMatchObject({ phase: "item", probeId: "probe.s.cycle_6.b", itemIndex: 2, itemCount: 2 });
    records = await s.o.logRecords();
    expect(records.filter((r) => r.kind === "spam_answered" && (r.detail as { probeId: string }).probeId === "probe.s.cycle_6").map((r) => r.detail)).toEqual([{ probeId: "probe.s.cycle_6", response: null, timedOut: true }]);
    expect(records.filter((r) => r.kind === "spam_closed" && (r.detail as { cycle: number }).cycle === 6)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS - 1);
    expect(s.snap().spam?.phase).toBe("item");
    await vi.advanceTimersByTimeAsync(1);
    expect(s.snap().spam).toBeNull();
    records = await s.o.logRecords();
    expect(records.filter((r) => r.kind === "spam_answered" && (r.detail as { probeId: string }).probeId === "probe.s.cycle_6.b").map((r) => r.detail)).toEqual([{ probeId: "probe.s.cycle_6.b", response: null, timedOut: true }]);
    expect(records.filter((r) => r.kind === "spam_closed" && (r.detail as { cycle: number }).cycle === 6).map((r) => r.detail)).toEqual([{ probeId: "probe.s.cycle_6", cycle: 6 }]);
  });

  it("an option without its confidence by the deadline: the answer stands, the confidence is missing", async () => {
    const { o, snap } = await at(8);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    await o.spamReady();
    await o.answerSpam(keyOf(8));
    await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS);
    expect(snap().spam).toBeNull();
    const m = spamMeasures(await o.logRecords(), spamKeysOf(scenario.probeSchedule.probes, scenario.invariants));
    expect(m.find((x) => x.view === 8)).toEqual(expect.objectContaining({ probeId: "probe.s.cycle_8", response: keyOf(8), correct: true, confidence: null, answerTimedOut: false }));
  });

  it("a merged view's step boundary (V6, V11) waits for an open item, never for the ready prompt (revision (ag)): the second step never arrives under a question", async () => {
    for (const view of [6, 11]) {
      // The prompt left up: the boundary on time at 65 s, the prompt still waiting.
      const a = await at(view);
      await vi.advanceTimersByTimeAsync(66_000);
      expect(a.snap().spam?.phase).toBe("ready");
      const onTime = (await a.o.logRecords()).find((r) => r.kind === "step_boundary_reached" && (r.detail as { cycle: number }).cycle === view)!;
      expect((onTime.detail as { atViewSeconds: number }).atViewSeconds).toBe(65);

      // "Ready" at once and the items left open: the boundary waits for the probe's close at 25 s + the 60 s window of each
      // item (V11: one item, 85 s; V6: its second item too, SPEC/30 §5.2, 145 s — still before the 150 s cap).
      const items = scenario.probeSchedule.probes.filter((p) => p.type === "S" && p.cycle === view).length;
      expect(items).toBe(view === 6 ? 2 : 1);
      const b = await at(view);
      await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
      await b.o.spamReady();
      await vi.advanceTimersByTimeAsync(SPAM_ANSWER_TIMEOUT_MS * items - 1);
      expect(b.snap().spam?.phase).toBe("item");
      expect((await b.o.logRecords()).some((r) => r.kind === "step_boundary_reached" && (r.detail as { cycle: number }).cycle === view)).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const all = await b.o.logRecords();
      const ofView = (k: string) => all.findIndex((r) => r.kind === k && (r.detail as { cycle: number }).cycle === view);
      const closed = ofView("spam_closed"), boundary = ofView("step_boundary_reached");
      expect(closed).toBeGreaterThan(-1);
      expect(boundary).toBeGreaterThan(closed);
      expect((all[boundary]!.detail as { atViewSeconds: number }).atViewSeconds).toBe((SPAM_OFFSET_MS + SPAM_ANSWER_TIMEOUT_MS * items) / 1000);
    }
    // Said ready to at once, an item closes long before the minimum (a second item's window, SPEC/30 §5.2, may run past
    // it: the view's end then waits for the item, as for any open item).
    for (const c of scenario.cycles.filter((x) => SPAM_VIEWS.has(x.index))) expect((SPAM_OFFSET_MS + SPAM_ANSWER_TIMEOUT_MS) / 1000).toBeLessThan(c.minViewSeconds);
  });

  it("under a short preview minimum, a view end that falls due while the ITEM is open waits for it to close (never inside an open item)", async () => {
    const o = new SessionOrchestrator(scenario, "substitutive", { previewOverride: { minViewSeconds: 12 } });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((x) => (box.snap = x));
    const snap = () => box.snap!;
    await o.start();
    while (snap().currentCycle !== 3) await completeView(o, snap);
    await vi.advanceTimersByTimeAsync(3_000); // the prompt at 2.5 s
    await allocateAndConfirm(o, snap); // the panel is usable during the ready prompt; before the minimum: the period confirmed
    await o.spamReady();
    await vi.advanceTimersByTimeAsync(11_000); // the scaled minimum (13 s, a merged view) passes under the open item
    expect(snap()).toMatchObject({ currentCycle: 3, minimumReached: true, step: "awaiting_view_end", spam: { phase: "item", forced: false } });
    await o.answerSpam("a");
    await o.submitSpamConfidence(50);
    // SPEC/30 §5.2: V3's second item holds the end too; the view ends once it closes.
    expect(snap()).toMatchObject({ currentCycle: 3, step: "awaiting_view_end", spam: { phase: "item", probeId: "probe.s.cycle_3.b", forced: false } });
    await o.answerSpam("b");
    await o.submitSpamConfidence(75);
    expect(snap()).toMatchObject({ currentCycle: 3, step: "plan_confidence" }); // SPEC/30 §5.4: the view has ended; its plan's confidence
    await o.submitPlanConfidence(50);
    expect(snap().currentCycle).toBe(4);
    const records = await o.logRecords();
    const closed = records.findIndex((r) => r.kind === "spam_closed" && (r.detail as { cycle: number }).cycle === 3);
    const ended = records.findIndex((r) => r.kind === "view_ended" && (r.detail as { cycle: number }).cycle === 3);
    expect(ended).toBeGreaterThan(closed);
    expect(records[ended]!.detail).toMatchObject({ endedBy: "minimum_length" });
  });

  it("the key's records are in the message log when the item is shown (every key answerable from the screen)", async () => {
    for (const view of [...SPAM_VIEWS].sort((a, b) => a - b)) {
      const { o, snap } = await at(view);
      await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
      await o.spamReady();
      const ids = new Set(snap().radioLog.map((e) => e.id));
      for (const id of SPAM_KEY_ATOMS[view]!) expect(ids.has(id), `V${view} ${id}`).toBe(true);
    }
  });

  it("the ready latency's covariate: a Thinker answer still pending at the prompt is read from the log", async () => {
    let resolve!: (r: ThinkerResponse) => void;
    const transport = vi.fn<ThinkerTransport>().mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { o } = await at(3, "substitutive", transport);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS - 2_000);
    const pending = o.askAiChat("paljonko on palanut?");
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await o.spamReady(); // the answer is still out
    resolve(LIVE);
    await vi.advanceTimersByTimeAsync(5_000);
    await pending; // it arrives under the locked tools, hidden until the probe closes
    const m = spamMeasures(await o.logRecords(), new Map());
    expect(m.find((x) => x.view === 3)).toMatchObject({ probeId: "probe.s.cycle_3", thinkerPendingAtPrompt: true });
  });

  it("is the same probe in every cell (the Haku cell included), with the same records", async () => {
    for (const condition of ["directed", "substitutive"] as const) {
      const { o, snap } = await at(3, condition);
      await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
      await o.spamReady();
      expect(snap().spam).toMatchObject({ probeId: "probe.s.cycle_3", phase: "item" });
      expect(snap()).toMatchObject({ toolsLocked: false, decisionHeld: true });
    }
  });
});

describe("the measures from a real session", () => {
  it("ready latency, answer latency, correct and confidence per probe; the hinge check's reading time, latency and correctness", async () => {
    let extra = 0;
    const o = new SessionOrchestrator(scenario, "substitutive", { realClockMs: () => performance.now() + extra });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((x) => (box.snap = x));
    const snap = () => box.snap!;
    await o.start();
    while (snap().currentCycle !== 3) await completeView(o, snap);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS + 2_000);
    await o.spamReady(); // 2 s after the prompt
    await vi.advanceTimersByTimeAsync(4_000);
    await o.answerSpam("a"); // 4 s after ready
    await o.submitSpamConfidence(50);
    while (snap().step !== "hinge_pause") await completeView2(o, snap);
    extra += 30_000; // the directive is read for 30 s
    await o.showHingeCheck();
    extra += 7_000;
    await o.answerHingeCheck(hingeKey);
    await o.dismissHinge();

    const records = await o.logRecords();
    const m = spamMeasures(records, spamKeysOf(scenario.probeSchedule.probes, scenario.invariants));
    const v3 = m.find((x) => x.view === 3)!;
    expect(v3).toMatchObject({ readyLatencyMs: 2_000, answerLatencyMs: 4_000, response: "a", correct: keyOf(3) === "a", confidence: 50, thinkerPendingAtPrompt: false });
    expect(m.find((x) => x.view === 6)).toMatchObject({ readyTimedOut: false, forced: false, readyCensored: false }); // answered at once by `runOutView`
    expect(hingeCheckMeasure(records, hingeKey)).toEqual({ itemId: "hinge.manipulation_check", readingMs: 30_000, answerLatencyMs: 7_000, optionId: hingeKey, correct: true });
  });
});

describe("the manipulation check on the hinge screen (brief D3)", () => {
  it("shows the directive, then the question without it; Continue is refused until it is answered; one answer, one of its options", async () => {
    const s = start("directed");
    await s.o.start();
    while (s.snap().step !== "hinge_pause") await completeView2(s.o, s.snap);
    expect(s.snap().hingeCheck).toMatchObject({ phase: "directive", chosen: null });
    expect(s.snap().hingeDirective).not.toBeNull();
    await expect(s.o.dismissHinge()).rejects.toThrow(/manipulation check/);
    await expect(s.o.answerHingeCheck(hingeKey)).rejects.toThrow();

    await s.o.showHingeCheck();
    expect(s.snap().hingeDirective).toBeNull(); // answered from what was read, not read off the screen
    expect(s.snap().hingeCheck).toMatchObject({ phase: "item", promptFi: "Mikä on nyt voimassa oleva toimintalinja?" });
    expect(s.snap().hingeCheck!.options).toHaveLength(4);
    await expect(s.o.dismissHinge()).rejects.toThrow(/manipulation check/);
    await expect(s.o.answerHingeCheck("z")).rejects.toThrow(RangeError);

    await s.o.answerHingeCheck("c");
    expect(s.snap().hingeCheck).toMatchObject({ phase: "answered", chosen: "c" });
    await expect(s.o.answerHingeCheck("b")).rejects.toThrow(); // one answer
    await s.o.dismissHinge();
    expect(s.snap()).toMatchObject({ currentCycle: 8, hingeCheck: null });

    const records = await s.o.logRecords();
    const seq = (k: string) => records.findIndex((r) => r.kind === k);
    expect(seq("hinge_pause_start")).toBeLessThan(seq("hinge_check_presented"));
    expect(seq("hinge_check_presented")).toBeLessThan(seq("hinge_check_answered"));
    expect(seq("hinge_check_answered")).toBeLessThan(seq("hinge_pause_end"));
    expect(records[seq("hinge_check_answered")]!.detail).toEqual({ itemId: "hinge.manipulation_check", optionId: "c" });
  });
});

/** Like `completeView`, but stops at the hinge. */
async function completeView2(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
}

describe("I4: no SPAM or hinge-check key on the screen side", () => {
  it("the snapshot never carries a key while a probe or the check is on screen", async () => {
    const { o, snap } = await at(3);
    await vi.advanceTimersByTimeAsync(SPAM_OFFSET_MS);
    const forbidden = /"(correct|expected|invariantName|keyAtomIds|mapKey|isCorrect)"/;
    expect(JSON.stringify(snap().spam)).not.toMatch(forbidden);
    await o.spamReady();
    expect(JSON.stringify(snap().spam)).not.toMatch(forbidden);
    expect(Object.keys(snap().spam!).sort()).toEqual(["chosen", "forced", "itemCount", "itemIndex", "options", "phase", "probeId", "promptFi"]); // SPEC/30 §5.2: the item's place in its delivery
    expect(JSON.stringify(snap().freeze)).not.toMatch(forbidden);

    const s = start("directed");
    await s.o.start();
    while (s.snap().step !== "hinge_pause") await completeView2(s.o, s.snap);
    await s.o.showHingeCheck();
    expect(JSON.stringify(s.snap().hingeCheck)).not.toMatch(forbidden);
    expect(Object.keys(s.snap().hingeCheck!).sort()).toEqual(["chosen", "options", "phase", "promptFi"]);
  });

  it("a freeze item reaches the screen without any option's `correct` flag (round 2 fix)", async () => {
    const s = start();
    await s.o.start();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(s.snap().step).toBe("freeze");
    expect(JSON.stringify(s.snap().freeze)).not.toMatch(/"correct"/);
  });

  it("no screen component imports the item banks (`demo-probes.ts` holds SPAM_ITEMS with their keys)", () => {
    for (const f of ["SpamCard.tsx", "JudgementPanel.tsx", "SessionView.tsx", "RightPanel.tsx", "FreezeScreen.tsx"]) {
      const src = readFileSync(`app/render/ui/components/${f}`, "utf8");
      const imports = [...src.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]!);
      expect(imports.filter((i) => /demo-probes|demo-directive|scenario\/demo-/.test(i)), f).toEqual([]);
      expect(src, f).not.toMatch(/\.invariants\b/);
    }
  });
});
