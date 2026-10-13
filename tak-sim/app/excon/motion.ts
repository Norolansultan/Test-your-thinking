/**
 * EXCON (SPEC/28 §8) — "continuous realistic change" (the researcher's August design): the truth picture at
 * any moment of a step, not only at its start. Deterministic interpolation between two world-state steps of
 * `site-scenario.json` (SPEC/18 §8.2 positions, SPEC/24 CA perimeters):
 *
 * - **Fire.** The CA outline morphs from the truth at the step's start (the previous step's `truthAtEnd`; for
 *   the first step after a gap, the step's reported perimeter) to the step's `truthAtEnd`. A detached part
 *   with no counterpart grows from its own centre (a spot fire, a new front).
 * - **Ground units.** Each crew sits at its reported position at the step's start and relocates to the next
 *   step's position late in the step (eased over 40–95 % of it): crews work a spot, then move.
 * - **Aircraft.** A loop track (the mapping loop, the spotter's orbit, a helicopter's or water drone's
 *   water-point shuttle) is flown at a nominal speed; a platform on station with an open (transit) track
 *   hovers in a small circle. A platform launching in the next step flies its transit in the last part of
 *   this step; one grounded in the next step returns to its launch point.
 *
 * Anchors: at the start of every step each unit and aircraft is EXACTLY at its reported position (what the
 * participant's AVL shows at that moment), so the truth map and the participant map agree at step starts and
 * diverge in between. Pure functions of (world, playhead): the same position always gives the same picture.
 */

import type { LatLon, Polygon } from "../engine/primitives.js";
import type { SiteAircraft, SiteStep } from "../scenario/site-scenario.js";
import type { AirKind } from "../scenario/types.js";
import { sortedKeys } from "../engine/deterministic-object.js";
import { STEP_SECONDS } from "../scenario/views.js";
import {
  closeRing, distanceM, lerpLatLon, morphAt, nearestArcFraction, offsetM, pointAlong, polylineLengthM, prepareMorph,
  ringCentre, seedRing, smoothstep, translatePolygon, MORPH_POINTS, type PreparedMorph,
} from "./geometry.js";
import type { Playhead } from "./timeline.js";
import { siteStepOf, type ExconWorld } from "./world.js";

/** Nominal ground speed per platform kind (m/s), for flying loops. */
export const AIR_SPEED_MS: Readonly<Record<AirKind, number>> = { drone: 12, water_drone: 10, helicopter: 35, fixed_wing: 45 };
/** A multicopter on station hovers in a circle this wide (m), one turn per period (virtual s). */
export const HOVER_RADIUS_M = 40;
export const HOVER_PERIOD_S = 90;
/** A detached truth part counts as the same part in the next step when its centre is within this (m). */
const PART_MATCH_M = 400;

export type PresenceState = "on_scene" | "arriving" | "leaving";

export interface TruthUnit {
  readonly id: string;
  readonly at: LatLon;
  readonly state: PresenceState;
}

export interface TruthAircraft {
  readonly id: string;
  readonly kind: AirKind;
  readonly at: LatLon;
  readonly state: PresenceState;
  /** The sensor footprint where the platform is now (null: no sensor, or not yet on station). */
  readonly footprint: LatLon[][] | null;
}

export interface TruthFrame {
  readonly frame: number;
  readonly fraction: number;
  /** The fire now: each polygon's outer ring, morphed (closed rings). */
  readonly fire: readonly LatLon[][][];
  /** The step's CA truth at its end, for a thin "where it will be" outline. */
  readonly fireAtStepEnd: readonly Polygon[];
  readonly units: readonly TruthUnit[];
  readonly aircraft: readonly TruthAircraft[];
}

interface FireMorphs {
  readonly parts: readonly PreparedMorph[];
}

const morphCache = new WeakMap<ExconWorld, Map<number, FireMorphs>>();

function fireMorphs(world: ExconWorld, frame: number): FireMorphs {
  let byFrame = morphCache.get(world);
  if (!byFrame) { byFrame = new Map(); morphCache.set(world, byFrame); }
  const cached = byFrame.get(frame);
  if (cached) return cached;
  const t = world.timeline[frame]!;
  const cur = siteStepOf(world.site, t.step);
  const prev = t.prevFrame !== null ? siteStepOf(world.site, world.timeline[t.prevFrame]!.step) : null;
  const startMain = prev ? prev.truthAtEnd : cur.reported;
  const startDetached = prev ? prev.truthDetached : cur.reportedDetached;
  const parts: PreparedMorph[] = [];
  if (startMain[0] && cur.truthAtEnd[0]) parts.push(prepareMorph(startMain[0], cur.truthAtEnd[0]));
  const used = new Set<number>();
  for (const end of cur.truthDetached) {
    const ring = end[0];
    if (!ring || ring.length < 4) continue;
    const c = ringCentre(ring);
    let match = -1, best = PART_MATCH_M;
    startDetached.forEach((s, i) => {
      const d = s[0] && !used.has(i) ? distanceM(ringCentre(s[0]), c) : Infinity;
      if (d < best) { best = d; match = i; }
    });
    if (match >= 0) used.add(match);
    parts.push(prepareMorph(match >= 0 ? startDetached[match]![0]! : seedRing(c, MORPH_POINTS), ring));
  }
  // A start part with no end part (it merged into the main fire): it shrinks to its centre.
  startDetached.forEach((s, i) => {
    if (!used.has(i) && s[0] && s[0].length >= 4) parts.push(prepareMorph(s[0], seedRing(ringCentre(s[0]), MORPH_POINTS, 1)));
  });
  const out = { parts };
  byFrame.set(frame, out);
  return out;
}

function unitsAt(cur: SiteStep, next: SiteStep | null, f: number): TruthUnit[] {
  const out: TruthUnit[] = [];
  const move = smoothstep(0.4, 0.95, f);
  for (const id of sortedKeys(cur.units)) {
    const a = cur.units[id]!;
    const b = next?.units[id];
    if (b) out.push({ id, at: lerpLatLon(a, b, move), state: "on_scene" });
    else out.push({ id, at: a, state: next && f > 0.85 ? "leaving" : "on_scene" });
  }
  if (next && f >= 0.8) {
    for (const id of sortedKeys(next.units)) if (!(id in cur.units)) out.push({ id, at: next.units[id]!, state: "arriving" });
  }
  return out;
}

const isLoop = (track: readonly LatLon[]): boolean => track.length >= 3 && distanceM(track[0]!, track[track.length - 1]!) < 25;

/** Where a platform's own motion puts it at fraction `f` of the step, before the anchoring blends. */
function baseMotion(a: SiteAircraft, f: number, virtualS: number): LatLon {
  if (isLoop(a.track)) {
    const len = polylineLengthM(a.track);
    if (len === 0) return a.position;
    const laps = Math.max(1, Math.round((AIR_SPEED_MS[a.kind] * STEP_SECONDS) / len));
    const start = nearestArcFraction(a.track, a.position);
    const u = start + laps * f;
    return pointAlong(a.track, u - Math.floor(u));
  }
  const ang = (2 * Math.PI * virtualS) / HOVER_PERIOD_S;
  return offsetM(a.position, HOVER_RADIUS_M * Math.cos(ang), HOVER_RADIUS_M * Math.sin(ang));
}

function aircraftAt(cur: SiteStep, next: SiteStep | null, f: number, stepStartS: number): TruthAircraft[] {
  const virtualS = stepStartS + f * STEP_SECONDS;
  const out: TruthAircraft[] = [];
  const sorted = [...cur.aircraft].sort((x, y) => (x.platformId < y.platformId ? -1 : x.platformId > y.platformId ? 1 : 0));
  for (const a of sorted) {
    const n = next?.aircraft.find((x) => x.platformId === a.platformId) ?? null;
    let at = lerpLatLon(baseMotion(a, f, virtualS), a.position, 1 - smoothstep(0, 0.08, f)); // leaves its reported position
    let state: PresenceState = "on_scene";
    if (n) at = lerpLatLon(at, n.position, smoothstep(0.9, 1, f)); // ... and arrives at the next one
    else if (next) {
      const home = a.track[0] ?? a.position;
      at = lerpLatLon(at, home, smoothstep(0.85, 1, f)); // grounded next step: back to its launch point
      if (f > 0.85) state = "leaving";
    }
    const footprint = a.footprint && state === "on_scene"
      ? (isLoop(a.track) ? a.footprint.map((r) => [...r]) : translatePolygon(a.footprint, a.position, at))
      : null;
    out.push({ id: a.platformId, kind: a.kind, at, state, footprint });
  }
  // Launching for the next step: fly the transit into position by the step's end.
  for (const n of next?.aircraft ?? []) {
    if (cur.aircraft.some((x) => x.platformId === n.platformId)) continue;
    const path = isLoop(n.track) ? [n.track[0] ?? n.position, n.position] : n.track.length >= 2 ? n.track : [n.position];
    const share = Math.min(0.5, Math.max(0.05, polylineLengthM(path) / (AIR_SPEED_MS[n.kind] * STEP_SECONDS)));
    if (f < 1 - share) continue;
    out.push({ id: n.platformId, kind: n.kind, at: pointAlong(path, (f - (1 - share)) / share), state: "arriving", footprint: null });
  }
  return out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** The truth picture at a playhead. */
export function truthAt(world: ExconWorld, head: Playhead): TruthFrame {
  const t = head.step;
  const cur = siteStepOf(world.site, t.step);
  const next = t.nextFrame !== null ? siteStepOf(world.site, world.timeline[t.nextFrame]!.step) : null;
  const f = head.fraction;
  // Linear in time: the CA's spread over a step is steadier than any easing would suggest.
  const fire = fireMorphs(world, t.frame).parts.map((m) => [morphAt(m, f)]);
  return {
    frame: t.frame,
    fraction: f,
    fire,
    fireAtStepEnd: [cur.truthAtEnd, ...cur.truthDetached].map((p) => p.map((r) => closeRing(r))),
    units: unitsAt(cur, next, f),
    aircraft: aircraftAt(cur, next, f, t.startVirtual),
  };
}
