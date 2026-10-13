/**
 * Deriving an envelope's flag from the CA's truth and envelope footprints — SPEC/24 §6.
 *
 * SPEC/03 §4.2 names the three flags and SPEC/03 §5 says a categorical breach is one that falls
 * outside the envelope "categorically — not merely further in the same direction". The spec
 * gives no operational rule, so this module proposes one (pending the researcher's sign-off):
 *
 *   holds         every burned cell at the horizon lies within the envelope dilated by the
 *                 declared containment tolerance (escapes smaller than `minEscapeCells` are
 *                 treated as CA noise);
 *   categorical   some escaped fire is DETACHED from the dilated envelope (a new front: a spot
 *                 fire, a second ignition, fire surfacing from the ground), or the escape runs
 *                 in a DIRECTION the envelope did not project (along the escape's bearing the
 *                 envelope grew less than `minProjectedShare` of its largest growth in any
 *                 direction), or the cycle is marked as a non-spatial breach (the failure is in
 *                 depth, not area — SPEC/18 §7 cycle 15);
 *   quantitative  otherwise: the fire got further in the direction the envelope projected.
 */

import { centroidMetres, components, dilate, maskCells, touches, type GridFrame } from "./geometry.js";
import type { Flag } from "../../app/scenario/types.js";

export interface FlagRule {
  readonly toleranceM: number;
  readonly minEscapeCells: number;
  readonly minProjectedShare: number;
}

/** Placeholder values; the containment tolerance is an open declared threshold (SPEC/11 §3.5). */
export const DEFAULT_FLAG_RULE: FlagRule = { toleranceM: 50, minEscapeCells: 3, minProjectedShare: 0.25 };

export interface FlagEvidence {
  readonly flag: Flag;
  readonly escapedCells: number;
  readonly detachedComponents: number;
  readonly escapeDirectionDeg: number | null;
  /** Envelope growth along the escape bearing, as a share of its largest growth in any direction. */
  readonly projectedShare: number | null;
  readonly reason: string;
}

function bearing(from: { eastM: number; northM: number }, to: { eastM: number; northM: number }): number {
  const b = (Math.atan2(to.eastM - from.eastM, to.northM - from.northM) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
}

/** Furthest extent of a mask along a bearing, in metres (projection of cell centres). */
export function extentAlong(frame: GridFrame, mask: Uint8Array, bearingDeg: number): number {
  const t = (bearingDeg * Math.PI) / 180;
  const ux = Math.sin(t);
  const uy = Math.cos(t);
  let best = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const c = i % frame.cols;
    const p = ((c + 0.5) * ux + ((i - c) / frame.cols + 0.5) * uy) * frame.cellSizeM;
    if (p > best) best = p;
  }
  return best;
}

/** How far the envelope grew beyond the reported perimeter along `bearingDeg`, relative to its largest growth. */
function projectedShare(frame: GridFrame, reported: Uint8Array, envelope: Uint8Array, bearingDeg: number): number {
  const growth = (b: number) => Math.max(0, extentAlong(frame, envelope, b) - extentAlong(frame, reported, b));
  let max = 0;
  for (let k = 0; k < 16; k++) max = Math.max(max, growth(k * 22.5));
  return max > 0 ? growth(bearingDeg) / max : 0;
}

export function deriveFlag(
  frame: GridFrame,
  reported: Uint8Array,
  envelope: Uint8Array,
  truthAtHorizon: Uint8Array,
  rule: FlagRule,
  nonSpatialBreach = false,
): FlagEvidence {
  const buffered = dilate(frame, envelope, rule.toleranceM);
  const escaped = new Uint8Array(truthAtHorizon.length);
  for (let i = 0; i < escaped.length; i++) escaped[i] = truthAtHorizon[i] && !buffered[i] ? 1 : 0;
  const escapeComps = components(frame, escaped).filter((c) => c.length >= rule.minEscapeCells);
  const escapedCount = escapeComps.reduce((n, c) => n + c.length, 0);

  if (nonSpatialBreach) {
    return { flag: "breach_categorical", escapedCells: escapedCount, detachedComponents: 0, escapeDirectionDeg: null, projectedShare: null, reason: "authored non-spatial breach (depth, not area)" };
  }
  if (escapeComps.length === 0) {
    return { flag: "holds", escapedCells: 0, detachedComponents: 0, escapeDirectionDeg: null, projectedShare: null, reason: "truth within envelope + tolerance" };
  }
  const detached = escapeComps.filter((c) => !touches(frame, c, buffered)).length;
  const reportedCells = maskCells(reported);
  const origin = reportedCells.length > 0 ? centroidMetres(frame, reportedCells) : null;
  const escapeDirectionDeg = origin ? bearing(origin, centroidMetres(frame, escapeComps.flat())) : null;
  if (detached > 0) {
    return { flag: "breach_categorical", escapedCells: escapedCount, detachedComponents: detached, escapeDirectionDeg, projectedShare: null, reason: `${detached} detached new front(s)` };
  }
  const share = escapeDirectionDeg === null ? null : projectedShare(frame, reported, envelope, escapeDirectionDeg);
  if (share !== null && share < rule.minProjectedShare) {
    return { flag: "breach_categorical", escapedCells: escapedCount, detachedComponents: 0, escapeDirectionDeg, projectedShare: share, reason: `escape where the envelope projected little growth (${Math.round(share * 100)}%)` };
  }
  return { flag: "breach_quantitative", escapedCells: escapedCount, detachedComponents: 0, escapeDirectionDeg, projectedShare: share, reason: "further in the projected direction" };
}
