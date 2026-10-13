/**
 * Range & Bearing (SPEC/28 §5): two points on the map give the distance in metres and the true bearing from the first
 * to the second, the way ATAK's R&B tool reads them. Pure and deterministic: the WGS84 ellipsoid, Vincenty's inverse
 * formula (iterated to 1e-12 rad, at most 200 iterations), with the spherical great-circle solution as the fallback for
 * the near-antipodal pairs where Vincenty does not converge (never within the study area, kept so the function is total).
 *
 * No clock, no randomness, no network: the result depends on the two points only.
 */

import type { LatLon } from "../../../engine/primitives.js";

/** WGS84: semi-major axis (m) and flattening. */
const A = 6_378_137;
const F = 1 / 298.257223563;
const B = A * (1 - F);
/** The mean Earth radius (m) of the spherical fallback. */
const R_MEAN = 6_371_008.8;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
/** A bearing in [0, 360). */
export const normaliseBearing = (d: number): number => ((d % 360) + 360) % 360;

export interface RangeBearingResult {
  /** Ellipsoidal distance, metres. */
  readonly metres: number;
  /** True initial bearing from `from` to `to`, degrees clockwise from north, [0, 360). */
  readonly bearingDeg: number;
  /** The bearing back from `to` to `from` (the reciprocal at the far end), [0, 360). */
  readonly backBearingDeg: number;
  /** `vincenty` normally; `sphere` when Vincenty did not converge (near-antipodal points). */
  readonly method: "vincenty" | "sphere";
}

/** Vincenty's inverse solution on WGS84; null when it does not converge. */
function vincenty(from: LatLon, to: LatLon): RangeBearingResult | null {
  const L = rad(to.lon - from.lon);
  const U1 = Math.atan((1 - F) * Math.tan(rad(from.lat)));
  const U2 = Math.atan((1 - F) * Math.tan(rad(to.lat)));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
  let lambda = L;
  let sinSigma = 0, cosSigma = 1, sigma = 0, cosSqAlpha = 1, cos2SigmaM = 0, sinLambda = 0, cosLambda = 1;
  for (let i = 0; i < 200; i++) {
    sinLambda = Math.sin(lambda);
    cosLambda = Math.cos(lambda);
    const t1 = cosU2 * sinLambda, t2 = cosU1 * sinU2 - sinU1 * cosU2 * cosLambda;
    sinSigma = Math.sqrt(t1 * t1 + t2 * t2);
    if (sinSigma === 0) return { metres: 0, bearingDeg: 0, backBearingDeg: 0, method: "vincenty" }; // coincident points
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0; // equatorial line
    const C = (F / 16) * cosSqAlpha * (4 + F * (4 - 3 * cosSqAlpha));
    const prev = lambda;
    lambda = L + (1 - C) * F * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - prev) <= 1e-12) {
      const uSq = (cosSqAlpha * (A * A - B * B)) / (B * B);
      const bigA = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
      const bigB = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
      const deltaSigma = bigB * sinSigma * (cos2SigmaM + (bigB / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        (bigB / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
      const metres = B * bigA * (sigma - deltaSigma);
      const fwd = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
      const rev = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);
      return { metres, bearingDeg: normaliseBearing(deg(fwd)), backBearingDeg: normaliseBearing(deg(rev) + 180), method: "vincenty" };
    }
  }
  return null;
}

/** The great-circle solution on a sphere of the mean radius (the fallback). */
function sphere(from: LatLon, to: LatLon): RangeBearingResult {
  const p1 = rad(from.lat), p2 = rad(to.lat), dl = rad(to.lon - from.lon);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const metres = 2 * R_MEAN * Math.asin(Math.min(1, Math.sqrt(h)));
  const fwd = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  const rev = Math.atan2(Math.sin(-dl) * Math.cos(p1), Math.cos(p2) * Math.sin(p1) - Math.sin(p2) * Math.cos(p1) * Math.cos(dl));
  return { metres, bearingDeg: normaliseBearing(deg(fwd)), backBearingDeg: normaliseBearing(deg(rev)), method: "sphere" };
}

/** Distance (m) and true bearing (°) from `from` to `to`, WGS84. */
export function rangeBearing(from: LatLon, to: LatLon): RangeBearingResult {
  return vincenty(from, to) ?? sphere(from, to);
}

/** Metres to the R&B readout: "850 m" under 1 km, "1.27 km" / "1,27 km" above (the session language's decimal mark). */
export function formatRange(metres: number, lang: "fi" | "en"): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = (Math.round(metres / 10) / 100).toFixed(2);
  return `${lang === "fi" ? km.replace(".", ",") : km} km`;
}

/** A bearing as ATAK shows it: three digits and the degree sign, true north ("047° T"). */
export function formatBearing(bearingDeg: number): string {
  const whole = Math.round(normaliseBearing(bearingDeg)) % 360;
  return `${String(whole).padStart(3, "0")}° T`;
}

/** What the log keeps of a measurement: metres to 0.1 m and the bearing to 0.01°, the points to 7 decimals (CoT precision). */
export function roundedMeasurement(from: LatLon, to: LatLon): { readonly from: LatLon; readonly to: LatLon; readonly metres: number; readonly bearingDeg: number } {
  const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
  const f = { lat: r7(from.lat), lon: r7(from.lon) }, t = { lat: r7(to.lat), lon: r7(to.lon) };
  const { metres, bearingDeg } = rangeBearing(f, t);
  return { from: f, to: t, metres: Math.round(metres * 10) / 10, bearingDeg: Math.round(bearingDeg * 100) / 100 };
}
