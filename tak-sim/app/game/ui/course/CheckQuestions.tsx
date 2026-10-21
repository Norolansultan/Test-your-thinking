/**
 * Game mode, SPEC/34 §3: the check-question view — the question, its options, then right or wrong with the
 * explanation; a wrong answer asks the same question again (`course/check-flow.ts`). Calls `onPassed` once every
 * question has been answered right.
 */

import { useState } from "preact/hooks";
import type { Lang } from "../../../i18n/lang.js";
import { checksPassed, nextQuestion, pickOption, startChecks } from "../../course/check-flow.js";
import type { CheckQuestion } from "../../tasks/contracts.js";
import { GM, TAK } from "../styles.js";
import { inLang } from "../text.js";
import { COURSE_TEXT } from "./course-text.js";

export function CheckQuestions({ lang, questions, onPassed }: { readonly lang: Lang; readonly questions: readonly CheckQuestion[]; readonly onPassed: () => void }) {
  const t = COURSE_TEXT[lang].module;
  const [s, setS] = useState(() => startChecks(questions.length));
  const q = questions[s.index];
  if (q === undefined) return null;
  const answered = s.picked !== null;
  const right = answered && s.picked === q.correct;
  const done = right && checksPassed(s);
  return (
    <section data-testid="course-checks" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t.checksTitle}</h2>
        <span style={{ fontSize: 12.5, color: TAK.textDim }}>{t.question(s.index + 1, questions.length)}</span>
        <span aria-hidden="true" style={{ marginLeft: "auto", letterSpacing: 3, color: GM.ok }}>{s.right.map((r) => (r ? "●" : "○")).join("")}</span>
      </div>
      <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.45, fontWeight: 600 }} data-testid="course-check-prompt">{inLang(lang, q.promptFi, q.promptEn)}</p>
      <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {q.options.map((o, i) => {
          const chosen = s.picked === i;
          const border = chosen ? (right ? GM.ok : GM.danger) : TAK.panelBorder;
          return (
            <button key={i} type="button" role="radio" aria-checked={chosen} disabled={answered} data-testid={`course-option-${i}`}
              onClick={() => setS(pickOption(s, questions, i))}
              style={{ textAlign: "left", minHeight: 44, padding: "10px 12px", borderRadius: TAK.radius, border: `2px solid ${border}`, background: chosen ? TAK.rowHover : TAK.row,
                color: TAK.text, fontSize: 14, cursor: answered ? "default" : "pointer", opacity: answered && !chosen ? 0.6 : 1 }}>
              {inLang(lang, o.textFi, o.textEn)}
            </button>
          );
        })}
      </div>
      {answered && (
        <div role="status" data-testid="course-check-feedback" style={{ padding: "10px 12px", borderRadius: TAK.radius, background: TAK.panelRaised, borderLeft: `4px solid ${right ? GM.ok : GM.danger}` }}>
          <b style={{ color: right ? GM.ok : GM.danger }}>{right ? t.correct : t.wrong}</b>{" "}
          <span style={{ lineHeight: 1.45 }}>{inLang(lang, q.explanationFi, q.explanationEn)}</span>
        </div>
      )}
      {answered && (
        <div>
          {done
            ? <button type="button" class="gm-btn primary" data-testid="course-checks-done" onClick={onPassed}>{t.finish} →</button>
            : <button type="button" class="gm-btn primary" data-testid="course-check-next" onClick={() => setS(nextQuestion(s, questions))}>{right ? t.nextQuestion : t.tryAgain} →</button>}
        </div>
      )}
    </section>
  );
}
