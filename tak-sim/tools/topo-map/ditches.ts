/**
 * Ditch networks of the generated site (SPEC/33 §4 stage 3, §9): what most south-Finnish mires look like on the 1:50 000 map.
 *
 *   mire      every drained mire is split into blocks of a few hectares (a jittered 360–560 m Voronoi), each with its own direction;
 *             parallel lateral ditches 40–65 m apart, of varied length and ending ~25 m short of the mire's edge, run down the
 *             block's slope into a collector ditch across their low ends, and a main ditch follows the flow path from the
 *             collector to the nearest brook, lake or river. About one block in four is left unditched (never a whole mire, never
 *             Rahkasuo, which keeps its SPEC/18 §5 direction, 20°). Open and pine mires carry no ditches.
 *   forest    part of the paludified forest (soistuma) is ditched the same way, 60–80 m apart, one block per patch.
 *   field     the occasional field ditch along a strip edge, and each field block's main ditch (fields.ts).
 */

import { Mulberry32 } from "../fire-ca/model.js";
import { basinInside, bearingOf, cellOf, chaikin, cellX, cellY, components, GN, hash2, polar, RAHKASUO_BASIN, sampleGrid, simplify, type P } from "./terrain-base.js";
import { ELEV, LAKE_ID, REC, STREAM_CELL } from "./water.js";
import { MIRE, MIRE_DRAINED, MIRE_SOFT, PALUDIFIED } from "./soil.js";
import { FIELD_DITCHES } from "./fields.js";

export type DitchKind = "mire" | "collector" | "main" | "forest" | "field";
export interface Ditch { readonly kind: DitchKind; readonly line: readonly P[] }

/** The flow path from cell `i` to the first stream, lake or river cell (≤ maxCells), as a polyline; null if it reaches none. */
function mainDitch(i: number, maxCells: number): P[] | null {
  const pts: P[] = [{ x: cellX(i % GN), y: cellY(Math.floor(i / GN)) }];
  let k = i;
  for (let n = 0; n < maxCells; n++) {
    const j = REC[k]!;
    if (j < 0) return null;
    k = j;
    pts.push({ x: cellX(k % GN), y: cellY(Math.floor(k / GN)) });
    if (STREAM_CELL[k]! >= 0 || LAKE_ID[k]! >= 0) return chaikin(simplify(pts, 14), 2); // no 20 m staircase
  }
  return null;
}

/**
 * Ditches a block of cells (`member(x, y)`) as on the maastokartta: parallel laterals at `spacing` along `bearingDeg` (down the
 * slope), each stopping ~25 m short of the block's edge and its upper end trimmed by a varying amount (no edge-to-edge hatching);
 * a collector ditch across their low ends, which they all run into; and a main ditch from the collector's lower end down the flow
 * path to the nearest brook, lake or river.
 */
function ditchBlock(cells: readonly number[], member: (x: number, y: number) => boolean, bearingDeg: number, spacing: number, lateral: DitchKind, out: Ditch[], salt: number): void {
  const u = polar(bearingDeg, 1);
  const v = { x: u.y, y: -u.x };
  let cx = 0;
  let cy = 0;
  for (const i of cells) { cx += cellX(i % GN); cy += cellY(Math.floor(i / GN)); }
  cx /= cells.length;
  cy /= cells.length;
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const i of cells) {
    const dx = cellX(i % GN) - cx;
    const dy = cellY(Math.floor(i / GN)) - cy;
    const a = dx * u.x + dy * u.y;
    const b = dx * v.x + dy * v.y;
    uMin = Math.min(uMin, a); uMax = Math.max(uMax, a); vMin = Math.min(vMin, b); vMax = Math.max(vMax, b);
  }
  const at = (a: number, b: number): P => ({ x: cx + u.x * a + v.x * b, y: cy + u.y * a + v.y * b });
  // Inside the block and ~25 m clear of its edge (along the ditch and across it).
  const INSET = 25;
  const inner = (a: number, b: number) => [[0, 0], [INSET, 0], [-INSET, 0], [0, INSET * 0.7], [0, -INSET * 0.7]].every(([da, db]) => { const p = at(a + da!, b + db!); return member(p.x, p.y); });
  // Each lateral's longest inner run along u.
  const runs: { b: number; a0: number; a1: number }[] = [];
  for (let b = vMin + spacing / 2; b <= vMax; b += spacing) {
    let best: { a0: number; a1: number } | null = null;
    let a0 = NaN;
    for (let a = uMin - 10; a <= uMax + 20; a += 10) {
      const on = a <= uMax + 10 && inner(a, b);
      if (on && Number.isNaN(a0)) a0 = a;
      if (!on && !Number.isNaN(a0)) { if (!best || a - 10 - a0 > best.a1 - best.a0) best = { a0, a1: a - 10 }; a0 = NaN; }
    }
    if (best && best.a1 - best.a0 >= 60) runs.push({ b, ...best });
  }
  if (runs.length < 2) return;
  // The collector: across the low ends, where three laterals in four reach it.
  const ends = runs.map((r) => r.a1).sort((p, q) => p - q);
  const cU = ends[Math.floor(ends.length * 0.25)]!;
  const joined = runs.filter((r) => r.a1 >= cU - 5 && r.a0 < cU - 50);
  for (const r of runs) {
    const end = Math.min(r.a1, cU);
    // The upper end trimmed by 0–35 % of the run: laterals of different lengths, as dug.
    const start = r.a0 + (end - r.a0) * 0.35 * hash2(Math.round(r.b), salt, 8111);
    if (end - start >= 50) out.push({ kind: lateral, line: [at(start, r.b), at(end, r.b)] });
  }
  if (joined.length < 2) return;
  const b0 = Math.min(...joined.map((r) => r.b));
  const b1 = Math.max(...joined.map((r) => r.b));
  const c0 = at(cU, b0);
  const c1 = at(cU, b1);
  out.push({ kind: "collector", line: [c0, c1] });
  // The main ditch from the collector's lower end (else the block's lowest cell), joined to the collector.
  const lowEnd = sampleGrid(ELEV, c0.x, c0.y) <= sampleGrid(ELEV, c1.x, c1.y) ? c0 : c1;
  let m = mainDitch(cellOf(lowEnd.x, lowEnd.y), 150);
  if (!m) {
    let lowest = cells[0]!;
    for (const i of cells) if (ELEV[i]! < ELEV[lowest]!) lowest = i;
    m = mainDitch(lowest, 150);
  }
  if (m && m.length > 1) out.push({ kind: "main", line: [lowEnd, ...m] });
}

/** Down-slope bearing of a block (mean gradient), or `fallback` on flat ground. */
function downslope(cells: readonly number[], fallback: number): number {
  let gx = 0;
  let gy = 0;
  for (const i of cells) {
    const x = cellX(i % GN);
    const y = cellY(Math.floor(i / GN));
    gx += sampleGrid(ELEV, x + 20, y) - sampleGrid(ELEV, x - 20, y);
    gy += sampleGrid(ELEV, x, y + 20) - sampleGrid(ELEV, x, y - 20);
  }
  return Math.hypot(gx, gy) < 1e-6 * cells.length ? fallback : bearingOf(-gx, -gy);
}

function buildDitches(): Ditch[] {
  const out: Ditch[] = [];
  const rng = new Mulberry32(0xd17c);
  const onMire = (x: number, y: number) => sampleGrid(MIRE_SOFT, x, y) > 0.5;
  // Drained mires, in blocks.
  const drained = new Uint8Array(GN * GN);
  for (let i = 0; i < GN * GN; i++) drained[i] = MIRE[i] === MIRE_DRAINED ? 1 : 0;
  const comp = components(drained);
  const cellsOf: number[][] = comp.sizes.map(() => []);
  for (let i = 0; i < GN * GN; i++) if (comp.label[i]! >= 0) cellsOf[comp.label[i]!]!.push(i);
  cellsOf.forEach((cells, id) => {
    if (cells.length < 60) return;
    // Voronoi blocks on a jittered lattice, 360–560 m per mire (blocks of different sizes from mire to mire).
    const LAT = 360 + 200 * hash2(id, 3, 8109);
    const seeds: P[] = [];
    for (const i of cells) {
      const x = cellX(i % GN);
      const y = cellY(Math.floor(i / GN));
      const gx = Math.floor(x / LAT);
      const gy = Math.floor(y / LAT);
      const sx = (gx + 0.1 + 0.8 * hash2(gx, gy, 8101)) * LAT;
      const sy = (gy + 0.1 + 0.8 * hash2(gx, gy, 8103)) * LAT;
      if (!seeds.some((s) => s.x === sx && s.y === sy)) seeds.push({ x: sx, y: sy });
    }
    const blockOf = (x: number, y: number) => {
      let best = 0;
      for (let k = 1; k < seeds.length; k++) if (Math.hypot(seeds[k]!.x - x, seeds[k]!.y - y) < Math.hypot(seeds[best]!.x - x, seeds[best]!.y - y)) best = k;
      return best;
    };
    const byBlock = seeds.map(() => [] as number[]);
    for (const i of cells) byBlock[blockOf(cellX(i % GN), cellY(Math.floor(i / GN)))]!.push(i);
    const largest = byBlock.reduce((b, c, k) => (c.length > byBlock[b]!.length ? k : b), 0);
    byBlock.forEach((bc, k) => {
      if (bc.length < 12) return;
      const first = bc[0]!;
      const rahka = basinInside(RAHKASUO_BASIN, cellX(first % GN), cellY(Math.floor(first / GN))) < 200;
      const bearing = rahka ? 20 : downslope(bc, rng.nextFloat() * 180) + (hash2(id, k, 8105) - 0.5) * 40;
      const spacing = rahka ? 45 : 40 + 25 * hash2(id, k, 8107);
      // Not every part of a drained mire is ditched (about one block in four is left), but every drained mire has some.
      if (!rahka && k !== largest && hash2(id, k, 8113) < 0.25) return;
      const member = (x: number, y: number) => onMire(x, y) && comp.label[cellOf(x, y)] === id && blockOf(x, y) === k;
      ditchBlock(bc, member, bearing, spacing, "mire", out, id * 131 + k);
    });
  });
  // Forest ditching on part of the paludified ground.
  const palu = components(PALUDIFIED);
  const pcells: number[][] = palu.sizes.map(() => []);
  for (let i = 0; i < GN * GN; i++) if (palu.label[i]! >= 0) pcells[palu.label[i]!]!.push(i);
  pcells.forEach((cells, id) => {
    if (cells.length < 100 || hash2(id, 0, 8201) > 0.45) return;
    const member = (x: number, y: number) => palu.label[cellOf(x, y)] === id;
    ditchBlock(cells, member, downslope(cells, 0) + (hash2(id, 1, 8203) - 0.5) * 30, 60 + 20 * hash2(id, 2, 8205), "forest", out, 50_000 + id);
  });
  for (const d of FIELD_DITCHES) out.push({ kind: "field", line: d });
  return out;
}

export const DITCHES: readonly Ditch[] = buildDitches();
