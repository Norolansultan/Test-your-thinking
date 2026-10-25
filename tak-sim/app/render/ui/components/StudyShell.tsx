/**
 * The study shell's screens (work package I, 5 Oct 2026; `SessionOptions.studyShell`): consent, the
 * AI literacy questionnaire (SNAIL, revision (ac), 9 Oct 2026), the preflight and its refusal, the questionnaires, the debrief. Full-screen pages like the briefing
 * (`IntroScreen`). The texts are in `app/i18n/study-texts.ts`, all DRAFT; the consent text is a
 * placeholder for the ethics board and says so on screen. SPEC/35 (21 Oct 2026): a public session's consent, questionnaire
 * items and debrief come from `app/i18n/public-texts.ts`, and its primer and commander profile are shown here too. SPEC/36 (23 Oct
 * 2026): every session's results step (`ResultsOptInScreen`), after the post-session questionnaire.
 */

import { useEffect, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { itemShown, type QuestionnaireItem, type QuestionnaireValue } from "../../../session/questionnaire.js";
import { STUDY_TEXT } from "../../../i18n/study-texts.js";
import { studyTextFor } from "../../../i18n/public-texts.js";
import type { Lang } from "../../../i18n/lang.js";
import type { LogRecord } from "../../../telemetry/log.js";
import { gatherPreflightEnv } from "../preflight-env.js";
import { useLang } from "../i18n.js";
import { PrimerScreen } from "./PrimerScreen.js";
import { ProfileScreen } from "./ProfileScreen.js";
import { ResultsOptInScreen } from "./ResultsOptInScreen.js";
import { MapTrainingScreen } from "./MapTrainingScreen.js";

const page = { display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "32px 24px", boxSizing: "border-box" } as const;
const column = { maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 14 } as const;
const para = { margin: 0, fontSize: 15, lineHeight: 1.6 } as const;
const button = (primary: boolean, disabled = false) => ({
  padding: "10px 20px", borderRadius: 6, fontSize: 14, cursor: disabled ? "default" : "pointer", color: "#e8eaed", opacity: disabled ? 0.45 : 1,
  border: `1px solid ${primary ? "#f4a261" : "#3a3f44"}`, background: primary ? "#3a3f44" : "#2a2f34",
});

export function StudyShell({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  switch (snapshot.step) {
    case "consent": return <ConsentScreen orchestrator={orchestrator} />;
    case "consent_declined": return <DeclinedScreen />;
    case "ai_literacy": return <AiLiteracyScreen snapshot={snapshot} orchestrator={orchestrator} />;
    case "preflight":
    case "preflight_refused": return <PreflightScreen snapshot={snapshot} orchestrator={orchestrator} />;
    case "questionnaire": return <QuestionnaireScreen snapshot={snapshot} orchestrator={orchestrator} />;
    case "debrief": return <DebriefScreen snapshot={snapshot} orchestrator={orchestrator} />;
    case "primer": return <PrimerStep orchestrator={orchestrator} />;
    case "profile": return <ProfileStep orchestrator={orchestrator} />;
    case "results_optin": return <ResultsOptInStep orchestrator={orchestrator} />;
    case "map_pretest": return <MapTrainingScreen snapshot={snapshot} orchestrator={orchestrator} />; // the map training (25 Oct 2026; was the pretest, c.2)
    default: return null;
  }
}

/** The steps the shell draws (full screen); SPEC/35: a public session's primer and commander profile too; SPEC/36: the results step. */
export const SHELL_STEPS: ReadonlySet<SessionSnapshot["step"]> = new Set(["consent", "consent_declined", "ai_literacy", "preflight", "preflight_refused", "questionnaire", "debrief", "primer", "profile", "results_optin", "map_pretest"]);

/** The shell's texts for this session (SPEC/35: the public consent, questionnaire items and debrief in a public session). */
function textOf(lang: Lang, orchestrator: SessionOrchestrator) {
  return studyTextFor(lang, { audience: orchestrator.audience, scope: orchestrator.scope });
}

/** SPEC/35 §3 item 1: the primer (work package P2's screen); its pages and checks are logged as they happen. */
function PrimerStep({ orchestrator }: { readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  return (
    <PrimerScreen lang={lang}
      onPage={(pageId, dwellMs) => void orchestrator.primerPage(pageId, dwellMs).catch(() => undefined)}
      onCheck={(questionId, chosen, correct, attempt) => void orchestrator.primerCheck(questionId, chosen, correct, attempt).catch(() => undefined)}
      onDone={() => void orchestrator.finishPrimer().catch(() => undefined)} />
  );
}

/** SPEC/35 §4: the commander profile (work package P3's screen), read from the session's records so far (`profile_shown` is durable). */
function ProfileStep({ orchestrator }: { readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const [records, setRecords] = useState<readonly LogRecord[] | null>(null);
  useEffect(() => { void orchestrator.logRecords().then(setRecords); }, []);
  if (!records) return null;
  return <ProfileScreen lang={lang} records={records} onDone={() => void orchestrator.finishProfile().catch(() => undefined)} />;
}

/** SPEC/36: the results step; the address goes from the screen to the server, the session learns only the outcome. */
function ResultsOptInStep({ orchestrator }: { readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  return <ResultsOptInScreen lang={lang} sessionId={orchestrator.logHeader.sessionId} onDecide={(optedIn) => orchestrator.decideResultsOptIn(optedIn)} />;
}

function ConsentScreen({ orchestrator }: { readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const c = textOf(lang, orchestrator).consent;
  const [agreed, setAgreed] = useState(false);
  const [attested, setAttested] = useState(false);
  return (
    <div style={page}>
      <div style={column} data-testid="consent">
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{c.title}</h1>
        <p role="note" style={{ ...para, padding: "8px 12px", border: "1px dashed #f4a261", color: "#f4a261", fontSize: 13 }}>{c.placeholderBanner}</p>
        {c.paragraphs.map((p, i) => <p key={i} style={para}>{p}</p>)}
        <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed((e.target as HTMLInputElement).checked)} /> {c.consentCheckbox}
        </label>
        <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start" }}>
          <input type="checkbox" checked={attested} onChange={(e) => setAttested((e.target as HTMLInputElement).checked)} /> {c.attestCheckbox}
        </label>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button style={button(false)} onClick={() => void orchestrator.decideConsent(false, false).catch(() => undefined)}>{c.decline}</button>
          <button style={button(true, !agreed)} disabled={!agreed} onClick={() => void orchestrator.decideConsent(true, attested).catch(() => undefined)}>{c.accept}</button>
        </div>
      </div>
    </div>
  );
}

function DeclinedScreen() {
  const { lang } = useLang();
  const c = STUDY_TEXT[lang].consent;
  return (
    <div style={page}>
      <div style={column}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{c.declinedTitle}</h1>
        <p style={para}>{c.declinedBody}</p>
      </div>
    </div>
  );
}

/** Checks on mount and on "check again"; the orchestrator logs a change only. */
function PreflightScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const p = STUDY_TEXT[lang].preflight;
  const pf = snapshot.preflight!;
  const refused = snapshot.step === "preflight_refused";
  const [busy, setBusy] = useState(false);

  const check = async (override = false) => {
    if (busy) return;
    setBusy(true);
    try { await orchestrator.submitPreflight(await gatherPreflightEnv(pf.proxyNeeded), override); } catch { /* the step moved on */ } finally { setBusy(false); }
  };

  useEffect(() => {
    if (refused) return;
    void check();
  }, [refused]);

  const outcome = pf.outcome;
  return (
    <div style={page}>
      <div style={column} data-testid="preflight">
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{outcome && !outcome.passed ? p.refusedTitle : p.title}</h1>
        {!outcome && <p style={para}>{p.checking}</p>}
        {outcome && !outcome.passed && (
          <>
            <p style={para}>{p.refusedIntro}</p>
            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {outcome.failures.map((f) => (
                <li key={f} style={{ fontSize: 15, lineHeight: 1.5 }}>
                  <strong>{p.failures[f].title}</strong><br />{p.failures[f].fix}
                </li>
              ))}
            </ul>
            <p style={{ ...para, opacity: 0.8 }}>{outcome.hard ? p.hardNote : p.softNote}</p>
            {!refused && (
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                {pf.overrideAllowed && <button style={button(false)} onClick={() => void check(true)}>{p.overrideDemo}</button>}
                <button style={button(true, busy)} disabled={busy} onClick={() => void check()}>{p.recheck}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuestionnaireScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang, tr } = useLang();
  const q = textOf(lang, orchestrator).questionnaire;
  const view = snapshot.questionnaire!;
  const [answers, setAnswers] = useState<Record<string, QuestionnaireValue>>({});
  const set = (id: string, v: QuestionnaireValue) => setAnswers((a) => {
    const next: Record<string, QuestionnaireValue> = { ...a, [id]: v };
    // A "which mattered most" answer goes when its option is unticked in the source item.
    for (const item of view.items) if (item.kind === "pick_from" && item.from === id && !(Array.isArray(v) && v.includes(next[item.id] as string))) delete next[item.id];
    return next;
  });
  const pickedOf = (fromId: string) => {
    const src = view.items.find((i) => i.id === fromId);
    const ticked = answers[fromId];
    if (!src || src.kind !== "multi" || !Array.isArray(ticked)) return [];
    return src.options.filter((o) => ticked.includes(o.id)).map((o) => ({ id: o.id, label: q.items[fromId]?.options?.[o.id] ?? o.id }));
  };
  // Revision (ai): an item whose condition is not met is not shown, and its answer (if any, from before) is not sent.
  const shown = view.items.filter((item) => itemShown(item, answers));
  const submit = () => {
    const sent: Record<string, QuestionnaireValue> = {};
    for (const item of shown) if (answers[item.id] !== undefined) sent[item.id] = answers[item.id]!;
    void orchestrator.submitQuestionnaire(sent).catch(() => undefined);
  };
  let lastSection = "";
  return (
    <div style={page}>
      <div style={column} data-testid={`questionnaire-${view.id}`}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{view.id === "pre" ? q.preTitle : q.postTitle}</h1>
        <p style={para}>{view.id === "pre" ? q.preIntro : q.postIntro} {q.optionalNote}</p>
        {shown.map((item) => {
          const heading = view.id === "post" && item.section !== lastSection ? q.sections[item.section] : null;
          lastSection = item.section;
          return (
            <div key={item.id}>
              {heading && <h2 style={{ margin: "12px 0 6px", fontSize: 16, fontWeight: 600, opacity: 0.85 }}>{heading}</h2>}
              <ItemField item={item} text={q.items[item.id]!} value={answers[item.id] ?? null} onChange={(v) => set(item.id, v)}
                retention={view.retentionOptions.map((o) => ({ id: o.id, label: tr(o.labelFi) }))}
                picked={item.kind === "pick_from" ? pickedOf(item.from) : []} />
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={button(true)} onClick={submit}>{q.submit}</button>
        </div>
      </div>
    </div>
  );
}

function ItemField({ item, text, value, onChange, retention, picked }: {
  readonly item: QuestionnaireItem; readonly text: { readonly prompt: string; readonly options?: Readonly<Record<string, string>>; readonly low?: string; readonly high?: string };
  readonly value: QuestionnaireValue; readonly onChange: (v: QuestionnaireValue) => void; readonly retention: readonly { readonly id: string; readonly label: string }[];
  /** `pick_from`: the source item's ticked options, labelled. */
  readonly picked: readonly { readonly id: string; readonly label: string }[];
}) {
  const prompt = <p style={{ margin: "0 0 6px", fontSize: 14.5, lineHeight: 1.5 }}>{text.prompt}</p>;
  const single = Array.isArray(value) ? null : (value as string | number | null);
  const choice = (options: readonly { id: string; label: string }[]) => <ChoiceButtons options={options} value={single} onChange={onChange} />;
  switch (item.kind) {
    case "choice": return <div>{prompt}{choice(item.options.map((id) => ({ id, label: text.options?.[id] ?? id })))}</div>;
    case "retention": return <div>{prompt}{choice(retention)}</div>;
    case "pick_from": return <div>{prompt}{choice(picked)}</div>;
    case "multi": {
      const ticked = Array.isArray(value) ? value : [];
      const toggle = (id: string) => {
        if (ticked.includes(id)) return onChange(ticked.filter((x) => x !== id));
        // An exclusive option clears the others; any other option clears it.
        onChange(id === item.exclusive ? [id] : [...ticked.filter((x) => x !== item.exclusive), id]);
      };
      return <div>{prompt}<CheckButtons options={item.options.map((o) => ({ id: o.id, label: text.options?.[o.id] ?? o.id }))} ticked={ticked} onToggle={toggle} /></div>;
    }
    case "scale": return <div>{prompt}<ScaleButtons min={item.min} max={item.max} step={item.step} low={text.low} high={text.high} value={single} onChange={onChange} /></div>;
    case "number":
      return (
        <div>{prompt}
          <input type="number" min={item.min} max={item.max} step={1} value={single ?? ""}
            onInput={(e) => { const v = (e.target as HTMLInputElement).value; const n = Number.parseInt(v, 10); onChange(v === "" || Number.isNaN(n) ? null : Math.max(item.min, Math.min(item.max, n))); }}
            style={{ width: 90, padding: "6px 8px", fontSize: 14, borderRadius: 6, border: "1px solid #3a3f44", background: "#20242a", color: "#e8eaed" }} />
        </div>
      );
  }
}

/** A multi-select item's options as toggle buttons (revision (ai)), one per line. */
function CheckButtons({ options, ticked, onToggle }: {
  readonly options: readonly { readonly id: string; readonly label: string }[]; readonly ticked: readonly string[]; readonly onToggle: (id: string) => void;
}) {
  return (
    <div role="group" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((o) => {
        const on = ticked.includes(o.id);
        return (
          <button key={o.id} role="checkbox" aria-checked={on} onClick={() => onToggle(o.id)}
            style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#e8eaed", textAlign: "left", border: `1px solid ${on ? "#f4a261" : "#3a3f44"}`, background: on ? "#3a3f44" : "#20242a" }}>
            {on ? "☑" : "☐"} {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A choice item's options as radio buttons (the questionnaires and the AI literacy test). */
function ChoiceButtons({ options, value, onChange, column = false }: {
  readonly options: readonly { readonly id: string; readonly label: string }[]; readonly value: string | number | null; readonly onChange: (v: string) => void; readonly column?: boolean;
}) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: column ? "column" : "row", flexWrap: column ? "nowrap" : "wrap", gap: 6 }}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#e8eaed", textAlign: "left", border: `1px solid ${value === o.id ? "#f4a261" : "#3a3f44"}`, background: value === o.id ? "#3a3f44" : "#20242a" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A rating scale's points as buttons with its two anchors (the questionnaires and the AI literacy questionnaire); `step`: every step-th point (revision (bf): 0–100 in tens). */
function ScaleButtons({ min, max, step = 1, low, high, value, onChange }: {
  readonly min: number; readonly max: number; readonly step?: number | undefined; readonly low?: string | undefined; readonly high?: string | undefined;
  readonly value: string | number | null; readonly onChange: (v: number) => void;
}) {
  const points = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {low && <span style={{ fontSize: 12, opacity: 0.7, marginRight: 4 }}>{low}</span>}
      {points.map((n) => (
        <button key={n} aria-pressed={value === n} onClick={() => onChange(n)}
          style={{ minWidth: 28, padding: "4px 6px", borderRadius: 4, fontSize: 12, cursor: "pointer", color: "#e8eaed", border: `1px solid ${value === n ? "#f4a261" : "#3a3f44"}`, background: value === n ? "#3a3f44" : "#20242a" }}>{n}</button>
      ))}
      {high && <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{high}</span>}
    </div>
  );
}

/**
 * The AI literacy questionnaire (SNAIL, revision (ac), `ai-literacy.ts`): four "I can…" statements
 * per screen, each rated 1–7 (logged at once), the 5-minute countdown, "Next" once every statement
 * on the screen is rated, and "Skip the test" with one inline confirmation, on every screen.
 */
function AiLiteracyScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const t = STUDY_TEXT[lang].aiLiteracy;
  const view = snapshot.aiLiteracy;
  const [secondsLeft, setSecondsLeft] = useState(() => orchestrator.aiLiteracySecondsLeft());
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(orchestrator.aiLiteracySecondsLeft()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => setBusy(false), [view?.page]);
  if (!view) return null; // ended: the preflight follows

  const act = (run: () => Promise<void>) => { if (busy) return; setBusy(true); void run().catch(() => setBusy(false)); };
  const canNext = view.items.every((i) => view.ratings[i.id] !== null);
  const mm = Math.floor(secondsLeft / 60), ss = secondsLeft % 60;
  const demo = snapshot.showProbeLevels; // outside the study (`?tuotanto` hides the levels)
  const banner = view.itemsPending ? t.pendingBanner : t.draftTranslationBanner;
  return (
    <div style={page}>
      <div style={column} data-testid="ai-literacy">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
          <span role="timer" aria-live="off" style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: secondsLeft <= 30 ? "#f4a261" : "#e8eaed" }}>
            {t.timeLeft} {mm}:{String(ss).padStart(2, "0")}
          </span>
        </div>
        {demo && banner && <p role="note" style={{ ...para, padding: "8px 12px", border: "1px dashed #f4a261", color: "#f4a261", fontSize: 13 }}>{banner}</p>}
        <p style={{ ...para, fontSize: 13.5, opacity: 0.8 }}>{t.intro}</p>
        <div style={{ fontSize: 12.5, opacity: 0.7 }}>{t.pageLabel} {view.page + 1} / {view.pageCount}</div>
        <p style={{ ...para, fontWeight: 600 }}>{t.stem}</p>
        {view.items.map((item) => (
          <div key={item.id}>
            <p style={{ margin: "0 0 6px", fontSize: 14.5, lineHeight: 1.5 }}>… {item.text}</p>
            <ScaleButtons min={view.scale.min} max={view.scale.max} low={t.low} high={t.high} value={view.ratings[item.id] ?? null}
              onChange={(n) => void orchestrator.answerAiLiteracy(item.id, n).catch(() => undefined)} />
          </div>
        ))}
        {confirmSkip ? (
          // Scrolled into view when it opens: on a 529 px tall window its wrapped "Yes, skip" button fell below the fold (browser check, 10 Oct 2026).
          <div role="alertdialog" aria-label={t.skip} ref={(el) => el?.scrollIntoView({ block: "nearest" })} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14 }}>{t.skipConfirm}</span>
            <button style={button(false)} onClick={() => setConfirmSkip(false)}>{t.skipCancel}</button>
            <button style={button(true, busy)} disabled={busy} onClick={() => act(() => orchestrator.skipAiLiteracy())}>{t.skipYes}</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button style={button(false)} onClick={() => setConfirmSkip(true)}>{t.skip}</button>
            <button style={button(true, !canNext || busy)} disabled={!canNext || busy} onClick={() => act(() => orchestrator.nextAiLiteracyPage())}>{t.next}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DebriefScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const d = textOf(lang, orchestrator).debrief;
  return (
    <div style={page}>
      <div style={column} data-testid="debrief">
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{d.title}</h1>
        {d.paragraphs(snapshot.debrief!.cell).map((p, i) => <p key={i} style={para}>{p}</p>)}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={button(true)} onClick={() => void orchestrator.finishDebrief().catch(() => undefined)}>{d.finish}</button>
        </div>
      </div>
    </div>
  );
}

