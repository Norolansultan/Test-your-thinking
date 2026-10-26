/**
 * The play harness's link to the training incident (revision (bp), 26 Oct 2026; SPEC/15 (bp), SPEC/08 (bp)) and its map geometry.
 *
 * The session side is work package B's orchestrator: the step `training_incident`, the snapshot's `training` view (`TrainingView`) and,
 * while the step is on, the snapshot's map scene, message log and Haku turns, which are the training's (`app/session/training/view.ts`);
 * the training's methods (`TrainingHost`, `noteTrainingMeasure`, `trainingDemoSecondsLeft`); the option `trainingIncident`, which the app
 * sets in every session.
 *
 * The geometry: the training's live map is locked to its square (`TRAINING.area`, plus `lockMarginM`; `training-lock.ts`): the harness
 * draws its opening frame ("2.5 km", the whole square) or a "1 km" frame, and labels a grid in the PNG's own pixels around the map, as
 * `freeze-grid.ts` labels the freeze map (play-test B12: a point read off the grid is the point the harness answers). The memory item's
 * blank map is the freeze map of the same lock box. Pure, apart from reading the snapshot.
 */

import type { SessionSnapshot } from "../../app/session/orchestrator.js";
import type { TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { trainingLockBox } from "../../app/session/training/area.js";
import { extentCamera, zoomForWidth, type Camera } from "../../app/render/map-frame.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { LIVE_MAP_PX } from "./map-data.js";
import { lngLatAt } from "./map-camera.js";

export { trainingLockBox };

/** Whether the snapshot is the training's step (SPEC/15 §bp.1). */
export function inTraining(s: SessionSnapshot): boolean {
  return s.step === "training_incident";
}

/** The snapshot's training view, or null outside the training. */
export function trainingViewOf(s: SessionSnapshot): TrainingView | null {
  return inTraining(s) ? s.training : null;
}

/** The item on screen (its geometry and options; its words are `TRAINING_TEXT`), or null. */
export function trainingItemOf(view: TrainingView | null, spec: TrainingSpec = TRAINING): TrainingItem | null {
  return view?.itemId ? spec.items.find((i) => i.id === view.itemId) ?? null : null;
}

// ---------------------------------------------------------------------------------------------------------------------------
// The map: the lock box, the frames, the grid in the PNG's own pixels
// ---------------------------------------------------------------------------------------------------------------------------

/** The grid's margin around the training's live map in the PNG (the labels sit in it), as the freeze map's. */
export const TRAINING_GRID_MARGIN_PX = 44;
export const TRAINING_GRID_STEP_PX = 50;
/** `MapView`'s frame padding: the locked map's opening frame fits the square inside it (`MapView`, `lockedFrame`). */
const FRAME_PAD_PX = 16;

export const TRAINING_MOVES = ["2.5km", "1km", "reset"] as const;

/** The opening frame: the whole square ("2.5 km"). */
export function trainingOpening(spec: TrainingSpec = TRAINING): Camera {
  return extentCamera(spec.area.bounds, LIVE_MAP_PX.width, LIVE_MAP_PX.height, FRAME_PAD_PX);
}

/** The camera after a zoom button ("2.5 km", "1 km", reset) and an optional centre (a pixel of the last PNG), kept inside the lock. */
export function moveTrainingCamera(from: Camera, move: (typeof TRAINING_MOVES)[number] | null, atPng: readonly [number, number] | null, spec: TrainingSpec = TRAINING): Camera {
  let camera = from;
  if (atPng) { const p = trainingPointAt(atPng[0], atPng[1], camera, spec); if ("point" in p) camera = { ...camera, center: [p.point.lon, p.point.lat] }; }
  if (move === "2.5km" || move === "reset") camera = trainingOpening(spec);
  if (move === "1km") camera = { ...camera, zoom: zoomForWidth(1_000, LIVE_MAP_PX.width, (spec.area.bounds.south + spec.area.bounds.north) / 2) };
  const box = trainingLockBox(spec);
  return { center: [Math.min(box.east, Math.max(box.west, camera.center[0])), Math.min(box.north, Math.max(box.south, camera.center[1]))], zoom: camera.zoom };
}

/** The WGS84 point at PNG pixel (x, y) of the training's live map drawn with `camera`, or why it is not an answer. */
export function trainingPointAt(x: number, y: number, camera: Camera, spec: TrainingSpec = TRAINING): { readonly point: LatLon } | { readonly error: string } {
  const m = TRAINING_GRID_MARGIN_PX;
  const mx = x - m, my = y - m;
  if (!Number.isFinite(x) || !Number.isFinite(y) || mx < 0 || my < 0 || mx > LIVE_MAP_PX.width || my > LIVE_MAP_PX.height) {
    return { error: `x,y must lie on the map: x ${m}–${m + LIVE_MAP_PX.width}, y ${m}–${m + LIVE_MAP_PX.height} (the image's grid labels)` };
  }
  const [lon, lat] = lngLatAt(camera, mx, my);
  const box = trainingLockBox(spec);
  if (lat < box.south || lat > box.north || lon < box.west || lon > box.east) return { error: "that point lies outside the training's area (the map is locked to it)" };
  return { point: { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 } };
}

/** Great-circle metres between two points (the R&B tool's distance, for the `measures` the answer carries). */
export function metresBetween(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180, R = 6_371_008.8;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
