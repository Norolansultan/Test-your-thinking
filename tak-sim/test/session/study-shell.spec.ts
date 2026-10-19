/**
 * The study shell (work package I, 5 Oct 2026): consent before anything else is logged, the
 * preflight and its refusal, the pre- and post-session questionnaires (raw), the debrief after the
 * questionnaire, and the end of the session; the English glossary logged from the message log.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { InMemoryLogSink } from "../../app/telemetry/log.js";
import { evaluatePreflight, isDesktop, type PreflightEnv } from "../../app/session/preflight.js";
import { checkQuestionnaireAnswers, POST_ITEMS, questionnaireItems, retentionOrder } from "../../app/session/questionnaire.js";
import type { Cell } from "../../app/scenario/types.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { allocateAndConfirm, passHinge, runOutView } from "./view-flow.js";

const scenario = buildDemoScenario();

const GOOD: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "not_needed",
};

function start(cell: Cell = "radio", options: Partial<SessionOptions> = {}) {
  const o = new SessionOrchestrator(scenario, conditionOfCell(cell), { cell, studyShell: true, thinker: { transport: vi.fn() }, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

const kinds = (records: readonly LogRecord[]) => records.map((r) => r.kind);
const transitions = (records: readonly LogRecord[]) => records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { trigger: string }).trigger);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("preflight rules (app/session/preflight.ts)", () => {
  it("passes a desktop browser with IndexedDB and WebGL2, whatever the window size", () => {
    expect(evaluatePreflight(GOOD)).toEqual({ passed: true, failures: [], hard: false });
    expect(evaluatePreflight({ ...GOOD, viewport: { w: 800, h: 500, dpr: 2 } })).toEqual({ passed: true, failures: [], hard: false });
  });

  it("refuses a phone, a tablet (also iPadOS's desktop user agent with touch), and accepts a touchscreen laptop with a fine pointer", () => {
    expect(isDesktop({ ...GOOD, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148" })).toBe(false);
    expect(isDesktop({ ...GOOD, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36" })).toBe(false);
    expect(isDesktop({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5, pointer: "coarse" })).toBe(false);
    expect(isDesktop({ ...GOOD, maxTouchPoints: 10, pointer: "fine" })).toBe(true);
    expect(evaluatePreflight({ ...GOOD, maxTouchPoints: 5, pointer: "coarse" })).toEqual({ passed: false, failures: ["not_desktop"], hard: true });
  });

  it("an unreachable proxy is fixable (not hard); no IndexedDB or WebGL2 is hard", () => {
    expect(evaluatePreflight({ ...GOOD, proxy: "unreachable" })).toEqual({ passed: false, failures: ["proxy_unreachable"], hard: false });
    expect(evaluatePreflight({ ...GOOD, indexedDb: false, viewport: { w: 1000, h: 700, dpr: 1 } })).toEqual({ passed: false, failures: ["no_indexeddb"], hard: true });
    expect(evaluatePreflight({ ...GOOD, webgl2: false }).hard).toBe(true);
  });
});

describe("consent", () => {
  it("is the first record after the header; nothing else is logged before it", async () => {
    const { o, snap } = start();
    await o.start();
    expect(snap().step).toBe("consent");
    expect(kinds(await o.logRecords())).toEqual(["session_started"]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(kinds(await o.logRecords())).toEqual(["session_started"]);
    await expect(o.completeTraining()).rejects.toThrow();
    await o.decideConsent(true, true);
    const records = await o.logRecords();
    expect(kinds(records).slice(0, 3)).toEqual(["session_started", "consent_decided", "state_transition"]);
    expect(records[1]!.detail).toEqual({ decision: "accepted", attested: true, textId: "consent.placeholder.v0", dwellMs: expect.any(Number) });
    expect(records[1]!.tWallOffsetMs).toBeGreaterThanOrEqual(0); // the decision's time
    expect(transitions(records)).toEqual(["start"]); // BOOT -> PREFLIGHT
    expect(snap().step).toBe("preflight");
  });

  it("declining ends the session without data: only the header and the decision; BOOT -> ABORTED", async () => {
    const { o, snap } = start();
    await o.start();
    await o.decideConsent(false, true);
    const records = await o.logRecords();
    expect(kinds(records)).toEqual(["session_started", "consent_decided", "state_transition"]);
    expect(records[1]!.detail).toMatchObject({ decision: "declined", attested: false });
    expect(records[2]!.detail).toEqual({ from: "BOOT", to: "ABORTED", trigger: "consent_declined" });
    expect(snap().step).toBe("consent_declined");
    await expect(o.decideConsent(true, true)).rejects.toThrow();
    await expect(o.submitPreflight(GOOD)).rejects.toThrow();
  });

  it("an unticked attestation is logged as given and does not stop the session (an exclusion rule, SPEC/09 §6.2)", async () => {
    const { o, snap } = start();
    await o.start();
    await o.decideConsent(true, false);
    expect((await o.logRecords())[1]!.detail).toMatchObject({ decision: "accepted", attested: false });
    expect(snap().step).toBe("preflight");
  });
});

describe("preflight in the session", () => {
  async function toPreflight(cell: Cell = "radio", options: { allowPreflightOverride?: boolean } = {}) {
    const s = start(cell, options);
    await s.o.start();
    await s.o.decideConsent(true, true);
    return s;
  }

  it("a fixable refusal stays, a re-check logs only a change, and a passing check moves to the pre-session item", async () => {
    const { o, snap } = await toPreflight();
    const small = { ...GOOD, viewport: { w: 1200, h: 760, dpr: 1 }, proxy: "unreachable" as const };
    expect((await o.submitPreflight(small)).failures).toEqual(["proxy_unreachable"]);
    expect(snap()).toMatchObject({ step: "preflight", preflight: { proxyNeeded: true, outcome: { passed: false, failures: ["proxy_unreachable"] } } });
    await o.submitPreflight({ ...small, viewport: { w: 1210, h: 770, dpr: 1 } }); // same outcome: not logged again
    await o.submitPreflight(GOOD);
    const records = await o.logRecords();
    const results = records.filter((r) => r.kind === "preflight_result").map((r) => r.detail);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ passed: false, refusalReason: "proxy_unreachable", failures: ["proxy_unreachable"], hard: false, viewport: { w: 1200, h: 760, dpr: 1 }, benchmarkScore: 0, benchmark: "not_run", proxy: "unreachable" });
    expect(results[1]).toMatchObject({ passed: true, refusalReason: null, failures: [], userAgent: GOOD.userAgent, pointer: "fine", indexedDb: true, webgl2: true });
    expect(transitions(records)).toEqual(["start", "preflight_passed"]);
    expect(snap().step).toBe("questionnaire");
    expect(snap().questionnaire).toMatchObject({ id: "pre", items: [{ id: "fatigue.start" }] });
  });

  it("checks the proxy in every cell (Haku's chat uses it, 8 Oct 2026); an unreachable proxy is fixable", async () => {
    const { o, snap } = await toPreflight("reasoning_intent");
    expect(snap().preflight!.proxyNeeded).toBe(true);
    await o.submitPreflight({ ...GOOD, proxy: "unreachable" });
    expect(snap().step).toBe("preflight");
    await o.submitPreflight({ ...GOOD, proxy: "reachable" });
    expect(snap().step).toBe("questionnaire");
    expect((await toPreflight("radio")).snap().preflight!.proxyNeeded).toBe(true);
  });

  it("a hard failure refuses: PREFLIGHT -> ABORTED, the refusal screen stays", async () => {
    const { o, snap } = await toPreflight();
    await o.submitPreflight({ ...GOOD, indexedDb: false });
    const records = await o.logRecords();
    expect(transitions(records)).toEqual(["start", "preflight_refused"]);
    expect(records.at(-2)!.detail).toMatchObject({ passed: false, refusalReason: "no_indexeddb", hard: true });
    expect(snap()).toMatchObject({ step: "preflight_refused", preflight: { outcome: { hard: true } } });
    await expect(o.submitPreflight(GOOD)).rejects.toThrow();
  });

  it("the override is for demonstrations only, and is logged", async () => {
    const study = await toPreflight();
    await expect(study.o.submitPreflight({ ...GOOD, viewport: { w: 900, h: 600, dpr: 1 } }, true)).rejects.toThrow(/demonstrations only/);
    const demo = await toPreflight("radio", { allowPreflightOverride: true });
    await demo.o.submitPreflight({ ...GOOD, webgl2: false }); // hard, but a demonstration may still override
    expect(demo.snap().step).toBe("preflight");
    await demo.o.submitPreflight({ ...GOOD, webgl2: false }, true);
    expect(demo.snap().step).toBe("questionnaire");
    expect((await demo.o.logRecords()).filter((r) => r.kind === "preflight_result").at(-1)!.detail).toMatchObject({ passed: false, overridden: true });
  });
});

async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
  if (snap().step === "hinge_pause") await passHinge(o);
}

/** Through consent, the preflight, the pre-session item, the briefing and every view, to the post-session questionnaire. */
async function toEnd(cell: Cell, options: Partial<SessionOptions> = {}) {
  const s = start(cell, options);
  await s.o.start();
  await s.o.decideConsent(true, true);
  await s.o.submitPreflight({ ...GOOD, proxy: "reachable" });
  await s.o.submitQuestionnaire({ "fatigue.start": 3 });
  expect(s.snap().step).toBe("exploration"); // the briefing page is gone (revision (ae)): straight to the practice view
  while (s.snap().step !== "questionnaire") await completeView(s.o, s.snap);
  return s;
}

describe("the questionnaires and the debrief", () => {
  it("the pre-session item is logged raw and leads straight to the practice view (no briefing page, revision (ae))", async () => {
    const { o, snap } = start();
    await o.start();
    await o.decideConsent(true, true);
    await o.submitPreflight(GOOD);
    await expect(o.submitQuestionnaire({ "fatigue.start": 9 })).rejects.toThrow(RangeError);
    await expect(o.submitQuestionnaire({ "tlx.mental": 3 })).rejects.toThrow(/not an item shown/);
    await o.submitQuestionnaire({ "fatigue.start": 2 });
    const records = await o.logRecords();
    expect(records.find((r) => r.kind === "questionnaire_presented")!.detail).toEqual({ questionnaireId: "pre", itemIds: ["fatigue.start"] });
    expect(records.find((r) => r.kind === "questionnaire_submitted")!.detail).toEqual({ questionnaireId: "pre", answers: [{ itemId: "fatigue.start", value: 2 }], dwellMs: expect.any(Number) });
    const after = (await o.logRecords()).slice(records.findIndex((r) => r.kind === "questionnaire_submitted") + 1);
    expect(after.find((r) => r.kind === "briefing_advanced")!.detail).toEqual({ screenId: "briefing.setting", dwellMs: 0, auto: true, screenRemoved: true });
    expect(after.some((r) => r.kind === "state_transition" && (r.detail as { trigger: string }).trigger === "briefing_complete")).toBe(true);
    expect(snap().step).toBe("exploration");
    expect(snap().practice).toBe(true);
  });

  it("after V14 the post-session questionnaire comes before any debrief; then the debrief by cell; then COMPLETE", async () => {
    const { o, snap } = await toEnd("reasoning_intent");
    const q = snap().questionnaire!;
    expect(q.id).toBe("post");
    expect(q.items[0]!.id).toBe("retention.hinge");
    expect(q.items.map((i) => i.id)).toContain("ai.directive_relation");
    // The hinge item repeated, options reordered (none where it stood at the hinge), no key on the screen side.
    const hinge = scenario.hinge.manipulationCheck!.options.map((x) => x.id);
    expect(q.retentionOptions.map((x) => x.id)).toEqual(retentionOrder(hinge));
    q.retentionOptions.forEach((x, i) => expect(x.id).not.toBe(hinge[i]));
    expect(JSON.stringify(q)).not.toMatch(/correct|expected|invariant/i);
    expect(snap().debrief).toBeNull();
    let records = await o.logRecords();
    expect(kinds(records)).not.toContain("debrief_shown");
    expect(records.filter((r) => r.kind === "questionnaire_presented").at(-1)!.detail).toMatchObject({ questionnaireId: "post", retentionOptionOrder: retentionOrder(hinge) });

    // Revision (ai): the multi items' orders are logged when shown, and with each answer.
    const basis = q.items.find((i) => i.id === "last.basis")!;
    const basisOrder = basis.kind === "multi" ? basis.options.map((x) => x.id) : [];
    expect(records.filter((r) => r.kind === "questionnaire_presented").at(-1)!.detail).toMatchObject({ multiOptionOrders: [{ itemId: "last.basis", optionIds: basisOrder }, { itemId: "disagreement.action", optionIds: expect.any(Array) }, { itemId: "recognition.what", optionIds: expect.any(Array) }] });
    await o.submitQuestionnaire({
      "retention.hinge": q.retentionOptions[0]!.id, "ai.directive_relation": "dont_know", "directive.fit": "not_at_times", "tlx.mental": 14, "last.possibilities": "2",
      "last.basis": ["thinker", "projection"], "last.basis.main": "thinker", "disagreement.recall": "no", "felt.wrong": "unsure", "role.rank": "platoon_commander",
    });
    records = await o.logRecords();
    const submitted = records.filter((r) => r.kind === "questionnaire_submitted").at(-1)!.detail as { answers: { itemId: string; value: unknown; optionOrder?: string[]; notShown?: true }[] };
    expect(submitted.answers).toHaveLength(q.items.length); // one per item, blanks and items not shown as null
    const answer = (id: string) => submitted.answers.find((a) => a.itemId === id)!;
    expect(answer("felt.wrong").value).toBe("unsure");
    expect(answer("directive.fit").value).toBe("not_at_times");
    expect(answer("last.basis")).toEqual({ itemId: "last.basis", value: basisOrder.filter((id) => id === "thinker" || id === "projection"), optionOrder: basisOrder });
    expect(answer("last.basis.main").value).toBe("thinker");
    expect(answer("disagreement.action")).toMatchObject({ value: null, notShown: true });
    expect(JSON.stringify(submitted)).not.toMatch(/power line/);
    expect(snap()).toMatchObject({ step: "debrief", debrief: { textId: "debrief.reasoning_intent", cell: "reasoning_intent" } });
    expect(records.at(-1)!).toMatchObject({ kind: "debrief_shown", detail: { textId: "debrief.reasoning_intent" } });

    await o.finishDebrief();
    records = await o.logRecords();
    expect(kinds(records).slice(-2)).toEqual(["debrief_closed", "state_transition"]);
    expect(records.at(-1)!.detail).toEqual({ from: "DEBRIEF_HANDOFF", to: "COMPLETE", trigger: "handoff_complete" });
    expect(snap().step).toBe("complete");
  }, 60_000);

  it("the Haku cell is not asked about Thinker", async () => {
    const { snap } = await toEnd("radio");
    const ids = snap().questionnaire!.items.map((i) => i.id);
    expect(ids).not.toContain("ai.directive_relation");
    expect(ids).not.toContain("thinker.trust");
    expect(ids).toContain("retention.hinge");
  }, 60_000);
});

describe("questionnaire items (app/session/questionnaire.ts)", () => {
  it("covers SPEC/09 §2, §6.1 and SPEC/27 §4.1", () => {
    const ids = POST_ITEMS.map((i) => i.id);
    for (const id of ["retention.hinge", "ai.directive_relation", "tlx.mental", "tlx.frustration", "fatigue.end", "picture.quality", "tools.trust", "attention.check",
      "last.possibilities", "last.basis", "disagreement.recall", "disagreement.action", "felt.wrong", "prior.knowledge",
      "role.rank", "years.service", "incidents.commanded", "sim.exposure", "region.familiarity"]) expect(ids).toContain(id);
    expect(ids).not.toContain("accuracy.perceived"); // revision (x), 6 Oct 2026: no containment judgement to rate
    expect(new Set(ids).size).toBe(ids.length);
    expect(questionnaireItems("post", "reasoning_once").map((i) => i.id)).toContain("ai.directive_relation");
  });

  it("refuses an answer outside its item", () => {
    const items = questionnaireItems("post", "radio");
    expect(() => checkQuestionnaireAnswers(items, { "role.rank": "general" })).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(items, { "years.service": 2.5 })).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(items, { "retention.hinge": "z" }, ["a", "b", "c", "d"])).toThrow(RangeError);
    expect(() => checkQuestionnaireAnswers(items, { "last.basis": "x".repeat(601) })).toThrow(RangeError); // no free text (revision (ai))
    expect(() => checkQuestionnaireAnswers(items, { "felt.wrong": "the power line" })).toThrow(RangeError);
  });
});

describe("no glossary (revision (ae))", () => {
  it("an English session has no glossary to open and logs no glossary record", async () => {
    const o = new SessionOrchestrator(scenario, "directed", { language: "en" });
    await o.start();
    expect("openGlossary" in o).toBe(false);
    expect((await o.logRecords()).some((r) => r.kind.startsWith("glossary_"))).toBe(false);
  });
});

describe("resume into the study shell (5 Oct 2026)", () => {
  async function resumeFrom(sink: InMemoryLogSink, cell: Cell = "radio") {
    vi.clearAllTimers();
    const records = await sink.readAll();
    const s = start(cell, { sink, resume: { header: records[0]!.detail as never, records, interruptedForMs: 5_000 } });
    await s.o.start();
    return { ...s, before: records.length };
  }
  const gapless = (records: readonly LogRecord[]) => records.forEach((r, i) => expect(r.seq).toBe(records[0]!.seq + i));

  it("before the consent decision: the consent screen again, from BOOT", async () => {
    const sink = new InMemoryLogSink();
    await start("radio", { sink }).o.start();
    const { o, snap, before } = await resumeFrom(sink);
    expect(snap().step).toBe("consent");
    const records = await sink.readAll();
    expect(kinds(records.slice(before))).toEqual(["fault", "fault_resolved", "session_resumed"]);
    expect(records.at(-1)!.detail).toMatchObject({ resumedAt: "consent" });
    await o.decideConsent(true, true);
    expect(snap().step).toBe("preflight");
    gapless(await sink.readAll());
  });

  it("after consent, before the pre-session item: the preflight again, from PREFLIGHT", async () => {
    const sink = new InMemoryLogSink();
    const first = start("radio", { sink });
    await first.o.start();
    await first.o.decideConsent(true, true);
    const { o, snap } = await resumeFrom(sink);
    expect(snap().step).toBe("preflight");
    await o.submitPreflight(GOOD);
    expect(snap().step).toBe("questionnaire");
    expect(transitions(await sink.readAll())).toEqual(["start", "preflight_passed"]); // the replayed "start" is not logged twice
  });

  it("after V14, before the debrief closed: the post-session questionnaire, then the debrief, then COMPLETE and session_completed once", async () => {
    const sink = new InMemoryLogSink();
    await toEnd("reasoning_intent", { sink });
    const { o, snap } = await resumeFrom(sink, "reasoning_intent");
    expect(snap()).toMatchObject({ step: "questionnaire", questionnaire: { id: "post" } });
    await o.submitQuestionnaire({});
    expect(snap().step).toBe("debrief");
    await o.finishDebrief();
    expect(snap().step).toBe("complete");
    await o.completeSession(); // the engine is already COMPLETE: no second transition
    const records = await sink.readAll();
    expect(kinds(records).filter((k) => k === "session_completed")).toHaveLength(1);
    expect(transitions(records).filter((t) => t === "handoff_complete")).toHaveLength(1);
    gapless(records);
  }, 60_000);
});
