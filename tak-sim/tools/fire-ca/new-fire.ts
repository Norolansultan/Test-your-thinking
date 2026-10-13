/**
 * The fire that grew from each rekindle — scenario revision (aj), 9 Oct 2026 (researcher: a rekindle
 * starts FROM the old fire; no unburned gap between the old and the new fire, in the grid or on the map).
 *
 * A rekindle's ignition disk now overlaps the burned edge (`scenario-18.ts`), so in the CA the new fire
 * is 8-connected to the old footprint from its first cell. The map still needs the new fire as a front
 * of its own (the V10 "new front", the V13 holdover, the V14 flare-up: `reportedDetached`, labels,
 * keys), so the footprint is SPLIT, not traced as one blob: the new fire is every cell burned since
 * the rekindle's ignition that is 8-connected to its ignited cells through such cells; the old fire is
 * the rest. The two outlines share the old edge, so there is no gap between them.
 *
 * Where two new fires meet (the origin's west-edge flare-up grows into the south-east front by 19:40), each
 * cell goes to the fire that reaches it first (one breadth-first wave from every seed), so the fronts stay
 * distinct on the map up to their meeting line.
 */

import { components, type GridFrame } from "./geometry.js";

export interface Rekindle {
  /** The forcing step id the rekindle was lit in. */
  readonly stepId: string;
  /** The cells its ignition set alight. */
  readonly seed: Uint8Array;
  /** The footprint just before the ignition: the old fire. */
  readonly baseline: Uint8Array;
}

export interface SplitFire {
  /** The footprint less every new fire. */
  readonly old: Uint8Array;
  /** One mask per rekindle (in `rekindles` order): the fire that grew from it; empty if none of it is in `mask`. */
  readonly newFires: readonly Uint8Array[];
}

/** Splits a footprint into the old fire and the fire grown from each rekindle (one 8-connected breadth-first wave per seed). */
export function splitFire(frame: GridFrame, mask: Uint8Array, rekindles: readonly Rekindle[]): SplitFire {
  const { cols, rows } = frame;
  const owner = new Int16Array(mask.length).fill(-1);
  const queue: number[] = [];
  const allowed = (k: number, i: number) => mask[i] === 1 && rekindles[k]!.baseline[i] === 0 && owner[i] === -1;
  rekindles.forEach((rk, k) => { for (let i = 0; i < rk.seed.length; i++) if (rk.seed[i] && allowed(k, i)) { owner[i] = k; queue.push(i); } });
  for (let q = 0; q < queue.length; q++) {
    const j = queue[q]!, k = owner[j]!;
    const c = j % cols, r = (j - c) / cols;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0 && dr === 0) continue;
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const i = nr * cols + nc;
      if (!allowed(k, i)) continue;
      owner[i] = k;
      queue.push(i);
    }
  }
  const newFires = rekindles.map((_, k) => { const m = new Uint8Array(mask.length); for (let i = 0; i < m.length; i++) if (owner[i] === k) m[i] = 1; return m; });
  const old = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) old[i] = mask[i] && owner[i] === -1 ? 1 : 0;
  return { old, newFires };
}

/** The union of masks. */
export function unionOf(masks: readonly Uint8Array[], length: number): Uint8Array {
  const u = new Uint8Array(length);
  for (const m of masks) for (let i = 0; i < m.length; i++) if (m[i]) u[i] = 1;
  return u;
}

/**
 * The smallest 8-neighbour (Chebyshev) distance, in cells, from any cell of `a` to any cell of `b`:
 * 0 = they overlap, 1 = they touch, ≥ 2 = an unburned gap between them. Infinity if either is empty.
 */
export function cellGap(frame: GridFrame, a: Uint8Array, b: Uint8Array): number {
  const cellsOf = (m: Uint8Array) => { const out: number[] = []; for (let i = 0; i < m.length; i++) if (m[i]) out.push(i); return out; };
  const as = cellsOf(a), bs = cellsOf(b);
  let best = Infinity;
  for (const i of as) {
    const ci = i % frame.cols, ri = (i - ci) / frame.cols;
    for (const j of bs) {
      const cj = j % frame.cols, rj = (j - cj) / frame.cols;
      best = Math.min(best, Math.max(Math.abs(ci - cj), Math.abs(ri - rj)));
      if (best === 0) return 0;
    }
  }
  return best;
}

/** Whether the mask has any set cell. */
export const anyCell = (m: Uint8Array): boolean => m.some((v) => v === 1);

/** For tests: the connected components of a mask, as masks. */
export function componentMasks(frame: GridFrame, mask: Uint8Array): Uint8Array[] {
  return components(frame, mask).map((comp) => { const m = new Uint8Array(mask.length); for (const i of comp) m[i] = 1; return m; });
}
