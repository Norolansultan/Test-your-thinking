/**
 * Views from step spans — SPEC/26 §3, §6; SPEC/24 revision (p).
 *
 * The CA run stays 25 steps (same seed, same forcing). A view spans one or two consecutive steps:
 *   - the reported fire is the report at the START of its first step;
 *   - the truth is the fire at the END of its last step;
 *   - the envelope is projected from that report through every step of the span, each with its
 *     own authored machine inputs (`envelope.ts`), so a merged view's horizon is 40 minutes;
 *   - the flag is derived by SPEC/24 §6's rule from that envelope against that truth. An authored
 *     categorical basis (`mechanism`, `depth`) carries over to the view containing its step.
 *
 * A single-step view uses the same RNG label as the step (`envelope/<id>`), so its envelope is
 * the per-step envelope unchanged; a merged view's label joins its steps (`envelope/2+3`).
 */

import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import type { SiteView } from "../../app/scenario/site-scenario.js";
import type { Flag } from "../../app/scenario/types.js";
import { SESSION_VIEWS, stepId, stepStartVirtual, STEP_SECONDS, type SessionView } from "../../app/scenario/views.js";
import { bandMasks, projectEnvelope, type EnvelopeProjection } from "./envelope.js";
import { FIRE_OUTLINE, traceMaskWithHoles, type GridFrame } from "./geometry.js";
import { clockAt } from "./traffic.js";
import { extentAlong, type FlagEvidence } from "./flags.js";
import {
  envelopeContext, envelopeSegment, flagWithBasis, traceIsochrones,
  type CycleForcing, type CycleResult, type RunOptions, type ScenarioRunResult, type SiteModel,
} from "./run.js";

export interface ViewResult {
  readonly view: SessionView;
  /** CA step ids of the span ("W5", "2", "3"). */
  readonly stepIds: readonly string[];
  readonly horizonMinutes: number;
  /** The mean of the steps' authored envelope-assumed rates: what the merged envelope assumes over its horizon. */
  readonly envelopeAssumedRosMpm: number;
  readonly basis: CycleForcing["categoricalBasis"] | null;
  readonly expectedFlag: Flag | null; // SPEC/26 §3; null for the practice view
  readonly derived: FlagEvidence;
  readonly matches: boolean; // always true for the practice view (not checked)
  readonly reported: Polygon | null;
  readonly reportedDetached: readonly Polygon[];
  readonly envelope: Polygon | null;
  readonly envelopeDetached: readonly Polygon[];
  readonly truthAtEnd: Polygon | null;
  readonly truthDetached: readonly Polygon[];
  readonly isochrones: readonly { readonly minutes: number; readonly main: Polygon | null; readonly others: readonly Polygon[] }[];
  readonly masks: { readonly reported: Uint8Array; readonly envelope: Uint8Array; readonly truthAtEnd: Uint8Array; readonly isochrones: readonly Uint8Array[] };
}

/** The basis of a span: `depth` wins over `mechanism` (a depth breach needs no area breach at all). */
function spanBasis(forcing: readonly CycleForcing[]): CycleForcing["categoricalBasis"] | null {
  if (forcing.some((f) => f.categoricalBasis === "depth")) return "depth";
  if (forcing.some((f) => f.categoricalBasis === "mechanism")) return "mechanism";
  return null;
}

export function buildViews(site: SiteModel, forcing: readonly CycleForcing[], result: ScenarioRunResult, opts: RunOptions, views: readonly SessionView[] = SESSION_VIEWS): ViewResult[] {
  const ctx = envelopeContext(site, opts);
  const at = (id: string): { f: CycleForcing; c: CycleResult } => {
    const i = forcing.findIndex((f) => f.id === id);
    if (i < 0 || !result.cycles[i]) throw new Error(`step ${id} is not in the CA run`);
    return { f: forcing[i]!, c: result.cycles[i]! };
  };
  return views.map((view) => {
    const stepIds = view.steps.map(stepId);
    const span = stepIds.map(at);
    const reported = span[0]!.c.masks.reported;
    const truthAtEnd = span[span.length - 1]!.c.masks.truthAtEnd;
    const projection: EnvelopeProjection = projectEnvelope(ctx, reported, span.map(({ f }) => envelopeSegment(f, opts.cycleMinutes)), `envelope/${stepIds.join("+")}`, span[0]!.c.masks.held);
    const basis = spanBasis(span.map(({ f }) => f));
    const derived = flagWithBasis(site.frame, reported, projection.envelope, truthAtEnd, opts.flagRule, basis ?? undefined);
    const isochrones = traceIsochrones(site.frame, projection, span[0]!.c.masks.rekindles); // split by the rekindles the view's report knows (revision (aj))
    const horizonMinutes = opts.cycleMinutes * span.length;
    const traced = isochrones.find((iso) => iso.minutes === horizonMinutes)!;
    const first = span[0]!.c;
    const last = span[span.length - 1]!.c;
    return {
      view,
      stepIds,
      horizonMinutes,
      envelopeAssumedRosMpm: span.reduce((s, { f }) => s + f.headRosEnvelopeMpm, 0) / span.length,
      basis,
      expectedFlag: view.flag,
      derived,
      matches: view.flag === null || derived.flag === view.flag,
      reported: first.reported,
      reportedDetached: first.reportedDetached,
      envelope: traced.main,
      envelopeDetached: traced.others,
      truthAtEnd: last.truthAtEnd,
      truthDetached: last.spotFires,
      isochrones,
      masks: { reported, envelope: projection.envelope, truthAtEnd, isochrones: projection.isoMasks },
    };
  });
}

/**
 * How far truth ran past the envelope, metres, along `bearingDeg` (the escape bearing when there is
 * an escape, else the head's heading): positive = beyond the envelope. Reporting only; the flag
 * uses SPEC/24 §6's cell rule with the 50 m tolerance.
 */
export function gapMetres(site: SiteModel, v: ViewResult, bearingDeg: number): number {
  return Math.round(extentAlong(site.frame, v.masks.truthAtEnd, bearingDeg) - extentAlong(site.frame, v.masks.envelope, bearingDeg));
}

export function describeView(site: SiteModel, v: ViewResult, headingDeg: number): string {
  const d = v.derived;
  const bearing = d.escapeDirectionDeg ?? headingDeg;
  return `${v.view.id.padEnd(4)} ${v.stepIds.join("+").padEnd(6)} T+${String(v.horizonMinutes).padEnd(3)} env ${String(v.envelopeAssumedRosMpm).padEnd(5)}` +
    `${(v.expectedFlag ?? "(practice)").padEnd(21)} ${(d.flag + (v.matches ? "" : "  ✗")).padEnd(22)}` +
    `gap ${gapMetres(site, v, bearing)} m @${Math.round(bearing)}°, escaped ${d.escapedCells} cells` +
    `${d.projectedShare !== null ? `, projected share ${Math.round(d.projectedShare * 100)}%` : ""}; ${d.reason}`;
}

export interface ViewExportDeps {
  readonly frame: GridFrame;
  readonly reproject: (poly: Polygon | null) => Polygon | null;
  readonly reprojectAll: (polys: readonly Polygon[]) => Polygon[];
  readonly gridToWgs: (p: { x: number; y: number }) => LatLon;
  readonly clockOfStep: (step: number) => string;
}

/** A view as the app bundle carries it (`site-scenario.json` `views`), WGS84 throughout. */
export function toSiteView(v: ViewResult, d: ViewExportDeps): SiteView {
  const isochrones = v.isochrones.flatMap((iso) => (iso.main ? [{ minutes: iso.minutes, polygon: d.reproject(iso.main)!, detachedParts: d.reprojectAll(iso.others) }] : []));
  const projectionBands = bandMasks(v.masks.reported, v.isochrones.map((iso) => iso.minutes), v.masks.isochrones).map((b) => ({
    fromMinutes: b.fromMinutes,
    toMinutes: b.toMinutes,
    polygons: traceMaskWithHoles(d.frame, b.mask, 0.75, 1, FIRE_OUTLINE).map((t) => [t.outer, ...t.holes].map((r) => r.map(d.gridToWgs))),
  }));
  const steps = v.view.steps;
  return {
    index: v.view.index,
    id: v.view.id,
    steps,
    practice: v.view.practice,
    clock: d.clockOfStep(steps[0]!),
    horizonClock: clockAt(stepStartVirtual(steps[steps.length - 1]!) + STEP_SECONDS).slice(0, 5),
    horizonMinutes: v.horizonMinutes,
    envelopeRosMpm: v.envelopeAssumedRosMpm,
    expectedFlag: v.expectedFlag,
    derivedFlag: v.derived.flag,
    flagReason: v.derived.reason,
    envelope: d.reproject(v.envelope)!,
    envelopeDetached: d.reprojectAll(v.envelopeDetached),
    truthAtEnd: d.reproject(v.truthAtEnd)!,
    truthDetached: d.reprojectAll(v.truthDetached),
    isochrones,
    projectionBands,
  };
}
