/**
 * `viewport_changed` (SPEC/07 §2.3, emitted from revision (al)): the live map's camera, so that what the participant
 * had on screen — and at what zoom — can be reconstructed for every moment of every view (region-of-interest
 * measures, `app/telemetry/map-use-measures.ts`; the zoom in force at a click). Free zoom by wheel, trackpad and
 * pinch stays on (researcher decision, 10 Oct 2026) and is logged here.
 *
 * Throttled to one record per `MOVE_INTERVAL_MS` (4 Hz) while the map moves, plus one when it settles; one at each
 * view start (the map's pixel size then) and one on a resize. Pure apart from the clock the caller passes.
 */

import type { ViewportChangedDetail } from "../telemetry/record-kinds.js";

export const MOVE_INTERVAL_MS = 250;

/** Decides which `move` events are logged: the first, then at most one per interval. Settles are always logged. */
export class ViewportThrottle {
  private lastMs = -Infinity;
  constructor(private readonly intervalMs: number = MOVE_INTERVAL_MS) {}
  move(nowMs: number): boolean {
    if (nowMs - this.lastMs < this.intervalMs) return false;
    this.lastMs = nowMs;
    return true;
  }
  /** The move ended: the next move starts a fresh interval. */
  settle(): void { this.lastMs = -Infinity; }
}

/** The part of a MapLibre map the record reads. */
export interface CameraSource {
  getCenter(): { readonly lat: number; readonly lng: number };
  getZoom(): number;
  getBounds(): { getSouth(): number; getNorth(): number; getWest(): number; getEast(): number };
  getContainer(): { readonly clientWidth: number; readonly clientHeight: number };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const r3 = (v: number) => Math.round(v * 1e3) / 1e3;

export function viewportDetail(map: CameraSource, view: number, cause: NonNullable<ViewportChangedDetail["cause"]>, input?: ViewportChangedDetail["input"]): ViewportChangedDetail {
  const c = map.getCenter(), b = map.getBounds(), el = map.getContainer();
  return {
    centre: { lat: r6(c.lat), lon: r6(c.lng) },
    zoom: r3(map.getZoom()),
    bbox: { south: r6(b.getSouth()), north: r6(b.getNorth()), west: r6(b.getWest()), east: r6(b.getEast()) },
    bearing: 0,
    mapPx: { width: el.clientWidth, height: el.clientHeight },
    view,
    cause,
    ...(input ? { input } : {}),
  };
}

/** What started a move, from MapLibre's `originalEvent` (none: the code moved it — a preset or the opening frame). */
export function inputOf(originalEvent: unknown, preset: boolean): NonNullable<ViewportChangedDetail["input"]> {
  const type = (originalEvent as { type?: string } | undefined)?.type ?? "";
  if (!originalEvent) return preset ? "preset" : "frame";
  if (type === "wheel") return "wheel";
  if (type.startsWith("touch")) return "touch";
  if (type.startsWith("key")) return "keyboard";
  return "drag";
}
