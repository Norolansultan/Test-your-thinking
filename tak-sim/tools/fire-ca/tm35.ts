/**
 * ETRS-TM35FIN (EPSG:3067) <-> WGS84 for build-time tools. SPEC/03 §1.1 puts every coordinate
 * conversion at the bundle-build boundary; nothing here runs in the participant's browser.
 *
 * Transverse Mercator on GRS80: central meridian 27° E, scale 0.9996, false easting 500 000 m.
 * Series formulas from Snyder (1987), Map Projections — A Working Manual, pp. 60–64; sub-metre
 * accuracy within the zone. ETRS89 and WGS84 differ by well under a metre here, which is below
 * anything the scenario resolves.
 */

import type { LatLon } from "../../app/engine/primitives.js";

const A = 6378137;
const F = 1 / 298.257222101;
const E2 = 2 * F - F * F;
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = 27;
const FE = 500000;
const DEG = Math.PI / 180;

function meridianArc(phi: number): number {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  return A * (
    (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi
    - ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi)
    + ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi)
    - ((35 * e6) / 3072) * Math.sin(6 * phi)
  );
}

export function tm35ToWgs84(eastM: number, northM: number): LatLon {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const mu = northM / K0 / (A * (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256));
  const sq = Math.sqrt(1 - E2);
  const e1 = (1 - sq) / (1 + sq);
  const phi1 = mu
    + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu)
    + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1);
  const c = Math.cos(phi1);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = EP2 * c * c;
  const n1 = A / Math.sqrt(1 - E2 * s * s);
  const r1 = (A * (1 - E2)) / (1 - E2 * s * s) ** 1.5;
  const d = (eastM - FE) / (n1 * K0);
  const phi = phi1 - ((n1 * Math.tan(phi1)) / r1) * (
    (d * d) / 2
    - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720
  );
  const lam = (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) / c;
  return { lat: phi / DEG, lon: LON0 + lam / DEG };
}

export function wgs84ToTm35(p: LatLon): { eastM: number; northM: number } {
  const phi = p.lat * DEG;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const n = A / Math.sqrt(1 - E2 * s * s);
  const t = Math.tan(phi) ** 2;
  const cc = EP2 * c * c;
  const a = (p.lon - LON0) * DEG * c;
  const m = meridianArc(phi);
  const eastM = FE + K0 * n * (a + ((1 - t + cc) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * cc - 58 * EP2) * a ** 5) / 120);
  const northM = K0 * (m + n * Math.tan(phi) * ((a * a) / 2 + ((5 - t + 9 * cc + 4 * cc * cc) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * cc - 330 * EP2) * a ** 6) / 720));
  return { eastM, northM };
}
