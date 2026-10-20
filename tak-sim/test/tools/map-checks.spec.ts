/**
 * The measures behind `map:check`'s hydro, road and realism parts (SPEC/33 §5) on synthetic shapes: an uphill stretch is found, a
 * smooth ellipse is told from a lobed outline, a rectangle is a rectangle, and a road loop shaped like a rectangle is caught.
 */

import { describe, expect, it } from "vitest";
import { minRectArea, shape, type P } from "../../tools/topo-map/checks/built-layers.js";
import { ellipseResidual } from "../../tools/topo-map/checks/realism.js";
import { networkFaces } from "../../tools/topo-map/checks/road.js";
import { uphillStretches } from "../../tools/topo-map/checks/hydro.js";

const ellipse = (a: number, b: number, n = 120, wobble = 0): P[] =>
  Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n;
    const w = 1 + wobble * (Math.sin(3 * t) + 0.6 * Math.sin(7 * t + 1));
    return { x: a * Math.cos(t) * w, y: b * Math.sin(t) * w };
  });

describe("hydro measures", () => {
  it("finds a stream rising above its lowest point upstream, and passes a falling one", () => {
    const line = Array.from({ length: 30 }, (_, k) => ({ x: k * 10, y: 0 }));
    expect(uphillStretches(line, (p) => 80 - p.x * 0.01)).toEqual([]);
    const bump = uphillStretches(line, (p) => 80 - p.x * 0.01 + (p.x > 100 && p.x < 140 ? 0.5 : 0));
    expect(bump.length).toBe(1);
    expect(bump[0]!.riseM).toBeGreaterThan(0.1);
  });
});

describe("realism measures", () => {
  it("tells a smooth ellipse from a lobed outline", () => {
    expect(ellipseResidual(ellipse(400, 150)).residual).toBeLessThan(0.01);
    expect(ellipseResidual(ellipse(400, 150, 120, 0.15)).residual).toBeGreaterThan(0.035);
  });

  it("measures a rectangle as one, and a circle as compact and convex but not rectangular", () => {
    const rect = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 80 }, { x: 0, y: 80 }];
    expect(shape(rect).rectangularity).toBeCloseTo(1, 6);
    expect(minRectArea(rect)).toBeCloseTo(24_000, 3);
    const circle = shape(ellipse(200, 200, 200));
    expect(circle.compactness).toBeGreaterThan(0.95);
    expect(circle.convexity).toBeGreaterThan(0.99);
    expect(circle.rectangularity).toBeLessThan(0.8);
    const lobed = shape(ellipse(500, 300, 200, 0.2));
    expect(lobed.convexity).toBeLessThan(0.97);
  });
});

describe("road network faces", () => {
  it("finds the block four straight roads wall in, and no block where the roads do not close", () => {
    const square = [[{ x: -1000, y: -1000 }, { x: 1000, y: -1000 }], [{ x: 1000, y: -1000 }, { x: 1000, y: 1000 }], [{ x: 1000, y: 1000 }, { x: -1000, y: 1000 }], [{ x: -1000, y: 1000 }, { x: -1000, y: -1000 }]];
    const faces = networkFaces(square);
    expect(faces.length).toBe(1);
    const area = faces[0]!.length * 400;
    expect(area / minRectArea(faces[0]!)).toBeGreaterThan(0.9);
    expect(networkFaces(square.slice(0, 3))).toEqual([]);
  });
});
