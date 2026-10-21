/**
 * Game mode, SPEC/34 §3: a course page's illustration — a static, non-interactive view of the game's topo map around
 * a point (the briefing preview's way of loading it, `PreviewMap.tsx`), with the command post marked.
 */

import { useEffect, useRef } from "preact/hooks";
import * as maplibregl from "maplibre-gl";
import type { GameWorld, XY } from "../../contracts.js";
import siteMeta from "../../../scenario/site-meta.json" with { type: "json" };
import { topoTileUrl } from "../../../i18n/place-names.js";
import { assetUrl } from "../../../session/asset-url.js";
import type { Lang } from "../../../i18n/lang.js";
import { SELF_SIDC } from "../../../tak/symbols.js";
import { symbolSvg } from "../../../render/ui/tak/tak-symbols.js";
import { lngLatOf } from "../map-data.js";
import { TAK } from "../styles.js";

type Corners = [[number, number], [number, number], [number, number], [number, number]];

export function CourseMap({ lang, world, centre, widthM, label }: {
  readonly lang: Lang; readonly world: GameWorld; readonly centre: XY; readonly widthM: number; readonly label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const half = widthM / 2;
    const halfH = half * 0.62;
    const sw = lngLatOf(world.grid, { x: centre.x - half, y: centre.y - halfH });
    const ne = lngLatOf(world.grid, { x: centre.x + half, y: centre.y + halfH });
    const map = new maplibregl.Map({
      container: ref.current, interactive: false, bounds: [sw, ne], fitBoundsOptions: { padding: 4 },
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#12151a" } }] },
      attributionControl: false,
    });
    map.on("load", () => {
      siteMeta.tiles.forEach((tile, i) => {
        map.addSource(`topo-${i}`, { type: "image", url: assetUrl(topoTileUrl(tile.url, lang)), coordinates: tile.corners as Corners });
        map.addLayer({ id: `topo-${i}`, type: "raster", source: `topo-${i}`, paint: { "raster-fade-duration": 0 } });
      });
    });
    const cp = document.createElement("div");
    cp.style.cssText = "width:28px;height:21px;pointer-events:none";
    cp.innerHTML = symbolSvg(SELF_SIDC, 20);
    const marker = new maplibregl.Marker({ element: cp }).setLngLat(lngLatOf(world.grid, world.commandPost)).addTo(map);
    return () => { marker.remove(); map.remove(); };
  }, [lang, world, centre.x, centre.y, widthM]);
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div ref={ref} role="img" aria-label={label} data-testid="course-map"
        style={{ width: "100%", aspectRatio: "16 / 10", minHeight: 200, borderRadius: TAK.radius, overflow: "hidden", border: `1px solid ${TAK.panelBorder}` }} />
      <figcaption style={{ fontSize: 11.5, color: TAK.textDim }}>{label}</figcaption>
    </figure>
  );
}
