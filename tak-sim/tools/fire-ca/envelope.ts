/**
 * The machine's projection — SPEC/24 §5, "Envelope (the machine)": an ensemble run from the
 * reported perimeter with the machine's inputs (stale fuel map, mean wind, the authored
 * "Envelope assumed" rate, no authored events), cut at `envelopeBurnShare` of the runs.
 *
 * A projection covers one or more consecutive SEGMENTS, one per world-state step (SPEC/26 §2). A
 * merged view (two steps) projects through both, each step with its own authored machine inputs:
 * its wind (M2: `machineWindFromDeg` when the machine lags the truth) and its envelope-assumed
 * rate. So the horizon distance is the sum of the steps' authored envelope rates × 20 min, i.e. the
 * merged envelope assumes their mean over 40 min — SPEC/26 §6's "envelopes are recomputed per view",
 * using only what was authored per step (SPEC/18 §7). The machine does not learn anything at the
 * step boundary: it starts once, from the view's reported perimeter.
 *
 * Isochrones are snapshots of the same runs at fixed fractions of the horizon (½ and 1: T+10/20
 * for a 20-minute view, T+20/40 for a 40-minute one), so the outermost isochrone IS the envelope and
 * reaches exactly to the next situation (researcher decision 2 Oct 2026: the T+30 / T+60 band beyond
 * the next view made every fire look short of its projection; the horizon snapshot never depended
 * on the extra steps, so no flag changes). With a single segment this reproduces the pre-SPEC/26 per-cycle envelope
 * exactly (same RNG label, same draws, same step counts).
 */

import { deriveSeed, Xorshift64Star } from "../../app/engine/prng.js";
import type { GridFrame } from "./geometry.js";
import { BURNED, BURNING, FireAutomaton, Mulberry32, NEIGHBOURS, NO_FUEL, UNBURNED, type AlexandridisParams, type FuelClass, type FuelGrid, type Wind } from "./model.js";

/** Isochrone horizons as fractions of the projection horizon (SPEC/12 revision 24 Sep (c)). */
export const ISOCHRONE_FRACTIONS = [0.5, 1] as const;

export interface EnvelopeSegment {
  readonly wind: Wind; // the machine's wind for this step (mean speed)
  readonly rosMpm: number; // the step's authored "Envelope assumed" head rate
  readonly minutes: number;
}

export interface EnvelopeProjection {
  readonly envelope: Uint8Array;
  readonly isoMinutes: readonly number[];
  readonly isoMasks: readonly Uint8Array[];
  /** Mean CA steps per ensemble member over the horizon. */
  readonly meanSteps: number;
}

export interface EnvelopeContext {
  readonly frame: GridFrame;
  readonly machineFuel: FuelGrid;
  readonly refClass: FuelClass;
  readonly params: AlexandridisParams;
  readonly seed: bigint;
  readonly scenarioId: string;
  readonly ensembleSize: number;
  readonly envelopeBurnShare: number;
  /** Measured head advance in cells per CA step on the reference fuel under `wind`. */
  readonly cellsPerStep: (wind: Wind) => number;
}

export function rngFor(opts: { seed: bigint; scenarioId: string }, label: string): Mulberry32 {
  const x = new Xorshift64Star(deriveSeed(opts.seed, opts.scenarioId, `fire-ca/${label}`));
  return new Mulberry32(Number(x.nextU64() & 0xffffffffn));
}

/** Whole steps plus one extra step with the fractional probability — expected distance is exact. */
export function stepsFor(rosMpm: number, minutes: number, cellsPerStepValue: number, cellSizeM: number, rng: Mulberry32): number {
  const exact = (rosMpm * minutes) / (cellSizeM * cellsPerStepValue);
  const whole = Math.floor(exact);
  return whole + (rng.nextFloat() < exact - whole ? 1 : 0);
}

/** Reported footprint -> machine start state: perimeter cells burning, interior burned. */
function machineStartState(frame: GridFrame, reported: Uint8Array, base: FireAutomaton, held?: Uint8Array): Uint8Array {
  const { cols, rows } = frame;
  const s = base.state.slice();
  // Lines the crews hold (2 Oct 2026): the machine knows a secured edge — the map draws it as
  // contained — so it neither spreads from it nor across it. Without this the projection grew the
  // old, dead fire after step 10 and gave the live front a small share of the bands.
  if (held) for (let i = 0; i < s.length; i++) if (held[i] && s[i] === UNBURNED && !reported[i]) s[i] = NO_FUEL;
  for (let i = 0; i < reported.length; i++) {
    if (!reported[i]) continue;
    const c = i % cols;
    const r = (i - c) / cols;
    let front = false;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (s[nr * cols + nc] === UNBURNED && !reported[nr * cols + nc]) { front = true; break; }
    }
    s[i] = front ? BURNING : BURNED;
  }
  return s;
}

/** CA steps taken by `minutes` into the projection, walking the segments; past the end, the last segment continues. */
function stepsAt(minutes: number, segments: readonly EnvelopeSegment[], n: readonly number[]): number {
  let acc = 0;
  let t = minutes;
  for (let k = 0; k < segments.length; k++) {
    const m = segments[k]!.minutes;
    if (t <= m) return acc + Math.round((n[k]! * t) / m);
    acc += n[k]!;
    t -= m;
  }
  const last = segments.length - 1;
  return acc + Math.round((n[last]! * t) / segments[last]!.minutes);
}

/** Index of the segment CA step `s` (0-based) falls in; past the end, the last segment. */
function segmentOfStep(s: number, n: readonly number[]): number {
  let acc = 0;
  for (let k = 0; k < n.length; k++) {
    acc += n[k]!;
    if (s < acc) return k;
  }
  return n.length - 1;
}

export function projectEnvelope(ctx: EnvelopeContext, reported: Uint8Array, segments: readonly EnvelopeSegment[], rngLabel: string, held?: Uint8Array): EnvelopeProjection {
  if (segments.length === 0) throw new Error("projectEnvelope needs at least one segment");
  const { frame } = ctx;
  const horizon = segments.reduce((s, x) => s + x.minutes, 0);
  const isoMinutes = ISOCHRONE_FRACTIONS.map((f) => f * horizon);
  const k = segments.map((s) => ctx.cellsPerStep(s.wind));
  const envelopeCa = new FireAutomaton(ctx.machineFuel, ctx.params);
  const startState = machineStartState(frame, reported, new FireAutomaton(ctx.machineFuel, ctx.params), held);
  const counts = new Uint16Array(reported.length);
  // Per isochrone, the same count at a different number of steps of the same runs. The horizon
  // snapshot is taken before any extra step, so `counts` (and every flag) is unchanged by them.
  const isoCounts = isoMinutes.map(() => new Uint16Array(reported.length));
  const addFootprint = (into: Uint16Array) => { const fp = envelopeCa.footprint(); for (let i = 0; i < fp.length; i++) into[i] = into[i]! + fp[i]!; };
  let totalSteps = 0;
  for (let e = 0; e < ctx.ensembleSize; e++) {
    const rng = rngFor(ctx, `${rngLabel}/${e}`);
    const n = segments.map((seg, j) => stepsFor(seg.rosMpm, seg.minutes, k[j]!, frame.cellSizeM, rng));
    totalSteps += n.reduce((a, b) => a + b, 0);
    envelopeCa.loadStates(startState);
    const at = isoMinutes.map((m) => stepsAt(m, segments, n));
    let s = 0;
    for (let q = 0; q < at.length; q++) {
      for (; s < at[q]!; s++) envelopeCa.step(segments[segmentOfStep(s, n)]!.wind, rng);
      if (isoMinutes[q] === horizon) addFootprint(counts);
      addFootprint(isoCounts[q]!);
    }
  }
  const minRuns = Math.max(1, Math.ceil(ctx.envelopeBurnShare * ctx.ensembleSize));
  const envelope = new Uint8Array(reported.length);
  for (let i = 0; i < envelope.length; i++) envelope[i] = reported[i] || counts[i]! >= minRuns ? 1 : 0;
  const isoMasks = isoMinutes.map((m, q) => {
    if (m === horizon) return envelope;
    const mask = new Uint8Array(reported.length);
    for (let i = 0; i < mask.length; i++) mask[i] = reported[i] || isoCounts[q]![i]! >= minRuns ? 1 : 0;
    return mask;
  });
  return { envelope, isoMinutes, isoMasks, meanSteps: Math.round(totalSteps / ctx.ensembleSize) };
}

/** Arrival-time bands: each isochrone minus the one inside it (the first minus the reported fire). */
export function bandMasks(reported: Uint8Array, isoMinutes: readonly number[], isoMasks: readonly Uint8Array[]): { fromMinutes: number; toMinutes: number; mask: Uint8Array }[] {
  let inner = reported;
  return isoMasks.map((outer, k) => {
    const mask = new Uint8Array(outer.length);
    for (let i = 0; i < mask.length; i++) mask[i] = outer[i] && !inner[i] ? 1 : 0;
    inner = outer;
    return { fromMinutes: k === 0 ? 0 : isoMinutes[k - 1]!, toMinutes: isoMinutes[k]!, mask };
  });
}
