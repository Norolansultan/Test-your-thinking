/**
 * The TAK shell's map glue (SPEC/28 §5): the Overlay Manager's layers, the participant's own plan marks and the Range &
 * Bearing line, on the live MapLibre map that `MapView` builds. It never touches the fire and projection layers of
 * `fire-layers.ts` (SPEC/12's drawing rules are load-bearing): an overlay state names only the earlier perimeters, the
 * sensor footprints and the plan marks (`overlayLayerVisibility`), and the projection and current perimeter cannot be
 * hidden. Reads the participant's own recorded plan and the public sector outlines only (no truth, I4).
 */

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LatLon } from "../../../engine/primitives.js";
import type { SectorPlan } from "../../../scenario/plan-types.js";
import { SECTOR_OUTLINES } from "../map-overlay.js";
import { MARKER_Z } from "../fire-layers.js";
import { overlayLayerVisibility, type TakOverlayState } from "./shell.js";
import { formatBearing, formatRange, rangeBearing } from "./RangeBearing.js";
import { TAK } from "./theme.js";

const EMPTY = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

/** The container classes the shell's stylesheet (`TAK_MAP_CSS`) reads: overlays drawn as DOM markers are hidden by class. */
export const HIDE_PAST_LABELS = "tak-hide-past-labels";
export const HIDE_PLAN_MARKS = "tak-hide-plan-marks";

/** CSS for the classes above; the shell mounts it once. */
export const TAK_MAP_CSS = `.${HIDE_PAST_LABELS} .fire-label-past{display:none!important}.${HIDE_PLAN_MARKS} .tak-plan-label{display:none!important}`;

/**
 * Adds the shell's sources and layers. The plan marks go under the fire (beneath the burnt area), so they never cover the
 * perimeter or the projection; the R&B line goes on top. Call once, after `addFireLayers`.
 */
export function addTakLayers(map: MapLibreMap): void {
  map.addSource("tak-plan", { type: "geojson", data: EMPTY });
  const below = map.getLayer("fire-burnt-fill") ? "fire-burnt-fill" : undefined;
  map.addLayer({ id: "tak-plan-fill", type: "fill", source: "tak-plan", paint: { "fill-color": TAK.own, "fill-opacity": ["get", "fill"] } }, below);
  map.addLayer({ id: "tak-plan-line", type: "line", source: "tak-plan", paint: { "line-color": TAK.own, "line-width": ["get", "width"], "line-opacity": 0.9, "line-dasharray": [3, 2] } }, below);
  map.addSource("tak-rb", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "tak-rb-casing", type: "line", source: "tak-rb", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#000000", "line-width": 5, "line-opacity": 0.55 } });
  map.addLayer({ id: "tak-rb-line", type: "line", source: "tak-rb", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": TAK.rb, "line-width": 2.5 } });
  map.addLayer({ id: "tak-rb-ends", type: "circle", source: "tak-rb", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": TAK.rb, "circle-stroke-color": "#000000", "circle-stroke-width": 1.5 } });
}

/** Applies an overlay state: layer visibility, the DOM-label classes, and the footprints' filter (all, or the hovered aircraft only). */
export function applyTakOverlays(map: MapLibreMap, state: TakOverlayState, hovered: string | null): void {
  for (const [id, on] of overlayLayerVisibility(state)) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  const el = map.getContainer();
  el.classList.toggle(HIDE_PAST_LABELS, !state.past_perimeters);
  el.classList.toggle(HIDE_PLAN_MARKS, !state.plan_marks);
  setFootprintFilter(map, state.footprints, hovered);
}

/** Sensor footprints: every airborne drone's when the overlay is on; otherwise only the aircraft under the pointer (the classic map's rule). */
export function setFootprintFilter(map: MapLibreMap, all: boolean, hovered: string | null): void {
  for (const layer of ["footprints-fill", "footprints-line"]) {
    if (map.getLayer(layer)) map.setFilter(layer, all ? null : ["==", ["get", "platformId"], hovered ?? ""]);
  }
}

const planLabels = new WeakMap<MapLibreMap, maplibregl.Marker[]>();

/**
 * The participant's own plan on the map (SPEC/12 §6.2, the anticipated convention: dashed): the main effort's sector
 * outlined heavier, the secondary sector lighter, the drones' sector dotted-light, each with a small role label. From the
 * plan recorded in this view only; nothing before the participant records one.
 */
export function updateTakPlanMarks(map: MapLibreMap, plan: SectorPlan | null, labels: { readonly main: string; readonly secondary: string; readonly drones: string }): void {
  const roles: { sectorId: string; label: string; width: number; fill: number }[] = [];
  if (plan) {
    roles.push({ sectorId: plan.mainEffort, label: labels.main, width: 3, fill: 0.1 });
    if (plan.secondary) roles.push({ sectorId: plan.secondary.sectorId, label: labels.secondary, width: 2, fill: 0.05 });
    if (plan.drones) roles.push({ sectorId: plan.drones.sectorId, label: labels.drones, width: 1.5, fill: 0 });
  }
  const features: GeoJSON.Feature[] = [];
  for (const r of roles) {
    const sector = SECTOR_OUTLINES.find((s) => s.id === r.sectorId);
    if (!sector) continue;
    features.push({ type: "Feature", properties: { width: r.width, fill: r.fill }, geometry: { type: "Polygon", coordinates: sector.geometry.map((ring) => ring.map((p) => [p.lon, p.lat])) } });
  }
  (map.getSource("tak-plan") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  for (const m of planLabels.get(map) ?? []) m.remove();
  const markers: maplibregl.Marker[] = [];
  // Labels for the same sector (main effort and drones) stack under each other.
  const bySector = new Map<string, string[]>();
  for (const r of roles) bySector.set(r.sectorId, [...(bySector.get(r.sectorId) ?? []), r.label]);
  for (const [sectorId, texts] of bySector) {
    const sector = SECTOR_OUTLINES.find((s) => s.id === sectorId);
    if (!sector) continue;
    const at = sector.labelAt;
    const el = document.createElement("div");
    el.className = "tak-plan-label";
    el.textContent = texts.join(" · ");
    el.style.cssText = `pointer-events:none;white-space:nowrap;padding:1px 4px;border:1px dashed ${TAK.own};border-radius:3px;background:#0b0f12d9;color:${TAK.own};font:700 9px/1.2 ui-monospace,Consolas,monospace;z-index:${MARKER_Z.overlay}`;
    markers.push(new maplibregl.Marker({ element: el, anchor: "top", offset: [0, 8] }).setLngLat([at.lon, at.lat]).addTo(map));
  }
  planLabels.set(map, markers);
}

const rbLabels = new WeakMap<MapLibreMap, maplibregl.Marker>();

/** Draws (or with `to` null, the first point of) a Range & Bearing measurement; it stays until `clearRangeBearing`. */
export function setRangeBearing(map: MapLibreMap, from: LatLon, to: LatLon | null, lang: "fi" | "en"): void {
  const pt = (p: LatLon): GeoJSON.Feature => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
  const features: GeoJSON.Feature[] = [pt(from)];
  if (to) {
    features.push(pt(to), { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[from.lon, from.lat], [to.lon, to.lat]] } });
  }
  (map.getSource("tak-rb") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  rbLabels.get(map)?.remove();
  rbLabels.delete(map);
  if (!to) return;
  const r = rangeBearing(from, to);
  const el = document.createElement("div");
  el.setAttribute("data-testid", "tak-rb-label");
  el.textContent = `${formatRange(r.metres, lang)} · ${formatBearing(r.bearingDeg)}`;
  el.style.cssText = `pointer-events:none;white-space:nowrap;padding:2px 6px;border-radius:3px;background:#0b0f12e6;border:1px solid ${TAK.rb};color:#ffffff;font:700 11px/1.2 ui-monospace,Consolas,monospace;z-index:${MARKER_Z.hover}`;
  const mid = { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };
  rbLabels.set(map, new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -6] }).setLngLat([mid.lon, mid.lat]).addTo(map));
}

export function clearRangeBearing(map: MapLibreMap): void {
  (map.getSource("tak-rb") as GeoJSONSource | undefined)?.setData(EMPTY);
  rbLabels.get(map)?.remove();
  rbLabels.delete(map);
}
