/**
 * The play harness's map for a `map_point` freeze item (`tools/play/`): the app's `FreezeMap` is the plain basemap (no fire, no
 * units, no overlay) on which the participant taps one point inside the scenario's extent. The harness draws the same basemap
 * tiles, cropped to the extent's box on the basemap image, with a pixel grid labelled in the PNG's own pixel coordinates, and turns
 * the player's x,y back into a WGS84 point with the app's projection of the basemap (`basemapPx`, `app/render/ui/basemap-px.ts`,
 * inverted here by Newton's method as that module inverts the tiles' corners). Pure: the same geometry draws the image and reads
 * the answer, so an x,y read off the grid is the point the image shows there.
 */

import type { GeoExtent, LatLon } from "../../app/engine/primitives.js";
import { basemapPx } from "../../app/render/ui/basemap-px.js";
import { insideExtent } from "../../app/session/freeze-answers.js";

type Extent = Pick<GeoExtent, "south" | "north" | "west" | "east">;

/** The PNG: a margin for the grid's labels around the map, the map's longer side this many pixels. */
export const FREEZE_MAP_MARGIN_PX = 44;
export const FREEZE_MAP_SIDE_PX = 1000;
/** Grid lines every this many PNG pixels, labelled every second line. */
export const FREEZE_GRID_STEP_PX = 50;

export interface FreezeFrame {
  /** The extent's box on the basemap image (basemap pixels). */
  readonly x0: number; readonly y0: number; readonly w: number; readonly h: number;
  /** PNG pixels per basemap pixel. */
  readonly scale: number;
  /** The map's size in the PNG (the margin is around it). */
  readonly widthPx: number; readonly heightPx: number;
}

export function freezeFrame(extent: Extent): FreezeFrame {
  const corners = [
    basemapPx({ lat: extent.north, lon: extent.west }), basemapPx({ lat: extent.north, lon: extent.east }),
    basemapPx({ lat: extent.south, lon: extent.east }), basemapPx({ lat: extent.south, lon: extent.west }),
  ];
  const x0 = Math.min(...corners.map((c) => c.x)), x1 = Math.max(...corners.map((c) => c.x));
  const y0 = Math.min(...corners.map((c) => c.y)), y1 = Math.max(...corners.map((c) => c.y));
  const w = x1 - x0, h = y1 - y0;
  const scale = FREEZE_MAP_SIDE_PX / Math.max(w, h);
  return { x0, y0, w, h, scale, widthPx: Math.round(w * scale), heightPx: Math.round(h * scale) };
}

/** The WGS84 point at a basemap pixel: `basemapPx` inverted (Newton, from the extent's linear guess). */
export function latLonAtBasemapPx(px: { readonly x: number; readonly y: number }, extent: Extent, frame: FreezeFrame = freezeFrame(extent)): LatLon {
  let p: LatLon = {
    lat: extent.north - ((px.y - frame.y0) / frame.h) * (extent.north - extent.south),
    lon: extent.west + ((px.x - frame.x0) / frame.w) * (extent.east - extent.west),
  };
  for (let k = 0; k < 20; k++) {
    const at = basemapPx(p);
    const ex = px.x - at.x, ey = px.y - at.y;
    if (Math.hypot(ex, ey) < 1e-4) break;
    const d = 1e-6;
    const dLat = basemapPx({ lat: p.lat + d, lon: p.lon }), dLon = basemapPx({ lat: p.lat, lon: p.lon + d });
    const a = (dLon.x - at.x) / d, b = (dLat.x - at.x) / d, c = (dLon.y - at.y) / d, e = (dLat.y - at.y) / d;
    const det = a * e - b * c;
    p = { lat: p.lat + (-c * ex + a * ey) / det, lon: p.lon + (e * ex - b * ey) / det };
  }
  return { lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 };
}

/** The point at PNG pixel (x, y), or why it is not an answer (off the map, outside the extent). */
export function freezePointAt(x: number, y: number, extent: Extent): { readonly point: LatLon } | { readonly error: string } {
  const f = freezeFrame(extent);
  const mx = x - FREEZE_MAP_MARGIN_PX, my = y - FREEZE_MAP_MARGIN_PX;
  if (!Number.isFinite(x) || !Number.isFinite(y) || mx < 0 || my < 0 || mx > f.widthPx || my > f.heightPx) {
    return { error: `x,y must lie on the map: x ${FREEZE_MAP_MARGIN_PX}–${FREEZE_MAP_MARGIN_PX + f.widthPx}, y ${FREEZE_MAP_MARGIN_PX}–${FREEZE_MAP_MARGIN_PX + f.heightPx}` };
  }
  const point = latLonAtBasemapPx({ x: f.x0 + mx / f.scale, y: f.y0 + my / f.scale }, extent, f);
  if (!insideExtent(point, extent)) return { error: "that point lies outside the study area (the grey margin); choose a point inside the map's study area" };
  return { point };
}

/** The tiles (row, col) the frame overlaps, and each one's place in the PNG (the basemap is 4 × 4 tiles). */
export function freezeTiles(frame: FreezeFrame, tilePx: number, tiles: number): { readonly row: number; readonly col: number; readonly x: number; readonly y: number; readonly size: number }[] {
  const out: { row: number; col: number; x: number; y: number; size: number }[] = [];
  const lo = (v: number) => Math.max(0, Math.floor(v / tilePx)), hi = (v: number) => Math.min(tiles - 1, Math.floor(v / tilePx));
  for (let row = lo(frame.y0); row <= hi(frame.y0 + frame.h); row++) {
    for (let col = lo(frame.x0); col <= hi(frame.x0 + frame.w); col++) {
      out.push({ row, col, x: FREEZE_MAP_MARGIN_PX + (col * tilePx - frame.x0) * frame.scale, y: FREEZE_MAP_MARGIN_PX + (row * tilePx - frame.y0) * frame.scale, size: tilePx * frame.scale });
    }
  }
  return out;
}

/** The extent's outline in PNG pixels (the study area: an answer must lie inside it). */
export function extentOutlinePx(extent: Extent, frame: FreezeFrame = freezeFrame(extent)): { readonly x: number; readonly y: number }[] {
  return [
    { lat: extent.north, lon: extent.west }, { lat: extent.north, lon: extent.east }, { lat: extent.south, lon: extent.east }, { lat: extent.south, lon: extent.west },
  ].map((p) => { const b = basemapPx(p); return { x: FREEZE_MAP_MARGIN_PX + (b.x - frame.x0) * frame.scale, y: FREEZE_MAP_MARGIN_PX + (b.y - frame.y0) * frame.scale }; });
}
