/**
 * The generated site's ground before hydrography (SPEC/23 §11, §13): noise, geometry, lakes,
 * settlement fields, mire weights and the uncarved elevation surface `baseElevation`. terrain.ts
 * traces Kotkanjoki and the brooks over this surface and carves their valleys into it; everything
 * else imports the finished terrain from terrain.ts, which re-exports this module.
 *
 * Coordinates are local metres: x east, y north, origin at the ignition point IGN. The map covers
 * ±10 km (the "Alue" zoom level, 20 km). Everything is deterministic: integer-hash value noise and
 * the project's seeded generator, no Math.random.
 */

import { Mulberry32 } from "../fire-ca/model.js";

export const HALF_M = 10_000;
/** IGN placed at a plausible ETRS-TM35FIN position inside the SPEC/03 §1.1 box. */
export const IGN_TM35 = { eastM: 519_000, northM: 6_746_000 } as const;
export const SEED = 0x2030_0723;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash2(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1) ^ SEED;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, salt);
  const b = hash2(ix + 1, iy, salt);
  const c = hash2(ix, iy + 1, salt);
  const d = hash2(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal value noise, roughly in [-1, 1]. */
export function fbm(x: number, y: number, octaves: number, salt: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(x * f, y * f, salt + o * 101) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export interface P { readonly x: number; readonly y: number }

export function polar(bearingDeg: number, d: number): P {
  const t = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(t) * d, y: Math.cos(t) * d };
}

export function bearingOf(x: number, y: number): number {
  const b = (Math.atan2(x, y) * 180) / Math.PI;
  return b < 0 ? b + 360 : b;
}

export function closestOnPolyline(x: number, y: number, line: readonly P[]): P {
  let best: P = line[0]!;
  let bd = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const p = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function distToPolyline(x: number, y: number, line: readonly P[]): number {
  const p = closestOnPolyline(x, y, line);
  return Math.hypot(x - p.x, y - p.y);
}

/** Densifies a polyline to `stepM` and displaces it sideways with noise, for natural-looking lines. */
export function meander(points: readonly P[], stepM: number, amplitudeM: number, wavelengthM: number, salt: number): P[] {
  const out: P[] = [];
  let s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / stepM));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const off = amplitudeM * fbm((s + t * len) / wavelengthM, 0.5, 2, salt);
      out.push({ x: a.x + (b.x - a.x) * t + nx * off, y: a.y + (b.y - a.y) * t + ny * off });
    }
    s += len;
  }
  out.push(points[points.length - 1]!);
  return out;
}

function inPolygon(x: number, y: number, pts: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** 0 outside, 1 well inside, linear over `edgeM` across a boundary at signed distance `inside` (m). */
export const softEdge = (inside: number, edgeM: number) => Math.max(0, Math.min(1, inside / edgeM + 0.5));

// ---------------------------------------------------------------------------
// Lakes
// ---------------------------------------------------------------------------

export interface Lake {
  readonly name: string; readonly cx: number; readonly cy: number; readonly r: number;
  /** Water level (m); 0 = set by terrain.ts (Kotkanjoki's level for lakes on its course, else 72). */
  readonly level: number;
  /** Large lake with bays, points and islands (see `bigLakeShore`) rather than a noisy disc. */
  readonly big?: boolean;
}

const LAKE_NAMES = ["Mustajärvi", "Pitkäjärvi", "Ahvenlampi", "Valkealampi", "Kaitajärvi", "Särkijärvi", "Pirttilampi", "Kivijärvi", "Ruokolampi", "Heinäjärvi", "Kuikkalampi", "Hauklampi"];

function buildLakes(): Lake[] {
  const lakeN = polar(320, 2500);
  const pond = polar(315, 1500);
  const lakes: Lake[] = [
    { name: "Karhujärvi", cx: lakeN.x, cy: lakeN.y, r: 420, level: 74 },
    { name: "Haukilampi", cx: pond.x, cy: pond.y, r: 150, level: 79 },
  ];
  const rng = new Mulberry32(SEED ^ 0x1a4e);
  let tries = 0;
  while (lakes.length < 2 + LAKE_NAMES.length && tries < 2000) {
    tries++;
    const cx = (rng.nextFloat() * 2 - 1) * (HALF_M - 800);
    const cy = (rng.nextFloat() * 2 - 1) * (HALF_M - 800);
    const r = 180 + rng.nextFloat() * 520;
    if (Math.hypot(cx, cy) < 4300 + r) continue; // keep the fire's ground forested (SPEC/23 H6)
    if (lakes.some((l) => Math.hypot(l.cx - cx, l.cy - cy) < l.r + r + 500)) continue;
    lakes.push({ name: LAKE_NAMES[lakes.length - 2]!, cx, cy, r, level: 0 });
  }
  // The district's big lake, in the SE corner (clear of every other lake, the main roads and the
  // river) and cut by the sheet edges, as large lakes are on real sheets. Appended after the random
  // lakes so their placement is unchanged.
  lakes.push({ name: "Iso-Hirvijärvi", cx: 8700, cy: -8700, r: 1500, level: 70, big: true });
  return lakes;
}

export const LAKES: readonly Lake[] = buildLakes();

/** Bounding half-width of a lake, in units of r. */
export const lakeReach = (l: Lake) => (l.big ? 1.75 : 1.4);

const BIG_LAKE_ISLANDS: readonly (readonly [number, number, number])[] = [[8950, -8250, 170], [8150, -9150, 90], [9450, -8900, 60]];

/** Signed distance (m) from a big lake's outer shoreline, negative inside; islands not included. */
export function bigLakeShore(l: Lake, x: number, y: number): number {
  const dx = x - l.cx;
  const dy = y - l.cy;
  const t = Math.atan2(dy, dx);
  const shore = l.r * (1 + 0.17 * Math.sin(3 * t + 0.7) + 0.1 * Math.sin(5 * t + 2.1) + 0.07 * Math.sin(9 * t + 0.3) +
    0.2 * fbm(x / 700, y / 700, 3, 931) + 0.06 * fbm(x / 160, y / 160, 2, 937));
  return Math.hypot(dx, dy) - shore;
}

/** 0 outside every island; > 0 inside one (1 at its centre). */
export function bigLakeIsland(x: number, y: number): number {
  let best = 0;
  for (const [ix, iy, ir] of BIG_LAKE_ISLANDS) {
    const k = 1 - Math.hypot(x - ix, y - iy) / (ir * (1 + 0.35 * fbm(x / 90, y / 90, 2, 941)));
    if (k > best) best = k;
  }
  return best;
}

export function inLake(l: Lake, x: number, y: number): boolean {
  if (l.big) return bigLakeShore(l, x, y) < 0 && bigLakeIsland(x, y) <= 0;
  const d = Math.hypot(x - l.cx, y - l.cy);
  return d < l.r * (1 + 0.32 * fbm(x / 260, y / 260, 3, 900 + Math.round(l.r)));
}

/** The lake containing (x, y), if any. */
export function lakeAt(x: number, y: number): Lake | undefined {
  return LAKES.find((l) => Math.abs(x - l.cx) < l.r * lakeReach(l) && Math.abs(y - l.cy) < l.r * lakeReach(l) && inLake(l, x, y));
}

// ---------------------------------------------------------------------------
// Settlement and fields
// ---------------------------------------------------------------------------

/** SPEC/18 §5 BOG-S: drained, ditched peatland 0.6–1.8 km S/SE. */
export function inBogS(x: number, y: number): boolean {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  const wobble = 140 * fbm(x / 400, y / 400, 2, 71);
  return d > 600 + wobble && d < 1800 + wobble && b > 135 && b < 200;
}

export const VILLAGE = polar(135, 3000);
export const VILLAGE_NAME = "Lahdenkylä";

/**
 * A clearing's field outline: a star-shaped polygon with straight edges, elongated along `rotDeg`.
 * Finnish fields are cleared parcels with straight edges against the forest, stretched along the
 * road or valley they follow, not round clearings.
 */
function fieldPolygon(cx: number, cy: number, r: number, rotDeg: number, aspect: number, seed: number): P[] {
  const rng = new Mulberry32(seed);
  const k = 6 + Math.floor(rng.nextFloat() * 4);
  const a = r * Math.sqrt(aspect);
  const b = r / Math.sqrt(aspect);
  const t = (rotDeg * Math.PI) / 180;
  const pts: P[] = [];
  for (let i = 0; i < k; i++) {
    const phi = (2 * Math.PI * (i + (rng.nextFloat() - 0.5) * 0.5)) / k;
    const rho = 0.8 + 0.4 * rng.nextFloat();
    const along = a * rho * Math.cos(phi);
    const across = b * rho * Math.sin(phi);
    pts.push({ x: cx + along * Math.sin(t) + across * Math.cos(t), y: cy + along * Math.cos(t) - across * Math.sin(t) });
  }
  return pts;
}

/** Lahdenkylä's fields: stretched along the Kotkanjoki valley (N–S), as the village lies by the river. */
const VILLAGE_FIELDS = fieldPolygon(VILLAGE.x, VILLAGE.y, 760, 170, 1.6, SEED ^ 0x7f10);

export function inVillageFields(x: number, y: number): boolean {
  return Math.abs(x - VILLAGE.x) < 1400 && Math.abs(y - VILLAGE.y) < 1400 && inPolygon(x, y, VILLAGE_FIELDS);
}

export interface Farm {
  readonly name: string; readonly x: number; readonly y: number; readonly r: number;
  /** A small field beside a road/hamlet, with no farmstead of its own (no buildings, road or label):
   * a road-aligned parcel (bearing `rot`°, r×1.4 by r×0.7). */
  readonly fieldOnly?: boolean;
  readonly rot?: number;
  /** A farmstead's field outline (see `fieldPolygon`); the yard (80 m) around the buildings stays unfielded. */
  readonly poly?: readonly P[];
}

function inFarm(f: Farm, x: number, y: number): boolean {
  if (f.poly) {
    const d = Math.hypot(x - f.x, y - f.y);
    return d > 80 && d < f.r * 2.2 && inPolygon(x, y, f.poly);
  }
  const t = ((f.rot ?? 0) * Math.PI) / 180;
  const along = (x - f.x) * Math.sin(t) + (y - f.y) * Math.cos(t);
  const across = (x - f.x) * Math.cos(t) - (y - f.y) * Math.sin(t);
  const edge = 1 + 0.06 * fbm(x / 60, y / 60, 2, 85);
  return Math.abs(along) < f.r * 1.4 * edge && Math.abs(across) < f.r * 0.7 * edge;
}

/** Hiekkala: a small roadside hamlet on the southern gravel road (see roads.ts). */
export const HAMLET_S: P = { x: -975, y: -6600 };
const FARM_NAMES = ["Rinne", "Mäkelä", "Niemelä", "Koivula", "Harju", "Peltola"];

function buildFarms(): Farm[] {
  const rng = new Mulberry32(SEED ^ 0x7a2b);
  const farms: Farm[] = [];
  let tries = 0;
  while (farms.length < FARM_NAMES.length && tries < 2000) {
    tries++;
    const x = (rng.nextFloat() * 2 - 1) * (HALF_M - 900);
    const y = (rng.nextFloat() * 2 - 1) * (HALF_M - 900);
    if (Math.hypot(x, y) < 5000) continue;
    if (LAKES.some((l) => Math.hypot(l.cx - x, l.cy - y) < l.r + 700)) continue;
    if (farms.some((f) => Math.hypot(f.x - x, f.y - y) < 2500)) continue;
    farms.push({ name: FARM_NAMES[farms.length]!, x, y, r: 260 + rng.nextFloat() * 260 });
  }
  // Field outlines from their own generator, so the farm placement sequence above is unchanged.
  const shaped = farms.map((f, i) => {
    const g = new Mulberry32(SEED ^ (0x7f20 + i));
    return { ...f, poly: fieldPolygon(f.x, f.y, f.r, g.nextFloat() * 180, 1.5 + 0.7 * g.nextFloat(), SEED ^ (0x7f40 + i)) };
  });
  // Small roadside fields (3–6 ha): two either side of the road at Hiekkala, one on the maantie
  // east of Lahdenkylä — all beyond 4 km of IGN, outside the H6 screen radius.
  return [
    ...shaped,
    { name: "", x: HAMLET_S.x + 140, y: HAMLET_S.y + 130, r: 115, fieldOnly: true, rot: 137 },
    { name: "", x: HAMLET_S.x - 45, y: HAMLET_S.y - 245, r: 130, fieldOnly: true, rot: 137 },
    { name: "", x: 3750, y: -2420, r: 110, fieldOnly: true, rot: 80 },
  ];
}

export const FARMS: readonly Farm[] = buildFarms();

export function inFarmFields(x: number, y: number): boolean {
  return FARMS.some((f) => inFarm(f, x, y));
}

/** A farmstead's yard (the 80 m around its buildings): firm ground, never field or mire. */
export function inFarmYard(x: number, y: number): boolean {
  return FARMS.some((f) => f.poly !== undefined && Math.hypot(x - f.x, y - f.y) <= 80);
}

/** Cleared fields lie on flat clay lowland, not on bedrock knolls: 1 under fields, fading out beyond. */
function fieldWeight(x: number, y: number): number {
  let w = softEdge(1100 - Math.hypot(x - VILLAGE.x, y - VILLAGE.y), 500);
  for (const f of FARMS) w = Math.max(w, softEdge(f.r * (f.poly ? 1.7 : 1.3) + 250 - Math.hypot(x - f.x, y - f.y), 400));
  return w;
}

// ---------------------------------------------------------------------------
// Mires, knolls and the uncarved elevation surface
// ---------------------------------------------------------------------------

export const ESKER_CENTRE = polar(45, 1000);

function bogSWeight(x: number, y: number): number {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  const wobble = 140 * fbm(x / 400, y / 400, 2, 71);
  const angDeg = Math.max(-90, Math.min(90, Math.min(b - 135, 200 - b)));
  const angM = d * Math.sin((angDeg * Math.PI) / 180);
  return softEdge(Math.min(d - 600 - wobble, 1800 + wobble - d, angM), 160);
}

/** Signed distance (m, positive inside) into Iso-Rahkasuo's irregular outline. */
export function bogWInside(x: number, y: number): number {
  return 640 + 260 * fbm(x / 380, y / 380, 3, 511) - Math.hypot(x + 2400, (y + 300) * 1.25);
}

function bogWWeight(x: number, y: number): number {
  return softEdge(bogWInside(x, y), 200);
}

/**
 * Bedrock-knoll field. South-east Finland's forest terrain is hummocky bedrock ("kalliomäet")
 * 5–30 m high with a NW–SE fracture grain, peat filling the hollows between — the pattern L521's
 * dense, closed 5 m contours show. Positive = knoll, negative = lowland (where mires form).
 */
export function knollField(x: number, y: number): number {
  const u = (x - y) * Math.SQRT1_2;
  const v = (x + y) * Math.SQRT1_2;
  return fbm(u / 1250, v / 850, 5, 301);
}

/** Relief damping: the fire's own ground around IGN is glaciofluvial sand plain (Honkaharju,
 * Kuivakangas), so knolls stay low there and the esker remains the dominant landform. */
export function knollScale(x: number, y: number): number {
  const d = Math.hypot(x, y);
  return 0.3 + 0.7 * Math.max(0, Math.min(1, (d - 1600) / 1800));
}

/** Mire propensity: deep in a knoll-field hollow and/or in a wet noise patch. > 0.15 is peat. The
 * bar rises toward IGN (fewer, smaller mires on the fire's own ground, SPEC/23 H6) without a hard
 * edge, and mires never cover IGN itself or the designed NE ridge/spruce/birch stands (SPEC/18 §5). */
export function mireIndex(x: number, y: number): number {
  const d = Math.hypot(x, y);
  const b = bearingOf(x, y);
  if (d < 1300 || (d < 2700 && b > 10 && b < 85)) return -1;
  const bar = 0.22 * Math.max(0, Math.min(1, (3100 - d) / 1600));
  return -(knollField(x, y) + 0.02) + 0.55 * fbm(x / 900, y / 900, 3, 61) - bar;
}

/** Terrain without the river and brook valleys (terrain.ts carves those in). Lakes with level 0
 * read as 72 m here; terrain.ts sets the level of the lakes Kotkanjoki flows through. */
export function baseElevation(x: number, y: number): number {
  // Glacial grain: drumlins elongated NW–SE.
  const a = Math.PI / 4;
  const u = x * Math.cos(a) - y * Math.sin(a);
  const v = x * Math.sin(a) + y * Math.cos(a);
  const k = knollField(x, y);
  const bogFlat = Math.max(bogSWeight(x, y), bogWWeight(x, y), softEdge(mireIndex(x, y) - 0.12, 0.08));
  const fieldFlat = fieldWeight(x, y);
  const rough = 1 - 0.8 * Math.max(bogFlat, fieldFlat);
  let e = 84 + 13 * fbm(u / 5200, v / 2100, 4, 1) + 4.5 * rough * fbm(x / 650, y / 650, 3, 7);
  // RIDGE: an esker crossing the NE direction, 0.8–1.2 km from IGN.
  const sx = x - ESKER_CENTRE.x;
  const sy = y - ESKER_CENTRE.y;
  const along = sx * Math.SQRT1_2 - sy * Math.SQRT1_2;
  const across = sx * Math.SQRT1_2 + sy * Math.SQRT1_2 - 70 * Math.sin(along / 450);
  const taper = Math.max(0, 1 - Math.abs(along) / 2200);
  e += 17 * taper * Math.exp(-((across / 95) ** 2));
  // Knolls soft-capped at ~34 m: the region's local relief is 20–40 m (L521's contours), not hills.
  // Kept off the esker's flanks so it stays the dominant landform it is designed to be.
  const knoll = Math.max(0, k + 0.02);
  const knollH = 34 * Math.tanh((95 * knoll ** 1.35) / 34);
  const eskerClear = 1 - 0.9 * taper * Math.exp(-((across / 450) ** 2));
  e += eskerClear * knollScale(x, y) * (1 - fieldFlat) * (knollH + 5 * Math.min(1, knoll * 6) * fbm(x / 170, y / 170, 3, 305));
  // VALLEY-N.
  e -= 11 * Math.exp(-(((y - 1500) / 380) ** 2)) * Math.max(0, 1 - Math.abs(x) / 4200);
  // BOG-S and Iso-Rahkasuo are flat peat surfaces, blended in over a soft edge (no contour step).
  const ws = bogSWeight(x, y);
  if (ws > 0) e = e * (1 - 0.8 * ws) + 79.5 * 0.8 * ws;
  const ww = bogWWeight(x, y);
  if (ww > 0) e = e * (1 - 0.7 * ww) + 81 * 0.7 * ww;
  // Lakes: flat water surface, the shore sloping into it.
  for (const l of LAKES) {
    const d = Math.hypot(x - l.cx, y - l.cy);
    if (d > l.r * (l.big ? 2.2 : 1.6) + 300) continue;
    const level = l.level > 0 ? l.level : 72;
    if (l.big) {
      // A big lake sits in a broad basin: the land eases down to it over ~800 m; islands are low knolls.
      const s = bigLakeShore(l, x, y);
      const isle = bigLakeIsland(x, y);
      if (s < 0) return isle > 0 ? level + 1 + 7 * isle : level;
      e = level + 0.8 + (e - level - 0.8) * Math.min(1, s / 800) ** 0.7;
      continue;
    }
    if (inLake(l, x, y)) return level;
    e = Math.max(level + 0.8, e - 6 * Math.max(0, 1 - (d - l.r) / 300));
  }
  return e;
}
