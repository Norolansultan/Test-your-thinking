/**
 * Game mode: the scenario select — one card per scenario: title, difficulty, a two-line pitch, the start clock and the
 * number of units.
 */

import type { GameScenario } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { GM, TAK } from "./styles.js";
import { clockAt, GAME_TEXT, inLang } from "./text.js";

const DIFF_COLOR: Readonly<Record<GameScenario["difficulty"], string>> = { easy: GM.ok, normal: TAK.accent, hard: GM.fire };

export function ScenarioSelect({ lang, scenarios, onChoose, onBack }: {
  readonly lang: Lang;
  readonly scenarios: readonly GameScenario[];
  readonly onChoose: (s: GameScenario) => void;
  readonly onBack: () => void;
}) {
  const t = GAME_TEXT[lang];
  return (
    <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "24px 16px 32px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" class="gm-btn" onClick={onBack} data-testid="game-back">← {t.back}</button>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{t.modeTitle}</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 700 }}>{t.selectTitle}</h1>
          </div>
        </div>
        <p style={{ margin: 0, color: TAK.textDim, fontSize: 13.5, maxWidth: 720 }}>{t.selectNote}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {scenarios.map((s) => {
            const pitch = inLang(lang, s.briefingFi, s.briefingEn).split("\n\n")[0] ?? "";
            return (
              <article key={s.id} data-testid={`game-scenario-${s.id}`}
                style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderTop: `3px solid ${DIFF_COLOR[s.difficulty]}`, borderRadius: TAK.radius }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, flex: 1 }}>{inLang(lang, s.titleFi, s.titleEn)}</h2>
                  <span class="gm-chip" style={{ borderColor: DIFF_COLOR[s.difficulty], color: DIFF_COLOR[s.difficulty] }}>{t.difficulty[s.difficulty]}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: TAK.text, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.9em" }}>{pitch}</p>
                <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: TAK.textDim }}>
                  <span>{t.startsAt} <b style={{ fontFamily: TAK.mono, color: TAK.text }}>{clockAt(s.startClockMin, 0)}</b></span>
                  <span>{t.unitsCount(s.units.length)}</span>
                  <span>{s.objectives.length} {t.objectives.toLowerCase()}</span>
                </div>
                <button type="button" class="gm-btn primary" onClick={() => onChoose(s)} data-testid={`game-choose-${s.id}`} style={{ alignSelf: "flex-start", marginTop: "auto" }}>{t.choose} →</button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
