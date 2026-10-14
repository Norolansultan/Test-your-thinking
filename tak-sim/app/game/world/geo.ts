/**
 * Game mode (SPEC/29): local metres ↔ ETRS-TM35FIN (EPSG:3067) ↔ WGS84, for map overlays.
 *
 * Local metres are the game's frame (`contracts.ts`): x east, y north, origin at the fuel grid's south-west corner
 * (`GameGrid.originTm35`). TM35 is a plain offset from that. TM35 ↔ WGS84 is Transverse Mercator on GRS80 (central
 * meridian 27° E, scale 0.9996, false easting 500 000 m), Snyder's series (1987, Map Projections — A Working Manual,
 * pp. 60–64), the same maths as `tools/fire-ca/tm35.ts` (ported: app/ does not import tools/). Sub-metre within the
 * zone; ETRS89 and WGS84 differ by well under a metre here.
 *
 * Coordinates on the map side are `[lng, lat]` pairs, the order GeoJSON and MapLibre use.
 */

import type { GameGrid, XY } from "../contracts.js";

/** WGS84 longitude and latitude, degrees, in GeoJSON / MapLibre order. */
export type LngLat = readonly [lng: number, lat: number];

export interface Tm35 { readonly east: number; readonly north: number }

const A = 6378137;
const F = 1 / 298.257222101;
const E2 = 2 * F - F * F;
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = 27;
const FE = 500000;
const DEG = Math.PI / 180;
const E4 = E2 * E2;
const E6 = E4 * E2;
const M_FACTOR = 1 - E2 / 4 - (3 * E4) / 64 - (5 * E6) / 256;

function meridianArc(phi: number): number {
  return A * (
    M_FACTOR * phi
    - ((3 * E2) / 8 + (3 * E4) / 32 + (45 * E6) / 1024) * Math.sin(2 * phi)
    + ((15 * E4) / 256 + (45 * E6) / 1024) * Math.sin(4 * phi)
    - ((35 * E6) / 3072) * Math.sin(6 * phi)
  );
}

/** TM35FIN → WGS84 `[lng, lat]`. */
export function tm35ToLngLat(p: Tm35): LngLat {
  const mu = p.north / K0 / (A * M_FACTOR);
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
  const d = (p.east - FE) / (n1 * K0);
  const phi = phi1 - ((n1 * Math.tan(phi1)) / r1) * (
    (d * d) / 2
    - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720
  );
  const lam = (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) / c;
  return [LON0 + lam / DEG, phi / DEG];
}

/** WGS84 `[lng, lat]` → TM35FIN. */
export function lngLatToTm35(ll: LngLat): Tm35 {
  const phi = ll[1] * DEG;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const n = A / Math.sqrt(1 - E2 * s * s);
  const t = Math.tan(phi) ** 2;
  const cc = EP2 * c * c;
  const a = (ll[0] - LON0) * DEG * c;
  const m = meridianArc(phi);
  const east = FE + K0 * n * (a + ((1 - t + cc) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * cc - 58 * EP2) * a ** 5) / 120);
  const north = K0 * (m + n * Math.tan(phi) * ((a * a) / 2 + ((5 - t + 9 * cc + 4 * cc * cc) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * cc - 330 * EP2) * a ** 6) / 720));
  return { east, north };
}

/** Local metres → TM35FIN. */
export function localToTm35(grid: GameGrid, xy: XY): Tm35 {
  return { east: grid.originTm35.east + xy.x, north: grid.originTm35.north + xy.y };
}

/** TM35FIN → local metres. */
export function tm35ToLocal(grid: GameGrid, p: Tm35): XY {
  return { x: p.east - grid.originTm35.east, y: p.north - grid.originTm35.north };
}

/** Local metres → WGS84 `[lng, lat]`. */
export function localToLngLat(grid: GameGrid, xy: XY): LngLat {
  return tm35ToLngLat(localToTm35(grid, xy));
}

/** WGS84 `[lng, lat]` → local metres. */
export function lngLatToLocal(grid: GameGrid, ll: LngLat): XY {
  return tm35ToLocal(grid, lngLatToTm35(ll));
}

/**
 * The grid's four corners as `[lng, lat]`, in MapLibre image-source order: north-west, north-east, south-east,
 * south-west (an overlay drawn from the 400 × 400 fuel or fire raster lines up with these).
 */
export function gridCornersLngLat(grid: GameGrid): readonly [LngLat, LngLat, LngLat, LngLat] {
  const w = grid.cols * grid.cellM;
  const h = grid.rows * grid.cellM;
  return [
    localToLngLat(grid, { x: 0, y: h }),
    localToLngLat(grid, { x: w, y: h }),
    localToLngLat(grid, { x: w, y: 0 }),
    localToLngLat(grid, { x: 0, y: 0 }),
  ];
}
