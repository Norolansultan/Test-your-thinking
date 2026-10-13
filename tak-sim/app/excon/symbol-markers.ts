/**
 * EXCON (SPEC/28 §8) — units and aircraft as MIL-STD-2525C symbols (milsymbol, MIT) from their CoT type
 * (`app/tak/symbols.ts` `sidcOf`, the same mapping the TAK shell and the CoT export use), as DOM markers.
 * One marker per platform id and map, created once and moved every frame; arriving or leaving platforms
 * (truth map only) are drawn faded.
 */

import ms from "milsymbol";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { LatLon } from "../engine/primitives.js";
import { sidcOf } from "../tak/symbols.js";

export interface SymbolDatum {
  readonly id: string;
  readonly at: LatLon;
  /** Faded when the platform is arriving or leaving (truth map). */
  readonly faded?: boolean;
}

interface Rendered { readonly svg: string; readonly ax: number; readonly ay: number }
const svgCache = new Map<string, Rendered>();

function symbolFor(id: string): Rendered {
  const hit = svgCache.get(id);
  if (hit) return hit;
  const sym = new ms.Symbol(sidcOf(id), {
    size: 18,
    uniqueDesignation: id,
    infoColor: "#f1f3f5",
    infoOutlineColor: "#0b0f14",
    infoOutlineWidth: 3,
    infoSize: 46,
    outlineColor: "#0b0f14",
    outlineWidth: 2,
  });
  const anchor = sym.getAnchor();
  const out = { svg: sym.asSVG(), ax: anchor.x, ay: anchor.y };
  svgCache.set(id, out);
  return out;
}

const markersByMap = new WeakMap<MapLibreMap, Map<string, maplibregl.Marker>>();

/** Creates, moves and removes the map's symbol markers to match `data`. */
export function syncSymbols(map: MapLibreMap, data: readonly SymbolDatum[]): void {
  let markers = markersByMap.get(map);
  if (!markers) { markers = new Map(); markersByMap.set(map, markers); }
  const seen = new Set<string>();
  for (const d of data) {
    seen.add(d.id);
    let m = markers.get(d.id);
    if (!m) {
      const r = symbolFor(d.id);
      const el = document.createElement("div");
      el.className = "excon-symbol";
      el.innerHTML = r.svg;
      el.title = d.id;
      m = new maplibregl.Marker({ element: el, anchor: "top-left", offset: [-r.ax, -r.ay] }).setLngLat([d.at.lon, d.at.lat]).addTo(map);
      markers.set(d.id, m);
    } else {
      m.setLngLat([d.at.lon, d.at.lat]);
    }
    m.getElement().style.opacity = d.faded ? "0.5" : "1";
  }
  for (const [id, m] of markers) if (!seen.has(id)) { m.remove(); markers.delete(id); }
}
