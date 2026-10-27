/**
 * The training's locked maps, geometrically (SPEC/08 (bp) §bp.1; review 27 Oct 2026, findings 1 and 3), on MapLibre's own transform
 * (`maplibre-gl` 6.10's `MercatorTransform`, the class the browser map constrains its camera with): at every tested map size —
 * landscape with and without the side pane, short (a feedback under the map), portrait, the play harness's — the limits `MapView` and
 * `FreezeMap` set (`lockLimits`) give an effective camera that
 *
 * - shows the whole square at the opening frame, which MapLibre does not zoom into (the lock box as `maxBounds` did: the control case);
 * - cannot zoom out past that frame or pan away from it, and zoomed in to "1 km" stays inside what the frame shows;
 * - keeps every coordinate the training draws (marks, keys, feedback rings, lines and routes, road codes, the fire, the units) clear of
 *   the map's chrome: the square lies between the chrome's bands, and the chrome as the components place it lies inside the bands.
 *
 * The chrome's places are those of `TakMapChrome.tsx` (the compact info card, the coordinate readout), `MapView.tsx` (the zoom
 * buttons, the attribution), `Legend.tsx` (its button above the readout) and `FreezeMap.tsx` (its zoom buttons and scale bar); the
 * browser walk of the review measures the same elements on the screen.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { clampToBounds, FREEZE_LOCK_PADS, LIVE_LOCK_PADS, lockLimits, tilesMeeting, trainingMapLock, type FramePad, type MapLock } from "../../app/render/ui/training-lock.js";
import siteMeta from "../../app/scenario/site-meta.json" with { type: "json" };
import { widenBox, type Box } from "../../app/session/training/area.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { zoomForWidth } from "../../app/render/map-frame.js";

const LOCK = trainingMapLock(TRAINING, "fi");

/** What the test uses of MapLibre's transform (its source is loaded at run time, so the type-check does not compile MapLibre's own). */
interface MercatorTransform {
  resize(width: number, height: number): void;
  setMinZoom(zoom: number): void;
  setMaxBounds(bounds: unknown): void;
  setZoom(zoom: number): void;
  setCenter(center: unknown): void;
  readonly zoom: number;
  readonly center: { readonly lng: number; readonly lat: number };
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
  locationToScreenPoint(lngLat: unknown): { readonly x: number; readonly y: number };
}
let MercatorTransform: new (options: object) => MercatorTransform;
let LngLat: new (lng: number, lat: number) => unknown;
let LngLatBounds: new (bounds: [[number, number], [number, number]]) => unknown;
const maplibreSrc = (path: string) => new URL(`../../node_modules/maplibre-gl/src/${path}`, import.meta.url).href;
beforeAll(async () => {
  ({ MercatorTransform } = await import(/* @vite-ignore */ maplibreSrc("geo/projection/mercator_transform.ts")));
  ({ LngLat } = await import(/* @vite-ignore */ maplibreSrc("geo/lng_lat.ts")));
  ({ LngLatBounds } = await import(/* @vite-ignore */ maplibreSrc("geo/lng_lat_bounds.ts")));
}, 60_000);

/** The live map's sizes (px): 1440 × 900 with the toolbar, with GeoChat open, with a feedback under it; 1280 × 720; portrait; the harness's. */
const LIVE_SIZES = [
  { name: "landscape 1365×746 (1440×900, no pane)", w: 1365, h: 746 },
  { name: "landscape 983×746 (1440×900, GeoChat open)", w: 983, h: 746 },
  { name: "short 1365×470 (a feedback under the map)", w: 1365, h: 470 },
  { name: "landscape 1205×560 (1280×720)", w: 1205, h: 560 },
  { name: "portrait 700×980", w: 700, h: 980 },
  { name: "narrow portrait 420×820", w: 420, h: 820 },
  { name: "the play harness 1000×680", w: 1000, h: 680 },
] as const;
const FREEZE_SIZES = [
  { name: "freeze 1384×610", w: 1384, h: 610 },
  { name: "freeze 900×420", w: 900, h: 420 },
  { name: "freeze portrait 600×900", w: 600, h: 900 },
] as const;

/** A map of `w` × `h` with the given limits, at `camera`, constrained as MapLibre constrains it. */
function transformAt(w: number, h: number, minZoom: number, maxBounds: [[number, number], [number, number]], camera: { readonly center: readonly [number, number]; readonly zoom: number }) {
  const t = new MercatorTransform({ minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true });
  t.resize(w, h);
  t.setMinZoom(minZoom);
  t.setMaxBounds(new LngLatBounds(maxBounds));
  t.setZoom(camera.zoom);
  t.setCenter(new LngLat(camera.center[0], camera.center[1]));
  return t;
}
const shown = (t: MercatorTransform): Box => { const b = t.getBounds(); return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }; };
const contains = (outer: Box, inner: Box, eps = 1e-9) => inner.west >= outer.west - eps && inner.east <= outer.east + eps && inner.south >= outer.south - eps && inner.north <= outer.north + eps;
const px = (t: MercatorTransform, lon: number, lat: number) => t.locationToScreenPoint(new LngLat(lon, lat));

/** Every coordinate the training draws: the items' marks, keys, memory units and feedback geometry, the road codes, the scenes. */
function trainingCoordinates(): { readonly lat: number; readonly lon: number }[] {
  const out: { lat: number; lon: number }[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v === null || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.lat === "number" && typeof o.lon === "number") out.push({ lat: o.lat, lon: o.lon });
    for (const x of Object.values(o)) walk(x);
  };
  walk([TRAINING.items, TRAINING.roadLabels, TRAINING.scenes]);
  return out;
}

/** The chrome's rectangles on a `w` × `h` live locked map, px from its top-left: where the components place them, at their largest. */
function liveChrome(w: number, h: number) {
  return [
    { id: "info card (compact: clock and wind)", x0: 8, y0: 8, x1: 8 + 330, y1: 8 + 48 },
    { id: "zoom buttons", x0: w - 8 - 170, y0: 8, x1: w - 8, y1: 8 + 34 },
    { id: "legend button", x0: 8, y0: h - 74 - 22, x1: 8 + 140, y1: h - 74 },
    { id: "coordinate readout and scale bar", x0: 8, y0: h - 8 - 48, x1: 8 + 400, y1: h - 8 },
    { id: "attribution", x0: w - 320, y0: h - 34, x1: w, y1: h },
  ];
}
/** The blank memory-check map's: MapLibre's zoom buttons (top-right) and scale bar (bottom-right), 10 px in. */
function freezeChrome(w: number, h: number) {
  return [
    { id: "zoom buttons", x0: w - 10 - 30, y0: 10, x1: w - 10, y1: 10 + 60 },
    { id: "scale bar", x0: w - 10 - 124, y0: h - 10 - 20, x1: w - 10, y1: h - 10 },
  ];
}
type Rect = ReturnType<typeof liveChrome>[number];
const insideBands = (r: Rect, w: number, h: number, pad: FramePad) => r.y1 <= pad.top || r.y0 >= h - pad.bottom || r.x1 <= pad.left || r.x0 >= w - pad.right;

function checkFrame(lock: MapLock, w: number, h: number, pads: readonly FramePad[], chrome: Rect[], name: string) {
  const { camera, maxBounds, pad } = lockLimits(lock, w, h, pads);
  const t = transformAt(w, h, camera.zoom, maxBounds, camera);
  // MapLibre keeps the opening frame: no zoom-in to fit a box of another shape, no pan.
  expect(Math.abs(t.zoom - camera.zoom), name).toBeLessThan(1e-6);
  expect(Math.abs(t.center.lng - camera.center[0]) + Math.abs(t.center.lat - camera.center[1]), name).toBeLessThan(1e-9);
  // The whole square is on screen, inside the box the chrome's bands leave.
  expect(contains(shown(t), lock.area), name).toBe(true);
  const nw = px(t, lock.area.west, lock.area.north), se = px(t, lock.area.east, lock.area.south);
  expect(nw.x, name).toBeGreaterThanOrEqual(pad.left - 0.5);
  expect(nw.y, name).toBeGreaterThanOrEqual(pad.top - 0.5);
  expect(se.x, name).toBeLessThanOrEqual(w - pad.right + 0.5);
  expect(se.y, name).toBeLessThanOrEqual(h - pad.bottom + 0.5);
  // And it fills that box in one dimension (the largest such zoom).
  expect(Math.max(se.x - nw.x - (w - pad.left - pad.right), se.y - nw.y - (h - pad.top - pad.bottom)), name).toBeGreaterThan(-1);
  // Every piece of chrome lies inside a band.
  for (const r of chrome) expect(insideBands(r, w, h, pad), `${name}: ${r.id}`).toBe(true);
  // No other layout draws the area larger.
  for (const other of pads) expect(lockLimits(lock, w, h, [other]).camera.zoom, name).toBeLessThanOrEqual(camera.zoom + 1e-9);
  return { t, camera, maxBounds, pad };
}

describe("the training's live map at its opening frame (findings 1 and 3)", () => {
  for (const s of LIVE_SIZES) {
    it(`${s.name}: the whole square is shown, clear of the chrome; MapLibre neither zooms in nor pans it`, () => {
      const { t, camera, maxBounds, pad } = checkFrame(LOCK, s.w, s.h, LIVE_LOCK_PADS, liveChrome(s.w, s.h), s.name);
      // No training coordinate lies under the chrome: each is in the free box, at least 12 px from every piece of chrome.
      const coords = trainingCoordinates();
      expect(coords.length).toBeGreaterThan(60);
      for (const c of coords) {
        const p = px(t, c.lon, c.lat);
        expect(p.x > pad.left && p.x < s.w - pad.right && p.y > pad.top && p.y < s.h - pad.bottom, `${s.name}: ${c.lat},${c.lon}`).toBe(true);
        for (const r of liveChrome(s.w, s.h)) {
          const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1), dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
          expect(Math.hypot(dx, dy), `${s.name}: ${c.lat},${c.lon} near the ${r.id}`).toBeGreaterThanOrEqual(12);
        }
      }
      // Zooming out is refused; a pan at the opening frame does not move it.
      t.setZoom(camera.zoom - 1);
      expect(Math.abs(t.zoom - camera.zoom)).toBeLessThan(1e-6);
      t.setCenter(new LngLat(camera.center[0] + 0.05, camera.center[1] + 0.05));
      expect(contains(shown(t), LOCK.area)).toBe(true);
      // "1 km" and a pan as far as it goes: still inside what the opening frame shows.
      const k1 = transformAt(s.w, s.h, camera.zoom, maxBounds, { center: [camera.center[0] + 1, camera.center[1] + 1], zoom: zoomForWidth(1_000, s.w, camera.center[1]) });
      const frame: Box = { west: maxBounds[0][0], south: maxBounds[0][1], east: maxBounds[1][0], north: maxBounds[1][1] };
      expect(contains(frame, shown(k1), 1e-7), s.name).toBe(true);
      // The play harness clamps its camera as MapLibre does.
      const clamped = clampToBounds({ center: [camera.center[0] + 1, camera.center[1] + 1], zoom: k1.zoom }, s.w, s.h, maxBounds);
      expect(Math.abs(clamped.center[0] - k1.center.lng) + Math.abs(clamped.center[1] - k1.center.lat)).toBeLessThan(1e-7);
    });
  }

  it("beyond the square only the north-east corner's basemap tile is drawn (the only tile meeting the lock), whatever the frame shows", () => {
    const tiles = siteMeta.tiles.map((t) => ({ url: t.url, corners: t.corners as [number, number][] }));
    expect(tilesMeeting(tiles, LOCK.bounds).map((t) => t.url)).toEqual(["/maps/topo/0_3.webp"]);
    for (const s of LIVE_SIZES) {
      const { maxBounds } = lockLimits(LOCK, s.w, s.h, LIVE_LOCK_PADS);
      // The frame stays near the square: within 3.2 km of it at every tested size (the basemap's tile is 5 km across).
      const lat = (LOCK.area.south + LOCK.area.north) / 2, mPerLon = 111_320 * Math.cos((lat * Math.PI) / 180);
      const beyond = Math.max((LOCK.area.west - maxBounds[0][0]) * mPerLon, (maxBounds[1][0] - LOCK.area.east) * mPerLon, (LOCK.area.south - maxBounds[0][1]) * 111_320, (maxBounds[1][1] - LOCK.area.north) * 111_320);
      expect(beyond, s.name).toBeLessThan(3_200);
    }
  });

  it("control: the lock box as `maxBounds` (before the review) cut the square on a landscape map — at 1440 × 900 its north and south", () => {
    for (const s of LIVE_SIZES.filter((x) => x.w > x.h)) {
      const box = widenBox(LOCK.area, 100);
      const { camera } = lockLimits(LOCK, s.w, s.h, LIVE_LOCK_PADS);
      const t = transformAt(s.w, s.h, camera.zoom, [[box.west, box.south], [box.east, box.north]], camera);
      expect(t.zoom, s.name).toBeGreaterThan(camera.zoom + 0.1);
      expect(contains(shown(t), LOCK.area), s.name).toBe(false);
    }
  });
});

describe("the training's blank memory-check map (FreezeMap, locked the same way)", () => {
  for (const s of FREEZE_SIZES) {
    it(`${s.name}: the whole square, clear of its zoom buttons and scale bar; no zoom-in, no zoom-out past it`, () => {
      const { t, camera } = checkFrame(LOCK, s.w, s.h, FREEZE_LOCK_PADS, freezeChrome(s.w, s.h), s.name);
      t.setZoom(camera.zoom - 2);
      expect(Math.abs(t.zoom - camera.zoom)).toBeLessThan(1e-6);
      expect(contains(shown(t), LOCK.area)).toBe(true);
    });
  }
});
