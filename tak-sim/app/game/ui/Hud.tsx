/**
 * Game mode: the top HUD — clock, speed (pause, 1×, 5×, 15×, 60×), wind arrow with speed and gust, temperature and
 * humidity, burned hectares, buildings lost, points, and the objectives as chips with their live status.
 */

import type { GameScenario, GameState, GameWorld } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { SPEEDS, type Speed } from "./loop.js";
import { windPoint } from "./scenario-info.js";
import { GM, TAK } from "./styles.js";
import { GAME_TEXT, inLang } from "./text.js";

/** An arrow pointing where the wind blows TO (from + 180°). */
export function WindArrow({ fromDeg, size = 26 }: { readonly fromDeg: number; readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="11" fill="none" stroke={TAK.panelBorder} stroke-width="1.5" />
      <g transform={`rotate(${(fromDeg + 180) % 360} 12 12)`}>
        <path d="M12 3.5 17 12h-3.2v8.5h-3.6V12H7z" fill={TAK.accent} />
      </g>
    </svg>
  );
}

const sep = <span aria-hidden="true" class="gm-hide-narrow" style={{ width: 1, alignSelf: "stretch", background: TAK.panelBorder, margin: "2px 2px" }} />;

export function Hud({ lang, scenario, world, state, speed, onSpeed, onQuit, windAlert = false }: {
  readonly lang: Lang; readonly scenario: GameScenario; readonly world: GameWorld; readonly state: GameState;
  readonly speed: Speed; readonly onSpeed: (s: Speed) => void; readonly onQuit: () => void;
  /** The wind has just changed: its reading flashes. */
  readonly windAlert?: boolean;
}) {
  const t = GAME_TEXT[lang];
  const w = state.weather;
  const s = state.score;
  const met = s.objectives.filter((o) => o.met === true).length;
  const stat = (label: string, short: string, value: string, testId: string, color: string = TAK.text) => (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }} data-testid={testId} title={label}>
      <span style={{ fontSize: 10, color: TAK.textDim, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        <span class="gm-hide-narrow">{label}</span><span class="gm-only-narrow">{short}</span>
      </span>
      <span style={{ fontFamily: TAK.mono, fontWeight: 700, fontSize: 15, color, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
  return (
    <header data-testid="game-hud" style={{ flexShrink: 0, background: TAK.panelRaised, borderBottom: `2px solid ${TAK.accent}`, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span data-testid="game-clock" style={{ fontFamily: TAK.mono, fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>{state.clockLabel}</span>
          <span class="gm-hide-narrow" style={{ fontSize: 12, color: TAK.textDim, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inLang(lang, scenario.titleFi, scenario.titleEn)}</span>
        </div>
        <div role="group" aria-label={t.hud.speed} style={{ display: "flex", gap: 2, background: TAK.panel, borderRadius: TAK.radius, padding: 2, border: `1px solid ${TAK.panelBorder}` }}>
          {SPEEDS.map((sp) => {
            const on = sp === speed;
            return (
              <button key={sp} type="button" data-testid={`game-speed-${sp}`} aria-pressed={on} onClick={() => onSpeed(sp)}
                title={sp === 0 ? `${t.hud.pause} (Space)` : `${sp}× (${SPEEDS.indexOf(sp)})`}
                style={{ minWidth: sp === 0 ? 38 : 40, height: 32, border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: TAK.mono,
                  background: on ? (sp === 0 ? GM.fire : TAK.accentDim) : "transparent", color: on ? "#fff" : TAK.text }}>
                {sp === 0 ? "⏸" : `${sp}×`}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onQuit} class="gm-btn gm-hud-quit" style={{ minHeight: 32, padding: "4px 10px", fontSize: 12.5 }} data-testid="game-quit">{t.hud.quit}</button>
        <div class="gm-hud-stats">
        <div class={windAlert ? "gm-alert" : undefined} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 4px", borderRadius: 4 }} data-testid="game-wind" title={`${t.hud.wind} ${Math.round(w.windFromDeg)}°`}>
          <WindArrow fromDeg={w.windFromDeg} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontFamily: TAK.mono, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>{windPoint(w, lang)} {w.windMs.toFixed(0)} m/s</span>
            <span style={{ fontSize: 11, color: TAK.textDim, whiteSpace: "nowrap" }}>{t.hud.gust} {w.gustMs.toFixed(0)}</span>
          </div>
        </div>
        {sep}
        {stat(t.hud.temp, t.hud.tempShort, `${Math.round(w.tempC)} °C`, "game-temp")}
        {stat(t.hud.rh, t.hud.rhShort, `${Math.round(w.rh)} %`, "game-rh", w.rh < 30 ? GM.fire : TAK.text)}
        {sep}
        {stat(t.hud.burned, t.hud.burnedShort, `${s.burnedHa.toFixed(1)} ha`, "game-burned", GM.fire)}
        {stat(t.hud.assetsLost, t.hud.assetsLostShort, `${s.assetsLost}`, "game-assets-lost", s.assetsLost > 0 ? GM.danger : TAK.text)}
        {stat(t.hud.points, t.hud.pointsShort, `${s.points}`, "game-points")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} data-testid="game-objectives">
        <span class="gm-only-narrow gm-chip" style={{ color: TAK.textDim }}>{t.objectives} {met}/{s.objectives.length}</span>
        {s.objectives.map((o, i) => {
          const color = o.met === true ? GM.ok : o.met === false ? GM.danger : TAK.textDim;
          return (
            <span key={i} class="gm-chip gm-hide-narrow" style={{ borderColor: color }}>
              <span aria-hidden="true" style={{ color, fontWeight: 800 }}>{o.met === true ? "✓" : o.met === false ? "✗" : "○"}</span>
              {t.objective(o.objective, world, scenario.startClockMin)}
            </span>
          );
        })}
        <span class="gm-chip" title={t.powerLine(state.powerLineLive)} style={{ borderColor: state.powerLineLive ? "#ffd400" : TAK.panelBorder, color: state.powerLineLive ? "#ffd400" : TAK.textDim }}>
          ⚡ <span class="gm-hide-narrow">{t.powerLine(state.powerLineLive)}</span><span class="gm-only-narrow">20 kV</span>
        </span>
      </div>
    </header>
  );
}
