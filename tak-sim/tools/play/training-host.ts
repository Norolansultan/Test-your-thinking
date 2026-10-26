/**
 * The play harness's link to the training incident (revision (bp), 26 Oct 2026; SPEC/15 (bp), SPEC/08 (bp)) and its map geometry.
 *
 * The SEAMS to work package B's session code, in one place, so the integration names them once:
 * - the step: `training_incident` (SPEC/15 §bp.1);
 * - the snapshot's training view (`TrainingView`, `app/session/training/host.ts`): read from `trainingIncident` (or `training`, if B
 *   named it so) while the step is on;
 * - the orchestrator's training methods (`TrainingHost`): called through that type, with a clear error when the orchestrator has none;
 * - the session option that turns the training on (`TRAINING_SESSION_OPTION`, assumed `trainingIncident` after the header's field).
 *
 * The geometry: the training's live map is locked to its square (`TRAINING.area`, plus `lockMarginM`): the harness draws its opening
 * frame ("2.5 km", the whole square) or a "1 km" frame, and labels a grid in the PNG's own pixels around the map, as `freeze-grid.ts`
 * labels the freeze map (play-test B12: a point read off the grid is the point the harness answers). The memory item's blank map is the
 * freeze map of the same lock box. Pure, apart from reading the snapshot.
 */

import type { SessionOptions, SessionOrchestrator, SessionSnapshot } from "../../app/session/orchestrator.js";
import type { TrainingHost, TrainingView } from "../../app/session/training/host.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { extentCamera, zoomForWidth, type Camera } from "../../app/render/map-frame.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { PlayError } from "./session.js";
import { LIVE_MAP_PX } from "./map-data.js";
import { lngLatAt } from "./map-camera.js";

/** SPEC/15 §bp.1: the training's step id. */
export const TRAINING_STEP_ID = "training_incident";

/**
 * The session option that turns the training on, as the app sets it in every session (SPEC/07 (bp): the header's `trainingIncident`).
 * Typed loosely: before the merge the option does not exist; if work package B named it otherwise, this is the one line to change.
 */
export const TRAINING_SESSION_OPTION = { trainingIncident: true } as unknown as Partial<SessionOptions>;

/** Whether the snapshot is the training's step. */
export function inTraining(s: SessionSnapshot): boolean {
  return (s.step as string) === TRAINING_STEP_ID;
}

/** The snapshot's training view (see the module comment), or null outside the training. */
export function trainingViewOf(s: SessionSnapshot): TrainingView | null {
  if (!inTraining(s)) return null;
  const o = s as unknown as { trainingIncident?: TrainingView | null; training?: unknown };
  if (o.trainingIncident) return o.trainingIncident;
  const t = o.training as TrainingView | null | undefined;
  return t && typeof t === "object" && "phase" in t ? t : null;
}

const HOST_METHODS = ["trainingStart", "trainingLeaveSection", "answerTraining", "leaveTrainingFeedback", "askTrainingHaku", "leaveTrainingDemo", "trainingSecondsLeft", "trainingStudySecondsLeft", "trainingCardSecondsLeft"] as const;

/** The orchestrator's training methods (work package B), or a clear refusal when this tree's orchestrator has none. */
export function trainingHostOf(o: SessionOrchestrator): TrainingHost {
  const h = o as unknown as Partial<Record<(typeof HOST_METHODS)[number], unknown>>;
  const missing = HOST_METHODS.filter((m) => typeof h[m] !== "function");
  if (missing.length > 0) throw new PlayError(`the session has no training methods (${missing.join(", ")}): the training incident's orchestrator (work package B) is not in this tree`);
  return o as unknown as TrainingHost;
}

/** The item on screen (its geometry and options; its words are `TRAINING_TEXT`), or null. */
export function trainingItemOf(view: TrainingView | null, spec: TrainingSpec = TRAINING): TrainingItem | null {
  return view?.itemId ? spec.items.find((i) => i.id === view.itemId) ?? null : null;
}

/**
 * The message log's clock in a section (SPEC/08 (bp) §bp.6): S2's scene shows the reports to 10.12 (`trn.r03`, `r05`, `r08`); S3's
 * shows all five, to the training's "now". Null when the log is not open.
 */
export function trainingLogUntil(view: TrainingView, spec: TrainingSpec = TRAINING): string | null {
  if (!view.tools.log) return null;
  return view.sectionId === "s2" ? "10.12" : spec.now.label;
}

// ---------------------------------------------------------------------------------------------------------------------------
// The map: the lock box, the frames, the grid in the PNG's own pixels
// ---------------------------------------------------------------------------------------------------------------------------

type Box = { readonly south: number; readonly north: number; readonly west: number; readonly east: number };

/** The grid's margin around the training's live map in the PNG (the labels sit in it), as the freeze map's. */
export const TRAINING_GRID_MARGIN_PX = 44;
export const TRAINING_GRID_STEP_PX = 50;
const FRAME_PAD_PX = 16;
const M_PER_DEG_LAT = 111_320;

/** The square plus the lock's margin: the live map cannot leave it, and the blank map shows it. */
export function trainingLockBox(spec: TrainingSpec = TRAINING): Box {
  const b = spec.area.bounds, m = spec.area.lockMarginM;
  const dLat = m / M_PER_DEG_LAT, dLon = m / (M_PER_DEG_LAT * Math.cos((((b.south + b.north) / 2) * Math.PI) / 180));
  return { south: b.south - dLat, north: b.north + dLat, west: b.west - dLon, east: b.east + dLon };
}

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
