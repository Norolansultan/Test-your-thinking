/**
 * Game mode, SPEC/34 §3: one course module — its pages (next / back), then its exercise (start or skip; the exercise
 * itself runs on the task screen, routed by `GameApp`), then its check questions, then "passed".
 */

import { useState } from "preact/hooks";
import type { GameWorld } from "../../contracts.js";
import type { Lang } from "../../../i18n/lang.js";
import type { Grade } from "../../course/progress.js";
import type { CourseModule, DecisionTask } from "../../tasks/contracts.js";
import { GM, TAK } from "../styles.js";
import { inLang } from "../text.js";
import { CheckQuestions } from "./CheckQuestions.js";
import { CourseMap } from "./CourseMap.js";
import { COURSE_TEXT } from "./course-text.js";

export type ModuleStep = { readonly kind: "page"; readonly index: number } | { readonly kind: "exercise" } | { readonly kind: "checks" } | { readonly kind: "passed" };

/** A page body: paragraphs split on blank lines; lines starting "- " are bullets. */
export function PageBody({ text }: { readonly text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => {
        const lines = para.split("\n");
        const bullets = lines.filter((l) => l.startsWith("- "));
        const prose = lines.filter((l) => !l.startsWith("- ")).join(" ");
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prose && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{prose}</p>}
            {bullets.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 22, fontSize: 15, lineHeight: 1.55 }}>
                {bullets.map((b) => <li key={b}>{b.slice(2)}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

export function ModuleScreen({ lang, module, world, startAt, exerciseBest, onExercise, onPassed, onNextModule, onBack }: {
  readonly lang: Lang;
  readonly module: CourseModule;
  readonly world: GameWorld;
  readonly startAt: ModuleStep;
  readonly exerciseBest: Grade | null;
  readonly onExercise: (task: DecisionTask) => void;
  readonly onPassed: () => void;
  readonly onNextModule: (() => void) | null;
  readonly onBack: () => void;
}) {
  const t = COURSE_TEXT[lang];
  const [step, setStep] = useState<ModuleStep>(startAt);
  const pages = module.pages;
  const afterPages = (): ModuleStep => (module.exercise ? { kind: "exercise" } : { kind: "checks" });
  return (
    <div data-testid={`course-module-${module.id}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} aria-hidden="true">
        {pages.map((_, i) => <span key={i} style={{ width: 26, height: 4, borderRadius: 2, background: step.kind === "page" && step.index >= i || step.kind !== "page" ? TAK.accent : TAK.panelBorder }} />)}
        {module.exercise && <span style={{ width: 26, height: 4, borderRadius: 2, background: step.kind === "exercise" || step.kind === "checks" || step.kind === "passed" ? GM.fire : TAK.panelBorder }} />}
        <span style={{ width: 26, height: 4, borderRadius: 2, background: step.kind === "checks" || step.kind === "passed" ? GM.ok : TAK.panelBorder }} />
      </div>

      {step.kind === "page" && (() => {
        const p = pages[step.index]!;
        return (
          <article data-testid="course-page" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: TAK.textDim }}>{t.module.page(step.index + 1, pages.length)}</div>
            <h2 style={{ margin: 0, fontSize: 21 }}>{inLang(lang, p.headingFi, p.headingEn)}</h2>
            <PageBody text={inLang(lang, p.bodyFi, p.bodyEn)} />
            {p.view && <CourseMap lang={lang} world={world} centre={p.view.centre} widthM={p.view.widthM} label={t.module.mapView} />}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" class="gm-btn" data-testid="course-prev"
                onClick={() => (step.index === 0 ? onBack() : setStep({ kind: "page", index: step.index - 1 }))}>
                ← {step.index === 0 ? t.module.toCourse : t.module.prev}
              </button>
              <button type="button" class="gm-btn primary" data-testid="course-next"
                onClick={() => setStep(step.index + 1 < pages.length ? { kind: "page", index: step.index + 1 } : afterPages())}>
                {t.module.next} →
              </button>
            </div>
          </article>
        );
      })()}

      {step.kind === "exercise" && module.exercise && (
        <article data-testid="course-exercise" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: GM.fire, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.module.exerciseTitle}</div>
          <h2 style={{ margin: 0, fontSize: 21 }}>{inLang(lang, module.exercise.titleFi, module.exercise.titleEn)}</h2>
          <p style={{ margin: 0, fontSize: 13.5, color: TAK.textDim }}>{t.module.exerciseIntro}</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, padding: "10px 12px", background: TAK.row, borderLeft: `3px solid ${GM.fire}`, borderRadius: TAK.radius }}>
            {inLang(lang, module.exercise.promptFi, module.exercise.promptEn)}
          </p>
          {exerciseBest && <p style={{ margin: 0, fontSize: 13, color: GM.ok }}>{t.module.exerciseBest(exerciseBest)}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" class="gm-btn" onClick={() => setStep({ kind: "page", index: pages.length - 1 })}>← {t.module.prev}</button>
            <button type="button" class="gm-btn primary" data-testid="course-start-exercise" onClick={() => onExercise(module.exercise!)}>{t.module.startExercise} →</button>
            <button type="button" class="gm-btn" data-testid="course-skip-exercise" onClick={() => setStep({ kind: "checks" })}>{t.module.skipExercise}</button>
          </div>
        </article>
      )}

      {step.kind === "checks" && <CheckQuestions lang={lang} questions={module.checks} onPassed={() => { onPassed(); setStep({ kind: "passed" }); }} />}

      {step.kind === "passed" && (
        <article data-testid="course-passed" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 21, color: GM.ok }}>✓ {t.module.passedTitle}</h2>
          <p style={{ margin: 0, fontSize: 14 }}>{t.module.passedNote}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" class="gm-btn" onClick={onBack}>← {t.module.toCourse}</button>
            {onNextModule && <button type="button" class="gm-btn primary" data-testid="course-next-module" onClick={onNextModule}>{t.module.nextModule} →</button>}
          </div>
        </article>
      )}
    </div>
  );
}
