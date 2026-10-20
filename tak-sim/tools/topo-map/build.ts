/**
 * `npm run map:build` (step 1 of 2) — builds the generated site (SPEC/23 §11, SPEC/33 stages 1–6).
 *
 * Writes:
 *   content/site/build/topo-features.json   vector layers in map pixels, drawn by render.py
 *   content/site/fuel_truth.asc             25 m fuel grid, central 10 km (ETRS-TM35FIN)
 *   content/site/fuel_machine.asc           the same with the stale stand data (M3)
 *   content/site/elevation.asc              25 m elevation grid, same extent
 *   content/site/site.json                  ignition point and file list for the fire model
 *   app/scenario/site-meta.json             map extent and WGS84 corners for the UI
 *
 * New layers since SPEC/33: `rock` (outcrop polygons; `rocky` is the same for the old renderer), `field_parcels` (rectangles),
 * `ditches` with `ditchKinds` (mire / collector / main / forest / field), `culverts`, auxiliary contours (`aux: true`); each
 * contour carries its `level` (m). Gate R: `mireFill` (every mire class and the paludified fringe as one traced union, the fill the
 * map draws), area outlines smoothed off the raster (carto.ts), contours traced with flat-ground brook trenches closed over.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { traceMaskMetres, type GridFrame } from "../fire-ca/geometry.js";
import { tm35ToWgs84 } from "../fire-ca/tm35.js";
import { FUEL_CLASSES } from "../fire-ca/template-site.js";
import {
  BROOKS, distToPolyline, elevation, HALF_M, IGN_TM35, inWater, isWetMire, PALUDIFIED, lakeAt, landCover, LC_DRAINED_BOG, LC_FIELD,
  LC_FOREST, LC_OPEN_BOG, LC_PINE_BOG, LC_WATER, POWER_LINE, RIVER, riverDist, ROCK, runsOutsideLakes, sampleGrid, segmentHit, standAt,
  SLOPE, type P,
} from "./terrain.js";
import { BRIDGES, COMMAND_POINT, ROADS, UNBRIDGED_CROSSINGS } from "./roads.js";
import { PARCELS, parcelRing } from "./fields.js";
import { DITCHES } from "./ditches.js";
import { FEATURES } from "../fire-ca/deployment.js";
import { BARE_ENDS_NEAR_IGN, BUILDINGS, englishLabel, namedLabels, NO_NEW_BUILDINGS_M, ROAD_END_STATS, VALLEY_FLOOR_M } from "./places.js";
import { keepFlatAux, traceContours } from "./contours.js";
import { contourSurface, smoothRing, stampLines } from "./carto.js";

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
  for (let c = 0; c < N; c++) {
    const i = r * N + c;
    const x = cellX(c);
    const y = cellY(r);
    elev[i] = elevation(x, y);
    lc[i] = landCover(x, y);
    if (lc[i] === LC_WATER) water[i] = 1;
  }
}
// The river as water along its line (±8 m), so its banks are exact.
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
      if (c >= 0 && r >= 0 && c < N && r < N) { water[r * N + c] = 1; lc[r * N + c] = LC_WATER; }
    }
  }
}

// Cosmetic layers (not fuel classes): bedrock outcrops, paludified fringe ("soistuma"), difficult-to-traverse mire.
const rock = new Uint8Array(N * N);
const paludified = new Uint8Array(N * N);
const wetMire = new Uint8Array(N * N);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  const i = r * N + c;
  const x = cellX(c);
  const y = cellY(r);
  if (lc[i] === LC_FOREST) {
    if (sampleGrid(ROCK, x, y) > 0.5) rock[i] = 1;
    else if (sampleGrid(PALUDIFIED, x, y) > 0.5) paludified[i] = 1; // bilinear: the 20 m grid's steps cut diagonally
  } else if ((lc[i] === LC_OPEN_BOG || lc[i] === LC_PINE_BOG) && isWetMire(x, y)) wetMire[i] = 1;
}

// Downsampled elevation for render.py's hillshade: every 5th 10 m cell → 50 m spacing, 400 × 400.
const ELEV_DOWNSAMPLE = 5;
const elevGridSize = Math.floor(N / ELEV_DOWNSAMPLE);
const elevGrid: number[] = [];
for (let r = 0; r < elevGridSize; r++) for (let c = 0; c < elevGridSize; c++) elevGrid.push(Math.round(elev[r * ELEV_DOWNSAMPLE * N + c * ELEV_DOWNSAMPLE]! * 10) / 10);

const maskEq = (cls: number) => {
  const m = new Uint8Array(N * N);
  for (let i = 0; i < m.length; i++) m[i] = lc[i] === cls ? 1 : 0;
  return m;
};

// MML "vaikeakulkuinen suo": horizontal blue lines over the mire fill, 30 m apart.
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

console.log("contours …");
const levels: number[] = [];
for (let l = 40; l <= 200; l += 2.5) levels.push(l);
const flatPx = (px: [number, number]) => {
  const x = px[0] * MAP_M_PER_PX - HALF_M;
  const y = HALF_M - px[1] * MAP_M_PER_PX;
  return sampleGrid(SLOPE, x, y) < 0.018;
};
// Traced on the DEM with the brooks' trenches closed over in flat ground (carto.ts): a brook in a mire draws no canal.
const streamDist = stampLines([RIVER, ...BROOKS.map((b) => b.line)], N, GRID_M, -HALF_M, 70);
const contourElev = contourSurface(elev, water, N, GRID_M, streamDist);
const contours = keepFlatAux(traceContours(contourElev, water, N, cellX, cellY, toPx, levels, (l) => l % 5 !== 0), flatPx);

console.log("land-cover polygons …");
const frame10: GridFrame = { origin: { lat: 0, lon: 0 }, cols: N, rows: N, cellSizeM: GRID_M };
const polysFromMask = (mask: Uint8Array, minAreaCells: number, tolCells = 0.9) =>
  traceMaskMetres(frame10, mask, tolCells, minAreaCells).map((ring) => smoothRing(ring.map((p) => toPx(p.x - HALF_M, p.y - HALF_M))));
const polys = (cls: number, minAreaCells: number) => polysFromMask(maskEq(cls), minAreaCells);
// Lake polygons only: the river is drawn from its centreline.
const lakeMask = new Uint8Array(N * N);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (lc[r * N + c] === LC_WATER && lakeAt(cellX(c), cellY(r))) lakeMask[r * N + c] = 1;
const waterPolys = polysFromMask(lakeMask, 30, 1.2);
// Islands: land enclosed by a lake (the traced rings carry no holes, so islands are drawn back on top).
const islandMask = new Uint8Array(N * N);
{
  const land = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) land[i] = lakeMask[i] ? 0 : 1;
  const seen = new Int32Array(N * N).fill(-1);
  for (let s = 0; s < N * N; s++) {
    if (!land[s] || seen[s]! >= 0) continue;
    const stack = [s];
    const members: number[] = [];
    let edge = false;
    seen[s] = s;
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      const r = Math.floor(i / N);
      const c = i % N;
      if (r === 0 || c === 0 || r === N - 1 || c === N - 1) edge = true;
      for (const j of [c > 0 ? i - 1 : -1, c + 1 < N ? i + 1 : -1, r > 0 ? i - N : -1, r + 1 < N ? i + N : -1]) if (j >= 0 && land[j] && seen[j]! < 0) { seen[j] = s; stack.push(j); }
    }
    if (!edge) for (const i of members) islandMask[i] = 1;
  }
}
const islandPolys = polysFromMask(islandMask, 4, 1.2);
/** Land enclosed by `mask` (components of its complement that do not reach the sheet edge). */
function enclosedBy(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(N * N);
  const seen = new Uint8Array(N * N);
  for (let s = 0; s < N * N; s++) {
    if (mask[s] || seen[s]) continue;
    const stack = [s];
    const members: number[] = [];
    let edge = false;
    seen[s] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      members.push(i);
      const r = Math.floor(i / N);
      const c = i % N;
      if (r === 0 || c === 0 || r === N - 1 || c === N - 1) edge = true;
      for (const j of [c > 0 ? i - 1 : -1, c + 1 < N ? i + 1 : -1, r > 0 ? i - N : -1, r + 1 < N ? i + N : -1]) if (j >= 0 && !mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    if (!edge) for (const i of members) out[i] = 1;
  }
  return out;
}
// The mire fill as drawn (every mire class and the paludified fringe share one colour, §9): traced once as a union, so no seam or
// notch shows where two classes meet; and the firm islands in it (the traced rings carry no holes; drawn back on top as land).
const mireMask = new Uint8Array(N * N);
for (let i = 0; i < N * N; i++) mireMask[i] = lc[i] === LC_OPEN_BOG || lc[i] === LC_PINE_BOG || lc[i] === LC_DRAINED_BOG || paludified[i] ? 1 : 0;
const mireFillPolys = polysFromMask(mireMask, 30);
const mireIslandPolys = polysFromMask(enclosedBy(mireMask), 4);
const fieldPolys = polys(LC_FIELD, 20);
const openBogPolys = polys(LC_OPEN_BOG, 30);
const pineBogPolys = polys(LC_PINE_BOG, 30);
const drainedBogPolys = polys(LC_DRAINED_BOG, 30);
const rockPolys = polysFromMask(rock, 25);
const paludifiedPolys = polysFromMask(paludified, 60);

// Spot heights: the highest point of each 400 m block, the 45 highest at least 1.3 km apart; never on or beside (30 m) a road, the
// power line, a stream or a ditch, so neither the dot nor its figure sits on a line.
const lineDist = stampLines([...ROADS.map((r) => r.line), POWER_LINE, RIVER, ...BROOKS.map((b) => b.line), ...DITCHES.map((d) => d.line)], N, GRID_M, -HALF_M, 30);
const heights: { x: number; y: number; h: number }[] = [];
{
  const block = 40;
  const cand: { c: number; r: number; h: number }[] = [];
  for (let br = 0; br < N; br += block) for (let bc = 0; bc < N; bc += block) {
    let best = -Infinity;
    let at = -1;
    for (let r = br; r < Math.min(N, br + block); r++) for (let c = bc; c < Math.min(N, bc + block); c++) {
      const i = r * N + c;
      if (!water[i] && lineDist[i]! > 30 && elev[i]! > best) { best = elev[i]!; at = i; }
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

// Culverts: every road crossing of a brook or a main / collector ditch (bridges carry the river).
const culverts: P[] = [];
{
  const B = 200;
  const buckets = new Map<string, [P, P][]>();
  const waterLines = [...BROOKS.map((b) => b.line), ...DITCHES.filter((d) => d.kind === "main" || d.kind === "collector").map((d) => d.line)];
  for (const l of waterLines) for (let k = 0; k + 1 < l.length; k++) {
    const a = l[k]!;
    const b = l[k + 1]!;
    for (let bx = Math.floor(Math.min(a.x, b.x) / B); bx <= Math.floor(Math.max(a.x, b.x) / B); bx++) for (let by = Math.floor(Math.min(a.y, b.y) / B); by <= Math.floor(Math.max(a.y, b.y) / B); by++) {
      const key = `${bx},${by}`;
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push([a, b]);
    }
  }
  for (const r of ROADS) for (let k = 0; k + 1 < r.line.length; k++) {
    const a = r.line[k]!;
    const b = r.line[k + 1]!;
    for (let bx = Math.floor(Math.min(a.x, b.x) / B); bx <= Math.floor(Math.max(a.x, b.x) / B); bx++) for (let by = Math.floor(Math.min(a.y, b.y) / B); by <= Math.floor(Math.max(a.y, b.y) / B); by++) {
      for (const [c, d] of buckets.get(`${bx},${by}`) ?? []) {
        const h = segmentHit(a, b, c, d);
        if (h && !culverts.some((q) => Math.hypot(q.x - h.x, q.y - h.y) < 25) && riverDist(h.x, h.y, 30) > 25) culverts.push(h);
      }
    }
  }
}

// Labels.
const labels = namedLabels().map((l) => ({ text: l.text, px: toPx(l.x, l.y), style: l.style }));
for (const h of heights) labels.push({ text: h.h.toFixed(1).replace(".", ","), px: toPx(h.x, h.y), style: "height" as const });
const labelsEn = namedLabels().map((l) => ({ text: englishLabel(l.text), px: toPx(l.x, l.y), style: l.style }));
for (const h of heights) labelsEn.push({ text: h.h.toFixed(1), px: toPx(h.x, h.y), style: "height" as const });

// Revision (al), 10 Oct 2026 (map review panel): tiles only, not in the fire grids — the farm pond at W2 (Lahdenkylän lampi), the
// log landing at the R2 / Honkaharju forest-road junction (EK16's safety zone), and the 110 kV line's 36 m cleared corridor.
const CORRIDOR_M = 36;
const W2_POND = { cx: FEATURES.POND_W2.x, cy: FEATURES.POND_W2.y + 40, rx: 38, ry: 32 };
const w2PondRing = Array.from({ length: 28 }, (_, k) => {
  const t = (2 * Math.PI * k) / 28;
  const wobble = 1 + 0.06 * Math.sin(3 * t + 0.7) + 0.04 * Math.cos(5 * t);
  return toPx(W2_POND.cx + Math.cos(t) * W2_POND.rx * wobble, W2_POND.cy + Math.sin(t) * W2_POND.ry * wobble);
});
const LANDING = { x0: FEATURES.R2_FR.x + 4, x1: FEATURES.R2_FR.x + 64, y0: FEATURES.R2_FR.y - 58, y1: FEATURES.R2_FR.y - 18 };
const landingRing = [toPx(LANDING.x0, LANDING.y1), toPx(LANDING.x1, LANDING.y1), toPx(LANDING.x1, LANDING.y0), toPx(LANDING.x0, LANDING.y0)];

const ditchesOut = DITCHES.map((d) => lineToPx(d.line));
const features = {
  size: MAP_PX,
  metresPerPixel: MAP_M_PER_PX,
  elevationGrid: { size: elevGridSize, values: elevGrid },
  water: waterPolys,
  islands: islandPolys,
  fields: fieldPolys,
  field_parcels: PARCELS.map((p) => parcelRing(p).map((q) => toPx(q.x, q.y))),
  openBogs: openBogPolys,
  pineBogs: pineBogPolys,
  drainedBogs: drainedBogPolys,
  mireFill: mireFillPolys,
  mireIslands: mireIslandPolys,
  rock: rockPolys,
  rocky: rockPolys,
  paludified: paludifiedPolys,
  mireLines,
  ditches: ditchesOut,
  ditchKinds: DITCHES.map((d) => d.kind),
  contours: contours.map((c) => ({ level: c.level, index: c.index, ...(c.aux ? { aux: true } : {}), pts: c.pts })),
  river: runsOutsideLakes(RIVER).map(lineToPx),
  brooks: BROOKS.flatMap((b) => runsOutsideLakes(b.line).map(lineToPx)),
  roads: ROADS.map((r) => ({ cls: r.cls, ...(r.id ? { id: r.id } : {}), pts: lineToPx(r.line) })),
  powerLine: lineToPx(POWER_LINE),
  powerCorridorPx: CORRIDOR_M / MAP_M_PER_PX,
  ponds: [w2PondRing],
  clearings: [landingRing],
  bridges: BRIDGES.map((b) => toPx(b.x, b.y)),
  culverts: culverts.map((b) => toPx(b.x, b.y)),
  buildings: BUILDINGS.map((b) => ({ px: toPx(b.x, b.y), size: b.size / MAP_M_PER_PX, kind: b.kind })),
  labels,
  labelsEn,
};
mkdirSync("content/site/build", { recursive: true });
writeFileSync("content/site/build/topo-features.json", JSON.stringify(features));
{
  const km = (cls: string) => Math.round(ROADS.filter((r) => r.cls === cls).reduce((s, r) => s + r.line.reduce((t, p, k) => (k ? t + Math.hypot(p.x - r.line[k - 1]!.x, p.y - r.line[k - 1]!.y) : 0), 0), 0) / 1000);
  const share = (cls: number) => ((100 * lc.reduce((n, v) => n + (v === cls ? 1 : 0), 0)) / lc.length).toFixed(1);
  const pct = (m: Uint8Array) => ((100 * m.reduce((n, v) => n + v, 0)) / m.length).toFixed(1);
  const s = ROAD_END_STATS;
  console.log(`  ${contours.length} contour lines (${contours.filter((c) => c.aux).length} auxiliary), ${waterPolys.length} water, ${PARCELS.length} field parcels, ${openBogPolys.length + pineBogPolys.length + drainedBogPolys.length} mire polygons, ${DITCHES.length} ditches, ${ROADS.length} roads, ${BUILDINGS.length} buildings, ${culverts.length} culverts`);
  console.log(`  road km: main ${km("main")}, gravel ${km("gravel")}, forest ${km("forest")}, track ${km("track")}, path ${km("path")}`);
  console.log(`  dead ends ${s.deadEnds} (inside ${NO_NEW_BUILDINGS_M / 1000} km, left bare: ${s.insideNoBuildZone}); with building ${s.withBuilding}; shore cottages ${s.lakeCottages}; buildings within ${NO_NEW_BUILDINGS_M / 1000} km of IGN: ${BUILDINGS.filter((b) => Math.hypot(b.x, b.y) < NO_NEW_BUILDINGS_M).length}`);
  console.log(`  river: ${BRIDGES.length} bridges (${BRIDGES.map((b) => `(${Math.round(b.x)},${Math.round(b.y)})`).join(" ")}); unbridged road crossings: ${UNBRIDGED_CROSSINGS.length ? UNBRIDGED_CROSSINGS.map((c) => `${c.cls}@(${Math.round(c.at.x)},${Math.round(c.at.y)})`).join(" ") : "none"}; buildings within ${VALLEY_FLOOR_M} m of the river: ${BUILDINGS.filter((b) => riverDist(b.x, b.y, VALLEY_FLOOR_M) < VALLEY_FLOOR_M).length}`);
  console.log(`  bare dead ends near IGN: ${BARE_ENDS_NEAR_IGN.length}`);
  console.log(`  land cover (whole map): open bog ${share(LC_OPEN_BOG)}%, pine bog ${share(LC_PINE_BOG)}%, drained bog ${share(LC_DRAINED_BOG)}%, field ${share(LC_FIELD)}%, water ${share(LC_WATER)}%; cosmetic: rock ${pct(rock)}%, soistuma ${pct(paludified)}%, difficult mire ${pct(wetMire)}%`);
}

// ---------------------------------------------------------------------------
// Fire-model grids: 25 m, central 10 km.
// ---------------------------------------------------------------------------

console.log("fuel and elevation grids (25 m) …");
const CA_HALF = 5000;
const CA_M = 25;
const CN = (2 * CA_HALF) / CA_M; // 400
const fuelIndex = (id: string) => {
  const k = FUEL_CLASSES.findIndex((f) => f.id === id);
  if (k < 0) throw new Error(`build: unknown fuel ${id}`);
  return k;
};
const truth = new Int32Array(CN * CN);
const machine = new Int32Array(CN * CN);
const caElev = new Float32Array(CN * CN);
// Linear breaks in the fuel grid (SPEC/24 §12): 1 = gravel/main road, 2 = forest road, 3 = brook. Tracks and paths stay out.
const roadCells = new Uint8Array(CN * CN);
const rasterLine = (line: readonly P[], code: number) => {
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
  caElev[i] = elev[gi]!;
  const cover = lc[gi]!;
  let t: string;
  let m: string | null = null;
  if (cover === LC_WATER || inWater(x, y)) t = "water";
  else if (builtCells[i]) t = "built";
  else if (roadCells[i]) t = (["road_gravel", "road_forest", "brook"] as const)[roadCells[i]! - 1]!;
  else if (cover === LC_FIELD) t = "field";
  else if (cover === LC_OPEN_BOG) t = "open_bog";
  else if (cover === LC_DRAINED_BOG || cover === LC_PINE_BOG) t = "drained_peat";
  else if (distToPolyline(x, y, POWER_LINE) < 18) t = "cleared_corridor";
  else { const s = standAt(x, y); t = s.truth; m = s.machine; }
  truth[i] = fuelIndex(t);
  machine[i] = fuelIndex(m ?? t);
}
const asc = (values: ArrayLike<number>, decimals: number) => {
  const lines = [`ncols ${CN}`, `nrows ${CN}`, `xllcorner ${IGN_TM35.eastM - CA_HALF}`, `yllcorner ${IGN_TM35.northM - CA_HALF}`, `cellsize ${CA_M}`, "NODATA_value -9999"];
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
{
  const counts = new Map<string, number>();
  for (const v of truth) counts.set(FUEL_CLASSES[v]!.id, (counts.get(FUEL_CLASSES[v]!.id) ?? 0) + 1);
  console.log(`  fuel (central 10 km): ${[...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k} ${((100 * n) / truth.length).toFixed(1)}%`).join(", ")}`);
}
writeFileSync("content/site/site.json", JSON.stringify({
  name: "Generated site (fictional terrain, SPEC/23 §11, SPEC/33)",
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
  // The UI draws the basemap as TILES × TILES image sources (one 5000 px texture froze the browser, 24 Sep 2026).
  tiles: tileGrid(),
  ignitionWgs84: { lat: Math.round(ign.lat * 1e6) / 1e6, lon: Math.round(ign.lon * 1e6) / 1e6 },
}, null, 1) + "\n");
console.log("done. Next: python tools/topo-map/render.py");
