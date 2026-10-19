/**
 * Coordinate and clock helpers for the wildfire-skills export (`tools/skills/`). Every coordinate the export writes is
 * ETRS-TM35FIN (EPSG:3067), metres, rounded to 0.1 m: the scenario bundle stores WGS84 (converted from TM35 at build
 * time, `tools/fire-ca/site-export.ts`), and `tools/fire-ca/tm35.ts` converts it back (sub-metre within the zone). The
 * basemap's vectors (`content/site/build/topo-features.json`) are in basemap pixels; `site-meta.json` gives their TM35
 * frame (4 m per pixel, y down from the north edge).
 */

import type { LatLon, Polygon } from "../../app/engine/primitives.js";
import { STEP_SECONDS } from "../../app/scenario/views.js";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };
import { wgs84ToTm35 } from "../fire-ca/tm35.js";

/** A point in EPSG:3067: [easting, northing] in metres. */
export type EN = readonly [number, number];

/** EPSG:3067's usable box over Finland (the tests hold every exported coordinate to it). */
export const EPSG3067_BOX = { eMin: 50_000, eMax: 760_000, nMin: 6_600_000, nMax: 7_800_000 } as const;

export const CRS_3067 = { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::3067" } } as const;

export const round1 = (x: number): number => Math.round(x * 10) / 10;

export function toEN(p: LatLon): [number, number] {
  const { eastM, northM } = wgs84ToTm35(p);
  return [round1(eastM), round1(northM)];
}

export function inBox(p: EN): boolean {
  return p[0] >= EPSG3067_BOX.eMin && p[0] <= EPSG3067_BOX.eMax && p[1] >= EPSG3067_BOX.nMin && p[1] <= EPSG3067_BOX.nMax;
}

/** A ring in EPSG:3067, closed (first point repeated last) as GeoJSON requires. */
export function ringEN(ring: readonly LatLon[]): [number, number][] {
  const out = ring.map(toEN);
  const first = out[0], last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) out.push([first[0], first[1]]);
  return out;
}

/** The scenario's polygon ([outer, ...holes]) as GeoJSON Polygon coordinates. */
export function polygonEN(poly: Polygon): [number, number][][] {
  return poly.filter((r) => r.length >= 3).map(ringEN);
}

/** A main polygon and its detached parts as GeoJSON MultiPolygon coordinates (empty parts dropped). */
export function multiPolygonEN(main: Polygon | null, detached: readonly Polygon[]): [number, number][][][] {
  return [...(main ? [main] : []), ...detached].map(polygonEN).filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------------------------------
// Basemap pixels (topo-features.json) -> EPSG:3067
// ---------------------------------------------------------------------------------------------------

const MPP: number = siteMeta.metresPerPixel;
const WEST: number = siteMeta.tm35.west;
const NORTH: number = siteMeta.tm35.north;

export function pxToEN(px: readonly number[]): [number, number] {
  return [round1(WEST + px[0]! * MPP), round1(NORTH - px[1]! * MPP)];
}

// ---------------------------------------------------------------------------------------------------
// Plane geometry in metres
// ---------------------------------------------------------------------------------------------------

export function dist(a: EN, b: EN): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Compass bearing (0 = north, clockwise) from `a` to `b`. */
export function bearing(a: EN, b: EN): number {
  return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360;
}

/** `to` − `from`, in degrees, normalised to (−180, 180]: positive is clockwise of `from`. */
export function signedAngle(from: number, to: number): number {
  const d = ((to - from) % 360 + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** Ray casting; `ring` closed or not. */
export function insideRing(p: EN, ring: readonly EN[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------------------------------
// The scenario clock: virtual second 0 is 13:20, the start of main step 1; a step is 20 minutes
// ---------------------------------------------------------------------------------------------------

const START_MINUTES = 13 * 60 + 20;

/** "hh:mm" of a virtual second (seconds dropped). */
export function clockOf(virtualS: number): string {
  const m = START_MINUTES + Math.floor(virtualS / 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
}

/** The world-state step a virtual second falls in (step 1 starts at 0; the practice step W2 is −3). */
export function stepOfVirtual(virtualS: number): number {
  return Math.floor(virtualS / STEP_SECONDS) + 1;
}

/** The skills' `cycle`: the main step 1–20; the practice view and the prologue (steps −4…0) are cycle 0. */
export function cycleOfStep(step: number): number {
  return step <= 0 ? 0 : step;
}

/** The skills' cycle of a virtual second. */
export function cycleOfVirtual(virtualS: number): number {
  return cycleOfStep(stepOfVirtual(virtualS));
}
