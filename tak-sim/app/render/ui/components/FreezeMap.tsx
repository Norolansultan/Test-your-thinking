import { useEffect, useRef, useState } from "preact/hooks";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { GeoExtent, LatLon } from "../../../engine/primitives.js";
import { insideExtent } from "../../../session/freeze-answers.js";
import siteMeta from "../../../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../../../i18n/place-names.js";
import { extentCamera, openingCamera } from "../../map-frame.js";
import { useLang } from "../i18n.js";
import { assetUrl } from "../../../session/asset-url.js";
import { FREEZE_LOCK_PADS, lockLimits, tilesMeeting, type MapLock } from "../training-lock.js";

/**
 * A `map_point` freeze item's map (SPEC/15 r.12): the generated topographic basemap and nothing
 * else — no fire, burnt area, projection, units, aircraft or messages — so the freeze stays
 * PROBING_BLANKED (SPEC/08 §4). Revision (ap), 10 Oct 2026: the map fills the card (full width, the height left
 * under the question; was a square box of at most 360 px) and opens on the live map's opening frame, the 5 × 5 km
 * box about the extent's centre (`openingCamera`, SPEC/12 revision (am)); every map key lies inside it
 * (`test/session/freeze-map-frame.spec.ts`). The frame depends on no view and points at no answer (revision (aj)).
 * The basemap covers ~20 km, so a wide box shows basemap beyond the box, never black bands. The participant may
 * zoom in (wheel, double click, +/−) and pan, within the pan limit, and zoom out as far as the whole study area
 * (`extentCamera`); rotation is off. Zooming shows nothing but the basemap. A tap inside the extent marks the point;
 * a second tap moves the mark.
 *
 * The style and the tiles are the same as MapView's (a flat background under the 4 × 4 image
 * grid from `site-meta.json`, no network), copied here so MapView stays untouched.
 */
type Corners = [[number, number], [number, number], [number, number], [number, number]];
const TOPO_TILES = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as Corners }));
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#12151a" } }],
};
const MARK = "#ffcc00";
/** Clear margin around the study area in the opening frame, px. */
const FRAME_PAD_PX = 8;
/**
 * Revision (ap): the pan and zoom limit is the basemap itself (~20 × 20 km), so a wide, low box never shows black
 * beyond it: MapLibre zooms in as far as needed to keep the view on the basemap (was 12 km from the centre).
 */
const BASEMAP_BOUNDS: [[number, number], [number, number]] = (() => {
  const c = TOPO_TILES.flatMap((t) => t.corners);
  return [[Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1]))], [Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))]];
})();

type Extent = Pick<GeoExtent, "south" | "north" | "west" | "east">;

function pointFeature(p: LatLon | null) {
  return {
    type: "FeatureCollection" as const,
    features: p ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] } }] : [],
  };
}

/** The memory-check map's camera at a tap (logged with it, `freeze_map_pick`, SPEC/07 revision (al)). */
export interface PickCamera { readonly zoom: number; readonly centre: LatLon; readonly mapPx: { readonly width: number; readonly height: number } }

/**
 * `lock` (SPEC/08 (bp) §bp.1, the training incident's memory check): the blank map is locked as the training's live map is — it opens
 * on the whole area, fitted clear of its zoom buttons and scale bar (`FREEZE_LOCK_PADS`), cannot zoom out past that frame or pan beyond
 * what it shows (`lockLimits`, set again on every resize; review 27 Oct 2026), and loads only the tiles meeting the lock.
 */
export function FreezeMap({ extent, point, onPick, lock }: { readonly extent: Extent; readonly point: LatLon | null; readonly onPick: (point: LatLon, camera: PickCamera) => void; readonly lock?: MapLock | undefined }) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pointRef = useRef(point);
  pointRef.current = point;
  // Until the basemap is drawn (MapLibre's first "idle" after the tiles are added) the map is covered by a
  // "loading" note and taps are ignored, so no point is marked on a black, half-loaded map and the item cannot be
  // completed or sent before the participant has seen the map (9 Oct 2026). A slow device gets the map after 20 s.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const limits = () => (lock ? lockLimits(lock, el.clientWidth || 600, el.clientHeight || 600, FREEZE_LOCK_PADS) : null);
    const frame = () => limits()?.camera ?? openingCamera(extent, el.clientWidth || 600, el.clientHeight || 600, FRAME_PAD_PX);
    const outermostZoom = () => limits()?.camera.zoom ?? extentCamera(extent, el.clientWidth || 600, el.clientHeight || 600, FRAME_PAD_PX).zoom;
    const opening = frame();
    const map = new maplibregl.Map({
      container: el,
      style: BLANK_STYLE,
      center: [...opening.center],
      zoom: opening.zoom,
      maxBounds: BASEMAP_BOUNDS,
      boxZoom: false,
      dragRotate: false,
      keyboard: false,
      touchZoomRotate: false,
      touchPitch: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    map.on("click", (e: MapMouseEvent) => {
      const p = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      const c = map.getCenter();
      const camera = { zoom: Math.round(map.getZoom() * 1000) / 1000, centre: { lat: c.lat, lon: c.lng }, mapPx: { width: el.clientWidth, height: el.clientHeight } };
      if (readyRef.current && insideExtent(p, extent)) onPickRef.current(p, camera);
    });
    // The opening frame follows the box's size until the participant moves the map; the outermost view is the
    // whole study area.
    const onDefault = { current: true };
    // A locked map's limits follow its size: `maxBounds` is what its frame shows, its lowest zoom that frame (SPEC/08 (bp)).
    const relimit = () => {
      const l = limits();
      if (!l) return;
      map.setMaxBounds(null);
      map.setMinZoom(l.camera.zoom);
      map.setMaxBounds(l.maxBounds);
    };
    const refit = () => {
      const { center, zoom } = frame();
      if (lock) map.setMaxBounds(null);
      map.setMinZoom(null);
      map.jumpTo({ center: [...center], zoom });
      map.setMinZoom(Math.min(zoom, outermostZoom()));
      relimit();
    };
    map.on("movestart", (e) => { if ((e as { originalEvent?: unknown }).originalEvent) onDefault.current = false; });
    relimit(); // locked: the frame's limits from the start
    // A locked map at its lowest zoom shows exactly its frame: it is fitted again when its size changes (the listener below); zoomed
    // in, it keeps its camera and gets its limits at the new size (SPEC/08 (bp)).
    if (lock) {
      const atFrame = { current: true };
      map.on("moveend", () => { atFrame.current = map.getZoom() <= map.getMinZoom() + 1e-6; });
      map.on("resize", () => { if (atFrame.current) onDefault.current = true; else if (!onDefault.current) relimit(); });
    }
    map.on("resize", () => { if (onDefault.current) refit(); });
    map.on("load", () => {
      (lock ? tilesMeeting(TOPO_TILES, lock.bounds) : TOPO_TILES).forEach((tile, i) => {
        map.addSource(`topo-${i}`, { type: "image", url: assetUrl(topoTileUrl(tile.url, lang)), coordinates: tile.corners }); // English labels in English sessions (revision (ae))
        map.addLayer({ id: `topo-basemap-${i}`, type: "raster", source: `topo-${i}`, paint: { "raster-fade-duration": 0 } });
      });
      map.addSource("pick", { type: "geojson", data: pointFeature(pointRef.current) });
      map.addLayer({ id: "pick-circle", type: "circle", source: "pick", paint: { "circle-color": MARK, "circle-radius": 8, "circle-stroke-color": "#000", "circle-stroke-width": 2 } });
      loadedRef.current = true;
      if (onDefault.current) refit(); // the box's size may have settled since the map was made
      map.once("idle", markReady);
    });
    const markReady = () => { if (!readyRef.current) { readyRef.current = true; setReady(true); } };
    const fallback = setTimeout(markReady, 20_000);
    return () => {
      clearTimeout(fallback);
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("pick") as GeoJSONSource | undefined)?.setData(pointFeature(point));
  }, [point]);

  return (
    <div style={{ marginBottom: 12, flex: "1 0 auto", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{point ? t.freezeMapMarked : t.freezeMapHint}</div>
      {/* Revision (ap): fills the card, full width and the height left under the question, at least 200 px, so at
          1280×529 the item, the map and its confidence row still fit with no overlap (9 Oct 2026); on a larger
          window the map grows with it (was a square box of at most 360 px). */}
      <div style={{ position: "relative", flex: 1, display: "flex", minHeight: 200 }}>
        <div style={{ position: "relative", flex: "1 1 auto", alignSelf: "stretch", borderRadius: 6, overflow: "hidden", border: "1px solid #3a3f44" }}>
          <div
            ref={containerRef}
            data-testid="freeze-map" data-ready={ready ? "1" : "0"}
            style={{ position: "absolute", inset: 0, cursor: ready ? "crosshair" : "progress" }}
          />
          {!ready && (
            <div role="status" style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", background: "#12151a", color: "#c9ced4", fontSize: 13 }}>
              {t.mapLoading}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
