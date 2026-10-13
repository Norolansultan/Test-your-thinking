/**
 * EXCON (SPEC/28 §8) — the two maps' layers.
 *
 * LEFT, truth: the CA fire now (morphing), the step's truth at its end, the horizon truth
 * (`actualPerimeterAtEnd`), the envelope with its flag colour and the breach geometry, the reported perimeter
 * the participant has, sensor footprints where the platforms really are, units and aircraft (2525).
 *
 * RIGHT, the participant's picture: the participant's own fire and projection layers (`addFireLayers` /
 * `updateFireLayers` from `app/render/ui/fire-layers.ts`, fed the render tree), every sensor footprint (the
 * participant sees one at a time, under the pointer), units and aircraft at their reported positions (2525).
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import type { Flag } from "../scenario/types.js";
import type { RenderTree } from "../render/render-tree.js";
import { addFireLayers, updateFireLayers } from "../render/ui/fire-layers.js";
import { sortedKeys } from "../engine/deterministic-object.js";
import { EMPTY_FC, lineFeature, polygonFeature, setFeatures } from "./map-base.js";
import { syncSymbols, type SymbolDatum } from "./symbol-markers.js";
import type { TruthFrame } from "./motion.js";
import type { ExconViewInfo } from "./world.js";

export const FLAG_COLOR: Readonly<Record<Flag, string>> = {
  holds: "#3fb950",
  breach_quantitative: "#f0b429",
  breach_categorical: "#f85149",
};
export const FLAG_LABEL: Readonly<Record<Flag, string>> = {
  holds: "HOLDS",
  breach_quantitative: "BREACH — quantitative",
  breach_categorical: "BREACH — categorical",
};

export const TRUTH_COLORS = {
  fireFill: "#ff6a1f",
  fireLine: "#ffa040",
  stepEnd: "#ffcf8a",
  horizon: "#ff3b3b",
  breach: "#ff2bd6",
  reported: "#c9d1d9",
  footprint: "#4fb3ff",
} as const;

export function addTruthLayers(map: MapLibreMap): void {
  for (const id of ["x-envelope", "x-horizon", "x-breach", "x-reported", "x-fire", "x-stepend", "x-footprints"]) map.addSource(id, { type: "geojson", data: EMPTY_FC });
  map.addLayer({ id: "x-footprints-fill", type: "fill", source: "x-footprints", paint: { "fill-color": TRUTH_COLORS.footprint, "fill-opacity": 0.07 } });
  map.addLayer({ id: "x-footprints-line", type: "line", source: "x-footprints", paint: { "line-color": TRUTH_COLORS.footprint, "line-width": 1, "line-opacity": 0.75, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "x-envelope-fill", type: "fill", source: "x-envelope", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.07 } });
  map.addLayer({ id: "x-envelope-line", type: "line", source: "x-envelope", paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "x-fire-fill", type: "fill", source: "x-fire", paint: { "fill-color": TRUTH_COLORS.fireFill, "fill-opacity": 0.42 } });
  map.addLayer({ id: "x-fire-line", type: "line", source: "x-fire", paint: { "line-color": TRUTH_COLORS.fireLine, "line-width": 2 } });
  map.addLayer({ id: "x-stepend-line", type: "line", source: "x-stepend", paint: { "line-color": TRUTH_COLORS.stepEnd, "line-width": 1, "line-opacity": 0.8, "line-dasharray": [1, 2] } });
  map.addLayer({ id: "x-reported-line", type: "line", source: "x-reported", paint: { "line-color": TRUTH_COLORS.reported, "line-width": 1.2, "line-opacity": 0.85 } });
  map.addLayer({ id: "x-horizon-line", type: "line", source: "x-horizon", paint: { "line-color": TRUTH_COLORS.horizon, "line-width": 1.6, "line-opacity": 0.95 } });
  map.addLayer({ id: "x-breach-fill", type: "fill", source: "x-breach", paint: { "fill-color": TRUTH_COLORS.breach, "fill-opacity": 0.26 } });
  map.addLayer({ id: "x-breach-line", type: "line", source: "x-breach", paint: { "line-color": TRUTH_COLORS.breach, "line-width": 2.2 } });
}

/** What changes only with the view: the envelope and its flag, the horizon truth, the breach, the reported fire. */
export function updateTruthView(map: MapLibreMap, view: ExconViewInfo): void {
  const color = FLAG_COLOR[view.flag];
  setFeatures(map, "x-envelope", [view.envelope.polygon, ...view.envelope.detachedParts].map((p) => polygonFeature(p, { color })));
  setFeatures(map, "x-horizon", view.truthAtHorizon.flatMap((p) => p.map((r) => lineFeature(r))));
  setFeatures(map, "x-breach", view.breach.map((p) => polygonFeature(p)));
  setFeatures(map, "x-reported", [view.spec.perimeter, ...view.spec.detachedFronts].flatMap((p) => p.map((r) => lineFeature(r))));
}

/** What moves every frame: the fire now, the step's end outline, footprints, units and aircraft. */
export function updateTruthFrame(map: MapLibreMap, frame: TruthFrame): void {
  setFeatures(map, "x-fire", frame.fire.map((p) => polygonFeature(p)));
  setFeatures(map, "x-stepend", frame.fireAtStepEnd.flatMap((p) => p.map((r) => lineFeature(r))));
  setFeatures(map, "x-footprints", frame.aircraft.flatMap((a) => (a.footprint ? [polygonFeature(a.footprint)] : [])));
  const symbols: SymbolDatum[] = [
    ...frame.units.map((u) => ({ id: u.id, at: u.at, faded: u.state !== "on_scene" })),
    ...frame.aircraft.map((a) => ({ id: a.id, at: a.at, faded: a.state !== "on_scene" })),
  ];
  syncSymbols(map, symbols);
}

export function addParticipantLayers(map: MapLibreMap): void {
  map.addSource("p-footprints", { type: "geojson", data: EMPTY_FC });
  map.addLayer({ id: "p-footprints-fill", type: "fill", source: "p-footprints", paint: { "fill-color": TRUTH_COLORS.footprint, "fill-opacity": 0.08 } });
  map.addLayer({ id: "p-footprints-line", type: "line", source: "p-footprints", paint: { "line-color": TRUTH_COLORS.footprint, "line-width": 1.2, "line-opacity": 0.8, "line-dasharray": [1, 2] } });
  addFireLayers(map);
}

/** The participant's picture: the render tree only (no truth can be in it; `toRenderable*` asserted that). */
export function updateParticipant(map: MapLibreMap, tree: RenderTree): void {
  const cycle = tree.cycleInfo;
  updateFireLayers(map, cycle, tree.envelope, "en");
  setFeatures(map, "p-footprints", (cycle?.sensorFootprints ?? []).flatMap((f) => (f.geometry ? [polygonFeature(f.geometry)] : [])));
  const units: SymbolDatum[] = cycle ? sortedKeys(cycle.unitPositions).map((id) => ({ id, at: cycle.unitPositions[id]! })) : [];
  const aircraft: SymbolDatum[] = (cycle?.aircraft ?? []).map((a) => ({ id: a.platformId, at: a.position }));
  syncSymbols(map, [...units, ...aircraft]);
}
