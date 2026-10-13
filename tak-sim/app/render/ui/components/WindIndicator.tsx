import type { CycleWind } from "../../../scenario/types.js";
import { useLang } from "../i18n.js";

/**
 * The portable weather station's latest reading (SPEC/18 §6), drawn over the map. The arrow
 * points the way the wind BLOWS (downwind, like the fire's run); the number is where it blows
 * FROM, as Finnish weather reports give it. North is always up: the map cannot be rotated.
 * Mean speed only — gusts stay in the weather record (SPEC/12 §9 cycle 17). Values in mono,
 * SPEC/06 §3.1.
 */
export function WindIndicator({ wind, inline = false }: {
  readonly wind: CycleWind;
  /** The TAK shell's info card holds it (SPEC/28 §5): the same reading and rose, in the card's flow instead of over the map's corner. */
  readonly inline?: boolean;
}) {
  const { t, tr } = useLang();
  const compass = t.compass[Math.round((((wind.fromDeg % 360) + 360) % 360) / 45) % 8]!;
  const toDeg = (wind.fromDeg + 180) % 360;
  const at = clock(wind.observedAt);
  return (
    <div
      data-tour="wind"
      aria-label={t.windAria(compass, wind.fromDeg, wind.meanMs)}
      style={inline ? { display: "flex", alignItems: "center", gap: 6, color: "#e8eaed" } : {
        // Revision (am): compact (36 px rose, two text lines; was 52 px and three lines), so it covers less of the map.
        position: "absolute", zIndex: 20, left: 8, top: 8, display: "flex", alignItems: "center", gap: 6,
        background: "#1b1e22e6", border: "1px solid #3a3f44", borderRadius: 6, padding: "3px 8px 3px 3px", color: "#e8eaed",
      }}
    >
      <svg width="36" height="36" viewBox="-26 -26 52 52" role="img" aria-hidden="true">
        <circle r="22" fill="none" stroke="#5b6168" stroke-width="1" />
        {[0, 90, 180, 270].map((d) => (
          <line key={d} x1="0" y1="-22" x2="0" y2="-18" stroke="#8a9096" stroke-width="1.5" transform={`rotate(${d})`} />
        ))}
        <text x="0" y="-12" fill="#c9ccd0" font-size="8" text-anchor="middle" font-family="monospace">N</text>
        <g transform={`rotate(${toDeg})`}>
          <line x1="0" y1="14" x2="0" y2="-10" stroke="#e8eaed" stroke-width="2.5" stroke-linecap="round" />
          <path d="M0 -17 L6 -7 L-6 -7 Z" fill="#e8eaed" />
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, fontSize: 10, lineHeight: 1.25 }}>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
          {compass} {String(wind.fromDeg).padStart(3, "0")}° · {wind.meanMs} m/s
        </span>
        <span style={{ opacity: 0.65 }}>{t.wind} · <span style={{ fontFamily: "monospace" }}>{tr(wind.sourceFi)} {at}</span></span>
      </div>
    </div>
  );
}

const POINTS_FI = ["P", "KO", "I", "KA", "E", "LOU", "L", "LU"] as const; // pohjoinen, koillinen, itä, kaakko, …

/** Eight-point Finnish compass abbreviation for a FROM direction. */
export function compassFi(deg: number): string {
  return POINTS_FI[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

/** Virtual seconds since 13:20 → "HH:MM". */
function clock(virtualSeconds: number): string {
  const minutes = 13 * 60 + 20 + Math.floor(virtualSeconds / 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
