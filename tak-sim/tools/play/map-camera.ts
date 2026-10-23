/**
 * The live map's camera in the play harness (`tools/play/`): the participant moves the map themselves — the three preset buttons
 * (`ZOOM_LEVELS`: "Alue" 20 km and "2 km" about the map's centre, "Palo" the whole study area), the wheel and dragging — and the
 * app never moves it by itself; each new view opens on the opening frame again (`MapView`, `openingCamera`). `map` does the same
 * for the player: a preset, one wheel step in or out, or a pan that brings a pixel of the last image to the centre, within the
 * app's zoom limits and pan bounds. Pure: MapLibre's own Web Mercator (`mercatorProjector`, 512-px tiles), inverted for the pan.
 */

import type { GeoExtent } from "../../app/engine/primitives.js";
import { extentCamera, openingCamera, panBounds, zoomForWidth, type Camera } from "../../app/render/map-frame.js";
import { LIVE_MAP_PX } from "./map-data.js";

type Extent = Pick<GeoExtent, "south" | "north" | "west" | "east">;
/** `MapView`'s frame padding and pan limit, and its zoom limits (ground widths across the map). */
const FRAME_PAD_PX = 16;
const PAN_LIMIT_M = 12_000;
const MIN_WIDTH_M = 24_000, MAX_WIDTH_M = 400;

export const MAP_MOVES = ["alue", "palo", "2km", "in", "out", "reset"] as const;

/** The opening frame at the harness's map size. */
export function openingOf(extent: Extent): Camera {
  return openingCamera(extent, LIVE_MAP_PX.width, LIVE_MAP_PX.height, FRAME_PAD_PX);
}

/** The WGS84 point at pixel (x, y) of an image drawn with `camera` (MapLibre's projection inverted). */
export function lngLatAt(camera: Camera, x: number, y: number): readonly [number, number] {
  const world = 512 * 2 ** camera.zoom;
  const s = Math.sin((camera.center[1] * Math.PI) / 180);
  const cx = ((camera.center[0] + 180) / 360) * world, cy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
  const X = x - LIVE_MAP_PX.width / 2 + cx, Y = y - LIVE_MAP_PX.height / 2 + cy;
  const lon = (X / world) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * Y) / world))) * 180) / Math.PI;
  return [lon, lat];
}

/** The camera after one move (`MAP_MOVES`) and an optional pan to pixel `at`, clamped as MapLibre clamps it in the app. */
export function moveCamera(extent: Extent, from: Camera, move: (typeof MAP_MOVES)[number] | null, at: readonly [number, number] | null): Camera {
  let camera: Camera = from;
  if (at) camera = { ...camera, center: lngLatAt(camera, at[0], at[1]) };
  const lat = (extent.south + extent.north) / 2;
  const width = (m: number) => zoomForWidth(m, LIVE_MAP_PX.width, lat);
  if (move === "reset") camera = openingOf(extent);
  else if (move === "palo") camera = extentCamera(extent, LIVE_MAP_PX.width, LIVE_MAP_PX.height, FRAME_PAD_PX);
  else if (move === "alue") camera = { ...camera, zoom: width(20_000) };
  else if (move === "2km") camera = { ...camera, zoom: width(2_000) };
  else if (move === "in") camera = { ...camera, zoom: camera.zoom + 1 };
  else if (move === "out") camera = { ...camera, zoom: camera.zoom - 1 };
  const [[w, s], [e, n]] = panBounds(extent, PAN_LIMIT_M);
  return {
    center: [Math.min(e, Math.max(w, camera.center[0])), Math.min(n, Math.max(s, camera.center[1]))],
    zoom: Math.min(width(MAX_WIDTH_M), Math.max(width(MIN_WIDTH_M), camera.zoom)),
  };
}

/** About how many metres the image spans across, for the harness's note. */
export function widthMetres(camera: Camera): number {
  return Math.round((78_271.517 * Math.cos((camera.center[1] * Math.PI) / 180) * LIVE_MAP_PX.width) / 2 ** camera.zoom);
}
