/**
 * The training incident's lock on the live map and the blank memory-check map (SPEC/08 (bp) §bp.1): the map cannot leave the 2.5 km
 * square — `maxBounds` is the square plus its margin (100 m), the opening frame fits the whole square and the lowest zoom is that frame;
 * the zoom buttons are "2.5 km" (the whole square) and "1 km"; only the basemap tiles that meet the lock are loaded; and the session's
 * reference overlay (sector outlines and codes, R1–R3, the command post) is not drawn, so nothing of the main incident's area shows.
 * Pure: `MapView` and `FreezeMap` take a `MapLock` as an optional prop.
 */

import type { Lang } from "../../i18n/lang.js";
import { trainingLockBox, type Box } from "../../session/training/area.js";
import type { TrainingSpec } from "../../session/training/spec.js";

/** A zoom button on a locked map: `widthM` of ground across the map about its centre, or null for the whole area. */
export interface LockPreset { readonly id: string; readonly label: string; readonly widthM: number | null }

export interface MapLock {
  /** The area the opening frame fits whole. */
  readonly area: Box;
  /** `maxBounds`: the area plus its margin. */
  readonly bounds: Box;
  readonly presets: readonly LockPreset[];
}

/** The training's lock: its square, the square plus `lockMarginM`, and the presets "2.5 km" and "1 km". */
export function trainingMapLock(spec: Pick<TrainingSpec, "area">, lang: Lang): MapLock {
  return {
    area: spec.area.bounds,
    bounds: trainingLockBox(spec),
    presets: [{ id: "area", label: lang === "fi" ? "2,5 km" : "2.5 km", widthM: null }, { id: "km1", label: "1 km", widthM: 1_000 }],
  };
}

/** MapLibre's `maxBounds` ([[west, south], [east, north]]) for a lock. */
export function lockMaxBounds(lock: Pick<MapLock, "bounds">): [[number, number], [number, number]] {
  return [[lock.bounds.west, lock.bounds.south], [lock.bounds.east, lock.bounds.north]];
}

type Corners = readonly (readonly [number, number])[];

/** The basemap tiles (four corners, lon/lat) whose bounding box meets `box`: the only ones a locked map loads. */
export function tilesMeeting<T extends { readonly corners: Corners }>(tiles: readonly T[], box: Box): T[] {
  return tiles.filter((t) => {
    const lons = t.corners.map((c) => c[0]), lats = t.corners.map((c) => c[1]);
    return Math.min(...lons) <= box.east && Math.max(...lons) >= box.west && Math.min(...lats) <= box.north && Math.max(...lats) >= box.south;
  });
}
