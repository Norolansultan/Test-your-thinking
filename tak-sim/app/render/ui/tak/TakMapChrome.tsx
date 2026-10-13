/**
 * The TAK shell's map chrome (SPEC/28 §5), drawn inside the map's frame: top-left the info card — the participant's own
 * ("self") call sign and role, the scenario clock, the wind (the classic map's wind reading, `WindIndicator`) — and under
 * it, from V8, the command directive; bottom-left the pointer's coordinates in MGRS and lat/lon and the scale bar. North
 * up, no rotation. The fire labels keep clear of all of it (`data-map-chrome`, `fire-layers.ts`).
 */

import { useEffect, useState } from "preact/hooks";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { CycleWind } from "../../../scenario/types.js";
import type { LatLon } from "../../../engine/primitives.js";
import { metresPerPixel } from "../../map-frame.js";
import { WindIndicator } from "../components/WindIndicator.js";
import { useLang } from "../i18n.js";
import { toMgrs } from "./coords.js";
import { formatLatLon, scaleBar } from "./shell.js";
import { selfSymbolSvg } from "./tak-symbols.js";
import { TAK } from "./theme.js";

const card = { background: "#0d1114e8", border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, color: TAK.text, boxShadow: "0 2px 10px #0008" };

export function TakInfoCard({ clockLabel, wind, directive }: { readonly clockLabel: string; readonly wind: CycleWind | null | undefined; readonly directive: string | null }) {
  const { t, tr } = useLang();
  return (
    <div style={{ position: "absolute", zIndex: 21, top: 8, left: 8, display: "flex", flexDirection: "column", gap: 6, maxWidth: 330, pointerEvents: "none" }}>
      <div data-map-chrome data-testid="tak-info-card" style={{ ...card, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, pointerEvents: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* The self symbol (2525C, milsymbol): static markup. */}
          <span style={{ width: 30, height: 22, flex: "none", display: "block" }} dangerouslySetInnerHTML={{ __html: selfSymbolSvg() }} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontFamily: TAK.mono, fontWeight: 700, fontSize: 14, color: TAK.accent }}>{t.tak.selfCallsign}</span>
            <span style={{ fontSize: 11, color: TAK.textDim, whiteSpace: "nowrap" }}>{t.tak.selfRole}</span>
          </div>
          <div style={{ marginLeft: "auto", paddingLeft: 12, textAlign: "right" }}>
            <div style={{ fontSize: 10, color: TAK.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.tak.scenarioTime}</div>
            <div data-testid="tak-clock" style={{ fontFamily: TAK.mono, fontSize: 18, fontWeight: 700 }}>{clockLabel}</div>
          </div>
        </div>
        {wind && <div style={{ borderTop: `1px solid ${TAK.panelBorder}`, paddingTop: 5 }}><WindIndicator wind={wind} inline /></div>}
      </div>
      {/* D1 (8 Oct 2026): the command directive, persistent from V8 on, identical in every cell (the classic right panel's line). */}
      {directive !== null && (
        <div data-map-chrome data-testid="directive-banner" style={{ ...card, padding: "7px 10px", borderLeft: `3px solid ${TAK.accent}`, pointerEvents: "auto" }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: TAK.accent, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{t.directiveBanner}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{tr(directive)}</div>
        </div>
      )}
    </div>
  );
}

/** The pointer's coordinates (MGRS and lat/lon) and the scale bar; follows the pointer and the zoom, logs nothing. */
export function TakCoordReadout({ map }: { readonly map: MapLibreMap | null }) {
  const { t } = useLang();
  const [cursor, setCursor] = useState<LatLon | null>(null);
  const [mPerPx, setMPerPx] = useState<number | null>(null);
  useEffect(() => {
    if (!map) return undefined;
    let frame = 0;
    let pending: LatLon | null = null;
    const onMove = (e: { lngLat: { lat: number; lng: number } }) => {
      pending = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setCursor(pending); });
    };
    const onOut = () => setCursor(null);
    const onZoom = () => setMPerPx(metresPerPixel(map.getZoom(), map.getCenter().lat));
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    map.on("move", onZoom);
    onZoom();
    return () => { if (frame) cancelAnimationFrame(frame); map.off("mousemove", onMove); map.off("mouseout", onOut); map.off("move", onZoom); };
  }, [map]);
  const bar = mPerPx ? scaleBar(mPerPx) : null;
  return (
    <div data-map-chrome data-testid="tak-coords"
      style={{ ...card, position: "absolute", zIndex: 21, left: 8, bottom: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 14, minHeight: 46, boxSizing: "border-box", pointerEvents: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 196 }}>
        <span style={{ fontFamily: TAK.mono, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: TAK.accent, fontSize: 10.5, marginRight: 6 }}>{t.tak.mgrs}</span>{cursor ? toMgrs(cursor) : "—"}
        </span>
        <span style={{ fontFamily: TAK.mono, fontSize: 11, color: TAK.textDim }}>{cursor ? formatLatLon(cursor) : t.tak.cursorHint}</span>
      </div>
      {bar && (
        <div aria-label={`${t.tak.scale} ${bar.label}`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontFamily: TAK.mono, fontSize: 11 }}>{bar.label}</span>
          <span style={{ display: "block", width: Math.round(bar.px), height: 6, borderLeft: `2px solid ${TAK.text}`, borderRight: `2px solid ${TAK.text}`, borderBottom: `2px solid ${TAK.text}`, boxSizing: "border-box" }} />
        </div>
      )}
    </div>
  );
}
