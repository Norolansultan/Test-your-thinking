/**
 * The generated site's hydrology algorithms (SPEC/33 §4 stage 2, tools/topo-map/hydrology.ts and channels.ts) on small synthetic
 * grids: Priority-Flood+ε fills a pit to its spill and leaves no sink, D8 routing is acyclic and drains everything off the grid,
 * accumulation conserves the cells, the depression is found with its outlet, and a drawn channel is made to fall monotonically.
 */

import { describe, expect, it } from "vitest";
import { accumulate, d8Receivers, depressions, flowPath, hand, priorityFlood, slopeTan, topoOrder, twi } from "../../tools/topo-map/hydrology.js";
import { channelSurface } from "../../tools/topo-map/channels.js";

/** A tilted plane (falling east) with a 3 m pit at (6, 6) and a 2 m rim around it on a 15 × 15 grid. */
function pitGrid(n = 15): Float64Array {
  const z = new Float64Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    let v = 20 - 0.5 * c;
    const d = Math.hypot(r - 6, c - 6);
    if (d < 1.5) v -= 3;
    else if (d < 2.6) v += 2;
    z[r * n + c] = v;
  }
  return z;
}

describe("Priority-Flood+ε (Barnes et al. 2014)", () => {
  const n = 15;
  const dem = pitGrid(n);
  const { filled } = priorityFlood(dem, n, 1e-4);

  it("never lowers the surface and fills the pit up to its spill level", () => {
    for (let i = 0; i < n * n; i++) expect(filled[i]!).toBeGreaterThanOrEqual(dem[i]! - 1e-12);
    const pit = 6 * n + 6;
    expect(filled[pit]! - dem[pit]!).toBeGreaterThan(1.5);
  });

  it("leaves no interior cell without a strictly lower neighbour", () => {
    for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) {
      const i = r * n + c;
      let lower = false;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && filled[i + dr * n + dc]! < filled[i]!) lower = true;
      expect(lower, `cell ${r},${c}`).toBe(true);
    }
  });

  it("is deterministic, with or without jitter", () => {
    const jitter = new Float64Array(n * n).map((_, i) => ((i * 7919) % 101) / 101);
    const a = priorityFlood(dem, n, 1e-4, undefined, jitter).filled;
    const b = priorityFlood(dem, n, 1e-4, undefined, jitter).filled;
    expect([...a]).toEqual([...b]);
    expect([...priorityFlood(dem, n).filled]).toEqual([...filled]);
  });
});

describe("D8, accumulation, depressions, TWI and HAND", () => {
  const n = 15;
  const dem = pitGrid(n);
  const { filled } = priorityFlood(dem, n, 1e-4);
  const rec = d8Receivers(filled, n);
  const order = topoOrder(rec);
  const acc = accumulate(rec, order);

  it("routes every cell off the grid without a cycle", () => {
    expect(order.length).toBe(n * n);
    for (let i = 0; i < n * n; i++) {
      const path = flowPath(rec, i, () => false, n * n);
      const last = path[path.length - 1]!;
      expect(rec[last]).toBe(-1);
    }
  });

  it("conserves the cells: what leaves the edge cells is the whole grid", () => {
    let out = 0;
    for (let i = 0; i < n * n; i++) if (rec[i] === -1) out += acc[i]!;
    expect(out).toBe(n * n);
  });

  it("finds the pit as one depression, with its level and an outlet outside it", () => {
    const { label, list } = depressions(dem, filled, rec, n, 0.05);
    expect(list.length).toBe(1);
    const d = list[0]!;
    expect(d.maxDepth).toBeGreaterThan(1.5);
    expect(label[d.outlet]).toBe(-1);
    expect(d.level).toBeGreaterThan(dem[6 * n + 6]!);
  });

  it("gives a wetter index downslope and zero HAND on the drainage itself", () => {
    const tan = slopeTan(filled, n, 20);
    const w = twi(acc, tan, 20);
    const h = hand(filled, rec, order, acc, 10);
    let maxAcc = 0;
    for (let i = 0; i < n * n; i++) if (acc[i]! > acc[maxAcc]!) maxAcc = i;
    expect(h[maxAcc]).toBe(0);
    expect(w[maxAcc]!).toBeGreaterThan(w[0]!);
    for (let i = 0; i < n * n; i++) expect(h[i]!).toBeGreaterThanOrEqual(0);
  });
});

describe("channel surfaces", () => {
  it("fall monotonically, below the ground, flat across a lake, never below the floor", () => {
    const line = Array.from({ length: 50 }, (_, k) => ({ x: k * 10, y: 0 }));
    const ground = (x: number) => 80 - x * 0.002 + (x > 200 && x < 260 ? 1.5 : 0);
    const lake = (x: number) => (x >= 300 && x <= 350 ? 78.9 : undefined);
    const s = channelSurface(line, (x) => ground(x), (x) => lake(x), 0.5, 20, 0.0003, 78.5);
    for (let k = 1; k < s.length; k++) expect(s[k]!).toBeLessThanOrEqual(s[k - 1]!);
    for (const [k, p] of line.entries()) if (lake(p.x) === undefined) expect(s[k]!).toBeLessThanOrEqual(ground(p.x) - 0.5 + 1e-9);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(78.5);
  });
});
