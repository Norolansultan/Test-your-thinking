/**
 * Game mode, live fire model: per-burning-cell storage. Only burning cells need it, so it lives in a
 * pool of slots (reused when a cell stops burning) rather than in grid-sized arrays — a forecast's
 * copy of the fire then costs a little memory, not a lot.
 *
 * Per slot: the distance (m) the cell's front has travelled toward each of its 16 neighbours and
 * the slope factor toward each; the credit (s) its ignition carries into its first step (the
 * front's overshoot); its flaming start (s); and its undamped (before water) intensity (kW/m).
 */

import { N_NEIGHBOURS } from "./ros.js";

const K = N_NEIGHBOURS;

function grown(a: Float32Array, size: number): Float32Array {
  const b = new Float32Array(size);
  b.set(a);
  return b;
}

export class SlotPool {
  travel: Float32Array;
  slope: Float32Array;
  credit: Float32Array;
  flameS: Float32Array;
  i0: Float32Array;
  private cap: number;
  private used: number;
  private readonly freeList: number[];

  constructor(cap = 1024, from?: SlotPool) {
    if (from) {
      this.travel = from.travel.slice();
      this.slope = from.slope.slice();
      this.credit = from.credit.slice();
      this.flameS = from.flameS.slice();
      this.i0 = from.i0.slice();
      this.cap = from.cap;
      this.used = from.used;
      this.freeList = from.freeList.slice();
      return;
    }
    this.travel = new Float32Array(cap * K);
    this.slope = new Float32Array(cap * K);
    this.credit = new Float32Array(cap);
    this.flameS = new Float32Array(cap);
    this.i0 = new Float32Array(cap);
    this.cap = cap;
    this.used = 0;
    this.freeList = [];
  }

  /** A fresh slot: travel zeroed, slopes 1, no credit or intensity. */
  alloc(): number {
    const slot = this.freeList.pop() ?? this.used++;
    if (slot >= this.cap) this.grow(this.cap * 2);
    const base = slot * K;
    this.travel.fill(0, base, base + K);
    this.slope.fill(1, base, base + K);
    this.credit[slot] = 0;
    this.flameS[slot] = 0;
    this.i0[slot] = 0;
    return slot;
  }

  release(slot: number): void {
    this.freeList.push(slot);
  }

  clone(): SlotPool {
    return new SlotPool(0, this);
  }

  private grow(cap: number): void {
    this.travel = grown(this.travel, cap * K);
    this.slope = grown(this.slope, cap * K);
    this.credit = grown(this.credit, cap);
    this.flameS = grown(this.flameS, cap);
    this.i0 = grown(this.i0, cap);
    this.cap = cap;
  }
}
