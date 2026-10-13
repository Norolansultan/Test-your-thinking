/**
 * `npm run map:build` (step 1 of 2) — builds the generated site (SPEC/23 §11).
 *
 * Writes:
 *   content/site/build/topo-features.json   vector layers in map pixels, drawn by render.py
 *   content/site/fuel_truth.asc             25 m fuel grid, central 10 km (ETRS-TM35FIN)
 *   content/site/fuel_machine.asc           the same with the stale stand data (M3)
 *   content/site/elevation.asc              25 m elevation grid, same extent
 *   content/site/site.json                  ignition point and file list for the fire model
 *   app/scenario/site-meta.json             map extent and WGS84 corners for the UI
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { traceMaskMetres, type GridFrame } from "../fire-ca/geometry.js";
import { tm35ToWgs84 } from "../fire-ca/tm35.js";
import { Mulberry32 } from "../fire-ca/model.js";
import { FUEL_CLASSES } from "../fire-ca/template-site.js";
import {
  bigLakeIsland,
  BROOKS,
  distToPolyline,
  elevation,
  fbm,
  HALF_M,
  IGN_TM35,
  inBogS,
  inLake,
  isPaludified,
  isRocky,
  isWetMire,
  lakeAt,
  lakeReach,
  runsOutsideLakes,
  LAKES,
  landCover,
  LC_DRAINED_BOG,
  LC_FIELD,
  LC_FOREST,
  LC_OPEN_BOG,
  LC_PINE_BOG,
  LC_WATER,
  POWER_LINE,
  RIVER,
  riverDist,
  standClass,
  type P,
} from "./terrain.js";
import { BRIDGES, COMMAND_POINT, ROADS, UNBRIDGED_CROSSINGS } from "./roads.js";
import { FEATURES } from "../fire-ca/deployment.js";
import { BARE_ENDS_NEAR_IGN, BUILDINGS, englishLabel, namedLabels, NO_NEW_BUILDINGS_M, ROAD_END_STATS, VALLEY_FLOOR_M } from "./places.js";

const GRID_M = 10;
const N = (2 * HALF_M) / GRID_M; // 2000
const MAP_M_PER_PX = 4;
const MAP_PX = (2 * HALF_M) / MAP_M_PER_PX; // 5000

const toPx = (x: number, y: number): [number, number] => [
  Math.round(((x + HALF_M) / MAP_M_PER_PX) * 10) / 10,
  Math.round(((HALF_M - y) / MAP_M_PER_PX) * 10) / 10,
];
const lineToPx = (line: readonly P[]) => line.map((p) => toPx(p.x, p.y));
const cellX = (c: number) => -HALF_M + (c + 0.5) * GRID_M;
const cellY = (r: number) => -HALF_M + (r + 0.5) * GRID_M;

console.log("elevation and land cover (10 m) …");
const elev = new Float32Array(N * N);
const water = new Uint8Array(N * N);
const lc = new Uint8Array(N * N);
for (let r = 0; r < N; r++) {
  const y = cellY(r);
  for (let c = 0; c < N; c++) {
    const x = cellX(c);
    const i = r * N + c;
    elev[i] = elevation(x, y);
    for (const l of LAKES) {
      if (Math.abs(x - l.cx) < l.r * lakeReach(l) && Math.abs(y - l.cy) < l.r * lakeReach(l) && inLake(l, x, y)) { water[i] = 1; break; }
    }
  }
}
// The river as water, rasterised along its line.
for (let k = 0; k + 1 < RIVER.length; k++) {
  const a = RIVER[k]!;
  const b = RIVER[k + 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  for (let s = 0; s <= len; s += 4) {
    const x = a.x + ((b.x - a.x) * s) / len;
    const y = a.y + ((b.y - a.y) * s) / len;
    for (let dy = -8; dy <= 8; dy += 4) for (let dx = -8; dx <= 8; dx += 4) {
      const c = Math.floor((x + dx + HALF_M) / GRID_M);
      const r = Math.floor((y + dy + HALF_M) / GRID_M);
      if (c >= 0 && r >= 0 && c < N && r < N) water[r * N + c] = 1;
    }
  }
}
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const i = r * N + c;
  lc[i] = water[i] ? LC_WATER : landCover(cellX(c), cellY(r), elev[i]!);
}

// Cosmetic layers on top of forest/bog, not fuel classes (see terrain.ts isRocky, isPaludified,
// isWetMire): exposed bedrock, paludified fringe ("soistuma"), difficult-to-traverse mire.
const rock = new Uint8Array(N * N);
const paludified = new Uint8Array(N * N);
const wetMire = new Uint8Array(N * N);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const i = r * N + c;
  const x = cellX(c);
  const y = cellY(r);
  if (lc[i] === LC_FOREST) {
    if (isRocky(x, y, elev[i]!)) rock[i] = 1;
    else if (isPaludified(x, y)) paludified[i] = 1;
  } else if ((lc[i] === LC_OPEN_BOG || lc[i] === LC_PINE_BOG) && isWetMire(x, y)) wetMire[i] = 1;
}

// Downsampled elevation, for render.py's hillshade (higher/lower ground, visible beyond contour
// lines alone). Every 5th 10 m cell -> 50 m spacing, 400x400 over the full 20 km map.
const ELEV_DOWNSAMPLE = 5;
const elevGridSize = Math.floor(N / ELEV_DOWNSAMPLE);
const elevGrid: number[] = [];
for (let r = 0; r < elevGridSize; r++) {
  for (let c = 0; c < elevGridSize; c++) {
    elevGrid.push(Math.round(elev[r * ELEV_DOWNSAMPLE * N + c * ELEV_DOWNSAMPLE]! * 10) / 10);
  }
}

const maskEq = (cls: number) => {
  const m = new Uint8Array(N * N);
  for (let i = 0; i < m.length; i++) m[i] = lc[i] === cls ? 1 : 0;
  return m;
};

// MML "vaikeakulkuinen suo": continuous horizontal (E–W) blue lines over the mire fill, 0.6 mm
// apart on the 1:50 000 sheet = 30 m on the ground.
const mireLines: [number, number][][] = [];
for (let r = 1; r < N; r += 3) {
  let run = -1;
  for (let c = 0; c <= N; c++) {
    const on = c < N && wetMire[r * N + c] === 1;
    if (on && run < 0) run = c;
    if (!on && run >= 0) {
      if (c - run >= 3) mireLines.push([toPx(cellX(run), cellY(r)), toPx(cellX(c - 1), cellY(r))]);
      run = -1;
    }
  }
}

// ---------------------------------------------------------------------------
// Contours: marching squares, chained into polylines.
// ---------------------------------------------------------------------------

console.log("contours …");
interface Contour { readonly level: number; readonly index: boolean; readonly pts: [number, number][] }
const contours: Contour[] = [];
const H = N * N;
for (let level = 40; level <= 200; level += 5) {
  const pointOnEdge = (edge: number): [number, number] => {
    let x0: number, y0: number, x1: number, y1: number, e0: number, e1: number;
    if (edge < H) {
      const r = Math.floor(edge / N);
      const c = edge % N;
      x0 = cellX(c); y0 = cellY(r); x1 = cellX(c + 1); y1 = y0; e0 = elev[r * N + c]!; e1 = elev[r * N + c + 1]!;
    } else {
      const e = edge - H;
      const r = Math.floor(e / N);
      const c = e % N;
      x0 = cellX(c); y0 = cellY(r); x1 = x0; y1 = cellY(r + 1); e0 = elev[r * N + c]!; e1 = elev[(r + 1) * N + c]!;
    }
    const t = e1 === e0 ? 0.5 : (level - e0) / (e1 - e0);
    return toPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  };
  const segA: number[] = [];
  const segB: number[] = [];
  for (let r = 0; r + 1 < N; r++) {
    for (let c = 0; c + 1 < N; c++) {
      const i = r * N + c;
      if (water[i] && water[i + 1] && water[i + N] && water[i + N + 1]) continue;
      const bl = elev[i]! >= level ? 1 : 0;
      const br = elev[i + 1]! >= level ? 1 : 0;
      const tr = elev[i + N + 1]! >= level ? 1 : 0;
      const tl = elev[i + N]! >= level ? 1 : 0;
      const code = bl | (br << 1) | (tr << 2) | (tl << 3);
      if (code === 0 || code === 15) continue;
      const bottom = r * N + c;
      const top = (r + 1) * N + c;
      const left = H + r * N + c;
      const right = H + r * N + c + 1;
      const add = (a: number, b: number) => { segA.push(a); segB.push(b); };
      switch (code) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(right, top); break;
        case 6: case 9: add(bottom, top); break;
        case 7: case 8: add(left, top); break;
        case 5: case 10: {
          const centre = (elev[i]! + elev[i + 1]! + elev[i + N]! + elev[i + N + 1]!) / 4 >= level ? 1 : 0;
          if ((code === 5) === (centre === 1)) { add(left, top); add(bottom, right); } else { add(left, bottom); add(right, top); }
          break;
        }
        default: break;
      }
    }
  }
  const byEdge = new Map<number, number[]>();
  for (let s = 0; s < segA.length; s++) {
    for (const e of [segA[s]!, segB[s]!]) {
      const list = byEdge.get(e);
      if (list) list.push(s); else byEdge.set(e, [s]);
    }
  }
  const used = new Uint8Array(segA.length);
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const chain: number[] = [segA[s0]!, segB[s0]!];
    for (const dir of [1, -1]) {
      for (;;) {
        const endEdge = dir === 1 ? chain[chain.length - 1]! : chain[0]!;
        const next = (byEdge.get(endEdge) ?? []).find((s) => !used[s]);
        if (next === undefined) break;
        used[next] = 1;
        const other = segA[next] === endEdge ? segB[next]! : segA[next]!;
        if (dir === 1) chain.push(other); else chain.unshift(other);
      }
    }
    if (chain.length < 4) continue;
    const pts = chain.map(pointOnEdge);
    // Thin to every other point on long lines; the renderer smooths.
    const thin = pts.filter((_, k) => k % 2 === 0 || k === pts.length - 1);
    contours.push({ level, index: level % 20 === 0, pts: thin });
  }
}

// ---------------------------------------------------------------------------
// Land-cover polygons and ditches.
// ---------------------------------------------------------------------------

console.log("land-cover polygons …");
const frame10: GridFrame = { origin: { lat: 0, lon: 0 }, cols: N, rows: N, cellSizeM: GRID_M };
const polysFromMask = (mask: Uint8Array, minAreaCells: number) =>
  traceMaskMetres(frame10, mask, 0.6, minAreaCells).map((ring) => ring.map((p) => toPx(p.x - HALF_M, p.y - HALF_M)));
const polys = (cls: number, minAreaCells: number) => polysFromMask(maskEq(cls), minAreaCells);
// Lake polygons only: the river is drawn from its centreline (render.py); tracing its 10 m cells
// would outline it with stair steps.
const lakeMask = new Uint8Array(N * N);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (lc[r * N + c] === LC_WATER && lakeAt(cellX(c), cellY(r))) lakeMask[r * N + c] = 1;
const waterPolys = polysFromMask(lakeMask, 30);
const fieldPolys = polys(LC_FIELD, 20);
const openBogPolys = polys(LC_OPEN_BOG, 30);
const pineBogPolys = polys(LC_PINE_BOG, 30);
const drainedBogPolys = polys(LC_DRAINED_BOG, 30);
const rockPolys = polysFromMask(rock, 25);
// Islands: the traced water rings carry no holes, so islands are drawn back as land on top.
const islandMask = new Uint8Array(N * N);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  if (lc[r * N + c] !== LC_WATER && bigLakeIsland(cellX(c), cellY(r)) > 0) islandMask[r * N + c] = 1;
}
const islandPolys = polysFromMask(islandMask, 4);
const paludifiedPolys = polysFromMask(paludified, 60);

// Forestry ditches ("oja, leveys alle 2 m"): parallel lines ~45 m apart across every drained mire,
// each mire ditched in its own direction (L521). BOG-S keeps its SPEC/18 §5 20° pattern.
const ditches: [number, number][][] = [];
{
  const drained = maskEq(LC_DRAINED_BOG);
  const label = new Int32Array(N * N).fill(-1);
  const rng = new Mulberry32(0xd17c);
  const stack: number[] = [];
  let nextLabel = 0;
  for (let seed = 0; seed < N * N; seed++) {
    if (!drained[seed] || label[seed]! >= 0) continue;
    const id = nextLabel++;
    let minR = N, maxR = 0, minC = N, maxC = 0, bogS = false;
    label[seed] = id;
    stack.push(seed);
    while (stack.length > 0) {
      const i = stack.pop()!;
      const r = Math.floor(i / N);
      const c = i % N;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      if (!bogS && inBogS(cellX(c), cellY(r))) bogS = true;
      for (const j of [c > 0 ? i - 1 : -1, c + 1 < N ? i + 1 : -1, r > 0 ? i - N : -1, r + 1 < N ? i + N : -1]) {
        if (j >= 0 && drained[j] && label[j]! < 0) { label[j] = id; stack.push(j); }
      }
    }
    const angleDeg = bogS ? 20 : rng.nextFloat() * 180;
    if ((maxR - minR + 1) * (maxC - minC + 1) < 40) continue;
    const ang = (angleDeg * Math.PI) / 180;
    const ux = Math.sin(ang);
    const uy = Math.cos(ang);
    const cx = cellX((minC + maxC) / 2);
    const cy = cellY((minR + maxR) / 2);
    const half = (Math.hypot(maxC - minC, maxR - minR) * GRID_M) / 2 + GRID_M;
    const inside = (x: number, y: number) => {
      const c = Math.floor((x + HALF_M) / GRID_M);
      const r = Math.floor((y + HALF_M) / GRID_M);
      return c >= 0 && r >= 0 && c < N && r < N && label[r * N + c] === id;
    };
    for (let off = -half; off <= half; off += 45) {
      let current: P[] = [];
      for (let t = -half; t <= half; t += 10) {
        const x = cx + uy * off + ux * t;
        const y = cy - ux * off + uy * t;
        if (inside(x, y)) current.push({ x, y });
        else { if (current.length > 3) ditches.push(lineToPx(current)); current = []; }
      }
      if (current.length > 3) ditches.push(lineToPx(current));
    }
  }
}

// ---------------------------------------------------------------------------
// Spot heights.
// ---------------------------------------------------------------------------

const heights: { x: number; y: number; h: number }[] = [];
{
  const block = 40; // 400 m
  const cand: { c: number; r: number; h: number }[] = [];
  for (let br = 0; br < N; br += block) for (let bc = 0; bc < N; bc += block) {
    let best = -Infinity;
    let at = -1;
    for (let r = br; r < Math.min(N, br + block); r++) for (let c = bc; c < Math.min(N, bc + block); c++) {
      const i = r * N + c;
      if (!water[i] && elev[i]! > best) { best = elev[i]!; at = i; }
    }
    if (at >= 0) cand.push({ c: at % N, r: Math.floor(at / N), h: best });
  }
  cand.sort((a, b) => b.h - a.h || a.r - b.r || a.c - b.c);
  for (const k of cand) {
    const x = cellX(k.c);
    const y = cellY(k.r);
    if (heights.some((q) => Math.hypot(q.x - x, q.y - y) < 1300)) continue;
    heights.push({ x, y, h: Math.round(k.h * 10) / 10 });
    if (heights.length >= 45) break;
  }
}

// ---------------------------------------------------------------------------
// Write the vector layers.
// ---------------------------------------------------------------------------

const bridges = BRIDGES;
const unbridged = UNBRIDGED_CROSSINGS.map((c) => `${c.cls}@(${Math.round(c.at.x)},${Math.round(c.at.y)})`);
const outsideLakes = (line: readonly P[]) => runsOutsideLakes(line).map(lineToPx);

const labels = namedLabels().map((l) => ({ text: l.text, px: toPx(l.x, l.y), style: l.style }));
for (const h of heights) labels.push({ text: h.h.toFixed(1).replace(".", ","), px: toPx(h.x, h.y), style: "height" as const });
// Revision (ae), 9 Oct 2026: the English map's labels, the same places at the same points, named from
// the one table (`app/i18n/place-names.ts`; `englishLabel` throws on a name it lacks); heights with a
// decimal point. `render.py` draws them on the `topo-en` tiles.
const labelsEn = namedLabels().map((l) => ({ text: englishLabel(l.text), px: toPx(l.x, l.y), style: l.style }));
for (const h of heights) labelsEn.push({ text: h.h.toFixed(1), px: toPx(h.x, h.y), style: "height" as const });

// Revision (al), 10 Oct 2026 (map review panel): terrain drawn on the tiles ONLY. None of it enters
// `lc`, `landCover()` or the fire-model grids below, so the CA and every land-cover lookup
// (`siteTrafficHelpers().landCoverAt`) are unchanged; `render.py` draws these as plain terrain.
//  - the farm pond at W2 (Lahdenkylän lampi), r ≈ 35 m, its centre 40 m north of POND_W2 so the water
//    point is on the pond's drivable south shore, 60 m from the main road;
//  - the log landing at the R2 / Honkaharju forest-road junction (EK16's safety zone), ~60 × 40 m in
//    the junction's south-east corner, between R2 and the forest road east;
//  - the 110 kV line's cleared corridor, 36 m wide (the CA already has it: `cleared_corridor` below).
const CORRIDOR_M = 36;
const W2_POND = { cx: FEATURES.POND_W2.x, cy: FEATURES.POND_W2.y + 40, rx: 38, ry: 32 };
const w2PondRing = Array.from({ length: 28 }, (_, k) => {
  const t = (2 * Math.PI * k) / 28;
  const wobble = 1 + 0.06 * Math.sin(3 * t + 0.7) + 0.04 * Math.cos(5 * t);
  return toPx(W2_POND.cx + Math.cos(t) * W2_POND.rx * wobble, W2_POND.cy + Math.sin(t) * W2_POND.ry * wobble);
});
const LANDING = { x0: FEATURES.R2_FR.x + 4, x1: FEATURES.R2_FR.x + 64, y0: FEATURES.R2_FR.y - 58, y1: FEATURES.R2_FR.y - 18 };
const landingRing = [toPx(LANDING.x0, LANDING.y1), toPx(LANDING.x1, LANDING.y1), toPx(LANDING.x1, LANDING.y0), toPx(LANDING.x0, LANDING.y0)];
{
  const pondEdgeToW2 = Math.hypot(FEATURES.POND_W2.x - W2_POND.cx, FEATURES.POND_W2.y - W2_POND.cy) - W2_POND.ry;
  console.log(`  (al) tiles only: W2 pond centre (${W2_POND.cx},${W2_POND.cy}), POND_W2 ${pondEdgeToW2.toFixed(0)} m outside its shore; log landing ${LANDING.x1 - LANDING.x0} × ${LANDING.y1 - LANDING.y0} m at R2_FR; power-line corridor ${CORRIDOR_M} m`);
}

const features = {
  size: MAP_PX,
  metresPerPixel: MAP_M_PER_PX,
  elevationGrid: { size: elevGridSize, values: elevGrid },
  water: waterPolys,
  islands: islandPolys,
  fields: fieldPolys,
  openBogs: openBogPolys,
  pineBogs: pineBogPolys,
  drainedBogs: drainedBogPolys,
  rocky: rockPolys,
  paludified: paludifiedPolys,
  mireLines,
  ditches,
  contours: contours.map((c) => ({ index: c.index, pts: c.pts })),
  river: outsideLakes(RIVER),
  brooks: BROOKS.flatMap((b) => outsideLakes(b.line)),
  roads: ROADS.map((r) => ({ cls: r.cls, pts: lineToPx(r.line) })),
  powerLine: lineToPx(POWER_LINE),
  powerCorridorPx: CORRIDOR_M / MAP_M_PER_PX,
  ponds: [w2PondRing],
  clearings: [landingRing],
  bridges: bridges.map((b) => toPx(b.x, b.y)),
  buildings: BUILDINGS.map((b) => ({ px: toPx(b.x, b.y), size: b.size / MAP_M_PER_PX, kind: b.kind })),
  labels,
  labelsEn,
};
mkdirSync("content/site/build", { recursive: true });
writeFileSync("content/site/build/topo-features.json", JSON.stringify(features));
console.log(`  ${contours.length} contour lines, ${waterPolys.length} water, ${fieldPolys.length} field, ${openBogPolys.length + pineBogPolys.length + drainedBogPolys.length} bog polygons, ${ditches.length} ditches, ${ROADS.length} roads, ${BUILDINGS.length} buildings`);
{
  const km = (cls: string) => Math.round(ROADS.filter((r) => r.cls === cls).reduce((s, r) => s + r.line.reduce((t, p, k) => (k ? t + Math.hypot(p.x - r.line[k - 1]!.x, p.y - r.line[k - 1]!.y) : 0), 0), 0) / 1000);
  const share = (cls: number) => ((100 * lc.reduce((n, v) => n + (v === cls ? 1 : 0), 0)) / lc.length).toFixed(1);
  console.log(`  road km: main ${km("main")}, gravel ${km("gravel")}, forest ${km("forest")}, track ${km("track")}, path ${km("path")}`);
  const kmIn = (pred: (p: P) => boolean) => Math.round(ROADS.filter((r) => r.cls !== "main").reduce((s, r) => s + r.line.reduce((t, p, k) => (k && pred(p) ? t + Math.hypot(p.x - r.line[k - 1]!.x, p.y - r.line[k - 1]!.y) : t), 0), 0) / 1000);
  console.log(`  non-main road km: south strip (y < −4 km) ${kmIn((p) => p.y < -4000)}, north strip (y > 4 km) ${kmIn((p) => p.y > 4000)}`);
  const s = ROAD_END_STATS;
  const nearIgn = BUILDINGS.filter((b) => Math.hypot(b.x, b.y) < NO_NEW_BUILDINGS_M).length;
  console.log(`  road dead ends (forest/track): ${s.deadEnds}, with building ${s.withBuilding}, inside ${NO_NEW_BUILDINGS_M / 1000} km (left bare) ${s.insideNoBuildZone}; lake cottages ${s.lakeCottages}; buildings within ${NO_NEW_BUILDINGS_M / 1000} km of IGN: ${nearIgn}`);
  console.log(`  dead ends outside the zone, with building / total: ${Object.entries(s.byCls).map(([k, [n, b]]) => `${k} ${b}/${n}`).join(", ")}; houses ${BUILDINGS.filter((b) => b.kind === "house").length}, other ${BUILDINGS.filter((b) => b.kind === "other").length}`);
  const inValley = BUILDINGS.filter((b) => riverDist(b.x, b.y, VALLEY_FLOOR_M) < VALLEY_FLOOR_M);
  console.log(`  river: ${bridges.length} bridges (${bridges.map((b) => `(${Math.round(b.x)},${Math.round(b.y)})`).join(" ")}); unbridged road crossings: ${unbridged.length ? unbridged.join(" ") : "none"}; buildings within ${VALLEY_FLOOR_M} m of the river: ${inValley.length}`);
  console.log(`  bare dead ends near IGN: ${BARE_ENDS_NEAR_IGN.map((e) => `${e.cls}@(${Math.round(e.x)},${Math.round(e.y)})`).join(" ")}`);
  const pct = (m: Uint8Array) => ((100 * m.reduce((n, v) => n + v, 0)) / m.length).toFixed(1);
  console.log(`  land cover (whole map): open bog ${share(LC_OPEN_BOG)}%, pine bog ${share(LC_PINE_BOG)}%, drained bog ${share(LC_DRAINED_BOG)}%, field ${share(LC_FIELD)}%, water ${share(LC_WATER)}%; cosmetic: rock ${pct(rock)}%, soistuma ${pct(paludified)}%, difficult mire ${pct(wetMire)}%`);
}

// ---------------------------------------------------------------------------
// Fire-model grids: 25 m, central 10 km.
// ---------------------------------------------------------------------------

console.log("fuel and elevation grids (25 m) …");
const CA_HALF = 5000;
const CA_M = 25;
const CN = (2 * CA_HALF) / CA_M; // 400
const fuelIndex = (id: string) => FUEL_CLASSES.findIndex((f) => f.id === id);
const truth = new Int32Array(CN * CN);
const machine = new Int32Array(CN * CN);
const caElev = new Float32Array(CN * CN);
// Linear breaks in the fuel grid (SPEC/24 §12): 1 = gravel/main road, 2 = forest road, 3 = brook.
// Tracks (ajopolku) and paths are too narrow to stop anything and stay out.
const roadCells = new Uint8Array(CN * CN);
const rasterLine = (line: readonly { x: number; y: number }[], code: number) => {
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s <= len; s += 8) {
      const c = Math.floor((a.x + ((b.x - a.x) * s) / len + CA_HALF) / CA_M);
      const r = Math.floor((a.y + ((b.y - a.y) * s) / len + CA_HALF) / CA_M);
      if (c >= 0 && r >= 0 && c < CN && r < CN && (roadCells[r * CN + c] === 0 || code < roadCells[r * CN + c]!)) roadCells[r * CN + c] = code;
    }
  }
};
for (const road of ROADS) {
  if (road.cls === "main" || road.cls === "gravel") rasterLine(road.line, 1);
  else if (road.cls === "forest") rasterLine(road.line, 2);
}
for (const b of BROOKS) rasterLine(b.line, 3);
const builtCells = new Uint8Array(CN * CN);
for (const b of BUILDINGS) {
  const c = Math.floor((b.x + CA_HALF) / CA_M);
  const r = Math.floor((b.y + CA_HALF) / CA_M);
  if (c >= 0 && r >= 0 && c < CN && r < CN) builtCells[r * CN + c] = 1;
}
for (let r = 0; r < CN; r++) for (let c = 0; c < CN; c++) {
  const i = r * CN + c;
  const x = -CA_HALF + (c + 0.5) * CA_M;
  const y = -CA_HALF + (r + 0.5) * CA_M;
  const gi = Math.floor((y + HALF_M) / GRID_M) * N + Math.floor((x + HALF_M) / GRID_M);
  const e = elev[gi]!;
  caElev[i] = e;
  const cover = lc[gi]!;
  let t: string;
  let m: string | null = null;
  if (cover === LC_WATER) t = "water";
  else if (builtCells[i]) t = "built";
  else if (roadCells[i]) t = (["road_gravel", "road_forest", "brook"] as const)[roadCells[i]! - 1]!;
  else if (cover === LC_FIELD) t = "field";
  else if (cover === LC_OPEN_BOG) t = "open_bog";
  else if (cover === LC_DRAINED_BOG || cover === LC_PINE_BOG) t = "drained_peat";
  else if (distToPolyline(x, y, POWER_LINE) < 18) t = "cleared_corridor";
  else {
    const s = standClass(x, y, e);
    if (s === "spr") { t = "spruce_mature"; m = "spruce_thinned"; } else t = s;
  }
  truth[i] = fuelIndex(t);
  machine[i] = fuelIndex(m ?? t);
}
const asc = (values: ArrayLike<number>, decimals: number) => {
  const lines = [
    `ncols ${CN}`, `nrows ${CN}`, `xllcorner ${IGN_TM35.eastM - CA_HALF}`, `yllcorner ${IGN_TM35.northM - CA_HALF}`, `cellsize ${CA_M}`, "NODATA_value -9999",
  ];
  for (let r = CN - 1; r >= 0; r--) {
    const row: string[] = [];
    for (let c = 0; c < CN; c++) row.push(Number(values[r * CN + c]).toFixed(decimals));
    lines.push(row.join(" "));
  }
  return lines.join("\n") + "\n";
};
writeFileSync("content/site/fuel_truth.asc", asc(truth, 0));
writeFileSync("content/site/fuel_machine.asc", asc(machine, 0));
writeFileSync("content/site/elevation.asc", asc(caElev, 1));
writeFileSync("content/site/site.json", JSON.stringify({
  name: "Generated site (fictional terrain, SPEC/23 §11)",
  ignitionTm35: IGN_TM35,
  commandPointTm35: { eastM: IGN_TM35.eastM + COMMAND_POINT.x, northM: IGN_TM35.northM + COMMAND_POINT.y },
  truthFuel: "fuel_truth.asc",
  machineFuel: "fuel_machine.asc",
  elevation: "elevation.asc",
  legend: FUEL_CLASSES.map((f, code) => ({ code, fuelId: f.id })),
}, null, 1));

// ---------------------------------------------------------------------------
// UI metadata.
// ---------------------------------------------------------------------------

const corner = (dx: number, dy: number) => {
  const p = tm35ToWgs84(IGN_TM35.eastM + dx, IGN_TM35.northM + dy);
  return [Math.round(p.lon * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6];
};
const ign = tm35ToWgs84(IGN_TM35.eastM, IGN_TM35.northM);
const TILES = 4;
function tileGrid() {
  const step = (2 * HALF_M) / TILES;
  const out: { url: string; corners: number[][] }[] = [];
  for (let r = 0; r < TILES; r++) {
    for (let c = 0; c < TILES; c++) {
      const w = -HALF_M + c * step, n = HALF_M - r * step;
      out.push({ url: `/maps/topo/${r}_${c}.webp`, corners: [corner(w, n), corner(w + step, n), corner(w + step, n - step), corner(w, n - step)] });
    }
  }
  return out;
}
writeFileSync(join("app", "scenario", "site-meta.json"), JSON.stringify({
  image: "/maps/topo.webp",
  metresPerPixel: MAP_M_PER_PX,
  sizePx: MAP_PX,
  tm35: { west: IGN_TM35.eastM - HALF_M, south: IGN_TM35.northM - HALF_M, east: IGN_TM35.eastM + HALF_M, north: IGN_TM35.northM + HALF_M },
  cornersWgs84: [corner(-HALF_M, HALF_M), corner(HALF_M, HALF_M), corner(HALF_M, -HALF_M), corner(-HALF_M, -HALF_M)],
  // The UI draws the basemap as TILES × TILES image sources: one 5000 px texture froze the browser
  // for tens of seconds on upload (end-to-end test, 24 Sep 2026). Corners exact through TM35.
  tiles: tileGrid(),
  ignitionWgs84: { lat: Math.round(ign.lat * 1e6) / 1e6, lon: Math.round(ign.lon * 1e6) / 1e6 },
}, null, 1) + "\n");
console.log("done. Next: python tools/topo-map/render.py");
void fbm;
