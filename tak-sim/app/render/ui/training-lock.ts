/**
 * The training incident's lock on the live map and the blank memory-check map (SPEC/08 (bp) §bp.1): the map cannot leave the 2.5 km
 * square's neighbourhood — the opening frame fits the whole square and the lowest zoom is that frame; the zoom buttons are "2.5 km"
 * (the whole square) and "1 km"; only the basemap tiles that meet the lock (the square plus its 100 m margin) are loaded; and the
 * session's reference overlay (sector outlines and codes, R1–R3, the command post) is not drawn, so nothing of the main incident's
 * area shows. Pure: `MapView` and `FreezeMap` take a `MapLock` as an optional prop.
 *
 * Review 27 Oct 2026 (the training's (bp) review, finding 1): `maxBounds` was the square plus 100 m. MapLibre keeps the whole viewport
 * inside `maxBounds`, so on a map wider than tall it zoomed in until the box's width filled the map and cut the square's north and
 * south (at 1440 × 900 only 1.46 of its 2.5 km showed north–south). `maxBounds` is now what the opening frame itself shows
 * (`lockLimits`): the square fitted whole, widened in its shorter ground dimension to the map's shape. At the lowest zoom the map
 * cannot move; zoomed in, it pans within that frame. The limits follow the map's size (`MapView`, `FreezeMap` on every resize).
 *
 * Finding 3: the frame keeps the square clear of the map's chrome. The chrome sits at the map's corners; each layout of
 * `LIVE_LOCK_PADS` (`FREEZE_LOCK_PADS`) puts every piece of it inside a band along an edge — the corners' chrome above and below the
 * square, or beside it — and the frame fits the square in the box the bands leave, in the layout that draws it largest at the map's
 * size. So no training mark, key or feedback line (all inside the square) lies under the info card, the zoom buttons, the legend, the
 * coordinate readout or the attribution. The frame depends on the map's size only, as every opening frame (SPEC/12 revision (aj)).
 */

import type { Lang } from "../../i18n/lang.js";
import { trainingLockBox, type Box } from "../../session/training/area.js";
import type { TrainingSpec } from "../../session/training/spec.js";
import type { Camera } from "../map-frame.js";

/** A zoom button on a locked map: `widthM` of ground across the map about its centre, or null for the whole area. */
export interface LockPreset { readonly id: string; readonly label: string; readonly widthM: number | null }

export interface MapLock {
  /** The area the opening frame fits whole. */
  readonly area: Box;
  /** The area plus its margin: the tiles meeting it load, and a point answer lies inside it. */
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

/** Clear bands along a locked map's edges, px: its chrome lies inside them, so the opening frame draws nothing of the area under it. */
export interface FramePad { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number }

/**
 * The live map's layouts (the TAK shell's chrome, `TakMapChrome.tsx`, `MapView`, `Legend`). Top-left the training's compact info card
 * (its lower edge 56 px down, at most 338 px across); top-right the zoom buttons (8–42 px down, about 150 px across); bottom-left the
 * legend's button (74–96 px up) over the coordinate readout and scale bar (8–56 px up, at most 408 px across); bottom-right the
 * attribution (the lowest 34 px, at most 320 px across). The layouts: every corner's chrome above or below the square (a narrow map);
 * the left corners' chrome beside the square and the right corners' above and below it (a wide map); all of it beside the square
 * (a wide, short map).
 */
export const LIVE_LOCK_PADS: readonly FramePad[] = [
  { top: 64, right: 16, bottom: 104, left: 16 },
  { top: 50, right: 16, bottom: 42, left: 420 },
  { top: 16, right: 332, bottom: 16, left: 420 },
];
/**
 * The blank memory-check map's (`FreezeMap`): MapLibre's zoom buttons (top-right, 10 px in, 30 px across, 60 px down) and its scale bar
 * (bottom-right, 10–30 px up, at most 124 px across) — the buttons beside the square and the scale bar under it, or both beside it.
 */
export const FREEZE_LOCK_PADS: readonly FramePad[] = [
  { top: 8, right: 48, bottom: 40, left: 8 },
  { top: 8, right: 142, bottom: 8, left: 8 },
];

// Web Mercator as MapLibre draws it: a 512 px world at zoom 0.
const WORLD = 512;
const worldX = (lon: number): number => ((lon + 180) / 360) * WORLD;
const worldY = (lat: number): number => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD; };
const lonOf = (x: number): number => (x / WORLD) * 360 - 180;
const latOf = (y: number): number => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD))) * 180) / Math.PI;

/**
 * The camera that fits `area` whole into a `widthPx` × `heightPx` map, clear of `pad` on every side: the largest zoom at which the
 * area fits the box the bands leave, with the area centred in that box. Exact in Web Mercator (MapLibre's projection).
 */
export function lockedCamera(area: Box, widthPx: number, heightPx: number, pad: FramePad): Camera {
  const fw = Math.max(1, widthPx - pad.left - pad.right), fh = Math.max(1, heightPx - pad.top - pad.bottom);
  const dx = worldX(area.east) - worldX(area.west), dy = worldY(area.south) - worldY(area.north);
  const zoom = Math.log2(Math.min(fw / dx, fh / dy));
  const k = 2 ** zoom;
  // The area's centre sits at the free box's centre; the camera's centre is the map's middle.
  const cx = ((worldX(area.west) + worldX(area.east)) / 2) * k + widthPx / 2 - (pad.left + fw / 2);
  const cy = ((worldY(area.north) + worldY(area.south)) / 2) * k + heightPx / 2 - (pad.top + fh / 2);
  return { center: [lonOf(cx / k), latOf(cy / k)], zoom };
}

/** What `camera` shows on a `widthPx` × `heightPx` map, as MapLibre's `maxBounds` ([[west, south], [east, north]]). */
export function visibleBounds(camera: Camera, widthPx: number, heightPx: number): [[number, number], [number, number]] {
  const k = 2 ** camera.zoom;
  const cx = worldX(camera.center[0]) * k, cy = worldY(camera.center[1]) * k;
  return [[lonOf((cx - widthPx / 2) / k), latOf((cy + heightPx / 2) / k)], [lonOf((cx + widthPx / 2) / k), latOf((cy - heightPx / 2) / k)]];
}

/**
 * A locked map's limits at its size: the opening frame (`camera`, also the lowest zoom) in the layout of `pads` that draws the area
 * largest (the first of equals), and `maxBounds`, exactly what that frame shows, so MapLibre never has to zoom in to keep the map
 * inside a box of another shape (finding 1). `pad`: the layout used.
 */
export function lockLimits(lock: Pick<MapLock, "area">, widthPx: number, heightPx: number, pads: readonly FramePad[]): {
  readonly camera: Camera; readonly maxBounds: [[number, number], [number, number]]; readonly pad: FramePad;
} {
  let best = { camera: lockedCamera(lock.area, widthPx, heightPx, pads[0]!), pad: pads[0]! };
  for (const pad of pads.slice(1)) {
    const camera = lockedCamera(lock.area, widthPx, heightPx, pad);
    if (camera.zoom > best.camera.zoom + 1e-9) best = { camera, pad };
  }
  return { ...best, maxBounds: visibleBounds(best.camera, widthPx, heightPx) };
}

/**
 * `camera` moved as MapLibre's `maxBounds` moves it on a `widthPx` × `heightPx` map: panned so the view stays inside `maxBounds`, or
 * centred on it in a dimension it does not fill (for the play harness, which draws the map at a camera it computes).
 */
export function clampToBounds(camera: Camera, widthPx: number, heightPx: number, maxBounds: [[number, number], [number, number]]): Camera {
  const k = 2 ** camera.zoom;
  const [[west, south], [east, north]] = maxBounds;
  const minX = worldX(west) * k, maxX = worldX(east) * k, minY = worldY(north) * k, maxY = worldY(south) * k;
  const fit = (c: number, lo: number, hi: number, half: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
  const x = fit(worldX(camera.center[0]) * k, minX, maxX, widthPx / 2), y = fit(worldY(camera.center[1]) * k, minY, maxY, heightPx / 2);
  return { center: [lonOf(x / k), latOf(y / k)], zoom: camera.zoom };
}

type Corners = readonly (readonly [number, number])[];

/** The basemap tiles (four corners, lon/lat) whose bounding box meets `box`: the only ones a locked map loads. */
export function tilesMeeting<T extends { readonly corners: Corners }>(tiles: readonly T[], box: Box): T[] {
  return tiles.filter((t) => {
    const lons = t.corners.map((c) => c[0]), lats = t.corners.map((c) => c[1]);
    return Math.min(...lons) <= box.east && Math.max(...lons) >= box.west && Math.min(...lats) <= box.north && Math.max(...lats) >= box.south;
  });
}
