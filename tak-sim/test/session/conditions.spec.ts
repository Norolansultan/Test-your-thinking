/**
 * SPEC/02 revision (o) in the running session: the AI is the only difference between the groups.
 * Both see the same envelope in every view, and (revision (x), 6 Oct 2026) the decision panel asks both
 * for the sector plan only — no Type J, no rationale; the Haku group's own-projection task is gone;
 * nobody can ask a unit (SPEC/02 revision (j)).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { ALL_RECORD_KINDS, TELEMETRY_FORMAT_VERSION } from "../../app/telemetry/record-kinds.js";
import { passHinge, PLAN, runOutView, submitPlan } from "./view-flow.js";

const scenario = buildDemoScenario();
type Condition = "directed" | "substitutive";

async function session(condition: Condition) {
  const o = new SessionOrchestrator(scenario, condition, { participantCode: "P-7" });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  await o.start();
  return { o, snap: () => box.snap! };
}

/** The view's time run out (any freeze answered): the decision panel's first step. */
async function toDecision(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
}

/** Runs VP, the training and V1–V14 (with the hinge), recording each view's envelope at exploration. */
async function runWholeSession(condition: Condition) {
  const { o, snap } = await session(condition);
  const envelopes: SessionSnapshot["currentEnvelope"][] = [];
  const stepsAtDecision: string[] = [];
  for (let view = 0; view <= 14; view++) {
    expect(snap().currentCycle).toBe(view);
    envelopes.push(snap().currentEnvelope);
    await toDecision(o, snap);
    stepsAtDecision.push(snap().step);
    await submitPlan(o, PLAN);
    if (snap().step === "training") await o.completeTraining();
    if (snap().step === "hinge_pause") await passHinge(o);
  }
  expect(snap().step).toBe("complete");
  return { envelopes, stepsAtDecision, records: await o.logRecords() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the envelope and the plan in both groups (SPEC/02 revision (o) §1; revision (x))", () => {
  it("the Haku group sees the envelope in every view, VP included; the decision panel opens on the plan; no Type J is logged", async () => {
    const { envelopes, stepsAtDecision, records } = await runWholeSession("directed");
    expect(envelopes.every((e) => e !== null)).toBe(true);
    expect(stepsAtDecision).toEqual(Array(15).fill("allocation"));
    const revealed = records.filter((r) => r.kind === "envelope_revealed").map((r) => (r.detail as { envelopeId: string }).envelopeId);
    const suffixes = ["practice", ...Array.from({ length: 14 }, (_, i) => `cycle_${i + 1}`)];
    expect(revealed).toEqual(suffixes.map((s) => `envelope.${s}`));
    expect(records.some((r) => r.kind === "containment_judgement_submitted")).toBe(false);
  });

  it("both groups get the same envelope, horizon label included", async () => {
    const haku = await runWholeSession("directed");
    const llm = await runWholeSession("substitutive");
    expect(haku.envelopes).toEqual(llm.envelopes);
    expect(haku.envelopes.map((e) => e!.horizonLabel)).toEqual(llm.envelopes.map((e) => e!.horizonLabel));
  });
});

describe("no own-projection task (SPEC/15 revision (o))", () => {
  it("has no method, step, snapshot field or record kind for it", async () => {
    const { o, snap } = await session("directed");
    const api = o as unknown as Record<string, unknown>;
    expect(api.submitOwnProjection).toBeUndefined();
    expect(api.submitOwnProjectionConfidence).toBeUndefined();
    expect(snap()).not.toHaveProperty("ownProjection");
    expect(ALL_RECORD_KINDS as readonly string[]).not.toContain("own_projection_submitted");
  });

  it("a whole Haku-group session logs no own projection and no probe.own id", async () => {
    const { records } = await runWholeSession("directed");
    expect(records.some((r) => r.kind === ("own_projection_submitted" as string))).toBe(false);
    expect(JSON.stringify(records)).not.toContain("probe.own");
  });
});

describe("no rationale is asked (revision (x), 6 Oct 2026)", () => {
  it.each(["directed", "substitutive"] as const)("%s: the plan is logged with rationaleAsked false and rationaleFi null", async (condition) => {
    const { o, snap } = await session(condition);
    await toDecision(o, snap);
    expect(snap().step).toBe("allocation");
    await submitPlan(o, PLAN);
    const allocation = (await o.logRecords()).find((r) => r.kind === "allocation_submitted")!;
    expect(allocation.detail).toMatchObject({ rationaleAsked: false, rationaleFi: null });
  });
});

describe("no participant-facing radio (SPEC/02 revision (j), SPEC/07 revision (j))", () => {
  it("offers no way to ask a unit, and the radio record kinds stay gone (log format 0.8.0)", async () => {
    const { o } = await session("directed");
    expect((o as unknown as Record<string, unknown>).askUnit).toBeUndefined();
    expect(TELEMETRY_FORMAT_VERSION).toBe("0.10.0"); // SPEC/30 (19 Oct 2026)
    for (const kind of ["radio_request_submitted", "unit_reply_delivered"]) expect(ALL_RECORD_KINDS as readonly string[]).not.toContain(kind);
  });

  it("recorded radio traffic stays findable as data through Haku's builder", async () => {
    const { o, snap } = await session("directed");
    await toDecision(o, snap);
    await submitPlan(o, PLAN);
    await o.completeTraining(); // V1, world-state step 1
    const traffic = scenario.atoms.find((a) => a.cycle <= 1 && a.record.kind === "lateral_traffic")!; // recorded radio traffic
    expect(traffic).toBeDefined();
    const found = await o.navigateQuery({ category: traffic.navCategory, sourceId: traffic.provenance.sourceId, window: "whole_incident" });
    expect(found.map((a) => a.id)).toContain(traffic.id);
  });
});

describe("the session order: briefing -> practice -> training -> V1 (SPEC/15 §2, SPEC/05 §4)", () => {
  it.each(["directed", "substitutive"] as const)("%s: the engine passes BRIEFING, WARMUP (VP) and TUTORIAL in that order", async (condition) => {
    const o = new SessionOrchestrator(scenario, condition);
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    await o.start(); // the briefing page is gone (revision (ae)): BRIEFING is passed at once
    expect(box.snap!).toMatchObject({ practice: true, step: "exploration" });
    await toDecision(o, () => box.snap!);
    await submitPlan(o, PLAN);
    expect(box.snap!.step).toBe("training");
    await o.completeTraining();
    expect(box.snap!).toMatchObject({ currentCycle: 1, step: "exploration" });

    const records = await o.logRecords();
    const screens = records.filter((r) => r.kind === "briefing_advanced").map((r) => (r.detail as { screenId: string }).screenId);
    expect(screens).toEqual(["briefing.setting", `training.${condition}`]);
    const states = records.filter((r) => r.kind === "state_transition").map((r) => (r.detail as { to: string }).to);
    expect(states).toEqual(["PREFLIGHT", "BRIEFING", "WARMUP", "TUTORIAL", "RUNNING"]);
  });
});
