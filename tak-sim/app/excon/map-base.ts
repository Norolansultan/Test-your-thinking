/**
 * EXCON (SPEC/28 §8) — a MapLibre map on the participant's basemap: the generated site's topographic tiles
 * (`site-meta.json`, served from `app/render/ui/public/maps/`, no network) and the sector outlines, exactly
 * as `MapView.tsx` adds them. The truth map dims the basemap (the white cell's dark display); the participant
 * map keeps it as the participant sees it.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import siteMeta from "../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../i18n/place-names.js";
import { addOverlayLines } from "../render/ui/map-overlay.js";
import type { LatLon, Polygon } from "../engine/primitives.js";

type Corners = [[number, number], [number, number], [number, number], [number, number]];
const TOPO_TILES = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as Corners }));

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#0d1117" } }],
};

export type Bounds = [[number, number], [number, number]];

/** The bounding box of every ring given, padded by `padM` metres: the camera's opening frame. */
export function boundsOf(polygons: readonly Polygon[], padM = 400): Bounds {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of polygons) for (const r of p) for (const q of r) {
    w = Math.min(w, q.lon); e = Math.max(e, q.lon); s = Math.min(s, q.lat); n = Math.max(n, q.lat);
  }
  const dLat = padM / 111_320;
  const dLon = padM / (111_320 * Math.cos((((s + n) / 2) * Math.PI) / 180));
  return [[w - dLon, s - dLat], [e + dLon, n + dLat]];
}

export interface ExconMapOptions {
  readonly dim: boolean;
  readonly bounds: Bounds;
}

export function createExconMap(container: HTMLElement, opts: ExconMapOptions): MapLibreMap {
  const map = new maplibregl.Map({
    container,
    style: STYLE,
    bounds: opts.bounds,
    fitBoundsOptions: { padding: 12 },
    dragRotate: false,
    pitchWithRotate: false,
    doubleClickZoom: true,
    attributionControl: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");
  map.on("load", () => {
    TOPO_TILES.forEach((tile, i) => {
      map.addSource(`topo-${i}`, { type: "image", url: topoTileUrl(tile.url, "en"), coordinates: tile.corners });
      map.addLayer({
        id: `topo-basemap-${i}`, type: "raster", source: `topo-${i}`,
        paint: opts.dim
          ? { "raster-fade-duration": 0, "raster-brightness-max": 0.3, "raster-saturation": -0.6, "raster-contrast": 0.1 }
          : { "raster-fade-duration": 0 },
      });
    });
    addOverlayLines(map);
  });
  return map;
}

/** Keeps two maps' cameras together (pan and zoom either; the other follows). */
export function linkCameras(a: MapLibreMap, b: MapLibreMap): void {
  let syncing = false;
  const follow = (from: MapLibreMap, to: MapLibreMap) => () => {
    if (syncing) return;
    syncing = true;
    to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
    syncing = false;
  };
  a.on("move", follow(a, b));
  b.on("move", follow(b, a));
}

type Feature = GeoJSON.Feature;
const ring = (r: readonly LatLon[]) => r.map((p) => [p.lon, p.lat]);

export const polygonFeature = (poly: readonly (readonly LatLon[])[], props: Record<string, unknown> = {}): Feature => ({
  type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: poly.map(ring) },
});
export const lineFeature = (line: readonly LatLon[], props: Record<string, unknown> = {}): Feature => ({
  type: "Feature", properties: props, geometry: { type: "LineString", coordinates: ring(line) },
});

export function setFeatures(map: MapLibreMap, sourceId: string, features: Feature[]): void {
  const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  src?.setData({ type: "FeatureCollection", features });
}

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
