/**
 * Game mode screen: DOM markers on the map (the offline style carries no glyphs, so map text layers cannot label
 * anything). Units: their MIL-STD-2525 symbol (milsymbol, the study's TAK shell's `symbolSvg`) inside a status ring, a
 * water bar and an energy bar, the call sign under it, a selection glow. Places: settlements (named, the protected one
 * marked), water points (a droplet) and the command post. Units on the same spot fan out so each stays clickable.
 */

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { GameWorld, Unit, UnitKind, UnitStatus } from "../contracts.js";
import { COT_TYPE_BY_KIND, SELF_SIDC, sidcOfCotType, type TakKind } from "../../tak/symbols.js";
import { symbolSvg } from "../../render/ui/tak/tak-symbols.js";
import type { Lang } from "../../i18n/lang.js";
import { lngLatOf } from "./map-data.js";
import { isAir } from "./orders.js";
import { GAME_TEXT, inLang } from "./text.js";

const TAK_KIND: Readonly<Record<UnitKind, TakKind>> = {
  engine: "ground_vehicle", tanker: "ground_vehicle", forest_unit: "ground_vehicle", volunteer: "ground_vehicle", ugv: "ugv",
  drone_thermal: "uav_rotary", drone_water: "uav_rotary", drone_vtol: "uav_fixed", helicopter: "helicopter", spotter: "fixed_wing",
};

/** The 2525C SIDC a unit kind is drawn with (the study's CoT mapping, `app/tak/symbols.ts`). */
export function sidcOfKind(kind: UnitKind): string {
  return sidcOfCotType(COT_TYPE_BY_KIND[TAK_KIND[kind]]) ?? "SFGP-----------";
}

/** A unit kind's symbol markup. */
export function unitSymbolSvg(kind: UnitKind): string {
  return symbolSvg(sidcOfKind(kind), 22);
}

/** The status ring's colour. */
export const STATUS_COLOR: Readonly<Record<UnitStatus, string>> = {
  en_route: "#6b7b86", idle: "#d5dde2", moving: "#19c3d6", working: "#ff9f1c", refilling: "#4fb3ff", returning: "#b39ddb", out_of_action: "#e53935",
};

/** Casualty (harm 1) vs released by the region (out of action, harm < 1). */
export function isCasualty(u: Pick<Unit, "status" | "harm">): boolean {
  return u.status === "out_of_action" && u.harm >= 1;
}

export function statusColor(u: Pick<Unit, "status" | "harm">): string {
  if (u.status === "out_of_action" && !isCasualty(u)) return "#78909c";
  return STATUS_COLOR[u.status];
}

interface UnitEl { readonly marker: maplibregl.Marker; readonly el: HTMLElement; readonly ring: HTMLElement; readonly water: HTMLElement | null; readonly energy: HTMLElement | null; readonly cs: HTMLElement; key: string; pos: string }

/** Screen offsets (px) fanning out `n` markers that share a spot (index `i`). */
export function fanOffset(i: number, n: number, radiusPx = Math.max(26, 9 * n)): [number, number] {
  if (n <= 1) return [0, 0];
  const a = (i / n) * 2 * Math.PI - Math.PI / 2;
  return [Math.round(Math.cos(a) * radiusPx), Math.round(Math.sin(a) * radiusPx)];
}

/**
 * Markers closer than `nearPx` on screen (about a marker's width) are grouped (greedily, in the given order, each joining
 * the first group whose first member is near) and laid out on a small ring around the group's centre, so every unit
 * stays visible and clickable at any zoom. Returns each marker's offset from its own anchor, px.
 */
export function fanOut(points: readonly { readonly id: string; readonly x: number; readonly y: number }[], nearPx = 42): Map<string, [number, number]> {
  const groups: { x: number; y: number; members: { id: string; x: number; y: number }[] }[] = [];
  for (const p of points) {
    const g = groups.find((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < nearPx * nearPx);
    if (g) g.members.push(p);
    else groups.push({ x: p.x, y: p.y, members: [p] });
  }
  const out = new Map<string, [number, number]>();
  for (const g of groups) {
    const n = g.members.length;
    if (n === 1) { out.set(g.members[0]!.id, [0, 0]); continue; }
    const cx = g.members.reduce((a, m) => a + m.x, 0) / n, cy = g.members.reduce((a, m) => a + m.y, 0) / n;
    g.members.forEach((m, i) => {
      const [fx, fy] = fanOffset(i, n);
      out.set(m.id, [Math.round(cx + fx - m.x), Math.round(cy + fy - m.y)]);
    });
  }
  return out;
}

export class UnitMarkers {
  private readonly els = new Map<string, UnitEl>();
  private shown: readonly Unit[] = [];

  constructor(private readonly map: MapLibreMap, private readonly world: GameWorld, private readonly onClick: (id: string, add: boolean) => void) {
    map.on("zoom", () => this.relayout());
  }

  /** Re-fans the markers for the current zoom. */
  private relayout(): void {
    const grid = this.world.grid;
    const pts = this.shown.map((u) => { const p = this.map.project(lngLatOf(grid, u.pos)); return { id: u.id, x: p.x, y: p.y }; });
    const off = fanOut(pts);
    for (const u of this.shown) this.els.get(u.id)?.marker.setOffset(off.get(u.id) ?? [0, 0]);
  }

  sync(units: readonly Unit[], selected: ReadonlySet<string>, labels: boolean): void {
    const grid = this.world.grid;
    const shown = units.filter((u) => u.status !== "en_route");
    this.shown = shown;
    const live = new Set<string>();
    for (const u of shown) {
      live.add(u.id);
      let m = this.els.get(u.id);
      if (!m) { m = this.create(u); this.els.set(u.id, m); }
      const posKey = `${u.pos.x},${u.pos.y}`;
      if (posKey !== m.pos) { m.marker.setLngLat(lngLatOf(grid, u.pos)); m.pos = posKey; }
      const waterPct = u.waterMaxL > 0 ? Math.round((100 * u.waterL) / u.waterMaxL) : -1;
      const key = `${u.status}|${u.harm >= 1 ? 1 : 0}|${waterPct}|${Math.round(u.energyPct)}|${selected.has(u.id) ? 1 : 0}|${labels ? 1 : 0}`;
      if (key === m.key) continue;
      m.key = key;
      m.ring.style.borderColor = statusColor(u);
      m.el.classList.toggle("sel", selected.has(u.id));
      m.el.classList.toggle("work", u.status === "working" || u.status === "refilling");
      m.el.classList.toggle("out", u.status === "out_of_action");
      m.el.classList.toggle("dead", isCasualty(u));
      if (m.water) m.water.style.width = `${Math.max(0, Math.min(100, waterPct))}%`;
      if (m.energy) {
        m.energy.style.width = `${Math.max(0, Math.min(100, u.energyPct))}%`;
        m.energy.style.background = u.energyPct < 20 ? "#e53935" : "#ffc14d";
      }
      m.cs.style.display = labels || selected.has(u.id) ? "" : "none";
    }
    for (const [id, m] of this.els) if (!live.has(id)) { m.marker.remove(); this.els.delete(id); }
    this.relayout();
  }

  private create(u: Unit): UnitEl {
    const el = document.createElement("div");
    el.className = "gm-marker gm-unit";
    el.dataset["unit"] = u.id;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", u.callsign);
    const ring = document.createElement("div");
    ring.className = "ring";
    const sym = document.createElement("div");
    sym.className = "sym";
    sym.innerHTML = unitSymbolSvg(u.kind);
    ring.appendChild(sym);
    el.appendChild(ring);
    const bars = document.createElement("div");
    bars.className = "bars";
    const bar = (cls: string): HTMLElement => {
      const b = document.createElement("div");
      b.className = `bar ${cls}`;
      const fill = document.createElement("i");
      b.appendChild(fill);
      bars.appendChild(b);
      return fill;
    };
    const water = u.waterMaxL > 0 ? bar("water") : null;
    const energy = isAir(u.kind) ? bar("energy") : null;
    el.appendChild(bars);
    const cs = document.createElement("div");
    cs.className = "cs";
    cs.textContent = u.callsign;
    el.appendChild(cs);
    el.addEventListener("click", (e) => { e.stopPropagation(); this.onClick(u.id, e.shiftKey || e.ctrlKey || e.metaKey); });
    const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLatOf(this.world.grid, u.pos)).addTo(this.map);
    return { marker, el, ring, water, energy, cs, key: "", pos: `${u.pos.x},${u.pos.y}` };
  }

  /** The unit marker under a DOM event target, if any. */
  static unitOf(target: EventTarget | null): string | null {
    const el = target instanceof Element ? target.closest<HTMLElement>(".gm-unit") : null;
    return el?.dataset["unit"] ?? null;
  }

  remove(): void {
    for (const m of this.els.values()) m.marker.remove();
    this.els.clear();
  }
}

const DROPLET = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.6 15 7 12 2.5z" fill="#2f8fe8" stroke="#e8f4ff" stroke-width="1.6"/></svg>';
const HOUSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20H3z" fill="#f2f5f7" stroke="#0d1114" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 20v-5h4v5" fill="none" stroke="#0d1114" stroke-width="1.6"/></svg>';

/** Settlements, water points and the command post. */
export class PlaceMarkers {
  private readonly markers: maplibregl.Marker[] = [];
  private readonly names: HTMLElement[] = [];

  constructor(map: MapLibreMap, world: GameWorld, lang: Lang, protectedIds: ReadonlySet<string>, handlers: { readonly water: (id: string) => void; readonly settlement: (id: string) => void }) {
    const t = GAME_TEXT[lang];
    const add = (el: HTMLElement, at: { x: number; y: number }, anchor: "center" | "bottom" | "left" = "center", offset: [number, number] = [0, 0]) => {
      this.markers.push(new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(lngLatOf(world.grid, at)).addTo(map));
    };
    for (const s of world.settlements) {
      const el = document.createElement("div");
      el.className = `gm-marker gm-place${protectedIds.has(s.id) ? " prot" : ""}`;
      el.dataset["settlement"] = s.id;
      el.setAttribute("role", "button");
      const name = inLang(lang, s.nameFi, s.nameEn);
      el.setAttribute("aria-label", name);
      el.innerHTML = `${HOUSE}<span class="nm"></span>`;
      const nm = el.querySelector<HTMLElement>(".nm")!;
      nm.textContent = protectedIds.has(s.id) ? `${name} · ${t.protect}` : name;
      this.names.push(nm);
      el.addEventListener("click", (e) => { e.stopPropagation(); handlers.settlement(s.id); });
      add(el, s.centre, "bottom", [0, -12]); // above the centre: a water point often lies at it
    }
    for (const w of world.waterPoints) {
      const el = document.createElement("div");
      el.className = "gm-marker gm-water";
      el.dataset["water"] = w.id;
      el.setAttribute("role", "button");
      const name = inLang(lang, w.nameFi, w.nameEn);
      el.setAttribute("aria-label", name);
      el.title = name;
      el.innerHTML = `${DROPLET}<span class="nm"></span>`;
      const nm = el.querySelector<HTMLElement>(".nm")!;
      nm.textContent = name;
      this.names.push(nm);
      el.addEventListener("click", (e) => { e.stopPropagation(); handlers.water(w.id); });
      add(el, w.at, "left", [-9, 0]); // the droplet on the point, the name to its right
    }
    const cp = document.createElement("div");
    cp.className = "gm-marker gm-cp";
    cp.title = t.commandPost;
    cp.innerHTML = `<span class="sym">${symbolSvg(SELF_SIDC, 22)}</span>`;
    add(cp, world.commandPost);
  }

  setLabels(on: boolean): void {
    for (const n of this.names) n.style.display = on ? "" : "none";
  }

  remove(): void {
    for (const m of this.markers) m.remove();
  }
}
