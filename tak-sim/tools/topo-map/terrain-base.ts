/**
 * The generated site's ground before hydrography (SPEC/33 §4 stage 1): a south-east Finnish glacial landscape on the 20 m grid.
 *
 *   - a regional surface falling gently north, towards Kotkanjoki's broad clay valley and the big lake's basin (SE);
 *   - the grain of the ice flow (NNW–SSE, 150°): drumlinised moraine ridges, and bedrock-knoll fields ("kalliomäet") with a weaker
 *     grain, in regions of their own;
 *   - two eskers as long narrow sand ridges along the ice flow: Kuivakangas (NE of IGN) and Honkaharju (S of IGN, its crest
 *     carrying the forest road), each with a sand apron where the bedrock knolls are buried, and kettle hollows on their flanks;
 *   - the macro-valleys the streams follow (Kotkanjoki's, Korpilaakso's E–W valley, Koivuoja's shallow one), with floors that
 *     fall monotonically downstream and walls whose width varies (no parallel-contour canyon);
 *   - bowls for the named lakes and flat basins for the named mires; everything else (other lakes, mires) comes out of the
 *     hydrology (water.ts, soil.ts).
 *
 * Nothing here is radial about IGN: the fire's ground is distinct only because it is the esker system's sand.
 * Deterministic: integer-hash noise, fixed seed.
 */

import { Mulberry32 } from "../fire-ca/model.js";
import {
  chaikin, clamp01, fbm, G, GN, cellX, cellY, HALF_M, polar, resample, simplify, smoothstep, type P,
} from "./geom.js";

export * from "./geom.js";

// ---------------------------------------------------------------------------
// Named places (fixed by the scenario, SPEC/33 §3)
// ---------------------------------------------------------------------------

/** SPEC/18 §5 BRIDGE: the timber bridge where R3 crosses Kotkanjoki. The river is pinned through it. */
export const BRIDGE: P = { x: 3050, y: 390 };
export const ESKER_CENTRE = polar(45, 1000);
export const VILLAGE = polar(135, 3000);
export const VILLAGE_NAME = "Lahdenkylä";
/** Hiekkala: a small roadside hamlet on the southern gravel road. */
export const HAMLET_S: P = { x: -975, y: -6600 };
/** The ice-flow grain (bearing, degrees): drumlins and eskers run NNW–SSE. */
export const GRAIN_DEG = 150;

// ---------------------------------------------------------------------------
// Eskers
// ---------------------------------------------------------------------------

export interface Esker { readonly name: string; readonly crest: readonly P[]; readonly height: number; readonly halfWidth: number }

/** Kuivakangas: 2.6 km of esker through ESKER_CENTRE, and a lower fragment north-west of it that forms Karhujärvi's south-east
 * shore, where Mökkiranta's cottages stand on its sandy flank. */
const KUIVAKANGAS: Esker = {
  name: "Kuivakangas", height: 15, halfWidth: 85,
  crest: chaikin([{ x: -260, y: 1330 }, { x: 260, y: 1060 }, ESKER_CENTRE, { x: 1180, y: 300 }, { x: 1640, y: -120 }, { x: 2000, y: -420 }], 2),
};
const KUIVAKANGAS_N: Esker = {
  name: "Kuivakangas N", height: 9, halfWidth: 100,
  crest: chaikin([{ x: -2000, y: 1060 }, { x: -1600, y: 1300 }, { x: -1300, y: 1480 }, { x: -1060, y: 1690 }], 2),
};
/** Honkaharju: the esker south of IGN; its crest is where the forest road runs (FR_W, FR_MID, FR_E, R2_FR, SPEC/33 §3). */
export const HONKAHARJU_CREST: readonly P[] = chaikin([
  { x: -2050, y: 330 }, { x: -1250, y: 40 }, { x: -560, y: -230 }, { x: -60, y: -335 }, { x: 259, y: -385 }, { x: 720, y: -492 },
  { x: 1100, y: -640 }, { x: 1525, y: -846 }, { x: 1980, y: -1130 }, { x: 2420, y: -1500 },
], 2);
const HONKAHARJU: Esker = { name: "Honkaharju", height: 11, halfWidth: 80, crest: HONKAHARJU_CREST };
export const ESKERS: readonly Esker[] = [KUIVAKANGAS, KUIVAKANGAS_N, HONKAHARJU];

// ---------------------------------------------------------------------------
// Valleys
// ---------------------------------------------------------------------------

export interface Valley {
  readonly name: string;
  /** Centre line, downstream order. */
  readonly line: readonly P[];
  /** Floor elevation at the upstream and downstream ends (m); linear in arc length between. */
  readonly z0: number; readonly z1: number;
  readonly floorHalf: number; readonly wall: number;
}

/** Kotkanjoki's valley, south → north (the river flows north with the regional slope). */
export const RIVER_VALLEY: Valley = {
  name: "Kotkanjoki", z0: 84.5, z1: 70.5, floorHalf: 300, wall: 900,
  line: chaikin([
    { x: 4500, y: -10400 }, { x: 3300, y: -8900 }, { x: 4600, y: -7100 }, { x: 3100, y: -5400 }, { x: 4000, y: -3800 }, { x: 3000, y: -2500 },
    { x: 3650, y: -1200 }, { x: 3060, y: 390 }, { x: 2500, y: 1700 }, { x: 3500, y: 3300 }, { x: 2400, y: 4900 }, { x: 1700, y: 6500 },
    { x: 2900, y: 8100 }, { x: 2100, y: 10400 },
  ], 3),
};
/** Korpilaakso: Korpioja's valley from Karhujärvi to Kotkanjoki (VALLEY-N), winding between the knolls. */
export const KORPI_VALLEY: Valley = {
  name: "Korpilaakso", z0: 80.5, z1: 76.8, floorHalf: 130, wall: 420,
  line: chaikin([{ x: -1300, y: 1930 }, { x: -950, y: 1720 }, { x: -700, y: 1470 }, { x: -250, y: 1660 }, { x: 250, y: 1420 }, { x: 800, y: 1650 }, { x: 1350, y: 1390 }, { x: 1900, y: 1630 }, { x: 2350, y: 1400 }, { x: 2800, y: 1560 }], 3),
};
/** Koivuoja's shallow valley, NW → SE along the grain into Korpioja. */
export const KOIVU_VALLEY: Valley = {
  name: "Koivuoja", z0: 84, z1: 78.2, floorHalf: 50, wall: 280,
  line: chaikin([{ x: 480, y: 2800 }, { x: 900, y: 2520 }, { x: 1050, y: 2150 }, { x: 1450, y: 1900 }, { x: 1620, y: 1640 }, { x: 1940, y: 1580 }], 3),
};
export const VALLEYS: readonly Valley[] = [RIVER_VALLEY, KORPI_VALLEY, KOIVU_VALLEY];

// ---------------------------------------------------------------------------
// Named lake bowls and mire basins
// ---------------------------------------------------------------------------

export interface Basin {
  readonly name: string;
  readonly cx: number; readonly cy: number;
  /** Semi-axes (m) along and across `rotDeg` (bearing of the long axis). */
  readonly a: number; readonly b: number; readonly rotDeg: number;
  /** Lake: the bowl's floor (m a.s.l.). Mire: how far (m) the basin is lowered below the ground around it before the peat fills
   * it flat (the flat's outline is then the natural contour at its spill level). */
  readonly floor: number;
  readonly kind: "lake" | "mire";
  readonly lobes: number;
}

/** Lobed, grain-elongated outline: signed distance (m, negative inside), approximately. */
export function basinInside(b: Basin, x: number, y: number): number {
  const t = (b.rotDeg * Math.PI) / 180;
  // Domain warp: the outline wanders by up to a fifth of the basin's width, so no side of it runs straight.
  const wx = 0.22 * Math.min(b.a, b.b) * fbm(x / 420, y / 420, 2, 651);
  const wy = 0.22 * Math.min(b.a, b.b) * fbm(x / 420, y / 420, 2, 653);
  const dx = x + wx - b.cx;
  const dy = y + wy - b.cy;
  const along = dx * Math.sin(t) + dy * Math.cos(t);
  const across = dx * Math.cos(t) - dy * Math.sin(t);
  const phi = Math.atan2(across / b.b, along / b.a);
  const rho = Math.hypot(along / b.a, across / b.b);
  const salt = Math.round(Math.abs(b.cx) + Math.abs(b.cy));
  const wob = 1 + b.lobes * (0.16 * Math.sin(3 * phi + (salt % 7)) + 0.1 * Math.sin(5 * phi + (salt % 5)) + 0.18 * fbm(x / 260, y / 260, 3, salt));
  return (rho - wob) * Math.min(b.a, b.b);
}

export const KARHUJARVI_BASIN: Basin = { name: "Karhujärvi", cx: -1920, cy: 2220, a: 650, b: 360, rotDeg: 148, floor: 72, kind: "lake", lobes: 1 };
export const HAUKILAMPI_BASIN: Basin = { name: "Haukilampi", cx: -1085, cy: 1085, a: 190, b: 120, rotDeg: 140, floor: 79, kind: "lake", lobes: 0.6 };
/** Iso-Hirvijärvi, the district's big lake, cut by the south and east sheet edges; its level is set, not spilled. */
export const BIG_LAKE = { name: "Iso-Hirvijärvi", cx: 8900, cy: -8800, r: 1750, level: 74 } as const;
export const RAHKASUO_BASIN: Basin = { name: "Rahkasuo", cx: 520, cy: -1250, a: 700, b: 450, rotDeg: 118, floor: 3, kind: "mire", lobes: 1.4 };
export const ISO_RAHKASUO_BASIN: Basin = { name: "Iso-Rahkasuo", cx: -2420, cy: -330, a: 820, b: 560, rotDeg: 152, floor: 3.5, kind: "mire", lobes: 1.4 };
export const BASINS: readonly Basin[] = [KARHUJARVI_BASIN, HAUKILAMPI_BASIN, RAHKASUO_BASIN, ISO_RAHKASUO_BASIN];

/** Signed distance (m) from the big lake's outer shore, negative inside, before the islands. */
export function bigLakeShore(x: number, y: number): number {
  const dx = x - BIG_LAKE.cx;
  const dy = y - BIG_LAKE.cy;
  const t = Math.atan2(dy, dx);
  const shore = BIG_LAKE.r * (1 + 0.2 * Math.sin(3 * t + 0.7) + 0.12 * Math.sin(5 * t + 2.1) + 0.08 * Math.sin(9 * t + 0.3) +
    0.22 * fbm(x / 700, y / 700, 3, 931) + 0.08 * fbm(x / 160, y / 160, 2, 937));
  return Math.hypot(dx, dy) - shore;
}
const BIG_LAKE_ISLANDS: readonly (readonly [number, number, number])[] = [[9100, -8300, 190], [8250, -9250, 110], [9650, -9000, 80], [7900, -8150, 70]];
/** 0 outside every island; > 0 inside one (1 at its centre). */
export function bigLakeIsland(x: number, y: number): number {
  let best = 0;
  for (const [ix, iy, ir] of BIG_LAKE_ISLANDS) {
    const k = 1 - Math.hypot(x - ix, y - iy) / (ir * (1 + 0.35 * fbm(x / 90, y / 90, 2, 941)));
    if (k > best) best = k;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Distance fields on the grid
// ---------------------------------------------------------------------------

export interface LineField { readonly d: Float32Array; readonly s: Float32Array }

/** Distance (m) to `line` and arc length at the nearest point, for cells within `radiusM` (∞ beyond). */
export function lineField(lineIn: readonly P[], radiusM: number): LineField {
  const d = new Float32Array(GN * GN).fill(Infinity);
  const s = new Float32Array(GN * GN);
  // Nearly collinear vertices (a smoothed or resampled line) add work, not shape: drop those within 0.5 m.
  const line = simplify(lineIn, 0.5);
  let arc = 0;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - radiusM + HALF_M) / G));
    const c1 = Math.min(GN - 1, Math.floor((Math.max(a.x, b.x) + radiusM + HALF_M) / G));
    const r0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - radiusM + HALF_M) / G));
    const r1 = Math.min(GN - 1, Math.floor((Math.max(a.y, b.y) + radiusM + HALF_M) / G));
    for (let r = r0; r <= r1; r++) {
      const y = cellY(r);
      for (let c = c0; c <= c1; c++) {
        const x = cellX(c);
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
        const dd = Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
        const i = r * GN + c;
        if (dd < d[i]! && dd <= radiusM) { d[i] = dd; s[i] = arc + t * len; }
      }
    }
    arc += len;
  }
  return { d, s };
}

// ---------------------------------------------------------------------------
// Kettle hollows on the esker flanks
// ---------------------------------------------------------------------------

export interface Kettle { readonly x: number; readonly y: number; readonly r: number; readonly depth: number }

function buildKettles(): Kettle[] {
  const rng = new Mulberry32(0x6e771e);
  const out: Kettle[] = [];
  for (const e of ESKERS) {
    const pts = resample(e.crest, 260);
    for (let k = 1; k + 1 < pts.length; k++) {
      if (rng.nextFloat() < 0.45) continue;
      const a = pts[k - 1]!;
      const b = pts[k + 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const side = rng.nextFloat() < 0.5 ? 1 : -1;
      const off = 170 + rng.nextFloat() * 180;
      const x = pts[k]!.x + (side * (b.y - a.y) * off) / len;
      const y = pts[k]!.y - (side * (b.x - a.x) * off) / len;
      // None on the fire's own ground (the sand between the eskers within 1.6 km of IGN stays dry and firm).
      if (Math.hypot(x, y) < 1600) continue;
      out.push({ x, y, r: 45 + rng.nextFloat() * 80, depth: 3 + rng.nextFloat() * 4 });
    }
  }
  return out;
}
export const KETTLES: readonly Kettle[] = buildKettles();

// ---------------------------------------------------------------------------
// The base elevation grid
// ---------------------------------------------------------------------------

export interface BaseGround {
  /** Elevation (m a.s.l.) before the streams are carved. */
  readonly dem: Float32Array;
  /** 0–1: glaciofluvial sand (eskers and their aprons). */
  readonly sand: Float32Array;
  /** Bedrock-knoll prominence (m above the hummocky surface): where outcrops form. */
  readonly knoll: Float32Array;
  /** 0–1: the macro-valley floors (clay). */
  readonly valleyFloor: Float32Array;
}

const GA = (GRAIN_DEG * Math.PI) / 180;
const GU = { x: Math.sin(GA), y: Math.cos(GA) };

function buildBase(): BaseGround {
  const dem = new Float32Array(GN * GN);
  const sand = new Float32Array(GN * GN);
  const knoll = new Float32Array(GN * GN);
  const valleyFloor = new Float32Array(GN * GN);
  const eskerFields = ESKERS.map((e) => ({ e, f: lineField(e.crest, 700), len: e.crest.reduce((s, p, k) => (k ? s + Math.hypot(p.x - e.crest[k - 1]!.x, p.y - e.crest[k - 1]!.y) : 0), 0) }));
  const valleyFields = VALLEYS.map((v) => ({ v, f: lineField(v.line, v.floorHalf + v.wall * 1.6), len: v.line.reduce((s, p, k) => (k ? s + Math.hypot(p.x - v.line[k - 1]!.x, p.y - v.line[k - 1]!.y) : 0), 0) }));
  for (let r = 0; r < GN; r++) {
    const y = cellY(r);
    for (let c = 0; c < GN; c++) {
      const x = cellX(c);
      const i = r * GN + c;
      const u = x * GU.x + y * GU.y; // along the grain
      const v = x * GU.y - y * GU.x; // across it
      // Regional surface: falling ~10 m northward over the sheet, and towards the big lake's basin in the SE.
      let e = 92.5 - 0.00055 * y + 4 * fbm(x / 8000, y / 8000, 3, 11);
      e -= 13 * smoothstep(5200, 1900, Math.hypot(x - BIG_LAKE.cx, y - BIG_LAKE.cy));
      // Terrain regions: bedrock knolls vs drumlinised moraine, in patches of a few km.
      const rocky = smoothstep(-0.2, 0.25, fbm(x / 4200, y / 4200, 3, 801));
      // Sand: within an esker's apron (noise-edged, elongated along the ridge).
      let sandW = 0;
      let esk = 0;
      for (const { e: ek, f, len } of eskerFields) {
        const d = f.d[i]!;
        if (!Number.isFinite(d)) continue;
        const sAlong = f.s[i]!;
        const taper = smoothstep(0, 420, sAlong) * smoothstep(0, 420, len - sAlong);
        // A beaded crest (saddles and summits a few hundred metres apart), varying width and flanks of unequal steepness:
        // an esker's contours break into elongated closed shapes of different sizes, never one set of concentric ellipses.
        const beads = 0.62 + 0.38 * fbm(sAlong / 330, 0.3, 3, 611 + Math.round(len));
        const w = ek.halfWidth * (0.75 + 0.5 * (0.5 + 0.5 * fbm(sAlong / 260, 0.7, 2, 613))) * (1 + 0.25 * fbm(x / 120, y / 120, 2, 615));
        esk = Math.max(esk, ek.height * taper * beads * Math.exp(-((d / w) ** 2)) + 1.2 * taper * Math.exp(-((d / (w * 2.2)) ** 2)) * fbm(x / 90, y / 90, 2, 619));
        sandW = Math.max(sandW, smoothstep(560 + 140 * fbm(x / 500, y / 500, 2, 617), 160, d) * (0.4 + 0.6 * taper));
      }
      // Moraine relief: drumlins along the grain, hummocks, and bedrock knolls with outcrop-rough tops.
      const drum = 7.5 * Math.max(0, fbm(u / 1500, v / 380, 3, 701) + 0.08) ** 0.9;
      const hum = 2.6 * fbm(x / 320, y / 320, 3, 7);
      const kraw = fbm(u / 820, v / 560, 4, 301);
      const kn = 32 * Math.max(0, kraw + 0.02) ** 1.4 + 5.5 * Math.max(0, kraw) * fbm(x / 120, y / 120, 3, 305);
      const hollow = -4 * Math.max(0, -kraw - 0.15) - 2.5 * Math.max(0, -fbm(u / 1500, v / 380, 3, 701) - 0.25);
      const buried = 1 - 0.7 * sandW; // sand buries most of the bedrock knolls; the highest still crop out through it
      const relief = (1 - rocky) * (drum + hum + 0.35 * kn) + rocky * (kn + 0.6 * hum) + hollow;
      e += buried * relief + sandW * (3.2 * fbm(x / 240, y / 240, 3, 619)) + esk;
      knoll[i] = buried * (rocky * kn + (1 - rocky) * 0.35 * kn);
      sand[i] = Math.max(sandW, clamp01(esk / 4));
      // Valleys: the floor falls linearly downstream. The land eases towards a valley over kilometres; the wall's distance is
      // domain-warped and its width varies, and the moraine relief survives on it, so the contours meander along the valley
      // side instead of running parallel to the river.
      for (const { v: vl, f, len } of valleyFields) {
        const d = f.d[i]!;
        if (!Number.isFinite(d)) continue;
        const sNorm = clamp01(f.s[i]! / len);
        // The floor falls downstream and, gently, towards the centre line, so side drainage joins the stream instead of running
        // parallel to it down the floor.
        const floorZ = vl.z0 + (vl.z1 - vl.z0) * sNorm + 0.0035 * d + 0.3 * fbm(x / 500, y / 500, 2, 631);
        const reach = vl.floorHalf + vl.wall * 1.6;
        e -= (vl === RIVER_VALLEY ? 5 : 2) * smoothstep(reach, vl.floorHalf, d);
        const warp = vl.wall * (0.45 * fbm(x / 900, y / 900, 3, 641) + 0.15 * fbm(x / 260, y / 260, 2, 643));
        const dw = Math.max(0, d + warp);
        const half = vl.floorHalf * (0.6 + 0.8 * (0.5 + 0.5 * fbm(f.s[i]! / 1800, 0.1, 2, 633)));
        const wall = vl.wall * (0.5 + (0.5 + 0.5 * fbm(x / 1600, y / 1600, 2, 635)));
        const b = 1 - smoothstep(half, half + wall, dw);
        if (b <= 0) continue;
        const target = floorZ + 0.25 * Math.max(0, kn) * (1 - b);
        if (target < e) e = e + (target - e) * b;
        valleyFloor[i] = Math.max(valleyFloor[i]!, smoothstep(0.6, 0.97, b));
      }
      // Kettles.
      for (const k of KETTLES) {
        const dd = Math.hypot(x - k.x, y - k.y);
        if (dd < k.r * 2) e -= k.depth * smoothstep(k.r * 2, k.r * 0.5, dd);
      }
      dem[i] = e;
    }
  }
  // Named lake bowls and mire basins: the ground eases into a bowl (lake) or a flat (mire) of the basin's floor.
  for (const b of BASINS) {
    const reach = Math.max(b.a, b.b) * 2.2;
    const c0 = Math.max(0, Math.floor((b.cx - reach + HALF_M) / G));
    const c1 = Math.min(GN - 1, Math.floor((b.cx + reach + HALF_M) / G));
    const r0 = Math.max(0, Math.floor((b.cy - reach + HALF_M) / G));
    const r1 = Math.min(GN - 1, Math.floor((b.cy + reach + HALF_M) / G));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * GN + c;
      const s = basinInside(b, cellX(c), cellY(r));
      if (b.kind === "mire") {
        const w = smoothstep(220, -180, s);
        if (w <= 0) continue;
        dem[i] = dem[i]! - b.floor * w;
        sand[i] = sand[i]! * (1 - w);
        knoll[i] = knoll[i]! * (1 - w);
        continue;
      }
      const w = smoothstep(140, -40, s);
      if (w <= 0) continue;
      const bottom = b.floor - 5 * smoothstep(0, -Math.min(b.a, b.b) * 0.6, s);
      const target = Math.min(dem[i]!, bottom + (dem[i]! - bottom) * (1 - w) * 0.8);
      dem[i] = dem[i]! * (1 - w) + target * w;
      knoll[i] = knoll[i]! * (1 - w);
    }
  }
  // The big lake's basin: the land eases down to it over ~900 m; islands are low rocky knolls.
  for (let r = 0; r < GN; r++) {
    const y = cellY(r);
    if (y > BIG_LAKE.cy + BIG_LAKE.r * 2.4) continue;
    for (let c = 0; c < GN; c++) {
      const x = cellX(c);
      if (x < BIG_LAKE.cx - BIG_LAKE.r * 2.4) continue;
      const i = r * GN + c;
      const s = bigLakeShore(x, y);
      if (s > 900) continue;
      const isle = bigLakeIsland(x, y);
      if (s < 0) dem[i] = isle > 0 ? BIG_LAKE.level + 0.5 + 9 * isle : BIG_LAKE.level - 1.5 - 6 * clamp01(-s / 600);
      else dem[i] = BIG_LAKE.level + 0.8 + (dem[i]! - BIG_LAKE.level - 0.8) * clamp01(s / 900) ** 0.7;
    }
  }
  return { dem, sand, knoll, valleyFloor };
}

export const BASE: BaseGround = buildBase();
