/**
 * `npx tsx tools/review/map-training.ts` — builds the map training (researcher decision 25 Oct 2026, replacing the map-reading pretest
 * of `docs/audits/2026-10-23-difficulty/proposal-map.md` c.2; SPEC/08 (bj)) from the site data. Every key is COMPUTED, never typed,
 * and every rule checks a margin: a rule whose margin fails throws, and the rule (not a mark) is what changes.
 *
 * The extract is the pretest's, kept: pixels x 4375–5000, y 0–625 of the basemap (tile `0_3`, x 625–1250, y 0–625; TM35
 * E 526 500–529 000, N 6 753 500–6 756 000), around Kaitajärvi, north-east of the incident and outside it. Nothing of the scenario is
 * on it: its road codes (R5–R7), call signs (EK51, DR8) and clock times are the training's own (tested against the scenario's texts).
 *
 * Roads: the drivable roads (main and forest roads; tracks are not) clipped to the extract. The main road is R5; the two long forest
 * roads that join it (≥ 1.6 km inside the extract) are R6 and R7, west to east by their junction. The tasks (SPEC/08 (bj)):
 * 1. place — the R5/R6 junction (point answer; ≥ 100 px from R5's other junctions and ≥ 60 px from the edge).
 * 2. measure — A on land whose nearest drivable road is a named road at 600 m (else 300 m) ± 4 %, the next road ≥ 1.5 × as far, the
 *    nearest point ≥ 40 px from the road's ends; options 150 / 300 / 600 / 1 200 m (each the double of the last: the key is the only
 *    option within 40 %).
 * 3. slope — A (a 10 px lattice), B 240 m away up the steepest climb (≥ 5 m on the elevation grid, rising throughout, crossing two
 *    contour lines or more, each higher than the last: the basemap draws 5 m lines and some 2.5 m ones) and C 240 m away on level
 *    ground (within ± 1 m all the way, no contour line), ≥ 90° apart; all in forest (no water, field or mire), clear of roads.
 * 4. water — ★ on a drivable road ≥ 40 px from water; fill points where a drivable road passes within 48 m of open water; 1 and 2
 *    (west to east) such that one is ≤ 0.75 × nearer in a straight line and the other ≤ 0.5 × nearer by road (Dijkstra on the
 *    clipped road graph: the participant sees every road it uses). Key: the one nearer by road.
 * 5./6. now, project — a fire on land beside a named road, its head 120 m short of the road "as mapped at 14.00"; a report puts the
 *    head at the road at 14.12 (10 m/min); the projection to 14.42 is 300 m on from the road in the same direction, ≥ 60 m from
 *    water, the way there over land. North-east preferred (then N, E, NW, SE), the road crossed at ≥ 50°; the "mapped 14.00" label
 *    beside the fire.
 * Every mark, the fire and the labels keep clear of the scale bar's card and the north arrow (`chromeBoxes`).
 * 7. memory — EK51 on a drivable road (≥ 40 px from its ends and every junction), 20–80 px from open water, ≥ 100 px from every
 *    other task's points: of those, the one farthest from them.
 * The road codes sit on their roads, 25–75 % along each, as far as possible from every task's points.
 *
 * Writes `content/pretest/map-training.json` (what the app shows: geometry and keys; the training shows each key in its feedback),
 * `content/pretest/map-training.key.json` (the figures and margins behind each key: SPEC/08 (bj), the key checkers) and a preview of
 * every task's feedback for the two people who check the keys (`docs/audits/2026-10-23-difficulty/map-training-preview.svg`).
 * Deterministic: the same site data write the same bytes (`test/tools/map-training.spec.ts` rebuilds and compares).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromeBoxes, trainingSvg } from "../../app/render/ui/map-training-overlay.js";
import { isPointTask, type MapTrainingSpec, type Pt, type TrainingFire, type TrainingMark, type TrainingRoadLabel, type TrainingTask } from "../../app/session/map-training-spec.js";
import { bearing, byPosition, contourError, crossedLevels, crossings, dist, ElevationGrid, inside, levelSegments, lineDist, nearestOnLine, offset, polygonDist, RoadGraph, round1, toPx, type Px, type Ring } from "./map-training-geometry.js";

interface TopoFeatures {
  readonly size: number;
  readonly metresPerPixel: number;
  readonly elevationGrid: { readonly size: number; readonly values: readonly number[] };
  readonly water: readonly Ring[];
  readonly fields: readonly Ring[];
  readonly mireFill: readonly Ring[];
  readonly contours: readonly { readonly level: number; readonly pts: Ring }[];
  readonly roads: readonly { readonly cls: string; readonly pts: Ring }[];
  readonly labels: readonly { readonly text: string; readonly px: readonly [number, number] }[];
}

/** The extract, in basemap pixels (4 m), and the tile that holds it (the pretest's, unchanged). */
export const CROP = { x0: 4375, y0: 0, size: 625, tile: "0_3", tileX0: 625, tileY0: 0, tilePx: 1250 } as const;
export const TRAINING_VERSION = "map-training-2026-10-25";
export const TRAINING_TIME_LIMIT_MS = 300_000;
export const MEMORY_MS = 8_000;
/** The training's own names, in no record, item or text of the scenario (tested). */
export const TRAINING_NAMES = { roads: ["R5", "R6", "R7"], unit: "EK51", drone: "DR8" } as const;
const MARK_GAP_PX = 40;
const SCALE_BAR_M = 500;
/** The fire: 10 m/min (2.5 px a minute); mapped 14.00, reported at the road 14.12, projected to 14.42. */
const FIRE = { pxPerMin: 2.5, mapped: "14.00", report: "14.12", target: "14.42", reportMin: 12, targetMin: 30, lengthPx: 70, halfWidthPx: 17 } as const;
const DIRECTIONS: readonly { readonly deg: number; readonly id: string }[] = [
  { deg: 45, id: "ne" }, { deg: 0, id: "n" }, { deg: 90, id: "e" }, { deg: 315, id: "nw" }, { deg: 135, id: "se" },
];

const inCrop = (p: Px, margin = 0) => p.x >= CROP.x0 + margin && p.x <= CROP.x0 + CROP.size - margin && p.y >= CROP.y0 + margin && p.y <= CROP.y0 + CROP.size - margin;
const local = (p: Px): Pt => ({ x: round1(p.x - CROP.x0), y: round1(p.y - CROP.y0) });
const lattice = (step: number, margin: number): Px[] => {
  const out: Px[] = [];
  for (let y = CROP.y0 + margin; y <= CROP.y0 + CROP.size - margin; y += step) for (let x = CROP.x0 + margin; x <= CROP.x0 + CROP.size - margin; x += step) out.push({ x, y });
  return out;
};
const pathLength = (ps: readonly Px[]) => ps.reduce((s, p, i) => (i === 0 ? 0 : s + dist(ps[i - 1]!, p)), 0);
const ring = (ps: readonly Px[]): Ring => ps.map((p) => [p.x, p.y] as const);
/** Every `n`-th point of a path, its ends kept (the routes drawn in the feedback). */
const thin = (ps: readonly Px[], n: number): Px[] => ps.filter((_, i) => i % n === 0 || i === ps.length - 1);

export interface TrainingBuild { readonly spec: MapTrainingSpec; readonly key: Readonly<Record<string, unknown>> }

export function buildMapTraining(f: TopoFeatures): TrainingBuild {
  if (f.size !== 5000 || f.metresPerPixel !== 4) throw new Error("map training: the basemap is not the 5000 px, 4 m one");
  const mpp = f.metresPerPixel;
  const grid = new ElevationGrid(f.elevationGrid.size, f.elevationGrid.values, f.size);
  const contourErr = contourError(grid, f.contours, (p) => inCrop(p, -200));
  if (contourErr > 1.5) throw new Error(`map training: the elevation grid disagrees with the contours (median ${contourErr.toFixed(2)} m)`);
  const labelAt = f.labels.find((l) => l.text === "Kaitajärvi");
  if (!labelAt || !inCrop(toPx(labelAt.px))) throw new Error("map training: no Kaitajärvi label in the extract (not the pretest's extract)");

  // Terrain predicates.
  const waters = f.water.filter((w) => w.some((q) => inCrop(toPx(q), -50)));
  const memo = <T>(fn: (p: Px) => T) => { const cache = new Map<string, T>(); return (p: Px): T => { const k = `${p.x.toFixed(2)},${p.y.toFixed(2)}`; let v = cache.get(k); if (v === undefined) { v = fn(p); cache.set(k, v); } return v; }; };
  const waterDist = memo((p: Px) => Math.min(...waters.map((w) => polygonDist(p, w))));
  /** The polygons whose bounding box meets the extract (a polygon can hold the extract's points with no vertex inside it). */
  const near = (rs: readonly Ring[]) => rs.filter((r) => Math.min(...r.map((q) => q[0])) <= CROP.x0 + CROP.size && Math.max(...r.map((q) => q[0])) >= CROP.x0 &&
    Math.min(...r.map((q) => q[1])) <= CROP.y0 + CROP.size && Math.max(...r.map((q) => q[1])) >= CROP.y0);
  const fields = near(f.fields), mires = near(f.mireFill);
  const inField = memo((p: Px) => fields.some((r) => inside(p, r)));
  const inMire = memo((p: Px) => mires.some((r) => inside(p, r)));
  const contours = f.contours.filter((c) => c.pts.some((q) => inCrop(toPx(q), -20)));

  // Roads: the drivable ones clipped to the extract (runs of consecutive vertices inside it).
  const pieces: { id: string; cls: string; pts: Px[] }[] = [];
  f.roads.forEach((r, i) => {
    if (r.cls !== "main" && r.cls !== "forest") return;
    let run: Px[] = [];
    const flush = () => { if (run.length >= 2) pieces.push({ id: `road${i}.${pieces.length}`, cls: r.cls, pts: run }); run = []; };
    for (const q of r.pts) { const p = toPx(q); if (inCrop(p)) run.push(p); else flush(); }
    flush();
  });
  const mains = pieces.filter((p) => p.cls === "main").sort((a, b) => pathLength(b.pts) - pathLength(a.pts));
  const r5 = mains[0];
  if (!r5 || mains.length !== 1) throw new Error(`map training: expected one main road in the extract, found ${mains.length}`);
  const r5Ring = ring(r5.pts);
  const joins = pieces.filter((p) => p !== r5).map((p) => {
    const ends = [p.pts[0]!, p.pts.at(-1)!].map((e) => ({ e, d: lineDist(e, r5Ring) })).sort((a, b) => a.d - b.d);
    return { piece: p, junction: ends[0]!.e, gap: ends[0]!.d, length: pathLength(p.pts) };
  }).filter((j) => j.gap <= 4);
  const long = joins.filter((j) => j.length >= 400).sort((a, b) => byPosition(a.junction, b.junction));
  if (long.length !== 2) throw new Error(`map training: expected two long forest roads joining the main road, found ${long.length}`);
  const named = [{ code: "R5", pts: r5.pts }, { code: "R6", pts: long[0]!.piece.pts }, { code: "R7", pts: long[1]!.piece.pts }] as const;
  const junctions = joins.map((j) => j.junction);
  const rings = new Map(pieces.map((pc) => [pc, ring(pc.pts)] as const));
  const nearestRoad = memo((p: Px) => pieces.map((pc) => ({ pc, d: lineDist(p, rings.get(pc)!) })).sort((a, b) => (a.d - b.d) || (a.pc.id < b.pc.id ? -1 : 1)));
  const roadClear = (p: Px, px: number) => nearestRoad(p)[0]!.d >= px;
  const crossesRoad = (a: Px, b: Px) => pieces.some((pc) => crossings(a, b, rings.get(pc)!) > 0);
  const along = (a: Px, b: Px, n: number) => Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
  const forest = (p: Px, waterPx: number) => waterDist(p) >= waterPx && !inField(p) && !inMire(p);
  const boxes = chromeBoxes({ crop: { ...CROP, metresPerPixel: mpp }, scaleBarMetres: SCALE_BAR_M });
  /** Clear of the scale bar's card and the north arrow by `px`. */
  const clearOfChrome = (p: Px, px = 12) => boxes.every((b) => { const q = local(p); return q.x < b.x0 - px || q.x > b.x1 + px || q.y < b.y0 - px || q.y > b.y1 + px; });

  // 1. place: the R5/R6 junction.
  const t1Key = long[0]!.junction;
  const otherJunctions = junctions.filter((j) => j !== t1Key && inCrop(j));
  const t1Gap = Math.min(...otherJunctions.map((j) => dist(j, t1Key)));
  if (t1Gap < 100 || !inCrop(t1Key, 60)) throw new Error("map training 1: the R5/R6 junction is too near another junction or the edge");

  // 2. measure: A at 600 m (else 300 m) from its nearest drivable road, a named one.
  const options = [150, 300, 600, 1200];
  let t2: { a: Px; road: string; metres: number; foot: Px; target: number; second: number } | null = null;
  for (const target of [600, 300]) {
    const cands = lattice(5, 40).filter((p) => forest(p, 8) && dist(p, t1Key) >= 100 && clearOfChrome(p)).map((a) => {
      const near = nearestRoad(a);
      const pc = near[0]!.pc;
      const code = named.find((n) => n.pts === pc.pts)?.code ?? null;
      const second = near.find((x) => x.pc !== pc)?.d ?? Infinity;
      const foot = nearestOnLine(a, rings.get(pc)!);
      return { a, code, d: near[0]!.d, second, foot, fromEnds: Math.min(dist(foot, pc.pts[0]!), dist(foot, pc.pts.at(-1)!)) };
    }).filter((c) => c.code !== null && Math.abs(c.d * mpp - target) <= 0.04 * target && c.second >= 1.5 * c.d && inCrop(c.foot, 30) && c.fromEnds >= 40 && clearOfChrome(c.foot) && junctions.every((j) => dist(j, c.foot) >= 20))
      .sort((x, y) => (Math.abs(x.d * mpp - target) - Math.abs(y.d * mpp - target)) || (y.second / y.d - x.second / x.d) || byPosition(x.a, y.a));
    const c = cands[0];
    if (c) { t2 = { a: c.a, road: c.code!, metres: Math.round(c.d * mpp), foot: c.foot, target, second: Math.round(c.second * mpp) }; break; }
  }
  if (!t2) throw new Error("map training 2: no A at 600 m or 300 m from a named road");
  const t2Key = `m${options.reduce((a, b) => (Math.abs(b - t2!.metres) < Math.abs(a - t2!.metres) ? b : a))}`;
  if (t2Key !== `m${t2.target}`) throw new Error("map training 2: the key is not the target option");

  // 3. slope: the steepest steady climb from A that crosses contour lines uphill only, against level ground (no line crossed).
  const STEP = 60;
  const segs = levelSegments(contours);
  const t3Cands: { a: Px; b: Px; c: Px; rise: number; flat: number; levels: number[] }[] = [];
  for (const a of lattice(10, 50)) {
    if (!forest(a, 12) || !roadClear(a, 15) || !clearOfChrome(a)) continue;
    const ea = grid.at(a);
    let best: { b: Px; rise: number; deg: number; levels: number[] } | null = null;
    for (let k = 0; k < 16; k++) {
      const deg = k * 22.5, b = offset(a, deg, STEP);
      if (!inCrop(b, 40)) continue;
      const prof = along(a, b, 4).map((p) => grid.at(p));
      const rise = prof[4]! - ea;
      if (rise < 5 || !prof.every((v, i) => i === 0 || v > prof[i - 1]!) || !forest(b, 12) || !roadClear(b, 15) || !clearOfChrome(b)) continue;
      const levels = crossedLevels(a, b, segs);
      if (levels.length < 2 || !levels.every((v, i) => i === 0 || v > levels[i - 1]!)) continue;
      if (crossesRoad(a, b) || !along(a, b, 12).every((p) => waterDist(p) >= 6)) continue;
      if (!best || rise > best.rise) best = { b, rise, deg, levels };
    }
    if (!best) continue;
    for (let k = 0; k < 16; k++) {
      const deg = k * 22.5, c = offset(a, deg, STEP);
      const apart = Math.abs(((deg - best.deg + 540) % 360) - 180);
      if (apart < 90 || !inCrop(c, 40)) continue;
      const flat = Math.max(...along(a, c, 8).map((p) => Math.abs(grid.at(p) - ea)));
      if (flat > 1 || crossedLevels(a, c, segs).length > 0 || !forest(c, 12) || !roadClear(c, 15) || !clearOfChrome(c) || crossesRoad(a, c) || !along(a, c, 12).every((p) => waterDist(p) >= 6)) continue;
      t3Cands.push({ a, b: best.b, c, rise: best.rise, flat, levels: best.levels });
    }
  }
  t3Cands.sort((x, y) => (y.rise - x.rise) || (x.flat - y.flat) || byPosition(x.a, y.a) || byPosition(x.c, y.c));
  const t3 = t3Cands[0];
  if (!t3) throw new Error("map training 3: no A with a climb of 5 m (two contour lines) and level ground both 240 m away");

  // 4. water: fill points by the roads; ★ on a road; 1 nearer in a straight line, 2 nearer by road (or the other way round).
  const graph = new RoadGraph(pieces.map((p) => ({ id: p.id, pts: p.pts })));
  const fills: { p: Px; water: number; gap: number }[] = [];
  waters.forEach((w, wi) => {
    for (const pc of pieces) {
      let run: { p: Px; gap: number }[] = [];
      const flush = () => { if (run.length > 0) { const best = [...run].sort((x, y) => (x.gap - y.gap) || byPosition(x.p, y.p))[0]!; fills.push({ p: best.p, water: wi, gap: best.gap }); } run = []; };
      for (const p of pc.pts) { const gap = polygonDist(p, w); if (gap <= 12 && inCrop(p, 30) && clearOfChrome(p)) run.push({ p, gap }); else flush(); }
      flush();
    }
  });
  if (fills.length < 2) throw new Error(`map training 4: ${fills.length} fill points by the roads`);
  // Road distances from each fill point (the graph is undirected), so one Dijkstra per fill point.
  const fromFill = fills.map((w) => ({ w, node: graph.nearest(w.p), sp: graph.shortest(graph.nearest(w.p)) }));
  let t4: { star: Px; near: (typeof fills)[number]; far: (typeof fills)[number]; s: [number, number]; r: [number, number]; routes: [Px[], Px[]]; score: number } | null = null;
  for (let node = 0; node < graph.nodes.length; node++) {
    const star = graph.nodes[node]!;
    if (!inCrop(star, 40) || waterDist(star) < 40 || dist(star, t1Key) < 100 || !clearOfChrome(star)) continue;
    for (const f1 of fromFill) for (const f2 of fromFill) {
      if (f1 === f2) continue;
      const s1 = dist(star, f1.w.p), s2 = dist(star, f2.w.p), r1 = f1.sp.distPx[node]!, r2 = f2.sp.distPx[node]!;
      if (!(s1 <= 0.75 * s2 && r2 <= 0.5 * r1 && Number.isFinite(r1))) continue;
      const score = Math.min(s2 / s1, r1 / r2);
      if (!t4 || score > t4.score || (score === t4.score && byPosition(star, t4.star) < 0)) {
        t4 = { star, near: f1.w, far: f2.w, s: [s1, s2], r: [r1, r2], routes: [[...f1.sp.path(node)].reverse(), [...f2.sp.path(node)].reverse()], score };
      }
    }
  }
  if (!t4) throw new Error("map training 4: no ★ with one fill point nearer in a straight line and the other nearer by road");
  // Labelled 1 and 2 west to east; the key is the one nearer by road.
  const pair = [{ w: t4.near, s: t4.s[0], r: t4.r[0], route: t4.routes[0] }, { w: t4.far, s: t4.s[1], r: t4.r[1], route: t4.routes[1] }].sort((a, b) => byPosition(a.w.p, b.w.p));
  const t4Key = pair[0]!.w === t4.far ? "fill_1" : "fill_2";
  const km = (px: number) => Math.round(px * mpp / 100) / 10;

  // 5./6. the fire beside a named road: mapped 14.00 with its head 120 m short of the road, at the road 14.12, 300 m on at 14.42.
  const tangentAt = (pts: readonly Px[], i: number) => bearing(pts[Math.max(0, i - 2)]!, pts[Math.min(pts.length - 1, i + 2)]!);
  type FireCandidate = { road: string; p: Px; dir: (typeof DIRECTIONS)[number]; h0: Px; polygon: Px[]; key: Px; clearance: number; crossDeg: number; label: Px };
  let t5: FireCandidate | null = null;
  for (const dir of DIRECTIONS) {
    const cands: FireCandidate[] = [];
    for (const n of named) n.pts.forEach((p, i) => {
      if (!inCrop(p, 50)) return;
      const t = tangentAt(n.pts, i);
      const crossDeg = Math.min(...[0, 180].map((s) => Math.abs(((dir.deg - t - s + 540) % 360) - 180)));
      if (crossDeg < 50) return;
      const h0 = offset(p, dir.deg + 180, FIRE.reportMin * FIRE.pxPerMin);
      const o = offset(h0, dir.deg + 180, FIRE.lengthPx);
      const c = { x: (o.x + h0.x) / 2, y: (o.y + h0.y) / 2 };
      const polygon = Array.from({ length: 32 }, (_, k) => {
        const th = (k / 32) * 2 * Math.PI, along1 = Math.cos(th) * FIRE.lengthPx / 2, across = Math.sin(th) * FIRE.halfWidthPx * (1 - 0.25 * Math.cos(th));
        const r = (dir.deg * Math.PI) / 180;
        return { x: round1(c.x + along1 * Math.sin(r) + across * Math.cos(r)), y: round1(c.y - along1 * Math.cos(r) + across * Math.sin(r)) };
      });
      const key = offset(p, dir.deg, FIRE.targetMin * FIRE.pxPerMin);
      if (!polygon.every((q) => inCrop(q, 12) && waterDist(q) >= 6 && !inField(q) && roadClear(q, 10) && clearOfChrome(q, 12))) return;
      if (!inCrop(key, 35) || !clearOfChrome(key) || waterDist(key) < 15 || !along(p, key, 15).every((q) => waterDist(q) >= 4)) return;
      if (dist(key, t1Key) < 60 || dist(p, t1Key) < 60) return;
      // "Mapped 14.00" beside the fire: behind its tail, else on either flank; the whole text inside the extract, clear of the chrome.
      const label = [offset(o, dir.deg + 180, 14), offset(c, dir.deg + 90, FIRE.halfWidthPx + 20), offset(c, dir.deg - 90, FIRE.halfWidthPx + 20)]
        .find((q) => [[-58, -11], [58, -11], [-58, 4], [58, 4]].every(([dx, dy]) => { const r = { x: q.x + dx!, y: q.y + dy! }; return inCrop(r, 4) && clearOfChrome(r, 6); }) && dist(q, p) >= 30 && dist(q, key) >= 30);
      if (!label) return;
      const clearance = Math.min(...polygon.map(waterDist), waterDist(key), ...polygon.map((q) => Math.min(q.x - CROP.x0, CROP.x0 + CROP.size - q.x, q.y - CROP.y0, CROP.y0 + CROP.size - q.y)));
      cands.push({ road: n.code, p, dir, h0, polygon, key, clearance, crossDeg, label });
    });
    cands.sort((a, b) => (b.clearance - a.clearance) || byPosition(a.p, b.p));
    if (cands[0]) { t5 = cands[0]; break; }
  }
  if (!t5) throw new Error("map training 5/6: no road crossing with room for the fire and the projection");
  const lure = offset(t5.h0, t5.dir.deg, FIRE.targetMin * FIRE.pxPerMin); // 30 min from the drawn edge, not from the report
  const fire: TrainingFire = { polygon: t5.polygon.map(local), head: local(t5.h0), mappedAt: FIRE.mapped, label: local(t5.label) };

  // 7. memory: EK51 on a drivable road (an engine keeps to the roads), anchored by open water, away from every other task's points.
  const others: Px[] = [t1Key, t2.a, t2.foot, t3.a, t3.b, t3.c, t4.star, pair[0]!.w.p, pair[1]!.w.p, t5.p, t5.key, t5.label, ...t5.polygon];
  const t7 = pieces.flatMap((pc) => pc.pts.filter((p) => dist(p, pc.pts[0]!) >= 40 && dist(p, pc.pts.at(-1)!) >= 40)).filter((p) => {
    const water = waterDist(p);
    return inCrop(p, 60) && clearOfChrome(p, 24) && water >= 20 && water <= 80 && junctions.every((j) => dist(j, p) >= 40);
  }).map((p) => ({ p, away: Math.min(...others.map((q) => dist(p, q))) })).filter((c) => c.away >= 100)
    .sort((a, b) => (b.away - a.away) || byPosition(a.p, b.p))[0];
  if (!t7) throw new Error("map training 7: no place for the unit");

  // The road codes: 25–75 % along each road, as far as possible from every task's points and the junctions.
  const points = [...others, t7.p, ...junctions];
  const roadLabels: TrainingRoadLabel[] = named.map((n) => {
    const total = pathLength(n.pts);
    let run = 0;
    const cands = n.pts.map((p, i) => { if (i > 0) run += dist(n.pts[i - 1]!, p); return { p, at: run / total }; })
      .filter((c) => c.at >= 0.25 && c.at <= 0.75 && inCrop(c.p, 40) && clearOfChrome(c.p)).map((c) => ({ p: c.p, away: Math.min(...points.map((q) => dist(c.p, q))) }))
      .sort((a, b) => (b.away - a.away) || byPosition(a.p, b.p));
    if (!cands[0] || cands[0].away < 30) throw new Error(`map training: no clear place for the label ${n.code}`);
    return { road: n.code, ...local(cands[0].p) };
  });

  // Within each task, its marks keep apart.
  const markSets: Px[][] = [[t2.a], [t3.a, t3.b, t3.c], [t4.star, pair[0]!.w.p, pair[1]!.w.p]];
  for (const set of markSets) for (const a of set) for (const b of set) if (a !== b && dist(a, b) < MARK_GAP_PX) throw new Error("map training: two marks of a task are too close");

  const mk = (id: string, label: string, p: Px, kind: TrainingMark["kind"] = "point"): TrainingMark => ({ id, label, kind, ...local(p) });
  const tasks: TrainingTask[] = [
    { id: "training.t1.place", kind: "place", skill: "find_named_place", marks: [], roads: ["R5", "R6"], key: local(t1Key) },
    { id: "training.t2.measure", kind: "measure", skill: "measure_distance", marks: [mk("t2_a", "A", t2.a)], road: t2.road, metres: t2.metres, foot: local(t2.foot),
      options: options.map((m) => ({ id: `m${m}`, metres: m })), key: t2Key },
    { id: "training.t3.slope", kind: "slope", skill: "fire_uphill", marks: [mk("t3_a", "A", t3.a), mk("t3_b", "B", t3.b), mk("t3_c", "C", t3.c)], riseB: round1(t3.rise),
      options: [{ id: "towards_b" }, { id: "towards_c" }, { id: "equal" }], key: "towards_b" },
    { id: "training.t4.water", kind: "water", skill: "water_by_road", marks: [mk("t4_star", "★", t4.star, "star"), mk("t4_1", "1", pair[0]!.w.p, "water"), mk("t4_2", "2", pair[1]!.w.p, "water")],
      options: [{ id: "fill_1" }, { id: "fill_2" }, { id: "either" }], key: t4Key,
      straightKm: [km(pair[0]!.s), km(pair[1]!.s)], roadKm: [km(pair[0]!.r), km(pair[1]!.r)], routes: [thin(pair[0]!.route, 3).map(local), thin(pair[1]!.route, 3).map(local)] },
    { id: "training.t5.now", kind: "now", skill: "map_versus_log", marks: [], road: t5.road, fire, report: { clock: FIRE.report, from: TRAINING_NAMES.drone }, headAt: local(t5.p),
      options: [{ id: "map_edge" }, { id: "at_road" }, { id: "cannot_tell" }], key: "at_road" },
    { id: "training.t6.project", kind: "project", skill: "project_by_clock", marks: [], road: t5.road, fire, headAt: local(t5.p), fromClock: FIRE.report, toClock: FIRE.target,
      minutes: FIRE.targetMin, metresPerMin: FIRE.pxPerMin * mpp, bearingDeg: t5.dir.deg, direction: t5.dir.id, key: local(t5.key) },
    { id: "training.t7.memory", kind: "memory", skill: "memory_map", marks: [], unit: { callsign: TRAINING_NAMES.unit, ...local(t7.p) }, key: local(t7.p) },
  ];
  const spec: MapTrainingSpec = {
    generatedBy: "npx tsx tools/review/map-training.ts (researcher decision 25 Oct 2026; SPEC/08 (bj))",
    version: TRAINING_VERSION,
    crop: { ...CROP, metresPerPixel: mpp },
    scaleBarMetres: SCALE_BAR_M,
    timeLimitMs: TRAINING_TIME_LIMIT_MS,
    memoryMs: MEMORY_MS,
    roadLabels,
    tasks,
  };
  const key = {
    status: "The figures behind each key, computed by tools/review/map-training.ts; check against the preview before use. The training shows each key in its feedback.",
    version: TRAINING_VERSION,
    tasks: {
      "training.t1.place": { key: local(t1Key), roads: ["R5", "R6"], nearestOtherJunctionM: Math.round(t1Gap * mpp) },
      "training.t2.measure": { key: t2Key, road: t2.road, metres: t2.metres, offByPct: round1((Math.abs(t2.metres - t2.target) / t2.target) * 100), nextRoadM: t2.second },
      "training.t3.slope": { key: "towards_b", riseBm: round1(t3.rise), slopeBPct: round1((t3.rise / (STEP * mpp)) * 100), contourLevelsAB: t3.levels, levelCmaxDevM: round1(t3.flat), metresEach: STEP * mpp },
      "training.t4.water": {
        key: t4Key, straightM: pair.map((x) => Math.round(x.s * mpp)), roadM: pair.map((x) => Math.round(x.r * mpp)),
        straightRatio: Math.round(Math.min(pair[0]!.s, pair[1]!.s) / Math.max(pair[0]!.s, pair[1]!.s) * 100) / 100,
        roadRatio: Math.round(Math.min(pair[0]!.r, pair[1]!.r) / Math.max(pair[0]!.r, pair[1]!.r) * 100) / 100,
        fillGapM: pair.map((x) => Math.round(x.w.gap * mpp)), starToWaterM: Math.round(waterDist(t4.star) * mpp),
      },
      "training.t5.now": { key: "at_road", road: t5.road, drawnHeadToRoadM: Math.round(dist(t5.h0, t5.p) * mpp), roadCrossingDeg: round1(t5.crossDeg), direction: t5.dir.id },
      "training.t6.project": { key: local(t5.key), metres: Math.round(dist(t5.p, t5.key) * mpp), lureFromDrawnEdge: local(lure), lureOffM: Math.round(dist(lure, t5.key) * mpp), keyToWaterM: Math.round(waterDist(t5.key) * mpp) },
      "training.t7.memory": { key: local(t7.p), toWaterM: Math.round(waterDist(t7.p) * mpp), toOtherTasksM: Math.round(t7.away * mpp) },
    },
  };
  return { spec, key };
}

/** The key checkers' preview: every task's feedback picture (the Finnish tile), four across. */
export function previewSvg(spec: MapTrainingSpec, tileHref: string): string {
  const s = spec.crop.size, gap = 20, cols = 4, rows = Math.ceil(spec.tasks.length / cols);
  const panels = spec.tasks.map((t, i) => {
    const x = (i % cols) * (s + gap), y = Math.floor(i / cols) * (s + gap + 24);
    const answer = isPointTask(t) ? { point: t.key } : { choiceId: t.key };
    const svg = trainingSvg(spec, t, "feedback", tileHref, "fi", answer).replace(/^<svg /, `<svg x="${x}" y="${y + 24}" `).replace(/training-(extract|glow|outside|arrow)/g, `training-$1-${i}`);
    return `<text x="${x}" y="${y + 16}" font-size="16" font-weight="700">${i + 1}. ${t.id}</text>${svg}`;
  });
  const W = cols * (s + gap), H = rows * (s + gap + 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${panels.join("")}</svg>\n`;
}

export function readTopoFeatures(root: string): TopoFeatures {
  return JSON.parse(readFileSync(join(root, "content/site/build/topo-features.json"), "utf8")) as TopoFeatures;
}

export const json = (v: unknown): string => `${JSON.stringify(v, null, 1)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const { spec, key } = buildMapTraining(readTopoFeatures(root));
  mkdirSync(join(root, "content/pretest"), { recursive: true });
  writeFileSync(join(root, "content/pretest/map-training.json"), json(spec));
  writeFileSync(join(root, "content/pretest/map-training.key.json"), json(key));
  writeFileSync(join(root, "docs/audits/2026-10-23-difficulty/map-training-preview.svg"), previewSvg(spec, "../../../app/render/ui/public/maps/topo/0_3.webp"));
  console.log(JSON.stringify(key.tasks, null, 1));
}
