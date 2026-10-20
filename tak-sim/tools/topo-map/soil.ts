/**
 * Mires and soil of the generated site (SPEC/33 §4 stage 3), on water.ts's final surface.
 *
 *   mires     where the topographic wetness index is high, the height above the nearest drainage is under ~1.5 m and the slope
 *             under 2 %, and in the base DEM's peat-filled hollows; smoothed into lobed outlines, specks dropped, small holes filled
 *             (after xarray-spatial `twi_d8` / `hand_d8`, SPEC/33 §8). Open bog in the wet centres, pine bog on the margins.
 *   drained   most southern-Finnish mires were ditched for forestry: each mire (or each 1 km block of a large one) is drained or not
 *             by a seeded draw; Rahkasuo is drained (SPEC/18 §5 BOG-S), Iso-Rahkasuo is not.
 *   soistuma  paludified forest fringing the mires; part of it carries forest ditching (ditches.ts).
 *   soil      sand on the eskers and their aprons, clay on the valley floors, peat in the mires, thin soil on bedrock outcrops, moraine
 *             elsewhere.
 *   rock      outcrops (avokallio) on the knoll tops.
 */

import {
  BASE, basinInside, bearingOf, blur, cellX, cellY, components, fbm, G, GN, hash2, ISO_RAHKASUO_BASIN, RAHKASUO_BASIN, sampleGrid, smoothstep,
} from "./terrain-base.js";
import { ACC, ELEV, FILLED, HOLLOW, LAKE_ID, ORDER, REC, STREAM_CELL } from "./water.js";
import { RIVER_DIST } from "./water-query.js";
import { hand, slopeTan, twi } from "./hydrology.js";

export const SOIL_MORAINE = 0;
export const SOIL_SAND = 1;
export const SOIL_CLAY = 2;
export const SOIL_PEAT = 3;
export const SOIL_ROCK = 4;
export const SOIL_WATER = 5;

export const MIRE_NONE = 0;
export const MIRE_OPEN = 1;
export const MIRE_PINE = 2;
export const MIRE_DRAINED = 3;

/** Planning thresholds (SPEC/33 §2.3, §8): the domain reviewer confirms them. */
export const MIRE_RULE = { handM: 1.5, slope: 0.02, twi: 9.4, hollowM: 0.3 } as const;

export const SLOPE: Float32Array = slopeTan(ELEV, GN, G);
export const TWI: Float32Array = twi(ACC, SLOPE, G);
export const HAND: Float32Array = hand(FILLED, REC, ORDER, ACC, 250);

/** The designed fire ground (SPEC/18 §5, SPEC/23 §13): IGN and the NE ridge / spruce / birch sector stay forest. */
export function designedForest(x: number, y: number): boolean {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  return d < 1300 || (d < 2700 && b > 10 && b < 85);
}

/** Cells (20 m) inside a basin's outline by more than `insideM` (evaluated in the basin's bounding box only). */
function basinMask(b: typeof RAHKASUO_BASIN, insideM: number): Uint8Array {
  const out = new Uint8Array(GN * GN);
  const reach = Math.max(b.a, b.b) * 2.2;
  const c0 = Math.max(0, Math.floor((b.cx - reach + 10_000) / G));
  const c1 = Math.min(GN - 1, Math.floor((b.cx + reach + 10_000) / G));
  const r0 = Math.max(0, Math.floor((b.cy - reach + 10_000) / G));
  const r1 = Math.min(GN - 1, Math.floor((b.cy + reach + 10_000) / G));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (basinInside(b, cellX(c), cellY(r)) < insideM) out[r * GN + c] = 1;
  return out;
}
const RAHKA_CORE = basinMask(RAHKASUO_BASIN, -40);
const ISO_CORE = basinMask(ISO_RAHKASUO_BASIN, -40);
const RAHKA_NEAR = basinMask(RAHKASUO_BASIN, 150);
const ISO_NEAR = basinMask(ISO_RAHKASUO_BASIN, 150);

/** Cells over the area of their convex hull (cell centres, each cell counted as a unit square): 1 for a filled convex shape. */
function cellConvexity(cells: readonly number[]): number {
  if (cells.length < 3) return 1;
  const pts = cells.map((i) => [i % GN, Math.floor(i / GN)] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lo: (readonly number[])[] = [];
  const up: (readonly number[])[] = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop(); lo.push(p); }
  for (let k = pts.length - 1; k >= 0; k--) { const p = pts[k]!; while (up.length >= 2 && cross(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop(); up.push(p); }
  const hull = [...lo.slice(0, -1), ...up.slice(0, -1)];
  let a = 0;
  for (let k = 0; k < hull.length; k++) { const p = hull[k]!; const q = hull[(k + 1) % hull.length]!; a += p[0]! * q[1]! - q[0]! * p[1]!; }
  // The hull of cell centres misses half a cell all round: add it back (perimeter / 2 + 1).
  let per = 0;
  for (let k = 0; k < hull.length; k++) { const p = hull[k]!; const q = hull[(k + 1) % hull.length]!; per += Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!); }
  return cells.length / (Math.abs(a) / 2 + per / 2 + 1);
}

function buildMires(): { kind: Uint8Array; soft: Float32Array; drained: Uint8Array } {
  const raw = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (LAKE_ID[i]! >= 0) continue;
    const x = cellX(i % GN);
    const y = cellY(Math.floor(i / GN));
    if (designedForest(x, y)) continue;
    const sand = BASE.sand[i]!;
    const wet = HAND[i]! < MIRE_RULE.handM && SLOPE[i]! < MIRE_RULE.slope && TWI[i]! > MIRE_RULE.twi;
    const hollow = HOLLOW[i]! > MIRE_RULE.hollowM;
    // Sand drains: on an esker or its apron only a deep kettle hollow turns to bog. Kotkanjoki's clay floor was cleared for fields
    // and meadows long ago: no mire on it.
    if (sand > 0.5 && HOLLOW[i]! < 1.5) continue;
    if (BASE.valleyFloor[i]! > 0.4 && RIVER_DIST[i]! < 1000) continue;
    if (wet || hollow) raw[i] = 1;
  }
  for (let i = 0; i < GN * GN; i++) if (LAKE_ID[i]! < 0 && (RAHKA_CORE[i] || ISO_CORE[i])) raw[i] = 1;
  // Lobed outlines: a blur and threshold removes the raster speckle; then specks < 3 ha go and holes < 2 ha are filled. The
  // blurred field is read through a domain warp (typically ±35 m, up to 100 m, ~180 m wavelength) and the threshold wanders a little, so the
  // blur does not round a small mire into an oval: its edge pushes out into the forest in lobes and draws back in bays, as peat
  // spreads along the hollows.
  const soft = blur(raw, 3, 2);
  const mask = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    const x = cellX(i % GN);
    const y = cellY(Math.floor(i / GN));
    const wx = 100 * fbm(x / 180, y / 180, 2, 4423);
    const wy = 100 * fbm(x / 180, y / 180, 2, 4425);
    const lobe = 0.2 * fbm(x / 200, y / 200, 3, 4421);
    mask[i] = sampleGrid(soft, x + wx, y + wy) > 0.5 + lobe && LAKE_ID[i]! < 0 ? 1 : 0;
  }
  const comp = components(mask);
  for (let i = 0; i < GN * GN; i++) if (mask[i] && comp.sizes[comp.label[i]!]! < 125) mask[i] = 0;
  const inv = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) inv[i] = mask[i] || LAKE_ID[i]! >= 0 ? 0 : 1;
  const holes = components(inv);
  for (let i = 0; i < GN * GN; i++) if (inv[i] && holes.sizes[holes.label[i]!]! < 50) mask[i] = 1;
  for (let i = 0; i < GN * GN; i++) if (designedForest(cellX(i % GN), cellY(Math.floor(i / GN)))) mask[i] = 0;
  // Distance (cells) into the mire from its edge, by a two-pass chamfer transform.
  const inner = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) inner[i] = mask[i] ? 1e9 : 0;
  for (let r = 0; r < GN; r++) for (let c = 0; c < GN; c++) {
    const i = r * GN + c;
    if (!mask[i]) continue;
    if (c > 0) inner[i] = Math.min(inner[i]!, inner[i - 1]! + 1);
    if (r > 0) inner[i] = Math.min(inner[i]!, inner[i - GN]! + 1);
    if (r > 0 && c > 0) inner[i] = Math.min(inner[i]!, inner[i - GN - 1]! + 1.414);
    if (r > 0 && c + 1 < GN) inner[i] = Math.min(inner[i]!, inner[i - GN + 1]! + 1.414);
  }
  for (let r = GN - 1; r >= 0; r--) for (let c = GN - 1; c >= 0; c--) {
    const i = r * GN + c;
    if (!mask[i]) continue;
    if (c + 1 < GN) inner[i] = Math.min(inner[i]!, inner[i + 1]! + 1);
    if (r + 1 < GN) inner[i] = Math.min(inner[i]!, inner[i + GN]! + 1);
    if (r + 1 < GN && c + 1 < GN) inner[i] = Math.min(inner[i]!, inner[i + GN + 1]! + 1.414);
    if (r + 1 < GN && c > 0) inner[i] = Math.min(inner[i]!, inner[i + GN - 1]! + 1.414);
  }
  // Bays: a mire of 6–60 ha that is still an oval (a peat-filled kettle hollow is round; its mire is not) gets firm ground reaching
  // into its margin (within ~70 m of its edge) where a ~130 m noise is high, more each round until it is lobed (cell convexity
  // ≤ 0.88). The designed Rahkasuo and Iso-Rahkasuo keep their edges.
  {
    const mc0 = components(mask);
    const cellsOf: number[][] = mc0.sizes.map(() => []);
    for (let i = 0; i < GN * GN; i++) if (mask[i] && mc0.sizes[mc0.label[i]!]! >= 150 && mc0.sizes[mc0.label[i]!]! <= 1500) cellsOf[mc0.label[i]!]!.push(i);
    for (const cells of cellsOf) {
      if (cells.length === 0 || cells.some((i) => RAHKA_NEAR[i] || ISO_NEAR[i])) continue;
      for (const cut of [0.25, 0.05, -0.15, -0.35]) {
        if (cellConvexity(cells.filter((i) => mask[i])) <= 0.88) break;
        for (const i of cells) {
          if (inner[i]! > 3.5) continue;
          if (fbm(cellX(i % GN) / 130, cellY(Math.floor(i / GN)) / 130, 2, 4427) > cut + inner[i]! * 0.06) mask[i] = 0;
        }
      }
    }
  }
  // Drained or not: per mire, or per 1 km block of a mire larger than 4 km².
  const mc = components(mask);
  const drained = new Uint8Array(GN * GN);
  const rahka = (i: number) => RAHKA_NEAR[i] === 1;
  const iso = (i: number) => ISO_NEAR[i] === 1;
  for (let i = 0; i < GN * GN; i++) {
    if (!mask[i]) continue;
    const id = mc.label[i]!;
    const big = mc.sizes[id]! > 10_000;
    const key = big ? hash2(Math.floor((i % GN) / 50), Math.floor(i / GN / 50), 4401) : hash2(id, 0, 4403);
    let d = key < 0.62;
    if (rahka(i)) d = true;
    if (iso(i)) d = false;
    drained[i] = d ? 1 : 0;
  }
  const kind = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (!mask[i]) continue;
    if (drained[i]) { kind[i] = MIRE_DRAINED; continue; }
    // Open bog where it is wettest and away from the margin; pine bog on the margins and the drier parts.
    const wetness = TWI[i]! - MIRE_RULE.twi + HOLLOW[i]! * 1.5 + inner[i]! * 0.06;
    kind[i] = wetness > 2.2 || (iso(i) && inner[i]! > 4) ? MIRE_OPEN : MIRE_PINE;
  }
  return { kind, soft: blur(mask, 1, 1), drained };
}

const M = buildMires();
/** Mire class per 20 m cell (MIRE_*). */
export const MIRE: Uint8Array = M.kind;
/** Smoothed mire mask (0–1), for smooth outlines at 10 m: a point is on mire where it exceeds 0.5. */
export const MIRE_SOFT: Float32Array = M.soft;

/** Paludified forest ("soistuma"): wet, flat ground fringing the mires. */
export const PALUDIFIED: Uint8Array = (() => {
  const out = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (MIRE[i] || LAKE_ID[i]! >= 0 || BASE.sand[i]! > 0.5) continue;
    // Soistuma is cosmetic (not a fuel class): it may fringe the designed stands too, but not IGN's own sand or the river's clay.
    const x = cellX(i % GN);
    const y = cellY(Math.floor(i / GN));
    if (Math.hypot(x, y) < 900 || (BASE.valleyFloor[i]! > 0.4 && RIVER_DIST[i]! < 1000)) continue;
    if (HAND[i]! < 1.8 && SLOPE[i]! < 0.03 && TWI[i]! > MIRE_RULE.twi - 0.8) out[i] = 1;
  }
  const soft = blur(out, 2, 2);
  for (let i = 0; i < GN * GN; i++) out[i] = soft[i]! > 0.5 && !MIRE[i] && LAKE_ID[i]! < 0 ? 1 : 0;
  const comp = components(out);
  for (let i = 0; i < GN * GN; i++) if (out[i] && comp.sizes[comp.label[i]!]! < 40) out[i] = 0;
  return out;
})();

/** Bedrock outcrops: knoll tops and their steep upper sides, blobs ≥ 0.4 ha. */
export const ROCK: Uint8Array = (() => {
  const raw = new Float32Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (MIRE[i] || LAKE_ID[i]! >= 0 || STREAM_CELL[i]! >= 0) continue;
    const k = BASE.knoll[i]!;
    raw[i] = smoothstep(7, 15, k + 40 * Math.max(0, SLOPE[i]! - 0.05)) * (0.55 + 0.45 * hash2(i % GN >> 2, Math.floor(i / GN) >> 2, 4501));
  }
  const soft = blur(raw, 1, 1);
  const out = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) out[i] = soft[i]! > 0.45 ? 1 : 0;
  const comp = components(out);
  for (let i = 0; i < GN * GN; i++) if (out[i] && comp.sizes[comp.label[i]!]! < 10) out[i] = 0;
  return out;
})();

/** Soil class per 20 m cell (SOIL_*). */
export const SOIL: Uint8Array = (() => {
  const out = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) {
    if (LAKE_ID[i]! >= 0) out[i] = SOIL_WATER;
    else if (MIRE[i]) out[i] = SOIL_PEAT;
    else if (ROCK[i]) out[i] = SOIL_ROCK;
    else if (BASE.sand[i]! > 0.45) out[i] = SOIL_SAND;
    else if (BASE.valleyFloor[i]! > 0.45 && SLOPE[i]! < 0.04) out[i] = SOIL_CLAY;
    else out[i] = SOIL_MORAINE;
  }
  return out;
})();

/** Mire class at a point, with the smoothed outline (MIRE_NONE off the mire). */
export function mireAt(x: number, y: number): number {
  if (sampleGrid(MIRE_SOFT, x, y) <= 0.5) return MIRE_NONE;
  const c = Math.max(0, Math.min(GN - 1, Math.floor((x + 10_000) / G)));
  const r = Math.max(0, Math.min(GN - 1, Math.floor((y + 10_000) / G)));
  const k = MIRE[r * GN + c]!;
  if (k) return k;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
    const cc = c + dc;
    const rr = r + dr;
    if (cc >= 0 && rr >= 0 && cc < GN && rr < GN && MIRE[rr * GN + cc]) return MIRE[rr * GN + cc]!;
  }
  return MIRE_NONE;
}

export const soilAt = (x: number, y: number) => SOIL[Math.max(0, Math.min(GN - 1, Math.floor((y + 10_000) / G))) * GN + Math.max(0, Math.min(GN - 1, Math.floor((x + 10_000) / G)))]!;
