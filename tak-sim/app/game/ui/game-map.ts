/**
 * Game mode screen: the map. MapLibre with the study's topo raster tiles (as `MapView` adds them: image sources from
 * `scenario/site-meta.json`, `assetUrl`, English tiles via `topoTileUrl`), north-up, bounded to the playable 10 km grid
 * plus a margin. Over it: the fuel overlay and the fire (400 × 400 canvas sources on the grid's corners), the power line,
 * fire breaks, hose lines, the forecast, planned routes, drone sensor circles, structures; DOM markers for units and
 * places; a screen-space smoke canvas. The controller is imperative: the screen calls `update` when the game state or
 * the selection changes and `frame` on every animation frame.
 */

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { GameCommand, GameScenario, GameState, GameWorld, XY } from "../contracts.js";
import { gridCornersLngLat, lngLatToLocal } from "../world/geo.js";
import siteMeta from "../../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../../i18n/place-names.js";
import { assetUrl } from "../../session/asset-url.js";
import type { Lang } from "../../i18n/lang.js";
import { FireRaster, fuelCanvas } from "./fire-raster.js";
import type { ForecastView } from "./forecast-view.js";
import { assetPoints, fireBreakLines, forecastLines, gridFrame, hoseLines, lngLatOf, openingBox, pendingPoint, powerLineData, routeLines, sensorCircles } from "./map-data.js";
import { PlaceMarkers, UnitMarkers } from "./markers.js";
import { labelPoint } from "./outline.js";
import { SmokeLayer, type Affine } from "./smoke.js";
import { GM } from "./styles.js";
import { GAME_TEXT, type LayerId } from "./text.js";

type Corners = [[number, number], [number, number], [number, number], [number, number]];
const TOPO_TILES = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as Corners }));

/** How far the camera may pan beyond the playable grid, m. */
export const PAN_MARGIN_M = 1500;

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#12151a" } }],
};

export interface MapHandlers {
  readonly unit: (id: string, add: boolean) => void;
  readonly map: (at: XY) => void;
  readonly rightClick: (at: XY) => void;
  readonly water: (id: string) => void;
  readonly protectable: (id: string) => void;
}

export type Layers = Readonly<Record<LayerId, boolean>>;

const EMPTY = { type: "FeatureCollection" as const, features: [] };

export class GameMapController {
  readonly map: MapLibreMap;
  private readonly fire: FireRaster;
  private readonly smoke = new SmokeLayer();
  private readonly units: UnitMarkers;
  private places: PlaceMarkers | null = null;
  private loaded = false;
  private lastAssetKey: string | null = null;
  private lastCommands = -1;
  private lastPower: boolean | null = null;
  private forecastLabels: maplibregl.Marker[] = [];
  private pending: XY | null = null;
  private lastUpdate: Parameters<GameMapController["update"]> | null = null;
  private lastForecast: ForecastView | null = null;

  constructor(container: HTMLElement, private readonly world: GameWorld, private readonly lang: Lang, scenario: GameScenario, private readonly handlers: MapHandlers) {
    const grid = world.grid;
    const W = grid.cols * grid.cellM, H = grid.rows * grid.cellM;
    const sw = lngLatOf(grid, { x: -PAN_MARGIN_M, y: -PAN_MARGIN_M });
    const ne = lngLatOf(grid, { x: W + PAN_MARGIN_M, y: H + PAN_MARGIN_M });
    const nw = lngLatOf(grid, { x: -PAN_MARGIN_M, y: H + PAN_MARGIN_M });
    const se = lngLatOf(grid, { x: W + PAN_MARGIN_M, y: -PAN_MARGIN_M });
    const bounds: [[number, number], [number, number]] = [[Math.min(sw[0], nw[0]), Math.min(sw[1], se[1])], [Math.max(ne[0], se[0]), Math.max(ne[1], nw[1])]];
    const protectIds = scenario.objectives.flatMap((o) => (o.kind === "protect_settlement" ? [o.settlementId] : []));
    // The opening frame: the fire and the command post (the settlements are on the briefing map; zoom out for them).
    const open = openingBox(world, scenario.ignitions, []);
    this.map = new maplibregl.Map({
      container, style: STYLE, bounds: [lngLatOf(grid, open.min), lngLatOf(grid, open.max)], fitBoundsOptions: { padding: 24 },
      maxBounds: bounds, maxZoom: 17, minZoom: 9,
      dragRotate: false, pitchWithRotate: false, doubleClickZoom: false, boxZoom: false,
      attributionControl: { compact: true, customAttribution: "Generated terrain, SPEC/23 §11" },
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disable(); // the game's keys (Space, M, A …) must not pan the map
    this.fire = new FireRaster(grid.cols, grid.rows);
    this.map.getCanvasContainer().appendChild(this.smoke.canvas);
    this.units = new UnitMarkers(this.map, world, handlers.unit);
    const protectedIds = new Set(protectIds);
    this.map.on("load", () => {
      // Zooming out stops a little beyond the whole grid.
      const whole = this.map.cameraForBounds([lngLatOf(grid, { x: 0, y: 0 }), lngLatOf(grid, { x: W, y: H })], { padding: 8 });
      if (whole?.zoom !== undefined) this.map.setMinZoom(Math.max(8, whole.zoom - 0.4));
      this.addLayers();
      this.places = new PlaceMarkers(this.map, world, lang, protectedIds, { water: handlers.water, settlement: handlers.protectable });
      this.loaded = true;
      if (this.lastUpdate) this.update(...this.lastUpdate);
      this.setForecast(this.lastForecast);
    });
    this.map.on("click", (e) => this.onClick(e));
    this.map.on("contextmenu", (e) => { e.preventDefault(); this.handlers.rightClick(this.local(e)); });
  }

  private local(e: MapMouseEvent): XY {
    return lngLatToLocal(this.world.grid, [e.lngLat.lng, e.lngLat.lat]);
  }

  private onClick(e: MapMouseEvent): void {
    const target = e.originalEvent.target;
    if (target instanceof Element && target.closest(".gm-marker")) return; // a marker handled it
    const p = e.point;
    const hits = this.loaded ? this.map.queryRenderedFeatures([[p.x - 7, p.y - 7], [p.x + 7, p.y + 7]], { layers: ["gm-assets"] }) : [];
    const asset = hits.find((f) => typeof f.properties?.["id"] === "string" && f.properties["kind"] !== "power_pylon");
    if (asset) { this.handlers.protectable(String(asset.properties["id"])); return; }
    this.handlers.map(this.local(e));
  }

  private addLayers(): void {
    const map = this.map;
    const grid = this.world.grid;
    TOPO_TILES.forEach((tile, i) => {
      map.addSource(`topo-${i}`, { type: "image", url: assetUrl(topoTileUrl(tile.url, this.lang)), coordinates: tile.corners });
      map.addLayer({ id: `topo-${i}`, type: "raster", source: `topo-${i}`, paint: { "raster-fade-duration": 0 } });
    });
    const corners = gridCornersLngLat(grid).map((c) => [c[0], c[1]]) as Corners;
    map.addSource("gm-fuel", { type: "canvas", canvas: fuelCanvas(grid.cols, grid.rows, this.world.fuel), coordinates: corners, animate: false });
    map.addLayer({ id: "gm-fuel", type: "raster", source: "gm-fuel", layout: { visibility: "none" }, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0, "raster-opacity": 0.85 } });
    map.addSource("gm-frame", { type: "geojson", data: gridFrame(grid) });
    map.addLayer({ id: "gm-frame", type: "line", source: "gm-frame", paint: { "line-color": "#0d1114", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [4, 3] } });
    map.addSource("gm-fire", { type: "canvas", canvas: this.fire.canvas, coordinates: corners, animate: true });
    map.addLayer({ id: "gm-fire", type: "raster", source: "gm-fire", paint: { "raster-resampling": "linear", "raster-fade-duration": 0 } });
    const geo = (id: string) => map.addSource(id, { type: "geojson", data: EMPTY });
    for (const id of ["gm-power", "gm-breaks", "gm-hose", "gm-forecast", "gm-routes", "gm-sensors", "gm-assets", "gm-pending"]) geo(id);
    map.addLayer({ id: "gm-power", type: "line", source: "gm-power", paint: { "line-color": ["case", ["get", "live"], "#ffd400", "#9aa5ad"], "line-width": 2.5, "line-dasharray": [3, 1.5] } });
    map.addLayer({ id: "gm-breaks", type: "line", source: "gm-breaks", paint: { "line-color": GM.fireBreak, "line-width": 4, "line-dasharray": [2, 1.2] } });
    map.addLayer({ id: "gm-hose", type: "line", source: "gm-hose", paint: { "line-color": GM.hose, "line-width": 3 } });
    map.addLayer({ id: "gm-forecast", type: "line", source: "gm-forecast", paint: {
      "line-color": ["case", ["==", ["get", "min"], 20], GM.forecast20, GM.forecast40], "line-width": 2, "line-dasharray": [2, 2],
    } });
    map.addLayer({ id: "gm-routes", type: "line", source: "gm-routes", paint: {
      "line-color": ["case", ["get", "selected"], GM.select, "#e8f4ff"], "line-width": ["case", ["get", "selected"], 2.5, 1.5], "line-opacity": 0.9, "line-dasharray": [2, 2],
    } });
    map.addLayer({ id: "gm-sensors", type: "fill", source: "gm-sensors", paint: { "fill-color": "#4fb3ff", "fill-opacity": 0.05 } });
    map.addLayer({ id: "gm-sensors-line", type: "line", source: "gm-sensors", paint: { "line-color": "#4fb3ff", "line-width": 1, "line-opacity": 0.45, "line-dasharray": [1, 2] } });
    map.addLayer({ id: "gm-assets", type: "circle", source: "gm-assets", paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["==", ["get", "kind"], "power_pylon"], 1.5, 2.5], 15, ["case", ["==", ["get", "kind"], "power_pylon"], 3, 6]],
      "circle-color": ["match", ["get", "status"], "burned", "#1c1b19", "protected", "#19c3d6", "#f2f5f7"],
      "circle-stroke-color": ["match", ["get", "status"], "burned", GM.danger, "#0d1114"],
      "circle-stroke-width": ["match", ["get", "status"], "burned", 2, 1],
    } });
    map.addLayer({ id: "gm-pending", type: "circle", source: "gm-pending", paint: { "circle-radius": 6, "circle-color": GM.fireBreak, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  }

  private setData(id: string, data: unknown): void {
    (this.map.getSource(id) as GeoJSONSource | undefined)?.setData(data as Parameters<GeoJSONSource["setData"]>[0]);
  }

  /** The game state, selection or layers changed. */
  update(state: GameState, commands: readonly GameCommand[], selected: ReadonlySet<string>, layers: Layers): void {
    this.lastUpdate = [state, commands, selected, layers];
    this.units.sync(state.units, selected, layers.labels);
    if (!this.loaded) return;
    const grid = this.world.grid;
    this.places?.setLabels(layers.labels);
    this.setData("gm-routes", routeLines(this.world, state.units, selected));
    this.setData("gm-hose", hoseLines(grid, state.units));
    this.setData("gm-sensors", layers.sensors ? sensorCircles(grid, state.units) : EMPTY);
    if (commands.length !== this.lastCommands) { this.lastCommands = commands.length; this.setData("gm-breaks", fireBreakLines(grid, commands)); }
    if (state.powerLineLive !== this.lastPower) { this.lastPower = state.powerLineLive; this.setData("gm-power", powerLineData(this.world, state.powerLineLive)); }
    let assetKey = "";
    for (const a of this.world.assets) { const s = state.assetStatus[a.id]; if (s && s !== "intact") assetKey += `${a.id}:${s};`; }
    if (assetKey !== this.lastAssetKey) {
      this.lastAssetKey = assetKey;
      this.setData("gm-assets", assetPoints(this.world, state.assetStatus));
    }
    this.map.setLayoutProperty("gm-fuel", "visibility", layers.fuel ? "visible" : "none");
  }

  /** The forecast outlines (null: hidden). */
  setForecast(f: ForecastView | null): void {
    this.lastForecast = f;
    for (const m of this.forecastLabels) m.remove();
    this.forecastLabels = [];
    if (!this.loaded) return;
    const grid = this.world.grid;
    this.setData("gm-forecast", f ? forecastLines(grid, f.horizons) : EMPTY);
    if (!f) return;
    const t = GAME_TEXT[this.lang];
    for (const h of f.horizons) {
      const at = labelPoint(h.rings, h.min === 20 ? "south" : "north");
      if (!at) continue;
      const el = document.createElement("div");
      el.className = `gm-fclabel${h.min === 40 ? " h40" : ""}`;
      el.textContent = t.forecastLabel(h.min);
      this.forecastLabels.push(new maplibregl.Marker({ element: el, anchor: h.min === 20 ? "top" : "bottom", offset: [0, h.min === 20 ? 2 : -2] }).setLngLat(lngLatOf(grid, at)).addTo(this.map));
    }
  }

  /** Targeting: crosshair cursor and the first point of a fire break. */
  setTargeting(on: boolean, pending: XY | null): void {
    this.map.getContainer().classList.toggle("targeting", on);
    if (pending !== this.pending) {
      this.pending = pending;
      if (this.loaded) this.setData("gm-pending", pendingPoint(this.world.grid, pending));
    }
  }

  /** Every animation frame: the fire's flicker and the smoke. `dtS` is real seconds since the last frame while running. */
  frame(state: GameState, ms: number, dtS: number, truth: boolean, fog = true): void {
    if (!this.loaded) return;
    this.fire.draw(state, ms, truth, fog);
    this.smoke.frame(dtS, this.fire.flamingCells, this.world.grid, state.weather, this.affine(), this.metresPerPx(), true);
  }

  private affine(): Affine {
    const grid = this.world.grid;
    const W = grid.cols * grid.cellM, H = grid.rows * grid.cellM;
    const o = this.map.project(lngLatOf(grid, { x: 0, y: 0 }));
    const ex = this.map.project(lngLatOf(grid, { x: W, y: 0 }));
    const ny = this.map.project(lngLatOf(grid, { x: 0, y: H }));
    return [(ex.x - o.x) / W, (ny.x - o.x) / H, o.x, (ex.y - o.y) / W, (ny.y - o.y) / H, o.y];
  }

  private metresPerPx(): number {
    const lat = this.map.getCenter().lat;
    return (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** this.map.getZoom();
  }

  /** Centres the map on a point (a unit chosen in the list). */
  flyTo(at: XY): void {
    this.map.easeTo({ center: lngLatOf(this.world.grid, at), duration: 400 });
  }

  destroy(): void {
    this.units.remove();
    this.places?.remove();
    for (const m of this.forecastLabels) m.remove();
    this.map.remove();
  }
}
