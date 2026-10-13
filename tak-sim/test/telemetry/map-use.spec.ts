/**
 * SPEC/07 and SPEC/09 revision (al): map-use logging and its covariates.
 * - `viewport_changed`: the throttle (4 Hz while moving, every settle), the record's fields, the input classification.
 * - Regions of interest: each box holds what it is named for in the scenario.
 * - `mapUseMeasures`: on-screen time, first time in view, zoom; freeze time excluded; per-view settles by input.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { MAP_ROIS, type RoiBox } from "../../app/render/map-rois.js";
import { inputOf, MOVE_INTERVAL_MS, viewportDetail, ViewportThrottle } from "../../app/render/viewport-log.js";
import { mapUseMeasures } from "../../app/telemetry/map-use-measures.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import type { ViewportChangedDetail } from "../../app/telemetry/record-kinds.js";

const scenario = buildDemoScenario();
const inBox = (b: RoiBox, p: { lat: number; lon: number }) => p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;

describe("viewport_changed (revision (al))", () => {
  it("logs the first move, then at most one per 250 ms, and a fresh interval after each settle", () => {
    const t = new ViewportThrottle();
    const kept = [0, 50, 100, 249, 250, 260, 499, 500, 1000].filter((ms) => t.move(ms));
    expect(kept).toEqual([0, 250, 500, 1000]);
    t.settle();
    expect(t.move(1010)).toBe(true);
    expect(MOVE_INTERVAL_MS).toBe(250);
  });

  it("carries centre, zoom, bearing 0, the map's pixel size, the visible bounds, the view, the cause and the input", () => {
    const map = {
      getCenter: () => ({ lat: 60.84881234567, lng: 27.3496 }),
      getZoom: () => 13.12345,
      getBounds: () => ({ getSouth: () => 60.82, getNorth: () => 60.88, getWest: () => 27.28, getEast: () => 27.41 }),
      getContainer: () => ({ clientWidth: 920, clientHeight: 450 }),
    };
    expect(viewportDetail(map, 13, "settle", "wheel")).toEqual({
      centre: { lat: 60.848812, lon: 27.3496 }, zoom: 13.123, bbox: { south: 60.82, north: 60.88, west: 27.28, east: 27.41 },
      bearing: 0, mapPx: { width: 920, height: 450 }, view: 13, cause: "settle", input: "wheel",
    });
    expect(viewportDetail(map, 0, "view_start")).not.toHaveProperty("input");
  });

  it("names what moved the map: wheel, drag, touch, keyboard, a preset button, the opening frame", () => {
    expect(inputOf({ type: "wheel" }, false)).toBe("wheel");
    expect(inputOf({ type: "mousedown" }, false)).toBe("drag");
    expect(inputOf({ type: "touchstart" }, false)).toBe("touch");
    expect(inputOf({ type: "keydown" }, false)).toBe("keyboard");
    expect(inputOf(undefined, true)).toBe("preset");
    expect(inputOf(undefined, false)).toBe("frame");
  });
});

describe("regions of interest hold what they are named for", () => {
  const view = (i: number) => scenario.cycles.find((c) => c.index === i)!;
  const roi = (id: string) => MAP_ROIS.find((r) => r.id === id)!;

  it("US2's box at V13 holds US2, and no other view has it", () => {
    const us2 = view(13).fire.spot_fires.find((s) => s.callsign === "US2")!;
    expect(inBox(roi("us2").boxes[13]!, us2.position)).toBe(true);
    expect(Object.keys(roi("us2").boxes)).toEqual(["13"]);
  });

  it("the head's box at V4–V6 holds every head vertex of that view", () => {
    for (const i of [4, 5, 6]) {
      const head = view(i).fire.perimeter_current.filter((s) => s.is_head).flatMap((s) => s.line);
      expect(head.length, `V${i}`).toBeGreaterThan(0);
      for (const p of head) expect(inBox(roi("head").boxes[i]!, p), `V${i}`).toBe(true);
    }
  });

  it("the origin's south-edge box at V9–V10 holds US1 (V10) and part of the fire's edge (both views)", () => {
    const us1 = view(10).fire.spot_fires.find((s) => s.callsign === "US1")!;
    expect(inBox(roi("origin_south_edge").boxes[10]!, us1.position)).toBe(true);
    for (const i of [9, 10]) expect(view(i).fire.perimeter_current.some((s) => s.line.some((p) => inBox(roi("origin_south_edge").boxes[i]!, p))), `V${i}`).toBe(true);
  });
});

describe("mapUseMeasures (analysis only)", () => {
  let seq = 0;
  const rec = (t: number, kind: string, detail: unknown): LogRecord => ({ seq: seq++ as never, tVirtual: 0 as never, tWallOffsetMs: t, kind, detail });
  const box = { south: 60.857, north: 60.859, west: 27.357, east: 27.362 }; // inside US2's box
  const wide = { south: 60.82, north: 60.88, west: 27.28, east: 27.41 };
  const away = { south: 60.82, north: 60.83, west: 27.28, east: 27.30 };
  const vp = (zoom: number, bbox: ViewportChangedDetail["bbox"], cause: NonNullable<ViewportChangedDetail["cause"]>, input?: ViewportChangedDetail["input"]): ViewportChangedDetail =>
    ({ centre: { lat: 60.85, lon: 27.35 }, zoom, bbox, bearing: 0, mapPx: { width: 920, height: 450 }, view: 13, cause, ...(input ? { input } : {}) });

  it("counts on-screen time, the first moment in view and its zoom, leaves out the freeze, and counts settles by input", () => {
    const records = [
      rec(1_000, "cycle_start", { cycle: 13, phase: "B", clockLabel: "18:40" }),
      rec(1_000, "viewport_changed", vp(11.8, away, "view_start")),
      rec(11_000, "viewport_changed", vp(12.5, wide, "settle", "wheel")), // 10 s in: in view from here
      rec(21_000, "freeze_started", { cycle: 13, atViewSeconds: 20, decisionCommittedBeforeFreeze: false, decisionStep: "x" }),
      rec(61_000, "freeze_submitted", { cycle: 13, responses: [] }), // 40 s frozen: not counted
      rec(71_000, "viewport_changed", vp(14.2, box, "settle", "drag")),
      rec(81_000, "viewport_changed", vp(11.8, away, "settle", "preset")),
      rec(91_000, "view_ended", { cycle: 13, viewSeconds: 90, endedBy: "minimum_length" }),
    ];
    const { rois, views } = mapUseMeasures(records, MAP_ROIS);
    expect(rois).toEqual([{ view: 13, roiId: "us2", viewMs: 90_000, mapVisibleMs: 50_000, onScreenMs: 30_000, firstInViewMs: 10_000, zoomAtFirst: 12.5, maxZoomOnScreen: 14.2 }]);
    expect(views).toEqual([{ view: 13, settlesByInput: { wheel: 1, drag: 1, preset: 1 }, maxZoom: 14.2, mapPxAtStart: { width: 920, height: 450 } }]);
  });

  it("a region never on screen has no first time; a view without regions still gets its map-use line", () => {
    const records = [
      rec(0, "cycle_start", { cycle: 13 }), rec(0, "viewport_changed", vp(11.8, away, "view_start")), rec(5_000, "view_ended", { cycle: 13 }),
      rec(5_000, "cycle_start", { cycle: 2 }), rec(5_000, "viewport_changed", vp(11.8, wide, "view_start")), rec(9_000, "view_ended", { cycle: 2 }),
    ];
    const { rois, views } = mapUseMeasures(records, MAP_ROIS);
    expect(rois).toEqual([{ view: 13, roiId: "us2", viewMs: 5_000, mapVisibleMs: 5_000, onScreenMs: 0, firstInViewMs: null, zoomAtFirst: null, maxZoomOnScreen: null }]);
    expect(views.map((v) => v.view)).toEqual([13, 2]);
  });
});

describe("the map components emit the map-use records (source check: hooks cannot render here)", () => {
  const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("the live map logs moves (throttled), settles, each view's start and resizes, pointer events on units, the labels shown and the legend toggle", () => {
    const mv = code("app/render/ui/components/MapView.tsx");
    expect(mv).toMatch(/map\.on\("move", \(\) => \{ if \(loadedRef\.current && throttleRef\.current\.move\(performance\.now\(\)\)\) logViewport\(map, "move"\); \}\);/);
    expect(mv).toMatch(/logViewport\(map, "settle"\)/);
    expect(mv).toMatch(/logViewport\(map, "view_start"\)/);
    expect(mv).toMatch(/logViewport\(map, "resize"\)/);
    expect(mv).toMatch(/kind: d\.type === "enter" \? "element_enter" : "element_leave"/);
    expect(mv).toMatch(/kind: "click", detail: \{ targetKind: d\.targetKind, targetId: d\.targetId, viewportRef: viewportSeqRef\.current/);
    expect(mv).toMatch(/kind: "map_labels_placed"/);
    expect(mv).toMatch(/kind: "layer_toggled", detail: \{ layerId: "legend", newState: open \}/);
    // Free zoom stays on (decision, 10 Oct 2026) and is logged; rotation stays off.
    expect(mv).not.toMatch(/scrollZoom: false/);
    expect(mv).toMatch(/dragRotate: false/);
    expect(code("app/render/ui/components/SessionView.tsx")).toMatch(/onMapUse=\{\(e\) => orchestrator\.logMapUse\(e\)\}/);
  });

  it("unit markers and stack badges dispatch enter, leave and click", () => {
    const um = code("app/render/ui/unit-markers.ts"), us = code("app/render/ui/unit-stacks.ts");
    for (const t of ["enter", "leave", "click"]) {
      expect(um).toMatch(new RegExp(`emitMapElement\\(el, \\{ type: "${t}", targetKind`));
      expect(us).toMatch(new RegExp(`emitMapElement\\(el, \\{ type: "${t}", targetKind: "unit_stack"`));
    }
  });

  it("the memory-check map logs each tap with the zoom, centre and map size then", () => {
    expect(code("app/render/ui/components/FreezeMap.tsx")).toMatch(/onPickRef\.current\(p, camera\)/);
    expect(code("app/render/ui/components/FreezeScreen.tsx")).toMatch(/orchestrator\.logFreezeMapPick\(item\.id, p, camera\)/);
  });

  it("the window-size cover is logged when shown and when removed", () => {
    const g = code("app/render/ui/components/WindowSizeGuard.tsx");
    expect(g).toMatch(/kind: "window_size_warning", detail: \{ shown: next, width: s\.width, height: s\.height, minWidth: MIN_WINDOW\.width, minHeight: MIN_WINDOW\.height \}/);
    expect(g).toMatch(/export const MIN_WINDOW = \{ width: 1100, height: 500 \} as const;/);
  });
});
