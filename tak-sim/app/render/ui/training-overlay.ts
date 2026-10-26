/**
 * The training incident's drawing on the live map (SPEC/08 (bp) §bp.3–§bp.5): what an item adds to its scene — the training's road
 * codes (R5–R7), the item's marks ("A", "B", "C", the pump ★, the fill points 1 and 2, a unit's symbol, a head mark) and, in its
 * feedback, the right answer (the green ring at a point key; the item's feedback ring, line and routes) and the participant's own mark
 * joined to it. The scene itself (the fire, the units, the memory unit during its exposure) is the snapshot's `renderTree.cycleInfo`,
 * drawn by `MapView` as for any view. Nothing is drawn during the memory exposure but the road codes; the blank memory-check map
 * (`FreezeMap`) gets none of it.
 *
 * `drawTrainingOverlay(map, view, item, lang)` adds its sources, layers and markers to a loaded MapLibre map and returns the function
 * that removes them (the screen redraws on every change of phase or item; the play harness calls it for its map picture).
 * `setTrainingMark` draws the participant's pending mark on a point item. Authored strings only (no participant text in markup).
 */

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LatLon } from "../../engine/primitives.js";
import type { Lang } from "../../i18n/lang.js";
import type { TrainingView } from "../../session/training/host.js";
import type { TrainingItem, TrainingMark, TrainingSpec } from "../../session/training/spec.js";
import { TRAINING } from "../../session/training/spec-data.js";
import { sidcOf } from "../../tak/symbols.js";
import { MARKER_Z } from "./fire-layers.js";
import { symbolSvg } from "./tak/tak-symbols.js";

export const TRAINING_COLOURS = { key: "#1e8e3e", answer: "#ffcc00", mark: "#d93025", water: "#1a73e8", line: "#f9ab00", route: "#1a73e8", ink: "#1c1b19" } as const;

const SRC = { lines: "training-lines", points: "training-points", mark: "training-mark" } as const;
const LAYERS = ["training-lines-casing", "training-lines", "training-points-ring", "training-points-dot"] as const;

type Feature = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: "LineString"; coordinates: number[][] } | { type: "Point"; coordinates: number[] } };
const lineOf = (pts: readonly LatLon[], colour: string): Feature => ({ type: "Feature", properties: { colour }, geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) } });
const pointOf = (p: LatLon, colour: string, ring: boolean): Feature => ({ type: "Feature", properties: { colour, ring: ring ? 1 : 0 }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
const fc = (features: Feature[]) => ({ type: "FeatureCollection" as const, features });

/** What the item's feedback draws: the key's ring, the feedback's own ring, line and routes, and the answer joined to a point key. */
export function trainingFeedbackFeatures(view: Pick<TrainingView, "answer">, item: Pick<TrainingItem, "key" | "feedback">): { lines: Feature[]; points: Feature[] } {
  const lines: Feature[] = [], points: Feature[] = [];
  const { ring, line, routes } = item.feedback;
  for (const r of routes ?? []) lines.push(lineOf(r, TRAINING_COLOURS.route));
  if (line && line.length > 1) lines.push(lineOf(line, TRAINING_COLOURS.line));
  if (ring && ring.length > 1) lines.push(lineOf([...ring, ring[0]!], TRAINING_COLOURS.key));
  const answer = view.answer && "point" in view.answer ? view.answer.point : null;
  if ("point" in item.key) {
    if (answer) lines.push(lineOf([answer, item.key.point], TRAINING_COLOURS.answer));
    points.push(pointOf(item.key.point, TRAINING_COLOURS.key, true));
  }
  if (answer) points.push(pointOf(answer, TRAINING_COLOURS.answer, false));
  return { lines, points };
}

function labelElement(html: string, css: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html; // authored: the training's road codes, mark labels and call signs
  el.style.cssText = `pointer-events:none;white-space:nowrap;z-index:${MARKER_Z.label};${css}`;
  return el;
}

const HALO = "text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff";

/** A mark as the training draws it: a lettered red dot, the pump's star, a numbered blue fill point, a unit's symbol, a head mark. */
function markElement(mark: TrainingMark): HTMLElement {
  const label = mark.label.replace(/[<>&"]/g, "");
  switch (mark.kind) {
    case "unit":
      return labelElement(`<div style="width:30px;height:30px">${symbolSvg(sidcOf(label), 28)}</div><div style="font:700 12px sans-serif;color:${TRAINING_COLOURS.ink};${HALO};text-align:center">${label}</div>`, "display:flex;flex-direction:column;align-items:center");
    case "star":
      return labelElement(`<span style="font:700 22px sans-serif;color:${TRAINING_COLOURS.mark};${HALO}">★</span>`, "");
    case "water":
      return labelElement(`<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${TRAINING_COLOURS.water};border:2px solid #fff;color:#fff;font:700 12px sans-serif">${label}</span>`, "");
    case "head":
      return labelElement(`<span style="font:700 16px sans-serif;color:${TRAINING_COLOURS.mark};${HALO}">▲ ${label}</span>`, "");
    case "point":
      return labelElement(`<span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:${TRAINING_COLOURS.mark};border:2px solid #fff"></span><span style="font:700 15px sans-serif;color:${TRAINING_COLOURS.mark};${HALO}">${label}</span></span>`, "");
  }
}

function ensureSources(map: MapLibreMap): void {
  if (!map.getSource(SRC.lines)) map.addSource(SRC.lines, { type: "geojson", data: fc([]) });
  if (!map.getSource(SRC.points)) map.addSource(SRC.points, { type: "geojson", data: fc([]) });
  if (!map.getLayer("training-lines-casing")) map.addLayer({ id: "training-lines-casing", type: "line", source: SRC.lines, paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 } });
  if (!map.getLayer("training-lines")) map.addLayer({ id: "training-lines", type: "line", source: SRC.lines, paint: { "line-color": ["get", "colour"], "line-width": 3 } });
  if (!map.getLayer("training-points-ring")) map.addLayer({ id: "training-points-ring", type: "circle", source: SRC.points, filter: ["==", ["get", "ring"], 1], paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": ["get", "colour"], "circle-stroke-width": 4 } });
  if (!map.getLayer("training-points-dot")) map.addLayer({ id: "training-points-dot", type: "circle", source: SRC.points, filter: ["==", ["get", "ring"], 0], paint: { "circle-radius": 7, "circle-color": ["get", "colour"], "circle-stroke-color": TRAINING_COLOURS.ink, "circle-stroke-width": 2 } });
}

/**
 * Draws the item's additions to its scene on a loaded map: the road codes always, the marks outside the memory exposure, the right
 * answer and the participant's mark in the feedback. Returns the cleanup that removes everything it added.
 */
export function drawTrainingOverlay(map: MapLibreMap, view: TrainingView, item: TrainingItem | null, _lang: Lang, spec: TrainingSpec = TRAINING): () => void {
  const markers: maplibregl.Marker[] = [];
  for (const r of spec.roadLabels) {
    const road = r.road.replace(/[<>&"]/g, "");
    markers.push(new maplibregl.Marker({ element: labelElement(`<span style="font:700 12px sans-serif;color:${TRAINING_COLOURS.ink};background:#fff;border:1px solid ${TRAINING_COLOURS.ink};border-radius:3px;padding:0 3px">${road}</span>`, "") }).setLngLat([r.at.lon, r.at.lat]).addTo(map));
  }
  if (item && view.phase !== "study") {
    for (const m of item.marks) markers.push(new maplibregl.Marker({ element: markElement(m) }).setLngLat([m.at.lon, m.at.lat]).addTo(map));
  }
  ensureSources(map);
  const drawn = item && view.phase === "feedback" ? trainingFeedbackFeatures(view, item) : { lines: [], points: [] };
  (map.getSource(SRC.lines) as GeoJSONSource).setData(fc(drawn.lines));
  (map.getSource(SRC.points) as GeoJSONSource).setData(fc(drawn.points));
  return () => {
    for (const m of markers) m.remove();
    try {
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SRC.lines, SRC.points]) if (map.getSource(id)) map.removeSource(id);
    } catch { /* the map is gone */ }
  };
}

/** The participant's pending mark on a point item (yellow, as the memory-check map's), or none. */
export function setTrainingMark(map: MapLibreMap, point: LatLon | null): void {
  const data = fc(point ? [pointOf(point, TRAINING_COLOURS.answer, false)] : []);
  const source = map.getSource(SRC.mark) as GeoJSONSource | undefined;
  if (source) { source.setData(data); return; }
  map.addSource(SRC.mark, { type: "geojson", data });
  map.addLayer({ id: "training-mark", type: "circle", source: SRC.mark, paint: { "circle-radius": 8, "circle-color": TRAINING_COLOURS.answer, "circle-stroke-color": "#000", "circle-stroke-width": 2 } });
}
