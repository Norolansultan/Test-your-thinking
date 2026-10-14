/**
 * Game mode: the right-hand TAK toolbar and its side pane (the study's TAK shell styling, `render/ui/tak/TakToolbar`
 * and `TakSidePane`, re-drawn here in the game's own language strings): Units, Radio / GeoChat, Objectives, Layers and
 * Help.
 */

import type { ComponentChildren, JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { GameScenario, GameState, GameWorld, RadioMessage, Unit } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { CELL } from "../contracts.js";
import { FUEL_LEGEND, fuelCss, stateCss } from "./fire-colors.js";
import { statusColor, unitSymbolSvg } from "./markers.js";
import { statusLabel } from "./OrderBar.js";
import { isAir } from "./orders.js";
import { unitListOrder } from "./scenario-info.js";
import { GM, TAK } from "./styles.js";
import { clockAt, GAME_TEXT, inLang, type LayerId, type PaneId } from "./text.js";

const icon = (body: JSX.Element) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>
);

const PANE_ICON: Readonly<Record<PaneId, JSX.Element>> = {
  units: icon(<><circle cx="8" cy="8" r="3.2" /><path d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><path d="M15 7h6.5M15 11h6.5M17 15h4.5" /></>),
  radio: icon(<><path d="M4 4.5h16v11H11l-4.5 4v-4H4z" /><path d="M12 7.2a2.2 2.2 0 0 1 2.2 2.2c0 1.6-2.2 3.6-2.2 3.6s-2.2-2-2.2-3.6A2.2 2.2 0 0 1 12 7.2z" /></>),
  objectives: icon(<><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>),
  layers: icon(<><path d="M12 3 2.5 8 12 13l9.5-5z" /><path d="m2.5 12.5 9.5 5 9.5-5" /><path d="m2.5 16.5 9.5 5 9.5-5" /></>),
  help: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5" /><path d="M12 17.2v.1" /></>),
};

export const PANES: readonly PaneId[] = ["units", "radio", "objectives", "layers", "help"];

export function GameToolbar({ lang, open, onSelect, unread, urgent = false, narrow }: {
  readonly lang: Lang; readonly open: PaneId | null; readonly onSelect: (p: PaneId) => void; readonly unread: number; readonly urgent?: boolean; readonly narrow: boolean;
}) {
  const t = GAME_TEXT[lang];
  const width = narrow ? 58 : TAK.toolbarWidth;
  return (
    <nav data-testid="game-toolbar" style={{ width, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, padding: "6px 3px", background: TAK.panel, borderLeft: `1px solid ${TAK.panelBorder}`, overflowY: "auto", boxSizing: "border-box", zIndex: 23 }}>
      {PANES.map((p) => {
        const active = open === p;
        const badge = p === "radio" && unread > 0 && !active;
        return (
          <button key={p} type="button" data-testid={`game-tool-${p}`} aria-pressed={active} onClick={() => onSelect(p)} title={t.paneTitle[p]}
            style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minHeight: narrow ? 52 : TAK.toolButtonHeight,
              padding: "6px 2px", border: "none", borderRadius: TAK.radius, cursor: "pointer", background: active ? TAK.accentDim : "transparent", color: active ? "#fff" : TAK.text,
              boxShadow: active ? `inset 3px 0 0 ${TAK.accent}` : "none", fontSize: narrow ? 10 : 11, fontWeight: 600, lineHeight: 1.1 }}>
            {PANE_ICON[p]}
            <span style={{ maxWidth: width - 8, overflowWrap: "anywhere" }}>{t.toolbar[p]}</span>
            {badge && (
              <span data-testid="game-unread" style={{ position: "absolute", top: 4, right: 6, minWidth: 18, height: 18, padding: "0 4px", boxSizing: "border-box", borderRadius: 9, background: urgent ? GM.danger : TAK.warn, color: urgent ? "#fff" : "#1c1b19", fontSize: 11, fontWeight: 700, lineHeight: "18px" }}>{unread > 99 ? "99+" : unread}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function SidePane({ lang, pane, overlay, onClose, children }: {
  readonly lang: Lang; readonly pane: PaneId; readonly overlay: boolean; readonly onClose: () => void; readonly children: ComponentChildren;
}) {
  const t = GAME_TEXT[lang];
  return (
    <aside data-testid={`game-pane-${pane}`} aria-label={t.paneTitle[pane]}
      style={{ ...(overlay ? { position: "absolute" as const, top: 0, bottom: 0, right: 0, left: 0, zIndex: 22 } : { width: TAK.paneWidth, flexShrink: 0 }), display: "flex", flexDirection: "column", minHeight: 0, background: TAK.panel, color: TAK.text, borderLeft: `1px solid ${TAK.panelBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 4px 0 14px", background: TAK.panelRaised, borderBottom: `2px solid ${TAK.accent}`, flexShrink: 0 }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{t.paneTitle[pane]}</h2>
        <button type="button" data-testid="game-pane-close" onClick={onClose} aria-label={t.closePane} title={t.closePane}
          style={{ width: 44, height: 40, border: "none", borderRadius: TAK.radius, background: "transparent", color: TAK.text, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </aside>
  );
}

const scroll = { flex: 1, minHeight: 0, overflowY: "auto" as const, padding: 10, display: "flex", flexDirection: "column" as const, gap: 6 };

function Bar({ pct, color, label }: { readonly pct: number; readonly color: string; readonly label: string }) {
  return (
    <div title={`${label} ${Math.round(pct)} %`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: TAK.textDim }}>
      <span style={{ width: 44 }}>{label}</span>
      <span style={{ flex: 1, height: 5, background: "#000a", borderRadius: 3, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></span>
    </div>
  );
}

export function UnitsPane({ lang, units, selected, startClockMin, onSelect }: {
  readonly lang: Lang; readonly units: readonly Unit[]; readonly selected: ReadonlySet<string>; readonly startClockMin: number;
  readonly onSelect: (id: string, add: boolean) => void;
}) {
  const t = GAME_TEXT[lang];
  return (
    <div style={scroll} data-testid="game-units-list">
      {unitListOrder(units).map((u) => {
        const sel = selected.has(u.id);
        return (
          <button key={u.id} type="button" data-testid={`game-unit-row-${u.id}`} onClick={(e) => onSelect(u.id, e.shiftKey || e.ctrlKey || e.metaKey)}
            style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", padding: "7px 8px", borderRadius: TAK.radius, cursor: "pointer", color: TAK.text,
              border: `1px solid ${sel ? GM.select : TAK.panelBorder}`, background: sel ? "#2a2600" : TAK.row, opacity: u.status === "en_route" || u.status === "out_of_action" ? 0.7 : 1 }}>
            <span style={{ width: 34, height: 34, flex: "none", borderRadius: "50%", border: `3px solid ${statusColor(u)}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 22, height: 17 }} dangerouslySetInnerHTML={{ __html: unitSymbolSvg(u.kind) }} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <b style={{ fontFamily: TAK.mono, fontSize: 13.5, color: sel ? GM.select : TAK.text }}>{u.callsign}</b>
                <span style={{ fontSize: 11.5, color: TAK.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.kind[u.kind]}</span>
              </span>
              <span style={{ fontSize: 11.5, color: statusColor(u) }}>
                {statusLabel(t, u)}{u.etaS !== null && (u.status === "en_route" || u.status === "moving") ? ` · ${t.eta(clockAt(startClockMin, u.etaS))}` : ""}
              </span>
              {u.waterMaxL > 0 && <Bar pct={(100 * u.waterL) / u.waterMaxL} color={GM.water} label={t.water} />}
              {isAir(u.kind) ? <Bar pct={u.energyPct} color={u.energyPct < 20 ? GM.danger : GM.energy} label={t.energy} /> : null}
              {u.harm > 0.01 && <Bar pct={100 * u.harm} color={GM.danger} label={t.harm} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const ROOMS: readonly (RadioMessage["room"] | "all")[] = ["all", "command", "ground", "air", "support"];

export function RadioPane({ lang, radio, startClockMin, onLocate }: {
  readonly lang: Lang; readonly radio: readonly RadioMessage[]; readonly startClockMin: number; readonly onLocate: (m: RadioMessage) => void;
}) {
  const t = GAME_TEXT[lang];
  const [room, setRoom] = useState<RadioMessage["room"] | "all">("all");
  const shown = room === "all" ? radio : radio.filter((m) => m.room === room);
  const ref = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  useLayoutEffect(() => { const el = ref.current; if (el && atEnd.current) el.scrollTop = el.scrollHeight; }, [shown.length, room]);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} data-testid="game-radio">
      <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${TAK.panelBorder}`, flexShrink: 0 }}>
        {ROOMS.map((r) => {
          const n = r === "all" ? radio.length : radio.filter((m) => m.room === r).length;
          const on = r === room;
          return (
            <button key={r} type="button" role="tab" aria-selected={on} onClick={() => setRoom(r)} data-testid={`game-room-${r}`}
              style={{ minHeight: 32, padding: "3px 10px", borderRadius: 16, cursor: "pointer", fontSize: 12, fontWeight: 600, border: `1px solid ${on ? TAK.accent : TAK.panelBorder}`, background: on ? TAK.accentDim : TAK.row, color: on ? "#fff" : TAK.text }}>
              {t.rooms[r]} <span style={{ opacity: 0.75, fontFamily: TAK.mono }}>{n}</span>
            </button>
          );
        })}
      </div>
      <div ref={ref} style={scroll} onScroll={() => { const el = ref.current; if (el) atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}>
        {shown.length === 0 && <div style={{ opacity: 0.6, fontSize: 12.5 }}>{t.noMessages}</div>}
        {shown.map((m, i) => {
          const edge = m.priority === "urgent" ? GM.fire : m.priority === "important" ? "#ffc14d" : TAK.panelBorder;
          return (
            <div key={i} data-priority={m.priority} onClick={m.at ? () => onLocate(m) : undefined}
              style={{ padding: "6px 9px", borderRadius: TAK.radius, background: m.priority === "urgent" ? "#2b1708" : TAK.row, borderLeft: `3px solid ${edge}`, cursor: m.at ? "pointer" : "default", fontSize: 13, lineHeight: 1.4 }}>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: TAK.textDim, fontFamily: TAK.mono }}>
                <span>{clockAt(startClockMin, m.atS)}</span><span>{t.rooms[m.room]}</span>{m.at && <span aria-hidden="true">⌖</span>}
              </div>
              <div style={{ fontWeight: m.priority === "urgent" ? 700 : 400 }}>{inLang(lang, m.textFi, m.textEn)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ObjectivesPane({ lang, scenario, world, state }: { readonly lang: Lang; readonly scenario: GameScenario; readonly world: GameWorld; readonly state: GameState }) {
  const t = GAME_TEXT[lang];
  const s = state.score;
  return (
    <div style={scroll} data-testid="game-objectives-pane">
      {s.objectives.map((o, i) => {
        const color = o.met === true ? GM.ok : o.met === false ? GM.danger : TAK.textDim;
        return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 10px", background: TAK.row, borderRadius: TAK.radius, borderLeft: `3px solid ${color}` }}>
            <span style={{ color, fontWeight: 800, fontSize: 16 }}>{o.met === true ? "✓" : o.met === false ? "✗" : "○"}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{t.objective(o.objective, world, scenario.startClockMin)}</span>
            <span style={{ fontSize: 11.5, color }}>{o.met === true ? t.objectiveState.met : o.met === false ? t.objectiveState.failed : t.objectiveState.open}</span>
          </div>
        );
      })}
      <table style={{ borderCollapse: "collapse", fontSize: 13, marginTop: 6 }}>
        <tbody>
          {[
            [t.hud.burned, `${s.burnedHa.toFixed(1)} ha`],
            [t.hud.assetsLost, `${s.assetsLost} / ${s.assetsTotal}`],
            [t.debrief.casualties, String(s.casualties)],
            [t.debrief.containedAt, s.containedAtS === null ? t.debrief.notContained : clockAt(scenario.startClockMin, s.containedAtS)],
            [t.hud.points, String(s.points)],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: `1px solid ${TAK.panelBorder}` }}><td style={{ padding: "5px 0", color: TAK.textDim }}>{k}</td><td style={{ padding: "5px 0", textAlign: "right", fontFamily: TAK.mono }}>{v}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: state.powerLineLive ? "#ffd400" : TAK.textDim }}>⚡ {t.powerLine(state.powerLineLive)}</p>
    </div>
  );
}

const LAYER_IDS: readonly LayerId[] = ["fog", "fuel", "forecast", "labels", "sensors", "truth"];

export function LayersPane({ lang, layers, onToggle }: { readonly lang: Lang; readonly layers: Readonly<Record<LayerId, boolean>>; readonly onToggle: (id: LayerId) => void }) {
  const t = GAME_TEXT[lang];
  const swatch = (css: string) => <span style={{ width: 14, height: 14, flex: "none", borderRadius: 2, background: css, border: "1px solid #0008" }} />;
  return (
    <div style={scroll} data-testid="game-layers">
      {LAYER_IDS.map((id) => (
        <label key={id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: TAK.row, borderRadius: TAK.radius, cursor: "pointer" }}>
          <input type="checkbox" checked={layers[id]} onChange={() => onToggle(id)} data-testid={`game-layer-${id}`} style={{ width: 18, height: 18, marginTop: 1, accentColor: TAK.accent }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.layers[id]}</span>
            <span style={{ fontSize: 11.5, color: TAK.textDim, lineHeight: 1.35 }}>{t.layerNote[id]}</span>
          </span>
        </label>
      ))}
      <h3 style={{ margin: "8px 0 2px", fontSize: 11.5, color: TAK.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.fireLegend}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", fontSize: 12 }}>
        {([[CELL.burning, t.fireStates.burning], [CELL.smouldering, t.fireStates.smouldering], [CELL.burnedOut, t.fireStates.burnedOut], [CELL.extinguished, t.fireStates.extinguished]] as const).map(([s, label]) => (
          <span key={s} style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch(stateCss(s))}{label}</span>
        ))}
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch("rgb(255, 230, 170)")}{t.fireStates.crown}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch("linear-gradient(90deg, rgb(255,150,30), rgb(150,130,110))")}{t.fireStates.stale}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch(GM.forecast20)}{t.forecastLabel(20)}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch(GM.hose)}{t.order.hose_line}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch(GM.fireBreak)}{t.order.fire_break}</span>
      </div>
      <h3 style={{ margin: "8px 0 2px", fontSize: 11.5, color: TAK.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.fuelLegend}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", fontSize: 12 }} data-testid="game-fuel-legend">
        {FUEL_LEGEND.map((code) => <span key={code} style={{ display: "flex", gap: 6, alignItems: "center" }}>{swatch(fuelCss(code))}{t.fuel[code]}</span>)}
      </div>
    </div>
  );
}

export function HelpPane({ lang }: { readonly lang: Lang }) {
  const t = GAME_TEXT[lang];
  return (
    <div style={scroll} data-testid="game-help">
      {t.help.map(([k, what]) => (
        <div key={k} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 8px", background: TAK.row, borderRadius: TAK.radius, fontSize: 13 }}>
          <span style={{ fontFamily: TAK.mono, fontWeight: 700, color: TAK.accent, minWidth: 120 }}>{k}</span>
          <span style={{ lineHeight: 1.35 }}>{what}</span>
        </div>
      ))}
    </div>
  );
}
