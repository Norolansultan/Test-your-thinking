/**
 * Range & Bearing (SPEC/28 §5): while this pane is open, two taps on the map give the distance and the true bearing
 * (`RangeBearing.ts`); the line stays on the map until it is cleared, also after the pane closes. A measurement is logged
 * (`tak_rb_measured`); the taps themselves are not map clicks on any object.
 */

import type { LatLon } from "../../../engine/primitives.js";
import { useLang } from "../i18n.js";
import { toMgrs } from "./coords.js";
import { formatBearing, formatRange, rangeBearing } from "./RangeBearing.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

export interface RbState { readonly from: LatLon | null; readonly to: LatLon | null }

export function RangeBearingPane({ rb, onClear }: { readonly rb: RbState; readonly onClear: () => void }) {
  const { t, lang } = useLang();
  const R = t.tak.rb;
  const result = rb.from && rb.to ? rangeBearing(rb.from, rb.to) : null;
  const hint = !rb.from ? R.hintFirst : !rb.to ? R.hintSecond : R.again;
  const line = (label: string, value: string, big = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0", borderBottom: `1px solid ${TAK.panelBorder}` }}>
      <span style={{ fontSize: 12, color: TAK.textDim }}>{label}</span>
      <span style={{ fontFamily: TAK.mono, fontSize: big ? 20 : 12.5, fontWeight: big ? 700 : 500, color: big ? "#ffffff" : TAK.text }}>{value}</span>
    </div>
  );
  return (
    <div data-testid="tak-rb" style={paneScroll}>
      <div role="status" style={{ padding: "10px 12px", borderRadius: TAK.radius, background: TAK.row, border: `1px solid ${TAK.rb}`, fontSize: 13 }}>{hint}</div>
      <div>
        {line(R.from, rb.from ? toMgrs(rb.from) : "—")}
        {line(R.to, rb.to ? toMgrs(rb.to) : "—")}
        {line(R.range, result ? formatRange(result.metres, lang) : "—", true)}
        {line(R.bearing, result ? formatBearing(result.bearingDeg) : "—", true)}
        {line(R.backBearing, result ? formatBearing(result.backBearingDeg) : "—")}
      </div>
      <div style={{ fontSize: 11.5, color: TAK.textDim }}>{R.keeps}</div>
      <button type="button" data-testid="tak-rb-clear" onClick={onClear} disabled={!rb.from}
        style={{ alignSelf: "flex-start", minHeight: 40, padding: "6px 18px", borderRadius: TAK.radius, border: `1px solid ${TAK.accent}`, background: rb.from ? TAK.accentDim : "transparent", color: TAK.text, fontWeight: 700, cursor: rb.from ? "pointer" : "default", opacity: rb.from ? 1 : 0.5 }}>
        {R.clear}
      </button>
    </div>
  );
}
