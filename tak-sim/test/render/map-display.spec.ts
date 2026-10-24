/**
 * SPEC/12 revisions (ah) and (aj), 9 Oct 2026: the map-display review fixes that are not band geometry.
 * - (aj) The camera never moves by itself: no view, event, spot fire or flare-up frames the map; the live map and
 *   the memory-check map open on one neutral frame, the whole study area (`scenario.extent`), and the presets are
 *   content-independent. Supersedes (ah)'s F10, which framed the active fire and so, in V13, the planted flare-up.
 * - F6 / quiet edge: contained and quiet ("inactive") edges are drawn on a light casing, the quiet edge is grey
 *   (neither red nor black), both are in the legend in both languages; an unknown status draws nothing.
 * - Layout: the map keeps a minimum height and the column scrolls; a narrow window stacks the right column;
 *   the memory-check map cannot be tapped (nor its item completed) before its basemap is drawn, and its card
 *   does not shrink under its content; the period countdown is hidden once the period has ended.
 * Components use hooks, so — as the other UI specs do — they are checked at the source.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { boxAroundCentre, extentCamera, extentSizeM, mercatorProjector, OPENING_BOX_M, openingCamera, panBounds, zoomForWidth } from "../../app/render/map-frame.js";
import theme from "../../app/render/ui/fire-theme.json" with { type: "json" };
import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import { UI_TEXT } from "../../app/i18n/ui.js";

const scenario = buildDemoScenario();
const src = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");
/** The source without its comments: what the code does, not what it says about itself. */
const code = (f: string) => src(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
/** Ground metres shown across `px` pixels at MapLibre zoom `zoom`, latitude `lat` (the inverse of `zoomForWidth`). */
const shownM = (zoom: number, px: number, lat: number) => (78_271.517 * Math.cos((lat * Math.PI) / 180) * px) / 2 ** zoom;

describe("the camera never moves by itself (revision (aj))", () => {
  const extent = scenario.extent;
  const lat = (extent.south + extent.north) / 2;

  it("the opening frame (revision (am)) is a fixed 5 × 5 km box about the extent's centre, contain-fitted, the same for every view", () => {
    expect(OPENING_BOX_M).toBe(5_000);
    const box = boxAroundCentre(extent, OPENING_BOX_M);
    const s = extentSizeM(box);
    expect(s.widthM).toBeCloseTo(5_000, 0);
    expect(s.heightM).toBeCloseTo(5_000, 0);
    expect((box.west + box.east) / 2).toBeCloseTo((extent.west + extent.east) / 2, 9);
    expect((box.south + box.north) / 2).toBeCloseTo(lat, 9);
    for (const [w, h, pad] of [[920, 420, 16], [1280, 529, 16], [850, 300, 16], [360, 360, 8], [600, 900, 8]] as const) {
      const cam = openingCamera(extent, w, h, pad);
      expect(cam).toEqual(extentCamera(box, w, h, pad));
      const sw = shownM(cam.zoom, w - 2 * pad, lat), sh = shownM(cam.zoom, h - 2 * pad, lat);
      expect(Math.min(sw, sh), `${w}×${h}`).toBeCloseTo(5_000, 3);
      // Closer than the Fire (Palo) frame, the whole study area.
      expect(cam.zoom, `${w}×${h}`).toBeGreaterThan(extentCamera(extent, w, h, pad).zoom + 0.3);
    }
    expect(openingCamera.length).toBe(3); // takes no view
  });

  it("every view's fire and spread projection (VP, V1–V14) lies inside the opening box, and on screen at 1280 × 529", () => {
    const kx = 111_320 * Math.cos((lat * Math.PI) / 180), ky = 111_320, lon0 = (extent.west + extent.east) / 2;
    const pts = (o: unknown, out: { lat: number; lon: number }[] = []): { lat: number; lon: number }[] => {
      if (Array.isArray(o)) o.forEach((x) => pts(x, out));
      else if (o && typeof o === "object") { const r = o as { lat?: unknown; lon?: unknown }; if (typeof r.lat === "number" && typeof r.lon === "number") out.push(r as { lat: number; lon: number }); else Object.values(o).forEach((v) => pts(v, out)); }
      return out;
    };
    const views = [{ c: scenario.practice.cycle, e: scenario.practice.envelope }, ...scenario.cycles.map((c) => ({ c, e: scenario.envelopes.find((x) => x.cycle === c.index)! }))];
    expect(views.length).toBe(15);
    let furthest = 0;
    for (const { c, e } of views) {
      const all = [...pts(c.fire), ...pts(e.polygon), ...pts(e.isochrones), ...pts(e.detachedParts)];
      expect(all.length, `V${c.index}`).toBeGreaterThan(5);
      for (const p of all) furthest = Math.max(furthest, Math.abs((p.lon - lon0) * kx), Math.abs((p.lat - lat) * ky));
      // On screen: the map beside the right column at 1280 × 529 (~920 × 420), and the 300 px minimum.
      for (const [w, h] of [[920, 420], [920, 300]] as const) {
        const project = mercatorProjector(openingCamera(extent, w, h, 16), w, h);
        for (const p of all) {
          const q = project(p);
          expect(q.x >= 16 && q.x <= w - 16 && q.y >= 16 && q.y <= h - 16, `V${c.index} ${w}×${h}`).toBe(true);
        }
      }
    }
    // V13–V14's north edge and its projection, ~2.26 km from the centre; the box's half-side is 2.5 km.
    expect(furthest).toBeGreaterThan(2_200);
    expect(furthest).toBeLessThan(OPENING_BOX_M / 2);
  });

  it("the Fire (Palo) frame is the whole study area, about 7 × 7 km, centred, with the tighter side fitted to the padding and nothing inside the extent cut off", () => {
    const { widthM, heightM } = extentSizeM(extent);
    expect(widthM).toBeGreaterThan(6_500); expect(widthM).toBeLessThan(7_500);
    expect(heightM).toBeGreaterThan(6_500); expect(heightM).toBeLessThan(7_500);
    for (const [w, h, pad] of [[1280, 529, 16], [850, 300, 16], [360, 360, 8], [600, 900, 8], [1224, 212, 8]] as const) {
      const cam = extentCamera(extent, w, h, pad);
      expect(cam.center).toEqual([(extent.west + extent.east) / 2, lat]);
      const sw = shownM(cam.zoom, w - 2 * pad, lat), sh = shownM(cam.zoom, h - 2 * pad, lat);
      expect(sw, `${w}×${h} width`).toBeGreaterThanOrEqual(widthM - 1e-6);
      expect(sh, `${w}×${h} height`).toBeGreaterThanOrEqual(heightM - 1e-6);
      expect(Math.min(sw / widthM, sh / heightM), `${w}×${h} tight`).toBeCloseTo(1, 9);
    }
    // The same frame at the same size, whatever the view: it takes no view at all.
    expect(extentCamera.length).toBe(3);
    expect(zoomForWidth(6_000, 1280, lat)).toBeGreaterThan(extentCamera(extent, 1280, 529, 16).zoom); // wider than the old 6 km level
  });

  it("the pan limit is a fixed box around the extent's centre", () => {
    const [[w, s], [e, n]] = panBounds(extent, 12_000);
    expect((n - s) * 111_320).toBeCloseTo(24_000, 0);
    expect((e - w) * 111_320 * Math.cos((lat * Math.PI) / 180)).toBeCloseTo(24_000, 0);
    expect((w + e) / 2).toBeCloseTo((extent.west + extent.east) / 2, 9);
  });

  it("the live map's camera code reads nothing from the snapshot, a new view returns to the Palo frame, and the active-fire framing is gone", () => {
    expect(existsSync("app/render/fire-frame.ts")).toBe(false);
    const mv = code("components/MapView.tsx");
    for (const gone of [/fire-frame/, /fireFrameBounds/, /cameraForBounds/, /fitBounds/, /flyTo/, /frameFire/, /spot_fires/, /growthMinHa/]) expect(mv, String(gone)).not.toMatch(gone);
    // Every camera move: the opening frame from the extent and the map's size, or a preset's width about the current centre.
    const moves = mv.split("\n").filter((l) => /jumpTo\(|easeTo\(/.test(l));
    expect(moves.length).toBe(3);
    for (const l of moves) expect(l, l).not.toMatch(/snapshot|cycleInfo|perimeter|envelope|unit|event/i);
    // Revision (am): the opening frame (every view's start) is the 5 km box; the Fire button the whole extent.
    expect(mv).toMatch(/const \{ center, zoom \} = openingCamera\(extent, el\.clientWidth \|\| 1280, el\.clientHeight \|\| 720, FRAME_PAD_PX\);/);
    expect(mv).toMatch(/const opening = openingCamera\(extent, width, containerRef\.current\.clientHeight \|\| 720, FRAME_PAD_PX\);/);
    expect(mv).toMatch(/const \{ center, zoom \} = extentCamera\(extent, el\.clientWidth \|\| 1280, el\.clientHeight \|\| 720, FRAME_PAD_PX\);/);
    expect(mv).toMatch(/if \(widthM === null\) \{ frameWhole\(map\); return; \}/);
    expect(mv).toMatch(/map\.easeTo\(\{ zoom: zoomForWidth\(widthM, map\.getContainer\(\)\.clientWidth \|\| 1280, centre\.lat\), duration: 0 \}\);/);
    // The snapshot effect updates the layers and the tour's boxes, nothing else.
    expect(mv).toMatch(/updateLayers\(map, snapshot\);\s*measureRef\.current\(map\);\s*\}, \[snapshot\]\);/);
    // A new view returns to the Palo frame (the opening frame), keyed only on the view index changing.
    expect(mv).toMatch(/viewRef\.current = snapshot\.currentCycle;\s*if \(map\) frameDefault\(map\);\s*\}, \[snapshot\.currentCycle\]\);/);
    // The opening frame follows the map's size only until the participant moves the map.
    expect(mv).toMatch(/map\.on\("movestart", \(e\) => \{ if \(\(e as \{ originalEvent\?: unknown \}\)\.originalEvent\) onDefaultRef\.current = false; \}\);/);
    expect(mv).toMatch(/map\.on\("resize", \(\) => \{ if \(onDefaultRef\.current\) frameDefault\(map\); \}\);/);
  });

  it("the presets are content-independent: Area 20 km and Sector 2 km about the participant's centre, Fire the opening frame", () => {
    const mv = code("components/MapView.tsx");
    expect(mv).toMatch(/\{ id: "alue", labelFi: "Alue", widthM: 20_000 \},\s*\{ id: "palo", labelFi: "7 km", widthM: null \},[^\n]*\n\s*\{ id: "lohko", labelFi: "2 km", widthM: 2_000 \},/);
    expect(mv).toMatch(/if \(widthM === null\) \{ frameWhole\(map\); return; \}/);
    expect(mv).not.toMatch(/easeTo\(\{[^}]*center/);
  });

  it("names the whole-area preset for what it shows, \"7 km\", not \"Palo\" / \"Fire\" (play-test, 24 Oct 2026), and no two buttons read alike", () => {
    for (const lang of ["fi", "en"] as const) {
      const z = UI_TEXT[lang].zoom;
      expect(z.palo).toBe("7 km");
      expect(new Set([z.alue, z.palo, z.lohko]).size).toBe(3);
      for (const label of [z.alue, z.palo, z.lohko]) expect(label, lang).not.toMatch(/^(Palo|Fire)$/);
      // The tour's zoom step names the buttons as they read.
      expect(UI_TEXT[lang].tour.steps.zoom.body.startsWith(`${z.alue}, ${z.palo} ${lang === "fi" ? "ja" : "and"} ${z.lohko} `)).toBe(true);
    }
  });

  it("the memory-check map fills the card and opens on the live map's opening frame, never on the fire as reported (revision (ap))", () => {
    const fm = code("components/FreezeMap.tsx");
    expect(fm).toMatch(/openingCamera\(extent, el\.clientWidth \|\| 600, el\.clientHeight \|\| 600, FRAME_PAD_PX\)/);
    expect(fm).toMatch(/map\.setMinZoom\(Math\.min\(zoom, outermostZoom\(\)\)\)/); // zoom out to the whole study area
    expect(fm).not.toMatch(/aspectRatio|clamp\(200px, 40vh, 360px\)/);
    expect(fm).toMatch(/map\.on\("resize", \(\) => \{ if \(onDefault\.current\) refit\(\); \}\);/);
    expect(fm).not.toMatch(/fitBounds|perimeter|freezeMapFrame/);
    expect(code("components/FreezeScreen.tsx")).toMatch(/const extent = orchestrator\.mapExtent;/);
    const orchestrator = readFileSync("app/session/orchestrator.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(orchestrator).not.toMatch(/freezeMapFrame/);
    expect(readFileSync("app/session/freeze-answers.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).not.toMatch(/freezeMapFrame|Polygon/);
  });
});

describe("edges: contained and quiet on a light casing (F6, quiet edge)", () => {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const lum = (c: string) => { const [r, g, b] = hex(c); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };

  it("gives the contained and the quiet edge a casing wider than the line and much lighter than the burnt fill", () => {
    for (const k of ["contained", "inactive"] as const) {
      const e = theme[k];
      expect(e.casingWidthPx).toBeGreaterThan(e.widthPx + 1);
      expect(lum(e.casingColor) - lum(theme.burnt.color)).toBeGreaterThan(150);
    }
  });

  it("draws the quiet edge grey: neither the red of a spreading edge nor the black of a contained one, nor the earlier perimeters' pale grey", () => {
    const [r, g, b] = hex(theme.inactive.color);
    expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThan(30); // grey
    expect(lum(theme.inactive.color) - lum(theme.contained.color)).toBeGreaterThan(80);
    expect(lum(theme.past.color) - lum(theme.inactive.color)).toBeGreaterThan(40);
    expect(theme.inactive.widthPx).toBeGreaterThan(theme.past.widthPx);
  });

  it("filters the edge layers by status string (an unknown status draws nothing), casings under their lines", () => {
    const fl = src("fire-layers.ts");
    const order = ["fire-edge-inactive-casing", "fire-edge-inactive\"", "fire-edge-contained-casing", "fire-edge-contained\"", "fire-edge-uncontained\""].map((id) => fl.indexOf(`id: "${id.replace(/"$/, "")}"`));
    for (const i of order) expect(i).toBeGreaterThan(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(fl).toMatch(/filter: \["==", \["get", "status"\], "inactive"\]/);
  });

  it("names the quiet edge, the burning zone and the head in the legend, in both languages", () => {
    expect(theme.legend.inactive).toBe("Hiljainen reuna (ei leviä)");
    const en = labelsEn as Record<string, string>;
    expect(en[theme.legend.inactive]).toBe("Quiet edge (not spreading)");
    expect(en[theme.legend.burningZone]).toBe("Burning zone");
    expect(en[theme.legend.head]).toBe("Head");
    const lg = src("components/Legend.tsx");
    for (const k of ["L.inactive", "L.burningZone", "L.head", "T.contained.casingColor", "T.inactive.casingColor"]) expect(lg).toContain(k);
  });
});

describe("layout at 1280×529 and narrow windows", () => {
  it("keeps the map at least 300 px tall and scrolls the column under it; stacks the right column below 1000 px", () => {
    expect(src("components/MapView.tsx")).toMatch(/export const MAP_MIN_HEIGHT_PX = 300;/);
    expect(src("components/MapView.tsx")).toMatch(/minHeight: MAP_MIN_HEIGHT_PX/);
    const sv = src("components/SessionView.tsx");
    expect(sv).toMatch(/overflowY: "auto" \}\}>\s*<MapView/);
    expect(sv).toMatch(/const NARROW_PX = 1000;/);
    expect(sv).toMatch(/stacked=\{narrow\}/);
  });

  it("the memory-check map: its card never shrinks under its content, taps wait for the basemap, a loading note covers it until then", () => {
    const fs = src("components/FreezeScreen.tsx");
    expect(fs).not.toMatch(/mapItem \? \{ flex: 1, minHeight: 0/);
    expect(fs).toMatch(/flex: "1 0 auto"/);
    const fm = src("components/FreezeMap.tsx");
    expect(fm).toMatch(/map\.once\("idle", markReady\)/);
    expect(fm).toMatch(/if \(readyRef\.current && insideExtent\(p, extent\)\)/);
    expect(fm).toMatch(/\{!ready && \(/);
    for (const lang of ["fi", "en"] as const) expect(UI_TEXT[lang].mapLoading.length).toBeGreaterThan(5);
  });

  it("hides the period countdown once the period has ended (a forced situation question)", () => {
    const ss = src("components/StatusStrip.tsx");
    expect(ss).toMatch(/const periodEnded = /);
    expect(ss).toMatch(/&& !periodEnded \? snapshot\.secondsLeft : null/);
  });
});
