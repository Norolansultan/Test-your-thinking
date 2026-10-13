/**
 * The Overlay Manager (SPEC/28 §5): switches for the call-sign labels, the sensor footprints, the earlier perimeters and
 * the participant's own plan marks. The projection and the current perimeter are listed as always shown — they carry the
 * primary DV and have no switch. Rate marks are listed but unavailable: they are not drawn in this study (SPEC/12 (y)).
 * Every switch is logged (`tak_overlay_toggled`).
 */

import { useLang } from "../i18n.js";
import { TAK_OVERLAY_LAYERS, UNAVAILABLE_OVERLAYS, type TakOverlayState } from "./shell.js";
import type { TakOverlayLayer } from "../../../telemetry/record-kinds.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

export function OverlayManagerPane({ state, onToggle }: { readonly state: TakOverlayState; readonly onToggle: (layer: TakOverlayLayer) => void }) {
  const { t } = useLang();
  const O = t.tak.overlays;
  return (
    <div data-testid="tak-overlays" style={paneScroll}>
      <div style={{ fontSize: 12, color: TAK.textDim }}>{O.intro}</div>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={sectionTitle}>{O.lockedTitle}</h3>
        {([["projection", O.projection], ["current_perimeter", O.currentPerimeter]] as const).map(([id, label]) => (
          <div key={id} data-testid={`tak-overlay-locked-${id}`} style={{ ...row, opacity: 0.9 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TAK.accent} stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 600 }}>{label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: TAK.textDim }}>{O.lockedNote}</span>
            </span>
            <span style={{ ...pill(true), opacity: 0.55 }}>{O.on}</span>
          </div>
        ))}
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3 style={sectionTitle}>{O.layersTitle}</h3>
        {TAK_OVERLAY_LAYERS.map((layer) => {
          const unavailable = UNAVAILABLE_OVERLAYS.has(layer);
          const on = state[layer];
          const note = unavailable ? `${O.unavailable} ${O.notes[layer]}` : O.notes[layer];
          return (
            <button key={layer} type="button" role="switch" aria-checked={on} disabled={unavailable} data-testid={`tak-overlay-${layer}`}
              onClick={() => onToggle(layer)}
              style={{ ...row, cursor: unavailable ? "not-allowed" : "pointer", opacity: unavailable ? 0.5 : 1, textAlign: "left", fontFamily: "inherit", color: TAK.text, width: "100%" }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{O.layers[layer]}</span>
                {note && <span style={{ display: "block", fontSize: 11.5, color: TAK.textDim }}>{note}</span>}
              </span>
              <span style={pill(on)}>{on ? O.on : O.off}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

const sectionTitle = { margin: "4px 0 0", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" as const, color: TAK.accent };
const row = {
  display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "8px 10px", boxSizing: "border-box" as const,
  border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, background: TAK.row, fontSize: 13,
};
const pill = (on: boolean) => ({
  flexShrink: 0, minWidth: 48, padding: "4px 8px", borderRadius: 12, textAlign: "center" as const, fontSize: 11.5, fontWeight: 700,
  background: on ? TAK.accent : "#2a333b", color: on ? TAK.accentInk : TAK.textDim,
});
