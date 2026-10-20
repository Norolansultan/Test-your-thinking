/**
 * Ditch networks of the generated site (SPEC/33 §4 stage 3, §9): what most south-Finnish mires look like on the 1:50 000 map.
 *
 *   mire      every drained mire is split into blocks of a few hectares (a jittered ~500 m Voronoi), each with its own direction;
 *             parallel lateral ditches 40–60 m apart run down the block's slope into a collector ditch across its low end, and a main
 *             ditch follows the flow path from the block's lowest point to the nearest brook, lake or river. Rahkasuo keeps its
 *             SPEC/18 §5 direction (20°).
 *   forest    part of the paludified forest (soistuma) is ditched the same way, 60–80 m apart, one block per patch.
 *   field     the field ditches along the parcels' long sides and each field block's main ditch (fields.ts).
 */

import { Mulberry32 } from "../fire-ca/model.js";
import { basinInside, bearingOf, cellOf, cellX, cellY, components, GN, hash2, polar, RAHKASUO_BASIN, sampleGrid, simplify, type P } from "./terrain-base.js";
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
    if (STREAM_CELL[k]! >= 0 || LAKE_ID[k]! >= 0) return simplify(pts, 6);
  }
  return null;
}

/** Ditches a block of cells (`member(i)`) with parallel laterals at `spacing` along `bearingDeg`, a collector and a main ditch. */
function ditchBlock(cells: readonly number[], member: (x: number, y: number) => boolean, bearingDeg: number, spacing: number, lateral: DitchKind, out: Ditch[]): void {
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
  // Laterals: straight runs inside the block, ≥ 40 m.
  for (let b = vMin + spacing / 2; b <= vMax; b += spacing) {
    let run: P | null = null;
    let last: P | null = null;
    for (let a = uMin - 10; a <= uMax + 10; a += 10) {
      const p = { x: cx + u.x * a + v.x * b, y: cy + u.y * a + v.y * b };
      if (member(p.x, p.y)) { if (!run) run = p; last = p; } else {
        if (run && last && Math.hypot(last.x - run.x, last.y - run.y) >= 40) out.push({ kind: lateral, line: [run, last] });
        run = null;
      }
    }
    if (run && last && Math.hypot(last.x - run.x, last.y - run.y) >= 40) out.push({ kind: lateral, line: [run, last] });
  }
  // The collector across the low end (the laterals run down the slope, so the low end is at the larger u).
  const low = uMax - 12;
  let c0: P | null = null;
  let c1: P | null = null;
  for (let b = vMin; b <= vMax; b += 10) {
    const p = { x: cx + u.x * low + v.x * b, y: cy + u.y * low + v.y * b };
    if (member(p.x, p.y)) { if (!c0) c0 = p; c1 = p; }
  }
  if (c0 && c1 && Math.hypot(c1.x - c0.x, c1.y - c0.y) >= 40) out.push({ kind: "collector", line: [c0, c1] });
  // The main ditch from the block's lowest cell.
  let lowest = cells[0]!;
  for (const i of cells) if (ELEV[i]! < ELEV[lowest]!) lowest = i;
  const m = mainDitch(lowest, 150);
  if (m && m.length > 1) out.push({ kind: "main", line: m });
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
    // Voronoi blocks on a jittered 500 m lattice.
    const seeds: P[] = [];
    for (const i of cells) {
      const x = cellX(i % GN);
      const y = cellY(Math.floor(i / GN));
      const gx = Math.floor(x / 500);
      const gy = Math.floor(y / 500);
      const sx = (gx + 0.2 + 0.6 * hash2(gx, gy, 8101)) * 500;
      const sy = (gy + 0.2 + 0.6 * hash2(gx, gy, 8103)) * 500;
      if (!seeds.some((s) => s.x === sx && s.y === sy)) seeds.push({ x: sx, y: sy });
    }
    const blockOf = (x: number, y: number) => {
      let best = 0;
      for (let k = 1; k < seeds.length; k++) if (Math.hypot(seeds[k]!.x - x, seeds[k]!.y - y) < Math.hypot(seeds[best]!.x - x, seeds[best]!.y - y)) best = k;
      return best;
    };
    const byBlock = seeds.map(() => [] as number[]);
    for (const i of cells) byBlock[blockOf(cellX(i % GN), cellY(Math.floor(i / GN)))]!.push(i);
    byBlock.forEach((bc, k) => {
      if (bc.length < 12) return;
      const first = bc[0]!;
      const rahka = basinInside(RAHKASUO_BASIN, cellX(first % GN), cellY(Math.floor(first / GN))) < 200;
      const bearing = rahka ? 20 : downslope(bc, rng.nextFloat() * 180) + (hash2(id, k, 8105) - 0.5) * 40;
      const spacing = rahka ? 45 : 40 + 20 * hash2(id, k, 8107);
      const member = (x: number, y: number) => onMire(x, y) && comp.label[cellOf(x, y)] === id && blockOf(x, y) === k;
      ditchBlock(bc, member, bearing, spacing, "mire", out);
    });
  });
  // Forest ditching on part of the paludified ground.
  const palu = components(PALUDIFIED);
  const pcells: number[][] = palu.sizes.map(() => []);
  for (let i = 0; i < GN * GN; i++) if (palu.label[i]! >= 0) pcells[palu.label[i]!]!.push(i);
  pcells.forEach((cells, id) => {
    if (cells.length < 100 || hash2(id, 0, 8201) > 0.45) return;
    const member = (x: number, y: number) => palu.label[cellOf(x, y)] === id;
    ditchBlock(cells, member, downslope(cells, 0) + (hash2(id, 1, 8203) - 0.5) * 30, 60 + 20 * hash2(id, 2, 8205), "forest", out);
  });
  for (const d of FIELD_DITCHES) out.push({ kind: "field", line: d });
  return out;
}

export const DITCHES: readonly Ditch[] = buildDitches();
