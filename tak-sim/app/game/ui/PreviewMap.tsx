/**
 * Game mode: the briefing's static map preview — the topo basemap (as the game map loads it), the ignition(s), the
 * protected settlement(s) and the command post, framed to show them all. Not interactive.
 */

import { useEffect, useRef } from "preact/hooks";
import * as maplibregl from "maplibre-gl";
import type { GameScenario, GameWorld, XY } from "../contracts.js";
import siteMeta from "../../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../../i18n/place-names.js";
import { assetUrl } from "../../session/asset-url.js";
import type { Lang } from "../../i18n/lang.js";
import { lngLatOf } from "./map-data.js";
import { GAME_TEXT, inLang } from "./text.js";
import { settlementOf } from "./scenario-info.js";
import { SELF_SIDC } from "../../tak/symbols.js";
import { symbolSvg } from "../../render/ui/tak/tak-symbols.js";

type Corners = [[number, number], [number, number], [number, number], [number, number]];

const HOUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20H3z" fill="#19c3d6" stroke="#0d1114" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const FLAME ='<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-3 1.5-4.5 2.5-6 .3 2 1.2 3 2.2 3.3C11.3 8 11 5 12 2z" fill="#ff7a1a" stroke="#fff3e0" stroke-width="1.5" stroke-linejoin="round"/></svg>';

/** A marker: an icon on the point with its label beside it (`side`), so neighbouring labels do not cover each other. */
function label(text: string, color: string, side: "left" | "right" = "right"): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `display:flex;flex-direction:${side === "right" ? "row" : "row-reverse"};align-items:center;gap:3px;pointer-events:none`;
  const t = document.createElement("span");
  t.textContent = text;
  t.style.cssText = `font:700 11.5px -apple-system,Segoe UI,Roboto,sans-serif;color:#fff;background:rgba(13,17,20,.82);border:1px solid ${color};padding:1px 6px;border-radius:3px;white-space:nowrap`;
  el.appendChild(t);
  return el;
}

export function PreviewMap({ lang, scenario, world }: { readonly lang: Lang; readonly scenario: GameScenario; readonly world: GameWorld }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const t = GAME_TEXT[lang];
    const grid = world.grid;
    const points: XY[] = [...scenario.ignitions, world.commandPost];
    const prot = scenario.objectives.flatMap((o) => (o.kind === "protect_settlement" ? [settlementOf(world, o.settlementId)] : [])).filter((s) => s !== null);
    for (const s of prot) points.push(s.centre);
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const pad = 900;
    const sw = lngLatOf(grid, { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad });
    const ne = lngLatOf(grid, { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad });
    const map = new maplibregl.Map({
      container: ref.current, interactive: false, bounds: [sw, ne], fitBoundsOptions: { padding: 24 },
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#12151a" } }] },
      attributionControl: false,
    });
    map.on("load", () => {
      siteMeta.tiles.forEach((tile, i) => {
        map.addSource(`topo-${i}`, { type: "image", url: assetUrl(topoTileUrl(tile.url, lang)), coordinates: tile.corners as Corners });
        map.addLayer({ id: `topo-${i}`, type: "raster", source: `topo-${i}`, paint: { "raster-fade-duration": 0 } });
      });
    });
    const markers: maplibregl.Marker[] = [];
    for (const p of scenario.ignitions) {
      const el = label(t.ignition, "#ff7a1a");
      el.insertAdjacentHTML("afterbegin", FLAME);
      markers.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [-13, 0] }).setLngLat(lngLatOf(grid, p)).addTo(map));
    }
    for (const s of prot) {
      const el = label(`${t.protect}: ${inLang(lang, s.nameFi, s.nameEn)}`, "#19c3d6");
      el.insertAdjacentHTML("afterbegin", HOUSE);
      markers.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [-9, 0] }).setLngLat(lngLatOf(grid, s.centre)).addTo(map));
    }
    const cp = label(t.commandPost, "#4fb3ff", "left");
    cp.insertAdjacentHTML("afterbegin", `<span style="display:block;width:28px;height:21px">${symbolSvg(SELF_SIDC, 20)}</span>`);
    markers.push(new maplibregl.Marker({ element: cp, anchor: "right", offset: [14, 0] }).setLngLat(lngLatOf(grid, world.commandPost)).addTo(map));
    return () => { for (const m of markers) m.remove(); map.remove(); };
  }, [lang, scenario, world]);
  return <div ref={ref} data-testid="game-preview-map" style={{ width: "100%", height: "100%", minHeight: 240, borderRadius: 4, overflow: "hidden" }} />;
}
