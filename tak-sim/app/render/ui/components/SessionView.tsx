import { useEffect, useState } from "preact/hooks";
import { useSession, type SessionPersistence } from "../useSession.js";
import { SessionEnd } from "./SessionEnd.js";
import { StatusStrip } from "./StatusStrip.js";
import { MapView } from "./MapView.js";
import { RightPanel } from "./RightPanel.js";
import { FreezeScreen } from "./FreezeScreen.js";
import { JudgementPanel } from "./JudgementPanel.js";
import { EMPTY_PLAN_DRAFT, heldPlanDraft, type HeldPlanDraft } from "./DecisionPanels.js";
import { IntroScreen } from "./IntroScreen.js";
import { IntroVideoScreen } from "./IntroVideoScreen.js";
import { GuidedTour } from "./GuidedTour.js";
import { SpamCard } from "./SpamCard.js";
import { WindowSizeGuard } from "./WindowSizeGuard.js";
import { VisibleProbeCard } from "./VisibleProbeCard.js";
import { SHELL_STEPS, StudyShell } from "./StudyShell.js";
import { CAPABILITY_MATRIX } from "../../../routing/capability-matrix.js";
import type { Cell, ScenarioContract } from "../../../scenario/types.js";
import type { PreviewOverride, SessionAssignment } from "../../../session/preview.js";
import type { Lang } from "../../../i18n/lang.js";
import { LangContext, useDocumentLanguage, useLang } from "../i18n.js";
import { statusOnStep, warnBeforeUnload } from "../../../telemetry/session-registry.js";
import { attachCheckpoints } from "../../../telemetry/session-checkpoint.js";
import type { UiShell } from "../../../session/header.js";
import { TakSessionLayout } from "../tak/TakSessionLayout.js";

export function SessionView({ scenario, condition, cell, previewOverride, language, showProbeLevels = true, guidedTour = false, allowTourSkip = false, participantCode, assignment, persistence, studyShell = false, allowPreflightOverride = false, allowViewSkip = false, indexedSearch = false, uiShell = "tak" }: {
  readonly scenario: ScenarioContract; readonly condition: "directed" | "substitutive"; readonly previewOverride: PreviewOverride | null; readonly language: Lang; readonly showProbeLevels?: boolean;
  /** The guided tour at VP and the tool reminder at V1 (SPEC/15 r.11); `allowTourSkip` in demonstration only. */
  readonly guidedTour?: boolean; readonly allowTourSkip?: boolean;
  /** The cell (phase B round 2, D1; `?solu=` or the demonstration start page); logged in the header. */
  readonly cell?: Cell;
  /** The allocation table's participant code and where the cell came from (SPEC/27 §2.2); logged in the header. */
  readonly participantCode?: string | undefined; readonly assignment?: SessionAssignment | undefined;
  /** The durable sink, annotations and resume (`SessionLauncher.tsx`); absent: in memory. */
  readonly persistence?: SessionPersistence | undefined;
  /** The study shell (consent, preflight, questionnaires, debrief; 5 Oct 2026); the preflight override in demonstration only. */
  readonly studyShell?: boolean; readonly allowPreflightOverride?: boolean;
  /** Demonstration only (6 Oct 2026): the presenter may skip the rest of a view or a freeze. */
  readonly allowViewSkip?: boolean;
  /** Demonstration only (11 Oct 2026): the index-based search tab (never under ?tuotanto). */
  readonly indexedSearch?: boolean;
  /**
   * The screen layout (SPEC/28 §5): the TAK shell (`TakSessionLayout`, the default of this build) or the classic layout of
   * SPEC/06 (`?klassinen`). Logged in the header (`uiShell`, through the launcher's annotations); the session is the same.
   */
  readonly uiShell?: UiShell;
}) {
  useDocumentLanguage(language);
  return (
    <LangContext.Provider value={language}>
      <SessionBody scenario={scenario} condition={condition} cell={cell} previewOverride={previewOverride} language={language} showProbeLevels={showProbeLevels} guidedTour={guidedTour} allowTourSkip={allowTourSkip} participantCode={participantCode} assignment={assignment} persistence={persistence} studyShell={studyShell} allowPreflightOverride={allowPreflightOverride} allowViewSkip={allowViewSkip} indexedSearch={indexedSearch} uiShell={uiShell} />
    </LangContext.Provider>
  );
}

function SessionBody({ scenario, condition, cell, previewOverride, language, showProbeLevels, guidedTour, allowTourSkip, participantCode, assignment, persistence, studyShell, allowPreflightOverride, allowViewSkip, indexedSearch, uiShell }: {
  readonly scenario: ScenarioContract; readonly condition: "directed" | "substitutive"; readonly previewOverride: PreviewOverride | null; readonly language: Lang; readonly showProbeLevels: boolean;
  readonly guidedTour: boolean; readonly allowTourSkip: boolean; readonly cell: Cell | undefined;
  readonly participantCode: string | undefined; readonly assignment: SessionAssignment | undefined; readonly persistence: SessionPersistence | undefined;
  readonly studyShell: boolean; readonly allowPreflightOverride: boolean; readonly allowViewSkip: boolean; readonly indexedSearch: boolean;
  readonly uiShell: UiShell;
}) {
  const { snapshot, orchestrator } = useSession(scenario, condition, previewOverride, language, showProbeLevels, guidedTour, cell,
    { ...(participantCode ? { participantCode } : {}), ...(assignment ? { assignment } : {}), studyShell, allowPreflightOverride, allowViewSkip }, persistence);
  // A session that ended before the run (consent declined, hard preflight refusal) is not offered for resume.
  const step = snapshot?.step ?? null;
  useEffect(() => {
    const status = step === null ? null : statusOnStep(step);
    if (status) void persistence?.setStatus?.(status).catch(() => undefined);
  }, [step]);
  // Revision (ah): the browser's standard "leave the page?" prompt while the session runs (`warnBeforeUnload`).
  const warn = warnBeforeUnload(step, typeof navigator !== "undefined" && navigator.webdriver === true);
  useEffect(() => {
    if (!warn) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [warn]);
  // Checkpoints (9 Oct 2026, `session-checkpoint.ts`): a study session's log so far goes to the server
  // on each screen where the scenario stands still (a freeze, the training, the hinge, the questionnaire,
  // the debrief), so a session abandoned midway is not lost (I3: never in the live run; never awaited, never logged).
  useEffect(() => (orchestrator && persistence && !persistence.demo ? attachCheckpoints(orchestrator) : undefined), []);
  const { t } = useLang();
  // The plan's draft (review 6 Oct 2026): held here, mounted for the whole view, because a freeze or
  // V13's probe unmounts the plan panel; tied to its view, so the next view starts empty.
  const [plan, setPlan] = useState<HeldPlanDraft>({ view: null, draft: EMPTY_PLAN_DRAFT });
  const narrow = useNarrowWindow(); // before any early return: hooks run in the same order every render

  if (!snapshot || !orchestrator) {
    return <div style={{ padding: 24 }}>{t.loading}</div>;
  }

  // The study shell (5 Oct 2026): consent, preflight, questionnaires and debrief take the whole screen; the end is `SessionEnd` below.
  if (SHELL_STEPS.has(snapshot.step)) return <StudyShell snapshot={snapshot} orchestrator={orchestrator} />;

  // The training (after VP) takes the whole screen (SPEC/15 §2). The briefing step has no page since revision (ae):
  // with the study shell it shows the intro video (10 Oct 2026); otherwise the orchestrator passes it at once.
  if (snapshot.step === "briefing") {
    return snapshot.introVideo ? <IntroVideoScreen video={snapshot.introVideo} orchestrator={orchestrator} /> : <div style={{ padding: 24 }}>{t.loading}</div>;
  }
  if (snapshot.step === "training") return <IntroScreen condition={condition} cell={cell} orchestrator={orchestrator} />;

  // SPEC/05 §9: after V14 the session completes and its log is uploaded (or exported).
  if (snapshot.step === "complete") {
    return <SessionEnd orchestrator={orchestrator} demo={persistence?.demo ?? true} setStatus={persistence?.setStatus} />;
  }

  // Revision (am), 10 Oct 2026 (was SPEC/26 D3, Haku only in VP): the AI group has its Thinker in the practice view too (the Thinker practice).
  const capabilities = CAPABILITY_MATRIX[condition];

  // SPEC/08 §4 PROBING_BLANKED: during a freeze the map, rail and drawers are out of reach —
  // invisible, unfocusable, hidden from assistive tech (`visibility: hidden` + `inert`) — but stay
  // mounted, so the map is not rebuilt and its basemap re-uploaded after every freeze.
  const frozen = snapshot.step === "freeze" && snapshot.freeze !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Below the minimum window size a cover asks for a larger window (revision (al)); logged, the session runs on. */}
      <WindowSizeGuard onLog={(e) => orchestrator.logMapUse(e)} />
      <StatusStrip snapshot={snapshot} {...(snapshot.skipAvailable ? { onSkip: () => void orchestrator.skipView().catch(() => undefined) } : {})} />
      {snapshot.tour && <GuidedTour snapshot={snapshot} orchestrator={orchestrator} condition={condition} cell={cell} allowSkip={allowTourSkip} />}
      {frozen && <FreezeScreen freeze={snapshot.freeze!} orchestrator={orchestrator} showLevels={snapshot.showProbeLevels} allowSkip={snapshot.skipAllowed} />}
      {/* The TAK shell (SPEC/28 §5): the map full-size with its toolbar and side panes; the decision strip under the map as below. */}
      {uiShell === "tak" && (
        <TakSessionLayout snapshot={snapshot} orchestrator={orchestrator} extent={scenario.extent} condition={condition} frozen={frozen} indexedSearch={indexedSearch}
          planDraft={heldPlanDraft(plan, snapshot.currentCycle)} onPlanDraft={(draft) => setPlan({ view: snapshot.currentCycle, draft })} />
      )}
      {/* Below NARROW_PX the right column goes under the map and the page scrolls (review 9 Oct 2026: at ~800 px the
          map collapsed and the wind and legend boxes overlapped the allocation text). */}
      {uiShell === "classic" && <div inert={frozen} aria-hidden={frozen} style={{ display: "flex", flexDirection: narrow ? "column" : "row", flex: 1, minHeight: 0, position: "relative", visibility: frozen ? "hidden" : "visible", ...(narrow ? { overflowY: "auto" as const } : {}) }}>
        {/* The map keeps at least MAP_MIN_HEIGHT_PX; when the cards below it (situation question, allocation) need more
            room than is left, this column scrolls instead of squeezing the map (review 9 Oct 2026: at 1280×529 with a
            situation question and the allocation open, the map was 99 px tall). */}
        <div style={{ flex: narrow ? "none" : 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", ...(narrow ? { minHeight: "100%" } : {}) }}>
          {/* Not positioned, so a forced situation question (absolute, inset 0) still covers the whole column. */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <MapView snapshot={snapshot} extent={scenario.extent} onMapUse={(e) => orchestrator.logMapUse(e)} />
          {/* Type U (5 Oct 2026): the visible probe takes the strip; the map stays, the decision strip is kept (hidden) under it. */}
          {snapshot.visibleProbe && (
            <VisibleProbeCard probe={snapshot.visibleProbe} orchestrator={orchestrator} />
          )}
          {/* SPAM (round 2; revision (ag)): online, between the map and the decision strip; while its item is open the strip is held
              (inert, drafts kept). A forced item (the view's time is up) covers this column as a modal step; the right column stays. */}
          {snapshot.spam && <SpamCard spam={snapshot.spam} orchestrator={orchestrator} />}
          <div inert={snapshot.decisionHeld} aria-hidden={snapshot.decisionHeld} style={{ display: snapshot.visibleProbe ? "none" : "flex", flexDirection: "column", flexShrink: 0, opacity: snapshot.decisionHeld ? 0.45 : 1 }}>
            <JudgementPanel snapshot={snapshot} orchestrator={orchestrator} planDraft={heldPlanDraft(plan, snapshot.currentCycle)} onPlanDraft={(draft) => setPlan({ view: snapshot.currentCycle, draft })} />
          </div>
          </div>
        </div>
        {/* Haku, Thinker and the message log all live in the right column — nothing opens over the map. */}
        <RightPanel snapshot={snapshot} orchestrator={orchestrator} condition={condition} aiPresent={capabilities.aiDrawerPresent} hakuFreeText={capabilities.crossSourceFreeTextQuery} stacked={narrow} indexedSearch={indexedSearch} />
      </div>}
    </div>
  );
}

/** Window narrower than this: the right column is stacked under the map. */
const NARROW_PX = 1000;

function useNarrowWindow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < NARROW_PX);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}
