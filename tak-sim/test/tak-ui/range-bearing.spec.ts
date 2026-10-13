/**
 * SPEC/28 §5 Range & Bearing: two points give the distance (m) and the true bearing. The geodesic is Vincenty's inverse
 * on WGS84, checked against the published reference pair (Flinders Peak → Buninyong, Geoscience Australia), the meridian
 * and the equator, the study area against the haversine, and the spherical fallback for near-antipodal pairs. Pure: the
 * same two points give the same numbers every time (I1).
 */

import { describe, expect, it } from "vitest";
import { formatBearing, formatRange, normaliseBearing, rangeBearing, roundedMeasurement } from "../../app/render/ui/tak/RangeBearing.js";

const dms = (d: number, m: number, s: number) => Math.sign(d) * (Math.abs(d) + m / 60 + s / 3600);

describe("rangeBearing (WGS84, Vincenty)", () => {
  it("matches the reference pair: Flinders Peak → Buninyong 54 972.271 m, 306° 52′ 05.37″, back 127° 10′ 25.07″", () => {
    const r = rangeBearing({ lat: dms(-37, 57, 3.7203), lon: dms(144, 25, 29.5244) }, { lat: dms(-37, 39, 10.1561), lon: dms(143, 55, 35.3839) });
    expect(r.method).toBe("vincenty");
    expect(r.metres).toBeCloseTo(54_972.271, 2);
    expect(r.bearingDeg).toBeCloseTo(dms(306, 52, 5.37), 4);
    expect(r.backBearingDeg).toBeCloseTo(dms(127, 10, 25.07), 4);
  });

  it("one degree along the meridian at 60.5° N is the ellipsoid's ~111.42 km, due north; along the equator 111.319 km, due east", () => {
    const n = rangeBearing({ lat: 60, lon: 27 }, { lat: 61, lon: 27 });
    expect(n.metres).toBeCloseTo(111_420.73, 1);
    expect(n.bearingDeg).toBe(0);
    expect(n.backBearingDeg).toBe(180);
    const e = rangeBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(e.metres).toBeCloseTo(111_319.491, 2);
    expect(e.bearingDeg).toBe(90);
    expect(rangeBearing({ lat: 60.85, lon: 27.35 }, { lat: 60.84, lon: 27.35 }).bearingDeg).toBeCloseTo(180, 9);
    expect(rangeBearing({ lat: 60.85, lon: 27.35 }, { lat: 60.85, lon: 27.30 }).bearingDeg).toBeCloseTo(270, 1);
  });

  it("in the study area agrees with the haversine to within 0.5 %, and the bearings are reciprocal (within the convergence)", () => {
    const hav = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
      const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
      return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
    };
    const pts = [{ lat: 60.8488, lon: 27.3496 }, { lat: 60.8525, lon: 27.3313 }, { lat: 60.8331, lon: 27.3776 }, { lat: 60.8702, lon: 27.4215 }];
    for (const a of pts) for (const b of pts) {
      if (a === b) continue;
      const r = rangeBearing(a, b);
      expect(Math.abs(r.metres - hav(a, b)) / hav(a, b)).toBeLessThan(0.005);
      const back = rangeBearing(b, a);
      expect(back.metres).toBeCloseTo(r.metres, 6);
      expect(Math.abs(normaliseBearing(back.bearingDeg - r.backBearingDeg + 180) - 180)).toBeLessThan(1e-6);
    }
  });

  it("two identical points are 0 m apart; a near-antipodal pair falls back to the sphere and stays finite", () => {
    expect(rangeBearing({ lat: 60.85, lon: 27.35 }, { lat: 60.85, lon: 27.35 })).toMatchObject({ metres: 0, bearingDeg: 0 });
    const far = rangeBearing({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.7 });
    expect(far.method).toBe("sphere");
    expect(Number.isFinite(far.metres) && far.metres > 19_900_000).toBe(true);
    expect(far.bearingDeg).toBeGreaterThanOrEqual(0);
    expect(far.bearingDeg).toBeLessThan(360);
  });

  it("is deterministic: the same points give bit-identical results", () => {
    const a = { lat: 60.8488123, lon: 27.3496111 }, b = { lat: 60.8612, lon: 27.3721 };
    expect(rangeBearing(a, b)).toEqual(rangeBearing(a, b));
    expect(Object.is(rangeBearing(a, b).metres, rangeBearing({ ...a }, { ...b }).metres)).toBe(true);
  });
});

describe("the readout and the record", () => {
  it("reads metres under a kilometre, kilometres with two decimals above, with the session language's decimal mark", () => {
    expect(formatRange(849.6, "en")).toBe("850 m");
    expect(formatRange(1556.7, "en")).toBe("1.56 km");
    expect(formatRange(1556.7, "fi")).toBe("1,56 km");
    expect(formatRange(12_000, "en")).toBe("12.00 km");
  });

  it("reads a bearing as three digits, true: 047° T, 000° T for 359.6°", () => {
    expect(formatBearing(47.2)).toBe("047° T");
    expect(formatBearing(359.6)).toBe("000° T");
    expect(formatBearing(-90)).toBe("270° T");
  });

  it("the logged measurement keeps the points to 7 decimals, metres to 0.1 m and the bearing to 0.01°", () => {
    const m = roundedMeasurement({ lat: 60.851234567891, lon: 27.33 }, { lat: 60.86, lon: 27.351111111 });
    expect(m.from).toEqual({ lat: 60.8512346, lon: 27.33 });
    expect(m.to).toEqual({ lat: 60.86, lon: 27.3511111 });
    expect(m.metres * 10).toBe(Math.round(m.metres * 10));
    expect(m.bearingDeg * 100).toBeCloseTo(Math.round(m.bearingDeg * 100), 6);
    expect(m.metres).toBeCloseTo(rangeBearing(m.from, m.to).metres, 1);
  });
});
