/**
 * The session's start and end around `SessionView` (SPEC/05 §9; 5 Oct 2026):
 *
 * - {@link ResumeGate} — on load, looks in IndexedDB for a session left `running` (offers to resume
 *   it: the interrupted view restarts from its start) or `complete` but not uploaded (offers the
 *   upload again and the export). Otherwise shows the start page.
 * - {@link SessionLauncher} — creates a new session's header annotations (session id, wall-clock
 *   start, browser, viewport, build, bundle hash) here, outside the run loop, opens the session's
 *   durable IndexedDB record store and registers the session when its first record is written; or
 *   reopens an interrupted session's store for a resume.
 *
 * If the browser cannot store the session (a private window, blocked storage), a study session does
 * not start; a demonstration runs in memory and offers the export at the end.
 */

import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import { SessionView } from "./components/SessionView.js";
import { buttonStyle, downloadSessionFile, SessionDataPanel } from "./components/SessionEnd.js";
import type { SessionPersistence } from "./useSession.js";
import { LangContext, useDocumentLanguage, useLang } from "./i18n.js";
import { browserEnvironment, sessionAnnotations, wallNowMs } from "../../session/annotations.js";
import { STUDY_PARAM, type PreviewOverride, type SessionAssignment } from "../../session/preview.js";
import type { Cell, ScenarioContract } from "../../scenario/types.js";
import type { UiShell } from "../../session/header.js";
import type { Audience, SessionScope } from "../../session/public-session.js";
import type { Lang } from "../../i18n/lang.js";
import { InMemoryLogSink, type LogRecord } from "../../telemetry/log.js";
import { openSessionSink, registeringSink, SessionRegistry, type SessionEntry, type SessionStatus } from "../../telemetry/session-registry.js";
import { uploadFinished, type EndState } from "../../telemetry/session-end.js";
import { uploadSession } from "../../telemetry/session-upload.js";

let registryPromise: Promise<SessionRegistry> | null = null;
function registry(): Promise<SessionRegistry> {
  if (!registryPromise) registryPromise = SessionRegistry.open();
  return registryPromise;
}

/** This browser's registry status of a session, or null when it has none (or no storage). */
export async function knownSessionStatus(sessionId: string): Promise<SessionStatus | null> {
  try { return (await (await registry()).get(sessionId))?.status ?? null; } catch { return null; }
}

function isDemo(search: string): boolean { return !new URLSearchParams(search).has(STUDY_PARAM); }

type LaunchProps = {
  readonly scenario: ScenarioContract; readonly condition: "directed" | "substitutive"; readonly cell: Cell; readonly previewOverride: PreviewOverride | null;
  readonly language: Lang; readonly showProbeLevels: boolean; readonly allowTourSkip: boolean;
  readonly participantCode?: string | undefined; readonly assignment?: SessionAssignment | undefined;
  readonly studyShell?: boolean; readonly allowPreflightOverride?: boolean; readonly allowViewSkip?: boolean;
  /** The minimum-window cover: on in the study, off in a demonstration (SessionView). */
  readonly minWindowGuard?: boolean;
  /** The original index-based search as a third tab (SPEC/25 revision (aq)); shown in no session since 24 Oct 2026 (researcher, SPEC/28 §5): both callers pass false. */
  readonly indexedSearch?: boolean;
  /** The session id fixed before the start (the shared study link's, `auto-assign.ts`); otherwise a fresh one. */
  readonly sessionId?: string | undefined;
  /** The screen layout (SPEC/28 §5; `?klassinen` gives the classic one); annotated into the header as `uiShell`. */
  readonly uiShell: UiShell;
  /** SPEC/35 §2: the public-audience version (`?yleiso`) and the session's scope (`?laajuus=a`); logged in the header. */
  readonly audience?: Audience | undefined; readonly scope?: SessionScope | undefined;
  /** SPEC/36: the commander profile on screen after the results step (`?profiili=heti`); logged in the header. */
  readonly immediateProfile?: boolean | undefined;
};

function Centered({ children }: { readonly children: ComponentChildren }) {
  return <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 24, textAlign: "center" }}>{children}</div>;
}

/** A new session: annotations, the durable sink, then the session itself. */
export function SessionLauncher(props: LaunchProps) {
  const search = window.location.search;
  const demo = isDemo(search);
  const [persistence, setPersistence] = useState<SessionPersistence | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      // The shell is chosen on the start page from the URL, outside the run loop, and only annotated (`header.ts`).
      const annotations = { ...sessionAnnotations(props.scenario, browserEnvironment(), props.sessionId), uiShell: props.uiShell };
      try {
        const reg = await registry();
        const sink = await openSessionSink(annotations.sessionId);
        const setStatus = (status: SessionStatus) => reg.setStatus(annotations.sessionId, status);
        setPersistence({ sink: registeringSink(sink, (header) => reg.register(header, search)), annotations, setStatus, demo });
      } catch (e) {
        console.error("session storage unavailable", e);
        if (demo) setPersistence({ sink: new InMemoryLogSink(), annotations, demo });
        else setFailed(true);
      }
    })();
  }, []);

  if (failed) return <Text k="storageUnavailable" lang={props.language} alert />;
  if (!persistence) return <Text k="preparing" lang={props.language} />;
  return <SessionView {...props} guidedTour persistence={persistence} />;
}

function Text({ k, lang, alert = false }: { readonly k: "preparing" | "storageUnavailable"; readonly lang: Lang; readonly alert?: boolean }) {
  return <LangContext.Provider value={lang}><TextBody k={k} alert={alert} /></LangContext.Provider>;
}
function TextBody({ k, alert }: { readonly k: "preparing" | "storageUnavailable"; readonly alert: boolean }) {
  const { t } = useLang();
  return <Centered><p role={alert ? "alert" : "status"} style={{ maxWidth: 520, lineHeight: 1.5 }}>{t.sessionData[k]}</p></Centered>;
}

type Gate =
  | { readonly kind: "checking" }
  | { readonly kind: "none" }
  | { readonly kind: "offer"; readonly entry: SessionEntry }
  | { readonly kind: "resuming"; readonly entry: SessionEntry; readonly persistence: SessionPersistence };

/** Shows the start page unless an unfinished session on this machine is to be resumed or uploaded first. */
export function ResumeGate({ scenario, children }: { readonly scenario: () => ScenarioContract; readonly children: () => JSX.Element }) {
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  useEffect(() => {
    void (async () => {
      try {
        const entry = await (await registry()).findUnfinished();
        setGate(entry ? { kind: "offer", entry } : { kind: "none" });
      } catch {
        setGate({ kind: "none" }); // no storage: nothing to resume (the launcher reports it)
      }
    })();
  }, []);

  if (gate.kind === "checking") return <Centered>{null}</Centered>;
  if (gate.kind === "none") return children();
  const { entry } = gate;
  const header = entry.header;
  const lang: Lang = header.language ?? "fi";
  const demo = isDemo(entry.search);

  if (gate.kind === "resuming") {
    return (
      <SessionView
        scenario={scenario()} condition={header.condition as "directed" | "substitutive"} cell={header.cell}
        previewOverride={header.previewOverride ?? null} language={lang} showProbeLevels={header.probeLevelsShown ?? true}
        guidedTour={header.guidedTour ?? false} allowTourSkip={demo} participantCode={header.participantCode}
        assignment={header.assignment as SessionAssignment | undefined} persistence={gate.persistence}
        studyShell allowPreflightOverride={demo} allowViewSkip={demo} indexedSearch={false} minWindowGuard={!demo}
        uiShell={header.uiShell ?? "classic"}
      />
    );
  }

  const setStatus = async (status: SessionStatus) => (await registry()).setStatus(entry.sessionId, status);
  const resume = async () => {
    const sink = await openSessionSink(entry.sessionId);
    const records: readonly LogRecord[] = await sink.readAll();
    const last = records.length > 0 ? records[records.length - 1]!.tWallOffsetMs : 0;
    const startedMs = Date.parse(header.startedAtIso);
    const interruptedForMs = Number.isFinite(startedMs) ? Math.max(0, wallNowMs() - (startedMs + last)) : 0;
    setGate({ kind: "resuming", entry, persistence: { sink, resume: { header, records, interruptedForMs }, setStatus, demo } });
  };
  const discard = async () => { await setStatus("abandoned"); setGate({ kind: "none" }); };

  return (
    <LangContext.Provider value={lang}>
      {entry.status === "running"
        ? <ResumeOffer startedAtIso={header.startedAtIso} onContinue={() => void resume()} onDiscard={() => void discard()} />
        : <PendingUpload entry={entry} demo={demo} setStatus={setStatus} onDone={() => setGate({ kind: "none" })} />}
    </LangContext.Provider>
  );
}

/** The resume offer's primary action (revision (ah)): continuing is the expected path, so it carries the weight. */
const primaryButtonStyle = { ...buttonStyle, background: "#8ab4f8", border: "1px solid #8ab4f8", color: "#0f1114", fontWeight: 600 };
/** Starting over abandons the unfinished session: a quieter, secondary button, and a confirmation step. */
const secondaryButtonStyle = { ...buttonStyle, background: "transparent", fontSize: 13, padding: "10px 18px" };

/**
 * Revision (ah), 9 Oct 2026: "Start a new session" abandons the running session in one click, so it is
 * the secondary button and asks for a confirmation first; "Continue the session" is the primary one.
 */
function ResumeOffer({ startedAtIso, onContinue, onDiscard }: { readonly startedAtIso: string; readonly onContinue: () => void; readonly onDiscard: () => void }) {
  const { t, lang } = useLang();
  useDocumentLanguage(lang);
  const [confirming, setConfirming] = useState(false);
  const d = t.sessionData;
  const shown = startedAtIso.replace("T", " ").slice(0, 16) + " UTC";
  return (
    <Centered>
      <h1 style={{ margin: 0, fontWeight: 600 }}>{d.resumeTitle}</h1>
      <p style={{ maxWidth: 520, margin: 0, lineHeight: 1.5 }}>{d.resumeBody(shown)}</p>
      <p style={{ maxWidth: 520, margin: 0, lineHeight: 1.5, opacity: 0.8 }}>{d.resumeNote}</p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="resume-discard-confirm" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <p id="resume-discard-confirm" style={{ maxWidth: 520, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>{d.resumeDiscardConfirm}</p>
          <div style={{ display: "flex", gap: 16 }}>
            <button data-testid="resume-discard-back" style={primaryButtonStyle} onClick={() => setConfirming(false)} autoFocus>{d.resumeDiscardBack}</button>
            <button data-testid="resume-discard-yes" style={secondaryButtonStyle} onClick={onDiscard}>{d.resumeDiscardYes}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button data-testid="resume-continue" style={primaryButtonStyle} onClick={onContinue} autoFocus>{d.resumeContinue}</button>
          <button data-testid="resume-discard" style={secondaryButtonStyle} onClick={() => setConfirming(true)}>{d.resumeDiscard}</button>
        </div>
      )}
    </Centered>
  );
}

function PendingUpload({ entry, demo, setStatus, onDone }: { readonly entry: SessionEntry; readonly demo: boolean; readonly setStatus: (s: SessionStatus) => Promise<void>; readonly onDone: () => void }) {
  const { t, lang } = useLang();
  useDocumentLanguage(lang);
  const [state, setState] = useState<EndState>({ phase: "uploading", offerDownload: demo });
  const records = async () => (await openSessionSink(entry.sessionId)).readAll();
  const deps = { engineState: () => "COMPLETE" as const, header: entry.header, records, upload: uploadSession, setStatus, demo };
  useEffect(() => { void uploadFinished(deps, setState); }, []);
  return (
    <Centered>
      <h1 style={{ margin: 0, fontWeight: 600 }}>{t.sessionData.pendingUploadTitle}</h1>
      <p style={{ maxWidth: 520, margin: 0, lineHeight: 1.5 }}>{t.sessionData.pendingUploadBody}</p>
      <SessionDataPanel state={state} onRetry={() => void uploadFinished(deps, setState)} onDownload={() => void records().then((r) => downloadSessionFile(entry.header, r, true))} />
      {state.phase !== "uploading" && <button style={buttonStyle} onClick={onDone}>{t.sessionData.startNew}</button>}
    </Centered>
  );
}
