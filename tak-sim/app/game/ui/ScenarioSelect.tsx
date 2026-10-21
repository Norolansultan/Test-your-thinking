/**
 * Game mode, SPEC/34 §2: the start page — three tracks, in this order: the training course (recommended first; nothing
 * is locked), the decision tasks (each with its topic, title and done / best grade; a note while none exists yet) and
 * free play (one card per scenario: title, difficulty, a two-line pitch, the start clock and the number of units —
 * unchanged from SPEC/29). The instructions panel opens from the header.
 */

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { GameScenario } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { COURSE_MODULES } from "../course/index.js";
import { bestGrade, modulePassed, type GameProgress } from "../course/progress.js";
import type { DecisionTask } from "../tasks/contracts.js";
import { COURSE_TEXT } from "./course/course-text.js";
import { InstructionsOverlay } from "./course/Instructions.js";
import { GM, TAK } from "./styles.js";
import { clockAt, GAME_TEXT, inLang } from "./text.js";

const DIFF_COLOR: Readonly<Record<GameScenario["difficulty"], string>> = { easy: GM.ok, normal: TAK.accent, hard: GM.fire };

const trackHead = (title: string, note: string, extra?: ComponentChildren) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
      {extra}
    </div>
    <p style={{ margin: 0, color: TAK.textDim, fontSize: 13.5, maxWidth: 720 }}>{note}</p>
  </div>
);

export function ScenarioSelect({ lang, scenarios, tasks, progress, onChoose, onCourse, onTask, onBack }: {
  readonly lang: Lang;
  readonly scenarios: readonly GameScenario[];
  readonly tasks: readonly DecisionTask[];
  readonly progress: GameProgress;
  readonly onChoose: (s: GameScenario) => void;
  readonly onCourse: () => void;
  readonly onTask: (task: DecisionTask) => void;
  readonly onBack: () => void;
}) {
  const t = GAME_TEXT[lang];
  const c = COURSE_TEXT[lang];
  const [help, setHelp] = useState(false);
  const passed = COURSE_MODULES.filter((m) => modulePassed(progress, m.id)).length;
  return (
    <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "24px 16px 32px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" class="gm-btn" onClick={onBack} data-testid="game-back">← {t.back}</button>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{t.modeTitle}</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 700 }}>{t.selectTitle}</h1>
          </div>
          <button type="button" class="gm-btn" onClick={() => setHelp(true)} data-testid="game-instructions-open">{c.instructions}</button>
        </div>
        <p style={{ margin: 0, color: TAK.textDim, fontSize: 13.5, maxWidth: 720 }}>{t.selectNote}</p>

        <section data-testid="game-track-course" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: TAK.panelRaised, border: `1px solid ${TAK.accent}`, borderRadius: TAK.radius }}>
          {trackHead(`1. ${c.tracks.courseTitle}`, c.tracks.courseNote, <span class="gm-chip" style={{ borderColor: TAK.accent, color: TAK.accent }}>{c.tracks.recommended}</span>)}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", gap: 4 }} aria-hidden="true">
              {COURSE_MODULES.map((m) => <span key={m.id} title={inLang(lang, m.titleFi, m.titleEn)} style={{ width: 22, height: 8, borderRadius: 2, background: modulePassed(progress, m.id) ? GM.ok : TAK.panelBorder }} />)}
            </span>
            <span style={{ fontSize: 13, color: TAK.textDim }}>{c.tracks.modulesPassed(passed, COURSE_MODULES.length)}</span>
            <button type="button" class="gm-btn primary" onClick={onCourse} data-testid="game-open-course" style={{ marginLeft: "auto" }}>{passed > 0 ? c.tracks.resume : c.tracks.start} →</button>
          </div>
        </section>

        <section data-testid="game-track-tasks" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trackHead(`2. ${c.tracks.tasksTitle}`, c.tracks.tasksNote)}
          {tasks.length === 0 ? (
            <p data-testid="game-tasks-coming" style={{ margin: 0, padding: "12px 14px", fontSize: 13.5, background: TAK.row, border: `1px dashed ${TAK.panelBorder}`, borderRadius: TAK.radius }}>{c.tracks.tasksComing}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {tasks.map((task) => {
                const best = bestGrade(progress, task.id);
                return (
                  <button key={task.id} type="button" data-testid={`game-task-${task.id}`} onClick={() => onTask(task)}
                    style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left", padding: "12px 14px", borderRadius: TAK.radius, cursor: "pointer", color: TAK.text,
                      background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderTop: `3px solid ${best ? GM.ok : TAK.accent}` }}>
                    <span style={{ fontSize: 11.5, color: TAK.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.topic[task.topic]}</span>
                    <b style={{ fontSize: 15.5 }}>{inLang(lang, task.titleFi, task.titleEn)}</b>
                    <span style={{ fontSize: 12.5, color: best ? GM.ok : TAK.textDim }}>{best ? `${c.tracks.done} · ${c.tracks.best(best)}` : c.tracks.notDone}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section data-testid="game-track-free" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {trackHead(`3. ${c.tracks.freeTitle}`, c.tracks.freeNote)}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {scenarios.map((s) => {
              const pitch = inLang(lang, s.briefingFi, s.briefingEn).split("\n\n")[0] ?? "";
              return (
                <article key={s.id} data-testid={`game-scenario-${s.id}`}
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderTop: `3px solid ${DIFF_COLOR[s.difficulty]}`, borderRadius: TAK.radius }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, flex: 1 }}>{inLang(lang, s.titleFi, s.titleEn)}</h3>
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
        </section>
      </div>
      {help && <InstructionsOverlay lang={lang} onClose={() => setHelp(false)} />}
    </div>
  );
}
