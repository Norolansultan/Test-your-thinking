/**
 * The sector plan in the running session (SPEC/16 revision (s), 2 Oct 2026): the panel's offer per
 * view, the drone teams' tasking logged per observation drone with its target, view and time,
 * invalid plans refused, and the world unchanged by any plan (identical stimulus).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import { DEPARTURE_REASONS, type SectorPlan } from "../../app/scenario/plan-types.js";
import { assertValidPlan, copyPlan } from "../../app/session/allocation.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { directiveAdherence, droneSurveyTiming, REKINDLE_DRONE_SURVEY } from "../../app/telemetry/derived-measures.js";
import { DIRECTIVE_KEYS } from "../../app/scenario/demo-directive.js"; // truth: the test, never the session, reads the keys
import type { LogRecord } from "../../app/telemetry/log.js";
import type { DroneTaskedDetail } from "../../app/telemetry/record-kinds.js";
import { passHinge, PLAN, runOutView, submitPlan } from "./view-flow.js";

const scenario = buildDemoScenario();
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function start(previewOverride: { minViewSeconds: number } | null = null) {
  const o = new SessionOrchestrator(scenario, "directed", { participantCode: "P-7", previewOverride });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  await o.start();
  return { o, snap: () => box.snap! };
}

/** The view's time run out (any freeze answered), Type J "holds" and the outlook: the plan step of the current view. */
async function toAllocation(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
}

/** Runs the whole session; `planFor(view)` is the plan given in that view. */
async function runSession(planFor: (view: number) => SectorPlan, previewOverride: { minViewSeconds: number } | null = null): Promise<{ records: readonly LogRecord[]; offered: Map<number, SessionSnapshot["allocation"]> }> {
  const { o, snap } = await start(previewOverride);
  const offered = new Map<number, SessionSnapshot["allocation"]>();
  for (let view = 0; view <= 14; view++) {
    await toAllocation(o, snap);
    expect(snap().step).toBe("allocation");
    offered.set(view, snap().allocation);
    await submitPlan(o, planFor(view)); // the plan confirms the period
    if (snap().step === "training") await o.completeTraining();
    if (snap().step === "hinge_pause") await passHinge(o);
  }
  expect(snap().step).toBe("complete");
  return { records: await o.logRecords(), offered };
}

const surveyL3: SectorPlan = { mainEffort: "L2", posture: "direct_attack", secondary: { sectorId: "L3", taskId: "task.mopup" }, drones: { sectorId: "L3", taskId: "task.thermal-survey" } };

describe("the plan panel's offer", () => {
  it("is the scenario's four sectors, with the crews and observation drone teams on scene for orientation", async () => {
    const { offered } = await runSession(() => PLAN);
    const v7 = offered.get(7)!;
    expect(v7.sectors.map((s) => s.labelFi)).toEqual(["L1 Pohjoinen", "L2 Koillinen", "L3 Etelä", "L4 Länsi"]);
    expect(v7.droneTeams).toEqual(["DR1", "DR2", "DR3"]);
    expect(offered.get(12)!.droneTeams).not.toContain("VD1"); // the water drone and the robot are not the plan's
    expect(offered.get(1)!.crews).not.toContain("KY21");
    expect(offered.get(8)!.crews).toContain("KY21");
  });
});

describe("drone taskings", () => {
  it("are logged one per observation drone team on scene with target sector, task, view and time", async () => {
    const { records, offered } = await runSession((view) => (view === 7 ? surveyL3 : PLAN));
    const tasked = records.filter((r) => r.kind === "drone_tasked").map((r) => r.detail as DroneTaskedDetail);
    expect(tasked).toEqual(offered.get(7)!.droneTeams.map((assetId) => (
      { view: 7, assetId, assetType: "drone", targetSectorId: "L3", taskId: "task.thermal-survey", clockLabel: "16:20" }
    )));
    const first = records.find((r) => r.kind === "drone_tasked")!;
    const before = records.filter((r) => r.seq < first.seq);
    expect(before[before.length - 1]!.kind).toBe("allocation_submitted");
    expect(records.find((r) => r.seq > first.seq && r.kind === "cycle_end")!.detail).toMatchObject({ cycle: 7 });
    expect(droneSurveyTiming(records, REKINDLE_DRONE_SURVEY)).toMatchObject({ outcome: "in_window", firstInWindow: { view: 7, assetId: "DR1" } });
    expect(records.find((r) => r.kind === "allocation_submitted" && (r.detail as { plan: SectorPlan }).plan.drones !== null)!.detail).toMatchObject({ plan: surveyL3 });
  });

  it("do not change the world: the same items, envelopes and duty messages arrive as without any plan change", async () => {
    const world = (records: readonly LogRecord[]) => records
      .filter((r) => ["bubble_available", "envelope_revealed", "duty_officer_message_delivered", "cycle_start"].includes(r.kind))
      .map((r) => `${r.kind}:${JSON.stringify(r.detail)}`);
    const quiet = await runSession(() => PLAN);
    const busy = await runSession((view) => (view >= 7 && view <= 9 ? surveyL3 : PLAN));
    expect(world(busy.records)).toEqual(world(quiet.records));
  });
});

describe("invalid plans are refused at the boundary", () => {
  it("an unknown sector, the secondary on the main effort, tasks from the wrong list", async () => {
    const { o, snap } = await start();
    await toAllocation(o, snap); // VP
    await expect(o.submitAllocation({ ...PLAN, mainEffort: "L9" })).rejects.toThrow(/unknown main-effort sector/);
    await expect(o.submitAllocation({ ...PLAN, secondary: { sectorId: "L2", taskId: "task.hold-line" } })).rejects.toThrow(/main effort/);
    await expect(o.submitAllocation({ ...PLAN, secondary: { sectorId: "L2", taskId: "task.direct-attack" } })).rejects.toThrow(/main effort/);
    await expect(o.submitAllocation({ ...PLAN, secondary: { sectorId: "L9", taskId: "task.hold-line" } })).rejects.toThrow(/unknown secondary/);
    await expect(o.submitAllocation({ ...PLAN, drones: { sectorId: "L3", taskId: "task.water-drop" } as never })).rejects.toThrow(/not a drone task/);
    expect((await o.logRecords()).some((r) => r.kind === "allocation_submitted")).toBe(false);
    // 6 Oct 2026: direct attack is a secondary task too (V14's flare-up beside a main effort protecting Lahdenkylä).
    await o.submitAllocation({ ...PLAN, secondary: { sectorId: "L4", taskId: "task.direct-attack" } });
    expect((await o.logRecords()).find((r) => r.kind === "allocation_submitted")!.detail).toMatchObject({ plan: { secondary: { sectorId: "L4", taskId: "task.direct-attack" } } });
  });
});

describe("the submit guard", () => {
  it("refuses a submit outside the plan step and a second submit while the first is running", async () => {
    const { o, snap } = await start();
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/submitAllocation in step/);
    await toAllocation(o, snap);
    const first = o.submitAllocation(PLAN);
    await expect(o.submitAllocation(PLAN)).rejects.toThrow(/already submitting/);
    await first;
    expect((await o.logRecords()).filter((r) => r.kind === "allocation_submitted")).toHaveLength(1);
  });
});

describe("the main effort's posture (4 Oct 2026, the phase-B directive)", () => {
  it("is required and from its list: a plan without one, or with another, is refused and nothing is logged", async () => {
    const { o, snap } = await start();
    await toAllocation(o, snap); // VP: asked in the practice view too
    const { posture: _p, ...noPosture } = PLAN;
    await expect(o.submitAllocation(noPosture as SectorPlan)).rejects.toThrow(/main-effort posture/);
    await expect(o.submitAllocation({ ...PLAN, posture: "offensive" } as never)).rejects.toThrow(/main-effort posture/);
    await expect(o.submitAllocation({ ...PLAN, posture: null } as never)).rejects.toThrow(/main-effort posture/);
    expect((await o.logRecords()).some((r) => r.kind === "allocation_submitted")).toBe(false);
    await o.submitAllocation({ ...PLAN, posture: "protect_values" });
    expect((await o.logRecords()).find((r) => r.kind === "allocation_submitted")!.detail).toMatchObject({ plan: { posture: "protect_values" } });
  });

  it("is logged with every plan, and the directive measure reads it from the log", async () => {
    const posture = (view: number): SectorPlan["posture"] => (view <= 7 ? "direct_attack" : view <= 10 ? "barrier_line" : "protect_values");
    const { records } = await runSession((view) => ({ ...PLAN, posture: posture(view) }));
    const plans = records.filter((r) => r.kind === "allocation_submitted").map((r) => (r.detail as { plan: SectorPlan }).plan.posture);
    expect(plans).toEqual(Array.from({ length: 15 }, (_, v) => posture(v)));
    const coded = directiveAdherence(records, DIRECTIVE_KEYS);
    expect(coded.map((c) => c.view)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]); // VP is not keyed
    // Phase A and V8 are not coded; the main effort is L2: not sound on the primary coding (core sectors only, 8 Oct 2026), which reads
    // the head's L3 alone; only the boundary-accepted sensitivity (the head within 50 m of the L2/L3 line at V11–V12) calls V11–V12 sound.
    expect(coded.map((c) => c.atViewEnd!.cell)).toEqual([null, null, null, null, null, null, null, null, "B", "B", "B", "B", "B", "B"]);
    // Review fixes (ah), 9 Oct 2026: the head stays in L3 alone at V11–V12, so the sensitivity coding agrees with the primary one.
    expect(coded.map((c) => c.atViewEnd!.cellWithBoundary)).toEqual([null, null, null, null, null, null, null, null, "B", "B", "B", "B", "B", "B"]);
    expect(coded.every((c) => !c.revised && c.atViewEnd === c.first)).toBe(true);
    // The plan is given after the view's minimum, so after a merged view's step boundary (review round 2).
    const merged = new Set(scenario.cycles.filter((c) => c.stepBoundary).map((c) => c.index as number));
    expect(coded.map((c) => c.afterBoundary)).toEqual(coded.map((c) => (merged.has(c.view) ? true : null)));
  });

  it("the orchestrator logs step_boundary_reached once per merged view, at half its minimum length (review round 2)", async () => {
    const { records } = await runSession(() => PLAN);
    const reached = records.filter((r) => r.kind === "step_boundary_reached").map((r) => r.detail as { cycle: number; atViewSeconds: number });
    const merged = scenario.cycles.filter((c) => c.stepBoundary);
    expect(merged.map((c) => c.index)).toEqual([2, 4, 6, 11, 12, 14]);
    expect(reached).toEqual(merged.map((c) => ({ cycle: c.index, atViewSeconds: c.minViewSeconds / 2 })));
    // It comes before the second step's pushed items, inside its own view.
    for (const r of records.filter((x) => x.kind === "step_boundary_reached")) {
      const view = records.filter((x) => x.kind === "cycle_start" && x.seq < r.seq).at(-1)!;
      expect((view.detail as { cycle: number }).cycle).toBe((r.detail as { cycle: number }).cycle);
      // ...and before every pushed item of the second step (review round 3).
      const cycle = scenario.cycles.find((c) => c.index === (r.detail as { cycle: number }).cycle)!;
      const secondStep = cycle.startsAtVirtual / STEP_SECONDS + 2;
      const secondStepBubbles = records.filter((x) => x.kind === "bubble_available" && x.seq > view.seq && scenario.atoms.find((a) => a.id === (x.detail as { atomId: string }).atomId)?.cycle === secondStep);
      expect(secondStepBubbles.length).toBeGreaterThan(0);
      expect(secondStepBubbles.every((b) => b.seq > r.seq)).toBe(true);
    }
  });

  it("under the ?esikatselu preview, step_boundary_reached carries the scaled view time (review round 3)", async () => {
    const { records } = await runSession(() => PLAN, { minViewSeconds: 12 });
    const reached = records.filter((r) => r.kind === "step_boundary_reached").map((r) => (r.detail as { atViewSeconds: number }).atViewSeconds);
    // A merged SPAM view (V6, V11): the SPAM item is answered as soon as its scaled prompt (2.5 s) shows (`runOutView`), so it
    // has closed by the scaled boundary, which comes on time (a boundary under an open item waits: spam.spec.ts).
    expect(reached).toEqual(scenario.cycles.filter((c) => c.stepBoundary).map((c) => (c.minViewSeconds * 12) / 120 / 2));
  });
});

describe("the departure note (fix pass 6, D5)", () => {
  it("is validated at the boundary: not before V8, a reason only with the box, one line, capped; and logged with the plan", async () => {
    const { o, snap } = await start();
    await toAllocation(o, snap); // VP
    await expect(o.submitAllocation({ ...PLAN, departureNoted: true })).rejects.toThrow(/no departure note before V8/);
    await expect(o.submitAllocation({ ...PLAN, departureReason: "crew_safety" })).rejects.toThrow(/needs the departure note/);
    expect((await o.logRecords()).some((r) => r.kind === "allocation_submitted")).toBe(false);
    await o.submitAllocation({ ...PLAN, departureNoted: false });
    expect((await o.logRecords()).find((r) => r.kind === "allocation_submitted")!.detail).toMatchObject({ plan: { departureNoted: false } });
  });

  it("assertValidPlan: the reason is one of the closed reasons (revision (ai)); free text is refused", () => {
    const space = scenario.allocationSpace;
    for (const r of DEPARTURE_REASONS) expect(() => assertValidPlan(space, 9, { ...PLAN, departureNoted: true, departureReason: r })).not.toThrow();
    expect(() => assertValidPlan(space, 9, { ...PLAN, departureNoted: true, departureReason: "pieni uusi palo" as never })).toThrow(/not a departure reason/);
    expect(() => assertValidPlan(space, 9, { ...PLAN, departureNoted: true, departureReason: "" as never })).toThrow(/not a departure reason/);
    expect(() => assertValidPlan(space, 9, { ...PLAN, departureNoted: true, departureReason: "tool_suggested" as never })).toThrow(/not a departure reason/);
    expect(() => assertValidPlan(space, 9, { ...PLAN, departureNoted: "yes" as never })).toThrow(/not a boolean/);
  });

  it("copyPlan keeps the note and the reason; no reason without the box; older plans stay as they were", () => {
    expect(copyPlan({ ...PLAN, departureNoted: true, departureReason: "new_fire_info" })).toEqual({ ...PLAN, departureNoted: true, departureReason: "new_fire_info" });
    expect(copyPlan({ ...PLAN, departureNoted: false, departureReason: "other" })).toEqual({ ...PLAN, departureNoted: false });
    expect(copyPlan(PLAN)).toEqual(PLAN);
  });

  it("a V9 plan with the note is logged in allocation_submitted and in the revision, and the measure reads it", async () => {
    const { records } = await runSession((view) => (view === 9 ? { ...PLAN, posture: "direct_attack", mainEffort: "L3", departureNoted: true, departureReason: "new_fire_info" as const } : PLAN));
    const v9 = records.filter((r) => r.kind === "allocation_submitted").map((r) => (r.detail as { plan: SectorPlan }).plan)[9]!;
    expect(v9).toMatchObject({ departureNoted: true, departureReason: "new_fire_info" });
    expect(directiveAdherence(records, DIRECTIVE_KEYS).find((a) => a.view === 9)!.departureNoted).toBe(true);
  });
});
