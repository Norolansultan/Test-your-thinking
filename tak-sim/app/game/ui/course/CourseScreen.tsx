/**
 * Game mode, SPEC/34 §3: the training course — the module list with each module's progress, or one module open
 * (`ModuleScreen`). The instructions panel opens from the header.
 */

import { useState } from "preact/hooks";
import type { GameWorld } from "../../contracts.js";
import type { Lang } from "../../../i18n/lang.js";
import { COURSE_MODULES } from "../../course/index.js";
import { bestGrade, modulePassed, type GameProgress } from "../../course/progress.js";
import type { CourseModule, DecisionTask } from "../../tasks/contracts.js";
import { GM, TAK } from "../styles.js";
import { GAME_TEXT, inLang } from "../text.js";
import { COURSE_TEXT } from "./course-text.js";
import { InstructionsOverlay } from "./Instructions.js";
import { ModuleScreen, type ModuleStep } from "./ModuleScreen.js";

export function CourseScreen({ lang, world, progress, open, onOpen, onExercise, onModulePassed, onBack }: {
  readonly lang: Lang;
  readonly world: GameWorld;
  readonly progress: GameProgress;
  /** The open module and where in it, or null for the list. */
  readonly open: { readonly module: CourseModule; readonly startAt: ModuleStep; readonly run: number } | null;
  readonly onOpen: (module: CourseModule | null) => void;
  readonly onExercise: (module: CourseModule, task: DecisionTask) => void;
  readonly onModulePassed: (module: CourseModule) => void;
  readonly onBack: () => void;
}) {
  const t = COURSE_TEXT[lang];
  const g = GAME_TEXT[lang];
  const [help, setHelp] = useState(false);
  const passed = COURSE_MODULES.filter((m) => modulePassed(progress, m.id)).length;
  const nextOf = (m: CourseModule): CourseModule | null => COURSE_MODULES[COURSE_MODULES.indexOf(m) + 1] ?? null;
  return (
    <div class="gm-scroll" style={{ flex: 1, minHeight: 0, padding: "24px 16px 32px" }} data-testid="course-screen">
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" class="gm-btn" data-testid="course-back" onClick={() => (open ? onOpen(null) : onBack())}>← {g.back}</button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: TAK.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{t.course.title}</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 700 }}>{open ? inLang(lang, open.module.titleFi, open.module.titleEn) : t.tracks.modulesPassed(passed, COURSE_MODULES.length)}</h1>
          </div>
          <button type="button" class="gm-btn" data-testid="course-instructions" onClick={() => setHelp(true)}>{t.instructions}</button>
        </div>
        {open ? (
          <ModuleScreen key={`${open.module.id}-${open.run}`} lang={lang} module={open.module} world={world} startAt={open.startAt}
            exerciseBest={open.module.exercise ? bestGrade(progress, open.module.exercise.id) : null}
            onExercise={(task) => onExercise(open.module, task)}
            onPassed={() => onModulePassed(open.module)}
            onNextModule={nextOf(open.module) ? () => onOpen(nextOf(open.module)) : null}
            onBack={() => onOpen(null)} />
        ) : (
          <>
            <p style={{ margin: 0, color: TAK.textDim, fontSize: 13.5, maxWidth: 680 }}>{t.course.intro}</p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {COURSE_MODULES.map((m, i) => {
                const done = modulePassed(progress, m.id);
                return (
                  <li key={m.id}>
                    <button type="button" data-testid={`course-open-${m.id}`} onClick={() => onOpen(m)}
                      style={{ width: "100%", display: "flex", gap: 14, alignItems: "center", textAlign: "left", padding: "12px 14px", borderRadius: TAK.radius, cursor: "pointer",
                        color: TAK.text, background: TAK.panelRaised, border: `1px solid ${TAK.panelBorder}`, borderLeft: `4px solid ${done ? GM.ok : TAK.accent}` }}>
                      <span style={{ fontFamily: TAK.mono, fontSize: 18, fontWeight: 700, color: done ? GM.ok : TAK.accent, width: 24 }}>{done ? "✓" : i + 1}</span>
                      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        <b style={{ fontSize: 16 }}>{inLang(lang, m.titleFi, m.titleEn)}</b>
                        <span style={{ fontSize: 12.5, color: TAK.textDim }}>
                          {t.topic[m.topic]} · {t.course.pages(m.pages.length)}{m.exercise ? ` · ${t.course.withExercise}` : ""}
                        </span>
                      </span>
                      {done && <span class="gm-chip" style={{ borderColor: GM.ok, color: GM.ok }}>{t.course.passed}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      {help && <InstructionsOverlay lang={lang} onClose={() => setHelp(false)} />}
    </div>
  );
}
