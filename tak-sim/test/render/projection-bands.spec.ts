/**
 * SPEC/12 revision (ah), 9 Oct 2026 (review finding F1): the projection's arrival-time bands never cover the
 * current fire. The first band used to cut the fire out only when the fire ring's first vertex lay inside the
 * isochrone, so in V1–V6 and V10–V14 it was painted over the burned ground. The bands are now a true polygon
 * difference (`projectionBands`, `polygon-ops.ts`); this checks every view of the real scenario by sampling.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { insideRing, projectionBands, projectionGrowth, ringHa } from "../../app/render/projection-growth.js";
import { subtract, unionAll } from "../../app/render/polygon-ops.js";
import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };

const scenario = buildDemoScenario();
const VIEWS = [
  { c: scenario.practice.cycle, e: scenario.practice.envelope },
  ...scenario.cycles.map((c) => ({ c, e: scenario.envelopes.find((x) => x.cycle === c.index)! })),
];

const STEP_M = 5;
/** Overlap allowed between a band and the fire (ha): a few sample cells along the shared edge. */
const TOLERANCE_HA = 0.01;

const inBand = (p: LatLon, rings: readonly (readonly LatLon[])[]) => insideRing(p, rings[0]!) && !rings.slice(1).some((h) => insideRing(p, h));
const inAny = (p: LatLon, polys: readonly Polygon[]) => polys.some((q) => q[0] !== undefined && q[0].length >= 4 && insideRing(p, q[0]));

/** Sampled area (ha) of a band that also lies in `polys`, and the band's sampled area. */
function overlapHa(rings: readonly (readonly LatLon[])[], polys: readonly Polygon[]): { overlap: number; area: number } {
  const r = rings[0]!;
  const lat0 = r[0]!.lat;
  const dLat = STEP_M / 111_320, dLon = STEP_M / (111_320 * Math.cos((lat0 * Math.PI) / 180));
  const lats = r.map((p) => p.lat), lons = r.map((p) => p.lon);
  let n = 0, o = 0;
  for (let la = Math.min(...lats); la <= Math.max(...lats); la += dLat) {
    for (let lo = Math.min(...lons); lo <= Math.max(...lons); lo += dLon) {
      const p = { lat: la, lon: lo };
      if (!inBand(p, rings)) continue;
      n++;
      if (inAny(p, polys)) o++;
    }
  }
  const cell = (STEP_M * STEP_M) / 10_000;
  return { overlap: o * cell, area: n * cell };
}

describe("projection bands never cover the current fire (F1)", () => {
  for (const { c, e } of VIEWS) {
    it(`V${c.index}: no band over the perimeter, the detached fronts, the burnt area or the burning zone`, () => {
      const fire = [c.perimeter, ...c.detachedFronts];
      const cut = [...fire, ...c.fire.burnt_area.geometry, ...c.fire.burning_zone];
      const g = projectionGrowth(e.isochrones, fire, theme.projection.growthMinHa);
      const bands = projectionBands(e.isochrones, cut, g.shown);
      for (const b of bands) {
        const { overlap } = overlapHa(b.rings, cut);
        expect(overlap, `V${c.index} rank ${b.rank}`).toBeLessThanOrEqual(TOLERANCE_HA);
      }
      // Holes turn the other way to their outer ring, as MapLibre needs.
      const sign = (r: readonly LatLon[]) => Math.sign(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]!; return s + (q.lon - p.lon) * (q.lat + p.lat); }, 0));
      for (const b of bands) for (const h of b.rings.slice(1)) expect(sign(h)).toBe(-sign(b.rings[0]!));
    });
  }

  it("does not depend on where a traced ring starts (the old rule tested only the fire ring's first vertex)", () => {
    const rotate = (p: Polygon, k: number): Polygon => {
      const r = p[0]!.slice(0, -1);
      const rot = [...r.slice(k % r.length), ...r.slice(0, k % r.length)];
      return [[...rot, rot[0]!], ...p.slice(1)];
    };
    for (const v of [1, 3, 5, 6, 10, 12, 14]) {
      const { c, e } = VIEWS.find((x) => x.c.index === v)!;
      for (const k of [7, 31]) {
        const fire = [rotate(c.perimeter, k), ...c.detachedFronts.map((f) => rotate(f, k))];
        const cut = [...fire, ...c.fire.burnt_area.geometry.map((p) => rotate(p, k)), ...c.fire.burning_zone];
        const g = projectionGrowth(e.isochrones, fire, theme.projection.growthMinHa);
        for (const b of projectionBands(e.isochrones, cut, g.shown)) expect(overlapHa(b.rings, cut).overlap, `V${v} shift ${k}`).toBeLessThanOrEqual(TOLERANCE_HA);
      }
    }
  });

  it("bands of different ranks do not overlap, and a growing view keeps its first band", () => {
    for (const { c, e } of VIEWS) {
      const fire = [c.perimeter, ...c.detachedFronts];
      const cut = [...fire, ...c.fire.burnt_area.geometry, ...c.fire.burning_zone];
      const g = projectionGrowth(e.isochrones, fire, theme.projection.growthMinHa);
      const bands = projectionBands(e.isochrones, cut, g.shown);
      const inner = bands.filter((b) => b.rank === 0).map((b) => b.rings.map((r) => r) as unknown as Polygon);
      for (const b of bands.filter((x) => x.rank === 1)) {
        // A second-rank band sampled against the first-rank bands' outer rings minus their holes.
        const { overlap } = overlapHa(b.rings, inner.map((p) => [p[0]!]));
        expect(overlap, `V${c.index}`).toBeLessThanOrEqual(TOLERANCE_HA);
      }
      if (g.anyGrows) expect(bands.some((b) => b.rank === 0), `V${c.index}`).toBe(true);
    }
  });
});

describe("polygon difference and union (polygon-ops)", () => {
  const sq = (x0: number, y0: number, s: number): [number, number][] => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
  const area = (r: readonly (readonly [number, number])[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]!; return s + (q[0] - p[0]) * (q[1] + p[1]); }, 0)) / 2;

  it("cuts a ring wholly inside as a hole, turned the other way", () => {
    const [reg] = subtract(sq(0, 0, 10), [sq(3, 3, 2)]);
    expect(reg!.holes).toHaveLength(1);
    expect(area(reg!.outer) - area(reg!.holes[0]!)).toBeCloseTo(96, 6);
  });

  it("cuts an overlapping ring out of the outline, wherever its first vertex lies", () => {
    for (const shift of [0, 1, 2, 3]) {
      const cut = sq(5, 5, 10);
      const rot = [...cut.slice(shift), ...cut.slice(0, shift)];
      const regs = subtract(sq(0, 0, 10), [rot]);
      expect(regs).toHaveLength(1);
      expect(regs[0]!.holes).toHaveLength(0);
      expect(area(regs[0]!.outer)).toBeCloseTo(75, 6);
    }
  });

  it("splits a ring cut across, drops a ring covered whole and keeps one apart", () => {
    const split = subtract(sq(0, 0, 10), [[[4, -1], [6, -1], [6, 11], [4, 11]]]);
    expect(split).toHaveLength(2);
    expect(split.reduce((s, r) => s + area(r.outer), 0)).toBeCloseTo(80, 6);
    expect(subtract(sq(2, 2, 2), [sq(0, 0, 10)])).toHaveLength(0);
    expect(subtract(sq(0, 0, 1), [sq(5, 5, 1)])).toHaveLength(1);
  });

  it("merges overlapping rings into one outline and leaves separate ones apart", () => {
    const merged = unionAll([sq(0, 0, 10), sq(5, 5, 10)]);
    expect(merged).toHaveLength(1);
    expect(area(merged[0]!)).toBeCloseTo(175, 6);
    expect(unionAll([sq(0, 0, 1), sq(5, 5, 1)])).toHaveLength(2);
    expect(unionAll([sq(0, 0, 10), sq(2, 2, 2)])).toHaveLength(1);
  });

  it("ringHa agrees with a sampled area for a real band (sanity of the sampling above)", () => {
    const { c, e } = VIEWS[1]!;
    const fire = [c.perimeter, ...c.detachedFronts];
    const g = projectionGrowth(e.isochrones, fire, theme.projection.growthMinHa);
    const b = projectionBands(e.isochrones, [...fire, ...c.fire.burnt_area.geometry, ...c.fire.burning_zone], g.shown)
      .sort((x, y) => ringHa(y.rings[0]!) - ringHa(x.rings[0]!))[0]!;
    const sampled = overlapHa(b.rings, []).area;
    const exact = ringHa(b.rings[0]!) - b.rings.slice(1).reduce((s, h) => s + ringHa(h), 0);
    expect(Math.abs(sampled - exact) / exact).toBeLessThan(0.1);
  });
});
