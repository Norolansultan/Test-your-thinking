/**
 * Test-only harness for the M1 golden-run determinism test
 * (SPEC/10_Build_Plan_and_Acceptance.md, M1: "replays three reference
 * input sequences and produces byte-identical logs against committed
 * fixtures").
 *
 * This is deliberately NOT the production run loop — no scenario content
 * exists yet (that is M2, blocked on authored corpus per SPEC/11). It is a
 * minimal, fully deterministic script executor over exactly the engine
 * primitives M1 delivers: {@link EngineRunLoop} (clock + freeze machine +
 * cycle sequencer), the seeded PRNG, and the append-only log. Its purpose
 * is narrow: prove that the composition of those primitives is
 * reproducible, not to model a real session.
 */

import { deriveSeed, Xorshift64Star } from "../../app/engine/prng.js";
import { EngineRunLoop } from "../../app/engine/run-loop.js";
import { MAIN_VIEW_SCHEDULE } from "../../app/scenario/views.js";
import type { Trigger } from "../../app/engine/freeze-machine.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";

export type ReferenceAction =
  | { readonly type: "transition"; readonly trigger: Trigger }
  | { readonly type: "advance"; readonly deltaSeconds: number }
  | { readonly type: "end_cycle" }
  | { readonly type: "dismiss_hinge" }
  | { readonly type: "draw_u64"; readonly label: string }
  | { readonly type: "draw_int"; readonly bound: number; readonly label: string }
  | { readonly type: "shuffle"; readonly items: readonly string[]; readonly label: string };

export interface ReferenceRunResult {
  readonly header: LogHeader;
  readonly records: readonly LogRecord[];
}

function fixedHeader(scenarioId: string, seed: bigint): LogHeader {
  return {
    formatVersion: "0.1.0",
    sessionId: `golden-${scenarioId}`,
    participantCode: "golden-participant",
    condition: "directed",
    scenarioId,
    scenarioVersion: "0.1.0",
    seed: seed.toString(),
    bundleHash: "golden-fixture-bundle",
    appVersion: "0.1.0",
    startedAtIso: "2026-01-01T00:00:00.000Z", // fixed — annotation only, never read by logic
    userAgent: "golden-run-harness",
    viewport: { w: 1280, h: 800, dpr: 1 },
    counterbalance: { expectationOrder: "A" },
    cell: "radio",
    echelon: "command",
  };
}

/**
 * Runs one reference input sequence deterministically and returns the
 * resulting header and full record list. `tWallOffsetMs` is fixed at 0 for
 * every record: it is annotation-only (I2) and irrelevant to determinism,
 * and pinning it keeps the golden fixture free of any wall-clock artifact.
 */
export async function runReferenceSequence(
  scenarioId: string,
  seed: bigint,
  actions: readonly ReferenceAction[],
): Promise<ReferenceRunResult> {
  const loop = new EngineRunLoop(MAIN_VIEW_SCHEDULE); // SPEC/26 §3: 14 views, hinge after V7
  const rng = new Xorshift64Star(deriveSeed(seed, scenarioId));
  const header = fixedHeader(scenarioId, seed);
  const log = new SessionLog(header, new InMemoryLogSink());

  for (const action of actions) {
    switch (action.type) {
      case "transition": {
        const event = loop.transition(action.trigger);
        await log.append(loop.clock.now(), 0, "state_transition", event);
        break;
      }
      case "advance": {
        loop.clock.advance(action.deltaSeconds);
        await log.append(loop.clock.now(), 0, "clock_advanced", { deltaSeconds: action.deltaSeconds });
        break;
      }
      case "end_cycle": {
        const cycleBefore = loop.cycles.currentCycle();
        const t = loop.endCycle();
        await log.append(t, 0, "cycle_end", { cycle: cycleBefore });
        break;
      }
      case "dismiss_hinge": {
        loop.dismissHinge();
        await log.append(loop.clock.now(), 0, "hinge_dismissed", { cycle: loop.cycles.currentCycle() });
        break;
      }
      case "draw_u64": {
        const value = rng.nextU64();
        await log.append(loop.clock.now(), 0, "rng_draw_u64", { label: action.label, value: value.toString() });
        break;
      }
      case "draw_int": {
        const value = rng.nextInt(action.bound);
        await log.append(loop.clock.now(), 0, "rng_draw_int", { label: action.label, bound: action.bound, value });
        break;
      }
      case "shuffle": {
        const result = rng.shuffle(action.items);
        await log.append(loop.clock.now(), 0, "rng_shuffle", { label: action.label, result });
        break;
      }
    }
  }

  return { header, records: await log.readAll() };
}

/** Canonical, deterministic JSON serialisation (sorted object keys) so fixture diffs are stable and platform-independent. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value), null, 2) + "\n";
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
