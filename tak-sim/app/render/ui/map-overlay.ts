/**
 * The live map's reference overlay (SPEC/12 revisions (al) and (am), 10 Oct 2026): drawn by the app over the basemap
 * image, never baked into the tiles and never on the memory-check map (`FreezeMap` shows the plain basemap only).
 * Static: the same in every view and for every participant, reading nothing from the view.
 *
 * - the sectors L1–L4 from VP on: neutral grey dashed outlines and their codes only (`site-scenario.json` `sectors`),
 *   the codes small (9 px);
 * - road labels R1, R2, R3 and the R3 bridge ("R3:n silta (Kotkanjoki)" / "R3 bridge (Eagle River)"), which the radio
 *   names, small (9 px); "110 kV" along the power line (never its state), small;
 * - the command post (an own-forces flag, "JP" / "CP"), drawn up and to the left of its point so that neither the R1
 *   label east of it nor a unit staged on the point covers it (revision (am));
 * - the region's two other fires (`regionFires`, when the export has them): small incident markers with name and
 *   size, shown only at the widest (Area) zoom.
 *
 * Revision (am) removed the 1 km grid (clutter: nothing in the session refers to grid squares) and the water points
 * W1–W3 (researcher: the map should not point out where the water-taking places are; they stay in the radio texts
 * only, and the W2 pond stays as terrain in the tiles).
 *
 * No label sits near the old fire's north edge or V13's US2 (`test/render/map-overlay.spec.ts` holds every one
 * ≥ 600 m from both), none marks a safety zone, escape route or fuel, and none changes with the view.
 * Coordinates: the scenario export and `map-overlay.json` (`scripts/build-map-overlay.ts`, build time; its `grid` is
 * no longer drawn).
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LatLon, Polygon } from "../../engine/primitives.js";
import { SITE_SCENARIO } from "../../scenario/site-scenario.js";
import { englishNames } from "../../i18n/place-names.js";
import { OWN_FORMATION_HUE } from "./unit-markers.js";
import { MARKER_Z } from "./fire-layers.js";
import overlayData from "./map-overlay.json" with { type: "json" };

export const OVERLAY = overlayData;
export const SECTOR_LINE = { color: "#5f646b", widthPx: 1.3, dash: [4, 3] as const, opacity: 0.85 };
/** The overlay's text size, px (revision (am): 9, was 10–11). */
export const OVERLAY_FONT_PX = 9;
/**
 * The command post's flag sits up and to the left of its point (revision (am)): the marker's bottom-right corner is
 * this far from the point, px, so the R1 label ~300 m east and a unit staged on the point (V7–V10) leave it clear.
 */
export const CP_OFFSET_PX: readonly [number, number] = [-7, -5];

/**
 * The region's other fires show only at the widest zoom: at or beyond the Area level (20 km across) and wider than the
 * Palo frame (the whole study area) — never on the opening frame, whatever the window's shape (on a wide, low map the
 * Palo frame can be wider than 20 km; then they show only when the participant zooms out past it).
 */
export function regionFiresVisible(zoom: number, areaZoom: number, paloZoom: number): boolean {
  return zoom <= areaZoom + 0.01 && zoom < paloZoom - 0.01;
}

export interface RegionFire { readonly id: string; readonly nameFi: string; readonly nameEn: string; readonly haFi: string; readonly haEn: string; readonly at: LatLon }
/** The region's other fires from the scenario export (map-tiles adds them; absent in older exports). */
export function regionFires(): readonly RegionFire[] {
  return (SITE_SCENARIO as unknown as { readonly regionFires?: readonly RegionFire[] }).regionFires ?? [];
}

/** Where a sector's code goes: 2.6 km from the ignition towards the middle of the sector's outline, inside the study area. */
export function sectorLabelPoint(geometry: Polygon, ignition: LatLon): LatLon {
  const ring = geometry[0] ?? [];
  const c = { lat: ring.reduce((a, p) => a + p.lat, 0) / Math.max(1, ring.length), lon: ring.reduce((a, p) => a + p.lon, 0) / Math.max(1, ring.length) };
  const kx = 111_320 * Math.cos((ignition.lat * Math.PI) / 180), ky = 111_320;
  const dx = (c.lon - ignition.lon) * kx, dy = (c.lat - ignition.lat) * ky, len = Math.hypot(dx, dy) || 1;
  const r = 2_600;
  return { lat: ignition.lat + (dy / len) * r / ky, lon: ignition.lon + (dx / len) * r / kx };
}

export interface OverlayLabel { readonly key: string; readonly at: LatLon; readonly html: string; readonly kind: "road" | "bridge" | "power" | "cp" | "sector" | "region" }

const TEXT = `font:600 ${OVERLAY_FONT_PX}px/1.15 -apple-system,'Segoe UI',Roboto,sans-serif;color:#1c1b19;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Every overlay label, in a fixed order, in the session language. */
export function overlayLabels(lang: "fi" | "en"): OverlayLabel[] {
  const out: OverlayLabel[] = [];
  OVERLAY.roads.forEach((r, k) => out.push({ key: `road:${r.id}:${k}`, at: r.at, kind: "road", html: `<span style="display:inline-block;padding:0 2px;border:1px solid #6b6660;border-radius:2px;background:#fffdf8e6;font:700 ${OVERLAY_FONT_PX}px/10px ui-monospace,Consolas,monospace;color:#1c1b19">${esc(r.id)}</span>` }));
  const bridge = lang === "en" ? englishNames("R3 bridge (Kotkanjoki)") : OVERLAY.bridge.fi;
  out.push({ key: "bridge", at: OVERLAY.bridge.at, kind: "bridge", html: `<span style="${TEXT};position:relative;top:-10px">${esc(bridge)}</span>` });
  out.push({ key: "power", at: OVERLAY.powerLine.at, kind: "power", html: `<span data-power style="${TEXT};font-weight:500;display:inline-block">${esc(OVERLAY.powerLine.label)}</span>` });
  out.push({ key: "cp", at: OVERLAY.commandPost, kind: "cp", html: `<span style="${TEXT};margin-right:1px">${lang === "en" ? "CP" : "JP"}</span>${CP_SVG}` });
  for (const s of SITE_SCENARIO.sectors) out.push({ key: `sector:${s.id}`, at: sectorLabelPoint(s.geometry, SITE_SCENARIO.ignition), kind: "sector", html: `<span style="font:700 ${OVERLAY_FONT_PX}px/1 ui-monospace,Consolas,monospace;color:${SECTOR_LINE.color};text-shadow:0 0 2px #fff,0 0 3px #fff,0 0 4px #fff">${esc(s.id)}</span>` });
  for (const r of regionFires()) {
    const name = lang === "en" ? `${r.nameEn}, ${r.haEn}` : `${r.nameFi}, ${r.haFi}`;
    out.push({ key: `region:${r.id}`, at: r.at, kind: "region", html: `${REGION_SVG}<span style="${TEXT};margin-left:3px">${esc(name)}</span>` });
  }
  return out;
}

/** The command post: an own-forces flag on a staff, on a white casing (revision (am): 10 × 12, was 12 × 14). */
const CP_SVG = `<svg width="10" height="12" viewBox="0 0 10 12" style="vertical-align:-2px"><path d="M1.5 11.5V1" stroke="#fff" stroke-width="2.6"/><path d="M1.5 11.5V1" stroke="${OWN_FORMATION_HUE}" stroke-width="1.4"/><path d="M2 1.2h6.5v4.2H2z" fill="${OWN_FORMATION_HUE}" stroke="#fff" stroke-width="0.9"/></svg>`;
/** Another incident in the region: a small dark-red diamond. */
const REGION_SVG = `<svg width="11" height="11" viewBox="0 0 11 11" style="vertical-align:-2px"><path d="M5.5 0.8 10.2 5.5 5.5 10.2 0.8 5.5Z" fill="#8e1b12" stroke="#fff" stroke-width="1.2"/></svg>`;

/** Sector lines: add right after the basemap, under every fire and unit layer (revision (am): no grid any more). */
export function addOverlayLines(map: MapLibreMap): void {
  const sectors = { type: "FeatureCollection" as const, features: SITE_SCENARIO.sectors.map((s) => ({ type: "Feature" as const, properties: { id: s.id }, geometry: { type: "Polygon" as const, coordinates: s.geometry.map((r) => r.map((p) => [p.lon, p.lat])) } })) };
  map.addSource("ref-sectors", { type: "geojson", data: sectors });
  map.addLayer({ id: "ref-sectors-line", type: "line", source: "ref-sectors", paint: { "line-color": SECTOR_LINE.color, "line-width": SECTOR_LINE.widthPx, "line-opacity": SECTOR_LINE.opacity, "line-dasharray": [...SECTOR_LINE.dash] } });
}

/** Marker anchor and offset of an overlay label: the command post up-left of its point, region fires to the right, the rest centred. */
export function overlayAnchor(kind: OverlayLabel["kind"]): { readonly anchor: "center" | "left" | "bottom-right"; readonly offset: readonly [number, number] } {
  if (kind === "cp") return { anchor: "bottom-right", offset: CP_OFFSET_PX };
  if (kind === "region") return { anchor: "left", offset: [-5, 0] };
  return { anchor: "center", offset: [0, 0] };
}

/**
 * The overlay's DOM labels (the offline style has no glyphs). Returns an update to call after every settled move; the
 * update returns whether the region's other fires are drawn now (the legend lists them only then, revision (am)).
 */
export function addOverlayLabels(map: MapLibreMap, lang: "fi" | "en", levels: () => { readonly areaZoom: number; readonly paloZoom: number }): () => boolean {
  const markers: { label: OverlayLabel; marker: maplibregl.Marker }[] = [];
  for (const label of overlayLabels(lang)) {
    const el = document.createElement("div");
    el.className = "map-overlay-label";
    el.innerHTML = label.html; // authored strings and the scenario's own names, escaped above
    el.style.cssText = `pointer-events:none;white-space:nowrap;display:flex;align-items:center;z-index:${MARKER_Z.overlay}`;
    const { anchor, offset } = overlayAnchor(label.kind);
    markers.push({ label, marker: new maplibregl.Marker({ element: el, anchor, offset: [...offset] as [number, number] }).setLngLat([label.at.lon, label.at.lat]).addTo(map) });
  }
  return () => {
    const { areaZoom, paloZoom } = levels();
    const wide = regionFiresVisible(map.getZoom(), areaZoom, paloZoom);
    // "110 kV" along the line: its angle on screen (rotation is off, so it only needs the projection).
    const a = map.project([OVERLAY.powerLine.at.lon, OVERLAY.powerLine.at.lat]), t = map.project([OVERLAY.powerLine.towards.lon, OVERLAY.powerLine.towards.lat]);
    const deg = (Math.atan2(t.y - a.y, t.x - a.x) * 180) / Math.PI;
    for (const { label, marker } of markers) {
      const el = marker.getElement();
      if (label.kind === "region") el.style.display = wide ? "flex" : "none";
      if (label.kind === "power") { const s = el.querySelector<HTMLElement>("[data-power]"); if (s) s.style.transform = `rotate(${deg}deg) translateY(-6px)`; }
    }
    return wide && regionFires().length > 0;
  };
}
