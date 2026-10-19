/**
 * The window of a cycle and its active front (SPEC/31 §5 D2 and §2.4, from `docs/audits/2026-10-19-skills/fire_tactical.md`).
 *
 * `ros_head_m_min` is the CA's achieved head rate over the step's own 20 minutes (the window). Everything paired with
 * it describes the same window:
 * - the head over the window is the NEXT step's observed head (`observedHead` is measured at a step's start over the
 *   previous 20 minutes): its position at the window's end, its bearing and its observer. Without a next step (the
 *   practice step, step 20) or when the head did not advance, the bearing is null and the geometry falls back to the
 *   step's own observed head;
 * - the head at the window's start is projected back from the end along the bearing by the achieved rate × 20 min (it
 *   equals the step's own observed head wherever the head kept running; it follows the head where a flank became the
 *   head, step 9, or a new fire took over, step 12).
 *
 * The active front is the fire part the window's head belongs to: the main fire (with the crown run's spot fires) from
 * the ignition point, or a rekindle front (`US1`–`US3` on the map, revision (aj)) from where its marker was first
 * reported. Segments are measured on that front: head = within 300 m of the head's run over the window or ahead of its
 * start (±45°); rear and flanks on the axis from the front's origin, for points within 300 m of the front's outline;
 * anything farther off (the held old fire in phase B, a rekindle elsewhere, staging areas) is on no segment.
 */

import type { SiteStep } from "../../app/scenario/site-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { HEAD_RADIUS_M, segmentOf, type SegmentId } from "./fire-observations.js";
import { bearing, dist, distToRing, distToSegment, offset, signedAngle, toEN, type EN } from "./geo.js";

/** A point within this distance of the active front's outline is on it (flank or rear); farther off, on no segment. */
export const FRONT_MARGIN_M = 300;
/** A rekindle marker within this distance of a detached part makes it that rekindle's front. */
const MARKER_TO_PART_M = 30;

export const stepByIndex = (index: number): SiteStep | undefined => SITE_SCENARIO.steps.find((s) => s.index === index);

export interface WindowHead {
  /** The head at the window's end (the next step's observed head), else the step's own observed head. */
  readonly endXy: EN;
  /** The head at the window's start: projected back from the end by the achieved rate (equal to the end when it did not move). */
  readonly startXy: EN;
  /** The direction the head travelled over the window; null without a later observation or when it did not advance. */
  readonly bearingDeg: number | null;
  /** The axis the segments use: the window's bearing, else the step's own observed bearing. */
  readonly axisDeg: number;
  readonly observedRateMpm: number | null;
  readonly observerId: string;
  readonly basis: string;
}

export function windowHead(s: SiteStep): WindowHead {
  const next = stepByIndex(s.index + 1);
  const rate = s.headRos.achievedMpm;
  if (next && rate > 0 && next.observedHead.rateMpm > 0) {
    const end = toEN(next.observedHead.anchor);
    const b = next.observedHead.bearingDeg;
    return {
      endXy: end, startXy: offset(end, (b + 180) % 360, rate * 20), bearingDeg: b, axisDeg: b,
      observedRateMpm: next.observedHead.rateMpm, observerId: next.observedHead.observerId,
      basis: `step ${next.index}'s observed head (${next.clock}), measured over this step's 20 minutes`,
    };
  }
  const own = toEN(s.observedHead.anchor);
  return {
    endXy: own, startXy: own, bearingDeg: null, axisDeg: s.observedHead.bearingDeg, observedRateMpm: null,
    observerId: next?.observedHead.observerId ?? s.observedHead.observerId,
    basis: next ? "the head did not advance over this step: no bearing; geometry from the step's own observed head"
      : "no later observation of this step's 20 minutes (the scenario's last step or the practice step): no bearing; geometry from the step's own observed head",
  };
}

// ---------------------------------------------------------------------------------------------------
// Fire parts and the active front
// ---------------------------------------------------------------------------------------------------

export interface FirePart {
  /** `main` (the original fire with its spot fires) or the rekindle's map label (`US1` …). */
  readonly id: string;
  readonly rings: readonly (readonly EN[])[];
  readonly origin: EN;
}

let markerCache: ReadonlyMap<string, EN> | null = null;

/** Each rekindle's map label (`US…`) and where it was first reported, over all steps. */
export function rekindleOrigins(): ReadonlyMap<string, EN> {
  if (markerCache) return markerCache;
  const out = new Map<string, EN>();
  for (const s of SITE_SCENARIO.steps) for (const f of s.fire.spot_fires) if (/^US/.test(f.callsign) && !out.has(f.callsign)) out.set(f.callsign, toEN(f.position));
  markerCache = out;
  return out;
}

/** The reported fire of a step, split into the main fire and the rekindle fronts. */
export function firePartsOf(s: SiteStep): FirePart[] {
  const ignition = toEN(SITE_SCENARIO.ignition);
  const mainRings: EN[][] = s.reported.length > 0 && s.reported[0]!.length >= 3 ? [s.reported[0]!.map(toEN)] : [];
  const rekindles: FirePart[] = [];
  for (const poly of s.reportedDetached) {
    const ring = (poly[0] ?? []).map(toEN);
    if (ring.length < 3) continue;
    let label: string | null = null;
    for (const [id, at] of rekindleOrigins()) if (label === null && distToRing(at, ring) <= MARKER_TO_PART_M) label = id;
    if (label === null) mainRings.push(ring);
    else rekindles.push({ id: label, rings: [ring], origin: rekindleOrigins().get(label)! });
  }
  return [{ id: "main", rings: mainRings, origin: ignition }, ...rekindles];
}

export const distToPart = (p: EN, part: FirePart): number => Math.min(Infinity, ...part.rings.map((r) => distToRing(p, r)));

export interface FrontGeometry {
  readonly head: WindowHead;
  readonly active: FirePart;
  readonly parts: readonly FirePart[];
  /** The step whose report the parts come from (the next step's, else the step's own). */
  readonly reportStep: number;
}

/** The window's active front: the part (of the report at the window's end, else the step's own) nearest the window's head. */
export function frontGeometry(s: SiteStep): FrontGeometry {
  const head = windowHead(s);
  const ref = (head.bearingDeg !== null ? stepByIndex(s.index + 1) : undefined) ?? s;
  const parts = firePartsOf(ref);
  let active = parts[0]!;
  for (const p of parts) if (distToPart(head.endXy, p) < distToPart(head.endXy, active)) active = p;
  return { head, active, parts, reportStep: ref.index };
}

export interface Placement {
  readonly segment: SegmentId | null;
  /** The fire part the point is on or nearest to (`main`, `US1` …). */
  readonly front: string;
}

/** A point's segment of the active front (see the module comment); null off the front. */
export function placeOnFront(p: EN, g: FrontGeometry): Placement {
  const { head, active } = g;
  const nearest = g.parts.reduce((a, b) => (distToPart(p, b) < distToPart(p, a) ? b : a), active);
  const ahead = Math.abs(signedAngle(head.axisDeg, bearing(head.startXy, p))) <= 45 && dist(p, head.startXy) > 0;
  if (distToSegment(p, head.startXy, head.endXy) <= HEAD_RADIUS_M || (ahead && nearest.id === active.id)) return { segment: "head", front: active.id };
  if (distToPart(p, active) > FRONT_MARGIN_M) return { segment: null, front: nearest.id };
  return { segment: segmentOf(p, active.origin, head.endXy, head.axisDeg), front: active.id };
}

/** How far ahead of the head's start a point on the head segment lies (null behind it or off the head). */
export function aheadOfHead(p: EN, g: FrontGeometry, segment: SegmentId | null): number | null {
  if (segment !== "head") return null;
  const r = (g.head.axisDeg * Math.PI) / 180;
  const along = (p[0] - g.head.startXy[0]) * Math.sin(r) + (p[1] - g.head.startXy[1]) * Math.cos(r);
  return along > 0 ? Math.round(dist(p, g.head.startXy)) : null;
}

/**
 * The window's burning edges: the stretches of the reported edge that advanced over it (`perimeter_current` status
 * `uncontained` at the window's end, i.e. the next step's report; the step's own for the last step), EPSG:3067.
 */
export function burningEdges(s: SiteStep): EN[][] {
  const ref = stepByIndex(s.index + 1) ?? s;
  return ref.fire.perimeter_current.filter((x) => x.status === "uncontained").map((x) => x.line.map(toEN));
}
