/**
 * Where crews and their vehicles stand in a step (positions audit, 2 Oct 2026). Split out of
 * `site-export.ts`. Every rule here is about the fire the crews could see and what it does during
 * the step, so a position never contradicts the fire on the map:
 *
 * - A crew works the fire's OUTER edge: a cell on the ring `standoffM` outside the reported fire,
 *   connected to the open ground around the fire (never an unburned island or the road strip inside
 *   the burnt area), not reached by the fire during the step (the truth at the step's end), and not
 *   in the cone ahead of the live head (± `CONE_HALF_DEG` of the heading, out to two steps of the head's run
 *   plus 200 m).
 * - A vehicle parks on the nearest road point that is clear of the fire (reported or reached this
 *   step) by `vehicleClearM`, outside the head's cone, not on a spot another vehicle took this step,
 *   and REACHABLE: the straight line from the crew to it (the hose line, the walk back) crosses no
 *   burnt or burning ground — crew and truck are always on the same side of the fire. A flank road
 *   only `ROAD_MIN_CLEAR_M` from the fire is taken when it is much nearer than a clearer one. A crew
 *   with no such road point is reported (`cutOff`).
 * - A crew that lays hose from its vehicle stands where such a road point is within `reachM` in a
 *   straight, fire-free line (`crewAt(target, reachM, roads)`, `lineM`) — the line the map draws.
 * - A crew holding its stretch stays where it is while that spot is still valid (so markers do not
 *   jitter), else moves to the nearest valid one.
 * - A vehicle that re-parks DRIVES there (review 6 Oct 2026, A10): the new spot must be reachable from
 *   where the vehicle stood along the road network without passing the burning zone (what burned in
 *   the last step or burns in this one, within `BURNING_CLEAR_M`); with no reachable spot it stays
 *   where it was (`unreachable` lists those for the build report) — unless the step's flank would run over it there: then it
 *   backs out along its road ahead of the flank (`backOut`, SPEC/33 gate R).
 */

import type { GridFrame } from "./geometry.js";
import type { P } from "./deployment.js";
import { distanceTransform } from "./traffic-fire.js";

/** Half-angle of the cone ahead of the head that no crew or vehicle stands in. */
export const CONE_HALF_DEG = 60;
/** How far two parked vehicles must be apart (m). */
export const VEHICLE_SPACING_M = 25;
/** A holding crew keeps its spot while it is within this band of the reported edge (m). */
const HOLD_BAND_M: readonly [number, number] = [15, 120];
/** The closest a vehicle parks to the fire when the clearer roads are out of reach (a flank road; m). */
export const ROAD_MIN_CLEAR_M = 35;
/** How far `lineM` looks for a road (m). */
const LINE_SEARCH_M = 1200;
/** A parked vehicle stays put unless a fresh spot would shorten the crew's line by more than this (m). */
const KEEP_SLACK_M = 250;
/** A road point this close to burning ground cannot be driven through (m). */
const BURNING_CLEAR_M = 30;
/** How far along its road a vehicle about to be overrun backs out ahead of the flank (m; `backOut`). */
const BACK_OUT_M = 200;
/** Road points this close are one road (consecutive points are 10 m apart; junctions meet within a few metres). */
const ROAD_LINK_M = 15;

/** The road network over a list of road points: each point's neighbours within `ROAD_LINK_M`. Built once per list. */
const GRAPHS = new WeakMap<readonly P[], { readonly adj: readonly (readonly number[])[]; readonly index: Map<P, number> }>();
function roadGraph(roads: readonly P[]) {
  let g = GRAPHS.get(roads);
  if (g) return g;
  const bucket = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / ROAD_LINK_M)},${Math.floor(y / ROAD_LINK_M)}`;
  roads.forEach((q, i) => { const k = key(q.x, q.y); const b = bucket.get(k) ?? []; b.push(i); bucket.set(k, b); });
  const adj = roads.map((q, i) => {
    const out: number[] = [];
    const bx = Math.floor(q.x / ROAD_LINK_M), by = Math.floor(q.y / ROAD_LINK_M);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of bucket.get(`${bx + dx},${by + dy}`) ?? []) if (j !== i && Math.hypot(roads[j]!.x - q.x, roads[j]!.y - q.y) <= ROAD_LINK_M) out.push(j);
    }
    return out;
  });
  g = { adj, index: new Map(roads.map((q, i) => [q, i])) };
  GRAPHS.set(roads, g);
  return g;
}

export interface PlacementInput {
  readonly frame: GridFrame;
  readonly ignitionM: { readonly eastM: number; readonly northM: number };
  readonly reported: Uint8Array;
  /** The CA truth at the step's end: where the fire gets to during the step. */
  readonly truth: Uint8Array;
  readonly head: P;
  readonly headingDeg: number;
  readonly headRosMpm: number;
  readonly standoffM: number;
  readonly vehicleClearM: number;
  /** The previous report (for `isCold`); null at the first step. */
  readonly prevReported?: Uint8Array | null;
}

export interface Placer {
  /** The valid crew spot nearest `target`. */
  crewAt(target: P, reachM?: number, roads?: readonly P[]): P;
  /** A holding crew: its own spot if still valid (and within `reachM` walk of a road), else the nearest valid one. */
  hold(at: P, reachM?: number, roads?: readonly P[]): P;
  /** Whether a crew spot is valid now. */
  validCrew(p: P): boolean;
  /** The vehicle's parking point for a crew at `crew`, from `roads`; claims it. */
  vehicleFor(crew: P, roads: readonly P[]): P;
  /**
   * As `vehicleFor`, with the length of the crew's path to it. With `prev` (where the vehicle stood last step) it
   * stays there while that spot is still clear, outside the cone, on the crew's side, within `maxM` and not more
   * than `KEEP_SLACK_M` longer than a fresh pick (positions audit item 11: vehicles jumped without a move), and
   * any fresh spot must be reachable by road from `from` (default `prev`; after a move, where the vehicle stood
   * before it) without passing the burning zone (else it stays at `prev`).
   */
  park(crew: P, roads: readonly P[], prev?: P | null, maxM?: number, from?: P | null): { at: P; pathM: number };
  /** Vehicles that had no spot reachable by road from where they stood (for the build report). */
  readonly unreachable: P[];
  /** Vehicles the step's flank would have overrun that backed out along their road instead (for the build report). */
  readonly backedOut: P[];
  /** The straight, fire-free line from `p` to the nearest usable road point (Infinity if none within `LINE_SEARCH_M`). */
  lineM(p: P, roads: readonly P[]): number;
  /** Crews whose road could not be reached without crossing the fire (for the build report). */
  readonly cutOff: P[];
  /** No fresh fire on the report and none during the step within `radiusM` of `p` (a cold edge: mop-up, positions audit item 16). */
  isCold(p: P, radiusM: number): boolean;
}

export function makePlacer(inp: PlacementInput): Placer {
  const { frame, reported, truth } = inp;
  const { cols, rows, cellSizeM: cs } = frame;
  const n = reported.length;
  const toGrid = (p: P) => ({ x: p.x + inp.ignitionM.eastM, y: p.y + inp.ignitionM.northM });
  const cellOf = (p: P): number => {
    const g = toGrid(p);
    const c = Math.floor(g.x / cs), r = Math.floor(g.y / cs);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  const siteOf = (i: number): P => {
    const c = i % cols, r = (i - c) / cols;
    return { x: (c + 0.5) * cs - inp.ignitionM.eastM, y: (r + 0.5) * cs - inp.ignitionM.northM };
  };

  // The open ground around the fire: unburned cells connected to the grid's border.
  const exterior = new Uint8Array(n);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = (i - c) / cols;
    if ((c === 0 || r === 0 || c === cols - 1 || r === rows - 1) && !reported[i]) { exterior[i] = 1; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!, c = i % cols;
    for (const j of [c > 0 ? i - 1 : -1, c + 1 < cols ? i + 1 : -1, i - cols, i + cols]) {
      if (j < 0 || j >= n || exterior[j] || reported[j]) continue;
      exterior[j] = 1;
      queue.push(j);
    }
  }
  const fire = new Uint8Array(n);
  for (let i = 0; i < n; i++) fire[i] = reported[i] || truth[i] ? 1 : 0;
  const toReported = distanceTransform(frame, reported);
  const toFire = distanceTransform(frame, fire);

  const coneLen = inp.headRosMpm * 40 + 200; // two steps of the head's run (the T+40 horizon) plus 200 m
  const hx = Math.sin((inp.headingDeg * Math.PI) / 180), hy = Math.cos((inp.headingDeg * Math.PI) / 180);
  const cosHalf = Math.cos((CONE_HALF_DEG * Math.PI) / 180);
  const inCone = (p: P): boolean => {
    const dx = p.x - inp.head.x, dy = p.y - inp.head.y, d = Math.hypot(dx, dy);
    if (d > coneLen) return false;
    return d < cs || (dx * hx + dy * hy) / d >= cosHalf;
  };
  const crewCell = (i: number): boolean =>
    i >= 0 && exterior[i] === 1 && !truth[i] && Math.abs(toReported[i]! - inp.standoffM) <= cs * 0.75 && !inCone(siteOf(i));
  const validCrew = (p: P): boolean => {
    const i = cellOf(p);
    return i >= 0 && exterior[i] === 1 && !truth[i] && toReported[i]! >= HOLD_BAND_M[0] && toReported[i]! <= HOLD_BAND_M[1] && !inCone(p);
  };
  /** Whether the straight line a → b crosses burnt or burning ground (sampled every half cell). */
  const crosses = (a: P, b: P): boolean => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(d / (cs / 2)));
    for (let s = 1; s < k; s++) {
      const i = cellOf({ x: a.x + ((b.x - a.x) * s) / k, y: a.y + ((b.y - a.y) * s) / k });
      if (i >= 0 && fire[i]) return true;
    }
    return false;
  };
  const roadOk = (q: P) => { const i = cellOf(q); return i >= 0 && toFire[i]! >= ROAD_MIN_CLEAR_M && !inCone(q); };
  // The straight, fire-free line from a cell to the nearest usable road point (the hose line as the map draws it), per road list.
  const usable = new Map<readonly P[], P[]>();
  const lines = new Map<readonly P[], Map<number, { d: number; q: P | null }>>();
  const lineHit = (p: P, roads: readonly P[]): { d: number; q: P | null } => {
    const i = cellOf(p);
    if (i < 0) return { d: Infinity, q: null };
    let cache = lines.get(roads);
    if (!cache) { cache = new Map(); lines.set(roads, cache); usable.set(roads, roads.filter(roadOk)); }
    const got = cache.get(i);
    if (got !== undefined) return got;
    const q0 = siteOf(i);
    const near = usable.get(roads)!.map((q) => ({ q, d: Math.hypot(q.x - q0.x, q.y - q0.y) })).filter((x) => x.d <= LINE_SEARCH_M).sort((a, b) => a.d - b.d);
    const hit = near.find((x) => !crosses(q0, x.q));
    const r = hit ? { d: hit.d, q: hit.q } : { d: Infinity, q: null };
    cache.set(i, r);
    return r;
  };
  const lineM = (p: P, roads: readonly P[]): number => lineHit(p, roads).d;
  const crewAt = (target: P, reachM = Infinity, roads?: readonly P[]): P => {
    const need = roads && Number.isFinite(reachM);
    const cand: { i: number; d: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (!crewCell(i)) continue;
      const q = siteOf(i);
      cand.push({ i, d: (q.x - target.x) ** 2 + (q.y - target.y) ** 2 });
    }
    cand.sort((a, b) => a.d - b.d || a.i - b.i);
    // Within reach if any spot is; else the spot with the shortest line among the 200 nearest the target.
    const nearest = () => cand.slice(0, 200).reduce<{ i: number; d: number } | undefined>((m, c) => (!m || lineM(siteOf(c.i), roads!) < lineM(siteOf(m.i), roads!) ? c : m), undefined);
    const best = need ? cand.find((c) => lineM(siteOf(c.i), roads!) <= reachM!) ?? nearest() : cand[0];
    return best ? siteOf(best.i) : target;
  };

  // The burning zone: what burned during the last step (still hot) and what burns during this one.
  const burning = new Uint8Array(n);
  for (let i = 0; i < n; i++) burning[i] = (truth[i] && !reported[i]) || (reported[i] && inp.prevReported && !inp.prevReported[i]) ? 1 : 0;
  const toBurning = distanceTransform(frame, burning);
  /** The road points reachable from `from` by road without passing the burning zone (the start itself may be in it). */
  const reachableFrom = (roads: readonly P[], from: P): Uint8Array => {
    const g = roadGraph(roads);
    let start = g.index.get(from) ?? -1;
    if (start < 0) roads.forEach((q, i) => { if (start < 0 || Math.hypot(q.x - from.x, q.y - from.y) < Math.hypot(roads[start]!.x - from.x, roads[start]!.y - from.y)) start = i; });
    const seen = new Uint8Array(roads.length);
    if (start < 0) return seen;
    const open = (j: number) => { const c = cellOf(roads[j]!); return c < 0 || toBurning[c]! >= BURNING_CLEAR_M; };
    const queue = [start];
    seen[start] = 1;
    for (let k = 0; k < queue.length; k++) for (const j of g.adj[queue[k]!]!) if (!seen[j] && open(j)) { seen[j] = 1; queue.push(j); }
    return seen;
  };
  const claimed: P[] = [];
  const cutOff: P[] = [];
  const unreachable: P[] = [];
  const backedOut: P[] = [];
  /** The step's fire reaches the vehicle's spot (it burns there during the step, or within `BURNING_CLEAR_M` of it). */
  const overrun = (q: P): boolean => { const i = cellOf(q); return i >= 0 && toBurning[i]! < BURNING_CLEAR_M; };
  // What burns during this step only: the flaming front from the report to the step's end (the black behind it is no threat).
  const front = new Uint8Array(n);
  for (let i = 0; i < n; i++) front[i] = truth[i] && !reported[i] ? 1 : 0;
  const toFront = distanceTransform(frame, front);
  /** Whether the straight line a → b crosses ground that burns during the step (a hose line may lie in the black). */
  const crossesFront = (a: P, b: P): boolean => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(1, Math.ceil(d / (cs / 2)));
    for (let s = 1; s < k; s++) {
      const i = cellOf({ x: a.x + ((b.x - a.x) * s) / k, y: a.y + ((b.y - a.y) * s) / k });
      if (i >= 0 && front[i]) return true;
    }
    return false;
  };
  /**
   * SPEC/33 gate R (20 Oct 2026): a vehicle the step's flank will run over where it stands, with no road round the fire (EK11 at
   * 13:40: its spot on R1 is where the west flank crosses the road by 14:00, and the road on either side lies within the burning
   * zone), backs out along its road at once, ahead of the flank — at most `BACK_OUT_M` of road, over ground the flank reaches only
   * later in the step — to the road point nearest its crew that is `vehicleClearM` clear of what burns during the step and whose line
   * to the crew crosses none of it (it may lie in the black). Free of other vehicles. Null if there is none.
   */
  const backOut = (crew: P, roads: readonly P[], from: P): P | null => {
    const g = roadGraph(roads);
    let start = g.index.get(from) ?? -1;
    if (start < 0) roads.forEach((q, i) => { if (start < 0 || Math.hypot(q.x - from.x, q.y - from.y) < Math.hypot(roads[start]!.x - from.x, roads[start]!.y - from.y)) start = i; });
    if (start < 0) return null;
    const seen = new Uint8Array(roads.length);
    const queue = [start];
    seen[start] = 1;
    const within = (j: number) => Math.hypot(roads[j]!.x - from.x, roads[j]!.y - from.y) <= BACK_OUT_M;
    for (let k = 0; k < queue.length; k++) for (const j of g.adj[queue[k]!]!) if (!seen[j] && within(j)) { seen[j] = 1; queue.push(j); }
    const free = (q: P) => claimed.every((c) => Math.hypot(c.x - q.x, c.y - q.y) >= VEHICLE_SPACING_M);
    const clearOfFront = (q: P) => { const i = cellOf(q); return i >= 0 && toFront[i]! >= inp.vehicleClearM && !inCone(q); };
    const ok = queue.map((j) => roads[j]!).filter((q) => clearOfFront(q) && free(q) && !crossesFront(crew, q));
    ok.sort((p, q) => Math.hypot(p.x - crew.x, p.y - crew.y) - Math.hypot(q.x - crew.x, q.y - crew.y) || p.x - q.x || p.y - q.y);
    return ok[0] ?? null;
  };
  const park = (crew: P, roads: readonly P[], prev?: P | null, maxM = Infinity, from: P | null | undefined = prev): { at: P; pathM: number } => {
    const dTo = (q: P) => Math.hypot(q.x - crew.x, q.y - crew.y);
    const reach = from ? reachableFrom(roads, from) : null;
    const index = roadGraph(roads).index;
    const drivable = (q: P) => !reach || reach[index.get(q) ?? -1] === 1;
    const ranked = [...roads].sort((a, b) => dTo(a) - dTo(b)).filter(drivable);
    const safe = (q: P) => { const i = cellOf(q); return i >= 0 && toFire[i]! >= inp.vehicleClearM && !inCone(q); };
    const free = (q: P) => claimed.every((c) => Math.hypot(c.x - q.x, c.y - q.y) >= VEHICLE_SPACING_M);
    // A fresh spot: clear by `vehicleClearM`, else (a flank road) by `ROAD_MIN_CLEAR_M` when that is much nearer; always on the crew's side.
    const clear = ranked.find((q) => safe(q) && free(q) && !crosses(crew, q));
    let flank = ranked.find((q) => roadOk(q) && free(q) && !crosses(crew, q));
    const hit0 = lineHit(crew, roads).q; // the point `lineM` found (from the cell's centre)
    const hit = hit0 && drivable(hit0) ? hit0 : null;
    // Two vehicles nose to tail beat a free spot far round the fire: the point is shared if the next free one is 300 m further.
    if (hit && (!flank || dTo(hit) < dTo(flank)) && (free(hit) || !flank || dTo(flank) > dTo(hit) + 300)) flank = hit;
    let pick = clear && (!flank || dTo(clear) <= dTo(flank) + 150) ? clear : flank;
    // Last step's spot, while it is still good enough (no crossing, clear, outside the cone, not much longer).
    if (prev && pick && dTo(prev) <= maxM && dTo(prev) <= dTo(pick) + KEEP_SLACK_M && free(prev) && safe(prev) && !crosses(crew, prev)) pick = prev;
    // Nowhere reachable round the fire, and the flank would overrun the vehicle where it stands: it backs out along its road.
    if (!pick && reach && from && prev && overrun(prev)) {
      const out = backOut(crew, roads, from);
      if (out) { backedOut.push(from); pick = out; }
    }
    // Nowhere reachable to go: the vehicle stays where it stood.
    if (!pick && reach) unreachable.push(from!);
    if (!pick && prev && reach) pick = prev;
    if (!pick) { cutOff.push(crew); pick = ranked.find((q) => safe(q) && free(q)) ?? ranked.find(safe) ?? crew; }
    claimed.push(pick);
    return { at: pick, pathM: dTo(pick) };
  };
  const hold = (at: P, reachM = Infinity, roads?: readonly P[]): P =>
    validCrew(at) && (!roads || lineM(at, roads) <= reachM) ? at : crewAt(at, reachM, roads);
  const isCold = (p: P, radiusM: number): boolean => {
    const g = toGrid(p), c0 = Math.floor(g.x / cs), r0 = Math.floor(g.y / cs), k = Math.ceil(radiusM / cs);
    const prev = inp.prevReported ?? null;
    for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
      const col = c0 + dc, row = r0 + dr;
      if (col < 0 || row < 0 || col >= cols || row >= rows || Math.hypot(dc, dr) > k) continue;
      const i = row * cols + col;
      if ((truth[i] && !reported[i]) || (prev && reported[i] && !prev[i])) return false;
    }
    return true;
  };
  return { crewAt, hold, validCrew, vehicleFor: (crew, roads) => park(crew, roads).at, park, lineM, cutOff, unreachable, backedOut, isCold };
}
