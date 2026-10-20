/**
 * SPEC/12 revisions (al), (am): the unit-marker declutter. At the opening frame (revision (am): the 5 km box, compact markers, pushed off the uncontained edge) every marker — or the stack badge
 * it is drawn in — stays under 200 m of its true position, in every view and on every map size the study meets;
 * the layout is deterministic (the same input in any order gives the same output); drawn boxes that still overlap
 * are counted and bounded.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { mercatorProjector, metresPerPixel, openingCamera } from "../../app/render/map-frame.js";
import { COMPACT_FRAME, declutterUnits, displayedOffsetsM, EDGE_HALF_PX, MAX_UNIT_OFFSET_M, pushOffSegment, unitBox, unitLabelsShown, type DeclutterItem, type ScreenSegment } from "../../app/render/unit-declutter.js";
import { markerLabel, unitMarkerData } from "../../app/render/ui/unit-markers.js";

const scenario = buildDemoScenario();
const views = [scenario.practice.cycle, ...scenario.cycles];
const extent = scenario.extent;
const lat = (extent.south + extent.north) / 2;
/** Map sizes: the map beside the 360 px right column at 1280 × 720 and 1280 × 529, the 300 px minimum, and full-width maps. */
export const MAP_SIZES: readonly (readonly [number, number])[] = [[920, 560], [920, 450], [920, 300], [1280, 720], [1280, 529], [1100, 420]];

function frames() {
  return views.flatMap((c) => ([c, ...(c.stepBoundary ? [c.stepBoundary] : [])] as Frame[]).map((f) => ({ view: c.index, f })));
}

type Frame = Pick<(typeof views)[number], "unitPositions" | "unitWork" | "aircraft">;
function items(f: Frame, w: number, h: number) {
  const cam = openingCamera(extent, w, h, 16);
  const project = mercatorProjector(cam, w, h);
  const mpp = metresPerPixel(cam.zoom, lat);
  const labelled = unitLabelsShown(mpp);
  const data = unitMarkerData(f.unitPositions, f.unitWork, f.aircraft);
  const list: DeclutterItem[] = data.map((d) => { const p = project(d.at); return { key: d.key, x: p.x, y: p.y, ...unitBox(d.role, markerLabel(d), labelled) }; });
  return { list, mpp, project, labelled };
}

/** The view's uncontained edge as screen segments (what `unit-stacks.ts` passes as `fixedLines`). */
function edgeSegments(view: number, project: (p: { lat: number; lon: number }) => { x: number; y: number }): ScreenSegment[] {
  const c = views.find((v) => v.index === view)!;
  return c.fire.perimeter_current.filter((s) => s.status === "uncontained").flatMap((s) =>
    s.line.slice(1).map((q, i) => { const a = project(s.line[i]!), b = project(q); return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }; }));
}

describe("unit-marker declutter at the Palo zoom (revision (al))", () => {
  it("at the opening frame the markers are compact, without call signs (revision (am)); from the 2 km zoom on they are labelled", () => {
    for (const [w, h] of MAP_SIZES) {
      const { labelled, mpp } = items(views[1]!, w, h);
      expect(labelled, `${w}×${h} at ${mpp.toFixed(1)} m/px`).toBe(false);
      expect(unitLabelsShown(2_000 / w), `2 km across ${w} px`).toBe(true);
    }
    expect(unitBox("crew", "KY23", false)).toEqual({ ...COMPACT_FRAME, dy0: 0 });
    expect(COMPACT_FRAME.w * COMPACT_FRAME.h).toBeLessThan(0.3 * 24 * 30); // under a third of a labelled marker's box
  });

  it("every displayed marker or its stack badge stays under 200 m of the unit's true position, in every view and map size, with the edge pushes", () => {
    let checked = 0, stacked = 0;
    for (const [w, h] of MAP_SIZES) {
      for (const { view, f } of frames()) {
        const { list, mpp, project } = items(f, w, h);
        const res = declutterUnits(list, { metresPerPx: mpp, fixedLines: edgeSegments(view, project) });
        for (const [key, m] of displayedOffsetsM(list, res, mpp)) {
          expect(m, `V${view} ${key} at ${w}×${h}`).toBeLessThan(MAX_UNIT_OFFSET_M);
          checked++;
        }
        stacked += [...res.stacks.values()].reduce((a, s) => a + s.length, 0);
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(stacked).toBeGreaterThan(0); // the crowded stretches do stack at this zoom
  });

  it("units leave the uncontained edge visible: the edge length under drawn markers falls by more than 80 % (V5–V14, every map size; 604 → 77 samples at revision (am))", () => {
    // Sample each segment every 2 px; a sample is hidden when it lies inside a drawn marker or badge box.
    const hidden = (segs: readonly ScreenSegment[], boxes: readonly { cx: number; cy: number; w: number; h: number }[]) => {
      let n = 0;
      for (const s of segs) {
        const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), k = Math.max(1, Math.ceil(len / 2));
        for (let i = 0; i < k; i++) {
          const x = s.x1 + ((s.x2 - s.x1) * i) / k, y = s.y1 + ((s.y2 - s.y1) * i) / k;
          if (boxes.some((b) => Math.abs(x - b.cx) < b.w / 2 && Math.abs(y - b.cy) < b.h / 2)) n++;
        }
      }
      return n;
    };
    let before = 0, after = 0;
    for (const [w, h] of MAP_SIZES) {
      for (const { view, f } of frames().filter((x) => x.view >= 5)) {
        const { list, mpp, project } = items(f, w, h);
        const segs = edgeSegments(view, project);
        const drawnBoxes = (res: ReturnType<typeof declutterUnits>) => list.filter((it) => { const p = res.placements.get(it.key)!; return p.stack === null || p.stack === it.key; })
          .map((it) => { const p = res.placements.get(it.key)!; return { cx: it.x + p.dx, cy: it.y + p.dy, w: it.w, h: it.h }; });
        before += hidden(segs, drawnBoxes(declutterUnits(list, { metresPerPx: mpp })));
        after += hidden(segs, drawnBoxes(declutterUnits(list, { metresPerPx: mpp, fixedLines: segs })));
      }
    }
    expect(before).toBeGreaterThan(50);
    // SPEC/33 stage 9 (20 Oct 2026): on the rebuilt map 179 of 700 samples stayed under a marker, most under DR3's orbit over the
    // zig-zag north edge at V7–V8 and EK11 at V6, where a push off one segment landed on the next (the bound was relaxed to 0.3). The
    // cause was the declutter, not the positions: gate R (20 Oct 2026) moves a marker on a jagged edge to the nearest spot within its
    // cap clear of every segment, or that hides the least of it (`clearOfLines`): 39 of 700 (94 % less); the 0.2 bound is back.
    expect(after / before, `${after} of ${before} edge samples still under a marker`).toBeLessThan(0.2);
  });

  it("pushes a box crossing a segment to the side its centre is on, just clear of the line", () => {
    const seg = { x1: 0, y1: 0, x2: 100, y2: 0 };
    const a = { cx: 50, cy: 3, w: 16, h: 12 };
    expect(pushOffSegment(a, seg, 2)).toBe(true);
    expect(a.cx).toBe(50);
    expect(a.cy).toBeCloseTo(6 + 2 + EDGE_HALF_PX, 9);
    expect(pushOffSegment(a, seg, 2)).toBe(false); // now clear
    const b = { cx: 50, cy: -1, w: 16, h: 12 };
    pushOffSegment(b, seg, 2);
    expect(b.cy).toBeLessThan(0);
    const beyond = { cx: 130, cy: 0, w: 16, h: 12 };
    expect(pushOffSegment(beyond, seg, 2)).toBe(false); // past the segment's end
  });

  it("is deterministic: the same markers in any order give the same layout", () => {
    for (const { view, f } of frames().filter((x) => x.view === 13 || x.view === 8)) {
      const { list, mpp, project } = items(f, 920, 450);
      const fixedLines = edgeSegments(view, project);
      const a = declutterUnits(list, { metresPerPx: mpp, fixedLines });
      const b = declutterUnits([...list].reverse(), { metresPerPx: mpp, fixedLines });
      expect([...b.placements.entries()].sort()).toEqual([...a.placements.entries()].sort());
      expect([...b.stacks.entries()]).toEqual([...a.stacks.entries()]);
    }
  });

  it("removes most overlaps: what is left is where a line of crews on one road is longer than 200 m of offset can spread (V13–V14 on R2)", () => {
    type B = { cx: number; cy: number; w: number; h: number };
    const count = (boxes: readonly B[]) => {
      let n = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        if (Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 - 1 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 - 1) n++;
      }
      return n;
    };
    let before = 0, after = 0;
    for (const [w, h] of MAP_SIZES) {
      for (const { view, f } of frames()) {
        const { list, mpp, project } = items(f, w, h);
        const res = declutterUnits(list, { metresPerPx: mpp, fixedLines: edgeSegments(view, project) });
        before += count(list.map((it) => ({ cx: it.x, cy: it.y + it.dy0, w: it.w, h: it.h })));
        after += count(list.filter((it) => { const p = res.placements.get(it.key)!; return p.stack === null || p.stack === it.key; })
          .map((it) => { const p = res.placements.get(it.key)!; return { cx: it.x + p.dx, cy: it.y + it.dy0 + p.dy, w: it.w, h: it.h }; }));
      }
    }
    expect(before).toBeGreaterThan(300);
    expect(after / before, `${after} of ${before} overlaps left`).toBeLessThan(0.05);
  });

  it("does not stack when zoomed in to the 2 km level: the markers are far enough apart to be drawn on their own", () => {
    const f = views.find((c) => c.index === 13)!;
    const w = 920, h = 450;
    const zoom = Math.log2((78_271.517 * Math.cos((lat * Math.PI) / 180) * w) / 2_000);
    const cam = { center: [27.36, 60.848] as const, zoom };
    const project = mercatorProjector(cam, w, h);
    const data = unitMarkerData(f.unitPositions, f.unitWork, f.aircraft);
    const list = data.map((d) => { const p = project(d.at); return { key: d.key, x: p.x, y: p.y, ...unitBox(d.role, markerLabel(d)) }; });
    const res = declutterUnits(list, { metresPerPx: metresPerPixel(zoom, lat) });
    const stackedKeys = [...res.stacks.values()].flat();
    expect(stackedKeys.length).toBeLessThan(list.length / 2);
  });
});
