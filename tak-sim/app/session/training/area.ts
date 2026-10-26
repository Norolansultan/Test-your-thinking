/**
 * The training incident's area (SPEC/08 (bp) §bp.1): the 2.5 km square around Kaitajärvi and its lock. The live map's `maxBounds` and
 * the blank memory-check map's are the square widened by `lockMarginM` (100 m); a point answer must lie inside that box. Pure.
 */

import { WGS84, type GeoExtent, type LatLon } from "../../engine/primitives.js";
import { haversineMetres } from "../../telemetry/freeze-measures.js";
import type { TrainingItem, TrainingSpec } from "./spec.js";

export interface Box { readonly south: number; readonly west: number; readonly north: number; readonly east: number }

const M_PER_DEG = 111_320;

/** A box widened by `marginM` on every side (equirectangular at its middle latitude). */
export function widenBox(box: Box, marginM: number): Box {
  const lat = (box.south + box.north) / 2;
  const dLat = marginM / M_PER_DEG;
  const dLon = marginM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return { south: box.south - dLat, north: box.north + dLat, west: box.west - dLon, east: box.east + dLon };
}

/** The lock: the area's bounds plus its margin. */
export function trainingLockBox(spec: Pick<TrainingSpec, "area">): Box {
  return widenBox(spec.area.bounds, spec.area.lockMarginM);
}

/** The lock as a `GeoExtent` (WGS84): what the freeze screen's map and its answers are checked against in the training. */
export function trainingExtent(spec: Pick<TrainingSpec, "area">): GeoExtent {
  return { crs: WGS84, ...trainingLockBox(spec) };
}

export function insideBox(p: LatLon, box: Box): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= box.south && p.lat <= box.north && p.lon >= box.west && p.lon <= box.east;
}

/** A point answer's distance from its item's key, metres, rounded (null when the key is not a point). */
export function trainingErrorM(item: Pick<TrainingItem, "key">, point: LatLon): number | null {
  return "point" in item.key ? Math.round(haversineMetres(point, item.key.point)) : null;
}
