/**
 * Game mode: the debrief — the grade, the outcome, how the points came about, the burned area over time (a small SVG
 * line chart with a hover readout), buildings and settlements lost, casualties and when the fire was contained.
 */

import { useState } from "preact/hooks";
import type { AssetStatus, GamePhase, GameScenario, GameWorld, Score } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { CONTAIN_BONUS, POINTS_PER_CASUALTY, POINTS_PER_HA, POINTS_PER_OBJECTIVE, POINTS_PER_SETTLEMENT, START_POINTS, STILL_BURNING_PENALTY } from "../sim/score.js";
import { settlementOf } from "./scenario-info.js";
import { GM, TAK } from "./styles.js";
import { clockAt, GAME_TEXT, inLang } from "./text.js";

export interface GameResult {
  readonly phase: Extract<GamePhase, "won" | "lost" | "ended">;
  readonly score: Score;
  readonly endedAtS: number;
  /** Burned hectares sampled through the game. */
  readonly history: readonly { readonly tS: number; readonly ha: number }[];
  readonly assetStatus: Readonly<Record<string, AssetStatus>>;
  /** The game ended with a fire still flaming (a penalty in the score). */
  readonly burningAtEnd: boolean;
}

export const GRADE_COLOR: Readonly<Record<Score["grade"], string>> = { S: "#ffd400", A: GM.ok, B: "#8bc34a", C: TAK.accent, D: GM.fire, F: GM.danger };

/** The score's parts, by the game's own scoring constants (`sim/score.ts`); the last row reconciles to the total. */
export function pointsBreakdown(score: Score, lostValue: number, endAtS: number, burningAtEnd = false): { readonly key: string; readonly value: number }[] {
  const rows: { key: string; value: number }[] = [{ key: "start", value: START_POINTS }];
  rows.push({ key: "burned", value: -Math.round(POINTS_PER_HA * score.burnedHa) });
  if (lostValue > 0) rows.push({ key: "assets", value: -Math.round(lostValue) });
  if (score.casualties > 0) rows.push({ key: "casualties", value: -POINTS_PER_CASUALTY * score.casualties });
  if (score.settlementsLost.length > 0) rows.push({ key: "settlements", value: -POINTS_PER_SETTLEMENT * score.settlementsLost.length });
  if (score.containedAtS !== null && endAtS > 0) rows.push({ key: "contained", value: Math.round(CONTAIN_BONUS * Math.max(0, Math.min(1, (endAtS - score.containedAtS) / endAtS))) });
  const met = score.objectives.filter((o) => o.met === true).length;
  if (met > 0) rows.push({ key: "objectives", value: POINTS_PER_OBJECTIVE * met });
  if (burningAtEnd) rows.push({ key: "burning", value: -STILL_BURNING_PENALTY });
  const sum = rows.reduce((a, r) => a + r.value, 0);
  if (Math.abs(score.points - sum) >= 1) rows.push({ key: "other", value: score.points - sum });
  return rows;
}

const ROW_LABEL: Readonly<Record<Lang, Readonly<Record<string, string>>>> = {
  fi: { start: "Lähtöpisteet", burned: "Paloala", assets: "Menetetyt rakennukset", casualties: "Henkilövahingot", settlements: "Menetetyt kylät", contained: "Rajausbonus", objectives: "Saavutetut tavoitteet", burning: "Palo palaa yhä", other: "Muut / pyöristys" },
  en: { start: "Starting points", burned: "Burned area", assets: "Buildings lost", casualties: "Casualties", settlements: "Settlements lost", contained: "Containment bonus", objectives: "Objectives met", burning: "Fire still burning", other: "Other / rounding" },
};

export function Debrief({ lang, scenario, result, world, onPlayAgain, onBack }: {
  readonly lang: Lang; readonly scenario: GameScenario; readonly result: GameResult; readonly world: GameWorld;
  readonly onPlayAgain: () => void; readonly onBack: () => void;
}) {
  const t = GAME_TEXT[lang];
  const d = t.debrief;
  const s = result.score;
  const lostValue = world.assets.reduce((a, x) => a + (result.assetStatus[x.id] === "burned" ? x.value : 0), 0);
  const rows = pointsBreakdown(s, lostValue, scenario.endAtS, result.burningAtEnd);
  const settlementNames = s.settlementsLost.map((id) => { const st = settlementOf(world, id); return st ? inLang(lang, st.nameFi, st.nameEn) : id; });
  const stat = (label: string, value: string, bad = false) => (
    <div style={{ background: TAK.row, border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, padding: "10px 12px" }}>
      <div style={{ fontSize: 11.5, color: TAK.textDim, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: TAK.mono, color: bad ? GM.danger : TAK.text }}>{value}</div>
    </div>
  );
  return (
    <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "20px 16px 28px" }} data-testid="game-debrief">
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div data-testid="game-grade" aria-label={`${d.grade} ${s.grade}`}
            style={{ width: 112, height: 112, flex: "none", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76, fontWeight: 800, color: GRADE_COLOR[s.grade], border: `3px solid ${GRADE_COLOR[s.grade]}`, background: TAK.panelRaised }}>{s.grade}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{d.title} · {inLang(lang, scenario.titleFi, scenario.titleEn)}</div>
            <h1 style={{ margin: "4px 0", fontSize: 28 }}>{d.outcome[result.phase]}</h1>
            <div style={{ fontSize: 16, color: TAK.textDim }}>{d.points}: <b style={{ color: TAK.text, fontFamily: TAK.mono, fontSize: 22 }}>{s.points}</b></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" class="gm-btn primary" onClick={onPlayAgain} data-testid="game-play-again">{d.playAgain}</button>
            <button type="button" class="gm-btn" onClick={onBack}>{d.back}</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {stat(d.burnedArea, `${s.burnedHa.toFixed(1)} ${d.hectares}`)}
          {stat(d.assetsLost, `${s.assetsLost} / ${s.assetsTotal}`, s.assetsLost > 0)}
          {stat(d.settlementsLost, settlementNames.length > 0 ? settlementNames.join(", ") : d.none, settlementNames.length > 0)}
          {stat(d.casualties, String(s.casualties), s.casualties > 0)}
          {stat(d.containedAt, s.containedAtS === null ? d.notContained : clockAt(scenario.startClockMin, s.containedAtS))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          <section style={{ background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, padding: 14 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>{d.burnedOverTime}</h3>
            <BurnChart lang={lang} history={result.history} startClockMin={scenario.startClockMin} />
          </section>
          <section style={{ background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13.5, width: "100%" }} data-testid="game-points">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={{ borderBottom: `1px solid ${TAK.panelBorder}` }}>
                    <td style={{ padding: "5px 0" }}>{ROW_LABEL[lang][r.key] ?? r.key}</td>
                    <td style={{ padding: "5px 0", textAlign: "right", fontFamily: TAK.mono, color: r.value < 0 ? "#ff8a80" : r.key === "start" ? TAK.text : "#a5d6a7" }}>{r.key === "start" ? r.value : `${r.value >= 0 ? "+" : "−"}${Math.abs(r.value)}`}</td>
                  </tr>
                ))}
                <tr><td style={{ padding: "7px 0", fontWeight: 700 }}>{d.points}</td><td style={{ padding: "7px 0", textAlign: "right", fontFamily: TAK.mono, fontWeight: 700 }}>{s.points}</td></tr>
              </tbody>
            </table>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5 }}>
              {s.objectives.map((o, i) => (
                <li key={i} style={{ display: "flex", gap: 8 }}>
                  <span aria-hidden="true" style={{ color: o.met === true ? GM.ok : o.met === false ? GM.danger : TAK.textDim, fontWeight: 700 }}>{o.met === true ? "✓" : o.met === false ? "✗" : "–"}</span>
                  <span>{t.objective(o.objective, world, scenario.startClockMin)} <span style={{ color: TAK.textDim }}>({o.met === true ? t.objectiveState.met : o.met === false ? t.objectiveState.failed : t.objectiveState.open})</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Nice round upper bound for an axis. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function BurnChart({ lang, history, startClockMin }: { readonly lang: Lang; readonly history: readonly { readonly tS: number; readonly ha: number }[]; readonly startClockMin: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const t = GAME_TEXT[lang].debrief;
  const W = 480, H = 210, L = 40, R = 10, T = 22, B = 24;
  if (history.length < 2) return <div style={{ color: TAK.textDim, fontSize: 13 }}>—</div>;
  const t0 = history[0]!.tS, t1 = history[history.length - 1]!.tS;
  const yMax = niceMax(Math.max(...history.map((h) => h.ha)));
  const x = (s: number) => L + ((s - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (ha: number) => T + (1 - ha / yMax) * (H - T - B);
  const path = history.map((h, i) => `${i === 0 ? "M" : "L"}${x(h.tS).toFixed(1)},${y(h.ha).toFixed(1)}`).join("");
  const area = `${path}L${x(t1).toFixed(1)},${y(0)}L${x(t0).toFixed(1)},${y(0)}Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const hourS = 3600;
  const firstHour = Math.ceil((startClockMin * 60 + t0) / hourS) * hourS - startClockMin * 60;
  const span = t1 - t0;
  const stepS = span > 6 * hourS ? 2 * hourS : span > 90 * 60 ? hourS : 1800;
  const xTicks: number[] = [];
  for (let s = firstHour; s <= t1; s += stepS) if (s >= t0) xTicks.push(s);
  const onMove = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Number.POSITIVE_INFINITY;
    history.forEach((h, i) => { const dd = Math.abs(x(h.tS) - px); if (dd < bd) { bd = dd; best = i; } });
    setHover(best);
  };
  const hp = hover === null ? null : history[hover] ?? null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t.burnedOverTime} data-testid="game-burn-chart"
      onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ display: "block", touchAction: "pan-y" }}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={TAK.panelBorder} stroke-width={1} />
          <text x={L - 6} y={y(v) + 4} text-anchor="end" font-size={11} fill={TAK.textDim}>{v % 1 === 0 ? v : v.toFixed(1)}</text>
        </g>
      ))}
      {xTicks.map((s) => (
        <text key={s} x={x(s)} y={H - 8} text-anchor={x(s) > W - R - 18 ? "end" : x(s) < L + 18 ? "start" : "middle"} font-size={11} fill={TAK.textDim}>{clockAt(startClockMin, s)}</text>
      ))}
      <text x={L - 6} y={11} text-anchor="end" font-size={11} fill={TAK.textDim}>{t.hectares}</text>
      <path d={area} fill={GM.fire} fill-opacity={0.14} />
      <path d={path} fill="none" stroke={GM.fire} stroke-width={2} stroke-linejoin="round" stroke-linecap="round" />
      {hp && (
        <g pointer-events="none">
          <line x1={x(hp.tS)} x2={x(hp.tS)} y1={T} y2={H - B} stroke={TAK.textDim} stroke-width={1} stroke-dasharray="3 3" />
          <circle cx={x(hp.tS)} cy={y(hp.ha)} r={4.5} fill={GM.fire} stroke={TAK.panelRaised} stroke-width={2} />
          <g transform={`translate(${Math.min(x(hp.tS) + 8, W - R - 118)},${T + 4})`}>
            <rect width={112} height={36} rx={4} fill={TAK.panel} stroke={TAK.panelBorder} />
            <text x={8} y={15} font-size={11} fill={TAK.textDim}>{clockAt(startClockMin, hp.tS)}</text>
            <text x={8} y={30} font-size={13} font-weight={700} fill={TAK.text}>{hp.ha.toFixed(1)} {t.hectares}</text>
          </g>
        </g>
      )}
    </svg>
  );
}
