/**
 * The training incident's own panels (SPEC/08 (bp) §bp.5, SPEC/30 (bp) §bp.2): the intro, a section card, a live item's question
 * panel (under the live map, where the session's decision strip sits), an item's feedback, and S5's recording. Every word is
 * `TRAINING_TEXT`'s, the interface strings too (`ui`, read by `trainingUi`; review 27 Oct 2026: no string lives in a component). Texts
 * carry the glossary's marks in a public session (surface `training`, SPEC/35 (bp)). No key reaches a panel before its item's feedback.
 */

import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Lang } from "../../../i18n/lang.js";
import { TRAINING_TEXT } from "../../../i18n/training-texts.js";
import type { TrainingUiKey } from "../../../i18n/training-texts-types.js";
import type { Cell } from "../../../scenario/types.js";
import type { TrainingView } from "../../../session/training/host.js";
import type { TrainingItem, TrainingSectionId } from "../../../session/training/spec.js";
import { Glossed } from "../explain/Glossed.js";
import { useLang } from "../i18n.js";
import { TRAINING_COLOURS } from "../training-overlay.js";

/** An interface string of the training (`TRAINING_TEXT[lang].ui`), its placeholders ({n}, {of}, {s}, {t}) filled in. */
export function trainingUi(lang: Lang, key: TrainingUiKey, fill: Readonly<Record<string, string | number>> = {}): string {
  const raw = TRAINING_TEXT[lang].ui[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in fill ? String(fill[k]) : m));
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const AMBER = "#f4a261";
export const trainingButton = (disabled: boolean) => ({
  padding: "10px 22px", borderRadius: 6, fontSize: 14.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
  border: `1px solid ${AMBER}`, background: disabled ? "#2a2f34" : AMBER, color: disabled ? "#e8eaed" : "#1c1b19",
});
const para = { margin: 0, fontSize: 15, lineHeight: 1.6 } as const;

/** A full page: the intro, a section card, an S4 item's feedback, S5. */
function Page({ testId, children }: { readonly testId: string; readonly children: ComponentChildren }) {
  return (
    <div data-testid={testId} style={{ display: "flex", flex: 1, minHeight: 0, overflowY: "auto", alignItems: "safe center", justifyContent: "center", padding: "28px 24px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

/** One button, busy while its call is pending (a refused call frees it). */
export function useBusy(resetOn: unknown): [boolean, (run: () => Promise<unknown>) => void] {
  const [busy, setBusy] = useState(false);
  useEffect(() => setBusy(false), [resetOn]);
  return [busy, (run) => { if (busy) return; setBusy(true); void run().catch(() => setBusy(false)); }];
}

export function TrainingIntro({ onStart }: { readonly onStart: () => Promise<unknown> }) {
  const { lang } = useLang();
  const intro = TRAINING_TEXT[lang].intro;
  const [busy, act] = useBusy(null);
  return (
    <Page testId="training-intro">
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{intro.title}</h1>
      {intro.body.map((p, i) => <p key={i} style={para}><Glossed text={p} surface="training" /></p>)}
      <button type="button" data-testid="training-start" disabled={busy} onClick={() => act(onStart)} style={{ ...trainingButton(busy), alignSelf: "flex-end" }}>{intro.start}</button>
    </Page>
  );
}

export function TrainingSectionCard({ sectionId, onGo }: { readonly sectionId: TrainingSectionId; readonly onGo: () => Promise<unknown> }) {
  const { lang } = useLang();
  const s = TRAINING_TEXT[lang].section(sectionId);
  const [busy, act] = useBusy(sectionId);
  return (
    <Page testId={`training-section-${sectionId}`}>
      <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>{s.title}</h1>
      {s.body.map((p, i) => <p key={i} style={para}><Glossed text={p} surface="training" /></p>)}
      <button type="button" data-testid="training-section-go" disabled={busy} onClick={() => act(onGo)} style={{ ...trainingButton(busy), alignSelf: "flex-end" }}>{s.go}</button>
    </Page>
  );
}

/** A live item's question under the map: its stem; its options, or the point hint; "Vastaa" once an option or a mark is chosen. */
export function TrainingQuestionPanel({ item, choice, onChoose, marked, onAnswer, busy }: {
  readonly item: TrainingItem; readonly choice: string | null; readonly onChoose: (id: string) => void;
  readonly marked: boolean; readonly onAnswer: () => void; readonly busy: boolean;
}) {
  const { lang } = useLang();
  const text = TRAINING_TEXT[lang].item(item.id);
  const ready = item.answer === "point" ? marked : choice !== null;
  return (
    <section data-testid="training-question" aria-labelledby="training-stem" style={{ padding: "12px 16px", borderTop: `3px solid ${AMBER}`, background: "#262a30", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
      <p id="training-stem" style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}><Glossed text={text.stem} surface="training" /></p>
      {item.answer === "choice" ? (
        <div role="radiogroup" aria-labelledby="training-stem" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6 }}>
          {item.options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} data-testid={`training-option-${o.id}`} onClick={() => !busy && onChoose(o.id)}
              style={{ textAlign: "left", padding: "8px 10px", borderRadius: 6, fontSize: 13.5, color: "#e8eaed", cursor: "pointer", border: `1px solid ${choice === o.id ? AMBER : "#3a3f44"}`, background: choice === o.id ? "#3a2c1f" : "#20242a" }}>
              <Glossed text={text.options[o.id] ?? o.id} surface="training" />
            </button>
          ))}
        </div>
      ) : (
        <div data-testid="training-mark-hint" style={{ fontSize: 13.5, opacity: 0.85 }}>{trainingUi(lang, marked ? "marked" : "markHint")}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!ready && item.answer === "choice" && <span style={{ fontSize: 12.5, opacity: 0.7 }}>{trainingUi(lang, "chooseFirst")}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="training-answer" disabled={!ready || busy} onClick={onAnswer} style={trainingButton(!ready || busy)}>{trainingUi(lang, "answer")}</button>
      </div>
    </section>
  );
}

/**
 * The memory item's exposure: what to remember ("Muista, missä yksikkö EK53 on.", `ui.memoryExposure`; review 27 Oct 2026, finding 6:
 * the stem, which asks to mark the place on the blank map, comes with the blank map) and how long the unit stays on the map.
 */
export function TrainingStudyPanel({ secondsLeft }: { readonly secondsLeft: number }) {
  const { lang } = useLang();
  return (
    <section data-testid="training-study" role="status" style={{ padding: "12px 16px", borderTop: `3px solid ${AMBER}`, background: "#262a30", display: "flex", gap: 16, alignItems: "baseline", flexShrink: 0 }}>
      <p data-testid="training-study-text" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}><Glossed text={trainingUi(lang, "memoryExposure")} surface="training" /></p>
      <span style={{ marginLeft: "auto", fontSize: 14, color: AMBER, fontVariantNumeric: "tabular-nums" }}>{trainingUi(lang, "studyLeft", { s: secondsLeft })}</span>
    </section>
  );
}

/**
 * An item's feedback (after every item, right or wrong): a choice item's options with the right one marked and the participant's own;
 * the feedback's lines (the answer and the right one, the source, one or two sentences; the figures filled in from the build); then
 * "Seuraava", or "Valmis" on the last item. `page`: an S4 item without a map is a full page; otherwise it sits under the map.
 */
export function TrainingFeedbackPanel({ view, item, last, onLeave, page }: {
  readonly view: TrainingView; readonly item: TrainingItem; readonly last: boolean; readonly onLeave: () => Promise<unknown>; readonly page: boolean;
}) {
  const { lang } = useLang();
  const texts = TRAINING_TEXT[lang];
  const [busy, act] = useBusy(item.id);
  const lines = texts.feedback(item.id, { answer: view.answer, key: item.key, errorM: view.errorM, timedOut: view.timedOut, source: item.source, numbers: item.feedback.numbers, ...(item.lesson ? { lesson: item.lesson } : {}) });
  const chosen = view.answer && "choiceId" in view.answer ? view.answer.choiceId : null;
  const keyId = "optionId" in item.key ? item.key.optionId : null;
  const options = texts.item(item.id).options;
  const body = (
    <section data-testid="training-feedback" style={{ padding: page ? 16 : "12px 16px", borderTop: page ? "none" : `3px solid ${TRAINING_COLOURS.key}`, border: page ? "1px solid #33383e" : undefined, borderRadius: page ? 10 : 0, background: page ? "#1b1e22" : "#202a24", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, maxHeight: page ? undefined : "45%", overflowY: "auto" }}>
      {!page && <p style={{ margin: 0, fontSize: 14, fontWeight: 600, opacity: 0.85 }}><Glossed text={texts.item(item.id).stem} surface="training" /></p>}
      {item.answer === "choice" && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {item.options.map((o) => (
            <li key={o.id} data-testid={o.id === keyId ? "training-key-option" : undefined} style={{ fontSize: 13.5, display: "flex", gap: 8, color: o.id === keyId ? "#81c995" : "#e8eaed", fontWeight: o.id === keyId ? 700 : 400 }}>
              <span style={{ width: 16 }}>{o.id === keyId ? "✓" : ""}</span>
              <span>{options[o.id] ?? o.id}</span>
              {o.id === chosen && <span style={{ opacity: 0.75, fontWeight: 400 }}>· {trainingUi(lang, "yourAnswer")}</span>}
            </li>
          ))}
        </ul>
      )}
      {view.timedOut && chosen === null && <p style={{ margin: 0, fontSize: 13.5, color: AMBER }}>{trainingUi(lang, "noAnswer")}</p>}
      {lines.map((l, i) => <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}><Glossed text={l} surface="training" /></p>)}
      <div style={{ display: "flex" }}>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="training-next" disabled={busy} onClick={() => act(onLeave)} style={trainingButton(busy)}>{trainingUi(lang, last ? "done" : "next")}</button>
      </div>
    </section>
  );
  return page ? <Page testId="training-feedback-page">{body}</Page> : body;
}

/**
 * S5 (SPEC/30 (bp)): the cell's recorded demonstration — Haku's in the Haku cell, the guide's in the Thinker cells — two examples, the
 * second a limitation case, each followed by its shared line; the button ("Valmis") enabled after `demoMinDwellMs` (10 s). Recorded:
 * nothing is sent. `capEnded`: the cap ended the items (review 27 Oct 2026, finding 4), and the page says so first (`ui.capEnded`).
 */
export function TrainingDemoPage({ cell, secondsLeft, onLeave, capEnded = false }: { readonly cell: Cell; readonly secondsLeft: number; readonly onLeave: () => Promise<unknown>; readonly capEnded?: boolean }) {
  const { lang } = useLang();
  const texts = TRAINING_TEXT[lang];
  const demo = texts.demo(cell);
  const [busy, act] = useBusy(null);
  const waiting = secondsLeft > 0;
  return (
    <Page testId={`training-demo-${cell === "radio" ? "haku" : "guide"}`}>
      {capEnded && <p data-testid="training-cap-ended" role="status" style={{ ...para, padding: "10px 14px", borderRadius: 8, border: `1px solid ${AMBER}`, color: AMBER }}>{trainingUi(lang, "capEnded")}</p>}
      <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>{demo.title}</h1>
      <p style={para}><Glossed text={demo.intro} surface="training" /></p>
      {demo.examples.map((ex, i) => (
        <section key={ex.id} data-testid={`training-demo-${ex.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 10, border: "1px solid #33383e", background: "#1b1e22" }}>
          {i === demo.examples.length - 1 && texts.demoLines.limitation && <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: AMBER }}>{texts.demoLines.limitation}</div>}
          <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#2a2f34", borderRadius: 8, padding: "6px 10px", fontSize: 13.5 }}>
            <span style={{ opacity: 0.6, fontSize: 11, marginRight: 6 }}>{trainingUi(lang, "question")}</span>{ex.question}
          </div>
          <div style={{ background: "#20242a", border: "1px solid #33383e", borderRadius: 8, padding: "8px 10px", fontSize: 13.5, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6 }}>{trainingUi(lang, "recorded")}</div>
            {ex.answer.map((a, k) => <div key={k}><Glossed text={a} surface="training" /></div>)}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}><Glossed text={ex.note} surface="training" /></p>
        </section>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {waiting && <span data-testid="training-demo-wait" style={{ fontSize: 13, opacity: 0.75 }}>{trainingUi(lang, "demoWait", { s: secondsLeft })}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="training-demo-done" disabled={waiting || busy} onClick={() => act(onLeave)} style={trainingButton(waiting || busy)}>{texts.demoLines.leave}</button>
      </div>
    </Page>
  );
}
