/**
 * SPEC/35 §3 item 1: the primer ("Perehdytys") before the practice view, public sessions only (P1 shows it and logs
 * through the callbacks; the props are the contract's, `audience-context.ts`). Seven short pages (`primer-content.ts`),
 * each with a schematic illustration (`PrimerIllustrations.tsx`, never the study map) and one check question: a wrong
 * answer shows the explanation, then the question is asked again; every choice is reported (`onCheck`). Leaving a page
 * reports its dwell (`onPage`); after the last page's check, "done" ends the primer (`onDone`). The flow is
 * `primer-flow.ts` (pure). The same for both groups; generic, never about the scenario (§1). Dwell from the page's first
 * animation frame to the leaving click's timestamp: no clock read (I1).
 */

import { useEffect, useRef, useState } from "preact/hooks";
import type { PrimerScreenProps } from "../audience-context.js";
import { PRIMER_CONTENT, pageOfLabel } from "../explain/primer-content.js";
import { PrimerIllustration } from "../explain/PrimerIllustrations.js";
import { back, canGoOn, choose, dwellMs, initialPrimerState, isLastPage, next, questionPhase, retry, type PrimerState } from "../explain/primer-flow.js";

const button = (primary: boolean, disabled = false) => ({
  padding: "10px 18px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: disabled ? "default" : "pointer",
  border: primary ? "none" : "1px solid #3a3f44", background: disabled ? "#2a2f34" : primary ? "#f4a261" : "#20242a", color: disabled ? "#7a7f86" : primary ? "#1c1b19" : "#e8eaed",
});

export function PrimerScreen({ lang, onPage, onCheck, onDone }: PrimerScreenProps) {
  const content = PRIMER_CONTENT[lang];
  const pages = content.pages;
  const ui = content.ui;
  const [state, setState] = useState<PrimerState>(() => initialPrimerState(pages.length));
  const [finished, setFinished] = useState(false);
  const enteredAt = useRef<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const page = pages[state.page]!;
  const phase = questionPhase(state);
  const progress = state.progress[state.page]!;

  // The page's first frame on screen starts its dwell; the heading takes focus so a screen reader reads the new page.
  useEffect(() => {
    enteredAt.current = null;
    const frame = requestAnimationFrame((t) => { enteredAt.current = t; });
    heading.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, [state.page]);

  const leave = (e: Event, to: PrimerState | null) => {
    if (finished) return;
    onPage(page.id, dwellMs(enteredAt.current, e.timeStamp));
    if (to === null) { setFinished(true); onDone(); return; }
    setState(to);
  };
  const pick = (i: number) => {
    const r = choose(state, pages, i);
    if (!r) return;
    setState(r.state);
    onCheck(r.record.questionId, r.record.chosen, r.record.correct, r.record.attempt);
  };

  const q = page.question;
  const last = isLastPage(state);
  return (
    <div data-testid="primer-screen" style={{ minHeight: "100%", boxSizing: "border-box", background: "#0f1114", color: "#e8eaed", display: "flex", justifyContent: "center", padding: "20px 16px 32px", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.65 }}>{ui.title}</span>
          <span data-testid="primer-page-of" style={{ fontSize: 12, opacity: 0.65 }}>{pageOfLabel(ui, state.page + 1, pages.length)}</span>
          <span aria-hidden="true" style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
            {pages.map((p, i) => (
              <span key={p.id} style={{ width: 9, height: 9, borderRadius: "50%", background: i === state.page ? "#f4a261" : state.progress[i]!.answered ? "#8a9097" : "#33383e" }} />
            ))}
          </span>
        </div>
        <h1 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: 24, lineHeight: 1.25, outline: "none" }}>{page.title}</h1>
        <PrimerIllustration id={page.illustration} lang={lang} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 16, lineHeight: 1.55 }}>
          {page.body.map((para, i) => <p key={i} style={{ margin: 0 }}>{para}</p>)}
        </div>

        <section aria-labelledby={`primer-q-${page.id}`} data-testid="primer-check" style={{ background: "#1b1e22", border: "1px solid #33383e", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.65 }}>{ui.check}</div>
          <p id={`primer-q-${page.id}`} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{q.stem}</p>
          <div role="radiogroup" aria-labelledby={`primer-q-${page.id}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt, i) => {
              const chosenRight = progress.answered && i === q.correct;
              const chosenWrong = progress.wrong === i;
              return (
                <button key={i} type="button" role="radio" aria-checked={chosenRight || chosenWrong} data-testid={`primer-option-${i}`} disabled={phase !== "ask"} onClick={() => pick(i)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 8, fontSize: 15, color: "#e8eaed", cursor: phase === "ask" ? "pointer" : "default",
                    border: `1px solid ${chosenRight ? "#7bd88f" : chosenWrong ? "#f4a261" : "#3a3f44"}`, background: chosenRight ? "#1f3326" : chosenWrong ? "#3a2c1f" : "#20242a",
                  }}>
                  {opt}
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {phase === "answered" && <p data-testid="primer-right" style={{ margin: 0, color: "#a8e6b4", fontWeight: 600 }}>{ui.right}</p>}
            {phase === "explain" && (
              <div data-testid="primer-explanation" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <p style={{ margin: 0 }}><strong style={{ color: "#f6c26b" }}>{ui.wrong}</strong> {q.explanation}</p>
                <button type="button" data-testid="primer-try-again" onClick={() => setState(retry(state))} style={button(false)}>{ui.tryAgain}</button>
              </div>
            )}
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {state.page > 0 && <button type="button" data-testid="primer-back" onClick={(e) => leave(e, back(state))} style={button(false)}>{ui.back}</button>}
          <span style={{ flex: 1 }} />
          {!canGoOn(state) && <span style={{ fontSize: 13, opacity: 0.7 }}>{ui.answerFirst}</span>}
          <button type="button" data-testid={last ? "primer-done" : "primer-next"} disabled={!canGoOn(state) || finished} onClick={(e) => leave(e, next(state))} style={button(true, !canGoOn(state) || finished)}>
            {last ? ui.done : ui.next}
          </button>
        </div>
      </div>
    </div>
  );
}
