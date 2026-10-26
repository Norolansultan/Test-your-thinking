/**
 * WGS84 → the basemap image's pixels (`site-meta.json`: a `sizePx` square whose four corners' WGS84 positions are known; tiles of
 * `sizePx / 4` named `<row>_<col>`). The inverse of the corners' bilinear map, by Newton's method: exact at the corners and within a
 * fraction of a pixel inside (the TM35 image is nearly a parallelogram in WGS84 over 20 km). Used by the practice feedback's small map
 * (`PracticeFeedbackScreen`), which draws the basemap's own tiles, and (revision (bp)) inverted by `basemapLatLon` for the training
 * incident's marks; pure.
 */

import type { LatLon } from "../../engine/primitives.js";
import siteMeta from "../../scenario/site-meta.json" with { type: "json" };

type C = readonly [number, number];
type Quad = readonly [C, C, C, C]; // NW, NE, SE, SW (lon, lat)
const IMAGE = siteMeta.cornersWgs84 as unknown as Quad;
export const BASEMAP_SIZE_PX: number = siteMeta.sizePx;
export const BASEMAP_TILES = 4;
export const BASEMAP_TILE_PX = BASEMAP_SIZE_PX / BASEMAP_TILES;
const TILE_QUADS: ReadonlyMap<string, Quad> = new Map(siteMeta.tiles.map((t) => [t.url.replace(/^.*\/(\d_\d)\.webp$/, "$1"), t.corners as unknown as Quad]));

/** The WGS84 position (lon, lat) at fractions u (west→east), v (north→south) of a quadrilateral. */
function at(q: Quad, u: number, v: number): C {
  const [nw, ne, se, sw] = q;
  const lerp = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return lerp(lerp(nw, ne, u), lerp(sw, se, u), v);
}

/** The fractions (u, v) of a quadrilateral at a WGS84 point: the bilinear map inverted by Newton's method. */
function fractions(q: Quad, p: LatLon): { readonly u: number; readonly v: number } {
  let u = 0.5, v = 0.5;
  for (let k = 0; k < 12; k++) {
    const [lon, lat] = at(q, u, v);
    const h = 1e-6;
    const [lu, au] = at(q, u + h, v), [lv, av] = at(q, u, v + h);
    const a = (lu - lon) / h, b = (lv - lon) / h, c = (au - lat) / h, d = (av - lat) / h;
    const det = a * d - b * c;
    const ex = p.lon - lon, ey = p.lat - lat;
    u += (d * ex - b * ey) / det;
    v += (-c * ex + a * ey) / det;
  }
  return { u, v };
}

/** A WGS84 point's position on the basemap, in image pixels (x east, y south): the image's corners first, then its tile's own. */
export function basemapPx(p: LatLon): { readonly x: number; readonly y: number } {
  const g = fractions(IMAGE, p);
  const clamp = (f: number) => Math.max(0, Math.min(BASEMAP_TILES - 1, Math.floor(f * BASEMAP_TILES)));
  const row = clamp(g.v), col = clamp(g.u);
  const tile = TILE_QUADS.get(`${row}_${col}`);
  if (!tile) return { x: g.u * BASEMAP_SIZE_PX, y: g.v * BASEMAP_SIZE_PX };
  const t = fractions(tile, p);
  return { x: (col + t.u) * BASEMAP_TILE_PX, y: (row + t.v) * BASEMAP_TILE_PX };
}

/**
 * The inverse of {@link basemapPx}: a basemap pixel (x east, y south; a fraction allowed) as WGS84, through the tile that holds it
 * (its own corners' bilinear map), else the image's corners. Exact at the tiles' corners and within a fraction of a pixel inside, as
 * `basemapPx` is; the training incident's build (`tools/review/training.ts`, SPEC/08 (bp) §bp.9) writes its marks with it.
 */
export function basemapLatLon(px: { readonly x: number; readonly y: number }): LatLon {
  const clamp = (v: number) => Math.max(0, Math.min(BASEMAP_TILES - 1, Math.floor(v / BASEMAP_TILE_PX)));
  const row = clamp(px.y), col = clamp(px.x);
  const tile = TILE_QUADS.get(`${row}_${col}`);
  const [lon, lat] = tile
    ? at(tile, px.x / BASEMAP_TILE_PX - col, px.y / BASEMAP_TILE_PX - row)
    : at(IMAGE, px.x / BASEMAP_SIZE_PX, px.y / BASEMAP_SIZE_PX);
  return { lat, lon };
}

/** The tiles (row, col) a pixel window overlaps. */
export function tilesFor(x0: number, y0: number, x1: number, y1: number): readonly { readonly row: number; readonly col: number }[] {
  const out: { row: number; col: number }[] = [];
  const lo = (v: number) => Math.max(0, Math.floor(v / BASEMAP_TILE_PX)), hi = (v: number) => Math.min(BASEMAP_TILES - 1, Math.floor(v / BASEMAP_TILE_PX));
  for (let row = lo(y0); row <= hi(y1); row++) for (let col = lo(x0); col <= hi(x1); col++) out.push({ row, col });
  return out;
}
