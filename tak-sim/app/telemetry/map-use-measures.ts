/**
 * Map-use covariates (SPEC/09 revision (al)), derived in analysis from the raw `viewport_changed` log — never at
 * runtime (SPEC/07 §3). For each view and each region of interest (`app/render/map-rois.ts`): how long any part of
 * the region was on screen, when it first came into view (ms from the view's start) and at what zoom, and the closest
 * zoom while it was on screen. Plus, per view, how the participant moved the map (settled moves by input).
 *
 * Time is the records' `tWallOffsetMs` (real milliseconds). The map is hidden during a freeze (`freeze_started` to
 * `freeze_submitted`), so that time does not count. A view runs from its `cycle_start` to its `view_ended` (or the
 * next `cycle_start`, `cycle_end` or `session_completed`).
 */

import type { LogRecord } from "./log.js";
import type { ViewportChangedDetail } from "./record-kinds.js";
import type { MapRoi, RoiBox } from "../render/map-rois.js";

export interface RoiMeasure {
  readonly view: number;
  readonly roiId: string;
  readonly viewMs: number;
  /** Map visible (not frozen) during the view, ms. */
  readonly mapVisibleMs: number;
  readonly onScreenMs: number;
  /** ms from the view's start to the first moment the region was on screen; null if never. */
  readonly firstInViewMs: number | null;
  readonly zoomAtFirst: number | null;
  readonly maxZoomOnScreen: number | null;
}

export interface ViewMapUse {
  readonly view: number;
  /** Settled moves by what moved the map (`wheel`, `drag`, `touch`, `keyboard`, `preset`, `frame`). */
  readonly settlesByInput: Readonly<Record<string, number>>;
  readonly maxZoom: number | null;
  /** The map's size at the view's start, CSS px. */
  readonly mapPxAtStart: { readonly width: number; readonly height: number } | null;
}

const intersects = (r: RoiBox, b: ViewportChangedDetail["bbox"]) => r.west < b.east && b.west < r.east && r.south < b.north && b.south < r.north;

interface Acc { view: number; startMs: number; visibleMs: number; perRoi: Map<string, { on: number; first: number | null; zoomFirst: number | null; maxZoom: number | null }>; settles: Record<string, number>; maxZoom: number | null; mapPxAtStart: ViewportChangedDetail["mapPx"] | null | undefined }

export function mapUseMeasures(records: readonly LogRecord[], rois: readonly MapRoi[]): { readonly rois: RoiMeasure[]; readonly views: ViewMapUse[] } {
  const roiOut: RoiMeasure[] = [];
  const viewOut: ViewMapUse[] = [];
  let acc: Acc | null = null;
  let vp: ViewportChangedDetail | null = null;
  let frozen = false;
  let lastMs = 0;

  const boxesFor = (view: number) => rois.flatMap((r) => (r.boxes[view] ? [{ id: r.id, box: r.boxes[view]! }] : []));
  const advance = (t: number) => {
    if (acc && !frozen && vp) {
      const dt = Math.max(0, t - lastMs);
      acc.visibleMs += dt;
      for (const { id, box } of boxesFor(acc.view)) if (intersects(box, vp.bbox)) acc.perRoi.get(id)!.on += dt;
    }
    lastMs = t;
  };
  const noteInView = (t: number) => {
    if (!acc || frozen || !vp) return;
    for (const { id, box } of boxesFor(acc.view)) {
      if (!intersects(box, vp.bbox)) continue;
      const m = acc.perRoi.get(id)!;
      if (m.first === null) { m.first = t - acc.startMs; m.zoomFirst = vp.zoom; }
      m.maxZoom = Math.max(m.maxZoom ?? -Infinity, vp.zoom);
    }
  };
  const close = () => {
    if (!acc) return;
    for (const { id } of boxesFor(acc.view)) {
      const m = acc.perRoi.get(id)!;
      roiOut.push({ view: acc.view, roiId: id, viewMs: lastMs - acc.startMs, mapVisibleMs: acc.visibleMs, onScreenMs: m.on, firstInViewMs: m.first, zoomAtFirst: m.zoomFirst, maxZoomOnScreen: m.maxZoom });
    }
    viewOut.push({ view: acc.view, settlesByInput: acc.settles, maxZoom: acc.maxZoom, mapPxAtStart: acc.mapPxAtStart ?? null });
    acc = null;
  };

  for (const r of records) {
    advance(r.tWallOffsetMs);
    switch (r.kind) {
      case "cycle_start": {
        close();
        const view = (r.detail as { cycle: number }).cycle;
        acc = { view, startMs: r.tWallOffsetMs, visibleMs: 0, perRoi: new Map(boxesFor(view).map(({ id }) => [id, { on: 0, first: null, zoomFirst: null, maxZoom: null }])), settles: {}, maxZoom: null, mapPxAtStart: null };
        vp = null; frozen = false;
        break;
      }
      case "viewport_changed": {
        vp = r.detail as ViewportChangedDetail;
        if (acc) {
          acc.maxZoom = Math.max(acc.maxZoom ?? -Infinity, vp.zoom);
          if (vp.cause === "view_start" && !acc.mapPxAtStart) acc.mapPxAtStart = vp.mapPx ?? null as ViewportChangedDetail["mapPx"] | null;
          if (vp.cause === "settle") acc.settles[vp.input ?? "unknown"] = (acc.settles[vp.input ?? "unknown"] ?? 0) + 1;
        }
        noteInView(r.tWallOffsetMs);
        break;
      }
      case "freeze_started": frozen = true; break;
      case "freeze_submitted": frozen = false; noteInView(r.tWallOffsetMs); break;
      case "view_ended": case "cycle_end": case "session_completed": close(); break;
      default: break;
    }
  }
  close();
  return { rois: roiOut, views: viewOut };
}
