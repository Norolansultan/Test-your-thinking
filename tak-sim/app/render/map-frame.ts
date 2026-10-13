/**
 * Revision (am), 10 Oct 2026: every view now opens on a fixed 5 × 5 km box about the extent's centre
 * (`openingCamera`), a little closer than the whole study area; the "Fire" (Palo) button still returns to the whole
 * extent (`extentCamera`). Both are content-independent. The memory-check map keeps the whole extent.
 *
 * The map's one neutral frame (SPEC/12 revision (aj), 9 Oct 2026; researcher: "do not zoom to the certain fire
 * points — the user needs to notice themselves and zoom to the correct position"). The camera never moves by itself
 * towards anything the scenario knows about: not a spot fire, a flare-up, the running front, a unit or an event. The
 * live map and the memory-check map open on the same fixed frame, the scenario's extent (the study area, about
 * 7 × 7 km, `scenario.extent`), fitted whole into the map at any window size; after that only the participant's own
 * hand and the three preset buttons move the camera. The frame reads nothing from a view, so it is the same for every
 * view and every participant at a given map size. Pure, for the tests. Replaces `fire-frame.ts` (revision (ah)),
 * which framed the uncontained edge and the forecast — in V13 the north-edge flare-up — and so gave away where to look.
 */

export interface Extent { readonly south: number; readonly north: number; readonly west: number; readonly east: number }
export interface Camera { readonly center: readonly [number, number]; readonly zoom: number }

const M_PER_DEG = 111_320;

/** MapLibre zoom that shows `widthM` of ground across `widthPx` at latitude `lat` (512-px tiles). */
export function zoomForWidth(widthM: number, widthPx: number, lat: number): number {
  return Math.log2((78_271.517 * Math.cos((lat * Math.PI) / 180) * widthPx) / widthM);
}

/** An extent's ground size, metres (equirectangular at its middle latitude; the site is 7 km across). */
export function extentSizeM(extent: Extent): { readonly widthM: number; readonly heightM: number } {
  const lat = (extent.south + extent.north) / 2;
  return { widthM: (extent.east - extent.west) * M_PER_DEG * Math.cos((lat * Math.PI) / 180), heightM: (extent.north - extent.south) * M_PER_DEG };
}

/**
 * The camera that shows the whole extent, centred, inside a `widthPx` × `heightPx` map with `padPx` clear on every
 * side: the extent's centre, at the zoom where both its width and its height fit (whichever is the tighter). A map
 * wider than the extent's shape shows basemap beyond the extent's east and west, a taller one beyond its north and
 * south; nothing inside the extent is ever cut off.
 */
export function extentCamera(extent: Extent, widthPx: number, heightPx: number, padPx = 0): Camera {
  const lat = (extent.south + extent.north) / 2;
  const { widthM, heightM } = extentSizeM(extent);
  const w = Math.max(1, widthPx - 2 * padPx), h = Math.max(1, heightPx - 2 * padPx);
  return { center: [(extent.west + extent.east) / 2, lat], zoom: Math.min(zoomForWidth(widthM, w, lat), zoomForWidth(heightM, h, lat)) };
}

/**
 * The opening frame's box (SPEC/12 revision (am), 10 Oct 2026; researcher: "each scenario should start from a closer
 * look, a little bit closer than the Fire view"): a square `OPENING_BOX_M` on a side about the extent's centre. It
 * reads nothing but the extent, so it is the same for every view and every participant; every view's fire and spread
 * projection lies inside it (`test/render/map-display.spec.ts` checks VP and V1–V14: the furthest point, V13–V14's
 * north edge and its projection, is ~2.26 km from the centre, the box's half-side 2.5 km).
 */
export const OPENING_BOX_M = 5_000;

/** A square `sizeM` on a side, centred on the extent's centre (equirectangular at the extent's middle latitude). */
export function boxAroundCentre(extent: Extent, sizeM: number): Extent {
  const lat = (extent.south + extent.north) / 2, lon = (extent.west + extent.east) / 2;
  const dLat = sizeM / 2 / M_PER_DEG;
  const dLon = sizeM / 2 / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon };
}

/** The camera every view opens on (revision (am)): the opening box, contain-fitted into the map (`extentCamera`). */
export function openingCamera(extent: Extent, widthPx: number, heightPx: number, padPx = 0): Camera {
  return extentCamera(boxAroundCentre(extent, OPENING_BOX_M), widthPx, heightPx, padPx);
}

/** The pannable area: `limitM` metres from the extent's centre on every side, as MapLibre's `maxBounds`. */
export function panBounds(extent: Extent, limitM: number): [[number, number], [number, number]] {
  const lat = (extent.south + extent.north) / 2, lon = (extent.west + extent.east) / 2;
  const dLat = limitM / M_PER_DEG;
  const dLon = limitM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return [[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]];
}

/** A screen point in the map container's pixels (origin top-left). */
export interface ScreenPoint { readonly x: number; readonly y: number }

/**
 * MapLibre's own Web Mercator projection (512-px tiles, bearing 0, no pitch) for a camera on a `widthPx` × `heightPx`
 * map: what `map.project` returns, as a pure function, so the label and unit placement can be tested at any window
 * size without a browser (SPEC/12 revision (al)).
 */
export function mercatorProjector(camera: Camera, widthPx: number, heightPx: number): (p: { readonly lat: number; readonly lon: number }) => ScreenPoint {
  const world = 512 * 2 ** camera.zoom;
  const wx = (lon: number) => ((lon + 180) / 360) * world;
  const wy = (lat: number) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world; };
  const cx = wx(camera.center[0]), cy = wy(camera.center[1]);
  return (p) => ({ x: wx(p.lon) - cx + widthPx / 2, y: wy(p.lat) - cy + heightPx / 2 });
}

/** Ground metres per screen pixel at MapLibre zoom `zoom`, latitude `lat` (the inverse of `zoomForWidth` per pixel). */
export function metresPerPixel(zoom: number, lat: number): number {
  return (78_271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}
