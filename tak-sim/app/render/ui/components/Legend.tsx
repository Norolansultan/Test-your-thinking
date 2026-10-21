import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { FIRE_THEME as T } from "../fire-layers.js";
import { OWN_FORMATION_HUE as OWN } from "../unit-markers.js";
import { SECTOR_LINE } from "../map-overlay.js";
import { useLang } from "../i18n.js";
import { TOUR_STEP_EVENT } from "../tour.js";
import type { GlossarySurface } from "../audience-context.js";
import { Glossed } from "../explain/Glossed.js";
import type { RenderableCycle } from "../../../boundary/render-boundary.js";

/**
 * The legend's own-forces and reference rows (SPEC/12 revisions (al), (am)), in both languages. Revision (am) removed
 * the water points (no longer on the map: they stay in the radio texts only), the command post, the 1 km grid (both
 * gone from the map) and the basemap's water (read from the map itself). Basemap colours are `tools/topo-map/render.py`'s.
 */
export const LEGEND_MAP_TEXT = {
  fi: { unit: "Oma yksikkö (osoita: tunnus ja tehtävä)", crew: "Miehistö jalkaisin – ajoneuvo", hose: "Letkulinja", stack: "Useita yksiköitä (osoita: avautuu)", air: "Ilma-alus (osoita: reitti ja kuvausalue)",
    sector: "Lohkoraja L1–L4", road: "Tie R1–R3", power: "Sähkölinja 20 kV", region: "Muu palo alueella", show: "Näytä selite", hide: "Piilota selite" },
  en: { unit: "Own unit (point: call sign and task)", crew: "Crew on foot – vehicle", hose: "Hose line", stack: "Several units (point to open)", air: "Aircraft (point: track and footprint)",
    sector: "Sector boundary L1–L4", road: "Road R1–R3", power: "Power line 20 kV", region: "Other fire in the region", show: "Show legend", hide: "Hide legend" },
} as const;

/** Every legend row, in its fixed order (revision (am)): the fire's symbols, then own forces, then the reference overlay. */
export const LEGEND_ROWS = [
  "past", "burnt", "burningZone", "uncontained", "head", "contained", "inactive", "spotConfirmed", "spotUnconfirmed", "detections", "projection",
  "unit", "crew", "hose", "stack", "air", "sector", "road", "power", "region",
] as const;
export type LegendRow = (typeof LEGEND_ROWS)[number];

/**
 * Which rows the legend lists (revision (am)): only the symbols the live map draws now — the view's fire layers and
 * units, the projection once revealed, a stack badge or the region's other fires when the current camera draws them —
 * and always the static reference lines (sector boundaries, roads, the power line). Pure; reads only what the map draws.
 */
export function legendPresence(
  cycle: Pick<RenderableCycle, "fire" | "unitPositions" | "unitWork" | "aircraft"> | null | undefined,
  projection: boolean,
  camera: { readonly stacks: boolean; readonly region: boolean },
): ReadonlySet<LegendRow> {
  const f = cycle?.fire;
  const edges = f?.perimeter_current ?? [];
  const work = Object.values(cycle?.unitWork ?? {});
  const on: Record<LegendRow, boolean> = {
    past: (f?.perimeters_past.length ?? 0) > 0,
    burnt: (f?.burnt_area.geometry.length ?? 0) > 0,
    burningZone: (f?.burning_zone.length ?? 0) > 0,
    uncontained: edges.some((e) => e.status === "uncontained"),
    head: edges.some((e) => e.status === "uncontained" && e.is_head),
    contained: edges.some((e) => e.status === "contained"),
    inactive: edges.some((e) => e.status === "inactive"),
    spotConfirmed: (f?.spot_fires ?? []).some((s) => s.confirmed),
    spotUnconfirmed: (f?.spot_fires ?? []).some((s) => !s.confirmed),
    detections: (f?.detections.length ?? 0) > 0,
    projection,
    unit: Object.keys(cycle?.unitPositions ?? {}).length > 0,
    crew: work.some((w) => !!w.vehicle),
    hose: work.some((w) => !!w.vehicle && w.hoseM != null),
    stack: camera.stacks,
    air: (cycle?.aircraft.length ?? 0) > 0,
    sector: true, road: true, power: true,
    region: camera.region,
  };
  return new Set(LEGEND_ROWS.filter((k) => on[k]));
}

/**
 * Map legend, bottom-left (SPEC/12 revision 24 Sep (c) §6). Part of the stimulus: identical for
 * everyone — both groups see the projection (SPEC/02 revision (o) §1); its inputs are the shown
 * envelope's isochrone minutes, so a merged view's bands read 0–20 · 20–40 min and a single view's 0–10 · 10–20 min (SPEC/26 §2),
 * and the rows drawn on the map now (`legendPresence`, revision (am)). Every sample is drawn with the same theme values
 * as the map, so the legend cannot drift from what it explains.
 *
 * SPEC/35 §3: the row names carry the glossary's marks in a public session (`Glossed`, `surface`). `embedded`: the help
 * card's copy (every row, in the card's flow, always open, no toggle); the map's legend is unchanged.
 */
export function Legend({ isoMinutes, drawn, onToggle, bottom = 28, symbols, embedded = false, surface = "other" }: {
  readonly isoMinutes: readonly number[]; readonly drawn: ReadonlySet<LegendRow>; readonly onToggle?: (open: boolean) => void;
  /** The TAK shell (SPEC/28 §5): the legend sits above the coordinate readout, and its unit rows show the map's 2525 symbols (SVG markup). */
  readonly bottom?: number; readonly symbols?: { readonly unit: string; readonly air: string } | undefined;
  readonly embedded?: boolean; readonly surface?: GlossarySurface;
}) {
  const { tr, lang } = useLang();
  // Collapsible (revision (al)). Revision (am): collapsed at the start for everyone — open, it covered ~40 % of a
  // 1280 × 529 window's map — as a small "Legend" button; it stays as the participant leaves it. The guided tour's
  // legend step shows it open while that step is on screen (`announceTourStep`; the same for everyone, not logged as a
  // participant toggle), then it returns to the participant's state.
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setTourOpen((e as CustomEvent<string | null>).detail === "legend");
    window.addEventListener(TOUR_STEP_EVENT, on);
    return () => window.removeEventListener(TOUR_STEP_EVENT, on);
  }, []);
  const shown = open || tourOpen;
  const M = LEGEND_MAP_TEXT[lang === "en" ? "en" : "fi"];
  const L = { ...T.legend, title: tr(T.legend.title), past: tr(T.legend.past), burnt: tr(T.legend.burnt), uncontained: tr(T.legend.uncontained), contained: tr(T.legend.contained), inactive: tr(T.legend.inactive), burningZone: tr(T.legend.burningZone), head: tr(T.legend.head),
    spotConfirmed: tr(T.legend.spotConfirmed), spotUnconfirmed: tr(T.legend.spotUnconfirmed), detections: tr(T.legend.detections), projection: tr(T.legend.projection) };
  const u = T.uncontained;
  const w = 26, h = 11, y = h / 2;
  const sample = (body: JSX.Element) => <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flex: "none" }}>{body}</svg>;
  const tickSide = u.tickSide === "inside" ? 1 : -1; // on screen, "outside" of a CCW ring's top edge is up
  const ticks = Array.from({ length: Math.floor(w / u.tickSpacingPx) }, (_, k) => (
    <rect x={k * u.tickSpacingPx + 3} y={tickSide < 0 ? y - u.widthPx / 2 - u.tickLengthPx : y + u.widthPx / 2} width={u.tickWidthPx} height={u.tickLengthPx} fill={u.color} />
  ));
  // The spot symbol at 70 % so its ring fits the row; ring and dash rhythm stay those of the map.
  const spot = (confirmed: boolean) => (
    <g transform={`translate(${w / 2} ${y}) scale(0.7) translate(${-w / 2} ${-y})`}>
      <circle cx={w / 2} cy={y} r={T.spotFire.diameterPx / 2 + T.spotFire.ringWidthPx / 2 + 1} fill="none" stroke="#9aa0a6" stroke-width={T.spotFire.ringWidthPx + 1} />
      <circle cx={w / 2} cy={y} r={T.spotFire.diameterPx / 2 + T.spotFire.ringWidthPx / 2 + 1} fill="none" stroke={T.spotFire.ringColor} stroke-width={T.spotFire.ringWidthPx} stroke-dasharray={confirmed ? undefined : "2.5 2"} />
      <circle cx={w / 2} cy={y} r={T.spotFire.diameterPx / 2} fill={T.spotFire.color} />
    </g>
  );
  const pw = T.projection.widthPxByMinutes["20"]; // the outer line: the next situation
  const bw = w / T.projection.bands.length;
  const frame = (x: number, small = false, dome = false) => (
    <rect x={x} y={small ? 3 : 1.5} width={small ? 8 : 11} height={small ? 6 : 8} rx={dome ? 4 : 0} fill="#12151a" stroke={OWN} stroke-width={1.6} />
  );
  // The TAK shell's 2525 symbol in place of the classic frame (`tak/tak-symbols.ts`; static markup, no user input).
  const sym = (svg: string, small = false) => <span style={{ display: "inline-block", width: small ? 11 : 15, height: small ? 9 : 12, flex: "none" }} dangerouslySetInnerHTML={{ __html: svg }} />;
  const symRow = (body: JSX.Element) => <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2, width: w, height: h + 2, flex: "none" }}>{body}</span>;
  const rows: [LegendRow, JSX.Element, string][] = [
    ["past", sample(<line x1={0} y1={y} x2={w} y2={y} stroke={T.past.color} stroke-width={T.past.widthPx} opacity={T.past.opacityNewest} />), L.past],
    ["burnt", sample(<rect x={2} y={2} width={w - 4} height={h - 4} fill={T.burnt.color} opacity={T.burnt.opacity} />), L.burnt],
    ["burningZone", sample(<rect x={2} y={2} width={w - 4} height={h - 4} fill={T.burningZone.color} opacity={T.burningZone.opacity} />), L.burningZone],
    ["uncontained", sample(<>{ticks}<line x1={0} y1={y} x2={w} y2={y} stroke={u.color} stroke-width={u.widthPx} /></>), L.uncontained],
    // The head: the uncontained edge with its glow (blur approximated by a wide, faded stroke).
    ["head", sample(<><line x1={2} y1={y} x2={w - 2} y2={y} stroke={T.headGlow.color} stroke-width={Math.min(h, T.headGlow.widthPx)} stroke-linecap="round" opacity={T.headGlow.opacity * 0.7} /><line x1={0} y1={y} x2={w} y2={y} stroke={u.color} stroke-width={u.widthPx} /></>), L.head],
    // Contained and quiet edges on a strip of burnt fill, as they are seen on the map (revision (ah)).
    ["contained", sample(<><rect x={0} y={y} width={w} height={h - y} fill={T.burnt.color} opacity={T.burnt.opacity} /><line x1={0} y1={y} x2={w} y2={y} stroke={T.contained.casingColor} stroke-width={T.contained.casingWidthPx} /><line x1={0} y1={y} x2={w} y2={y} stroke={T.contained.color} stroke-width={T.contained.widthPx} /></>), L.contained],
    ["inactive", sample(<><rect x={0} y={y} width={w} height={h - y} fill={T.burnt.color} opacity={T.burnt.opacity} /><line x1={0} y1={y} x2={w} y2={y} stroke={T.inactive.casingColor} stroke-width={T.inactive.casingWidthPx} /><line x1={0} y1={y} x2={w} y2={y} stroke={T.inactive.color} stroke-width={T.inactive.widthPx} /></>), L.inactive],
    ["spotConfirmed", sample(spot(true)), L.spotConfirmed],
    ["spotUnconfirmed", sample(spot(false)), L.spotUnconfirmed],
    ["detections", sample(<>{T.detections.bands.map((b, k) => <circle cx={5 + k * 8} cy={y} r={T.detections.radiusPx + 0.5} fill={T.detections.hollow ? "none" : b.color} stroke={b.color} stroke-width={T.detections.hollow ? T.detections.strokePx : 0} />)}</>),
      `${L.detections} ${L.detectionAges.join(" · ")}`],
    ["projection", sample(<>
      {T.projection.bands.map((b, k) => <rect x={k * bw} y={1} width={bw} height={h - 2} fill={b.color} opacity={b.opacity} />)}
      <line x1={0} y1={y} x2={w} y2={y} stroke={T.projection.color} stroke-width={pw} stroke-dasharray={`${T.projection.dashPx / 2} ${T.projection.gapPx / 2}`} />
    </>), `${L.projection} ${projectionBandsLabel(isoMinutes, L.projectionBands)}`],
    ["unit", symbols ? symRow(sym(symbols.unit)) : sample(<>{frame(7)}</>), M.unit],
    ["crew", symbols ? symRow(<>{sym(symbols.unit)}<span style={{ width: 4, borderTop: `1px solid ${OWN}`, opacity: 0.6 }} />{sym(symbols.unit, true)}</>) : sample(<><line x1={6} y1={y} x2={19} y2={y} stroke={OWN} stroke-width={1} opacity={0.6} />{frame(1)}{frame(17, true)}</>), M.crew],
    ["hose", sample(<line x1={0} y1={y} x2={w} y2={y} stroke={OWN} stroke-width={2} opacity={0.9} />), M.hose],
    ["stack", sample(<><rect x={6} y={1.5} width={14} height={8} fill="#12151a" stroke={OWN} stroke-width={1.6} stroke-dasharray="none" /><text x={13} y={8.3} text-anchor="middle" font-size="7" font-weight="700" fill={OWN} font-family="monospace">3</text></>), M.stack],
    ["air", symbols ? symRow(sym(symbols.air)) : sample(<><line x1={0} y1={y + 2} x2={w} y2={y + 2} stroke={OWN} stroke-width={1.2} stroke-dasharray="3 2" opacity={0.8} />{frame(7, false, true)}</>), M.air],
    ["sector", sample(<line x1={0} y1={y} x2={w} y2={y} stroke={SECTOR_LINE.color} stroke-width={SECTOR_LINE.widthPx} stroke-dasharray={SECTOR_LINE.dash.join(" ")} />), M.sector],
    ["road", sample(<><line x1={0} y1={y} x2={w} y2={y} stroke="#141414" stroke-width={3} /><line x1={0} y1={y} x2={w} y2={y} stroke="#fff4d6" stroke-width={1.3} /></>), M.road],
    ["power", sample(<><line x1={0} y1={y} x2={w} y2={y} stroke="#2d2d2d" stroke-width={0.9} />{[5, 13, 21].map((x) => <line x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} stroke="#2d2d2d" stroke-width={0.9} />)}</>), M.power],
    ["region", sample(<path d="M13 1 17.5 5.5 13 10 8.5 5.5Z" fill="#8e1b12" />), M.region],
  ];
  const toggle = () => { const next = !open; setOpen(next); onToggle?.(next); };
  const rowList = rows.filter(([k]) => drawn.has(k)).map(([k, s, label]) => (
    <div key={k} data-row={k} style={{ display: "flex", alignItems: "center", gap: 4, margin: 0 }}>{s}<span><Glossed text={label} surface={surface} /></span></div>
  ));
  if (embedded) {
    return (
      <div data-testid="legend-embedded" style={{ background: "#f4f1eceb", color: "#1c1b19", border: "1px solid #c9c3ba", borderRadius: 5, padding: "6px 8px", fontSize: L.fontPx + 2, lineHeight: 1.3 }}>
        <div style={{ fontWeight: 700, margin: "0 0 4px" }}>{L.title}</div>
        {rowList}
      </div>
    );
  }
  // One compact column with only the rows drawn now; it scrolls rather than covering a short map.
  return (
    <div data-tour="legend" data-open={shown ? "1" : "0"} style={{ position: "absolute", zIndex: 20, left: 8, bottom, maxHeight: `calc(100% - ${64 + bottom}px)`, overflowY: shown ? "auto" : "hidden", background: "#f4f1eceb", color: "#1c1b19", border: "1px solid #c9c3ba", borderRadius: 5, padding: "3px 6px", fontSize: L.fontPx, lineHeight: 1.15 }}>
      <button type="button" onClick={toggle} aria-expanded={shown} title={shown ? M.hide : M.show}
        style={{ display: "block", border: "none", background: "none", padding: 0, margin: shown ? "0 0 2px" : 0, font: "inherit", fontWeight: 700, color: "inherit", cursor: "pointer" }}>
        {shown ? "▾" : "▸"} {L.title}
      </button>
      {shown && rowList}
    </div>
  );
}

/** "0–10 · 10–20 min" (merged: "0–20 · 20–40 min") from the envelope's isochrones; the theme's text when there is no envelope. */
function projectionBandsLabel(isoMinutes: readonly number[], fallback: readonly string[]): string {
  if (isoMinutes.length === 0) return fallback.join(" · ");
  const sorted = [...isoMinutes].sort((a, b) => a - b);
  return `${sorted.map((m, k) => `${k === 0 ? 0 : sorted[k - 1]}–${m}`).join(" · ")} min`;
}
