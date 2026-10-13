/**
 * Test-only harness combining the M1 engine (EngineRunLoop + SessionLog)
 * with the M3 render tree, to drive a realistic session over real
 * (fixture) scenario content. Built for `no-truth.spec.ts`.
 *
 * Note on what goes in the log vs. what only drives the render tree:
 * SPEC/07_Telemetry_and_Logging.md §3 separately bans truth from the
 * telemetry log itself ("no record contains a correctness value, a flag,
 * a truth annotation"), which is M4's concern, not this test's. So the
 * raw, truth-bearing `InfoAtom`/`Envelope` scenario content is used only
 * to drive `applyRenderEvent` in-memory here; the log records identifying
 * metadata only (atom/cycle ids), matching what a real `bubble_available`
 * /`envelope_revealed` telemetry record would carry. What this test
 * checks is the render tree — the thing I4 is actually about.
 */

import { EngineRunLoop } from "../../app/engine/run-loop.js";
import { cycleScheduleOf, STEP_SECONDS } from "../../app/scenario/views.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { applyRenderEvent, EMPTY_RENDER_TREE, type RenderEvent, type RenderTree } from "../../app/render/render-tree.js";
import type { AllocationMark, ScenarioContract } from "../../app/scenario/types.js";

export interface GoldenRenderRunResult {
  readonly records: readonly LogRecord[];
  /** Parallel to `records` by `seq`: the render tree as it stood immediately after that record was appended. */
  readonly renderTreeAtSeq: readonly RenderTree[];
}

function header(scenario: ScenarioContract): LogHeader {
  return {
    formatVersion: "0.1.0",
    sessionId: "golden-render-session",
    participantCode: "golden-render-participant",
    condition: "directed",
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    seed: scenario.seed.toString(),
    bundleHash: "golden-render-fixture-bundle",
    appVersion: "0.1.0",
    startedAtIso: "2026-01-01T00:00:00.000Z",
    userAgent: "golden-render-harness",
    viewport: { w: 1280, h: 800, dpr: 1 },
    counterbalance: { expectationOrder: "A" },
    cell: "radio",
    echelon: "command",
  };
}

export interface GoldenRenderRunOptions {
  /** Exercises the correction and allocation RenderEvent kinds at the contradiction cycle. Default true. Set false to drive a run with zero participant allocations (SPEC/12 §11 `test/render/no-recommendation.spec`). */
  readonly includeAllocationAndCorrection?: boolean;
}

export async function runGoldenRenderSession(
  scenario: ScenarioContract,
  options: GoldenRenderRunOptions = {},
): Promise<GoldenRenderRunResult> {
  const includeAllocationAndCorrection = options.includeAllocationAndCorrection ?? true;
  const loop = new EngineRunLoop(cycleScheduleOf(scenario));
  const log = new SessionLog(header(scenario), new InMemoryLogSink());
  const renderTreeAtSeq: RenderTree[] = [];
  let tree: RenderTree = EMPTY_RENDER_TREE;

  async function step(kind: string, detail: unknown, event?: RenderEvent): Promise<void> {
    const record = await log.append(loop.clock.now(), 0, kind, detail);
    if (event) tree = applyRenderEvent(tree, event);
    renderTreeAtSeq[record.seq] = tree;
  }

  for (const trigger of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) {
    const t = loop.transition(trigger);
    await step("state_transition", t);
  }

  for (const cycleSpec of scenario.cycles) {
    await step("cycle_start", { cycle: cycleSpec.index }, { kind: "cycle_start", cycle: cycleSpec });

    // Atoms carry their world-state step; a view shows the atoms of every step it spans (SPEC/26 §2).
    const firstStep = cycleSpec.startsAtVirtual / STEP_SECONDS + 1;
    const atomsThisCycle = scenario.atoms.filter((a) => a.cycle >= firstStep && a.cycle < firstStep + cycleSpec.steps);
    for (const atom of atomsThisCycle.filter((a) => a.cycle === firstStep)) {
      await step("bubble_available", { atomId: atom.id, tier: atom.tier }, { kind: "bubble_delivered", atom });
    }
    // A merged view reaches its second step inside the view (SPEC/26 §2): positions move on, then its items arrive.
    if (cycleSpec.stepBoundary) {
      loop.clock.advanceTo(cycleSpec.stepBoundary.atVirtual);
      await step("step_boundary", { cycle: cycleSpec.index }, { kind: "step_boundary", cycle: cycleSpec });
      for (const atom of atomsThisCycle.filter((a) => a.cycle !== firstStep)) {
        await step("bubble_available", { atomId: atom.id, tier: atom.tier }, { kind: "bubble_delivered", atom });
      }
    }

    const envelope = scenario.envelopes.find((e) => e.cycle === cycleSpec.index);
    if (envelope) {
      await step("envelope_revealed", { cycle: cycleSpec.index }, { kind: "envelope_revealed", envelope });
    }

    // On the contradiction cycle, exercise the correction and allocation paths too, so the walk covers every RenderEvent kind at least once.
    if (includeAllocationAndCorrection && cycleSpec.index === scenario.contradiction.cycle) {
      await step(
        "corrected_projection_drawn",
        { cycle: cycleSpec.index },
        { kind: "correction_drawn", correction: { correction: { direction: "NE", reach: "200_500m" } } },
      );
      const marks: AllocationMark[] = [
        { assetId: "EK11", fromPosition: { lat: 60.8, lon: 27.0 }, toSectorId: "L1", taskId: "task.direct-attack", assignedAtCycle: cycleSpec.index },
      ];
      await step("allocation_submitted", { cycle: cycleSpec.index, assetCount: marks.length }, { kind: "allocation_submitted", marks });
    }

    if (cycleSpec.index === 1 && scenario.branchStatements.length > 0) {
      await step(
        "branch_list_presented",
        { cycle: cycleSpec.index },
        { kind: "branch_list_presented", statements: scenario.branchStatements },
      );
    }

    loop.endCycle();
    if (cycleSpec.index === scenario.hinge.afterCycle) {
      loop.dismissHinge();
    }
  }

  const finalTransition = loop.transition("handoff_complete");
  await step("state_transition", finalTransition);

  return { records: await log.readAll(), renderTreeAtSeq };
}
