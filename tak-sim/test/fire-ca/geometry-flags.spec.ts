/**
 * SPEC/24 §3 (mask tracing) and §6 (deriving flags).
 */

import { describe, expect, it } from "vitest";
import { components, dilate, traceMask, type GridFrame } from "../../tools/fire-ca/geometry.js";
import { deriveFlag, DEFAULT_FLAG_RULE } from "../../tools/fire-ca/flags.js";
import { parseAsciiGrid } from "../../tools/fire-ca/ascii-grid.js";
import { tm35ToWgs84, wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";

const N = 40;
const frame: GridFrame = { origin: { lat: 60.9, lon: 27.35 }, cols: N, rows: N, cellSizeM: 25 };

function mask(cells: readonly [number, number][]): Uint8Array {
  const m = new Uint8Array(N * N);
  for (const [c, r] of cells) m[r * N + c] = 1;
  return m;
}

function rect(c0: number, r0: number, c1: number, r1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
  return out;
}

describe("traceMask", () => {
  it("traces one cell as a closed square ring", () => {
    const { main, others } = traceMask(frame, mask([[5, 5]]), 0);
    expect(others).toHaveLength(0);
    const ring = main![0]!;
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
  });

  it("produces counter-clockwise outer rings (SPEC/04 Ring: closed, CCW)", () => {
    const ring = traceMask(frame, mask(rect(3, 3, 9, 6)), 0).main![0]!;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += ring[i]!.lon * ring[i + 1]!.lat - ring[i + 1]!.lon * ring[i]!.lat;
    expect(area).toBeGreaterThan(0);
  });

  it("keeps diagonally touching cells in one ring (8-connectivity)", () => {
    const { others } = traceMask(frame, mask([[5, 5], [6, 6]]), 0);
    expect(others).toHaveLength(0);
  });

  it("reports separate blobs (spot fires) as `others`, largest first as `main`", () => {
    const { main, others } = traceMask(frame, mask([...rect(2, 2, 8, 8), [20, 20]]), 0);
    expect(main).not.toBeNull();
    expect(others).toHaveLength(1);
  });
});

describe("components and dilate", () => {
  it("counts 8-connected components", () => {
    expect(components(frame, mask([[1, 1], [2, 2], [10, 10]]))).toHaveLength(2);
  });

  it("dilates by the tolerance radius in whole cells", () => {
    const d = dilate(frame, mask([[20, 20]]), 50);
    expect(d[20 * N + 22]).toBe(1);
    expect(d[20 * N + 23]).toBe(0);
  });
});

describe("deriveFlag", () => {
  const reported = mask(rect(10, 10, 14, 14));
  const envelope = mask(rect(10, 10, 14, 20)); // the envelope projects growth to the north

  it("holds when truth stays within envelope + tolerance", () => {
    expect(deriveFlag(frame, reported, envelope, mask(rect(10, 10, 14, 21)), DEFAULT_FLAG_RULE).flag).toBe("holds");
  });

  it("is quantitative when truth runs further in the projected direction", () => {
    expect(deriveFlag(frame, reported, envelope, mask(rect(10, 10, 14, 28)), DEFAULT_FLAG_RULE).flag).toBe("breach_quantitative");
  });

  it("is categorical when a detached new front appears (spot fire, surfacing fire)", () => {
    const truth = mask([...rect(10, 10, 14, 18), ...rect(30, 30, 32, 32)]);
    const e = deriveFlag(frame, reported, envelope, truth, DEFAULT_FLAG_RULE);
    expect(e.flag).toBe("breach_categorical");
    expect(e.detachedComponents).toBe(1);
  });

  it("is categorical when the fire escapes where the envelope projected no growth", () => {
    const truth = mask([...rect(10, 10, 14, 18), ...rect(15, 10, 22, 14)]); // runs east; envelope went north
    expect(deriveFlag(frame, reported, envelope, truth, DEFAULT_FLAG_RULE).flag).toBe("breach_categorical");
  });

  it("an authored depth breach is categorical without any area escape", () => {
    expect(deriveFlag(frame, reported, envelope, reported, DEFAULT_FLAG_RULE, true).flag).toBe("breach_categorical");
  });
});

describe("TM35FIN conversion", () => {
  it("round-trips to well under a millimetre", () => {
    const p = wgs84ToTm35(tm35ToWgs84(523456.7, 6725432.1));
    expect(Math.abs(p.eastM - 523456.7)).toBeLessThan(0.001);
    expect(Math.abs(p.northM - 6725432.1)).toBeLessThan(0.001);
  });

  it("puts false easting 500 000 m on the 27° E central meridian", () => {
    expect(tm35ToWgs84(500000, 6714000).lon).toBeCloseTo(27, 9);
  });
});

describe("parseAsciiGrid", () => {
  it("reads the header and flips rows so row 0 is the southern edge", () => {
    const g = parseAsciiGrid("ncols 2\nnrows 2\nxllcorner 500000\nyllcorner 6700000\ncellsize 25\nNODATA_value -9999\n1 2\n3 4\n");
    expect(g.cols).toBe(2);
    expect(Array.from(g.values)).toEqual([3, 4, 1, 2]);
    expect(g.nodata).toBe(-9999);
  });
});
