/**
 * Applies the unit-marker declutter (`app/render/unit-declutter.ts`, SPEC/12 revision (al)) to the map's DOM markers:
 * offsets with leader lines for markers drawn off their point, and one badge per stack — the count in an own-forces
 * frame, the members' call signs under it — whose members fan out round it while the pointer is on the badge or a
 * member. Re-run after every settled move and every data change (MapView); the layout reads only the markers'
 * screen positions, never the time or the participant.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { declutterUnits, unitBox, unitLabelsShown, type DeclutterItem, type ScreenSegment } from "../unit-declutter.js";
import { metresPerPixel } from "../map-frame.js";
import { MARKER_Z } from "./fire-layers.js";
import { emitMapElement, markerLabel, OWN_FORMATION_HUE, pointerKind, setLeader, setMarkerDetail, unitMarkersOf, type MarkerEntry } from "./unit-markers.js";
import type { LatLon } from "../../engine/primitives.js";

interface Badge { marker: maplibregl.Marker; el: HTMLElement; count: HTMLElement; names: HTMLElement; members: string[]; offset: [number, number] }
interface StackState { badges: Map<string, Badge>; fanned: string | null; collapseTimer: ReturnType<typeof setTimeout> | null; screen: Map<string, { x: number; y: number }>; labelled: boolean }
const stateByMap = new WeakMap<MapLibreMap, StackState>();

/** Ring radius of a fanned-out stack, px, by member count. */
const fanRadius = (n: number) => Math.max(30, 12 + n * 7);
/** A spot-fire symbol's box (the white-ringed dot), px: markers move off it. */
const SPOT_BOX_PX = 16;

function stateOf(map: MapLibreMap): StackState {
  let s = stateByMap.get(map);
  if (!s) { s = { badges: new Map(), fanned: null, collapseTimer: null, screen: new Map(), labelled: true }; stateByMap.set(map, s); }
  return s;
}

/** The spot-fire symbols on the map now (the declutter moves unit markers off them; never the camera). */
export function spotSymbols(cycle: { readonly fire?: { readonly spot_fires: readonly { readonly position: LatLon }[] } | null } | null | undefined): LatLon[] {
  return (cycle?.fire?.spot_fires ?? []).map((s) => s.position);
}

/**
 * The fire's uncontained edge now, as lines (revision (am)): unit markers and badges move off it (never the camera), so
 * the edge the commander reads the fire from is not hidden under them. The head is part of it.
 */
export function edgeLines(cycle: { readonly fire?: { readonly perimeter_current: readonly { readonly status: string; readonly line: readonly LatLon[] }[] } | null } | null | undefined): LatLon[][] {
  return (cycle?.fire?.perimeter_current ?? []).filter((s) => s.status === "uncontained").map((s) => [...s.line]);
}

/** Lines projected to screen segments, px (consecutive points closer than 1 px merged). */
function screenSegments(map: MapLibreMap, lines: readonly (readonly LatLon[])[]): ScreenSegment[] {
  const out: ScreenSegment[] = [];
  for (const line of lines) {
    let prev: { x: number; y: number } | null = null;
    for (const q of line) {
      const p = map.project([q.lon, q.lat]);
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 1) continue;
      if (prev) out.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y });
      prev = { x: p.x, y: p.y };
    }
  }
  return out;
}

/**
 * Lays the unit markers out for the current camera; returns the number of stack badges drawn (the legend lists the
 * stack symbol only when there is one, revision (am)).
 */
export function declutterUnitMarkers(map: MapLibreMap, spotFires: readonly LatLon[] = [], edges: readonly (readonly LatLon[])[] = []): number {
  const markers = unitMarkersOf(map);
  const st = stateOf(map);
  const items: DeclutterItem[] = [];
  const metresPerPx = metresPerPixel(map.getZoom(), map.getCenter().lat);
  const labelled = unitLabelsShown(metresPerPx);
  st.labelled = labelled;
  st.screen.clear();
  for (const [key, m] of markers) {
    setMarkerDetail(m.parts, m.data, labelled);
    const p = map.project([m.data.at.lon, m.data.at.lat]);
    st.screen.set(key, { x: p.x, y: p.y });
    items.push({ key, x: p.x, y: p.y, ...unitBox(m.role, markerLabel(m.data), labelled) });
  }
  const fixed = spotFires.map((s) => { const p = map.project([s.lon, s.lat]); return { cx: p.x, cy: p.y, w: SPOT_BOX_PX, h: SPOT_BOX_PX }; });
  const { placements, stacks } = declutterUnits(items, { metresPerPx, fixed, fixedLines: screenSegments(map, edges) });

  for (const [key, m] of markers) {
    const p = placements.get(key)!;
    if (p.stack === null) { show(m, p.dx, p.dy); continue; }
    m.parts.el.style.display = "none"; // in a badge until fanned
  }
  // Badges: one per stack, keyed by its anchor; old ones removed.
  for (const [anchor, b] of st.badges) if (!stacks.has(anchor)) { b.marker.remove(); st.badges.delete(anchor); }
  for (const [anchor, members] of stacks) {
    const a = markers.get(anchor)!, p = placements.get(anchor)!;
    let b = st.badges.get(anchor);
    if (!b) { b = createBadge(map, anchor); st.badges.set(anchor, b); }
    b.members = [...members];
    b.offset = [p.dx, p.dy];
    b.marker.setLngLat([a.data.at.lon, a.data.at.lat]).setOffset(b.offset);
    b.count.textContent = String(members.length);
    b.names.textContent = members.filter((k) => markers.get(k)!.role !== "vehicle").map((k) => markerLabel(markers.get(k)!.data)).join(" ");
    setBadgeDetail(b, labelled);
  }
  if (st.fanned && st.badges.has(st.fanned)) fan(map, st.fanned); else st.fanned = null;
  return stacks.size;
}

/** A badge at the opening frame shows the count only, in a compact frame; members' call signs from the 2 km zoom on (revision (am)). */
function setBadgeDetail(b: Badge, labelled: boolean): void {
  b.count.style.minWidth = labelled ? "24px" : "18px";
  b.count.style.height = labelled ? "18px" : "13px";
  b.count.style.fontSize = labelled ? "11px" : "10px";
  b.count.style.borderWidth = labelled ? "2px" : "1.5px";
  b.names.style.display = labelled ? "block" : "none";
}

function show(m: MarkerEntry, dx: number, dy: number): void {
  m.parts.el.style.display = "flex";
  m.marker.setOffset([dx, dy]);
  setLeader(m.parts.leader, dx, dy);
}

function createBadge(map: MapLibreMap, anchor: string): Badge {
  const el = document.createElement("div");
  el.className = "unit-stack";
  el.style.cssText = `display:flex;flex-direction:column;align-items:center;cursor:default;z-index:${MARKER_Z.unit}`;
  const count = document.createElement("div");
  count.style.cssText = `display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:24px;height:18px;padding:0 3px;border:2px double ${OWN_FORMATION_HUE};` +
    `background:#12151add;color:${OWN_FORMATION_HUE};font:700 11px/1 monospace;box-shadow:0 0 0 1.5px #fff,0 0 3px 1px #000a`;
  const names = document.createElement("div");
  names.style.cssText = `margin-top:2px;padding:0 2px;border-radius:2px;background:#12151acc;box-shadow:0 0 0 1px #ffffffb0;font:600 9px/10px monospace;color:${OWN_FORMATION_HUE};max-width:90px;white-space:normal;text-align:center`;
  el.append(count, names);
  const st = stateOf(map);
  el.addEventListener("mouseenter", (e) => { keepFanned(map, anchor); emitMapElement(el, { type: "enter", targetKind: "unit_stack", targetId: st.badges.get(anchor)?.members.join("+") ?? anchor, pointerType: pointerKind(e) }); });
  el.addEventListener("mouseleave", (e) => { scheduleCollapse(map); emitMapElement(el, { type: "leave", targetKind: "unit_stack", targetId: st.badges.get(anchor)?.members.join("+") ?? anchor, pointerType: pointerKind(e) }); });
  el.addEventListener("click", (e) => emitMapElement(el, { type: "click", targetKind: "unit_stack", targetId: st.badges.get(anchor)?.members.join("+") ?? anchor, pointerType: pointerKind(e), button: (e as MouseEvent).button }));
  const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([0, 0]).addTo(map);
  return { marker, el, count, names, members: [], offset: [0, 0] };
}

/** Members of the fanned stack keep it open while the pointer is on them. */
function keepFanned(map: MapLibreMap, anchor: string): void {
  const st = stateOf(map);
  if (st.collapseTimer) { clearTimeout(st.collapseTimer); st.collapseTimer = null; }
  if (st.fanned !== anchor) { if (st.fanned) collapse(map); fan(map, anchor); }
}

function scheduleCollapse(map: MapLibreMap): void {
  const st = stateOf(map);
  if (st.collapseTimer) clearTimeout(st.collapseTimer);
  st.collapseTimer = setTimeout(() => { st.collapseTimer = null; collapse(map); }, 350);
}

/** Members round the badge on a ring, in the stack's fixed order from the top, clockwise; each with a leader to its point. */
function fan(map: MapLibreMap, anchor: string): void {
  const st = stateOf(map);
  const b = st.badges.get(anchor);
  const markers = unitMarkersOf(map);
  const a = st.screen.get(anchor);
  if (!b || !a) return;
  st.fanned = anchor;
  const r = fanRadius(b.members.length);
  b.members.forEach((key, i) => {
    const m = markers.get(key), home = st.screen.get(key);
    if (!m || !home) return;
    const t = -Math.PI / 2 + (2 * Math.PI * i) / b.members.length;
    // Displayed at the badge (the anchor's point + its offset) plus the ring position; the offset is from the member's own point.
    const dx = a.x + b.offset[0] + r * Math.cos(t) - home.x, dy = a.y + b.offset[1] + r * Math.sin(t) - home.y;
    show(m, dx, dy);
    m.parts.el.style.zIndex = String(MARKER_Z.hover - 1);
    m.parts.el.onmouseenter = () => keepFanned(map, anchor);
    m.parts.el.onmouseleave = () => scheduleCollapse(map);
  });
}

function collapse(map: MapLibreMap): void {
  const st = stateOf(map);
  const b = st.fanned ? st.badges.get(st.fanned) : undefined;
  st.fanned = null;
  if (!b) return;
  const markers = unitMarkersOf(map);
  for (const key of b.members) {
    const m = markers.get(key);
    if (!m) continue;
    m.parts.el.style.display = "none";
    m.parts.el.style.zIndex = String(MARKER_Z.unit);
    m.parts.el.onmouseenter = null;
    m.parts.el.onmouseleave = null;
  }
}
