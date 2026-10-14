/**
 * Game mode: the briefing — the situation, the objectives, the weather through the game, the units and when they
 * arrive, and a static map of the ignition and the settlement to protect.
 */

import type { GameScenario, GameWorld } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { describeWeatherEn, describeWeatherFi } from "../weather/weather.js";
import { PreviewMap } from "./PreviewMap.js";
import { windPoint } from "./scenario-info.js";
import { TAK } from "./styles.js";
import { clockAt, GAME_TEXT, inLang } from "./text.js";
import { unitSymbolSvg } from "./markers.js";

const h3 = { margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" as const, color: TAK.accent };
const box = { background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderRadius: TAK.radius, padding: 14 };

export function Briefing({ lang, scenario, world, onStart, onBack }: {
  readonly lang: Lang; readonly scenario: GameScenario; readonly world: GameWorld; readonly onStart: () => void; readonly onBack: () => void;
}) {
  const t = GAME_TEXT[lang];
  const w0 = scenario.weather[0];
  const units = [...scenario.units].map((u, i) => ({ u, i })).sort((a, b) => a.u.arriveAtS - b.u.arriveAtS || a.i - b.i).map((x) => x.u);
  return (
    <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "20px 16px 28px" }} data-testid="game-briefing">
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" class="gm-btn" onClick={onBack}>← {t.back}</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{t.briefing} · {t.difficulty[scenario.difficulty]}</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 26 }}>{inLang(lang, scenario.titleFi, scenario.titleEn)} <span style={{ fontFamily: TAK.mono, fontSize: 18, color: TAK.textDim }}>{clockAt(scenario.startClockMin, 0)}–{clockAt(scenario.startClockMin, scenario.endAtS)}</span></h1>
          </div>
          <button type="button" class="gm-btn primary" onClick={onStart} data-testid="game-start" style={{ fontSize: 15, padding: "10px 22px" }}>{t.start} ▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, alignItems: "stretch" }}>
          <section style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
            {inLang(lang, scenario.briefingFi, scenario.briefingEn).split("\n\n").map((p, i) => <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{p}</p>)}
          </section>
          <section style={{ ...box, padding: 6, minHeight: 300, display: "flex" }}>
            <PreviewMap lang={lang} scenario={scenario} world={world} />
          </section>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <section style={box}>
            <h3 style={h3}>{t.objectives}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              {scenario.objectives.map((o, i) => <li key={i}>{t.objective(o, world, scenario.startClockMin)}</li>)}
            </ul>
          </section>
          <section style={box}>
            <h3 style={h3}>{t.weather}</h3>
            {w0 && <p style={{ margin: "0 0 8px", fontSize: 13.5 }}>{lang === "fi" ? describeWeatherFi(w0, true) : describeWeatherEn(w0, true)}.</p>}
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, fontFamily: TAK.mono, width: "100%" }}>
              <tbody>
                {scenario.weather.slice(0, 8).map((k, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${TAK.panelBorder}` }}>
                    <td style={{ padding: "3px 6px 3px 0", color: TAK.textDim }}>{clockAt(scenario.startClockMin, k.atS)}</td>
                    <td style={{ padding: "3px 6px" }}>{windPoint(k, lang)} {Math.round(k.windMs)} ({Math.round(k.gustMs)}) m/s</td>
                    <td style={{ padding: "3px 6px" }}>{Math.round(k.tempC)} °C</td>
                    <td style={{ padding: "3px 0 3px 6px" }}>{Math.round(k.rh)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section style={box}>
            <h3 style={h3}>{t.units}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {units.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 26, height: 20, flex: "none" }} dangerouslySetInnerHTML={{ __html: unitSymbolSvg(u.kind) }} />
                  <b style={{ fontFamily: TAK.mono, minWidth: 48 }}>{u.id}</b>
                  <span style={{ flex: 1, color: TAK.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.kind[u.kind]}</span>
                  <span style={{ fontFamily: TAK.mono, fontSize: 12, color: u.arriveAtS <= 0 ? TAK.accent : TAK.textDim }}>{u.arriveAtS <= 0 ? t.onScene : clockAt(scenario.startClockMin, u.arriveAtS)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
