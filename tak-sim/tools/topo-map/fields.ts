/**
 * Farms and fields of the generated site (SPEC/33 §4 stage 4). Farmsteads stand where there is flat clay or fine moraine near a
 * public road (and none within 5 km of IGN but the designed village); each field block is cut into rectangular parcels (50–150 m
 * wide, 150–450 m long), the long side running back from the road or down the slope to the brook, with a field ditch along about
 * one strip edge in eight (the map shows the main ditches only) and a main ditch from the block's low corner to the nearest
 * stream. Oriented-box parcelling after stavguo/obb-parcelling (MIT, SPEC/33 §8).
 */

import { Mulberry32 } from "../fire-ca/model.js";
import {
  bearingOf, cellOf, cellX, cellY, chaikin, closestOnPolyline, GN, HALF_M, hash2, simplify, lineField, polar, sampleGrid, VILLAGE, type P,
} from "./terrain-base.js";
import { ELEV, LAKE_ID, REC, RIVER, STREAM_CELL } from "./water.js";
import { riverDistCell } from "./water-query.js";
import { MIRE, ROCK, SLOPE, SOIL, SOIL_CLAY, SOIL_SAND } from "./soil.js";
import { FIXED_ROADS } from "./roads-main.js";

export interface Farm { readonly name: string; readonly x: number; readonly y: number }
export interface Parcel {
  readonly cx: number; readonly cy: number;
  /** Unit vector of the long axis. */
  readonly ux: number; readonly uy: number;
  readonly halfLen: number; readonly halfWid: number;
  readonly block: number;
}

const FARM_NAMES = ["Rinne", "Mäkelä", "Niemelä", "Koivula", "Harju", "Peltola"];
/** No farm closer to IGN than this (the designed village is the only settlement near the fire, SPEC/23 §13). */
const FARM_MIN_M = 5200;

const PUBLIC_ROADS = FIXED_ROADS.filter((r) => r.cls === "main" || r.id === "hiekkala" || r.id === "r3_e" || r.id === "pirttilampi").map((r) => r.line);
const ALL_FIXED = FIXED_ROADS.map((r) => r.line);
/** Distance (m) to the nearest of `lines`, per cell, out to `maxM`. */
function distanceTo(lines: readonly (readonly P[])[], maxM: number): Float32Array {
  const out = new Float32Array(GN * GN).fill(Infinity);
  for (const line of lines) { const f = lineField(line, maxM); for (let i = 0; i < GN * GN; i++) if (f.d[i]! < out[i]!) out[i] = f.d[i]!; }
  return out;
}
const PUBLIC_D = distanceTo(PUBLIC_ROADS, 760);
const FIXED_D = distanceTo(ALL_FIXED, 60);
const nearestRoad = (x: number, y: number, roads: readonly (readonly P[])[]) => {
  let best = { d: Infinity, p: { x, y } as P, line: roads[0]! };
  for (const line of roads) { const q = closestOnPolyline(x, y, line); const d = Math.hypot(q.x - x, q.y - y); if (d < best.d) best = { d, p: q, line }; }
  return best;
};

/** Cleared field ground: firm, flat, not water, mire, rock or a stream. */
function suitable(i: number): boolean {
  return LAKE_ID[i]! < 0 && !MIRE[i] && !ROCK[i] && STREAM_CELL[i]! < 0 && SLOPE[i]! < 0.045;
}

function siteScore(x: number, y: number): number {
  let s = 0;
  for (let dy = -320; dy <= 320; dy += 80) for (let dx = -320; dx <= 320; dx += 80) {
    if (dx * dx + dy * dy > 320 * 320) continue;
    const i = cellOf(x + dx, y + dy);
    if (!suitable(i)) continue;
    s += SOIL[i] === SOIL_CLAY ? 1.6 : SOIL[i] === SOIL_SAND ? 0.6 : 1;
  }
  return s * 4;
}

function buildFarms(): Farm[] {
  const cand: { x: number; y: number; s: number }[] = [];
  for (let y = -HALF_M + 800; y <= HALF_M - 800; y += 100) for (let x = -HALF_M + 800; x <= HALF_M - 800; x += 100) {
    if (Math.hypot(x, y) < FARM_MIN_M || !suitable(cellOf(x, y))) continue;
    const rd = PUBLIC_D[cellOf(x, y)]!;
    // By a public road, or on Kotkanjoki's clay floor (the old farms of the river valley; an access road is built to them).
    const valley = SOIL[cellOf(x, y)] === SOIL_CLAY && riverDistCell(x, y) < 600 && riverDistCell(x, y) > 150;
    if ((rd > 700 && !valley) || rd < 60) continue;
    cand.push({ x, y, s: siteScore(x, y) - Math.min(rd, 1400) / 200 + (valley ? 6 : 0) });
  }
  cand.sort((a, b) => b.s - a.s || a.y - b.y || a.x - b.x);
  const out: Farm[] = [];
  for (const c of cand) {
    if (c.s < 14 || out.length >= 16) break;
    if (out.some((f) => Math.hypot(f.x - c.x, f.y - c.y) < 1300)) continue;
    out.push({ name: FARM_NAMES[out.length] ?? "", x: c.x, y: c.y });
  }
  return out;
}

export const FARMS: readonly Farm[] = buildFarms();

/** W2's farm pond at Lahdenkylä (build.ts draws it); fields keep off it. */
const POND_W2: P = { x: 2250, y: -2210 };

function buildParcels(): { parcels: Parcel[]; ditches: P[][] } {
  const rng = new Mulberry32(0xf1e1d);
  const parcels: Parcel[] = [];
  const ditches: P[][] = [];
  const sites = [{ x: VILLAGE.x + 250, y: VILLAGE.y - 380, r: 1000 }, ...FARMS.map((f) => ({ x: f.x, y: f.y, r: 1100, valley: riverDistCell(f.x, f.y) < 700 }))];
  sites.forEach((site, block) => {
    // The block's ground: suitable cells connected to the site, off the roads, the pond and the farmyard.
    const region = new Uint8Array(GN * GN);
    const seed = cellOf(site.x, site.y);
    // The block stretches along the road and the valley floor: 1.1 km along the road, ~450 m back from it, and only clay or
    // ground near the road (fields follow the valley bottoms and the roads; they are not round clearings).
    // A valley farm's block runs along the river (its strips run down to it); a roadside farm's along the road.
    const near = "valley" in site && site.valley ? nearestRoad(site.x, site.y, [RIVER]) : nearestRoad(site.x, site.y, ALL_FIXED);
    let k0 = 0;
    for (let k = 1; k < near.line.length; k++) if (Math.hypot(near.line[k]!.x - near.p.x, near.line[k]!.y - near.p.y) < Math.hypot(near.line[k0]!.x - near.p.x, near.line[k0]!.y - near.p.y)) k0 = k;
    const ta = near.line[Math.max(0, k0 - 2)]!;
    const tb = near.line[Math.min(near.line.length - 1, k0 + 2)]!;
    const tl = Math.hypot(tb.x - ta.x, tb.y - ta.y) || 1;
    const along = { x: (tb.x - ta.x) / tl, y: (tb.y - ta.y) / tl };
    const within = (x: number, y: number) => {
      const dx = x - site.x;
      const dy = y - site.y;
      const a = dx * along.x + dy * along.y;
      const b = dx * along.y - dy * along.x;
      return (a / site.r) ** 2 + (b / (site.r * 0.42)) ** 2 < 1;
    };
    const stack = [seed];
    const ok = (i: number) => {
      const x = cellX(i % GN);
      const y = cellY(Math.floor(i / GN));
      return suitable(i) && within(x, y) && (SOIL[i] === SOIL_CLAY || PUBLIC_D[i]! < 300 || block === 0) && FIXED_D[i]! > 22 && Math.hypot(x - POND_W2.x, y - POND_W2.y) > 70 && riverDistCell(x, y) > 35;
    };
    if (!suitable(seed)) return;
    region[seed] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      const r = Math.floor(i / GN);
      const c = i % GN;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= GN || rr >= GN) continue;
        const j = rr * GN + cc;
        if (!region[j] && ok(j)) { region[j] = 1; stack.push(j); }
      }
    }
    // Long axis: back from the nearest road when it is close, else down the slope.
    const road = near.d < 700 ? near : nearestRoad(site.x, site.y, ALL_FIXED);
    let axis: number;
    if (road.d < 700) axis = bearingOf(site.x - road.p.x, site.y - road.p.y);
    else {
      const e = 60;
      const gx = sampleGrid(ELEV, site.x + e, site.y) - sampleGrid(ELEV, site.x - e, site.y);
      const gy = sampleGrid(ELEV, site.x, site.y + e) - sampleGrid(ELEV, site.x, site.y - e);
      axis = bearingOf(-gx, -gy);
    }
    axis += (rng.nextFloat() - 0.5) * 16;
    const u = polar(axis, 1);
    const v = { x: u.y, y: -u.x };
    // The farmyard (70 m around the farmstead) is not field.
    const inRegion = (x: number, y: number) => Math.abs(x) < HALF_M && Math.abs(y) < HALF_M && region[cellOf(x, y)] === 1 && (block === 0 || Math.hypot(x - site.x, y - site.y) > 70);
    const fillRatio = (cx: number, cy: number, hl: number, hw: number) => {
      let n = 0;
      let k = 0;
      for (let a = -1; a <= 1; a += 0.25) for (let b = -1; b <= 1; b += 0.5) {
        n++;
        if (inRegion(cx + u.x * a * hl + v.x * b * hw, cy + u.y * a * hl + v.y * b * hw)) k++;
      }
      return k / n;
    };
    const R = site.r;
    let stripNo = 0;
    for (let vOff = -R; vOff < R;) {
      const wid = 50 + rng.nextFloat() * 100;
      let uOff = -R;
      const strip: Parcel[] = [];
      while (uOff < R) {
        let len = 150 + rng.nextFloat() * 300;
        let placed = false;
        for (let attempt = 0; attempt < 2 && !placed; attempt++) {
          const cx = site.x + u.x * (uOff + len / 2) + v.x * (vOff + wid / 2);
          const cy = site.y + u.y * (uOff + len / 2) + v.y * (vOff + wid / 2);
          if (fillRatio(cx, cy, len / 2, wid / 2) >= 0.86) {
            strip.push({ cx, cy, ux: u.x, uy: u.y, halfLen: len / 2 - 4, halfWid: wid / 2 - 4, block });
            placed = true;
          } else len /= 2;
        }
        uOff += len;
      }
      // On the maastokartta a field is a plain fill: only an occasional main field ditch shows, along some parcel edges (about one
      // strip edge in eight), never the open ditch of every parcel.
      const edgeDitch = strip.length > 0 && hash2(block, stripNo++, 8301) < 0.12;
      for (const p of strip) {
        parcels.push(p);
        if (!edgeDitch) continue;
        // The ditch along the parcel's long side (the +v side, between this strip and the next).
        const ex = p.cx + v.x * (p.halfWid + 4);
        const ey = p.cy + v.y * (p.halfWid + 4);
        ditches.push([{ x: ex - u.x * p.halfLen, y: ey - u.y * p.halfLen }, { x: ex + u.x * p.halfLen, y: ey + u.y * p.halfLen }]);
      }
      vOff += wid;
    }
    // The block's main ditch: from its lowest parcel corner down the flow path to the nearest stream (≤ 1.5 km).
    const own = parcels.filter((p) => p.block === block);
    if (own.length === 0) return;
    let low = { x: own[0]!.cx, y: own[0]!.cy, z: Infinity };
    for (const p of own) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = p.cx + p.ux * a * (p.halfLen + 4) + p.uy * b * (p.halfWid + 4);
      const y = p.cy + p.uy * a * (p.halfLen + 4) - p.ux * b * (p.halfWid + 4);
      const z = sampleGrid(ELEV, x, y);
      if (z < low.z) low = { x, y, z };
    }
    const path: P[] = [{ x: low.x, y: low.y }];
    let i = cellOf(low.x, low.y);
    for (let k = 0; k < 75 && STREAM_CELL[i]! < 0 && LAKE_ID[i]! < 0 && REC[i]! >= 0; k++) {
      i = REC[i]!;
      path.push({ x: cellX(i % GN), y: cellY(Math.floor(i / GN)) });
    }
    if (path.length > 2 && (STREAM_CELL[i]! >= 0 || LAKE_ID[i]! >= 0)) ditches.push(chaikin(simplify(path, 14), 2));
  });
  return { parcels, ditches };
}

const BUILT = buildParcels();
export const PARCELS: readonly Parcel[] = BUILT.parcels;
export const FIELD_DITCHES: readonly (readonly P[])[] = BUILT.ditches;

/** The parcel's corners (counter-clockwise). */
export function parcelRing(p: Parcel): P[] {
  const vx = p.uy;
  const vy = -p.ux;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: p.cx + p.ux * a! * p.halfLen + vx * b! * p.halfWid, y: p.cy + p.uy * a! * p.halfLen + vy * b! * p.halfWid }));
}

// Point lookup through a 200 m bucket index.
const BK = 200;
const BKN = (2 * HALF_M) / BK;
const BUCKETS = new Map<number, number[]>();
PARCELS.forEach((p, k) => {
  const r = Math.hypot(p.halfLen, p.halfWid);
  for (let bx = Math.floor((p.cx - r + HALF_M) / BK); bx <= Math.floor((p.cx + r + HALF_M) / BK); bx++) {
    for (let by = Math.floor((p.cy - r + HALF_M) / BK); by <= Math.floor((p.cy + r + HALF_M) / BK); by++) {
      const key = by * BKN + bx;
      const list = BUCKETS.get(key);
      if (list) list.push(k); else BUCKETS.set(key, [k]);
    }
  }
});

/** The parcel containing (x, y), or −1. */
export function parcelAt(x: number, y: number): number {
  for (const k of BUCKETS.get(Math.floor((y + HALF_M) / BK) * BKN + Math.floor((x + HALF_M) / BK)) ?? []) {
    const p = PARCELS[k]!;
    const dx = x - p.cx;
    const dy = y - p.cy;
    if (Math.abs(dx * p.ux + dy * p.uy) <= p.halfLen && Math.abs(dx * p.uy - dy * p.ux) <= p.halfWid) return k;
  }
  return -1;
}
