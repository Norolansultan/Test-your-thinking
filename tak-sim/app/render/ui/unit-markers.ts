/**
 * Ground units, their crews and aircraft as DOM markers on the map (the offline style carries no
 * glyphs, so map text layers cannot label them).
 *
 * SPEC/12 §8: one hue for own formations, identity by shape — a rectangle for a ground unit, a
 * dome for an aircraft (the MIL-STD-2525 friendly frames) — with a glyph inside, always solid: a
 * dashed frame is reserved for the participant's own allocations (SPEC/12 §6.2).
 *
 * SPEC/18 revision (m): an engine cannot follow its crew into the forest. Where a crew works the
 * fire edge on foot, the map shows two symbols joined by a line — the crew (labelled, with a glyph
 * for what it is doing) and, smaller and unlabelled, its vehicle where a vehicle can be; the line
 * is the hose line when water comes from the vehicle.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { sortedKeys } from "../../engine/deterministic-object.js";
import type { LatLon } from "../../engine/primitives.js";
import type { UnitWork } from "../../scenario/types.js";
import { taskLabel, UNIT_ROSTER, UNIT_ROSTER_EN } from "./unit-roster.js";
import { unitCallSign } from "../../i18n/place-names.js";
import { TASK_ICON_SVG, taskGlyph, UNIT_ICON_SVG, unitKind } from "./unit-icons.js";
import { MARKER_Z } from "./fire-layers.js";
import { COMPACT_FRAME, COMPACT_VEHICLE_FRAME } from "../unit-declutter.js";
import { takMarkerSvg } from "./tak/tak-symbols.js";

export const OWN_FORMATION_HUE = "#4fb3ff"; // cyan-blue

export type { AirKind } from "../../scenario/types.js";
import type { AirKind } from "../../scenario/types.js";

export interface UnitMarkerData {
  readonly key: string;
  readonly id: string;
  /** `crew`: on foot away from its vehicle; `vehicle`: the parked vehicle of such a crew; `unit`: crew and vehicle together; `air`: aircraft. */
  readonly role: "crew" | "vehicle" | "unit" | "air";
  readonly air: AirKind | null;
  readonly at: LatLon;
  readonly work: UnitWork | null;
  /** For crew and vehicle: where the other half is. */
  readonly partner: LatLon | null;
}

/** Straight-line ground distance, metres (short distances; equirectangular is plenty). */
function metres(a: LatLon, b: LatLon): number {
  const k = (Math.PI / 180) * 6_371_000;
  return Math.hypot((b.lat - a.lat) * k, (b.lon - a.lon) * k * Math.cos((a.lat * Math.PI) / 180));
}

const roundTo = (m: number, step: number) => Math.max(step, Math.round(m / step) * step);

/** Crew and vehicle markers for the ground units, and one marker per aircraft. */
export function unitMarkerData(
  unitPositions: Readonly<Record<string, LatLon>>,
  unitWork: Readonly<Record<string, UnitWork>>,
  aircraft: readonly { readonly platformId: string; readonly kind: AirKind; readonly position: LatLon }[],
): UnitMarkerData[] {
  const out: UnitMarkerData[] = [];
  for (const id of sortedKeys(unitPositions)) {
    const at = unitPositions[id]!;
    const work = unitWork[id] ?? null;
    if (work?.vehicle) {
      out.push({ key: `veh:${id}`, id, role: "vehicle", air: null, at: work.vehicle, work, partner: at });
      out.push({ key: `unit:${id}`, id, role: "crew", air: null, at, work, partner: work.vehicle });
    } else {
      out.push({ key: `unit:${id}`, id, role: "unit", air: null, at, work, partner: null });
    }
  }
  for (const a of aircraft) out.push({ key: `air:${a.platformId}`, id: a.platformId, role: "air", air: a.kind, at: a.position, work: null, partner: null });
  return out;
}

/** The hover card's lines: first the title, then details. */
let CARD_LANG: "fi" | "en" = "fi";
/** The language of the hover cards (the session language; `MapView` sets it). */
export function setMarkerLang(lang: "fi" | "en"): void { CARD_LANG = lang; }

/** The hover card's lines in the current card language (exported for the English-screen test). */
export function cardLines(d: UnitMarkerData): string[] {
  return CARD_LANG === "en" ? cardLinesEn(d) : cardLinesFi(d);
}

function cardLinesEn(d: UnitMarkerData): string[] {
  const e = UNIT_ROSTER_EN[d.id];
  const id = unitCallSign("en", d.id); // VPK is VOL1 in English (revision (ae))
  const task = d.work ? taskLabel(d.id, d.work.task, "en") : null;
  const apart = d.partner ? roundTo(metres(d.at, d.partner), 10) : 0;
  const roster = e ? [e.crew && `Crew ${e.crew}`, e.from, e.detail] : [];
  const lines: (string | undefined | false)[] =
    d.role === "crew" ? [`${id} · ${task}`, e?.crew ? `Crew ${e.crew} on foot at the fire edge` : "On foot at the fire edge", d.work?.hoseM ? `Hose line approx. ${d.work.hoseM} m from the vehicle` : `Vehicle approx. ${apart} m away`, tankEn(d), e?.type]
    : d.role === "vehicle" ? [`${id} · vehicle`, e?.type, tankEn(d), e?.type.startsWith("Forest-fire") ? "Off-road, close to the crew" : "On the road — the vehicle cannot get into the forest", `Crew approx. ${apart} m away: ${task?.toLowerCase()}`]
    : d.role === "unit" ? [`${id} · ${task ?? e?.type ?? "Unit"}`, ...(task ? [e?.type] : []), tankEn(d), ...roster]
    : [e ? `${id} · ${e.type}` : `${id} · Aircraft`, ...roster];
  return lines.filter((l): l is string => !!l);
}

/** The tank line of a ground unit's card: its water at the time the map shows; nothing for a unit without a tank. */
function tankFi(d: UnitMarkerData): string | undefined {
  return typeof d.work?.waterPct === "number" ? `Vettä säiliössä n. ${d.work.waterPct} %` : undefined;
}
function tankEn(d: UnitMarkerData): string | undefined {
  return typeof d.work?.waterPct === "number" ? `Water in the tank approx. ${d.work.waterPct} %` : undefined;
}

function cardLinesFi(d: UnitMarkerData): string[] {
  const entry = UNIT_ROSTER[d.id];
  const task = d.work ? taskLabel(d.id, d.work.task, "fi") : null;
  const apart = d.partner ? roundTo(metres(d.at, d.partner), 10) : 0;
  const roster = entry ? [entry.crew && `Miehistö ${entry.crew}`, entry.fromFi, entry.detailFi] : [];
  let lines: (string | undefined | false)[];
  switch (d.role) {
    case "crew":
      lines = [
        `${d.id} · ${task}`,
        entry?.crew ? `Miehistö ${entry.crew} jalkaisin palon reunalla` : "Jalkaisin palon reunalla",
        d.work?.hoseM ? `Letkulinja n. ${d.work.hoseM} m ajoneuvolta` : `Ajoneuvo n. ${apart} m päässä`,
        tankFi(d),
        entry?.typeFi,
      ];
      break;
    case "vehicle":
      lines = [
        `${d.id} · ajoneuvo`,
        entry?.typeFi,
        tankFi(d),
        entry?.typeFi.startsWith("Maastopalo") ? "Maastossa, lähellä miehistöä" : "Tiellä — ajoneuvo ei pääse metsään",
        `Miehistö n. ${apart} m päässä: ${task?.toLowerCase()}`,
      ];
      break;
    case "unit":
      lines = [`${d.id} · ${task ?? entry?.typeFi ?? "Yksikkö"}`, ...(task ? [entry?.typeFi] : []), tankFi(d), ...roster];
      break;
    case "air":
      lines = [entry ? `${d.id} · ${entry.typeFi}` : `${d.id} · Ilma-alus`, ...roster];
      break;
  }
  return lines.filter((l): l is string => !!l);
}

function glyphSvg(d: UnitMarkerData): string {
  if (d.role === "crew") {
    const g = d.work ? taskGlyph(d.work.task) : null;
    if (g) return TASK_ICON_SVG[g];
  }
  return UNIT_ICON_SVG[unitKind(d.id, d.air)];
}

/**
 * How a map draws its unit markers (SPEC/28 §2.3): `classic` — the own-forces frames with type glyphs above; `2525` — the
 * TAK shell's MIL-STD-2525 symbols (milsymbol, `tak/tak-symbols.ts`) in the same boxes, so the declutter is unchanged.
 * `labels`: the call-sign labels (the TAK Overlay Manager's "symbol labels"); they still follow the zoom as before.
 */
export interface MarkerStyle { readonly symbology: "classic" | "2525"; readonly labels: boolean }
export const CLASSIC_MARKER_STYLE: MarkerStyle = { symbology: "classic", labels: true };
const styleByMap = new WeakMap<MapLibreMap, MarkerStyle>();
/** Sets a map's marker style; the markers are redrawn in it at the next `syncUnitMarkers`. */
export function setMarkerStyle(map: MapLibreMap, style: MarkerStyle): void {
  const cur = styleByMap.get(map);
  if (!cur || cur.symbology !== style.symbology || cur.labels !== style.labels) styleByMap.set(map, style);
}
export function markerStyleOf(map: MapLibreMap): MarkerStyle { return styleByMap.get(map) ?? CLASSIC_MARKER_STYLE; }

export interface Parts {
  readonly el: HTMLElement; readonly frame: HTMLElement; readonly tip: HTMLElement; readonly leader: HTMLElement;
  /** The style the marker was drawn in (a change redraws it). */
  readonly style: MarkerStyle;
  /** The call sign under the frame; none for a parked vehicle. */
  readonly label: HTMLElement | null;
  /** Full (true) or compact (false) marker now; null before the first layout (`setMarkerDetail`). */
  labelled: boolean | null;
}

/**
 * What the map logs of a pointer on a unit symbol (SPEC/07 revision (al): `element_enter` / `element_leave` / `click`
 * with target kind `unit`, `drone` or `unit_stack`). Markers dispatch it as a bubbling DOM event; MapView listens.
 */
export interface MapElementEventDetail {
  readonly type: "enter" | "leave" | "click";
  readonly targetKind: "unit" | "drone" | "unit_stack";
  readonly targetId: string;
  readonly pointerType?: "mouse" | "pen" | "touch";
  readonly button?: number;
}
export const MAP_ELEMENT_EVENT = "map-element";
export function emitMapElement(el: HTMLElement, detail: MapElementEventDetail): void {
  el.dispatchEvent(new CustomEvent<MapElementEventDetail>(MAP_ELEMENT_EVENT, { bubbles: true, detail }));
}
export const pointerKind = (e: Event): "mouse" | "pen" | "touch" => { const t = (e as PointerEvent).pointerType; return t === "pen" || t === "touch" ? t : "mouse"; };

/**
 * A line from a marker drawn away from its true position back to that position (revision (al)); `dx`, `dy` is the
 * marker's displacement, px. Hidden when the marker is (nearly) on its point.
 */
export function setLeader(leader: HTMLElement, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 3) { leader.style.display = "none"; return; }
  leader.style.display = "block";
  leader.style.width = `${len}px`;
  leader.style.transform = `rotate(${Math.atan2(-dy, -dx)}rad)`;
}

/** The label under a marker (an aircraft's or a crew's; a parked vehicle has none): its call sign in the card language. */
export function markerLabel(d: Pick<UnitMarkerData, "id">): string {
  return unitCallSign(CARD_LANG, d.id);
}

function createMarker(d: UnitMarkerData, style: MarkerStyle): Parts {
  const small = d.role === "vehicle";
  const el = document.createElement("div");
  el.className = "unit-marker";
  el.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:default;z-index:${MARKER_Z.unit}${small ? ";opacity:.85" : ""}`;
  // The leader line back to the true position when the declutter draws the marker away from it (`unit-stacks.ts`).
  const leader = document.createElement("div");
  leader.style.cssText = `display:none;position:absolute;left:50%;top:50%;height:0;border-top:1.5px solid ${OWN_FORMATION_HUE};transform-origin:0 0;pointer-events:none;z-index:-1;filter:drop-shadow(0 0 1px #fff)`;
  el.append(leader);
  const frame = document.createElement("div");
  el.append(frame);
  let label: HTMLElement | null = null;
  if (!small) {
    label = document.createElement("div");
    label.textContent = markerLabel(d);
    label.style.cssText = `margin-top:2px;padding:0 2px;border-radius:2px;background:#12151acc;box-shadow:0 0 0 1px #ffffffb0;font:600 10px/11px monospace;color:${OWN_FORMATION_HUE};text-shadow:0 0 3px #000`;
    el.append(label);
  }
  const tip = document.createElement("div");
  tip.style.cssText =
    "display:none;position:absolute;bottom:100%;left:50%;transform:translate(-50%,-6px);white-space:nowrap;pointer-events:none;" +
    `background:#12151af0;border:1px solid ${OWN_FORMATION_HUE};border-radius:4px;padding:5px 8px;font:12px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif;color:#e8eaed;box-shadow:0 2px 8px #000a`;
  el.append(tip);
  // Markers are siblings in one pane, so the hovered one is raised above its neighbours.
  // An aircraft's track and sensor footprint are shown only while it is hovered (MapView listens).
  const hover = (id: string | null) => el.dispatchEvent(new CustomEvent("aircraft-hover", { bubbles: true, detail: id }));
  const targetKind = d.air ? "drone" as const : "unit" as const;
  el.addEventListener("mouseenter", (e) => { tip.style.display = "block"; el.style.zIndex = String(MARKER_Z.hover); if (d.air) hover(d.id); emitMapElement(el, { type: "enter", targetKind, targetId: d.key, pointerType: pointerKind(e) }); });
  el.addEventListener("mouseleave", (e) => { tip.style.display = "none"; el.style.zIndex = String(MARKER_Z.unit); if (d.air) hover(null); emitMapElement(el, { type: "leave", targetKind, targetId: d.key, pointerType: pointerKind(e) }); });
  el.addEventListener("click", (e) => emitMapElement(el, { type: "click", targetKind, targetId: d.key, pointerType: pointerKind(e), button: (e as MouseEvent).button }));
  const parts: Parts = { el, frame, tip, leader, label, labelled: null, style };
  setMarkerDetail(parts, d, true);
  return parts;
}

/**
 * Full or compact marker (SPEC/12 revision (am)): from about the 2 km zoom on (`unitLabelsShown`), the 24 × 18 frame
 * with the call sign under it; wider, at the opening frame, a 16 × 12 frame and no call sign (it shows in the hover
 * card), so the units cover less of the fire. Sizes as `unitBox`, which the declutter lays out.
 */
export function setMarkerDetail(parts: Parts, d: Pick<UnitMarkerData, "role" | "air">, labelled: boolean): void {
  if (parts.labelled === labelled) return;
  parts.labelled = labelled;
  const small = d.role === "vehicle";
  const { w, h } = labelled ? (small ? { w: 18, h: 14 } : { w: 24, h: 18 }) : (small ? COMPACT_VEHICLE_FRAME : COMPACT_FRAME);
  const border = labelled ? 2 : 1.5;
  if (parts.style.symbology === "2525") {
    // The 2525 symbol carries its own frame: a transparent box of the same size, a soft shadow for the basemap.
    parts.frame.style.cssText = `display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:${w}px;height:${h}px;filter:drop-shadow(0 0 1.5px #000a)`;
    if (parts.label) parts.label.style.display = labelled && parts.style.labels ? "block" : "none";
    return;
  }
  parts.frame.style.cssText =
    `display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:${w}px;height:${h}px;padding:${labelled ? 1 : 0.5}px;` +
    // A white casing round the frame keeps the symbol readable over the basemap's blue water and bogs (revision (al)).
    `border:${border}px solid ${OWN_FORMATION_HUE};background:#12151add;color:${OWN_FORMATION_HUE};box-shadow:0 0 0 ${labelled ? 1.5 : 1}px #fff,0 0 3px 1px #000a;` +
    (d.air ? `border-radius:${Math.round(w / 2) - 1}px ${Math.round(w / 2) - 1}px 0 0;padding-top:${labelled ? 2 : 1}px` : "");
  if (parts.label) parts.label.style.display = labelled ? "block" : "none";
}

/** Refreshes glyph and hover card — a unit keeps its marker across cycles while its task changes. */
function fillMarker(parts: Parts, d: UnitMarkerData) {
  // Static SVG: authored glyphs, or milsymbol's symbol for the platform's SIDC — no user input.
  parts.frame.innerHTML = parts.style.symbology === "2525" ? takMarkerSvg(d.id, markerLabel(d)) : glyphSvg(d);
  const [title, ...rest] = cardLines(d);
  const head = document.createElement("div");
  head.style.cssText = `font-weight:700;color:${OWN_FORMATION_HUE}`;
  head.textContent = title ?? unitCallSign(CARD_LANG, d.id);
  parts.tip.replaceChildren(head, ...rest.map((text) => { const line = document.createElement("div"); line.textContent = text; return line; }));
}

export interface MarkerEntry { marker: maplibregl.Marker; parts: Parts; role: UnitMarkerData["role"]; data: UnitMarkerData }
const markersByMap = new WeakMap<MapLibreMap, Map<string, MarkerEntry>>();
/** The map's unit markers by key (for the declutter, `unit-stacks.ts`). */
export function unitMarkersOf(map: MapLibreMap): ReadonlyMap<string, MarkerEntry> { return markersByMap.get(map) ?? new Map(); }

export function syncUnitMarkers(map: MapLibreMap, data: readonly UnitMarkerData[]) {
  let markers = markersByMap.get(map);
  if (!markers) { markers = new Map(); markersByMap.set(map, markers); }
  const seen = new Set<string>();
  const style = markerStyleOf(map);
  for (const d of data) {
    seen.add(d.key);
    let m = markers.get(d.key);
    if (m && m.role !== d.role && (m.role === "vehicle" || d.role === "vehicle")) { m.marker.remove(); markers.delete(d.key); m = undefined; }
    if (m && m.parts.style !== style) { m.marker.remove(); markers.delete(d.key); m = undefined; } // the style changed: redraw
    if (!m) {
      const parts = createMarker(d, style);
      m = { marker: new maplibregl.Marker({ element: parts.el }).setLngLat([d.at.lon, d.at.lat]).addTo(map), parts, role: d.role, data: d };
      markers.set(d.key, m);
    } else {
      m.marker.setLngLat([d.at.lon, d.at.lat]);
      m.role = d.role;
      m.data = d;
    }
    fillMarker(m.parts, d);
  }
  for (const [key, m] of markers) if (!seen.has(key)) { m.marker.remove(); markers.delete(key); }
}

/** Crew–vehicle links as GeoJSON lines; `hose` marks a hose line (water from the vehicle). */
export function crewLinks(data: readonly UnitMarkerData[]) {
  return {
    type: "FeatureCollection" as const,
    features: data
      .filter((d) => d.role === "crew" && d.partner)
      .map((d) => ({
        type: "Feature" as const,
        properties: { hose: d.work?.hoseM != null },
        geometry: { type: "LineString" as const, coordinates: [[d.partner!.lon, d.partner!.lat], [d.at.lon, d.at.lat]] },
      })),
  };
}
