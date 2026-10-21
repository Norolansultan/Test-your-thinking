import { useState } from "preact/hooks";
import { buildDemoScenario } from "../../scenario/demo-scenario.js";
import { knownSessionStatus, ResumeGate, SessionLauncher } from "./SessionLauncher.js";
import type { Cell } from "../../scenario/types.js";
import { assignedByCode, conditionOfCell, sessionOverrideFromUrl, startChoiceFromUrl, STUDY_PARAM, type StartChoice } from "../../session/preview.js";
import { browserAssignDeps, obtainAssignment, storedCode } from "../../session/auto-assign.js";
import { sessionSettingFromUrl } from "../../session/public-session.js";
import { browserEnvironment, newSessionId } from "../../session/annotations.js";
import { AUTO_ASSIGN_TEXT, LINK_INACTIVE_BOTH } from "../../i18n/auto-assign-texts.js";
import { DEFAULT_LANG, isLang, LANGUAGES, type Lang } from "../../i18n/lang.js";
import { UI_TEXT } from "../../i18n/ui.js";
import { useDocumentLanguage } from "./i18n.js";
import { uiShellFromSearch } from "./tak/shell.js";
import { demoAudience, VersionSwitch } from "./VersionSwitch.js";

let cachedScenario: ReturnType<typeof buildDemoScenario> | null = null;
function getDemoScenario() {
  if (!cachedScenario) cachedScenario = buildDemoScenario();
  return cachedScenario;
}

/**
 * The last language chosen on this machine (a convenience only; the session logs the choice). Without
 * one, a study link (`?tuotanto`) opens in English — the study runs in English, and its start-page
 * messages (a link without a code, an unknown code) must reach the participant in it (final review,
 * 6 Oct 2026); a table code fixes the language anyway.
 */
export function storedLang(search: string = window.location.search): Lang {
  const fallback: Lang = new URLSearchParams(search).has(STUDY_PARAM) ? "en" : DEFAULT_LANG;
  try {
    const v = window.localStorage.getItem("session-language");
    return isLang(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The start page (phase B round 2, D1; SPEC/27 §2.2, 5 Oct 2026). In the study (`?tuotanto`) the cell
 * comes from the allocation table by participant code (`?koodi=`), which also fixes the language; a
 * study link without a code is the shared link (revision (af), 9 Oct 2026): pressing start asks the
 * hosted study server for the next code (`auto-assign.ts`), which this browser keeps; `?solu=` is
 * accepted there only with `?pilotti`. In a
 * demonstration `?solu=k4|m7|t2` (opaque codes, `preview.ts`) assigns the cell, or the page offers the
 * three. An assigned session shows one neutral start button, so the cell is never shown.
 */
export function App() {
  // SPEC/05 §9: an unfinished session on this machine is offered for resume (or its upload) first.
  return <ResumeGate scenario={getDemoScenario}>{() => <StartPage />}</ResumeGate>;
}

type ServerPhase = "idle" | "assigning" | "inactive" | "done";

function localStore() {
  try { return window.localStorage; } catch { return null; }
}

function StartPage() {
  const [cell, setCell] = useState<Cell | null>(null);
  const [chosenLang, setLang] = useState<Lang>(storedLang);
  // The shared study link (revision (af)): the server's code once issued, and the phase of the request.
  const [issued, setIssued] = useState<{ readonly choice: Extract<StartChoice, { kind: "assigned" }>; readonly sessionId: string | undefined } | null>(null);
  const [phase, setPhase] = useState<ServerPhase>("idle");
  const search = window.location.search;
  const inStudy = new URLSearchParams(search).has(STUDY_PARAM);
  const urlChoice = startChoiceFromUrl(search);
  const serverLink = urlChoice.kind === "server_assign";
  // A code this browser already holds for the shared link is used again (never a second draw).
  const held = serverLink ? storedCode(localStore()) : null;
  // SPEC/35 §2: `?yleiso` (the public-audience version) and `?laajuus=a` (phase A only); an unknown scope is refused.
  const setting = sessionSettingFromUrl(search);
  // The demonstration's version switch (`VersionSwitch.tsx`), set from `?yleiso`; never shown or applied under `?tuotanto`.
  const [publicVersion, setPublicVersion] = useState(() => !("invalid" in setting) && setting.audience === "public");
  const choice: StartChoice = "invalid" in setting ? { kind: "invalid", message: setting.invalid }
    : issued?.choice ?? (held ? assignedByCode(held.code, "server") ?? urlChoice : urlChoice);
  // A table code fixes the session language (the stratum); otherwise the participant chooses it.
  const fixedLang = choice.kind === "assigned" ? choice.language : null;
  const lang: Lang = fixedLang ?? chosenLang;
  useDocumentLanguage(lang);
  const t = UI_TEXT[lang];
  const choose = (v: string) => {
    if (!isLang(v)) return;
    setLang(v);
    try { window.localStorage.setItem("session-language", v); } catch { /* storage unavailable: the choice still holds for this session */ }
  };

  // The shared link's start (on the start page, outside the run loop: SPEC/05 I3).
  const startShared = async () => {
    setPhase("assigning");
    const got = await obtainAssignment(lang, browserAssignDeps(() => newSessionId(browserEnvironment().randomBytes)));
    const assigned = got.ok ? assignedByCode(got.code, "server") : null;
    if (!got.ok || !assigned) { setPhase("inactive"); return; }
    // The same browser and link again: a finished session is not run twice; a discarded one starts afresh under its code.
    const status = await knownSessionStatus(got.sessionId);
    if (status === "complete" || status === "uploaded") { setPhase("done"); return; }
    setIssued({ choice: assigned, sessionId: status === null ? got.sessionId : undefined });
    setCell(assigned.cell);
  };

  if (!cell) {
    return (
      <div lang={lang} style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontWeight: 600 }}>{t.startTitle}</h1>
          {choice.kind === "choose" && <p style={{ opacity: 0.7, maxWidth: 480 }}>{t.startNote}</p>}
        </div>
        {fixedLang === null && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
            {t.languageLabel}
            <select value={lang} onChange={(e) => choose((e.target as HTMLSelectElement).value)} style={selectStyle}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        )}
        {choice.kind === "choose" && !inStudy && <VersionSwitch lang={lang} publicVersion={publicVersion} onChange={setPublicVersion} />}
        {choice.kind === "choose" && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
            {/* The Search-only (radio) cell is hidden from the start screen (researcher, 9 Oct 2026); an
                assigned study link (`koodi`) still opens it. */}
            <button style={buttonStyle} onClick={() => setCell("reasoning_once")}>{t.conditionSubstitutive}</button>
            <button style={buttonStyle} onClick={() => setCell("reasoning_intent")}>{t.conditionIntent}</button>
          </div>
        )}
        {(choice.kind === "assigned" || choice.kind === "server_assign") && phase === "idle" && (
          <button style={buttonStyle} onClick={() => (serverLink ? void startShared() : choice.kind === "assigned" && setCell(choice.cell))}>{t.startAssigned}</button>
        )}
        {phase === "assigning" && <p role="status">{AUTO_ASSIGN_TEXT[lang].assigning}</p>}
        {phase === "inactive" && <p role="alert" style={{ maxWidth: 480, textAlign: "center" }}>{LINK_INACTIVE_BOTH.map((line) => <span key={line} style={{ display: "block" }}>{line}</span>)}</p>}
        {phase === "done" && <p role="alert" style={{ maxWidth: 480, textAlign: "center" }}>{AUTO_ASSIGN_TEXT[lang].alreadyDone}</p>}
        {choice.kind === "invalid" && <p role="alert" style={{ maxWidth: 480, textAlign: "center" }}>{choice.message}</p>}
      </div>
    );
  }

  // `?esikatselu=<s>` shortens every exploration phase for development (preview.ts); logged in the header.
  // The TAK shell is the default screen (SPEC/28 §5); `?klassinen` (or `?classic`) gives the classic layout; logged (`uiShell`).
  // `?tuotanto` is the study configuration: the freeze items' SA level (L1/L2) hidden, nothing skippable.
  // Without it (the demonstration) the views run on the same real times (6 Oct 2026; was a 30 s minimum),
  // the level is shown, and the presenter may skip the rest of a view or a freeze. The header logs all three
  // (`previewOverride`, `probeLevelsShown`, `viewSkipAllowed`), and the cell.
  // The study shell (5 Oct 2026, work package I): consent, preflight and the pre-session item before the
  // briefing; the questionnaire and the debrief after V14. A demonstration may override the preflight.
  const study = inStudy;
  const assigned = choice.kind === "assigned" ? choice : null;
  return (
    // The launcher annotates the header (session id, start time, browser, build, bundle hash) and opens
    // the session's IndexedDB store before the session starts (SPEC/05 §9, I5).
    <SessionLauncher
      scenario={getDemoScenario()} condition={conditionOfCell(cell)} cell={cell} previewOverride={sessionOverrideFromUrl(search)} language={lang}
      showProbeLevels={!study} allowTourSkip={!study}
      participantCode={assigned?.participantCode ?? undefined} assignment={assigned ? assigned.assignment : { source: "start_page" }}
      studyShell allowPreflightOverride={!study} allowViewSkip={!study} indexedSearch={!study} minWindowGuard={study} sessionId={issued?.sessionId}
      uiShell={uiShellFromSearch(search)} {...("invalid" in setting ? {} : setting)} {...demoAudience(publicVersion, study)}
    />
  );
}

const selectStyle = { padding: "8px 12px", fontSize: 15, borderRadius: 6, border: "1px solid #3a3f44", background: "#2a2f34", color: "#e8eaed" };

const buttonStyle = {
  padding: "14px 28px",
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #3a3f44",
  background: "#2a2f34",
  color: "#e8eaed",
  cursor: "pointer",
};
