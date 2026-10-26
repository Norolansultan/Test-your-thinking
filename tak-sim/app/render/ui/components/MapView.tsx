import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { SessionSnapshot } from "../../../session/orchestrator.js";
import type { LatLon, Polygon } from "../../../engine/primitives.js";
import siteMeta from "../../../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../../../i18n/place-names.js";
import { WindIndicator } from "./WindIndicator.js";
import { crewLinks, MAP_ELEMENT_EVENT, OWN_FORMATION_HUE, setMarkerLang, setMarkerStyle, syncUnitMarkers, unitMarkerData, type MapElementEventDetail } from "../unit-markers.js";
import { addTakLayers, applyTakOverlays, setFootprintFilter, updateTakPlanMarks } from "../tak/tak-map.js";
import type { TakOverlayState } from "../tak/shell.js";
import { addFireLayers, declutterFireLabels, onFireLabelsPlaced, updateFireLayers } from "../fire-layers.js";
import { declutterUnitMarkers, edgeLines, spotSymbols } from "../unit-stacks.js";
import { addOverlayLabels, addOverlayLines } from "../map-overlay.js";
import { inputOf, viewportDetail, ViewportThrottle } from "../../viewport-log.js";
import type { MapUseEvent } from "../../../session/orchestrator.js";
import type { ViewportChangedDetail } from "../../../telemetry/record-kinds.js";
import { Legend, legendPresence } from "./Legend.js";
import { extentCamera, openingCamera, panBounds, zoomForWidth } from "../../map-frame.js";
import { useLang } from "../i18n.js";
import { assetUrl } from "../../../session/asset-url.js";
import { lockMaxBounds, tilesMeeting, type MapLock } from "../training-lock.js";

// Own formations and the participant's own marks. The fire and projection layers take all their
// styling from fire-theme.json (fire-layers.ts, SPEC/12 revision 24 Sep (c)): no blue or purple
// there, because blue means own forces here.
const HUE = {
  own_formation: OWN_FORMATION_HUE, // cyan-blue
  participant_correction: "#ffe600", // yellow, on a dark casing (CVD-separable from the fire edge)
};

function toGeoJSONPolygon(polygon: Polygon) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: polygon.map((ring) => ring.map((p) => [p.lon, p.lat])) },
  };
}

function toGeoJSONLine(line: readonly LatLon[]) {
  return { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line.map((p) => [p.lon, p.lat]) } };
}

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as ReturnType<typeof toGeoJSONPolygon>[] };

/**
 * Flat background, kept as the base layer under the L521 basemap image added
 * below — what still shows if that image fails to load for any reason, so
 * failure degrades to "flat dark map" rather than a blank canvas. Earlier
 * this pointed at a public demo tile style (demotiles.maplibre.org) directly
 * from the browser; that made the preview silently dependent on outbound
 * network access, which fails closed (a blank grey canvas, no error shown)
 * in any sandboxed or offline environment.
 */
const OFFLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#12151a" } }],
};

/**
 * The generated site basemap — `tools/topo-map/{build.ts,render.py}`
 * (SPEC/23 §11), served as a static local file (`public/maps/topo.webp`). No
 * network request at all, so I3 ("no network during a run") holds.
 *
 * Georeferencing comes straight from `app/scenario/site-meta.json`, written
 * by the same build step: `cornersWgs84` is the image's four corners
 * (NW, NE, SE, SW) in the ETRS-TM35FIN map-sheet grid, converted to WGS84.
 * The image is not a lat/lon rectangle (grid convergence), which MapLibre's
 * four-corner image source represents.
 *
 * Replaces the earlier hardcoded MML sheet L521 (`public/maps/L521.png`),
 * which was a real place ~21 km from the scenario's actual geography — see
 * SPEC/23 §1.
 */
type Corners = [[number, number], [number, number], [number, number], [number, number]];
/**
 * The basemap as a 4 × 4 grid of image sources, each with its own exact corners (written by
 * tools/topo-map/build.ts). One 5000 px image froze the browser for tens of seconds while
 * MapLibre uploaded it as a single texture (end-to-end test, 24 Sep 2026).
 */
const TOPO_TILES = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as Corners }));

/**
 * Fixed zoom levels — SPEC/06 §4.5 ("change between fixed zoom levels"), SPEC/23 §8, SPEC/12 revision (aj). Each
 * preset is content-independent: Area and Sector set a ground width across the map about the participant's own
 * centre, and "7 km" (`palo`, `widthM: null`) returns to the whole study area (`extentCamera`; revision (am): no longer the
 * opening frame, which is the closer 5 km box, `openingCamera`) — never
 * the fire's own bounds, a spot fire or the active front, which would tell the participant where to look. The
 * widest level exists because later scenarios add other groups working the same fire (neighbouring sectors, other
 * formations), not only the participant's own; it is also where a second fire in the region would be seen.
 *
 * Play-test, 24 Oct 2026: both players expected "Palo" / "Fire" to zoom to the fire. Revision (aj) rules that out (no
 * preset frames the fire), so the button is named for what it shows, the ~7 × 7 km study area: "7 km", as the closest
 * reads "2 km" ("Alue", the 20 km region, is a different frame). The level id stays `palo`, so the records are unchanged.
 */
export const ZOOM_LEVELS = [
  { id: "alue", labelFi: "Alue", widthM: 20_000 },
  { id: "palo", labelFi: "7 km", widthM: null }, // the whole study area (`extentCamera`); "Palo" until 24 Oct 2026
  { id: "lohko", labelFi: "2 km", widthM: 2_000 }, // the button reads "2 km" (revision (al); was "Lohko", which named no sector)
] as const;
export type ZoomLevelId = (typeof ZOOM_LEVELS)[number]["id"];

/** The map never gets shorter than this; the column under it scrolls instead (SessionView, review 9 Oct 2026). */
export const MAP_MIN_HEIGHT_PX = 300;

/** Pannable area: the widest level around the incident, plus a margin. */
const PAN_LIMIT_M = 12_000;

/** Clear margin around the study area in the opening frame, px. */
const FRAME_PAD_PX = 16;

/**
 * The TAK shell's hold on the live map (SPEC/28 §5), for its tools: the cursor readout, Range & Bearing, the plan marks
 * and the Contacts pane. `markParticipantMove` precedes a move the participant asked for with a button (a contact
 * selected): the move is then logged as `viewport_changed` input `preset`, and the opening frame no longer follows the
 * map's size — the camera still never moves by itself (SPEC/12 revision (aj)).
 */
export interface TakMapHandle {
  readonly map: MapLibreMap;
  markParticipantMove(): void;
}

/** The TAK shell's map options (SPEC/28 §5): 2525 symbols, the Overlay Manager's state, the shell's chrome. Absent: the classic map. */
export interface TakMapOptions {
  readonly overlays: TakOverlayState;
  readonly onMap: (handle: TakMapHandle | null) => void;
  readonly planLabels: { readonly main: string; readonly secondary: string; readonly drones: string };
  /** The legend's own-forces samples as 2525 symbols (SVG markup, `tak/tak-symbols.ts`). */
  readonly legendSymbols: { readonly unit: string; readonly air: string };
}

export interface MapViewProps {
  readonly snapshot: SessionSnapshot;
  readonly extent: { readonly south: number; readonly north: number; readonly west: number; readonly east: number };
  /** Map-use logging (SPEC/07 revision (al)): `orchestrator.logMapUse`; resolves to the record's seq. Absent: nothing logged. */
  readonly onMapUse?: ((event: MapUseEvent) => Promise<number>) | undefined;
  /** The TAK shell (SPEC/28 §5); fixed for the session. Absent: the classic map. */
  readonly tak?: TakMapOptions | undefined;
  /** Drawn over the map, inside its frame (the TAK shell's info card and coordinate readout). */
  readonly children?: ComponentChildren;
  /**
   * SPEC/08 (bp) §bp.1 (the training incident; fixed for the map's life): the map locked to an area — the opening frame and lowest
   * zoom fit it, `maxBounds` is its lock, only the tiles meeting it load, its presets replace the zoom buttons, no reference overlay.
   */
  readonly lock?: MapLock | undefined;
}

export function MapView({ snapshot, extent, onMapUse, tak, children, lock }: MapViewProps) {
  const { t, lang } = useLang();
  setMarkerLang(lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  // Revision (am): the opening frame is none of the presets, so no button is lit until one is pressed.
  const [level, setLevel] = useState<string | null>(null);
  const lockRef = useRef(lock);
  const levels = lock?.presets ?? ZOOM_LEVELS.map((z) => ({ id: z.id, label: t.zoom[z.id as keyof typeof t.zoom] ?? z.labelFi, widthM: z.widthM }));
  // What the legend lists besides the view's own layers (revision (am)): stack badges and the region's other fires,
  // which depend on the camera (`declutterUnitMarkers`, the overlay's update); set after every relayout.
  const [drawn, setDrawn] = useState({ stacks: false, region: false });
  // Until the basemap is first drawn (MapLibre's first "idle" after the tiles and layers are added), a "loading" note
  // covers the map instead of black tile blocks (9 Oct 2026); after 20 s the map shows whatever it has.
  const [mapReady, setMapReady] = useState(false);
  const centre = { lat: (extent.south + extent.north) / 2, lon: (extent.west + extent.east) / 2 };

  // Map-use logging (SPEC/07 revision (al)). Never awaited and never fatal: a failed write must not stop the map.
  const logRef = useRef(onMapUse);
  logRef.current = onMapUse;
  // The TAK shell (SPEC/28 §5): its options, the aircraft under the pointer (the footprints overlay), the relayout.
  const takRef = useRef(tak);
  takRef.current = tak;
  const isTak = tak !== undefined;
  const hoveredRef = useRef<string | null>(null);
  const relayoutRef = useRef<() => void>(() => undefined);
  const viewportSeqRef = useRef(-1); // seq of the last viewport_changed (a click refers to it)
  const presetRef = useRef(false); // the next camera move comes from a zoom button
  const moveInputRef = useRef<NonNullable<ViewportChangedDetail["input"]>>("frame");
  const throttleRef = useRef(new ViewportThrottle());
  const log = (event: MapUseEvent) => { const send = logRef.current; if (send) void send(event).then((seq) => { if (event.kind === "viewport_changed") viewportSeqRef.current = seq; }).catch(() => undefined); };
  const logViewport = (map: MapLibreMap, cause: NonNullable<ViewportChangedDetail["cause"]>) =>
    log({ kind: "viewport_changed", detail: viewportDetail(map, snapshotRef.current.currentCycle, cause, cause === "move" || cause === "settle" ? moveInputRef.current : undefined) });

  /** A preset: "7 km" (id `palo`) shows the whole study area; Area and "2 km" set a width about the participant's own centre. */
  const applyLevel = (map: MapLibreMap, id: string) => {
    const widthM = levels.find((z) => z.id === id)!.widthM;
    if (widthM === null) { frameWhole(map); return; }
    map.easeTo({ zoom: zoomForWidth(widthM, map.getContainer().clientWidth || 1280, centre.lat), duration: 0 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 1280;
    const opening = openingCamera(extent, width, containerRef.current.clientHeight || 720, FRAME_PAD_PX);
    const first = lock ? extentCamera(lock.area, width, containerRef.current.clientHeight || 720, FRAME_PAD_PX) : opening; // locked: the whole area
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFFLINE_STYLE,
      center: [...first.center],
      zoom: first.zoom,
      minZoom: lock ? first.zoom : zoomForWidth(24_000, width, centre.lat), // locked: the lowest zoom is the frame of the whole area
      maxZoom: zoomForWidth(400, width, centre.lat),
      maxBounds: lock ? lockMaxBounds(lock) : panBounds(extent, PAN_LIMIT_M),
      // Trackpad/wheel/pinch zoom is on, clamped by minZoom/maxZoom above; the three ZOOM_LEVELS buttons jump to
      // fixed levels. Researcher decision, 10 Oct 2026 (SPEC/12 revision (al)): free zoom stays on and every camera change is
      // logged as `viewport_changed` (throttled while moving, one record when settled, `viewport-log.ts`), so the
      // zoom in force at any moment — and what was on screen — is recoverable from the log.
      doubleClickZoom: false,
      boxZoom: false,
      dragRotate: false,
      attributionControl: { compact: true, customAttribution: "Generated terrain, SPEC/23 §11" },
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation(); // pinch zooms, doesn't rotate — dragRotate is off too
    // The TAK shell draws MIL-STD-2525 symbols (SPEC/28 §2.3); the classic shell its own icons.
    setMarkerStyle(map, { symbology: takRef.current ? "2525" : "classic", labels: takRef.current?.overlays.labels ?? true });
    // Scale bar, metric; follows every zoom change (the legend holds the bottom-left corner). The TAK shell draws its own
    // scale bar in the coordinate readout, bottom-left.
    if (!takRef.current) map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }), "bottom-right");

    const showAircraft = (id: string) => {
      hoveredRef.current = id || null;
      for (const layer of ["footprints-fill", "footprints-line", "aircraft-tracks-line"]) if (map.getLayer(layer)) map.setFilter(layer, ["==", ["get", "platformId"], id]);
      if (takRef.current?.overlays.footprints) setFootprintFilter(map, true, null); // the TAK overlay shows every drone's footprint
    };
    containerRef.current.addEventListener("aircraft-hover", (e) => showAircraft((e as CustomEvent<string | null>).detail ?? ""));
    // After every settled move: the units' declutter, then the fire labels (which keep clear of the units), the overlay.
    let updateOverlay: () => boolean = () => false;
    const relayout = () => {
      const cycle = snapshotRef.current.renderTree.cycleInfo;
      const stacks = declutterUnitMarkers(map, spotSymbols(cycle), edgeLines(cycle)) > 0;
      declutterFireLabels(map);
      const region = updateOverlay();
      setDrawn((cur) => (cur.stacks === stacks && cur.region === region ? cur : { stacks, region }));
    };
    relayoutRef.current = relayout;
    map.on("moveend", relayout);
    // viewport_changed: 4 Hz while moving, one record when settled (`viewport-log.ts`).
    map.on("movestart", (e) => { moveInputRef.current = inputOf((e as { originalEvent?: unknown }).originalEvent, presetRef.current); throttleRef.current.settle(); });
    map.on("move", () => { if (loadedRef.current && throttleRef.current.move(performance.now())) logViewport(map, "move"); });
    map.on("moveend", () => { presetRef.current = false; throttleRef.current.settle(); if (loadedRef.current) logViewport(map, "settle"); });
    map.on("resize", () => { if (loadedRef.current) logViewport(map, "resize"); });
    // Pointer on a unit marker or a stack badge (`unit-markers.ts`, `unit-stacks.ts`).
    containerRef.current.addEventListener(MAP_ELEMENT_EVENT, (ev) => {
      const d = (ev as CustomEvent<MapElementEventDetail>).detail;
      if (d.type === "click") log({ kind: "click", detail: { targetKind: d.targetKind, targetId: d.targetId, viewportRef: viewportSeqRef.current, pointerType: d.pointerType ?? "mouse", button: d.button ?? 0 } });
      else log({ kind: d.type === "enter" ? "element_enter" : "element_leave", detail: { targetKind: d.targetKind, targetId: d.targetId } });
    });
    // Which fire labels are shown, when that changes (cheap; SPEC/07 revision (al)).
    let lastLabels = "";
    onFireLabelsPlaced(map, (shown, hidden) => {
      const key = `${snapshotRef.current.currentCycle}|${shown.join(",")}|${hidden.join(",")}`;
      if (key === lastLabels) return;
      lastLabels = key;
      log({ kind: "map_labels_placed", detail: { view: snapshotRef.current.currentCycle, shown, hidden } });
    });

    map.on("moveend", () => measureRef.current(map)); // the guided tour's boxes (SPEC/15 r.11)
    // The opening frame follows the map's size until the participant moves the map: the map's height changes just
    // after it opens (the decision strip, a situation question, the tour closing), and the whole study area stays in
    // view through that. Once the participant has moved the map, nothing moves it but the participant.
    map.on("movestart", (e) => { if ((e as { originalEvent?: unknown }).originalEvent) onDefaultRef.current = false; });
    map.on("resize", () => { if (onDefaultRef.current) frameDefault(map); });
    map.on("load", () => {
      (lock ? tilesMeeting(TOPO_TILES, lock.bounds) : TOPO_TILES).forEach((tile, i) => { // locked: only the tiles meeting the lock
        map.addSource(`topo-${i}`, { type: "image", url: assetUrl(topoTileUrl(tile.url, lang)), coordinates: tile.corners }); // English labels in English sessions (revision (ae))
        map.addLayer({ id: `topo-basemap-${i}`, type: "raster", source: `topo-${i}`, paint: { "raster-fade-duration": 0 } });
      });

      // The reference overlay (revisions (al), (am)): sector outlines under everything else, labels as DOM markers. Not on a locked map.
      if (!lock) addOverlayLines(map);
      if (!lock) updateOverlay = addOverlayLabels(map, lang, () => {
        const el = map.getContainer();
        return { areaZoom: zoomForWidth(20_000, el.clientWidth || 1280, centre.lat), paloZoom: extentCamera(extent, el.clientWidth || 1280, el.clientHeight || 720, FRAME_PAD_PX).zoom };
      });

      map.addSource("footprints", { type: "geojson", data: EMPTY_FC });
      map.addSource("aircraft-tracks", { type: "geojson", data: EMPTY_FC });
      map.addSource("crew-links", { type: "geojson", data: EMPTY_FC });

      // Sensor coverage: only for the aircraft under the pointer. Drawn around the fire all the time,
      // a drone's footprint (and DR3's perimeter loop) read as extra blue fire lines. A grounded
      // drone still shows as a gap: its symbol is gone from the map (SPEC/12 §6.5).
      map.addLayer({ id: "footprints-fill", type: "fill", source: "footprints", filter: ["==", ["get", "platformId"], ""], paint: { "fill-color": HUE.own_formation, "fill-opacity": 0.08 } });
      map.addLayer({ id: "footprints-line", type: "line", source: "footprints", filter: ["==", ["get", "platformId"], ""], paint: { "line-color": HUE.own_formation, "line-width": 1.2, "line-opacity": 0.8, "line-dasharray": [1, 2] } });
      // Fire and projection, SPEC/12 revision 24 Sep (c) §4 layers 2–7; units (8) go on top below.
      addFireLayers(map);
      // Crew to vehicle (SPEC/18 revision (m)): a hose line when water comes from the vehicle, else a faint link.
      map.addLayer({ id: "crew-links-line", type: "line", source: "crew-links", paint: {
        "line-color": HUE.own_formation,
        "line-width": ["case", ["get", "hose"], 2, 1],
        "line-opacity": ["case", ["get", "hose"], 0.9, 0.45],
      } });
      map.addLayer({ id: "aircraft-tracks-line", type: "line", source: "aircraft-tracks", filter: ["==", ["get", "platformId"], ""], paint: { "line-color": HUE.own_formation, "line-width": 1.5, "line-opacity": 0.8, "line-dasharray": [3, 2] } });

      // Correction: yellow dashes on a dark casing, so it holds on the pale basemap too.

      // The TAK shell's layers (plan marks under the fire, the R&B line on top) and its overlay state (SPEC/28 §5).
      const takNow = takRef.current;
      if (takNow) {
        addTakLayers(map);
        applyTakOverlays(map, takNow.overlays, null);
      }

      loadedRef.current = true;
      map.once("idle", () => setMapReady(true));
      updateLayers(map, snapshotRef.current);
      if (onDefaultRef.current) frameDefault(map); // the container's size may have settled since the map was made
      relayout();
      logViewport(map, "view_start"); // the first view's start: the map's pixel size and frame
      if (takNow) {
        updateTakPlanMarks(map, snapshotRef.current.recordedPlan, takNow.planLabels);
        takNow.onMap({ map, markParticipantMove: () => { presetRef.current = true; onDefaultRef.current = false; } });
      }
    });

    const readyFallback = setTimeout(() => setMapReady(true), 20_000);
    return () => {
      clearTimeout(readyFallback);
      takRef.current?.onMap(null);
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Where the fire and the projection are on screen, for the guided tour; re-measured after every move.
  const [boxes, setBoxes] = useState<{ fire: ScreenBox | null; projection: ScreenBox | null }>({ fire: null, projection: null });
  const measureRef = useRef<(map: MapLibreMap) => void>(() => undefined);
  measureRef.current = (map) => {
    const s = snapshotRef.current;
    const iso = s.currentEnvelope?.isochrones ?? [];
    const next = { fire: screenBox(map, s.renderTree.cycleInfo?.perimeter), projection: screenBox(map, iso.length > 0 ? iso[iso.length - 1]!.polygon : s.currentEnvelope?.polygon) };
    setBoxes((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  };

  // The camera never moves by itself (SPEC/12 revision (aj), 9 Oct 2026; researcher: the participant must notice
  // the important things and go there themselves). The map opens on one neutral frame — revision (am): a fixed 5 × 5 km
  // box about the extent's centre, a little closer than the whole study area, fitted inside the map (`openingCamera`) —
  // and every new view returns to it; the "7 km" button (id `palo`) shows the whole study area (`extentCamera`).
  // It reads nothing else from the snapshot. Before (revision (ah)), each
  // view framed the uncontained edge and the forecast, which in V13 put the north-edge flare-up — the planted
  // contradiction — in the frame. The frame depends only on the map's size, so it is identical for every participant
  // at a given window size.
  const onDefaultRef = useRef(true); // the map shows the opening frame, untouched since
  /** A locked map's frame (SPEC/08 (bp)): its whole area, fitted inside the map; it is also the lowest zoom. */
  const lockedFrame = (map: MapLibreMap, lockNow: MapLock) => {
    const el = map.getContainer();
    return extentCamera(lockNow.area, el.clientWidth || 1280, el.clientHeight || 720, FRAME_PAD_PX);
  };
  const frameDefault = (map: MapLibreMap) => {
    const el = map.getContainer();
    const { center, zoom } = openingCamera(extent, el.clientWidth || 1280, el.clientHeight || 720, FRAME_PAD_PX);
    const at = lockRef.current ? lockedFrame(map, lockRef.current) : { center, zoom };
    setLevel(null);
    if (lockRef.current) map.setMinZoom(at.zoom);
    map.jumpTo({ center: [...at.center], zoom: at.zoom });
    onDefaultRef.current = true;
  };
  /** The "7 km" preset (id `palo`, "Palo" / "Fire" until 24 Oct 2026): the whole study area (locked: the whole area), fitted inside the map. */
  const frameWhole = (map: MapLibreMap) => {
    const el = map.getContainer();
    const { center, zoom } = extentCamera(extent, el.clientWidth || 1280, el.clientHeight || 720, FRAME_PAD_PX);
    const at = lockRef.current ? lockedFrame(map, lockRef.current) : { center, zoom };
    map.jumpTo({ center: [...at.center], zoom: at.zoom });
  };
  useEffect(() => {
    const map = mapRef.current;
    // `map.isStyleLoaded()` never returns true for a style with no tile
    // sources to wait on (only ever the "load" event fires) — tracked with
    // our own flag instead of relying on that API.
    if (!map || !loadedRef.current) return;
    updateLayers(map, snapshot);
    measureRef.current(map);
  }, [snapshot]);
  // Every view starts from the same place (researcher, 9 Oct 2026): when a new view opens, the map returns to the
  // opening frame above (revision (am): the 5 km box), the same for every view and every participant, whatever the
  // participant did in the view before. It reads only that the view changed, never what the view contains.
  const viewRef = useRef(snapshot.currentCycle);
  useEffect(() => {
    const map = mapRef.current;
    if (viewRef.current === snapshot.currentCycle) return;
    viewRef.current = snapshot.currentCycle;
    if (map) frameDefault(map);
  }, [snapshot.currentCycle]);
  // Each view's start is logged with the map's pixel size and the opening frame (after the reset above).
  const loggedViewRef = useRef(snapshot.currentCycle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || loggedViewRef.current === snapshot.currentCycle) return;
    loggedViewRef.current = snapshot.currentCycle;
    logViewport(map, "view_start");
  }, [snapshot.currentCycle]);

  // The TAK shell's overlays (SPEC/28 §5): the markers' labels, the earlier perimeters, the footprints, the plan marks.
  // The projection and the current perimeter are never touched (`tak-map.ts`).
  const takOverlays = tak?.overlays;
  useEffect(() => {
    const map = mapRef.current;
    const opts = takRef.current;
    if (!map || !loadedRef.current || !opts) return;
    setMarkerStyle(map, { symbology: "2525", labels: opts.overlays.labels });
    applyTakOverlays(map, opts.overlays, hoveredRef.current);
    updateLayers(map, snapshotRef.current); // redraws the markers in the new style
    relayoutRef.current();
  }, [takOverlays]);
  // The participant's own plan marks follow the plan recorded in this view (and its revisions).
  const planKey = JSON.stringify(snapshot.recordedPlan);
  useEffect(() => {
    const map = mapRef.current;
    const opts = takRef.current;
    if (!map || !loadedRef.current || !opts) return;
    updateTakPlanMarks(map, snapshotRef.current.recordedPlan, opts.planLabels);
  }, [planKey]);

  const wind = snapshot.renderTree.cycleInfo?.wind;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: MAP_MIN_HEIGHT_PX }}>
      <div ref={containerRef} data-testid="main-map" data-ready={mapReady ? "1" : "0"} style={{ width: "100%", height: "100%" }} />
      {!mapReady && (
        <div role="status" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#12151a", color: "#c9ced4", fontSize: 13, pointerEvents: "none" }}>
          {t.mapLoading}
        </div>
      )}
      {/* Invisible boxes over the fire and the projection on screen: the guided tour points at them (SPEC/15 r.11). */}
      {boxes.fire && <div data-tour="fire" style={{ position: "absolute", ...boxes.fire, pointerEvents: "none" }} />}
      {boxes.projection && <div data-tour="projection" style={{ position: "absolute", ...boxes.projection, pointerEvents: "none" }} />}
      <div data-tour="zoom" style={{ position: "absolute", zIndex: 20, top: 8, right: 8, display: "flex", gap: 4 }}>
        {levels.map((z) => (
          <button
            key={z.id} data-testid={`zoom-${z.id}`}
            onClick={() => { setLevel(z.id); onDefaultRef.current = false; presetRef.current = true; if (mapRef.current) applyLevel(mapRef.current, z.id); }}
            style={isTak
              ? { padding: "6px 14px", minHeight: 32, borderRadius: 4, border: `1px solid ${level === z.id ? "#19c3d6" : "#26313a"}`, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "#f2f5f7", background: level === z.id ? "#0f7f8c" : "#0d1114e6" }
              : { padding: "4px 10px", borderRadius: 6, border: "1px solid #3a3f44", fontSize: 12, cursor: "pointer", color: "#e8eaed", background: level === z.id ? "#3a3f44" : "#1b1e22cc" }}
          >
            {z.label}
          </button>
        ))}
      </div>
      {/* The TAK shell shows the same wind reading in its info card (top-left). */}
      {wind && !isTak && <WindIndicator wind={wind} />}
      <Legend isoMinutes={snapshot.currentEnvelope?.isochrones.map((i) => i.minutes) ?? []}
        drawn={legendPresence(snapshot.renderTree.cycleInfo, snapshot.currentEnvelope !== null, drawn)}
        onToggle={(open) => log({ kind: "layer_toggled", detail: { layerId: "legend", newState: open } })}
        bottom={isTak ? 74 : 28} symbols={tak?.legendSymbols} />
      {children}
    </div>
  );
}

interface ScreenBox { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

/** A polygon's bounding box in the map container's pixels, clipped to the container; null if off screen. */
function screenBox(map: MapLibreMap, polygon: Polygon | null | undefined): ScreenBox | null {
  const ring = polygon?.[0];
  if (!ring || ring.length === 0) return null;
  const pts = ring.map((p) => map.project([p.lon, p.lat]));
  const el = map.getContainer();
  const left = Math.max(0, Math.min(...pts.map((p) => p.x))), right = Math.min(el.clientWidth, Math.max(...pts.map((p) => p.x)));
  const top = Math.max(0, Math.min(...pts.map((p) => p.y))), bottom = Math.min(el.clientHeight, Math.max(...pts.map((p) => p.y)));
  if (right - left < 4 || bottom - top < 4) return null;
  return { left: Math.round(left), top: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
}

function updateLayers(map: MapLibreMap, snapshot: SessionSnapshot) {
  const cycle = snapshot.renderTree.cycleInfo;
  updateFireLayers(map, cycle, snapshot.currentEnvelope, snapshot.language);

  // SPEC/12 §6.5: a footprint only while the platform is airborne — a grounded drone leaves a gap.
  const footprints = (cycle?.sensorFootprints ?? []).flatMap((f) => (f.geometry ? [{ ...toGeoJSONPolygon(f.geometry), properties: { platformId: f.platformId } }] : []));
  (map.getSource("footprints") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: footprints });
  (map.getSource("aircraft-tracks") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: (cycle?.aircraft ?? []).map((a) => ({ ...toGeoJSONLine(a.track), properties: { platformId: a.platformId } })) });
  const units = unitMarkerData(cycle?.unitPositions ?? {}, cycle?.unitWork ?? {}, cycle?.aircraft ?? []);
  syncUnitMarkers(map, units);
  declutterUnitMarkers(map, spotSymbols(cycle), edgeLines(cycle)); // before the fire labels' placement (next frame), which keeps clear of the units
  (map.getSource("crew-links") as GeoJSONSource)?.setData(crewLinks(units));
}
