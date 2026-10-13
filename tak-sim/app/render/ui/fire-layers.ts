/**
 * The fire and projection layers (SPEC/12 revision 24 Sep (c)). Solid = observed, dashed =
 * predicted; grey = past, red = now, light red dashed = AI projection. All styling comes from
 * `fire-theme.json`. Drawing order, bottom to top, is the spec's §4:
 *
 *   burnt area · earlier perimeters · projection fill (to the next view) · burning zone · head glow ·
 *   quiet / contained edge (each on a light casing) · uncontained edge (+ ticks) · spot fires ·
 *   projection isochrones · detections
 *
 * The projection bands are the isochrones minus the current fire (perimeter, detached fronts, burnt area and
 * burning zone) as a true polygon difference (`projectionBands`, SPEC/12 revision (ah)), so they never cover it.
 *
 * — then the units, added after this by MapView. Text labels are DOM markers (the offline style
 * has no glyphs), so they sit above the canvas.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { LatLon, Polygon } from "../../engine/primitives.js";
import type { RenderableCycle, RenderableEnvelope } from "../../boundary/render-boundary.js";
import { projectionValidityLabel } from "../projection-validity.js";
import { projectionBands, projectionGrowth } from "../projection-growth.js";
import { codeIn } from "../../i18n/place-names.js";
import { PAST_LABEL_BEARINGS, placeLabels, type LabelKind, type LabelRequest, type Rect } from "../label-placement.js";
import theme from "./fire-theme.json" with { type: "json" };

export const FIRE_THEME = theme;
const P = theme.projection;
/** The theme's nominal horizons: a single-step view's isochrones are at T+10/20, a merged view's at
 * T+20/40 — the outer one is the next situation (2 Oct 2026). Styling goes by rank, so a merged view
 * is drawn like a single one. */
const ISO_MINUTES = [10, 20] as const;

const EMPTY = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };
const ring = (r: readonly LatLon[]) => r.map((p) => [p.lon, p.lat]);
const polygonFeature = (poly: Polygon, props: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: poly.map(ring) } });
const lineFeature = (line: readonly LatLon[], props: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: ring(line) } });
const pointFeature = (p: LatLon, props: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });

function canvasImage(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): ImageData {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx);
  return ctx.getImageData(0, 0, w, h);
}

/** NWCG-style ticks: one short bar per `tickSpacingPx` along the edge, as a line pattern. */
function tickPattern(): ImageData {
  const u = theme.uncontained;
  return canvasImage(u.tickSpacingPx, u.tickLengthPx, (ctx) => { ctx.fillStyle = u.color; ctx.fillRect(0, 0, u.tickWidthPx, u.tickLengthPx); });
}

/** A spot fire: solid red point with a white ring — dashed when unconfirmed. */
function spotIcon(confirmed: boolean): ImageData {
  const s = theme.spotFire;
  const size = s.diameterPx + 2 * s.ringWidthPx + 4;
  return canvasImage(size, size, (ctx) => {
    const c = size / 2;
    ctx.beginPath(); ctx.arc(c, c, s.diameterPx / 2 + s.ringWidthPx / 2 + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = s.ringColor; ctx.lineWidth = s.ringWidthPx;
    if (!confirmed) ctx.setLineDash([2.5, 2]);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, s.diameterPx / 2, 0, 2 * Math.PI);
    ctx.fillStyle = s.color; ctx.fill();
  });
}

/** Adds the fire sources, images and layers, in drawing order. Call once, after the basemap. */
export function addFireLayers(map: MapLibreMap) {
  for (const id of ["fire-burnt", "fire-past", "fire-zone", "fire-edge", "fire-spots", "fire-detections", "proj-iso"]) map.addSource(id, { type: "geojson", data: EMPTY });
  map.addImage("fire-ticks", tickPattern());
  map.addImage("spot-confirmed", spotIcon(true));
  map.addImage("spot-unconfirmed", spotIcon(false));

  // 2. Burnt area: fill only; its edge is the perimeter lines.
  map.addLayer({ id: "fire-burnt-fill", type: "fill", source: "fire-burnt", paint: { "fill-color": theme.burnt.color, "fill-opacity": theme.burnt.opacity } });
  // 3. Earlier perimeters: thin, grey, solid, fading with age.
  map.addLayer({ id: "fire-past-line", type: "line", source: "fire-past", paint: { "line-color": theme.past.color, "line-width": theme.past.widthPx, "line-opacity": ["get", "opacity"] } });
  // 4. Projection: arrival-time bands (0–10, 10–20 min; merged views 0–20, 20–40), strongest nearest the fire.
  map.addSource("proj-bands", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "proj-bands-fill", type: "fill", source: "proj-bands", paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } });
  // 5. Current fire: burning zone, head glow, edges, ticks, spot fires.
  map.addLayer({ id: "fire-zone-fill", type: "fill", source: "fire-zone", paint: { "fill-color": theme.burningZone.color, "fill-opacity": theme.burningZone.opacity } });
  map.addLayer({ id: "fire-head-glow", type: "line", source: "fire-edge", filter: ["all", ["==", ["get", "status"], "uncontained"], ["get", "head"]],
    paint: { "line-color": theme.headGlow.color, "line-width": theme.headGlow.widthPx, "line-blur": theme.headGlow.blurPx, "line-opacity": theme.headGlow.opacity } });
  // Quiet edge (status "inactive": not spreading, no crew; revision (ah)) and contained edge, each over a light
  // casing so it holds over the dark burnt fill. Any other status string draws nothing rather than failing.
  const join = { "line-join": "round" as const, "line-cap": "round" as const };
  map.addLayer({ id: "fire-edge-inactive-casing", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "inactive"], layout: join, paint: { "line-color": theme.inactive.casingColor, "line-width": theme.inactive.casingWidthPx } });
  map.addLayer({ id: "fire-edge-inactive", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "inactive"], layout: join, paint: { "line-color": theme.inactive.color, "line-width": theme.inactive.widthPx } });
  map.addLayer({ id: "fire-edge-contained-casing", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "contained"], layout: join, paint: { "line-color": theme.contained.casingColor, "line-width": theme.contained.casingWidthPx } });
  map.addLayer({ id: "fire-edge-contained", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "contained"], layout: join, paint: { "line-color": theme.contained.color, "line-width": theme.contained.widthPx } });
  map.addLayer({ id: "fire-edge-uncontained", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "uncontained"], paint: { "line-color": theme.uncontained.color, "line-width": theme.uncontained.widthPx } });
  // Rings run counter-clockwise, so the unburned side is on the right: positive offset = outside.
  const side = theme.uncontained.tickSide === "inside" ? -1 : 1;
  map.addLayer({ id: "fire-edge-ticks", type: "line", source: "fire-edge", filter: ["==", ["get", "status"], "uncontained"],
    paint: { "line-pattern": "fire-ticks", "line-width": theme.uncontained.tickLengthPx, "line-offset": side * (theme.uncontained.widthPx / 2 + theme.uncontained.tickLengthPx / 2) } });
  map.addLayer({ id: "fire-spots", type: "symbol", source: "fire-spots",
    layout: { "icon-image": ["case", ["get", "confirmed"], "spot-confirmed", "spot-unconfirmed"], "icon-allow-overlap": true, "icon-ignore-placement": true } });
  // 6. Projection isochrones: dashed, thinner with horizon. Dashes are in line widths in MapLibre.
  // Only the horizons listed in `lineMinutes` get a line; the bands carry the rest.
  for (const m of ISO_MINUTES.filter((x) => (P.lineMinutes as readonly number[]).includes(x))) {
    const w = P.widthPxByMinutes[String(m) as "10" | "20"];
    // A pale halo under each line, dashed in the same rhythm (a solid halo would read as observed).
    const hw = w + P.haloExtraPx;
    if (P.haloOpacity > 0) map.addLayer({ id: `proj-halo-${m}`, type: "line", source: "proj-iso", filter: ["==", ["get", "band"], m],
      paint: { "line-color": P.haloColor, "line-width": hw, "line-opacity": P.haloOpacity, "line-dasharray": [P.dashPx / hw, P.gapPx / hw] } });
    map.addLayer({ id: `proj-line-${m}`, type: "line", source: "proj-iso", filter: ["==", ["get", "band"], m],
      paint: { "line-color": P.color, "line-width": w, "line-dasharray": [P.dashPx / w, P.gapPx / w] } });
  }
  // 7. Drone thermal detections, coloured by age.
  map.addLayer({ id: "fire-detections", type: "circle", source: "fire-detections", paint: theme.detections.hollow
    ? { "circle-radius": theme.detections.radiusPx, "circle-opacity": 0, "circle-stroke-color": ["get", "color"], "circle-stroke-width": theme.detections.strokePx }
    : { "circle-radius": theme.detections.radiusPx, "circle-color": ["get", "color"] } });
}

/** Colour of a detection `ageMin` minutes old, or null when it is too old to show. */
export function detectionColor(ageMin: number): string | null {
  for (const b of theme.detections.bands) if (ageMin < b.maxAgeMin) return b.color;
  return null;
}

/** The arrival-time bands as map features, styled by rank (strongest nearest the fire). */
function bandFeatures(isos: RenderableEnvelope["isochrones"], cut: readonly Polygon[], opacity: number, grows: (p: Polygon) => boolean): GeoJSON.Feature[] {
  return projectionBands(isos, cut, grows).flatMap(({ rank, rings }) => {
    const st = P.bands[rank];
    return st ? [polygonFeature(rings, { color: st.color, opacity: st.opacity * opacity })] : [];
  });
}

/** The last view's bands: the geometry is fixed per view, and the map is updated on every snapshot (the countdown ticks). */
let bandCache: { key: string; features: GeoJSON.Feature[] } | null = null;
function cachedBandFeatures(key: string, build: () => GeoJSON.Feature[]): GeoJSON.Feature[] {
  if (bandCache?.key !== key) bandCache = { key, features: build() };
  return bandCache.features;
}

/** The vertex furthest along `bearingDeg` — where a label for that outline goes. */
function furthestAlong(points: readonly LatLon[], bearingDeg: number): LatLon | null {
  const t = (bearingDeg * Math.PI) / 180;
  let best: LatLon | null = null;
  let bestV = -Infinity;
  for (const p of points) {
    const v = p.lon * Math.cos((p.lat * Math.PI) / 180) * Math.sin(t) + p.lat * Math.cos(t);
    if (v > bestV) { bestV = v; best = p; }
  }
  return best;
}

interface FireLabel { readonly key: string; readonly kind: LabelKind; readonly anchors: readonly LatLon[]; readonly text: string; readonly css: string }
const labelsByMap = new WeakMap<MapLibreMap, Map<string, { marker: maplibregl.Marker; label: FireLabel }>>();
/** Who hears which labels are shown after each placement (MapView logs it, SPEC/07 revision (al)). */
const placementListeners = new WeakMap<MapLibreMap, (shown: readonly string[], hidden: readonly string[]) => void>();
export function onFireLabelsPlaced(map: MapLibreMap, listener: (shown: readonly string[], hidden: readonly string[]) => void): void { placementListeners.set(map, listener); }

/** The z-order of the map's DOM markers (revision (al)): reference overlay < units < fire labels < spot labels < a hovered unit. */
export const MARKER_Z = { overlay: 1, unit: 2, label: 3, spotLabel: 4, hover: 10 } as const;

/**
 * Keeps fire labels readable (`placeLabels`, `app/render/label-placement.ts`): spot-fire labels first and never
 * yielding to unit markers, then the projection's, then the earlier perimeters' on their own lines. A label with no
 * free placement is hidden until the map moves again.
 */
export function declutterFireLabels(map: MapLibreMap) {
  const current = labelsByMap.get(map);
  if (!current) return;
  const container = map.getContainer();
  const box = container.getBoundingClientRect();
  const rel = (r: DOMRect): Rect => ({ left: r.left - box.left, top: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top });
  // The map's own overlays (wind, zoom buttons, legend, scale bar; the TAK shell's info card and coordinate readout,
  // `data-map-chrome`): a label under them could not be read.
  const overlays = Array.from(container.parentElement?.querySelectorAll("[data-tour=wind], [data-tour=zoom], [data-tour=legend], [data-map-chrome], .maplibregl-ctrl-bottom-right > *") ?? []).map((el) => rel(el.getBoundingClientRect()));
  const units = Array.from(container.querySelectorAll(".unit-marker")).filter((el) => (el as HTMLElement).style.display !== "none").map((el) => rel(el.getBoundingClientRect()));
  const requests: LabelRequest[] = [];
  for (const [key, { marker, label }] of current) {
    const el = marker.getElement();
    requests.push({ key, kind: label.kind, anchors: label.anchors.map((a) => map.project([a.lon, a.lat])), w: el.offsetWidth, h: el.offsetHeight });
  }
  const result = placeLabels(requests, overlays, units, { left: 0, top: 0, right: box.width, bottom: box.height });
  const shown: string[] = [], hidden: string[] = [];
  for (const [key, { marker, label }] of current) {
    const p = result.get(key) ?? null;
    const el = marker.getElement();
    if (p) {
      const a = label.anchors[p.anchor]!;
      marker.setLngLat([a.lon, a.lat]);
      marker.setOffset([p.dx, p.dy]);
      shown.push(key);
    } else hidden.push(key);
    el.style.visibility = p ? "visible" : "hidden";
  }
  const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  placementListeners.get(map)?.(shown.sort(byKey), hidden.sort(byKey));
}

function syncLabels(map: MapLibreMap, labels: readonly FireLabel[]) {
  let current = labelsByMap.get(map);
  if (!current) { current = new Map(); labelsByMap.set(map, current); }
  const seen = new Set<string>();
  for (const l of labels) {
    seen.add(l.key);
    let m = current.get(l.key);
    const at = l.anchors[0]!;
    if (!m) {
      const el = document.createElement("div");
      // Set before the Marker is built: MapLibre adds its positioning classes (`maplibregl-marker`, the anchor) only in
      // the constructor, so assigning `className` afterwards would strip them and every label would lose its place
      // (review 13 Oct 2026). A label's key fixes its kind, so the class never needs to change. The TAK Overlay
      // Manager hides the earlier perimeters' times by this class.
      el.className = `fire-label fire-label-${l.kind}`;
      m = { marker: new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([at.lon, at.lat]).addTo(map), label: l };
      current.set(l.key, m);
    }
    m.label = l;
    const el = m.marker.getElement();
    el.textContent = l.text;
    el.style.cssText = `pointer-events:none;white-space:nowrap;visibility:hidden;z-index:${l.kind === "spot" ? MARKER_Z.spotLabel : MARKER_Z.label};${l.css}`;
    m.marker.setLngLat([at.lon, at.lat]);
  }
  for (const [k, m] of current) if (!seen.has(k)) { m.marker.remove(); current.delete(k); }
  requestAnimationFrame(() => declutterFireLabels(map));
}

/** Points on a ring at the bearings of `PAST_LABEL_BEARINGS` about the spread direction: where an earlier perimeter's time may sit. */
export function pastLabelAnchors(ringPts: readonly LatLon[], spread: number): LatLon[] {
  const out: LatLon[] = [];
  for (const b of PAST_LABEL_BEARINGS) {
    const p = furthestAlong(ringPts, spread + b);
    if (p && !out.some((q) => q.lat === p.lat && q.lon === p.lon)) out.push(p);
  }
  return out;
}

/** Earlier perimeters whose label points (on the spread bearing) lie closer than this share one label. */
export const PAST_LABEL_MERGE_M = 40;

/**
 * The earlier perimeters' labels (revision (al)): one per ring, on that ring; rings that run together where the label
 * goes (the fire did not move between them — V9's 16:20 and 16:40) share one label, their times in time order
 * ("16:20 · 16:40"). `index` is the newest ring's position in `past` (newest first), which sets the opacity.
 */
export function pastLabelGroups(past: readonly { readonly time: string; readonly geometry: readonly (readonly LatLon[])[] }[], spread: number): { index: number; text: string; anchors: LatLon[] }[] {
  const groups: { index: number; times: string[]; anchors: LatLon[] }[] = [];
  past.forEach((p, k) => {
    const anchors = pastLabelAnchors(p.geometry[0] ?? [], spread);
    if (anchors.length === 0) return;
    const g = groups.find((x) => metresBetween(x.anchors[0]!, anchors[0]!) < PAST_LABEL_MERGE_M);
    if (g) g.times.push(p.time);
    else groups.push({ index: k, times: [p.time], anchors });
  });
  return groups.map((g) => ({ index: g.index, anchors: g.anchors, text: [...g.times].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(" · ") }));
}

function metresBetween(a: LatLon, b: LatLon): number {
  const k = (Math.PI / 180) * 6_371_000;
  return Math.hypot((b.lat - a.lat) * k, (b.lon - a.lon) * k * Math.cos((a.lat * Math.PI) / 180));
}

const MONO ="font:700 10px/1 ui-monospace,Consolas,monospace;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 4px #fff";

/** Updates every fire and projection layer for a cycle. `envelope` is null only before it is revealed. */
export function updateFireLayers(map: MapLibreMap, cycle: RenderableCycle | null, envelope: RenderableEnvelope | null, lang: "fi" | "en" = "fi") {
  const set = (id: string, features: GeoJSON.Feature[]) => (map.getSource(id) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  const fire = cycle?.fire;
  const spread = cycle ? (cycle.wind.fromDeg + 180) % 360 : 0;
  const labels: FireLabel[] = [];

  set("fire-burnt", (fire?.burnt_area.geometry ?? []).map((p) => polygonFeature(p)));
  const past = (fire?.perimeters_past ?? []).slice(0, theme.past.maxCount);
  const step = past.length > 1 ? (theme.past.opacityNewest - theme.past.opacityMin) / (past.length - 1) : 0;
  // Each ring is one part of the earlier fire (the main fire, a separate front), not a hole; the time label goes on the main one.
  set("fire-past", past.flatMap((p, k) => p.geometry.map((r) => lineFeature(r, { opacity: theme.past.opacityNewest - k * step }))));
  for (const g of pastLabelGroups(past, spread)) {
    labels.push({ key: `past:${g.index}`, kind: "past", anchors: g.anchors, text: g.text, css: `${MONO};color:${theme.past.labelColor};opacity:${theme.past.opacityNewest - g.index * step}` });
  }
  set("fire-zone", (fire?.burning_zone ?? []).map((p) => polygonFeature(p)));
  set("fire-edge", (fire?.perimeter_current ?? []).map((s) => lineFeature(s.line, { status: s.status, head: s.is_head })));
  set("fire-spots", (fire?.spot_fires ?? []).map((s) => pointFeature(s.position, { confirmed: s.confirmed })));
  for (const s of fire?.spot_fires ?? []) labels.push({ key: `spot:${s.callsign}`, kind: "spot", anchors: [s.position], text: codeIn(lang, s.callsign), css: `${MONO};color:${theme.spotFire.labelColor}` });
  const nowS = cycle?.startsAtVirtual ?? 0;
  set("fire-detections", (fire?.detections ?? []).flatMap((d) => {
    const color = detectionColor((nowS - d.time) / 60);
    return color ? [pointFeature(d.position, { color })] : [];
  }));

  // The projection — the same envelope in both groups (SPEC/02 revision (o) §1).
  const isos = envelope ? envelope.isochrones : [];
  const byRank = [...isos].sort((a, b) => a.minutes - b.minutes);
  // Only the parts that grow get a line, a band or the label (projection audit P1-a, P3-a): from 17:20 the old,
  // held fire's projected part only traces its edge while the rekindled front grows. When nothing grows anywhere
  // (V9, the omission) the projection is drawn as before, so that view looks like every other one (review 3 Oct 2026:
  // a label of its own in the omission view would cue it).
  const fireNow = cycle ? [cycle.perimeter, ...cycle.detachedFronts] : [];
  const { growth, shown: grows } = projectionGrowth(isos, fireNow, P.growthMinHa);
  set("proj-iso", byRank.flatMap((iso, k) => [iso.polygon, ...iso.detachedParts].filter(grows).map((p) => polygonFeature(p, { minutes: iso.minutes, band: ISO_MINUTES[k] }))));
  const opacity = envelope ? P.certaintyOpacity[envelope.projectionCertainty] : 1;
  for (const m of ISO_MINUTES) {
    if (map.getLayer(`proj-line-${m}`)) map.setPaintProperty(`proj-line-${m}`, "line-opacity", opacity);
    if (map.getLayer(`proj-halo-${m}`)) map.setPaintProperty(`proj-halo-${m}`, "line-opacity", P.haloOpacity * opacity);
  }
  // Cut out of the bands: everything that is the current fire on the map, not only the reported perimeter.
  const fireCut = [...fireNow, ...(fire?.burnt_area.geometry ?? []), ...(fire?.burning_zone ?? [])];
  const bandKey = cycle ? `${cycle.index}|${cycle.stepShown}|${opacity}|${isos.map((i) => `${i.minutes}:${i.polygon[0]?.length ?? 0}:${i.detachedParts.length}`).join(",")}|${fireCut.length}` : "";
  set("proj-bands", envelope && cycle ? cachedBandFeatures(bandKey, () => bandFeatures(isos, fireCut, opacity, grows)) : []);
  const outer = Math.max(0, ...isos.map((i) => i.minutes));
  for (const iso of isos) {
    // The label sits on the part that grows most (with two fires, the live one).
    const parts = [iso.polygon, ...iso.detachedParts];
    const growing = parts.filter(grows).sort((a, b) => growth(b) - growth(a));
    const at = furthestAlong((growing[0] ?? iso.polygon)[0] ?? [], spread);
    const isOuter = iso.minutes === outer;
    const text = (isOuter ? (lang === "en" ? P.labelOuterEn ?? P.labelOuter : P.labelOuter) : P.labelInner).replace("{m}", String(iso.minutes));
    // SPEC/12 §4: the outermost label carries the horizon, "ennuste voimassa klo … saakka" (English: "forecast valid until …"), on a second line.
    const full = isOuter && text && envelope ? `${text}\n${projectionValidityLabel(envelope, lang)}` : text;
    if (at && text) labels.push({ key: `iso:${iso.minutes}`, kind: "iso", anchors: [at], text: full, css: `${MONO};color:${P.labelColor};opacity:${opacity};white-space:pre;text-align:center;line-height:1.3` });
  }
  syncLabels(map, labels);
}
