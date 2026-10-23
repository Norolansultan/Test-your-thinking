/**
 * "Personal results after the study" (SPEC/36, 23 Oct 2026): every session's step after the post-session questionnaire and before
 * the debrief (and the profile when `?profiili=heti` shows it). The same page in both audiences and every cell: the explanation, an
 * optional email field, the explicit consent, and two equally prominent buttons, Send and Skip.
 *
 * The address goes straight from this screen to the study server (`sendResultsContact`, `POST /api/results-contact`); the session
 * is told only the outcome (`onDecide(true)` once the server has stored it, `onDecide(false)` for Skip or for continuing without a
 * server), so the address never enters the session or its log. Without a server (the demonstration's dev server, offline) the send
 * fails gracefully: the page says so and offers "try again" and "continue without results".
 *
 * The email field is the one free-text input outside the Search/Thinker question box, a documented exception in
 * `test/session/closed-items.spec.ts` (type="email", this step only).
 */

import { useState } from "preact/hooks";
import { RESULTS_OPTIN_TEXT } from "../../../i18n/results-texts.js";
import type { Lang } from "../../../i18n/lang.js";
import { browserResultsFetch, isValidEmail, MAX_EMAIL_LENGTH, normaliseEmail, sendResultsContact, type FetchLike } from "../../../session/results-contact.js";

const page = { display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "32px 16px", boxSizing: "border-box" } as const;
const column = { maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 14 } as const;
const para = { margin: 0, fontSize: 15, lineHeight: 1.6 } as const;
/** Send and Skip look the same (SPEC/36: skipping is as easy as sending). */
const choiceButton = (disabled: boolean) => ({
  padding: "12px 22px", minHeight: 44, borderRadius: 6, fontSize: 15, cursor: disabled ? "default" : "pointer", color: "#e8eaed",
  opacity: disabled ? 0.45 : 1, border: "1px solid #f4a261", background: "#3a3f44",
});

export type OptInPhase = "editing" | "sending" | "failed";

/** Send is enabled with a well-formed address and the consent ticked (and not while sending). */
export function canSend(email: string, consented: boolean, phase: OptInPhase): boolean {
  return consented && phase !== "sending" && isValidEmail(normaliseEmail(email));
}

export interface ResultsOptInScreenProps {
  readonly lang: Lang;
  readonly sessionId: string;
  /** The session's answer (`SessionOrchestrator.decideResultsOptIn`). */
  readonly onDecide: (optedIn: boolean) => Promise<void>;
  /** Tests pass their own; the browser's fetch by default. */
  readonly fetchFn?: FetchLike;
}

export function ResultsOptInScreen({ lang, sessionId, onDecide, fetchFn }: ResultsOptInScreenProps) {
  const t = RESULTS_OPTIN_TEXT[lang];
  const [email, setEmail] = useState("");
  const [consented, setConsented] = useState(false);
  const [phase, setPhase] = useState<OptInPhase>("editing");
  const [busy, setBusy] = useState(false);
  const shownInvalid = email.trim() !== "" && !isValidEmail(normaliseEmail(email));

  const decide = (optedIn: boolean) => {
    if (busy) return;
    setBusy(true);
    void onDecide(optedIn).catch(() => setBusy(false));
  };
  const send = async () => {
    if (!canSend(email, consented, phase) || busy) return;
    setPhase("sending");
    const outcome = await sendResultsContact({ sessionId, email: normaliseEmail(email), lang }, fetchFn ?? browserResultsFetch());
    if (outcome === "stored") decide(true);
    else setPhase("failed"); // no server, a refusal or a network error: say so; retry or continue without
  };

  return (
    <div style={page}>
      <main lang={lang} style={column} data-testid="results-optin" aria-labelledby="results-optin-title">
        <h1 id="results-optin-title" style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
        {t.paragraphs.map((p, i) => <p key={i} style={para}>{p}</p>)}
        <p role="note" style={{ ...para, padding: "8px 12px", border: "1px dashed #f4a261", color: "#f4a261", fontSize: 13 }}>{t.placeholderNote}</p>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
          {t.emailLabel}
          <input type="email" data-testid="results-email" autoComplete="email" inputMode="email" maxLength={MAX_EMAIL_LENGTH} value={email}
            aria-invalid={shownInvalid} onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            style={{ padding: "8px 10px", fontSize: 15, borderRadius: 6, border: `1px solid ${shownInvalid ? "#f4a261" : "#3a3f44"}`, background: "#20242a", color: "#e8eaed", maxWidth: 420 }} />
        </label>
        {shownInvalid && <p role="status" style={{ ...para, fontSize: 13, color: "#f4a261" }}>{t.invalidEmail}</p>}
        <label style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start" }}>
          <input type="checkbox" data-testid="results-consent" checked={consented} onChange={(e) => setConsented((e.target as HTMLInputElement).checked)} /> {t.consentCheckbox}
        </label>
        {phase === "failed" && <p role="alert" data-testid="results-failed" style={{ ...para, padding: "10px 12px", borderLeft: "3px solid #f4a261", background: "#24282c" }}>{t.failed}</p>}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          {phase === "failed"
            ? <button type="button" data-testid="results-skip" style={choiceButton(busy)} disabled={busy} onClick={() => decide(false)}>{t.continueWithout}</button>
            : <button type="button" data-testid="results-skip" style={choiceButton(busy || phase === "sending")} disabled={busy || phase === "sending"} onClick={() => decide(false)}>{t.skip}</button>}
          <button type="button" data-testid="results-send" style={choiceButton(!canSend(email, consented, phase) || busy)} disabled={!canSend(email, consented, phase) || busy}
            onClick={() => void send()}>{phase === "sending" ? t.sending : phase === "failed" ? t.retry : t.send}</button>
        </div>
      </main>
    </div>
  );
}
