/**
 * The training incident's S1 keys (SPEC/08 (bp) §bp.4, items 1–4), computed from the site, never typed. Every rule checks a margin and
 * throws when it fails. Pixels are the basemap's (4 m); the figures written are metres.
 * 1. place — the R5/R6 junction: the nearest other junction ≥ 400 m, ≥ 240 m inside the lock, ≥ 400 m from the line.
 * 2. measure — A on land (not water, mire or field) at 300 m (else 600 m) ± 4 % from its nearest drivable road, a named one; the next
 *    road ≥ 1.5 × as far; the foot ≥ 160 m from the road's ends and ≥ 80 m from every junction; A and the foot ≥ 400 m from the line;
 *    A ≥ 100 m from every track and path too (the build's own margin: A is not drawn on a track the participant might measure to).
 * 3. slope — as (bj): A on a 10 px lattice, B 240 m away up the steepest steady climb (≥ 5 m, two contour lines or more, each higher),
 *    C 240 m away on level ground (within 1 m, no line crossed), ≥ 90° apart; all in forest, clear of roads (tracks included) and
 *    water; ≥ 400 m from the line (every point between too).
 * 4. water — ★ on a drivable road ≥ 160 m from water; fill point 2 where a drivable road passes ≤ 48 m from open water, the nearest
 *    such point to ★ by road (also on the drawn network, band included); fill point 1 the shore point nearest ★ in a straight line,
 *    ≤ 0.5 × the straight distance to fill point 2, with no road or track within 100 m of it; the road from ★ to fill point 2 ≤ 3 km;
 *    everything ≥ 400 m from the line. Of the ★ that qualify, the one whose smallest margin (each rule's figure over its limit) is
 *    largest.
 */

import { bearing, byPosition, crossedLevels, crossings, dist, lineDist, nearestOnLine, nearestOnRing, offset, pathLength, polygonDist, type Px } from "./map-training-geometry.js";
import { AREA, type Piece, type Site } from "./training-site.js";

const along = (a: Px, b: Px, n: number): Px[] => Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
const lattice = (step: number, margin: number): Px[] => {
  const out: Px[] = [];
  for (let y = AREA.y0 + margin; y <= AREA.y0 + AREA.size - margin; y += step) for (let x = AREA.x0 + margin; x <= AREA.x0 + AREA.size - margin; x += step) out.push({ x, y });
  return out;
};
const ringOf = (pc: Piece) => pc.pts.map((p) => [p.x, p.y] as const);

export interface PlaceKey { readonly key: Px; readonly nearestOtherJunctionM: number; readonly insideLockM: number; readonly lineM: number }

export function placeKey(s: Site): PlaceKey {
  const key = s.r5r6;
  const others = s.junctions.filter((j) => dist(j, key) > 8);
  const gap = Math.min(...others.map((j) => dist(j, key))) * s.mpp;
  const insideLockM = s.edgePx(key) * s.mpp;
  if (gap < 400 || insideLockM < 240 || !s.clear(key)) throw new Error(`training s1.place: the R5/R6 junction fails a margin (junction ${gap.toFixed(0)} m, lock ${insideLockM.toFixed(0)} m)`);
  return { key, nearestOtherJunctionM: Math.round(gap), insideLockM: Math.round(insideLockM), lineM: Math.round(s.lineM(key)) };
}

export interface MeasureKey {
  readonly a: Px; readonly foot: Px; readonly road: string; readonly metres: number; readonly target: number; readonly nextRoadM: number;
  readonly footFromEndsM: number; readonly footFromJunctionM: number; readonly lineM: number;
}

export function measureKey(s: Site, avoid: Px): MeasureKey {
  const uncutRings = s.uncut.map((pc) => ({ pc, ring: ringOf(pc) }));
  const anyRings = s.anyRoads.map(ringOf);
  for (const target of [300, 600]) {
    const cands: MeasureKey[] = [];
    for (const a of lattice(5, 40)) {
      if (!s.forest(a, 8) || !s.clear(a) || dist(a, avoid) < 100 || anyRings.some((r) => lineDist(a, r) < 25)) continue;
      const near = uncutRings.map((r) => ({ ...r, d: lineDist(a, r.ring) })).sort((x, y) => (x.d - y.d) || (x.pc.id < y.pc.id ? -1 : 1));
      const first = near[0]!, second = near[1]?.d ?? Infinity;
      if (Math.abs(first.d * s.mpp - target) > 0.04 * target || second < 1.5 * first.d) continue;
      const foot = nearestOnLine(a, first.ring);
      const named = s.named.find((n) => lineDist(foot, ringOf(n.piece)) < 0.5);
      if (!named || !s.clear(foot) || !s.inArea(foot, 30)) continue;
      const pts = named.piece.pts;
      const fromEnds = Math.min(dist(foot, pts[0]!), dist(foot, pts.at(-1)!)) * s.mpp;
      const fromJunction = Math.min(...s.junctions.map((j) => dist(j, foot))) * s.mpp;
      if (fromEnds < 160 || fromJunction < 80) continue;
      cands.push({ a, foot, road: named.code, metres: Math.round(first.d * s.mpp), target, nextRoadM: Math.round(second * s.mpp), footFromEndsM: Math.round(fromEnds), footFromJunctionM: Math.round(fromJunction), lineM: Math.round(Math.min(s.lineM(a), s.lineM(foot))) });
    }
    cands.sort((x, y) => (Math.abs(x.metres - target) - Math.abs(y.metres - target)) || (y.nextRoadM / y.metres - x.nextRoadM / x.metres) || byPosition(x.a, y.a));
    if (cands[0]) return cands[0];
  }
  throw new Error("training s1.measure: no A at 300 m or 600 m from a named road");
}

export interface SlopeKey { readonly a: Px; readonly b: Px; readonly c: Px; readonly rise: number; readonly flat: number; readonly levels: readonly number[]; readonly apartDeg: number; readonly metresEach: number; readonly lineM: number }

export function slopeKey(s: Site): SlopeKey {
  const STEP = 60;
  const rings = s.anyRoads.map(ringOf);
  const roadClear = (p: Px, px: number) => rings.every((r) => lineDist(p, r) >= px);
  const crossesRoad = (a: Px, b: Px) => rings.some((r) => crossings(a, b, r) > 0);
  const ok = (p: Px) => s.forest(p, 12) && roadClear(p, 15) && s.clear(p);
  const way = (a: Px, b: Px) => !crossesRoad(a, b) && along(a, b, 12).every((p) => s.waterDist(p) >= 6 && s.clear(p));
  const cands: SlopeKey[] = [];
  for (const a of lattice(10, 50)) {
    if (!ok(a)) continue;
    const ea = s.grid.at(a);
    let best: { b: Px; rise: number; deg: number; levels: number[] } | null = null;
    for (let k = 0; k < 16; k++) {
      const deg = k * 22.5, b = offset(a, deg, STEP);
      if (!s.inArea(b, 40)) continue;
      const prof = along(a, b, 4).map((p) => s.grid.at(p));
      const rise = prof[4]! - ea;
      if (rise < 5 || !prof.every((v, i) => i === 0 || v > prof[i - 1]!) || !ok(b)) continue;
      const levels = crossedLevels(a, b, s.segs);
      if (levels.length < 2 || !levels.every((v, i) => i === 0 || v > levels[i - 1]!) || !way(a, b)) continue;
      if (!best || rise > best.rise) best = { b, rise, deg, levels };
    }
    if (!best) continue;
    for (let k = 0; k < 16; k++) {
      const deg = k * 22.5, c = offset(a, deg, STEP);
      const apart = Math.abs(((deg - best.deg + 540) % 360) - 180);
      if (apart < 90 || !s.inArea(c, 40)) continue;
      const flat = Math.max(...along(a, c, 8).map((p) => Math.abs(s.grid.at(p) - ea)));
      if (flat > 1 || crossedLevels(a, c, s.segs).length > 0 || !ok(c) || !way(a, c)) continue;
      cands.push({ a, b: best.b, c, rise: best.rise, flat, levels: best.levels, apartDeg: apart, metresEach: STEP * s.mpp, lineM: Math.round(Math.min(...[a, best.b, c].map(s.lineM))) });
    }
  }
  cands.sort((x, y) => (y.rise - x.rise) || (x.flat - y.flat) || byPosition(x.a, y.a) || byPosition(x.c, y.c));
  const t = cands[0];
  if (!t) throw new Error("training s1.slope: no A with a climb of 5 m (two contour lines) and level ground both 240 m away");
  return t;
}

export interface WaterKey {
  readonly star: Px; readonly fill1: Px; readonly fill2: Px; readonly route: readonly Px[];
  readonly straight1M: number; readonly straight2M: number; readonly roadM: number; readonly ratio: number;
  readonly fill1RoadClearM: number; readonly fill2GapM: number; readonly starToWaterM: number; readonly lineM: number;
  readonly qualifying: number; readonly considered: number; readonly smallestMargin: number;
}

export function waterKey(s: Site, avoid: Px): WaterKey {
  // Fill points: where a road passes within 48 m of open water (the best vertex of each such run), on the cut network and the drawn one.
  const fillsOf = (pcs: readonly Piece[]) => {
    const out: { p: Px; gap: number }[] = [];
    for (const w of s.waters) for (const pc of pcs) {
      let run: { p: Px; gap: number }[] = [];
      const flush = () => { if (run.length > 0) out.push([...run].sort((x, y) => (x.gap - y.gap) || byPosition(x.p, y.p))[0]!); run = []; };
      for (const p of pc.pts) { const gap = polygonDist(p, w); if (gap <= 12 && s.inArea(p, 30)) run.push({ p, gap }); else flush(); }
      flush();
    }
    return out;
  };
  const fills = fillsOf(s.pieces).filter((f) => s.clear(f.p));
  const drawnFills = fillsOf(s.uncut);
  const fromFill = fills.map((f) => ({ f, sp: s.graph.shortest(s.graph.nearest(f.p)) }));
  const fromDrawn = drawnFills.map((f) => ({ f, sp: s.drawnGraph.shortest(s.drawnGraph.nearest(f.p)) }));
  const anyRoadRings = s.anyRoads.map(ringOf);
  let considered = 0;
  const cands: WaterKey[] = [];
  for (let node = 0; node < s.graph.nodes.length; node++) {
    const star = s.graph.nodes[node]!;
    if (!s.inArea(star, 40) || !s.clear(star) || dist(star, avoid) < 100) continue;
    const starWater = s.waterDist(star) * s.mpp;
    if (starWater < 160) continue;
    const reach = fromFill.map((x) => ({ ...x, r: x.sp.distPx[node]! })).filter((x) => Number.isFinite(x.r)).sort((a, b) => (a.r - b.r) || byPosition(a.f.p, b.f.p));
    const f2 = reach[0];
    if (!f2) continue;
    considered += 1;
    // On the drawn network too, no fill point (the band's included) is nearer ★ by road than fill point 2.
    const drawnNode = s.drawnGraph.nearest(star);
    const drawnBest = Math.min(...fromDrawn.map((x) => x.sp.distPx[drawnNode]!));
    if (drawnBest < f2.r - 2) continue;
    const shore = s.waters.map((w) => nearestOnRing(star, w)).sort((a, b) => (dist(star, a) - dist(star, b)) || byPosition(a, b))[0]!;
    const s1 = dist(star, shore), s2 = dist(star, f2.f.p);
    const roadClear1 = Math.min(...anyRoadRings.map((r) => lineDist(shore, r))) * s.mpp;
    const route = [...f2.sp.path(node)].reverse();
    const roadM = f2.r * s.mpp;
    const marks = [star, shore, f2.f.p];
    if (s1 > 0.5 * s2 || roadClear1 < 100 || roadM > 3000 || !s.inArea(shore, 30) || !marks.every(s.clear) || !route.every(s.clear)) continue;
    if (marks.some((a, i) => marks.some((b, j) => i < j && dist(a, b) < 40))) continue;
    const lineM = Math.min(...[...marks, ...route].map(s.lineM));
    const margins = [(0.5 * s2) / s1, roadClear1 / 100, starWater / 160, 3000 / roadM, lineM / 400];
    cands.push({
      star, fill1: shore, fill2: f2.f.p, route, straight1M: Math.round(s1 * s.mpp), straight2M: Math.round(s2 * s.mpp), roadM: Math.round(roadM),
      ratio: Math.round((s1 / s2) * 100) / 100, fill1RoadClearM: Math.round(roadClear1), fill2GapM: Math.round(f2.f.gap * s.mpp), starToWaterM: Math.round(starWater),
      lineM: Math.round(lineM), qualifying: 0, considered: 0, smallestMargin: Math.round(Math.min(...margins) * 100) / 100,
    });
  }
  cands.sort((a, b) => (b.smallestMargin - a.smallestMargin) || byPosition(a.star, b.star));
  const best = cands[0];
  if (!best) throw new Error("training s1.water: no ★ with a fill point no road reaches nearer in a straight line and one by road");
  if (pathLength(best.route) * s.mpp > 3000 + 1) throw new Error("training s1.water: the route is over 3 km");
  return { ...best, qualifying: cands.length, considered };
}

/** The tangent bearing of a polyline at vertex `i` (over two vertices each side). */
export const tangentAt = (pts: readonly Px[], i: number): number => bearing(pts[Math.max(0, i - 2)]!, pts[Math.min(pts.length - 1, i + 2)]!);
