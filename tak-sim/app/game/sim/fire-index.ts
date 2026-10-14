/**
 * Game mode: the loop's index over the live fire. It keeps the active cells (burning or smouldering)
 * as a sorted list, the burning ones among them in 200 m buckets for radius queries, and every cell
 * that has ever burned (the scored area), so unit behaviours never scan the whole grid. Results come
 * in cell order; ties are broken by the lower index.
 */

import { CELL, type FireSim, type FireStepReport, type GameGrid, type XY } from "../contracts.js";
import { byNumber } from "./geom.js";
import type { CellCentreFn } from "./ports.js";

/** Bucket edge, in cells (8 × 25 m = 200 m). */
const BUCKET_CELLS = 8;

export class FireIndex {
  private readonly mark: Uint8Array;
  private readonly ever: Uint8Array;
  private everCount = 0;
  private readonly cx: Float64Array;
  private readonly cy: Float64Array;
  private readonly bucketCols: number;
  private readonly bucketRows: number;
  private readonly buckets: number[][];
  private readonly usedBuckets: number[] = [];
  /** Active cells (burning or smouldering), ascending. */
  active: number[] = [];
  /** Burning cells, ascending; refreshed by `refresh()`. */
  burning: number[] = [];

  constructor(
    private readonly fire: FireSim,
    private readonly grid: GameGrid,
    cellCentre: CellCentreFn,
  ) {
    const n = grid.cols * grid.rows;
    this.mark = new Uint8Array(n);
    this.ever = new Uint8Array(n);
    this.cx = new Float64Array(n);
    this.cy = new Float64Array(n);
    for (let c = 0; c < n; c++) {
      const p = cellCentre(grid, c);
      this.cx[c] = p.x;
      this.cy[c] = p.y;
    }
    this.bucketCols = Math.ceil(grid.cols / BUCKET_CELLS);
    this.bucketRows = Math.ceil(grid.rows / BUCKET_CELLS);
    this.buckets = Array.from({ length: this.bucketCols * this.bucketRows }, () => []);
    for (let c = 0; c < n; c++) {
      const s = fire.state[c];
      if (s === CELL.burning || s === CELL.smouldering) this.add(c);
      if (s === CELL.burning || s === CELL.smouldering || s === CELL.burnedOut || s === CELL.extinguished) this.markEver(c);
    }
    this.refresh();
  }

  centre(cell: number): XY {
    return { x: this.cx[cell]!, y: this.cy[cell]! };
  }

  /** A cell lit outside a fire step (scenario ignition). */
  noteIgnited(cell: number): void {
    this.add(cell);
    this.markEver(cell);
    this.refresh();
  }

  /** Folds one fire step's report in. */
  noteReport(report: FireStepReport): void {
    for (const c of report.ignited) { this.add(c); this.markEver(c); }
    for (const s of report.spotFires) { this.add(s.cell); this.markEver(s.cell); }
    for (const c of report.rekindled) { this.add(c); this.markEver(c); }
  }

  /** Drops cells that stopped being active and rebuilds the burning list and buckets. */
  refresh(): void {
    const st = this.fire.state;
    const keep: number[] = [];
    for (const c of this.active) {
      const s = st[c];
      if (s === CELL.burning || s === CELL.smouldering) keep.push(c);
      else this.mark[c] = 0;
    }
    keep.sort(byNumber);
    this.active = keep;
    this.burning = keep.filter((c) => st[c] === CELL.burning);
    for (const b of this.usedBuckets) this.buckets[b]!.length = 0;
    this.usedBuckets.length = 0;
    for (const c of this.burning) {
      const b = this.bucketOf(c);
      const list = this.buckets[b]!;
      if (list.length === 0) this.usedBuckets.push(b);
      list.push(c);
    }
  }

  isBurning(cell: number): boolean {
    return this.fire.state[cell] === CELL.burning;
  }

  burningCount(): number {
    let n = 0;
    for (const c of this.burning) if (this.fire.state[c] === CELL.burning) n++;
    return n;
  }

  /** Every cell that has burned at any time, in hectares. */
  everBurnedHa(): number {
    return (this.everCount * this.grid.cellM * this.grid.cellM) / 10000;
  }

  everBurnedCells(): number {
    return this.everCount;
  }

  /** Burning cells within `r` of `p`, ascending by cell. */
  burningWithin(p: XY, r: number): number[] {
    const out: number[] = [];
    this.scan(p, r, (c) => { out.push(c); });
    return out.sort(byNumber);
  }

  /** The burning cell nearest `p` within `r` (ties: lower index); -1 if none. Optional filter. */
  nearestBurning(p: XY, r: number, accept?: (cell: number) => boolean): number {
    let best = -1;
    let bestD = Infinity;
    this.scan(p, r, (c, d) => {
      if (d > bestD || (d === bestD && c > best)) return;
      if (accept !== undefined && !accept(c)) return;
      best = c;
      bestD = d;
    });
    return best;
  }

  /** Highest intensity among burning cells within `r` of `p` (0 if none) and that cell (ties: lower index). */
  hottestWithin(p: XY, r: number): { kwM: number; cell: number } {
    let kwM = 0;
    let cell = -1;
    this.scan(p, r, (c) => {
      const i = this.fire.intensity[c] ?? 0;
      if (i > kwM || (i === kwM && i > 0 && c < cell)) { kwM = i; cell = c; }
    });
    return { kwM, cell };
  }

  /** Burning cells within `r` of `p` (unordered visit; every caller makes its result order-free). */
  private scan(p: XY, r: number, visit: (cell: number, d: number) => void): void {
    if (this.burning.length === 0) return;
    const size = this.grid.cellM * BUCKET_CELLS;
    const h = this.grid.rows * this.grid.cellM;
    const bc0 = Math.max(0, Math.floor((p.x - r) / size));
    const bc1 = Math.min(this.bucketCols - 1, Math.floor((p.x + r) / size));
    const br0 = Math.max(0, Math.floor((h - p.y - r) / size));
    const br1 = Math.min(this.bucketRows - 1, Math.floor((h - p.y + r) / size));
    const st = this.fire.state;
    for (let br = br0; br <= br1; br++) {
      for (let bc = bc0; bc <= bc1; bc++) {
        for (const c of this.buckets[br * this.bucketCols + bc]!) {
          if (st[c] !== CELL.burning) continue;
          const d = Math.hypot(this.cx[c]! - p.x, this.cy[c]! - p.y);
          if (d <= r) visit(c, d);
        }
      }
    }
  }

  private bucketOf(c: number): number {
    const row = Math.floor(c / this.grid.cols);
    const col = c % this.grid.cols;
    return Math.floor(row / BUCKET_CELLS) * this.bucketCols + Math.floor(col / BUCKET_CELLS);
  }

  private add(c: number): void {
    if (c < 0 || c >= this.mark.length || this.mark[c] === 1) return;
    this.mark[c] = 1;
    this.active.push(c);
  }

  private markEver(c: number): void {
    if (c < 0 || c >= this.ever.length || this.ever[c] === 1) return;
    this.ever[c] = 1;
    this.everCount++;
  }
}
