/**
 * What the map's fire layers draw each cycle (SPEC/12 revision 24 Sep (c)), derived at build time
 * from the reported CA masks only — never from truth:
 *
 * - earlier perimeters: the last three cycles' reports, with the clock they were reported at;
 * - burnt area: the fire as reported one cycle ago; burning zone: what burned since;
 * - the current edge as segments (review fixes (ah), 9 Oct 2026, F2): an edge that advanced in the last
 *   step is uncontained; a quiet edge is contained only within `HELD_BY_CREW_M` of a crew working a
 *   line there (hose line, pump, fire break, road line, mop-up), and inactive (quiet, not spreading,
 *   no crew) where a sector was secured (the control events, `scenario-18.ts`) or a crew held it
 *   earlier and has left. Head fire: edge that advanced in the last step and faces the spread
 *   direction, near the head (F7);
 * - spot fires: small detached reported fires, confirmed when a drone's camera covers them;
 * - drone thermal detections: hot cells under a drone footprint in the band that burned during the
 *   last two cycles, each timed by how far the fire had travelled across the band when it got there;
 *   sampled by a seeded hash with jitter inside the cell, not on a lattice (F5).
 *
 * Positions are grid metres (east, north) until the last step.
 */

import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import type { FireDisplay } from "../../app/scenario/types.js";
import { FIRE_OUTLINE, traceMaskMetres, traceMaskWithHoles, type GridFrame } from "./geometry.js";
import { inArc } from "./run.js";

type Pt = { readonly x: number; readonly y: number };

/** A detached reported fire smaller than this is a spot fire (a point), not a front (an outline). */
export const SPOT_FIRE_MAX_HA = 1;
/**
 * Fix pass 2 (7 Oct 2026, FF9): an old edge flaring up again by the point of origin is an "uudelleensyttymä",
 * labelled US1, US2…, not a spot fire (PP1 named the crown run's spot fire at 15:29 and the rekindle at 19:31).
 * A small detached fire this near the ignition point is one.
 */
export const REKINDLE_NEAR_IGNITION_M = 400;
const SPOT_PREFIX = "PP";
const REKINDLE_PREFIX = "US";
export const isRekindleCallsign = (callsign: string): boolean => callsign.startsWith(REKINDLE_PREFIX);
/** A detached patch whose outline comes this near the main fire's is part of the main edge (one 25 m cell and a half). */
const BESIDE_MAIN_M = 37.5;
/** A spot fire within this distance of one labelled in an earlier step keeps its label (FF9: labels restarted at PP1 every step). */
const SAME_SPOT_M = 200;
/** The labels given so far in the day (grid metres), carried from step to step by the caller. */
export type SpotLabels = { readonly at: Pt; readonly callsign: string }[];
/** The edge within this distance of the observed head is head fire (if it advanced and faces the spread, F7). */
export const HEAD_FIRE_RADIUS_M = 300;
/** Head fire faces the spread: the edge's advance within this angle of the spread heading (F7). */
const HEAD_FACING_DEG = 60;
/** An edge that moved less than this since the last report is quiet (one and a half cells). */
const QUIET_M = 37.5;
/** A quiet edge this near a crew working a line is contained (F2, "about 150 m" of a hose line, fire break or road line). */
export const HELD_BY_CREW_M = 150;
/** At most this many detections per cycle, spread evenly over the candidates. */
export const MAX_DETECTIONS = 80;
/** Detections older than this are not produced (the map shows up to 30 min). */
const DETECTION_MAX_AGE_MIN = 30;

export interface FireDisplayInput {
  readonly frame: GridFrame;
  readonly ignition: Pt;
  /** Reported mask now, and the three before it (newest first; missing ones omitted). */
  readonly now: Uint8Array;
  readonly past: readonly { readonly mask: Uint8Array; readonly clock: string }[];
  /** Secured arcs (bearing from ignition) and the reported mask when they were secured. */
  readonly control: { readonly arcs: readonly { readonly from: number; readonly to: number }[]; readonly mask: Uint8Array } | null;
  readonly head: Pt | null;
  /** The spread heading of the last step (degrees), which head fire faces (F7). */
  readonly headingDeg?: number;
  /** Crews working a line now (hose line, pump, fire break, road line, mop-up), where the map shows them (F2). */
  readonly crews?: readonly Pt[];
  /** Where crews worked a line in earlier steps: a quiet edge they left is inactive, not uncontained (F2). */
  readonly crewHistory?: readonly Pt[];
  /**
   * The fire grown from each old edge that flared up again (rekindles and holdovers; the run's `masks.newFiresReported`,
   * `new-fire.ts`, revision (aj)): labelled US (F4) at its centroid, a marker while it is small. It grows out of the old
   * edge, so it is no blob of its own in `now`.
   */
  readonly newFires?: readonly Uint8Array[];
  /** Whether a drone camera covered a grid point this cycle / last cycle. */
  readonly seenNow: (p: Pt) => boolean;
  readonly seenPrev: (p: Pt) => boolean;
  /** Simulation seconds at the start of this cycle. */
  readonly cycleStartS: number;
  readonly cycleMinutes: number;
  readonly toWgs: (p: Pt) => LatLon;
  /** The day's spot-fire labels so far; new ones are added (persistent labels, FF9). */
  readonly labels?: SpotLabels;
}

const ringToWgs = (ring: readonly Pt[], toWgs: (p: Pt) => LatLon): LatLon[] => ring.map(toWgs);
const polygonArea = (ring: readonly Pt[]) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]!; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const centroid = (ring: readonly Pt[]): Pt => ({ x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length });

/** Whether any burned cell of `mask` lies within `radiusM` of `p`. */
function nearBurned(frame: GridFrame, mask: Uint8Array, p: Pt, radiusM: number): boolean {
  const cs = frame.cellSizeM;
  const c0 = Math.floor(p.x / cs), r0 = Math.floor(p.y / cs), k = Math.ceil(radiusM / cs);
  for (let dr = -k; dr <= k; dr++) {
    for (let dc = -k; dc <= k; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) continue;
      if (mask[r * frame.cols + c] && Math.hypot(dc, dr) * cs <= radiusM + cs) return true;
    }
  }
  return false;
}

/** Distance from cell `i` to the nearest cell where `test` holds, searching out to `maxM`. */
function distanceTo(frame: GridFrame, i: number, test: (j: number) => boolean, maxM: number): number {
  const cs = frame.cellSizeM;
  const c0 = i % frame.cols, r0 = (i - c0) / frame.cols, k = Math.ceil(maxM / cs);
  let best = Infinity;
  for (let dr = -k; dr <= k; dr++) {
    for (let dc = -k; dc <= k; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows) continue;
      if (test(r * frame.cols + c)) best = Math.min(best, Math.hypot(dc, dr) * cs);
    }
  }
  return best;
}

/** The centre of the nearest cell where `test` holds, searching out to `maxM` (grid metres), or null. */
function nearestCell(frame: GridFrame, p: Pt, test: (j: number) => boolean, maxM: number): Pt | null {
  const cs = frame.cellSizeM;
  const c0 = Math.floor(p.x / cs), r0 = Math.floor(p.y / cs), k = Math.ceil(maxM / cs);
  let best = Infinity, at: Pt | null = null;
  for (let dr = -k; dr <= k; dr++) {
    for (let dc = -k; dc <= k; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || r < 0 || c >= frame.cols || r >= frame.rows || !test(r * frame.cols + c)) continue;
      const q = { x: (c + 0.5) * cs, y: (r + 0.5) * cs };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < best) { best = d; at = q; }
    }
  }
  return at;
}

/** A deterministic 32-bit hash of integers (no Math.random; the same bytes on every build), in [0, 1). */
export function hash01(...xs: readonly number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

export type EdgeStatus = FireDisplay["perimeter_current"][number]["status"];

/** Splits a closed ring into runs of equal (status, head); each run ends on the next run's first vertex. */
function segmentRing(ring: readonly Pt[], classify: (p: Pt) => { status: EdgeStatus; head: boolean }) {
  const pts = ring.slice(0, -1); // drop the closing duplicate
  const cls = pts.map(classify);
  const key = (i: number) => `${cls[i]!.status}/${cls[i]!.head}`;
  const n = pts.length;
  const start = cls.findIndex((_, i) => key(i) !== key((i - 1 + n) % n));
  if (start < 0) return [{ ...cls[0]!, line: [...pts, pts[0]!] }];
  const out: { status: EdgeStatus; head: boolean; line: Pt[] }[] = [];
  for (let s = 0; s < n; s++) {
    const i = (start + s) % n;
    if (s === 0 || key(i) !== key((i - 1 + n) % n)) out.push({ ...cls[i]!, line: [] });
    out[out.length - 1]!.line.push(pts[i]!);
  }
  for (let k = 0; k < out.length; k++) out[k]!.line.push(out[(k + 1) % out.length]!.line[0]!);
  return out;
}

export function buildFireDisplay(inp: FireDisplayInput): FireDisplay {
  const { frame, now, past, toWgs } = inp;

  // Current edge: every reported blob; small detached ones become spot fires.
  const blobs = traceMaskMetres(frame, now, 0.75, 1, FIRE_OUTLINE);
  const main = blobs[0];
  const perimeter_current: FireDisplay["perimeter_current"][number][] = [];
  const spot_fires: FireDisplay["spot_fires"][number][] = [];
  const prevMask = past[0]?.mask ?? null;
  const near = (pts: readonly Pt[] | undefined, p: Pt, m: number) => (pts ?? []).some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= m);
  // Where the edge was at the last report: an edge that moved less than QUIET_M since is quiet; an edge that advanced faces
  // the spread when its advance lies within HEAD_FACING_DEG of the heading (F7).
  const advance = (p: Pt): { quiet: boolean; facing: boolean } => {
    const from = prevMask ? nearestCell(frame, p, (j) => prevMask[j] === 1, 600) : null;
    const quiet = !prevMask || (!!from && Math.hypot(p.x - from.x, p.y - from.y) <= QUIET_M);
    const adv = from && !quiet ? ((Math.atan2(p.x - from.x, p.y - from.y) * 180) / Math.PI + 360) % 360 : null;
    const facing = !quiet && (inp.headingDeg === undefined || adv === null || Math.abs(((adv - inp.headingDeg + 540) % 360) - 180) <= HEAD_FACING_DEG);
    return { quiet, facing };
  };
  const drawn: Pt[][] = [];
  /** The day's label for a small fire at `c`: the one given within SAME_SPOT_M earlier (FF9), else the next of its prefix. */
  const labelFor = (c: Pt, prefix: string): string => {
    const labels = inp.labels ?? [];
    const known = labels.filter((l) => l.callsign.startsWith(prefix) && Math.hypot(l.at.x - c.x, l.at.y - c.y) <= SAME_SPOT_M && !spot_fires.some((s) => s.callsign === l.callsign))
      .reduce<SpotLabels[number] | null>((a, l) => (!a || Math.hypot(l.at.x - c.x, l.at.y - c.y) < Math.hypot(a.at.x - c.x, a.at.y - c.y) ? l : a), null);
    const callsign = known?.callsign ?? `${prefix}${labels.filter((l) => l.callsign.startsWith(prefix)).length + 1}`;
    if (!known) labels.push({ at: c, callsign });
    return callsign;
  };
  blobs.forEach((ring, k) => {
    const c = centroid(ring.slice(0, -1));
    const rekindle = Math.hypot(c.x - inp.ignition.x, c.y - inp.ignition.y) <= REKINDLE_NEAR_IGNITION_M;
    const prefix = rekindle ? REKINDLE_PREFIX : SPOT_PREFIX;
    // A small patch one cell off the main fire is part of its edge, not a spot fire (fix pass 3, FF9: "PP1, 80 m south of
    // the head" was a patch beside the flank); a rekindle by the origin keeps its label, as it is new fire at the old edge.
    const besideMain = prefix === SPOT_PREFIX && !!main && k > 0 && ring.some((p) => main.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= BESIDE_MAIN_M));
    if (k > 0 && !besideMain && polygonArea(ring) / 10_000 < SPOT_FIRE_MAX_HA) {
      spot_fires.push({ position: toWgs(c), confirmed: inp.seenNow(c), callsign: labelFor(c, prefix) });
      return;
    }
    drawn.push(ring as Pt[]);
  });
  // Revision (aj): each old edge flaring up again grows out of the old fire (no blob of its own above), traced apart by the
  // run (`new-fire.ts`): labelled US-n at its centroid, a marker while it is under SPOT_FIRE_MAX_HA and new or still spreading
  // (cells burned since the last report); once it has stopped it is a stretch of the edge again, as a detached one that had
  // merged was.
  for (const m of inp.newFires ?? []) {
    const rings = traceMaskMetres(frame, m, 0.75, 1, FIRE_OUTLINE);
    if (rings.length === 0) continue;
    const c = centroid(rings.flatMap((r) => r.slice(0, -1)));
    const ha = rings.reduce((s, r) => s + polygonArea(r), 0) / 10_000;
    const fresh = !prevMask || m.some((v, i) => v === 1 && prevMask[i] === 0);
    if (ha < SPOT_FIRE_MAX_HA && fresh) spot_fires.push({ position: toWgs(c), confirmed: inp.seenNow(c), callsign: labelFor(c, REKINDLE_PREFIX) });
  }
  // The head glow's centre (F7): the drawn edge that advanced, facing the spread, furthest along the heading; the observed head
  // when none did. The observed head can sit on a spot fire ahead of the edge (V6, 15:40: ~590 m out, so no edge glowed).
  let headRef: Pt | null = inp.head;
  if (inp.headingDeg !== undefined) {
    const t = (inp.headingDeg * Math.PI) / 180;
    let best = -Infinity;
    for (const ring of drawn) for (const p of ring) {
      const proj = p.x * Math.sin(t) + p.y * Math.cos(t);
      if (proj > best && advance(p).facing) { best = proj; headRef = p; }
    }
  }
  const classify = (p: Pt): { status: EdgeStatus; head: boolean } => {
    const b = ((Math.atan2(p.x - inp.ignition.x, p.y - inp.ignition.y) * 180) / Math.PI + 360) % 360;
    const a = advance(p);
    if (!a.quiet) return { status: "uncontained", head: a.facing && !!headRef && Math.hypot(p.x - headRef.x, p.y - headRef.y) <= HEAD_FIRE_RADIUS_M };
    if (near(inp.crews, p, HELD_BY_CREW_M)) return { status: "contained", head: false };
    const secured = !!inp.control && inp.control.arcs.some((arc) => inArc(b, arc.from, arc.to)) && nearBurned(frame, inp.control.mask, p, 1.5 * frame.cellSizeM);
    // Quiet with no crew: inactive where the sector was secured, or where a crew held it earlier and has left (the origin's
    // rear and south edge after 16:20 look alike, so the edge that flares up at 17:00 is not singled out, V9's omission).
    if (secured || near(inp.crewHistory, p, HELD_BY_CREW_M)) return { status: "inactive", head: false };
    return { status: "uncontained", head: false };
  };
  for (const ring of drawn) for (const seg of segmentRing(ring, classify)) perimeter_current.push({ status: seg.status, is_head: seg.head, line: ringToWgs(seg.line, toWgs) });
  if (!main) return { perimeters_past: [], perimeter_current, burnt_area: { geometry: [], severity: null }, burning_zone: [], spot_fires, detections: [] };

  const toPolygon = (outer: readonly Pt[], holes: readonly (readonly Pt[])[]): Polygon => [ringToWgs(outer, toWgs), ...holes.map((h) => ringToWgs(h, toWgs))];
  // Every part of the earlier fire that is not a spot fire, one ring each (2 Oct 2026 audit P6: the rekindled front's earlier edges were missing).
  const perimeters_past = past.slice(0, 3).map((p) => ({
    time: p.clock,
    geometry: traceMaskMetres(frame, p.mask, 0.75, 1, FIRE_OUTLINE).filter((r, k) => k === 0 || polygonArea(r) / 10_000 >= SPOT_FIRE_MAX_HA).map((r) => ringToWgs(r, toWgs)) as Polygon,
  })).filter((p) => (p.geometry[0]?.length ?? 0) > 0);
  const prev = past[0]?.mask ?? null;
  const burnt = prev ? traceMaskWithHoles(frame, prev, 0.75, 1, FIRE_OUTLINE).map((b) => toPolygon(b.outer, b.holes)) : [];
  const band = new Uint8Array(now.length);
  if (prev) for (let i = 0; i < band.length; i++) band[i] = now[i] && !prev[i] ? 1 : 0;
  const burning_zone = prev ? traceMaskWithHoles(frame, band, 0.75, 1, FIRE_OUTLINE).map((b) => toPolygon(b.outer, b.holes)) : [];

  // Detections: in the band that burned last cycle (ages 0–20 min) and the one before (20–40,
  // shown up to 30). A cell's age is how far through the band the fire was when it arrived.
  const candidates: { p: Pt; ageMin: number }[] = [];
  const bands = [
    { newer: now, older: prev, baseMin: 0, seen: inp.seenPrev },
    { newer: prev, older: past[1]?.mask ?? null, baseMin: inp.cycleMinutes, seen: inp.seenPrev },
  ];
  for (const b of bands) {
    if (!b.newer || !b.older) continue;
    const newer = b.newer, older = b.older;
    for (let i = 0; i < newer.length; i++) {
      if (!newer[i] || older[i]) continue;
      const c = i % frame.cols, r = (i - c) / frame.cols;
      // A sparse sample of the band, about one cell in three, drawn by a seeded hash with a jitter inside the cell (F5:
      // the (c + 2r) % 3 sample put the detections on a regular diagonal lattice). Deterministic: same cells, same bytes.
      if (hash01(c, r, 7) >= 1 / 3) continue;
      const p = { x: (c + 0.1 + 0.8 * hash01(c, r, 11)) * frame.cellSizeM, y: (r + 0.1 + 0.8 * hash01(c, r, 13)) * frame.cellSizeM };
      if (!b.seen(p) && !inp.seenNow(p)) continue;
      const fromOld = distanceTo(frame, i, (j) => older[j] === 1, 600);
      const toEdge = distanceTo(frame, i, (j) => newer[j] === 0, 600);
      const frac = Number.isFinite(fromOld) && Number.isFinite(toEdge) && fromOld + toEdge > 0 ? fromOld / (fromOld + toEdge) : 0.5;
      const ageMin = b.baseMin + (1 - frac) * inp.cycleMinutes;
      if (ageMin < DETECTION_MAX_AGE_MIN) candidates.push({ p, ageMin });
    }
  }
  // At most MAX_DETECTIONS, chosen by the same hash (an every-k-th pick of the row-major list made stripes), kept in list order.
  const keep = candidates.length <= MAX_DETECTIONS ? null
    : new Set(candidates.map((d, k) => ({ k, h: hash01(Math.round(d.p.x), Math.round(d.p.y), 17) })).sort((a, b) => a.h - b.h || a.k - b.k).slice(0, MAX_DETECTIONS).map((x) => x.k));
  const detections = candidates
    .filter((_, k) => !keep || keep.has(k))
    .map((d) => ({ position: toWgs(d.p), time: Math.round(inp.cycleStartS - d.ageMin * 60) }));

  return { perimeters_past, perimeter_current, burnt_area: { geometry: burnt, severity: null }, burning_zone, spot_fires, detections };
}
