/**
 * Runs the scripted incident through the CA — SPEC/24 §5.
 *
 * One model produces both sides of the judgement:
 *   - TRUTH: the site's real fuel, the GUST wind (what the fire meets), and the authored events
 *     the model cannot produce itself (spotting, a second ignition, fire surfacing from peat).
 *   - ENVELOPE: the machine's stale fuel map, the MEAN wind, no authored events, started from
 *     the reported perimeter — mechanisms M1–M4 as input differences, not as drawn errors.
 *
 * Speed is authored, shape is modelled. The CA's rate of spread is only weakly sensitive to wind
 * (ignition probability saturates at 1), so each cycle's step count is calibrated so that the
 * head advances at the rate of spread authored in SPEC/18 §7 — "Head ROS (actual)" for truth,
 * "Envelope assumed" for the envelope. The CA supplies direction, shape, fuel and terrain
 * heterogeneity, and whether the envelope holds.
 */

import type { Polygon } from "../../app/engine/primitives.js";
import type { Flag } from "../../app/scenario/types.js";
import { projectEnvelope, rngFor, stepsFor, type EnvelopeContext, type EnvelopeProjection, type EnvelopeSegment } from "./envelope.js";
import { deriveFlag, DEFAULT_FLAG_RULE, extentAlong, type FlagEvidence, type FlagRule } from "./flags.js";
import { cellsInDisk, components, FIRE_OUTLINE, traceMask, type GridFrame } from "./geometry.js";
import { anyCell, splitFire, unionOf, type Rekindle } from "./new-fire.js";
import { distanceTransform } from "./traffic-fire.js";
import {
  BOREAL_PROVISIONAL,
  FireAutomaton,
  NO_FUEL,
  UNBURNED,
  Mulberry32,
  type AlexandridisParams,
  type FuelClass,
  type FuelGrid,
  type Wind,
} from "./model.js";

/**
 * Crews have a stretch of the perimeter in hand (SPEC/18 §5 sectors, §7 "L1 and L2 in hand").
 * The sector is the arc of bearings from the ignition point, clockwise from `fromBearingDeg` to
 * `toBearingDeg`. Applied at the start of the cycle, after the report.
 */
export interface ControlEvent {
  readonly kind: "control_sector";
  readonly fromBearingDeg: number;
  readonly toBearingDeg: number;
  readonly note: string;
}

export type CycleEvent = ScriptedEvent | ControlEvent;

export interface ScriptedEvent {
  readonly kind: "ignite" | "extinguish" | "remove_fuel";
  /**
   * `during_cycle` (default): happens after the reported situation is fixed, so the envelope
   * never knows about it — a spot fire, the omission. `before_report`: already observed and in
   * the reported perimeter — e.g. a spot fire the spotting aircraft reported.
   */
  readonly timing?: "before_report" | "during_cycle";
  /**
   * What the position is relative to: the ignition point (fixed geography — a bog, a line), the
   * fire's current head along the wind heading (spotting "300 m ahead of the head"), or the burned
   * footprint's EDGE in the authored direction (a rekindle "just outside the mapped edge"): along
   * `bearingDeg` from the ignition point to the outermost burned cell, then `distanceM` further out.
   */
  readonly anchor: "ignition" | "head" | "edge";
  readonly bearingDeg: number;
  readonly distanceM: number;
  readonly radiusM: number;
  readonly note: string;
  /** An old edge flaring up again (rekindle, holdover), not embers: the map labels it US, not PP (review fixes (ah), F4). */
  readonly rekindle?: boolean;
  /** What the crew says on the radio about it (SPEC/18 revision (l)); goes on the log mid-cycle. */
  readonly radioFi?: string;
  readonly radioFrom?: string;
}

export interface CycleForcing {
  readonly id: string; // "W1".."W5", "1".."20"
  readonly clock: string;
  readonly windFromDeg: number;
  /**
   * The wind direction the projection system works from, when it differs from the truth — a
   * stale observation or a forecast that has not caught up (M2). Defaults to `windFromDeg`.
   */
  readonly machineWindFromDeg?: number;
  readonly meanMs: number;
  readonly gustMs: number;
  readonly headRosActualMpm: number;
  readonly headRosEnvelopeMpm: number;
  readonly expectedFlag: Flag;
  /**
   * Why a breach is categorical when geometry alone cannot show it (SPEC/24 §6):
   *   `mechanism` — a regime change the envelope's model lacks (crown fire, spotting). The CA
   *                 must still show a real breach; the author's basis makes it categorical.
   *   `depth`     — the failure is below the surface (deep peat burning); no area breach needed.
   */
  readonly categoricalBasis?: "mechanism" | "depth";
  /** Applied to TRUTH at the start of the cycle, before any step. */
  readonly events?: readonly CycleEvent[];
}

export interface SiteModel {
  readonly name: string;
  readonly frame: GridFrame;
  readonly truthFuel: FuelGrid;
  /** What the projection system believes — stale stand data (M3). Same dimensions as truthFuel. */
  readonly machineFuel: FuelGrid;
  /** Ignition point, grid metres. */
  readonly ignitionM: { readonly eastM: number; readonly northM: number };
  /** Fuel class used to calibrate cells-per-step. */
  readonly referenceFuelId: string;
}

export interface RunOptions {
  readonly seed: bigint;
  readonly scenarioId: string;
  readonly ensembleSize: number;
  /**
   * The envelope is the set of cells burned in at least this share of the machine's ensemble
   * runs. 0.5 is the machine's median outcome — a single truth realisation then pokes past it
   * about half the time even when the machine is right. A lower cut-off is a more conservative
   * projection. A tuned quantity, like the rate-mark mix (SPEC/12 §5.2).
   */
  readonly envelopeBurnShare: number;
  readonly flagRule: FlagRule;
  readonly params: AlexandridisParams;
  readonly cycleMinutes: number;
}

export const DEFAULT_RUN_OPTIONS: Omit<RunOptions, "seed" | "scenarioId"> = {
  ensembleSize: 24,
  envelopeBurnShare: 0.2,
  flagRule: DEFAULT_FLAG_RULE,
  params: BOREAL_PROVISIONAL,
  cycleMinutes: 20,
};

export interface CycleResult {
  readonly id: string;
  readonly clock: string;
  readonly truthSteps: number;
  readonly envelopeSteps: number;
  readonly targetHeadRosMpm: number;
  readonly achievedHeadRosMpm: number;
  readonly envelopeAssumedRosMpm: number;
  readonly areaHa: number;
  readonly reported: Polygon | null;
  /** Reported fire detached from the main perimeter (a separate front, e.g. the BOG-S fire from cycle 12). */
  readonly reportedDetached: readonly Polygon[];
  readonly envelope: Polygon | null;
  /** Envelope parts detached from its main outline: the projection over each detached reported front. */
  readonly envelopeDetached: readonly Polygon[];
  readonly truthAtEnd: Polygon | null;
  /** Truth at the horizon detached from its main outline (spot fires, surfaced ground fire). */
  readonly spotFires: readonly Polygon[];
  readonly expectedFlag: Flag;
  readonly derived: FlagEvidence;
  readonly matches: boolean;
  /**
   * The projection as isochrones (SPEC/12 revision 24 Sep (c)): the same ensemble cut at the same
   * share at T+10, T+20 and T+30 minutes. T+20 is `envelope` — the scored boundary; the others are
   * snapshots of the same runs (half the steps, then 1.5×), so they are consistent with it by
   * construction and add nothing to what is scored.
   */
  readonly isochrones: readonly { readonly minutes: number; readonly main: Polygon | null; readonly others: readonly Polygon[] }[];
  /**
   * Raw masks for downstream checks; not written to JSON output. `ignited`: the cells the cycle's
   * authored ignitions set alight (both timings), where a new separate fire's growth is measured from.
   * Revision (aj): `newFires` / `newFiresReported`, one mask per rekindle lit so far (`new-fire.ts`): the fire
   * grown from it at the horizon / on the report (its own outline in `spotFires` / `reportedDetached`, sharing the
   * old edge); `separateReported`: the cells of the rekindles first on this report (the traffic's "new separate fire").
   */
  readonly masks: {
    readonly reported: Uint8Array; readonly envelope: Uint8Array; readonly truthAtEnd: Uint8Array; readonly isochrones: readonly Uint8Array[]; readonly held: Uint8Array; readonly ignited: Uint8Array;
    readonly newFires: readonly Uint8Array[]; readonly newFiresReported: readonly Uint8Array[]; readonly separateReported: Uint8Array;
    /** The rekindles lit by this report (the views split their envelopes by them too). */
    readonly rekindles: readonly Rekindle[];
  };
}

export interface ScenarioRunResult {
  readonly site: string;
  readonly seed: string;
  readonly cycles: readonly CycleResult[];
  readonly flagMatches: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function offsetFrom(base: { eastM: number; northM: number }, bearingDeg: number, distanceM: number) {
  const b = (bearingDeg * Math.PI) / 180;
  return { eastM: base.eastM + Math.sin(b) * distanceM, northM: base.northM + Math.cos(b) * distanceM };
}

/** The footprint cell furthest along `headingDeg` — the fire's head (ties: lowest index). */
export function headPoint(frame: GridFrame, mask: Uint8Array, headingDeg: number): { eastM: number; northM: number } | null {
  const t = (headingDeg * Math.PI) / 180;
  let best = -Infinity;
  let at = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const c = i % frame.cols;
    const p = (c + 0.5) * Math.sin(t) + ((i - c) / frame.cols + 0.5) * Math.cos(t);
    if (p > best) { best = p; at = i; }
  }
  if (at < 0) return null;
  const c = at % frame.cols;
  return { eastM: (c + 0.5) * frame.cellSizeM, northM: ((at - c) / frame.cols + 0.5) * frame.cellSizeM };
}

/** A separate patch smaller than this is a spot fire, not a front (ha; = fire-display.ts SPOT_FIRE_MAX_HA). */
const LIVE_HEAD_SPOT_MAX_HA = 1;

/**
 * The head of the LIVE fire (2 Oct 2026): the furthest point along the heading of what burned since
 * the previous report; the whole mask when nothing (or almost nothing) burned. Over the whole mask
 * the head stayed on the dead, contained NE tip while the rekindled front ran 2 km away. New spot
 * fires (a separate patch under 1 ha, e.g. the crown run's PP1/PP2 at 15:20) are not the head; a
 * separate front (the 2 ha rekindle at 17:20) is.
 */
export function liveHeadPoint(frame: GridFrame, mask: Uint8Array, prev: Uint8Array | null, headingDeg: number): { eastM: number; northM: number } | null {
  if (!prev) return headPoint(frame, mask, headingDeg);
  const cellHa = (frame.cellSizeM * frame.cellSizeM) / 10_000;
  const spot = new Uint8Array(mask.length);
  for (const comp of components(frame, mask)) if (comp.length * cellHa < LIVE_HEAD_SPOT_MAX_HA && !comp.some((i) => prev[i])) for (const i of comp) spot[i] = 1;
  // Spot fires are left out only while a front grows elsewhere; when the only new fire is a separate patch
  // (the rekindle at 17:20, still under 1 ha), that patch is the live front.
  const freshOf = (skipSpots: boolean) => {
    const m = new Uint8Array(mask.length);
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] && !prev[i] && !(skipSpots && spot[i])) { m[i] = 1; n += 1; }
    return { m, n };
  };
  for (const skipSpots of [true, false]) {
    const f = freshOf(skipSpots);
    if (f.n >= 3) return headPoint(frame, f.m, headingDeg);
  }
  return headPoint(frame, mask, headingDeg);
}

const headProjection = extentAlong;

/**
 * The point `distanceM` beyond the burned footprint's edge along `bearingDeg` from `from` (grid
 * metres): the ray's outermost burned cell, then further out. With nothing burned on the ray, the
 * distance is from `from` itself.
 */
export function edgePoint(frame: GridFrame, footprint: Uint8Array, from: { eastM: number; northM: number }, bearingDeg: number, distanceM: number): { eastM: number; northM: number } {
  const b = (bearingDeg * Math.PI) / 180;
  const stepM = frame.cellSizeM / 5;
  let edgeM = 0;
  for (let d = 0; d <= 5000; d += stepM) {
    const c = Math.floor((from.eastM + Math.sin(b) * d) / frame.cellSizeM), r = Math.floor((from.northM + Math.cos(b) * d) / frame.cellSizeM);
    if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) break;
    if (footprint[r * frame.cols + c]) edgeM = d;
  }
  return offsetFrom(from, bearingDeg, edgeM + distanceM);
}

/**
 * How far the live head ran in the cycle (m), the achieved rate's measure since 6 Oct 2026: the live
 * head (`liveHeadPoint`, the furthest point along the heading of what burned during the cycle) and
 * its distance from the fire at the cycle's start — the reported fire, or, for a new separate fire
 * (a rekindle ignited during the cycle), the cells it was ignited in. The projection of the whole
 * footprint stayed on the dead, contained NE tip in steps 11–15 and read 0 while the rekindled
 * front ran (review 6 Oct 2026, A8).
 */
export function liveHeadAdvanceM(frame: GridFrame, truthAtEnd: Uint8Array, reported: Uint8Array, ignited: Uint8Array, headingDeg: number): number {
  const live = liveHeadPoint(frame, truthAtEnd, reported, headingDeg);
  if (!live) return 0;
  const i = Math.floor(live.northM / frame.cellSizeM) * frame.cols + Math.floor(live.eastM / frame.cellSizeM);
  const comp = components(frame, truthAtEnd).find((cc) => cc.includes(i));
  const fromReported = !comp || comp.some((j) => reported[j]);
  const d = distanceTransform(frame, fromReported ? reported : ignited)[i]!;
  return Number.isFinite(d) ? d : 0;
}

function bearingFromIgnition(site: SiteModel, cell: number): number {
  const c = cell % site.frame.cols;
  const e = (c + 0.5) * site.frame.cellSizeM - site.ignitionM.eastM;
  const n = ((cell - c) / site.frame.cols + 0.5) * site.frame.cellSizeM - site.ignitionM.northM;
  const b = (Math.atan2(e, n) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
}

/** True if `b` lies on the clockwise arc from `from` to `to` (degrees). */
export function inArc(b: number, from: number, to: number): boolean {
  const span = (to - from + 360) % 360;
  return (b - from + 360) % 360 <= span;
}

function uniformGrid(cls: FuelClass, n: number, cellSizeM: number): FuelGrid {
  return { cols: n, rows: n, cellSizeM, fuel: new Uint8Array(n * n), classes: [cls], elevationM: null };
}

const calibrationCache = new Map<string, number>();

/**
 * Mean head advance, in cells per CA step, on uniform reference fuel under `wind`. Measured, not
 * assumed: a centre ignition is run on a flat uniform grid over four seeds.
 */
export function cellsPerStep(cls: FuelClass, wind: Wind, params: AlexandridisParams, cellSizeM: number): number {
  const key = `${cls.id}|${wind.fromDeg}|${wind.speedMs}|${params.pH}|${params.c1}|${params.c2}|${cellSizeM}`;
  const cached = calibrationCache.get(key);
  if (cached !== undefined) return cached;
  const n = 161;
  const frame: GridFrame = { origin: { lat: 0, lon: 0 }, cols: n, rows: n, cellSizeM };
  const heading = (wind.fromDeg + 180) % 360;
  let total = 0;
  const seeds = [11, 23, 37, 53];
  const steps = 40;
  for (const s of seeds) {
    const ca = new FireAutomaton(uniformGrid(cls, n, cellSizeM), params);
    const centre = 80 * n + 80;
    ca.ignite([centre]);
    const rng = new Mulberry32(s);
    const p0 = headProjection(frame, ca.footprint(), heading);
    let taken = 0;
    for (; taken < steps && ca.burningCount() > 0; taken++) ca.step(wind, rng);
    const p1 = headProjection(frame, ca.footprint(), heading);
    total += taken > 0 ? (p1 - p0) / cellSizeM / taken : 0;
  }
  const result = Math.max(total / seeds.length, 1e-6);
  calibrationCache.set(key, result);
  return result;
}

/** What the machine's projection needs from the site and the run options (`envelope.ts`). */
export function envelopeContext(site: SiteModel, opts: RunOptions): EnvelopeContext {
  const refClass = site.truthFuel.classes.find((c) => c.id === site.referenceFuelId);
  if (!refClass) throw new Error(`reference fuel "${site.referenceFuelId}" not in the site's fuel classes`);
  return {
    frame: site.frame,
    machineFuel: site.machineFuel,
    refClass,
    params: opts.params,
    seed: opts.seed,
    scenarioId: opts.scenarioId,
    ensembleSize: opts.ensembleSize,
    envelopeBurnShare: opts.envelopeBurnShare,
    cellsPerStep: (wind) => cellsPerStep(refClass, wind, opts.params, site.frame.cellSizeM),
  };
}

/** The machine's inputs for one step of forcing (SPEC/24 §5): mean wind, possibly stale; the envelope-assumed rate. */
export function envelopeSegment(f: CycleForcing, minutes: number): EnvelopeSegment {
  return { wind: { fromDeg: f.machineWindFromDeg ?? f.windFromDeg, speedMs: f.meanMs }, rosMpm: f.headRosEnvelopeMpm, minutes };
}

/**
 * Flag from truth against envelope (SPEC/24 §6), with the authored categorical basis: `depth` is
 * categorical without an area breach; `mechanism` turns a geometric quantitative breach categorical.
 */
export function flagWithBasis(frame: GridFrame, reported: Uint8Array, envelope: Uint8Array, truth: Uint8Array, rule: FlagRule, basis: CycleForcing["categoricalBasis"]): FlagEvidence {
  const geometric = deriveFlag(frame, reported, envelope, truth, rule, basis === "depth");
  return basis === "mechanism" && geometric.flag === "breach_quantitative"
    ? { ...geometric, flag: "breach_categorical", reason: `authored mechanism change; CA shows a breach (${geometric.reason})` }
    : geometric;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export function runScenario(site: SiteModel, forcing: readonly CycleForcing[], opts: RunOptions): ScenarioRunResult {
  const { frame } = site;
  const refClass = site.truthFuel.classes.find((c) => c.id === site.referenceFuelId);
  if (!refClass) throw new Error(`reference fuel "${site.referenceFuelId}" not in the site's fuel classes`);

  const truth = new FireAutomaton(site.truthFuel, opts.params);
  const ign = cellsInDisk(frame, site.ignitionM.eastM, site.ignitionM.northM, frame.cellSizeM);
  truth.ignite(ign);

  const envCtx = envelopeContext(site, opts);
  const machineBase = new FireAutomaton(envCtx.machineFuel, envCtx.params).state; // what the machine's own fuel map can burn
  const cycles: CycleResult[] = [];
  const cellHa = (frame.cellSizeM * frame.cellSizeM) / 10_000;
  const rekindles: Rekindle[] = []; // old edges that flared up so far, each with the footprint it grew out of (revision (aj))
  let prevReported: Uint8Array | null = null;

  for (const f of forcing) {
    const heading = (f.windFromDeg + 180) % 360;
    const ignited = new Uint8Array(frame.cols * frame.rows);
    const apply = (timing: "before_report" | "during_cycle") => {
      for (const ev of f.events ?? []) {
        if (ev.kind === "control_sector") {
          if (timing === "during_cycle") truth.secureSector((cell) => inArc(bearingFromIgnition(site, cell), ev.fromBearingDeg, ev.toBearingDeg));
          continue;
        }
        if ((ev.timing ?? "during_cycle") !== timing) continue;
        const at = ev.anchor === "edge"
          ? edgePoint(frame, truth.footprint(), site.ignitionM, ev.bearingDeg, ev.distanceM)
          : offsetFrom(ev.anchor === "head" ? headPoint(frame, truth.footprint(), heading) ?? site.ignitionM : site.ignitionM, ev.bearingDeg, ev.distanceM);
        const cells = cellsInDisk(frame, at.eastM, at.northM, Math.max(ev.radiusM, frame.cellSizeM / 2));
        if (ev.kind === "ignite") {
          const baseline = truth.footprint();
          truth.ignite(cells, !!ev.rekindle); // a rekindle surfaces through the held line at the old edge (revision (aj))
          const after = truth.footprint();
          const lit = cells.filter((c) => after[c] && !baseline[c]); // the cells that actually caught (not burned already, not water or a held line)
          for (const c of lit) ignited[c] = 1;
          if (ev.rekindle) { const seed = new Uint8Array(baseline.length); for (const c of lit) seed[c] = 1; rekindles.push({ stepId: f.id, seed, baseline }); }
        }
        else if (ev.kind === "extinguish") truth.extinguish(cells);
        else truth.removeFuel(cells);
      }
    };

    apply("before_report");
    const reported = truth.footprint();
    const atReport = rekindles.slice(); // the rekindles this report knows (a during-cycle one joins at the next)
    const splitReported = splitFire(frame, reported, atReport);
    // The rekindles first on this report: their cells are the traffic's "new separate fire" (`traffic-fire.ts`).
    const separateReported = unionOf(splitReported.newFires.filter((_, k) => { const s = rekindles[k]!.seed; return !prevReported || !s.some((v, i) => v === 1 && prevReported![i] === 1); }), reported.length);
    prevReported = reported;
    // The lines held at report time: fuel the crews removed (secured sectors, wetted strips), which the machine is told of.
    const held = new Uint8Array(reported.length);
    for (let i = 0; i < held.length; i++) held[i] = truth.state[i] === NO_FUEL && machineBase[i] === UNBURNED ? 1 : 0;
    apply("during_cycle");
    truth.reactivatePerimeter();
    const truthWind: Wind = { fromDeg: f.windFromDeg, speedMs: f.gustMs };

    // Truth.
    const truthRng = rngFor(opts, `truth/${f.id}`);
    const kTruth = cellsPerStep(refClass, truthWind, opts.params, frame.cellSizeM);
    const truthSteps = stepsFor(f.headRosActualMpm, opts.cycleMinutes, kTruth, frame.cellSizeM, truthRng);
    for (let s = 0; s < truthSteps; s++) truth.step(truthWind, truthRng);
    const truthAtEnd = truth.footprint();
    const achieved = liveHeadAdvanceM(frame, truthAtEnd, reported, ignited, heading) / opts.cycleMinutes;

    // Envelope: ensemble from the reported perimeter with the machine's inputs (envelope.ts).
    const projection = projectEnvelope(envCtx, reported, [envelopeSegment(f, opts.cycleMinutes)], `envelope/${f.id}`, held);
    const { envelope, isoMasks } = projection;
    const derived = flagWithBasis(frame, reported, envelope, truthAtEnd, opts.flagRule, f.categoricalBasis);
    // The old fire and each new fire traced apart (revision (aj)): their outlines share the old edge.
    const splitTruth = splitFire(frame, truthAtEnd, rekindles);
    const tracedTruth = traceMask(frame, splitTruth.old, 0.75, FIRE_OUTLINE);
    const tracedReported = traceMask(frame, splitReported.old, 0.75, FIRE_OUTLINE);
    const isochrones = traceIsochrones(frame, projection, atReport);
    const tracedEnvelope = isochrones.find((iso) => iso.minutes === opts.cycleMinutes)!;
    let area = 0;
    for (let i = 0; i < truthAtEnd.length; i++) area += truthAtEnd[i]!;

    cycles.push({
      id: f.id,
      clock: f.clock,
      truthSteps,
      envelopeSteps: projection.meanSteps,
      targetHeadRosMpm: f.headRosActualMpm,
      achievedHeadRosMpm: Math.round(achieved * 10) / 10,
      envelopeAssumedRosMpm: f.headRosEnvelopeMpm,
      areaHa: Math.round(area * cellHa * 10) / 10,
      reported: tracedReported.main,
      reportedDetached: [...tracedReported.others, ...newFireOutlines(frame, splitReported.newFires)],
      envelope: tracedEnvelope.main,
      envelopeDetached: tracedEnvelope.others,
      truthAtEnd: tracedTruth.main,
      spotFires: [...tracedTruth.others, ...newFireOutlines(frame, splitTruth.newFires)],
      expectedFlag: f.expectedFlag,
      derived,
      matches: derived.flag === f.expectedFlag,
      isochrones,
      masks: { reported, envelope, truthAtEnd, isochrones: isoMasks, held, ignited, newFires: splitTruth.newFires, newFiresReported: splitReported.newFires, separateReported, rekindles: atReport },
    });
  }

  return {
    site: site.name,
    seed: opts.seed.toString(),
    cycles,
    flagMatches: cycles.filter((c) => c.matches).length,
  };
}

/** The outlines of each new fire (one mask per rekindle, possibly several parts each). */
export function newFireOutlines(frame: GridFrame, masks: readonly Uint8Array[]): Polygon[] {
  return masks.filter(anyCell).flatMap((m) => { const t = traceMask(frame, m, 0.75, FIRE_OUTLINE); return [t.main, ...t.others].filter((p): p is Polygon => p !== null); });
}

/**
 * The projection's isochrones as traced outlines (the horizon one is the envelope's outline). Split like the fire it is
 * projected from (revision (aj)): the part grown from each rekindle is an outline of its own in `others`, sharing the old
 * fire's edge, so the map can still show the old fire's projection as a held part and the new front's as a growing one.
 */
export function traceIsochrones(frame: GridFrame, p: EnvelopeProjection, rekindles: readonly Rekindle[] = []): { readonly minutes: number; readonly main: Polygon | null; readonly others: readonly Polygon[] }[] {
  return p.isoMinutes.map((minutes, k) => {
    const split = splitFire(frame, p.isoMasks[k]!, rekindles);
    const t = traceMask(frame, split.old, 0.75, FIRE_OUTLINE);
    return { minutes, main: t.main, others: [...t.others, ...newFireOutlines(frame, split.newFires)] };
  });
}

/** A counterfactual branch (SPEC/03 §9): the same run with alternative forcing. */
export function runBranch(site: SiteModel, forcing: readonly CycleForcing[], opts: RunOptions, branchLabel: string): ScenarioRunResult {
  return runScenario(site, forcing, { ...opts, scenarioId: `${opts.scenarioId}/branch/${branchLabel}` });
}

/** GeoJSON for inspection in QGIS or geojson.io: one feature per cycle per layer. */
export function toGeoJson(result: ScenarioRunResult): unknown {
  const features: unknown[] = [];
  const ring = (p: Polygon) => p.map((r) => r.map((q) => [q.lon, q.lat]));
  for (const c of result.cycles) {
    const layers: [string, Polygon | null][] = [["reported", c.reported], ["envelope", c.envelope], ["truth_end", c.truthAtEnd]];
    for (const [layer, poly] of layers) {
      if (!poly) continue;
      features.push({
        type: "Feature",
        properties: { cycle: c.id, clock: c.clock, layer, expectedFlag: c.expectedFlag, derivedFlag: c.derived.flag },
        geometry: { type: "Polygon", coordinates: ring(poly) },
      });
    }
    c.spotFires.forEach((poly, k) => {
      features.push({ type: "Feature", properties: { cycle: c.id, layer: "spot_fire", index: k }, geometry: { type: "Polygon", coordinates: ring(poly) } });
    });
  }
  return { type: "FeatureCollection", features };
}
