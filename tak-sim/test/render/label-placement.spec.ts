/**
 * SPEC/12 revision (al): fire labels. V13's planted spot fire US2 keeps its label whatever the window size (it no
 * longer yields to KY23's marker); spot labels are drawn above the units; earlier-perimeter times sit on their own
 * lines and read in time order along the spread direction.
 *
 * The placement is the pure `placeLabels` the map runs after every move, fed here with `mercatorProjector` (MapLibre's
 * projection) at the opening frame (revision (am): the 5 km box), label sizes from the 10 px monospace font, the unit boxes after the
 * declutter, and the map's own overlays at their CSS positions (wind top-left, zoom top-right, legend bottom-left
 * expanded, scale bottom-right).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { mercatorProjector, metresPerPixel, openingCamera } from "../../app/render/map-frame.js";
import { placeLabels, type LabelRequest, type Rect } from "../../app/render/label-placement.js";
import { declutterUnits, unitBox, unitLabelsShown } from "../../app/render/unit-declutter.js";
import { markerLabel, unitMarkerData } from "../../app/render/ui/unit-markers.js";
import { pastLabelGroups } from "../../app/render/ui/fire-layers.js";

const scenario = buildDemoScenario();
const extent = scenario.extent;
const lat = (extent.south + extent.north) / 2;
const v13 = scenario.cycles.find((c) => c.index === 13)!;
const charW = 6.2, lineH = 10;

/** The map's own overlays at a map size (their CSS boxes; the legend expanded, its largest state). */
function overlays(w: number, h: number): Rect[] {
  return [
    { left: 8, top: 8, right: 180, bottom: 52 }, // wind (compact, revision (am))
    { left: w - 8 - 180, top: 8, right: w - 8, bottom: 36 }, // zoom buttons
    { left: 8, top: Math.max(h - 28 - 260, 64), right: 8 + 230, bottom: h - 28 }, // legend open (one column, at most the map height less 92 px)
    { left: w - 8 - 150, top: h - 8 - 22, right: w - 8, bottom: h - 8 }, // scale bar
  ];
}

function layout(cycle: typeof v13, w: number, h: number) {
  const cam = openingCamera(extent, w, h, 16);
  const project = mercatorProjector(cam, w, h);
  const mpp = metresPerPixel(cam.zoom, lat);
  const units = unitMarkerData(cycle.unitPositions, cycle.unitWork, cycle.aircraft);
  const items = units.map((d) => { const p = project(d.at); return { key: d.key, x: p.x, y: p.y, ...unitBox(d.role, markerLabel(d), unitLabelsShown(mpp)) }; });
  const fixedLines = cycle.fire.perimeter_current.filter((s) => s.status === "uncontained").flatMap((s) => s.line.slice(1).map((q, i) => { const a = project(s.line[i]!), b = project(q); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; }));
  const res = declutterUnits(items, { metresPerPx: mpp, fixedLines });
  const unitRects: Rect[] = items.filter((it) => { const p = res.placements.get(it.key)!; return p.stack === null || p.stack === it.key; })
    .map((it) => { const p = res.placements.get(it.key)!; const cx = it.x + p.dx, cy = it.y + p.dy; return { left: cx - it.w / 2, right: cx + it.w / 2, top: cy - it.h / 2, bottom: cy + it.h / 2 }; });
  const spread = (cycle.wind.fromDeg + 180) % 360;
  const requests: LabelRequest[] = [
    ...cycle.fire.spot_fires.map((s) => ({ key: `spot:${s.callsign}`, kind: "spot" as const, anchors: [project(s.position)], w: s.callsign.length * charW, h: lineH })),
    ...pastLabelGroups(cycle.fire.perimeters_past.slice(0, 3), spread).map((g) => ({ key: `past:${g.index}`, kind: "past" as const, anchors: g.anchors.map(project), w: g.text.length * charW, h: lineH, text: g.text })),
  ];
  return { requests, unitRects, placed: placeLabels(requests, overlays(w, h), unitRects, { left: 0, top: 0, right: w, bottom: h }), project, spread };
}

describe("US2's label is always placed (revision (al))", () => {
  it("at the map sizes of a 1280 × 720 and a 1280 × 529 window (with and without the right column) and the 300 px minimum", () => {
    for (const [w, h] of [[1280, 720], [1280, 529], [920, 600], [920, 450], [920, 369], [920, 300]] as const) {
      expect(layout(v13, w, h).placed.get("spot:US2"), `${w}×${h}`).not.toBeNull();
    }
  });

  it("at every map size from 800 × 300 to 1280 × 720", () => {
    for (let w = 800; w <= 1280; w += 40) for (let h = 300; h <= 720; h += 30) expect(layout(v13, w, h).placed.get("spot:US2"), `${w}×${h}`).not.toBeNull();
  });

  it("spot labels are drawn above the unit markers, and other labels below them", () => {
    const fl = readFileSync("app/render/ui/fire-layers.ts", "utf8");
    expect(fl).toMatch(/export const MARKER_Z = \{ overlay: 1, unit: 2, label: 3, spotLabel: 4, hover: 10 \} as const;/);
    expect(fl).toMatch(/z-index:\$\{l\.kind === "spot" \? MARKER_Z\.spotLabel : MARKER_Z\.label\}/);
    const um = readFileSync("app/render/ui/unit-markers.ts", "utf8");
    expect(um).toMatch(/MARKER_Z\.unit/);
  });
});

describe("earlier-perimeter times sit on their own lines, in time order (revision (al))", () => {
  it("each placed time is centred on a point of its own ring", () => {
    for (const c of scenario.cycles) {
      const { requests, placed } = layout(c, 920, 450);
      for (const r of requests.filter((x) => x.kind === "past")) {
        const p = placed.get(r.key);
        if (p) { expect(p.dx).toBe(0); expect(p.dy).toBe(0); expect(p.anchor).toBeLessThan(r.anchors.length); }
      }
    }
  });

  it("in V9 the times read in order outward along the spread direction; 16:20 and 16:40, where the fire stood still, share one label", () => {
    const v9 = scenario.cycles.find((c) => c.index === 9)!;
    for (const [w, h] of [[920, 450], [1280, 720], [920, 300]] as const) {
      const { requests, placed, spread } = layout(v9, w, h);
      const t = (spread * Math.PI) / 180;
      const along = requests.filter((r) => r.kind === "past").flatMap((r) => {
        const p = placed.get(r.key);
        if (!p) return [];
        const a = r.anchors[p.anchor]!;
        return [{ time: (r as { text?: string }).text!, v: a.x * Math.sin(t) - a.y * Math.cos(t) }];
      });
      expect(along.length, `${w}×${h}`).toBeGreaterThanOrEqual(2);
      expect(along.map((x) => x.time)).toContain("16:20 · 16:40");
      const byTime = [...along].sort((a, b) => (a.time < b.time ? -1 : 1));
      const byDistance = [...along].sort((a, b) => a.v - b.v);
      expect(byDistance.map((x) => x.time), `${w}×${h}`).toEqual(byTime.map((x) => x.time));
    }
  });
});
