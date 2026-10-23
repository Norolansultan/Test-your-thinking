/**
 * The session orchestrator — the boundary-crossing layer between truth-bearing scenario content
 * and the render layer, in the same spirit as `test/boundary/golden-render-run.ts`: the one place
 * allowed to touch a raw `ScenarioContract`, `InfoAtom` or `Envelope`. Everything it exposes to
 * the UI (`SessionSnapshot`) is built from `Renderable*` types plus plain UI state — never truth.
 *
 * Drives the real `EngineRunLoop` (M1) and `SessionLog` (M4) over SPEC/26's session: briefing,
 * the practice view VP (WARMUP; Haku only, not scored), the group-specific training, V1–V14 with
 * the hinge after V7. A view runs on its own clock (`view-clock.ts`; the flow is SPEC/15 r.8–r.10):
 * the map, messages and projection; the panel at 20 s with the sector plan only, which confirms the
 * period (SPEC/16 (s); Type J, its follow-ups and the outlook withdrawn, revision (x), 6 Oct 2026); the end at the later of the minimum and
 * the confirmation, at the latest at the 150 s cap; the SAGAT freeze at its pre-planned moment,
 * the view's time and the cap standing still (r.12). A merged view reaches its second step halfway (SPEC/26 §2).
 * With `guidedTour`, VP opens with the guided tour and V1 with the tool reminder, the view's
 * clocks held until each is finished (SPEC/15 r.11).
 * SPEC/30 (19 Oct 2026): the consult notification at 60 s of every main view (`consult-notice.ts`), the guide's
 * suggested question from V8, the plan's confidence after each main view's end (`plan-confidence.ts`), V10 and V14's
 * freeze at the view's end (`afterViewEnded`), and a view's second SPAM item (`spam-delivery.ts`).
 * SPEC/32 §3 (20 Oct 2026): in phase B, the plan review at the moment the plan would become final (`plan-review.ts`; `endView`,
 * `keepPlan`, `revisePlan`), the view's clock standing still while it is open.
 * SPEC/35 (21 Oct 2026): a public session's primer and commander profile, and a phase-A session's end after V7 (`public-session.ts`).
 * SPEC/36 (23 Oct 2026): every session's step "Personal results after the study" after the post-session questionnaire
 * (`results_optin`, `decideResultsOptIn`); the commander profile on screen only with `immediateProfile` (`?profiili=heti`).
 * Difficulty audit (23 Oct 2026, `docs/audits/2026-10-23-difficulty/`): the map-reading pretest before VP (`mapPretest`,
 * `map-pretest.ts`), the source-only practice feedback after VP (`practiceFeedback`, `practice-feedback.ts`), the practice SPAM
 * item's measuring task (`practice-measure.ts`), and the content-free "New records" badge on the Haku button (`recordsBadge`).
 */

import type { RenderableAtom } from "../boundary/render-boundary.js";
import { DEFAULT_LANG, type Lang } from "../i18n/lang.js";
import { EngineRunLoop } from "../engine/run-loop.js";
import { cycleScheduleOf, freezeMaxSecondsFor, PRACTICE_VIEW_INDEX, PRACTICE_VIEW_MAX_SECONDS, SECOND_SPAM_SUFFIX, secondSpamProbeId, STEP_SECONDS, VIEW_MAX_SECONDS, viewLabelFi } from "../scenario/views.js";
import type { CycleIndex, GeoExtent, LatLon, Polygon } from "../engine/primitives.js";
import type { NavQuery } from "../retrieval/navigation.js";
import { appendTelemetryEvent } from "../telemetry/emit.js";
import type { ConsultTool, FreezeItemAnsweredDetail, TelemetryEvent, ViewEndedDetail } from "../telemetry/record-kinds.js";
import { InMemoryLogSink, SessionLog, type LogHeader, type LogRecord, type LogSink } from "../telemetry/log.js";
import { planSessionResume, type SessionResumePlan } from "../telemetry/resume.js";
import type { EngineState } from "../engine/freeze-machine.js";
import { sessionCell, sessionHeader, type HeaderAnnotations } from "./header.js";
import { applyRenderEvent, EMPTY_RENDER_TREE, type RenderTree } from "../render/render-tree.js";
import type { Cell, FreezeItem, ProbeSpec, ScenarioContract, ViewSpec } from "../scenario/types.js";
import type { SectorPlan } from "../scenario/plan-types.js";
import { scaleViewSeconds, type PreviewOverride, type SessionAssignment } from "./preview.js";
import { cyclePhaseOf, type FreezeView, type JudgementStep, type SessionSnapshot, type TourId, type ViewIndex } from "./snapshot.js";
import { SpamDelivery } from "./spam-delivery.js";
import { SessionQueries, type ThinkerOptions } from "./queries.js";
import { allocationViewOf, assertValidPlan, copyPlan, droneTaskingEvents } from "./allocation.js";
import type { TemplateAnswer } from "./template-answer.js";
import { capCues, finalCountdownCues, performanceClock, ViewClock, viewTimingOf, type RealClockMs, type ViewTiming } from "./view-clock.js";
import { checkFreezeResponses, freezeNowClock, screenFreezeItem } from "./freeze-answers.js";
import { ProbeToolsLockedError, VisibleProbes } from "./visible-probes.js";
import { readingGraceMsFor, type AttentionDetail, type AttentionKind } from "./attention.js";
import { evaluatePreflight, preflightRecord, type PreflightEnv, type PreflightOutcome } from "./preflight.js";
import { checkQuestionnaireAnswers, multiOptionOrders, questionnaireItems, retentionOrder, RETENTION_ITEM_ID, type QuestionnaireValue } from "./questionnaire.js";
import type { OptionOrderSeed } from "./option-order.js";
import type { IntroVideoOutcome, QuestionnaireId } from "../telemetry/record-kinds.js";
import type { QuestionnaireView } from "./snapshot.js";
import { consentTextId, debriefTextId } from "../i18n/study-texts.js";
import { closeTimelineAt, lastViewOf, PRIMER_SCREEN_ID, PublicLayer, scopedSchedule, type Audience, type AudienceEvent, type SessionScope } from "./public-session.js";
import { deliveredHistory, DUTY_OFFICER_ID, logRowOf } from "./message-history.js";
import { shellResumeStep, type ShellResumeStep } from "./shell-resume.js";
import { HingeCheck } from "./hinge-check.js";
export { DUTY_OFFICER_ID } from "./message-history.js";
import type { SpamProbe } from "./spam-delivery.js";
import { audioManager } from "./audio-manager.js";
import { aiLiteracySpentMs, AiLiteracyTest, keptAiLiteracyAnswers } from "./ai-literacy.js";
import { ConsultNotice, consultToolOf, SUGGESTED_QUESTION, suggestedQuestionOffered } from "./consult-notice.js";
import { PlanConfidence } from "./plan-confidence.js";
import { lastRecordedPlan, PlanReview, REVIEW_REVISION_MIN_SECONDS, type PlanReviewCitedRecord, type PlanReviewEnd, type PlanReviewTrigger } from "./plan-review.js";
import { PREMISE_REVIEW_CELL } from "./thinker-protocol.js";
import { keptPretestAnswers, MapPretest, pretestSpentMs } from "./map-pretest.js";
import { PRACTICE_FEEDBACK_SCREEN_ID, PRACTICE_HEAD_ITEM_ID, practiceFeedbackView, practiceHeadMarkOf, type PracticeFeedbackView } from "./practice-feedback.js";

export type { TemplateAnswer } from "./template-answer.js";
export type { AiChatTurn, CyclePhase, FreezeView, HingeCheckView, JudgementStep, RadioLogEntry, SessionSnapshot, SpamView, ViewIndex } from "./snapshot.js";
/** The records the map components log through `logMapUse` (SPEC/07 revision (al)). */
export type MapUseEvent = Extract<TelemetryEvent, { readonly kind: "viewport_changed" | "element_enter" | "element_leave" | "click" | "layer_toggled" | "freeze_map_pick" | "map_labels_placed" | "window_size_warning" | TakToolKind }>;
/** SPEC/30 §5.4's interaction records from the decision strip and the SPAM card (`logPanelUse`). */
export type PanelUseEvent = Extract<TelemetryEvent, { readonly kind: "decision_option_hovered" | "probe_option_hovered" | "probe_answer_changed" }>;
/** The TAK shell's tool records (SPEC/28 §5): every TAK tool interaction goes through `logMapUse`. */
export type TakToolKind = "tak_pane_opened" | "tak_pane_closed" | "tak_contact_selected" | "tak_overlay_toggled" | "tak_rb_measured" | "tak_chat_room_viewed" | "tak_video_viewed";
export { ProbeToolsLockedError, type VisibleProbeView } from "./visible-probes.js";

type Listener = (snapshot: SessionSnapshot) => void;

/** The steps in which Haku and Thinker may be used (`assertToolsFree`); a visible probe's `probe` step is locked by the probe itself. */
const TOOL_STEPS: ReadonlySet<JudgementStep> = new Set<JudgementStep>(["exploration", "allocation", "awaiting_view_end", "probe"]);

export interface SessionOptions {
  readonly participantCode?: string;
  /** Scales every view time; logged in the header when set (`preview.ts`). */
  readonly previewOverride?: PreviewOverride | null;
  /** Thinker's proxy transport and latency-floor timer (`queries.ts`); the defaults call `/api/thinker`. */
  readonly thinker?: ThinkerOptions;
  readonly language?: Lang; // the session language (`app/i18n/lang.ts`), chosen on the first page; logged in the header
  readonly showProbeLevels?: boolean; // the SA level (L1/L2) on freeze items: shown for demonstration (default), hidden in the study (`?tuotanto`); logged
  /** The real-time clock the view's time is read from (`view-clock.ts`); the browser's monotonic clock by default. */
  readonly realClockMs?: RealClockMs;
  /** The guided tour at VP and the tool reminder at V1 (SPEC/15 r.11); the app turns it on; logged in the header. */
  readonly guidedTour?: boolean;
  /**
   * Deliver Type F and U (5 Oct 2026; Type E withdrawn 6 Oct 2026, `visible-probes.ts`). Like `guidedTour`, the option defaults
   * to off so the session specs written before it run unchanged; the app turns it on, and the header
   * logs it (`visibleProbes`), so a study log without them is detectable.
   */
  readonly visibleProbes?: boolean;
  /**
   * The cell (phase B round 2, D1): `radio` for `directed`; `reasoning_once` or `reasoning_intent`
   * for `substitutive` (default `reasoning_once`). Logged in the header; both chats send it to the
   * proxy, which checks it against the allocation table. The two Thinker cells get the same
   * directive-aware Open Thinker (SPEC/02 revision (aa); the strategy-guided prompt is withdrawn).
   */
  readonly cell?: Cell;
  /** Where the cell came from (SPEC/27 §2.2: the allocation table, `?solu=`, or the start page); logged in the header. */
  readonly assignment?: SessionAssignment;
  /**
   * Where the records go (SPEC/05 §9, I5): the browser passes its IndexedDB sink
   * (`session-registry.ts` `openSessionSink`); without one, an in-memory sink (tests and tools only).
   */
  readonly sink?: LogSink;
  /** The header's annotations, produced outside the run loop (`header.ts`); fixed placeholders without them. */
  readonly annotations?: HeaderAnnotations;
  /** Continue an interrupted session (SPEC/05 §9) instead of starting one: see {@link SessionResume}. */
  readonly resume?: SessionResume;
  /**
   * The study shell (work package I, 5 Oct 2026): consent (the first record after the header), the
   * preflight and the pre-session item before the briefing; the post-session questionnaire and the
   * debrief after V14. The app turns it on; without it (tests, the default) the session starts at
   * the briefing and ends at `complete`, as before.
   */
  readonly studyShell?: boolean;
  /**
   * The AI literacy questionnaire (SNAIL, 9 Oct 2026, revision (ac); `ai-literacy.ts`) as the first task
   * after consent, before the preflight; with the study shell only. Like `visibleProbes`, it defaults
   * to off so the specs written before it run unchanged; the app turns it on in every cell, the
   * study and the demonstration alike, and the header logs it (`aiLiteracyTest`).
   */
  readonly aiLiteracyTest?: boolean;
  /**
   * The intro video (10 Oct 2026): its URL, played full screen after the pre-session item and before
   * the practice view; with the study shell only. Off by default so the earlier specs run unchanged;
   * the app turns it on in every cell, and the header logs it (`introVideo`).
   */
  readonly introVideo?: string;
  /** Demonstration only: the preflight's refusal screen offers "continue anyway" (logged `overridden`). */
  readonly allowPreflightOverride?: boolean;
  /**
   * Demonstration only (6 Oct 2026): the session runs on the real view times, and the presenter may skip
   * the rest of a view (`skipView`, logged `view_ended.endedBy: "skipped"`) or of a freeze. Logged in the
   * header (`viewSkipAllowed`), so a demonstration can never pass for a measurement.
   */
  readonly allowViewSkip?: boolean;
  /** SPEC/35 §2 (`public-session.ts`): `public` adds the primer, the public questionnaire and the profile; logged. Default `expert`. */
  readonly audience?: Audience;
  /** SPEC/35 §2: `phaseA` ends the session after V7 (the hinge) and goes on to the questionnaire; logged. Default `full`. */
  readonly scope?: SessionScope;
  /**
   * SPEC/36: the commander profile on screen after the results step (`?profiili=heti`: demonstrations, teaching), in either audience;
   * logged in the header (`immediateProfile`). Default off: personal results are sent after the study closes.
   */
  readonly immediateProfile?: boolean;
  /**
   * Difficulty audit (23 Oct 2026, `proposal-map.md` c.2): the map-reading pretest after the pre-session item (and a public session's
   * primer), before the intro video and VP; with the study shell only. Off by default so the earlier specs run unchanged; the app turns
   * it on in every session, and the header logs it (`mapPretest`).
   */
  readonly mapPretest?: boolean;
  /**
   * Difficulty audit (`proposal.md` (b.3)): the source-only practice feedback screen after VP, before the training. Off by default (the
   * earlier specs run unchanged); the app turns it on in every session; logged in the header (`practiceFeedback`).
   */
  readonly practiceFeedback?: boolean;
}

/**
 * A resumed session: its original header and the records already durable in `sink`. The session
 * re-enters where `planSessionResume` says — at the start of the interrupted view (never mid-view), or the briefing, the training, the hinge screen or the end — after logging
 * the interruption as a fault span (`fault` / `fault_resolved`, class `session_interrupted`) and
 * `session_resumed`. The options given beside it must match the header (the launcher derives them from it).
 */
export interface SessionResume {
  readonly header: LogHeader;
  readonly records: readonly LogRecord[];
  /** Wall-clock time between the last durable record and the resume (ms): measured outside the run loop. */
  readonly interruptedForMs: number;
}

/** The fault class of an interruption the participant resumed from. */
export const INTERRUPTION_FAULT_CLASS = "session_interrupted";

export class SessionOrchestrator {
  private readonly loop: EngineRunLoop;
  private readonly log: SessionLog;
  private readonly previewOverride: PreviewOverride | null;
  private renderTree: RenderTree = EMPTY_RENDER_TREE;
  private step: JudgementStep = "briefing";
  /** During a freeze: the step the participant returns to (moved on by anything finishing meanwhile). */
  private resumeStep: JudgementStep | null = null;
  /** Set synchronously on submit so a second click during the awaited log writes is refused. */
  private submitting = false;
  private listeners: Listener[] = [];
  private currentCycle: ViewIndex = PRACTICE_VIEW_INDEX;
  /** The world-state step the map shows now: the view's first, or its second after the boundary. */
  private currentStep = 0;
  private readonly viewClock: ViewClock;
  private timing: ViewTiming;
  /** This view's allocation is submitted, the period confirmed, its minimum length reached; revisions so far. */
  private allocationCommitted = false;
  private periodConfirmed = false;
  private minimumReached = false;
  private revisingAllocation = false;
  private revisionOpening = false; // "Muuta kohdennusta" pressed, its record being written
  private revisionCount = 0;
  /** The plan last recorded in this view (submitted or revised; 6 Oct 2026): the "recorded" line and the revision's prefill. */
  private recordedPlan: SectorPlan | null = null;
  /** The last view ended at its cap with no plan recorded (6 Oct 2026): the next view's exploration says so. */
  private lastViewTimedOutWithoutPlan = false;
  private bubbleHistory: RenderableAtom[] = [];
  private readonly queries: SessionQueries;
  private readonly realMs: RealClockMs;
  private readonly startedMs: number;
  private readonly resumeInfo: { readonly plan: SessionResumePlan; readonly interruptedForMs: number; readonly records: readonly LogRecord[] } | null;
  private completed = false;
  private hingeShownMs = 0; // the real clock when the hinge pause began (`hinge_pause_end.realDurationMs`)
  private viewOpenedMs = 0; // the real clock when the current view opened (`cycle_end.totalRealDurationMs`)
  private readonly showProbeLevels: boolean;
  private minSecondsLeft: number | null = null; // the final countdowns: to the minimum (`finalCountdownCues`) and to the 150 s cap
  private capSecondsLeft: number | null = null;
  private capReached = false;
  private readonly language: Lang;
  private readonly guidedTour: boolean;
  private readonly visibleProbesOn: boolean;
  private tour: TourId | null = null; // the view's clocks wait until it is finished (`completeTour`)
  private tourShownMs = 0;
  /** SPAM (`spam-delivery.ts`): the probe on screen; what waits for it to close (the step boundary, the view's end). */
  private readonly spam: SpamDelivery;
  private boundaryHeld = false;
  private endHeld: ViewEndedDetail["endedBy"] | null = null;
  /** The manipulation check on the hinge screen (brief D3, `hinge-check.ts`). */
  private readonly hingeCheck: HingeCheck;
  /**
   * The visible probes F and U (`visible-probes.ts`; placement in `demo-probes.ts`): the one on screen,
   * those waiting for it (or for a SPAM probe or a freeze) to close, whether this view's F has been
   * queued, and — after a view has ended — the view whose after-view probes are running.
   */
  private readonly visible: VisibleProbes;
  /** The AI literacy test after consent (`SessionOptions.aiLiteracyTest`). */
  private readonly aiLiteracyOn: boolean;
  private readonly aiLiteracy: AiLiteracyTest;
  /** The intro video's URL before the practice view (`SessionOptions.introVideo`), or null. */
  private readonly introVideo: string | null;
  private probeQueue: { readonly probe: ProbeSpec; readonly atViewSeconds: number | null }[] = [];
  private postViewOf: ViewIndex | null = null;
  /** The study shell (`SessionOptions.studyShell`). */
  private readonly studyShell: boolean;
  private readonly allowPreflightOverride: boolean;
  private readonly allowViewSkip: boolean;
  private shellShownMs = 0; // when the current shell screen (consent, questionnaire, debrief) was shown
  private freezeShownMs = 0; // when the open freeze was shown
  private thinkerPending = 0; // Thinker requests not yet answered (`waitingOnSession`)
  private readingGraceMs = 0; // reading time after the last answer (`SessionSnapshot.readingGraceMs`)
  private introShownMs = 0; // when the briefing or the training text was shown (`showIntro`)
  private readonly freezeItemAnsweredMs = new Map<string, number>(); // the open freeze's items left with "Seuraava" (`markFreezeItemAnswered`)
  private readonly freezeConfirmed = new Map<string, FreezeItemAnsweredDetail>(); // their answers, kept for the cap (fix pass 7)
  private freezeCapTimer: ReturnType<typeof setTimeout> | null = null; // `FREEZE_MAX_SECONDS` (fix pass 7)
  private preflightOutcome: PreflightOutcome | null = null;
  private loggedPreflight: string | null = null; // the last logged outcome's failures, so a re-check logs only a change
  private questionnaireId: QuestionnaireId | null = null;
  /** SPEC/30 §4: the consult notification and the session's cell (the chip's group). */
  private readonly consult: ConsultNotice;
  private readonly cell: Cell;
  /** SPEC/30 §5.4: the plan-confidence item after a main view's end. */
  private readonly planConfidence: PlanConfidence;
  /** The view that has ended and what follows it is running (`afterViewEnded`): its end moment, whether it was skipped. */
  private viewEnd: { readonly view: ViewIndex; readonly viewSeconds: number; readonly skipped: boolean } | null = null;
  /** SPEC/30 §5.1: the open freeze is the view's end-of-view freeze (it leads on to what follows the view, not back into it). */
  private endFreeze = false;
  /**
   * SPEC/32 §3: the plan review (phase B); what made the plan final (set where the end is called or held, read when the review
   * opens); a review held by a freeze or a visible probe open at that moment (the end it gives); the view's cap now (moved for a
   * revision opened at the review) and the generation of its cues (an earlier cap's cues do nothing).
   */
  private readonly review: PlanReview;
  private reviewTrigger: PlanReviewTrigger | null = null;
  private reviewHeld: PlanReviewEnd | null = null;
  private capSeconds = VIEW_MAX_SECONDS;
  private capGeneration = 0;
  /** SPEC/35: the public layer's records (`public-session.ts`) and the last main view the scope runs (V14, or V7 in phase A). */
  private readonly publicLayer: PublicLayer;
  private readonly lastView: number;
  /** SPEC/36: the commander profile is shown after the results step (`SessionOptions.immediateProfile`). */
  private readonly immediateProfile: boolean;
  /** Difficulty audit: the map-reading pretest (`SessionOptions.mapPretest`) and the practice feedback (`SessionOptions.practiceFeedback`). */
  private readonly mapPretestOn: boolean;
  private readonly mapPretest: MapPretest;
  private readonly practiceFeedbackOn: boolean;
  private practiceFeedback: PracticeFeedbackView | null = null;
  private practiceHeadMark: LatLon | null = null; // the practice freeze's head mark, for the feedback's map task
  /** Difficulty audit (a.4): the "New records" badge, and whether the Haku tool is open now (its last `tab_selected`). */
  private recordsBadge = false;
  private hakuOpen = false;

  constructor(
    private readonly scenario: ScenarioContract,
    private readonly condition: "directed" | "substitutive",
    options: SessionOptions = {},
  ) {
    const participantCode = options.participantCode ?? "preview";
    this.language = options.language ?? DEFAULT_LANG;
    this.previewOverride = options.previewOverride ?? null;
    this.showProbeLevels = options.showProbeLevels ?? true;
    this.guidedTour = options.guidedTour ?? false;
    this.visibleProbesOn = options.resume?.header.visibleProbes ?? options.visibleProbes ?? false;
    this.studyShell = options.studyShell ?? false;
    this.allowPreflightOverride = options.allowPreflightOverride ?? false;
    this.allowViewSkip = options.resume?.header.viewSkipAllowed ?? options.allowViewSkip ?? false;
    this.aiLiteracyOn = this.studyShell && (options.resume?.header.aiLiteracyTest ?? options.aiLiteracyTest ?? false);
    this.introVideo = this.studyShell ? (options.resume ? options.resume.header.introVideo ?? null : options.introVideo ?? null) : null;
    const cell = sessionCell(condition, options.cell);
    this.cell = cell;
    // SPEC/35 §2: a resumed session keeps its header's audience and scope (absent in logs before 0.13.0: expert, full).
    const audience = options.resume ? options.resume.header.audience ?? "expert" : options.audience ?? "expert";
    const scope = options.resume ? options.resume.header.scope ?? "full" : options.scope ?? "full";
    // SPEC/36: so does the profile's timing (absent in a header: not shown).
    this.immediateProfile = options.resume ? options.resume.header.immediateProfile === true : options.immediateProfile === true;
    // Difficulty audit: so do the pretest and the practice feedback (absent in a header: off).
    this.mapPretestOn = this.studyShell && (options.resume ? options.resume.header.mapPretest === true : options.mapPretest === true);
    this.practiceFeedbackOn = options.resume ? options.resume.header.practiceFeedback === true : options.practiceFeedback === true;
    const header = options.resume?.header ?? { ...sessionHeader(scenario, condition, participantCode, this.language, this.previewOverride, this.showProbeLevels, cell, options.assignment, options.annotations), guidedTour: this.guidedTour, visibleProbes: this.visibleProbesOn, ...(this.allowViewSkip ? { viewSkipAllowed: true } : {}), ...(this.aiLiteracyOn ? { aiLiteracyTest: true } : {}), ...(this.introVideo ? { introVideo: this.introVideo } : {}), audience, scope, ...(this.immediateProfile ? { immediateProfile: true } : {}), ...(this.mapPretestOn ? { mapPretest: true } : {}), ...(this.practiceFeedbackOn ? { practiceFeedback: true } : {}) };
    this.log = new SessionLog(header, options.sink ?? new InMemoryLogSink(), options.resume?.records ?? []);
    // SPEC/26 §3: the engine runs the scenario's views (14, hinge after V7, one or two steps each).
    this.loop = new EngineRunLoop(cycleScheduleOf(scenario));
    this.publicLayer = new PublicLayer({ event: (e) => this.event(e) }, audience, scope);
    this.lastView = lastViewOf(scope, cycleScheduleOf(scenario));
    this.realMs = options.realClockMs ?? performanceClock;
    this.resumeInfo = options.resume ? { plan: planSessionResume(options.resume.records, scopedSchedule(scope, cycleScheduleOf(scenario))), interruptedForMs: Math.max(0, Math.round(options.resume.interruptedForMs)), records: options.resume.records } : null;
    // A resumed session's records continue its time base: the last record's offset plus the interruption.
    this.startedMs = this.realMs() - (this.resumeInfo ? this.resumeInfo.plan.lastWallOffsetMs + this.resumeInfo.interruptedForMs : 0);
    this.viewClock = new ViewClock(this.realMs);
    this.timing = viewTimingOf(scenario.practice.cycle, this.previewOverride);
    const wallMs = () => Math.round(this.realMs() - this.startedMs);
    this.queries = new SessionQueries({
      scenario, log: this.log, wallMs,
      now: () => this.loop.clock.now(),
      view: () => this.currentCycle,
      currentStep: () => this.currentStep, viewEndVirtual: () => this.cycleSpec().startsAtVirtual + this.cycleSpec().steps * STEP_SECONDS,
      phaseTag: () => this.phaseTag(),
      aiAvailable: () => this.aiAvailable(), language: () => this.language, cell: () => cell,
    }, options.thinker);
    this.spam = new SpamDelivery({ event: (e) => this.event(e), notify: () => this.notify(), closed: () => this.afterSpam() });
    this.visible = new VisibleProbes({ event: (e) => this.event(e), notify: () => this.notify(), optionSeed: this.optionSeed() });
    this.consult = new ConsultNotice({ event: (e) => this.event(e), notify: () => this.notify() }, consultToolOf(cell));
    this.planConfidence = new PlanConfidence({ event: (e) => this.event(e), notify: () => this.notify() });
    this.hingeCheck = new HingeCheck({ event: (e) => this.event(e), notify: () => this.notify() }, scenario.hinge.manipulationCheck);
    this.review = new PlanReview({ event: (e) => this.event(e), notify: () => this.notify(), realMs: () => this.realMs(), citedRecord: (atomId, premiseId) => this.citedRecordOf(atomId, premiseId) });
    this.aiLiteracy = new AiLiteracyTest({
      event: (e) => this.event(e), notify: () => this.notify(), realMs: () => this.realMs(),
      ended: async () => { this.step = "preflight"; this.notify(); }, // its end record is durable: on to the preflight
    }, this.language);
    this.mapPretest = new MapPretest({
      event: (e) => this.event(e), notify: () => this.notify(), realMs: () => this.realMs(),
      ended: () => this.toBriefing(), // its end record is durable: on to the intro video and VP
    }, this.language);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.snapshot());
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  private notify(): void {
    const snapshot = this.snapshot();
    for (const l of this.listeners) l(snapshot);
    // The reading time belongs to the wait that ended with the answer: a freeze, probe or SPAM item starting later has none.
    if (snapshot.waitingOnSession && this.thinkerPending === 0) this.readingGraceMs = 0;
  }

  /** Moves the participant on within a view; during a freeze, to where they continue after it. */
  private goTo(step: JudgementStep): void {
    if (this.step === "freeze" || this.step === "probe") this.resumeStep = step;
    else this.step = step;
    this.notify();
  }

  /** Every record carries the real milliseconds since the session started (`tWallOffsetMs`), the time base of SPEC/07 (r)'s commitment measures. */
  private event(event: TelemetryEvent): Promise<unknown> { return appendTelemetryEvent(this.log, this.loop.clock.now(), Math.round(this.realMs() - this.startedMs), event); } // also the hosts' `wallMs`

  private isPractice(): boolean { return this.currentCycle === PRACTICE_VIEW_INDEX; }

  private cycleSpec(): ViewSpec { return this.isPractice() ? this.scenario.practice.cycle : this.scenario.cycles.find((c) => c.index === this.currentCycle)!; }

  private freezeSpec(): { readonly items: readonly FreezeItem[] } | null { return !this.cycleSpec().hasFreeze ? null : this.isPractice() ? this.scenario.practice.freeze : this.scenario.freezes.find((f) => f.cycle === this.currentCycle) ?? null; }
  private freezeOf(): FreezeView | null { const f = this.freezeSpec(); return f && { items: f.items.map(screenFreezeItem) }; } // the screen's: a whitelist, no TRUTH or analysis metadata (`31` §3.9)
  /** `31` F13: the clock the open freeze's header states as "now" (`freezeNowClock`); null when no freeze is open. */
  freezeNowLabel(): string | null {
    if (this.step !== "freeze") return null;
    const spec = this.cycleSpec();
    return freezeNowClock(13 * 60 + 20 + Number(spec.startsAtVirtual) / 60, spec.steps, this.endFreeze);
  }
  /**
   * The scenario's extent: the freeze's blank map (`FreezeMap`) opens on it, the same neutral frame as the live map
   * (SPEC/12 revision (aj); never framed on the fire as reported, which was the rule from 2 Oct to 9 Oct 2026), and
   * a map answer must fall inside it.
   */
  get mapExtent(): GeoExtent { return this.scenario.extent; }

  /** The Thinker tool: the AI condition, every view — revision (am), 10 Oct 2026: the practice view too (the Thinker practice; SPEC/26 D3 had VP Haku only). */
  private aiAvailable(): boolean { return this.condition === "substitutive"; }

  /** The clock the map shows: the view's, or its second step's after the step boundary. */
  private clockLabel(): string { return this.renderTree.cycleInfo?.clockLabel ?? this.cycleSpec().clockLabel; }

  /** SPEC/15 §9's logging obligation: every query is tagged exploration (panel not yet open) vs decision. */
  private phaseTag(): "exploration" | "decision" { return this.step === "exploration" ? "exploration" : "decision"; }

  private snapshot(): SessionSnapshot {
    return {
      currentCycle: this.currentCycle,
      practice: this.isPractice(),
      viewLabel: viewLabelFi(this.currentCycle),
      phase: this.cycleSpec().phase, // the practice view sits before phase A
      clockLabel: this.clockLabel(),
      step: this.step,
      cyclePhase: cyclePhaseOf(this.step),
      minViewSeconds: this.timing.minViewSeconds,
      decisionOpensAtSeconds: this.timing.decisionOpensAtSeconds,
      minimumReached: this.minimumReached, secondsLeft: (() => { const s = this.secondsLeftShown(); audioManager.setTensionBySeconds(s); return s; })(),
      revisingAllocation: this.revisingAllocation,
      recordedPlan: this.recordedPlan && copyPlan(this.recordedPlan),
      previousViewTimedOutWithoutPlan: this.lastViewTimedOutWithoutPlan && this.step === "exploration",
      freeze: this.freezeOf(),
      renderTree: this.renderTree,
      currentEnvelope: this.renderTree.envelope,
      allocation: allocationViewOf(this.scenario.allocationSpace, this.currentCycle),
      bubbleHistory: this.bubbleHistory, radioLog: this.queries.radioLog, aiChatHistory: this.queries.aiChatHistory, openThinkerHistory: this.queries.openThinkerHistory,
      logRecordCount: this.log.currentSeq(), conditionLabel: this.condition,
      aiAvailable: this.aiAvailable(),
      previewOverride: this.previewOverride, showProbeLevels: this.showProbeLevels,
      skipAllowed: this.allowViewSkip, skipAvailable: this.skipAvailable(),
      language: this.language, tour: this.tour,
      // SPEC/27 §4.1: hidden while the check is answered, shown again afterwards (not marked right or wrong).
      hingeDirective: this.step === "hinge_pause" && !this.hingeCheck.asking ? this.scenario.hinge.intentStatement : null,
      // Revision (ag): a SPAM item holds the decision strip, not the tools (Haku and the Thinker stay usable).
      // SPEC/30 §5.4: after the view's end (the plan-confidence item) the tools are closed too.
      // SPEC/32 §3: the plan review closes the tools too (the map and the message log stay).
      spam: this.spam.view(), toolsLocked: this.visible.open || this.step === "plan_confidence" || this.step === "plan_review", decisionHeld: this.spam.itemOpen || this.visible.open,
      waitingOnSession: this.thinkerPending > 0 || this.step === "freeze" || this.step === "probe" || this.spam.open || this.visible.open || (this.step === "plan_review" && !this.review.onScreen),
      visibleProbe: this.visible.view(),
      hingeCheck: this.step === "hinge_pause" ? this.hingeCheck.view() : null,
      directiveInForce: !this.isPractice() && this.currentCycle > this.scenario.hinge.afterCycle ? this.scenario.hinge.intentStatement : null,
      readingGraceMs: this.readingGraceMs,
      preflight: this.step === "preflight" || this.step === "preflight_refused" ? { proxyNeeded: true /* Haku's chat uses the proxy in every cell (8 Oct 2026) */, outcome: this.preflightOutcome, overrideAllowed: this.allowPreflightOverride } : null,
      questionnaire: this.step === "questionnaire" ? this.questionnaireView() : null,
      aiLiteracy: this.step === "ai_literacy" ? this.aiLiteracy.view() : null,
      debrief: this.step === "debrief" ? { textId: this.debriefId(), cell: this.log.header.cell } : null,
      introVideo: this.step === "briefing" && this.introVideo ? { src: this.introVideo, skippable: this.allowViewSkip } : null,
      // SPEC/30 §4: the notice is out of sight while the tools it opens are (a visible probe) or the screen is blanked.
      consultPrompt: this.visible.open || this.step === "freeze" || this.step === "plan_review" ? null : this.consult.view(),
      suggestedQuestion: !this.isPractice() && suggestedQuestionOffered(this.cell, this.currentCycle, this.scenario.hinge.afterCycle),
      planConfidence: this.step === "plan_confidence" ? this.planConfidence.view() : null,
      planReview: this.step === "plan_review" ? this.review.view() : null,
      mapPretest: this.step === "map_pretest" ? this.mapPretest.view() : null,
      practiceFeedback: this.step === "practice_feedback" ? this.practiceFeedback : null,
      recordsBadge: this.recordsBadge,
    };
  }

  private async transition(trigger: Parameters<EngineRunLoop["transition"]>[0]): Promise<void> { await this.event({ kind: "state_transition", detail: this.loop.transition(trigger) }); }

  /** Boots BOOT -> BRIEFING and goes on to the practice view (the briefing page is gone, revision (ae)). */
  async start(): Promise<void> {
    if (this.resumeInfo) return this.startResumed(this.resumeInfo.plan, this.resumeInfo.interruptedForMs);
    await this.event({ kind: "session_started", detail: this.log.header });
    if (this.studyShell) { // nothing more is logged until the consent decision (BOOT)
      this.step = "consent";
      this.shellShownMs = this.realMs();
      this.notify();
      return;
    }
    for (const trigger of ["start", "preflight_passed"] as const) await this.transition(trigger);
    this.showIntro("briefing");
    await this.passBriefing();
  }

  /** The briefing or the training text is shown: its dwell (`briefing_advanced.dwellMs`) counts from now. */
  private showIntro(step: "briefing" | "training"): void {
    this.step = step;
    this.introShownMs = this.realMs();
  }
  private introDwellMs(): number { return Math.round(this.realMs() - this.introShownMs); }

  /**
   * BRIEFING -> WARMUP: the practice view starts (SPEC/26 D3). Revision (ae), researcher 9 Oct 2026: the
   * "Situation" page (the setting text) is no longer shown; the step is passed at once, in every cell and
   * both languages, and logged as before (`briefing_advanced` "briefing.setting", `auto` and `screenRemoved`,
   * dwell 0; `briefing_complete`), so the analysis, the resume plan and the checkpoint boundaries are unchanged.
   */
  private async passBriefing(): Promise<void> {
    if (this.step !== "briefing") throw new Error(`passBriefing in step ${this.step}`);
    this.step = "exploration";
    await this.event({ kind: "briefing_advanced", detail: { screenId: "briefing.setting", dwellMs: this.introDwellMs(), auto: true, screenRemoved: true } });
    await this.beginPractice();
  }

  /** BRIEFING -> WARMUP, the practice view (VP). */
  private async beginPractice(): Promise<void> {
    await this.transition("briefing_complete");
    await this.event({ kind: "phase_entered", detail: { phase: "practice" } });
    await this.enterCycle(PRACTICE_VIEW_INDEX);
  }

  /**
   * The intro video's page is left (10 Oct 2026, `SessionOptions.introVideo`): the video ended, could not
   * be played, or (demonstration only) was skipped. Logged as `briefing_advanced` "briefing.video" with
   * its dwell and outcome; then the practice view starts, as after the briefing.
   */
  async finishIntroVideo(outcome: IntroVideoOutcome): Promise<void> {
    if (this.step !== "briefing" || this.introVideo === null || this.submitting) throw new Error(`finishIntroVideo in step ${this.step}`);
    if (outcome === "skipped" && !this.allowViewSkip) throw new Error("finishIntroVideo: skipping is for demonstrations only");
    this.submitting = true;
    try {
      this.step = "exploration";
      await this.event({ kind: "briefing_advanced", detail: { screenId: "briefing.video", dwellMs: this.introDwellMs(), videoOutcome: outcome } });
      await this.beginPractice();
    } finally { this.submitting = false; }
  }

  /**
   * Difficulty audit (`proposal.md` (b.3), `practice-feedback.ts`): after VP, the source-only feedback screen (TUTORIAL; the training
   * follows it). Shown once its record (`practice_feedback_shown`) is durable (I5).
   */
  private async showPracticeFeedback(): Promise<void> {
    this.practiceFeedback = practiceFeedbackView(this.scenario, this.practiceHeadMark);
    this.step = "practice_feedback";
    this.shellShownMs = this.realMs();
    await this.event({ kind: "practice_feedback_shown", detail: { itemIds: this.practiceFeedback.items.map((i) => i.itemId) } });
    this.notify();
  }

  /** The practice feedback is left (`briefing_advanced` "practice.feedback", its dwell): on to the training text. */
  async finishPracticeFeedback(): Promise<void> {
    if (this.step !== "practice_feedback" || this.submitting) throw new Error(`finishPracticeFeedback in step ${this.step}`);
    this.submitting = true;
    try {
      await this.event({ kind: "briefing_advanced", detail: { screenId: PRACTICE_FEEDBACK_SCREEN_ID, dwellMs: this.shellDwellMs() } });
      this.practiceFeedback = null;
      this.showIntro("training");
    } finally { this.submitting = false; }
    this.notify();
  }

  /** Difficulty audit (`proposal-map.md` c.2): after the pre-session item (and a public session's primer), the pretest when it is on, else the briefing. */
  private async afterPreSession(): Promise<void> {
    if (!this.mapPretestOn) return this.toBriefing();
    return this.showMapPretest();
  }

  /** Shows the map-reading pretest (`map_pretest_started` first: the screen shows once it is durable); a resume keeps the answers logged. */
  private async showMapPretest(records: readonly LogRecord[] = [], resumed = false): Promise<void> {
    this.step = "map_pretest";
    this.shellShownMs = this.realMs();
    await this.mapPretest.start(keptPretestAnswers(records), pretestSpentMs(records), resumed);
    if (this.step === "map_pretest") this.notify(); // (a pretest whose every item was kept has ended and moved on already)
  }

  /** A pretest item answered and left (final); the last ends the pretest and the session goes on to the briefing. */
  answerMapPretest(itemId: string, choiceId: string): Promise<void> {
    if (this.step !== "map_pretest") return Promise.reject(new Error(`answerMapPretest in step ${this.step}`));
    return this.mapPretest.answer(itemId, choiceId);
  }
  /** Whole seconds left on the pretest's cap (its countdown). */
  mapPretestSecondsLeft(): number { return this.mapPretest.secondsLeft(); }

  /** TUTORIAL -> RUNNING: the group-specific training is read; V1 starts at 13:20, virtual 0. */
  async completeTraining(): Promise<void> {
    if (this.step !== "training") throw new Error(`completeTraining in step ${this.step}`);
    this.step = "exploration";
    await this.event({ kind: "briefing_advanced", detail: { screenId: `training.${this.condition}`, dwellMs: this.introDwellMs() } });
    await this.transition("tutorial_complete");
    await this.event({ kind: "phase_entered", detail: { phase: "phase_a" } });
    await this.enterCycle(1);
  }

  /** Delivers pushed items whose offset into the view falls in `[from, to)` virtual seconds. */
  private async deliverPushed(spec: ViewSpec, from: number, to: number): Promise<void> {
    for (const [k, atomId] of spec.pushedAtomIds.entries()) {
      const t = spec.deliveryOffsetsSeconds[k]!;
      if (t < from || t >= to) continue;
      const atom = this.scenario.atoms.find((a) => a.id === atomId)!;
      this.renderTree = applyRenderEvent(this.renderTree, { kind: "bubble_delivered", atom });
      const { renderable, row } = logRowOf(atom);
      this.bubbleHistory.push(renderable);
      this.queries.radioLog.push(row);
      await this.event({ kind: "bubble_available", detail: { atomId: renderable.id, mapPosition: null, tier: atom.tier, sourceId: atom.provenance.sourceId } });
    }
  }

  private async enterCycle(index: ViewIndex): Promise<void> {
    this.viewClock.stop();
    this.viewOpenedMs = this.realMs();
    this.currentCycle = index;
    this.step = "exploration";
    this.resumeStep = null;
    this.allocationCommitted = this.periodConfirmed = this.minimumReached = this.revisingAllocation = false;
    this.revisionCount = 0; this.recordedPlan = null; this.minSecondsLeft = this.capSecondsLeft = null; this.capReached = false; this.tour = null;
    this.spam.reset(); this.boundaryHeld = false; this.endHeld = null;
    this.visible.reset(); this.probeQueue = []; this.postViewOf = null;
    this.consult.reset(this.isPractice() ? null : index as CycleIndex); this.planConfidence.reset(); this.viewEnd = null; this.endFreeze = false;
    this.review.reset(); this.reviewTrigger = null; this.reviewHeld = null;

    const cycleSpec = this.cycleSpec();
    this.timing = viewTimingOf(cycleSpec, this.previewOverride);
    this.currentStep = cycleSpec.startsAtVirtual / STEP_SECONDS + 1;
    this.renderTree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: cycleSpec });
    this.recordsBadge = !this.hakuOpen; // difficulty audit (a.4): a view's first-step records are released now
    this.queries.startView(index); // the Open Thinker's history is cleared once, at the first view from V8 on
    await this.event({ kind: "cycle_start", detail: { cycle: index, phase: this.isPractice() ? "practice" : cycleSpec.phase, clockLabel: cycleSpec.clockLabel, minViewSeconds: cycleSpec.minViewSeconds, freezeAtSeconds: cycleSpec.freezeAtSeconds, navSources: this.queries.navigationSources() } });
    // The superior's (P2, `DUTY_OFFICER_ID`) messages open their view, both groups: the intent at V1, the directive at V8, on leaving the hinge (SPEC/15 §2).
    for (const { text, isStrategicGuidance } of this.isPractice() ? [] : this.scenario.dutyOfficerMessages.filter((m) => m.cycle === index)) {
      this.queries.radioLog.push({ clockLabel: cycleSpec.clockLabel, from: DUTY_OFFICER_ID, text });
      const messageId = isStrategicGuidance ? this.scenario.hinge.guidanceMessageId : `duty.cycle_${index}`;
      await this.event({ kind: "duty_officer_message_delivered", detail: { messageId, isStrategicGuidance } });
      // D1 (8 Oct 2026): the directive's persistent line (`SessionSnapshot.directiveInForce`) appears with this message; its display is logged once.
      if (isStrategicGuidance) await this.event({ kind: "directive_shown", detail: { view: index, messageId, clockLabel: cycleSpec.clockLabel } });
    }
    // The first step's items now; a merged view's second-step items at its step boundary.
    await this.deliverPushed(cycleSpec, 0, cycleSpec.stepBoundary ? STEP_SECONDS : Infinity);

    // The projection is on the map from the start, beside the reports it can be checked against.
    // Both groups see the same envelope (SPEC/02 revision (o) §1; SPEC/15 §10.1 is superseded).
    await this.showEnvelope();

    const { decisionOpensAtSeconds } = this.timing;
    await this.event({ kind: "exploration_phase_start", detail: { cycle: index, explorationSeconds: decisionOpensAtSeconds } });
    this.tour = !this.guidedTour ? null : index === PRACTICE_VIEW_INDEX ? "practice" : index === 1 ? "tools" : null;
    this.tourShownMs = this.realMs();
    this.notify();
    if (this.tour === null) this.startViewClocks();
  }

  /** The guided tour (or V1's tool reminder) is finished: the view's time starts now. */
  async completeTour(stepsSeen: number): Promise<void> {
    if (this.tour === null) throw new Error("completeTour with no tour showing");
    const tour = this.tour;
    this.tour = null;
    await this.event({ kind: "tour_completed", detail: { cycle: this.currentCycle, tour, stepsSeen, dwellMs: Math.round(this.realMs() - this.tourShownMs) } });
    audioManager.play();
    this.startViewClocks();
    this.notify();
  }

  private startViewClocks(): void {
    const { decisionOpensAtSeconds, stepBoundaryAtSeconds, freezeAtSeconds, minViewSeconds, consultPromptAtSeconds } = this.timing;
    this.viewClock.start([
      { atSeconds: decisionOpensAtSeconds, fire: () => void this.openDecisionPanel() },
      ...(stepBoundaryAtSeconds !== null ? [{ atSeconds: stepBoundaryAtSeconds, fire: () => void this.reachStepBoundary() }] : []),
      ...(freezeAtSeconds !== null && this.freezeOf() ? [{ atSeconds: freezeAtSeconds, fire: () => void this.startFreeze(freezeAtSeconds!) }] : []),
      ...this.spamCues(freezeAtSeconds),
      ...this.visibleProbeCues(),
      // SPEC/30 §4: after the freeze's cue when both fall at the same moment, so the freeze holds it (the clock stands still).
      // `31` F23: held until the freeze has closed when the freeze falls due less than 15 s after it (`consultHeldForFreeze`) and is still ahead.
      ...(consultPromptAtSeconds !== null ? [{ atSeconds: consultPromptAtSeconds, fire: () => void this.consult.due(consultPromptAtSeconds, this.step === "freeze" || this.spam.itemOpen || this.freezeDueSoonAfter(consultPromptAtSeconds)) }] : []),
      ...finalCountdownCues(minViewSeconds, (s) => { this.minSecondsLeft = s; this.notify(); }),
      { atSeconds: minViewSeconds, fire: () => void this.reachMinimum() },
      ...this.capCuesAt(this.isPractice() ? PRACTICE_VIEW_MAX_SECONDS : VIEW_MAX_SECONDS), // freeze time does not count (r.12)
    ]);
    audioManager.play();
  }

  /** The cap's cues at `capSeconds` (`capCues`); any earlier cap's cues do nothing from now on (SPEC/32 §3: the cap moved). */
  private capCuesAt(capSeconds: number): ReturnType<typeof capCues> {
    this.capSeconds = capSeconds;
    const generation = ++this.capGeneration;
    const current = () => generation === this.capGeneration;
    return capCues(capSeconds, (s) => { if (current()) { this.capSecondsLeft = s; this.notify(); } }, () => { if (current()) void this.reachCap(); });
  }

  /** `31` F23: this view's freeze falls due within 15 s after `atSeconds` and has not yet come (a freeze at that same moment came first). */
  private freezeDueSoonAfter(atSeconds: number): boolean {
    const { consultHeldForFreeze, freezeAtSeconds } = this.timing;
    return consultHeldForFreeze && freezeAtSeconds !== null && atSeconds < freezeAtSeconds && this.freezeOf() !== null;
  }

  /** What the countdown shows: the cap, or once the period is confirmed, whichever of the minimum and the cap comes first. */
  private secondsLeftShown(): number | null {
    if (!this.periodConfirmed || this.minimumReached) return this.capSecondsLeft;
    return this.minSecondsLeft === null ? this.capSecondsLeft : this.capSecondsLeft === null ? this.minSecondsLeft : Math.min(this.minSecondsLeft, this.capSecondsLeft);
  }

  /** The 150 s cap (`VIEW_MAX_SECONDS`; view time, freezes excluded): the view ends now — after a submission in progress, if one is (`guarded`). */
  private async reachCap(): Promise<void> {
    this.capReached = true;
    // The countdown's last cue left it at 1 s; while the end is held (an open situation question) it stood there
    // beside the item's own window as a second timer (review 9 Oct 2026). Zero hides it (StatusStrip).
    this.capSecondsLeft = 0; this.notify();
    if (this.step !== "freeze" && !this.submitting) await this.endView("time_cap", this.viewClock.elapsedSeconds());
  }

  /** The decision panel opens: the map stays, the sector plan is offered (both groups; revision (x), 6 Oct 2026: nothing before it). */
  private async openDecisionPanel(): Promise<void> {
    await this.event({ kind: "decision_panel_opened", detail: { cycle: this.currentCycle, atViewSeconds: this.timing.decisionOpensAtSeconds } });
    if (this.step === "exploration" || this.resumeStep === "exploration") this.goTo("allocation");
  }

  /**
   * SPEC/26 §2: a merged view reaches its second step halfway through its minimum length — the clock
   * moves to the step's start, the map's units, aircraft and rate marks to the second step's, and
   * the second step's pushed items arrive, so the map agrees with their move messages.
   */
  private async reachStepBoundary(atViewSeconds = this.timing.stepBoundaryAtSeconds!): Promise<void> {
    const cycleSpec = this.cycleSpec();
    if (!cycleSpec.stepBoundary) return;
    // Delivered when the SPAM item closes (`afterSpam`): never under an open question, whose key must not move. The ready
    // prompt holds nothing (revision (ag): it no longer expires, and shows no question).
    if (this.spam.itemOpen) { this.boundaryHeld = true; return; }
    this.loop.clock.advanceTo(cycleSpec.stepBoundary.atVirtual);
    this.currentStep += 1;
    // Review round 2 (4 Oct 2026): logged, so a plan can be placed before or after the boundary (`directiveAdherence`).
    await this.event({ kind: "step_boundary_reached", detail: { cycle: this.currentCycle, atViewSeconds } });
    this.renderTree = applyRenderEvent(this.renderTree, { kind: "step_boundary", cycle: cycleSpec });
    await this.deliverPushed(cycleSpec, STEP_SECONDS, Infinity);
    this.recordsBadge = this.recordsBadge || !this.hakuOpen; // difficulty audit (a.4): the second step's records are released now
    this.notify();
  }

  /**
   * The SAGAT freeze interrupts at its pre-planned moment, whatever the participant is doing; the view's time and the cap stand still.
   * `atViewEnd` (SPEC/30 §5.1, V10 and V14): after the view has ended and its plan's confidence is given — the same records,
   * blanked screen and items; `atViewSeconds` is the view's end moment, `decisionStep` "view_ended", and it leads on to what
   * follows the view (`submitFreeze`).
   */
  private async startFreeze(atViewSeconds: number, atViewEnd = false): Promise<void> {
    audioManager.enterFreeze();
    if (!atViewEnd) this.viewClock.pause(atViewSeconds);
    const decisionStep = atViewEnd ? "view_ended" : this.step;
    this.resumeStep = atViewEnd ? null : this.step;
    this.endFreeze = atViewEnd;
    this.step = "freeze"; // at once, so nothing else is submitted meanwhile; shown once `freeze_started` is durable (I5)
    await this.event({
      kind: "freeze_started",
      detail: { cycle: this.currentCycle, atViewSeconds, decisionCommittedBeforeFreeze: this.allocationCommitted, decisionStep },
    });
    this.freezeShownMs = this.realMs(); this.freezeItemAnsweredMs.clear(); this.freezeConfirmed.clear();
    this.clearFreezeCap();
    this.freezeCapTimer = setTimeout(() => { this.freezeCapTimer = null; void this.timeOutFreeze(); }, freezeMaxSecondsFor(this.freezeSpec()?.items.length ?? 0) * 1000); // `31` F12: 240 s for 8 items
    this.notify();
  }

  private clearFreezeCap(): void {
    if (this.freezeCapTimer !== null) clearTimeout(this.freezeCapTimer);
    this.freezeCapTimer = null;
  }

  /**
   * The freeze's cap (`FREEZE_MAX_SECONDS`, fix pass 7, 9 Oct 2026): the freeze closes with the items confirmed so far (left with
   * "Seuraava"), logged `timedOut: true`; every other item is listed in `missing` — missing, not wrong. An item on screen but not yet
   * confirmed is missing.
   */
  private async timeOutFreeze(): Promise<void> {
    if (this.step !== "freeze") return;
    await this.submitFreeze([...this.freezeConfirmed.values()], { timedOut: true }).catch(() => undefined);
  }

  /**
   * The screen left a freeze item ("Seuraava"; P1-5, 7 Oct 2026): its answer moment, on the session's
   * clock, written with the answers by `submitFreeze`. The first moment counts (no going back).
   * Fix pass 3: also logged at once (`freeze_item_completed`), so the moments of a freeze cut short by
   * a reload stay in the durable log; the view is then replayed from its start (SPEC/05 §9) and its
   * freeze logs its own.
   */
  async markFreezeItemAnswered(itemId: string, response?: FreezeItemAnsweredDetail): Promise<void> {
    if (this.step !== "freeze" || this.freezeItemAnsweredMs.has(itemId)) return;
    const items = this.freezeSpec()?.items ?? [];
    if (!items.some((it) => it.id === itemId)) throw new Error(`markFreezeItemAnswered: no item ${itemId} in this freeze`);
    const at = this.realMs();
    this.freezeItemAnsweredMs.set(itemId, at);
    // Fix pass 7: the confirmed answer is kept, so the cap can close the freeze with it (validated as any answer).
    if (response && response.itemId === itemId) this.freezeConfirmed.set(itemId, checkFreezeResponses(items, [response], this.scenario.extent)[0]!);
    await this.event({ kind: "freeze_item_completed", detail: { cycle: this.currentCycle, itemId, msSinceFreezeOpened: Math.round(at - this.freezeShownMs) } });
  }

  /**
   * The freeze's answers, validated (`freeze-answers.ts`); the participant continues where they were (`resumeStep`), the clock and cap running on.
   * `skipped` (demonstration only, 6 Oct 2026): the presenter skipped the rest of the freeze — the items answered so far, logged `skipped: true`.
   * `timedOut` (fix pass 7, 9 Oct 2026): the freeze's cap closed it (`timeOutFreeze`). Either way the items not answered are listed in
   * `missing`, as is any item a submission leaves out (the screen's submit stays off until every item is answered).
   */
  async submitFreeze(responses: readonly FreezeItemAnsweredDetail[], options: { readonly skipped?: boolean; readonly timedOut?: boolean } = {}): Promise<void> {
    if (options.skipped && !this.allowViewSkip) throw new Error("submitFreeze: skipping a freeze is for demonstrations only");
    const missing = (this.freezeSpec()?.items ?? []).map((it) => it.id).filter((id) => !responses.some((r) => r.itemId === id));
    const submittedMs = this.realMs(); // an item not left with "Seuraava" (the last) was answered by this submission
    const checked = checkFreezeResponses(this.freezeSpec()?.items ?? [], responses, this.scenario.extent).map((r) => {
      const at = this.freezeItemAnsweredMs.get(r.itemId) ?? submittedMs;
      return { ...r, answeredAtWallMs: Math.round(at - this.startedMs), msSinceFreezeOpened: Math.round(at - this.freezeShownMs) };
    });
    return this.guarded("freeze", "submitFreeze", async () => { // one submission only: a second click is refused (review 2 Oct 2026)
      await this.event({ kind: "freeze_submitted", detail: { cycle: this.currentCycle, responses: checked, ...(options.skipped ? { skipped: true as const } : {}), ...(options.timedOut ? { timedOut: true as const } : {}), ...(missing.length > 0 ? { missing } : {}) } });
      if (this.isPractice()) this.practiceHeadMark = checked.find((r) => r.itemId === PRACTICE_HEAD_ITEM_ID)?.point ?? null; // the feedback's map task
      this.clearFreezeCap();
      audioManager.exitFreeze();
      if (this.endFreeze) { this.endFreeze = false; await this.afterViewEnded("probes"); return; } // SPEC/30 §5.1: on to what follows the view
      this.step = this.resumeStep!;
      this.resumeStep = null;
      this.viewClock.resume();
      this.notify();
      await this.consult.flush(this.viewClock.elapsedSeconds()); // SPEC/30 §4: a notice that fell due under the freeze
      await this.openHeldReview(); // SPEC/32 §3: a review that fell due under the freeze
    });
    await this.flushProbes(); // a probe that fell due during the freeze (`flushProbes`)
  }

  /** Demonstration only: whether "skip" is offered now — inside a view, no SPAM item (a ready prompt is skipped with the view), freeze or probe open. */
  private skipAvailable(): boolean {
    return this.allowViewSkip && this.postViewOf === null && !this.spam.itemOpen && this.tour === null
      && (this.step === "exploration" || this.step === "allocation" || this.step === "awaiting_view_end");
  }

  /**
   * Demonstration only (6 Oct 2026): ends the current view now, wherever the presenter is in it — what
   * was left (the freeze still to come, the plan) is not asked. Logged as `view_ended.endedBy: "skipped"`
   * with the step it left; then whatever follows the view (V14's after-view probes, the training, the
   * hinge, the next view) comes as usual.
   */
  async skipView(): Promise<void> {
    if (!this.allowViewSkip) throw new Error("skipView: demonstration only");
    if (!this.skipAvailable() || this.submitting) throw new Error(`skipView in step ${this.step}${this.spam.open ? " (a SPAM item is open)" : ""}${this.submitting ? " (a submission is being written)" : ""}`);
    this.submitting = true;
    try {
      // Revision (ag): a ready prompt still up is logged `skipped` and closed, no item (as a skipped freeze leaves its items
      // missing); a SPAM prompt not yet due is not logged, as a freeze still to come is not.
      if (this.spam.readyOpen) await this.spam.skip();
      await this.endView("skipped", this.viewClock.elapsedSeconds());
    } finally { this.submitting = false; }
    // V14's after-view probes were queued while `submitting` held them back (`flushProbes`): shown now, as `guarded` does.
    if (this.postViewOf !== null) await this.flushProbes();
    this.notify();
  }

  /** The view's minimum length: a period confirmed earlier ends the view now. */
  private async reachMinimum(): Promise<void> {
    this.minimumReached = true;
    // A revision being written ends the view itself once recorded (`recordRevision`). SPEC/32 §3: in phase B a revision open at
    // the minimum is not dropped — the plan becomes final when it is recorded (the review then, `plan_after_minimum`) or the cap ends the view.
    if (this.periodConfirmed && !this.submitting && !(this.reviewApplies() && this.revisingAllocation)) {
      this.reviewTrigger = "minimum_reached";
      await this.endView("minimum_length", this.timing.minViewSeconds);
    } else this.notify();
  }

  private probeSuffix(): string { return this.isPractice() ? "practice" : `cycle_${this.currentCycle}`; }

  private async showEnvelope(): Promise<void> {
    if (this.renderTree.envelope) return;
    const envelope = this.isPractice() ? this.scenario.practice.envelope : this.scenario.envelopes.find((e) => e.cycle === this.currentCycle)!;
    this.renderTree = applyRenderEvent(this.renderTree, { kind: "envelope_revealed", envelope });
    await this.event({ kind: "envelope_revealed", detail: { cycle: this.currentCycle, envelopeId: `envelope.${this.probeSuffix()}` } });
  }

  private async guarded(step: JudgementStep, name: string, body: () => Promise<unknown>): Promise<void> {
    if (this.step !== step || this.submitting) throw new Error(`${name} in step ${this.step}${this.submitting ? " (already submitting)" : ""}`);
    this.assertNoSpamItem(name);
    this.submitting = true;
    const view = this.currentCycle;
    try { await body(); } finally { this.submitting = false; }
    if (this.capReached && this.currentCycle === view && this.step !== "freeze" && this.step !== "probe" && this.postViewOf === null) { await this.endView("time_cap", this.viewClock.elapsedSeconds()); return; }
    else if (this.endHeld && this.currentCycle === view && !this.spam.open && this.postViewOf === null) { const held = this.endHeld; this.endHeld = null; await this.endView(held, this.viewClock.elapsedSeconds()); return; }
    if (this.postViewOf !== null) { await this.flushProbes(); this.notify(); return; } // after-view probes held for the submission being written
    if (this.currentCycle !== view) return;
    await this.flushProbes();
  }

  /**
   * The sector plan, and later its revisions. No rationale is asked (revision (x), 6 Oct 2026: it followed a rejected
   * projection, and Type J is withdrawn); `allocation_submitted` logs it as not asked. A plan that tasks the drones gets a `drone_tasked` record per observation drone team on scene;
   * the world does not respond. The first submission confirms the period: the view ends now if its minimum has passed, else then.
   */
  async submitAllocation(plan: SectorPlan): Promise<void> {
    return this.guarded("allocation", "submitAllocation", () => (this.revisingAllocation ? this.recordRevision(plan) : this.recordAllocation(plan)));
  }

  private async recordOrders(plan: SectorPlan): Promise<void> {
    for (const e of droneTaskingEvents(this.scenario.allocationSpace, this.currentCycle, this.clockLabel(), plan)) await this.event(e);
  }

  private async recordAllocation(plan: SectorPlan): Promise<void> {
    assertValidPlan(this.scenario.allocationSpace, this.currentCycle, plan);
    await this.event({ kind: "allocation_submitted", detail: { plan: copyPlan(plan), rationaleAsked: false, rationaleFi: null } });
    this.allocationCommitted = true; // as soon as it is in the log: a freeze from here on records it as committed
    this.recordedPlan = copyPlan(plan);
    await this.recordOrders(plan);
    this.periodConfirmed = true;
    if (this.minimumReached) this.reviewTrigger = "plan_after_minimum"; // SPEC/32 §3: the plan is final now (phase B: the review first)
    if (this.minimumReached && !this.spam.itemOpen) { // a ready prompt still up is forced first (`endView`)
      if (this.spam.readyOpen) this.goTo("awaiting_view_end");
      await this.endView("participant_confirm", this.viewClock.elapsedSeconds());
    } else { if (this.minimumReached) this.endHeld = "participant_confirm"; this.goTo("awaiting_view_end"); } // held: the view ends when the SPAM item closes
  }

  /** "Muuta kohdennusta": back to the allocation while the confirmed view waits for its minimum length. */
  reviseAllocation(): Promise<void> {
    if (this.step !== "awaiting_view_end" || this.submitting || this.revisionOpening) throw new Error(`reviseAllocation in step ${this.step}`);
    this.assertNoSpamItem("reviseAllocation");
    // I5: the allocation opens again only once `allocation_revision_opened` is durable. Meanwhile the
    // view may end (its minimum, the cap) or a freeze or probe may interrupt: then the revision is not opened.
    this.revisionOpening = true;
    const view = this.currentCycle;
    return this.event({ kind: "allocation_revision_opened", detail: { cycle: view, atViewSeconds: this.viewClock.elapsedSeconds() } })
      .then(() => {
        const waiting = this.step === "awaiting_view_end" || ((this.step === "freeze" || this.step === "probe") && this.resumeStep === "awaiting_view_end");
        if (this.currentCycle !== view || this.postViewOf !== null || !waiting) return;
        this.revisingAllocation = true;
        this.goTo("allocation");
      })
      .finally(() => { this.revisionOpening = false; });
  }

  private async recordRevision(plan: SectorPlan): Promise<void> {
    assertValidPlan(this.scenario.allocationSpace, this.currentCycle, plan);
    this.revisionCount += 1;
    await this.event({ kind: "allocation_revised", detail: { cycle: this.currentCycle, revision: this.revisionCount, plan: copyPlan(plan) } });
    this.recordedPlan = copyPlan(plan);
    await this.recordOrders(plan);
    this.revisingAllocation = false;
    if (this.minimumReached) this.reviewTrigger = "plan_after_minimum"; // SPEC/32 §3 (none after a revision opened at the review: `review.done`)
    if (this.minimumReached && !this.spam.itemOpen) { // the minimum passed while the revision was written; a ready prompt is forced first
      if (this.spam.readyOpen) this.goTo("awaiting_view_end");
      await this.endView("minimum_length", this.viewClock.elapsedSeconds());
    } else { if (this.minimumReached) this.endHeld = "minimum_length"; this.goTo("awaiting_view_end"); } // held: the view ends when the SPAM item closes
  }

  /**
   * The view ends — unless a SPAM probe is open. An open item holds the end until it closes (`afterSpam`).
   * Revision (ag): a ready prompt still up at the end is FORCED — the view's clock stops at `viewSeconds`
   * (as a freeze stops it: no cue, the cap included, fires meanwhile), the item is shown as a modal step,
   * and the end is held for it; it happens, at that same view moment, when the probe closes.
   */
  private async endView(endedBy: ViewEndedDetail["endedBy"], viewSeconds: number): Promise<void> {
    if (this.spam.itemOpen) { this.endHeld = endedBy; this.notify(); return; } // notified: the minimum or the cap reached shows
    if (this.spam.readyOpen) {
      this.endHeld = endedBy;
      this.viewClock.pause(viewSeconds);
      await this.spam.force(viewSeconds, endedBy);
      return;
    }
    // SPEC/32 §3: in phase B the plan review comes first (held, as the end is, by the SPAM item above); the cap closes an open one.
    if (this.review.open) {
      if (endedBy !== "time_cap") throw new Error(`endView(${endedBy}) while the plan review is open`);
      await this.review.close("time_cap");
    } else if ((endedBy === "participant_confirm" || endedBy === "minimum_length") && this.reviewDue()) {
      await this.openPlanReview(endedBy, viewSeconds);
      return;
    }
    this.reviewTrigger = null;
    this.viewClock.stop(); this.capReached = false;
    const finished = this.currentCycle;
    this.lastViewTimedOutWithoutPlan = endedBy === "time_cap" && !this.allocationCommitted; // shown at the next view's start
    await this.event({ kind: "view_ended", detail: { cycle: finished, viewSeconds, endedBy, ...(endedBy === "time_cap" || endedBy === "skipped" ? { stepAtEnd: this.step } : {}) } });
    await this.consult.viewEnded(); // SPEC/30 §4: a notice still open is dismissed by the end
    this.probeQueue = []; this.visible.reset(); this.revisingAllocation = false; // a revision still open is dropped
    this.minSecondsLeft = this.capSecondsLeft = null; // the view's countdowns are over (the plan's confidence and an end freeze have none)
    this.viewEnd = { view: finished, viewSeconds, skipped: endedBy === "skipped" };
    await this.afterViewEnded("plan_confidence");
  }

  /**
   * What follows a view's end, in order (SPEC/30; `plan-confidence.ts`): the plan's confidence (main views, not after a
   * demonstration skip), the end-of-view freeze (V10, V14), the after-view probes (V14's U backup and coverage confidence,
   * the view's map on screen), then `leaveView`. Each stage that waits for the participant returns; its answer calls on.
   */
  private async afterViewEnded(from: "plan_confidence" | "freeze" | "probes"): Promise<void> {
    const end = this.viewEnd!;
    if (from === "plan_confidence" && end.view !== PRACTICE_VIEW_INDEX && !end.skipped) {
      this.resumeStep = null;
      this.step = "plan_confidence"; // at once, so nothing else is submitted; the item shows once its record is durable (I5)
      await this.planConfidence.present(end.view as CycleIndex);
      return;
    }
    if (from !== "probes" && !end.skipped && this.timing.freezeAtViewEnd && this.freezeOf()) { await this.startFreeze(end.viewSeconds, true); return; }
    const after = this.probesDue("after_view", end.view);
    if (after.length > 0) {
      this.postViewOf = end.view;
      this.resumeStep = null;
      this.step = "probe";
      this.probeQueue = after.map((probe) => ({ probe, atViewSeconds: null }));
      this.notify();
      await this.flushProbes();
      return;
    }
    await this.leaveView(end.view);
  }

  /** SPEC/30 §5.4: the plan's confidence (25/50/75/100); then the end-of-view freeze, the after-view probes or the next view. */
  async submitPlanConfidence(value: number): Promise<void> {
    if (this.step !== "plan_confidence" || this.submitting) throw new Error(`submitPlanConfidence in step ${this.step}${this.submitting ? " (already submitting)" : ""}`);
    this.submitting = true;
    try {
      await this.planConfidence.submit(value);
      await this.afterViewEnded("freeze");
    } finally { this.submitting = false; }
    if (this.postViewOf !== null) await this.flushProbes(); // after-view probes held for the submission being written
    this.notify();
  }

  // ---- The plan review at commitment (SPEC/32 §3; `plan-review.ts`) ---------------------------------------------------

  /** Phase B (V8–V14), never the practice view. */
  private reviewApplies(): boolean { return !this.isPractice() && this.cycleSpec().phase === "B"; }

  /** The plan is about to become final: a phase-B view whose review has not opened yet, a plan recorded and no revision open. */
  private reviewDue(): boolean {
    return this.reviewApplies() && !this.review.done && this.allocationCommitted && !this.revisingAllocation;
  }

  /**
   * Opens the review where the view would have ended with `endedBy`: the view's clock stops at `viewSeconds` (as a freeze stops
   * it), the step is `plan_review` at once, and the guide group's premise lookup runs before `plan_review_shown` is written. A
   * freeze or a visible probe open then holds it until it closes (`reviewHeld`).
   */
  private async openPlanReview(endedBy: PlanReviewEnd, viewSeconds: number): Promise<void> {
    if (this.step === "freeze" || this.step === "probe") { this.reviewHeld = endedBy; this.notify(); return; }
    const trigger: PlanReviewTrigger = this.reviewTrigger ?? (endedBy === "participant_confirm" || viewSeconds > this.timing.minViewSeconds ? "plan_after_minimum" : "minimum_reached");
    this.reviewTrigger = null;
    this.viewClock.pause(viewSeconds);
    this.resumeStep = null;
    this.step = "plan_review"; // at once, so nothing else is submitted; shown once `plan_review_shown` is durable (I5)
    this.notify();
    const lookup = this.cell === PREMISE_REVIEW_CELL ? () => this.queries.premiseReview() : null; // the Haku group: no request
    await this.review.present(this.currentCycle as CycleIndex, trigger, endedBy, viewSeconds, lookup);
  }

  /** A review held by a freeze or a visible probe (`openPlanReview`) opens now that it has closed. */
  private async openHeldReview(): Promise<void> {
    const held = this.reviewHeld;
    if (held === null) return;
    this.reviewHeld = null;
    await this.endView(held, this.viewClock.elapsedSeconds());
  }

  /** "Vahvista kohdennus": the review closes (`keep`) and the view ends as it would have (`participant_confirm` or `minimum_length`). */
  async keepPlan(): Promise<void> {
    if (!this.review.onScreen) throw new Error(`keepPlan in step ${this.step} (no plan review on screen)`);
    return this.guarded("plan_review", "keepPlan", async () => {
      const endedBy = this.review.end;
      await this.review.close("keep");
      await this.endView(endedBy, this.viewClock.elapsedSeconds());
    });
  }

  /**
   * "Muuta kohdennusta": the review closes (`revise`) and the allocation opens again by the revision path
   * (`allocation_revision_opened`; the plan recorded is the form's prefill), the clock running again. The view ends when the
   * revision is recorded, with no second review (`review.done`). Fewer than {@link REVIEW_REVISION_MIN_SECONDS} left before the
   * cap: the cap moves to leave that many (`capExtendedToSeconds`). The cap's cues are set again either way, so a view resumed
   * into a forced SPAM item (started without cues) has its cap too.
   */
  async revisePlan(): Promise<void> {
    if (!this.review.onScreen) throw new Error(`revisePlan in step ${this.step} (no plan review on screen)`);
    return this.guarded("plan_review", "revisePlan", async () => {
      const at = this.viewClock.elapsedSeconds();
      const cap = Math.max(this.capSeconds, Math.round((at + REVIEW_REVISION_MIN_SECONDS) * 1000) / 1000);
      const extended = cap > this.capSeconds;
      await this.review.close("revise", extended ? cap : undefined);
      await this.event({ kind: "allocation_revision_opened", detail: { cycle: this.currentCycle, atViewSeconds: at } });
      this.viewClock.add(this.capCuesAt(cap));
      if (extended) this.capSecondsLeft = null; // the countdown starts again at the new cap
      this.revisingAllocation = true;
      this.step = "allocation";
      this.viewClock.resume();
      this.notify();
    });
  }

  /** A record a premise line cites, opened from the review: `plan_review_record_opened`, then shown in the message log. */
  openReviewRecord(atomId: string): Promise<void> {
    if (this.step !== "plan_review") throw new Error(`openReviewRecord in step ${this.step}`);
    return this.review.openRecord(atomId);
  }

  /** A cited record as the message log shows it (`deliverPushed`'s row), whether or not it was pushed. */
  private citedRecordOf(atomId: string, premiseId: string): PlanReviewCitedRecord | null {
    const atom = this.scenario.atoms.find((a) => a.id === atomId);
    if (!atom) return null;
    const { renderable, row } = logRowOf(atom);
    return { ...row, id: renderable.id, atomId, premiseId, inLog: this.queries.radioLog.some((e) => e.id === atomId) };
  }

  /** Real time since the view opened (ms), its tour, freezes and probes included: the working period `drawerOpenFraction` divides by. */
  private viewRealMs(): number { return Math.round(this.realMs() - this.viewOpenedMs); }

  /** What follows a view's end: the training (after VP), the hinge (after V7), the session's end (after V14) or the next view. */
  private async leaveView(finished: ViewIndex): Promise<void> {
    if (finished === PRACTICE_VIEW_INDEX) {
      // SPEC/26 D3: the practice view is outside the engine's schedule; the training follows it
      // (SPEC/15 §2), and the main timeline starts at V1 once TUTORIAL is complete.
      await this.event({ kind: "cycle_end", detail: { cycle: finished, totalRealDurationMs: this.viewRealMs() } });
      await this.transition("warmup_complete");
      if (this.practiceFeedbackOn) return this.showPracticeFeedback(); // difficulty audit (b.3): before the training
      this.showIntro("training");
      this.notify();
      return;
    }

    this.loop.endCycle();
    await this.event({ kind: "cycle_end", detail: { cycle: finished, totalRealDurationMs: this.viewRealMs() } });

    if (finished === this.lastView) { // the last main view: V14, or V7 in a phase-A session (SPEC/35 §2: no hinge, the session ends)
      closeTimelineAt(this.loop, finished, cycleScheduleOf(this.scenario));
      audioManager.stopAndFadeOut();
      if (this.studyShell) await this.showQuestionnaire("post"); // SPEC/09 §5.1: the questionnaire before any debrief content
      else this.step = "complete";
      this.notify();
      return;
    }
    if (finished === this.scenario.hinge.afterCycle) return this.enterHinge(); // SPEC/26 §3: after V7
    await this.enterCycle((finished + 1) as CycleIndex);
  }

  // Haku and Thinker (`queries.ts`). Nobody can ask a unit (SPEC/02 revision (j)).
  // Usable while a SPAM item is open (revision (ag), 9 Oct 2026; D4's lock withdrawn); locked while a visible probe is.
  /** Haku's free text: the results are returned (shown) once the query and its results are logged (I5). */
  searchAtoms(query: string): Promise<readonly RenderableAtom[]> {
    this.assertToolsFree("searchAtoms");
    const results = this.queries.searchAtoms(query);
    return this.queries.logTextQuery(query, results).then(() => results);
  }
  async askAiChat(query: string): Promise<TemplateAnswer> {
    this.assertToolsFree("askAiChat");
    this.thinkerPending += 1; this.readingGraceMs = 0; this.notify(); // waiting on the session: no idle time (`attention.ts`)
    try {
      const answer = await this.queries.askAiChat(query);
      this.readingGraceMs = readingGraceMsFor(answer.answerFi.length + answer.basisFi.length + answer.certaintyFi.length + answer.wouldChangeIfFi.length);
      return answer;
    } finally { this.thinkerPending -= 1; this.notify(); }
  }
  async askOpenThinker(query: string, options: { readonly viaChip?: boolean } = {}): Promise<string> {
    this.assertToolsFree("askOpenThinker");
    this.thinkerPending += 1; this.readingGraceMs = 0; this.notify();
    try {
      const answer = await this.queries.askOpenThinker(query, options.viaChip === true);
      this.readingGraceMs = readingGraceMsFor(answer.length);
      return answer;
    } finally { this.thinkerPending -= 1; this.notify(); }
  }
  /** SPEC/30 §4: the guide's suggested-question chip — exactly its question, the Thinker's normal path, logged `viaChip`. */
  async askSuggestedQuestion(): Promise<string> {
    if (this.isPractice() || !suggestedQuestionOffered(this.cell, this.currentCycle, this.scenario.hinge.afterCycle)) throw new Error(`askSuggestedQuestion in V${this.currentCycle} (${this.cell}): the chip is the guide group's, from V8`);
    return this.askOpenThinker(SUGGESTED_QUESTION[this.language], { viaChip: true });
  }
  /** SPEC/30 §4: the consult notification's button; resolves to the tool the screen opens, once `consult_prompt_opened` is durable. */
  openConsultPrompt(): Promise<ConsultTool> { return this.consult.openTool(); }
  /** SPEC/30 §4: the consult notification's close button (`consult_prompt_dismissed`, `participant`). */
  dismissConsultPrompt(): Promise<void> { return this.consult.dismiss(); }
  /** SPEC/30 §5.4: a decision-strip or SPAM-card interaction record (hover, answer change); raw, never gating the screen. */
  logPanelUse(event: PanelUseEvent): Promise<unknown> { return this.event(event); }
  /** The right-panel tool tab the participant selects (`none`: closed); logged for the tool-use sequence (P1-1, 8 Oct 2026). */
  logTabSelected(tool: "haku" | "open_thinker" | "indexed_search" | "none"): Promise<unknown> {
    // Difficulty audit (a.4): opening Haku clears the "New records" badge; the badge is not set again while Haku stays open.
    this.hakuOpen = tool === "haku";
    if (this.hakuOpen && this.recordsBadge) { this.recordsBadge = false; this.notify(); }
    return this.event({ kind: "tab_selected", detail: { tool, view: this.currentCycle, phase: this.phaseTag() } });
  }
  /**
   * Map use (SPEC/07 revision (al)): the live map's camera, pointer on unit markers, the legend's toggle, the labels
   * shown, the memory-check map's taps and the window-size cover. Raw records only; resolves to the record's seq (a
   * `click` refers to the last `viewport_changed` by it).
   */
  async logMapUse(event: MapUseEvent): Promise<number> {
    const record = (await this.event(event)) as { readonly seq: number };
    return record.seq;
  }
  /** A tap on the memory-check map with its camera then (`freeze_map_pick`, revision (al)); the view is the session's. */
  logFreezeMapPick(itemId: string, point: LatLon, camera: { readonly zoom: number; readonly centre: LatLon; readonly mapPx: { readonly width: number; readonly height: number } }): Promise<number> {
    return this.logMapUse({ kind: "freeze_map_pick", detail: { cycle: this.currentCycle, itemId, point, ...camera } });
  }
  navigationSources(): readonly string[] { return this.queries.navigationSources(); }
  logNavSlot(slot: "category" | "source" | "window", value: string | null): Promise<void> { this.assertToolsFree("logNavSlot"); return this.queries.logNavSlot(slot, value); }
  navigateQuery(query: NavQuery): Promise<readonly RenderableAtom[]> { this.assertToolsFree("navigateQuery"); return this.queries.navigateQuery(query); }

  /** The hinge screen: the directive, then the manipulation check if the scenario has one. */
  private async enterHinge(): Promise<void> {
    audioManager.stopAndFadeOut();
    await this.event({ kind: "hinge_pause_start", detail: { pauseSeconds: this.scenario.hinge.pauseSeconds } });
    this.hingeShownMs = this.realMs();
    this.hingeCheck.enter();
    this.step = "hinge_pause";
    this.notify();
  }

  async dismissHinge(): Promise<void> {
    if (this.step !== "hinge_pause") throw new Error(`dismissHinge in step ${this.step}`);
    this.hingeCheck.leave(); // refused before the manipulation check is answered
    this.step = "exploration"; // a second click finds the hinge already left
    this.loop.dismissHinge();
    // Review round 2 (4 Oct 2026): the real dwell on the hinge screen (the directive's reading time, the manipulation's exposure); early = before the pause's length.
    const realDurationMs = Math.round(this.realMs() - this.hingeShownMs);
    await this.event({ kind: "hinge_pause_end", detail: { realDurationMs, dismissedEarly: realDurationMs < this.scenario.hinge.pauseSeconds * 1000 } });
    await this.event({ kind: "phase_entered", detail: { phase: "phase_b" } });
    await this.enterCycle((this.scenario.hinge.afterCycle + 1) as CycleIndex);
  }

  // ---- SPAM (`spam-delivery.ts`) -----------------------------------------------------------------

  /** This view's SPAM probe (type S), if any; in the practice view, the practice item (5 Oct 2026, `practice-spam.ts`). */
  private spamProbe(): SpamProbe | ProbeSpec | null {
    if (this.isPractice()) return this.scenario.practice.spam ?? null;
    return this.scenario.probeSchedule.probes.find((p) => p.type === "S" && p.cycle === this.currentCycle && !p.id.endsWith(SECOND_SPAM_SUFFIX)) ?? null;
  }

  /** SPEC/30 §5.2: the item shown after `first` under the same "ready" (`<first id>.b`), if the scenario has one. */
  private secondSpamOf(first: SpamProbe | ProbeSpec): SpamProbe | null {
    const id = secondSpamProbeId(first.id);
    // Difficulty audit (23 Oct 2026): the practice item's second, the measuring task (`practice-measure.ts`).
    const practice = this.scenario.practice.spamSecond;
    if (practice && practice.id === id) return practice;
    return this.scenario.probeSchedule.probes.find((p) => p.id === id && p.type === "S") ?? null;
  }

  /**
   * The SPAM cue on the view's clock: never meeting a freeze — in a view without one, or (the practice
   * view) one whose freeze comes before the prompt, so the freeze is over (the view's clock stands still
   * during it) when the prompt comes; the offset scaled like every view moment.
   */
  private spamCues(freezeAtSeconds: number | null): { atSeconds: number; fire: () => void }[] {
    const probe = this.spamProbe();
    if (!probe || probe.offsetInWorkingPeriodMs === undefined) return [];
    const atSeconds = scaleViewSeconds(probe.offsetInWorkingPeriodMs / 1000, this.previewOverride);
    if (freezeAtSeconds !== null && !(this.isPractice() && freezeAtSeconds < atSeconds)) return [];
    const cycle = this.currentCycle;
    return [{ atSeconds, fire: () => { if (this.step !== "freeze" && this.step !== "hinge_pause" && this.currentCycle === cycle) void this.spam.show(probe, cycle, atSeconds, this.secondSpamOf(probe)); } }];
  }

  /** The SPAM probe closed: the step boundary and a view end held for it happen now. */
  private async afterSpam(): Promise<void> {
    if (this.boundaryHeld) { this.boundaryHeld = false; await this.reachStepBoundary(this.viewClock.elapsedSeconds()); }
    // A submission in progress ends the view itself once recorded (`guarded`).
    if (this.endHeld && !this.submitting) { const held = this.endHeld; this.endHeld = null; await this.endView(held, this.viewClock.elapsedSeconds()); return; }
    await this.consult.flush(this.viewClock.elapsedSeconds()); // SPEC/30 §4: a notice that fell due under the item
    await this.flushProbes(); // a visible probe that fell due while the SPAM probe was open
  }

  private assertNoSpamItem(name: string): void {
    if (this.spam.itemOpen) throw new Error(`${name} while a SPAM item is open (the decision panel is held)`);
  }

  /**
   * Haku and Thinker work only inside a view, the map on screen: never during a freeze (the picture is
   * hidden), the hinge, the briefing, the training or a study-shell screen (6 Oct 2026), nor while a
   * visible probe is open. A SPAM item does not lock them (revision (ag), 9 Oct 2026, superseding D4):
   * the question is answered as the commander would, tools at hand — the forced item at the view's end
   * included, whose paused end-of-view state keeps the view's step (allocation / awaiting_view_end), so
   * the step gate here accepts it.
   */
  private assertToolsFree(name: string): void {
    if (!TOOL_STEPS.has(this.step)) throw new Error(`${name} in step ${this.step} (Haku and Thinker work only inside a view)`);
    if (this.visible.open) throw new ProbeToolsLockedError(name);
  }

  /** "Valmis vastaamaan?" accepted: the question shows (the decision panel is held; the tools stay usable). */
  spamReady(): Promise<void> { return this.spam.ready(); }
  /** The ready prompt collapsed to its pill / expanded again (revision (ag)); the probe stays pending. */
  collapseSpam(): Promise<void> { return this.spam.collapse(); }
  expandSpam(): Promise<void> { return this.spam.expand(); }
  /** The SPAM option (final). */
  answerSpam(optionId: string): Promise<void> { return this.spam.answer(optionId); }
  /** The SPAM item's confidence (25/50/75/100); the probe closes. */
  submitSpamConfidence(value: number): Promise<void> { return this.spam.confidence(value); }

  // ---- The visible probes F, U (`visible-probes.ts`; placement and reasons in `demo-probes.ts`) ----------

  /** This view's visible probes delivered at `at`, in schedule order. None in the practice view. */
  private probesDue(at: NonNullable<ProbeSpec["delivery"]>["at"], view: ViewIndex = this.postViewOf ?? this.currentCycle): ProbeSpec[] {
    if (!this.visibleProbesOn || view === PRACTICE_VIEW_INDEX) return [];
    return this.scenario.probeSchedule.probes
      .filter((p) => p.cycle === view && p.delivery?.at === at)
      .sort((a, b) => a.orderWithinCycle - b.orderWithinCycle);
  }

  /** Probes at a fixed moment on the view's clock (V13's open U), scaled like every view moment. */
  private visibleProbeCues(): { atSeconds: number; fire: () => void }[] {
    const cycle = this.currentCycle;
    return this.probesDue("view_seconds").flatMap((probe) => {
      if (probe.delivery?.at !== "view_seconds") return [];
      const atSeconds = scaleViewSeconds(probe.delivery.seconds, this.previewOverride);
      return [{ atSeconds, fire: () => { if (this.currentCycle !== cycle) return; this.probeQueue.push({ probe, atViewSeconds: atSeconds }); void this.flushProbes(); } }];
    });
  }

  /**
   * Shows the next waiting probe, unless something must close first: a visible probe, a SPAM probe, a
   * freeze, or a submission being written. The view's clock stands still while the probe is open (the
   * freeze's rule, SPEC/15 r.12): `atViewSeconds` pins it to the probe's own moment when it has one.
   */
  private async flushProbes(): Promise<void> {
    if (this.visible.open || this.spam.open || this.step === "freeze" || this.step === "plan_review" || this.submitting || this.probeQueue.length === 0) return;
    const { probe, atViewSeconds } = this.probeQueue.shift()!;
    const inView = this.postViewOf === null;
    if (inView) {
      if (atViewSeconds !== null) this.viewClock.pause(atViewSeconds); else this.viewClock.pause();
      if (this.step !== "probe") { this.resumeStep = this.step; this.step = "probe"; }
    }
    await this.visible.present(probe, {
      cycle: this.postViewOf ?? this.currentCycle,
      atViewSeconds: inView ? this.viewClock.elapsedSeconds() : null,
      decisionStep: inView ? this.resumeStep : null,
    });
  }

  /** A visible probe is answered: the next one, or back to where the participant was (the clock runs on), or — after the view — on to what follows it. */
  private async afterVisibleProbe(): Promise<void> {
    if (this.probeQueue.length > 0) { await this.flushProbes(); this.notify(); return; }
    if (this.postViewOf !== null) {
      const finished = this.postViewOf;
      this.postViewOf = null;
      await this.leaveView(finished);
      return;
    }
    this.step = this.resumeStep ?? "allocation";
    this.resumeStep = null;
    this.viewClock.resume();
    this.notify();
    await this.openHeldReview(); // SPEC/32 §3: a review that fell due under the probe
  }

  private async answerVisible(name: string, body: () => Promise<void>): Promise<void> {
    if (this.step !== "probe" || !this.visible.open || this.submitting) throw new Error(`${name} in step ${this.step}${this.visible.open ? "" : " (no visible probe)"}`);
    this.submitting = true;
    try { await body(); } finally { this.submitting = false; }
    await this.afterVisibleProbe();
  }

  /** V13's area item (revision (ai)): the yes/no and, on yes, the parts of the picture. */
  submitProbeArea(unsure: boolean, areaIds: readonly string[]): Promise<void> { return this.answerVisible("submitProbeArea", () => this.visible.submitArea(unsure, areaIds)); }
  /** V14's forced-choice backup: an option as shown, with its confidence (revision (ai)). */
  submitProbeChoice(optionId: string, confidence?: number): Promise<void> { return this.answerVisible("submitProbeChoice", () => this.visible.submitChoice(optionId, confidence)); }
  /** V14's coverage confidence, on the one scale. */
  submitProbeScale(value: number): Promise<void> { return this.answerVisible("submitProbeScale", () => this.visible.submitScale(value)); }

  // ---- The manipulation check on the hinge screen (brief D3) ----------------------------------------

  /** The directive is read: the question is shown (`hinge_check_presented`, the answer latency's time base). */
  showHingeCheck(): Promise<void> { return this.hingeCheck.show(this.step); }
  /** The check's answer: one submission, one of its options; Continue is enabled after it. */
  answerHingeCheck(optionId: string): Promise<void> { return this.hingeCheck.answer(this.step, optionId); }

  // ---- The study shell (work package I, 5 Oct 2026) ---------------------------------------------------

  private shellDwellMs(): number { return Math.round(this.realMs() - this.shellShownMs); }

  /**
   * The consent screen's decision: the first record after the header (`consent_decided`, its time the
   * record's `tWallOffsetMs`). Declining ends the session (BOOT -> ABORTED): nothing else is recorded.
   * Accepting moves on to the preflight (BOOT -> PREFLIGHT), or first to the AI literacy test when it
   * is on (revision (ac): the first data collected after consent; the engine waits in PREFLIGHT).
   * The attestation is logged as given.
   */
  async decideConsent(accepted: boolean, attested: boolean): Promise<void> {
    if (this.step !== "consent" || this.submitting) throw new Error(`decideConsent in step ${this.step}`);
    this.submitting = true;
    try {
      await this.event({ kind: "consent_decided", detail: { decision: accepted ? "accepted" : "declined", attested: accepted && attested, textId: consentTextId(this.publicLayer.audience), dwellMs: this.shellDwellMs() } });
      if (!accepted) {
        await this.transition("consent_declined");
        this.step = "consent_declined";
      } else {
        await this.transition("start");
        if (this.aiLiteracyOn) await this.showAiLiteracy(new Map(), 0, false);
        else this.step = "preflight";
      }
    } finally { this.submitting = false; }
    this.notify();
  }

  // ---- The AI literacy test (9 Oct 2026, revision (ac); `ai-literacy.ts`) ----------------------------

  private async showAiLiteracy(kept: ReadonlyMap<string, number>, spentMs: number, resumed: boolean): Promise<void> {
    this.step = "ai_literacy";
    await this.aiLiteracy.start(kept, spentMs, resumed); // may end at once (every item kept): then the step is already "preflight"
  }

  /** An item on the screen rated 1–7 (again: the last rating counts); logged at once. */
  async answerAiLiteracy(itemId: string, rating: number): Promise<void> {
    if (this.step !== "ai_literacy") throw new Error(`answerAiLiteracy in step ${this.step}`);
    await this.aiLiteracy.answer(itemId, rating);
  }

  /** "Next": every item on the screen rated; on the last screen the questionnaire ends (`completed`) and the preflight follows. */
  async nextAiLiteracyPage(): Promise<void> {
    if (this.step !== "ai_literacy") throw new Error(`nextAiLiteracyPage in step ${this.step}`);
    await this.aiLiteracy.next();
  }

  /** "Skip the test" (both conditions alike): the answers so far are submitted, the rest are missing; on to the preflight. */
  async skipAiLiteracy(): Promise<void> {
    if (this.step !== "ai_literacy") throw new Error(`skipAiLiteracy in step ${this.step}`);
    await this.aiLiteracy.skip();
  }

  /** The countdown on the test screen (whole seconds), read by the screen's own ticker. */
  aiLiteracySecondsLeft(): number { return this.step === "ai_literacy" ? this.aiLiteracy.secondsLeft() : 0; }

  /**
   * One preflight evaluation of the browser's environment (`preflight.ts`). Logged when its outcome
   * differs from the last one logged (a re-check on resize logs only a change). Passed (or, in a
   * demonstration, overridden): PREFLIGHT -> BRIEFING and the pre-session item. A hard failure
   * aborts (PREFLIGHT -> ABORTED) unless a demonstration may override; any other failure keeps the
   * refusal screen, which re-checks.
   */
  async submitPreflight(env: PreflightEnv, override = false): Promise<PreflightOutcome> {
    if (this.step !== "preflight" || this.submitting) throw new Error(`submitPreflight in step ${this.step}`);
    if (override && !this.allowPreflightOverride) throw new Error("submitPreflight: override is for demonstrations only");
    const outcome = evaluatePreflight(env);
    this.submitting = true;
    try {
      const key = `${outcome.failures.join(",")}|${override}`;
      if (key !== this.loggedPreflight || outcome.passed || override) {
        await this.event({ kind: "preflight_result", detail: preflightRecord(env, outcome, override && !outcome.passed) });
        this.loggedPreflight = key;
      }
      this.preflightOutcome = outcome;
      if (outcome.passed || override) {
        await this.transition("preflight_passed");
        await this.showQuestionnaire("pre");
      } else if (outcome.hard && !this.allowPreflightOverride) {
        await this.transition("preflight_refused");
        this.step = "preflight_refused";
      }
    } finally { this.submitting = false; }
    this.notify();
    return outcome;
  }

  private questionnaireView(): QuestionnaireView | null {
    if (this.questionnaireId === null) return null;
    const check = this.scenario.hinge.manipulationCheck;
    return {
      id: this.questionnaireId,
      items: questionnaireItems(this.questionnaireId, this.log.header.cell, this.optionSeed(), this.publicLayer),
      retentionOptions: check ? retentionOrder(check.options.map(({ id, labelFi }) => ({ id, labelFi }))) : [],
    };
  }

  /** The participant's option-order stream (revision (ai), `option-order.ts`): the same after a resume. */
  private optionSeed(): OptionOrderSeed {
    return { scenarioSeed: this.scenario.seed, scenarioId: this.scenario.id, participantCode: this.log.header.participantCode };
  }

  private async showQuestionnaire(id: QuestionnaireId): Promise<void> {
    this.questionnaireId = id;
    this.step = "questionnaire";
    this.shellShownMs = this.realMs();
    const view = this.questionnaireView()!;
    const order = view.items.some((i) => i.id === RETENTION_ITEM_ID) ? { retentionOptionOrder: view.retentionOptions.map((o) => o.id) } : {};
    const multi = multiOptionOrders(view.items);
    await this.event({ kind: "questionnaire_presented", detail: { questionnaireId: id, itemIds: view.items.map((i) => i.id), ...order, ...(multi.length > 0 ? { multiOptionOrders: multi } : {}) } });
  }

  /**
   * A questionnaire's answers (raw, `questionnaire.ts`): the pre-session item leads to the practice view (the briefing step passed at
   * once, revision (ae)), the post-session questionnaire to the debrief. SPEC/35: in a public session, through the primer. SPEC/36:
   * after the post-session questionnaire, in every session, the results step (then the profile when it is on, then the debrief).
   */
  async submitQuestionnaire(answers: Readonly<Record<string, QuestionnaireValue | undefined>>): Promise<void> {
    if (this.step !== "questionnaire" || this.submitting || this.questionnaireId === null) throw new Error(`submitQuestionnaire in step ${this.step}`);
    const view = this.questionnaireView()!;
    const checked = checkQuestionnaireAnswers(view.items, answers, view.retentionOptions.map((o) => o.id));
    this.submitting = true;
    try {
      await this.event({ kind: "questionnaire_submitted", detail: { questionnaireId: view.id, answers: checked, dwellMs: this.shellDwellMs() } });
      this.questionnaireId = null;
      if (view.id === "pre" && this.publicLayer.isPublic) this.showShellStep("primer");
      else if (view.id === "post") this.showShellStep("results_optin"); // SPEC/36: nothing is logged until the participant answers
    } finally { this.submitting = false; }
    if (view.id === "pre" && !this.publicLayer.isPublic) return this.afterPreSession(); // the pretest (when on), then the briefing
    this.notify();
  }

  /** The briefing step: the intro video, or (without one) passed at once to the practice view (revision (ae)). */
  private async toBriefing(): Promise<void> {
    this.showIntro("briefing");
    if (!this.introVideo) return this.passBriefing();
    this.notify();
  }

  private showShellStep(step: "primer" | "profile" | "debrief" | "results_optin"): void {
    this.step = step;
    this.shellShownMs = this.realMs();
  }
  private async showProfile(): Promise<void> { this.showShellStep("profile"); await this.event({ kind: "profile_shown", detail: {} }); }
  private async showDebrief(): Promise<void> { this.showShellStep("debrief"); await this.event({ kind: "debrief_shown", detail: { textId: this.debriefId() } }); }
  private debriefId(): string { return debriefTextId(this.log.header.cell, this.publicLayer); }

  // ---- The public-audience version (SPEC/35; `public-session.ts`) ----------------------------------------------------

  /** Who the session is for and how much of it runs (SPEC/35 §2), as its header logs them. */
  get audience(): Audience { return this.publicLayer.audience; }
  get scope(): SessionScope { return this.publicLayer.scope; }

  /** The primer's callbacks (`PrimerScreenProps`): a page left with its dwell, a check answered; logged at once. */
  primerPage(pageId: string, dwellMs: number): Promise<void> { return this.publicLayer.primerPage(this.step, pageId, dwellMs); }
  primerCheck(questionId: string, chosen: number, correct: boolean, attempt: number): Promise<void> { return this.publicLayer.primerCheck(this.step, questionId, chosen, correct, attempt); }

  /** The primer is done (`briefing_advanced` "briefing.primer", its dwell): on to the intro video and the practice view. */
  async finishPrimer(): Promise<void> {
    if (this.step !== "primer" || this.submitting) throw new Error(`finishPrimer in step ${this.step}`);
    this.submitting = true;
    try {
      await this.event({ kind: "briefing_advanced", detail: { screenId: PRIMER_SCREEN_ID, dwellMs: this.shellDwellMs() } });
    } finally { this.submitting = false; }
    return this.afterPreSession(); // the pretest (when on), then the intro video and the practice view
  }

  /**
   * SPEC/36: the answer on the results step — `true` only once the study server has stored the participant's address (the screen
   * sends it, `results-contact.ts`; the address never reaches the session or its log), `false` for Skip or for continuing without
   * a server. One record (`results_optin`), then the profile when it is on (`?profiili=heti`), else the debrief.
   */
  async decideResultsOptIn(optedIn: boolean): Promise<void> {
    if (this.step !== "results_optin" || this.submitting) throw new Error(`decideResultsOptIn in step ${this.step}`);
    if (typeof optedIn !== "boolean") throw new RangeError(`decideResultsOptIn: ${String(optedIn)} is not a boolean`);
    this.submitting = true;
    try {
      await this.event({ kind: "results_optin", detail: { optedIn } });
      await (this.immediateProfile ? this.showProfile() : this.showDebrief());
    } finally { this.submitting = false; }
    this.notify();
  }

  /** SPEC/36: whether the commander profile follows the results step (the header's `immediateProfile`). */
  get profileOnScreen(): boolean { return this.immediateProfile; }

  /** The commander profile is left: the debrief. */
  async finishProfile(): Promise<void> {
    if (this.step !== "profile" || this.submitting) throw new Error(`finishProfile in step ${this.step}`);
    this.submitting = true;
    try { await this.showDebrief(); } finally { this.submitting = false; }
    this.notify();
  }

  /**
   * A glossary term or a help-card section opened (SPEC/35 §3; `AudienceInfo`'s callbacks): one record, nothing else — no clock
   * paused, no step or view changed. Public sessions only; nothing before the consent decision or after `session_completed`.
   */
  recordAudienceEvent(event: AudienceEvent): Promise<void> {
    return this.publicLayer.use(event, this.step, this.currentCycle, this.completed || this.step === "consent" || this.step === "consent_declined");
  }

  /** The debrief is read: DEBRIEF_HANDOFF -> COMPLETE; the closing screen with the no-discussion request. */
  async finishDebrief(): Promise<void> {
    if (this.step !== "debrief" || this.submitting) throw new Error(`finishDebrief in step ${this.step}`);
    this.submitting = true;
    try {
      await this.event({ kind: "debrief_closed", detail: { textId: this.debriefId(), dwellMs: this.shellDwellMs() } });
      await this.transition("handoff_complete");
      this.step = "complete";
    } finally { this.submitting = false; }
    this.notify();
  }

  /**
   * A blur, focus or idle record (`attention.ts`; SPEC/09 §6's exclusion rules). Nothing is logged before
   * the consent decision (the study shell logs nothing more until then) nor after `session_completed`.
   */
  async logAttention(kind: AttentionKind, detail: AttentionDetail = {}): Promise<void> {
    if (this.completed || this.step === "consent" || this.step === "consent_declined") return;
    if (kind === "idle_end") await this.event({ kind, detail: detail.endedBy ? { endedBy: detail.endedBy } : {} });
    else await this.event({ kind, detail: {} });
  }

  /** The session log so far — for tests and the upload after COMPLETE. */
  async logRecords() { return this.log.readAll(); }

  /** The log header (the session id names the session's files). */
  get logHeader(): LogHeader { return this.log.header; }

  /** The engine's state (`COMPLETE` gates the upload, I3). */
  get engineState(): EngineState { return this.loop.freeze.current(); }

  // ---- The end of the session and resume (SPEC/05 §9; 5 Oct 2026) ---------------------------------

  /**
   * After V14 (step `complete`): DEBRIEF_HANDOFF -> COMPLETE and `session_completed`, both durable
   * before this resolves. Only then may the log be uploaded (I3). Idempotent: a second call (a
   * remounted end screen, a resume into the end) logs nothing more.
   */
  async completeSession(): Promise<void> {
    if (this.step !== "complete") throw new Error(`completeSession in step ${this.step}`);
    if (this.completed) return;
    this.completed = true;
    // With the study shell the debrief has already moved the engine to COMPLETE (`finishDebrief`).
    if (this.loop.freeze.current() !== "COMPLETE") await this.transition("handoff_complete");
    await this.event({ kind: "session_completed", detail: {} });
    this.notify();
  }

  /**
   * Re-enters an interrupted session (SPEC/05 §9). The engine is brought, without logging, to the
   * state it has at the target's start by replaying the same deterministic triggers a full run
   * applies (the clock to the view's start); the message log is refilled with what earlier views
   * delivered. Then the interruption is logged as a fault span plus `session_resumed`, and the
   * target starts as it normally does (a view from its start, with its `cycle_start`).
   *
   * Not restored: Thinker's chat history of earlier views (the answers are in the log), the
   * participant's half-made inputs in the interrupted view, and the view's elapsed time (the view
   * runs its full time again). A session that had logged `session_completed` re-enters the end.
   */
  private async startResumed(plan: SessionResumePlan, interruptedForMs: number): Promise<void> {
    const { target } = plan;
    if (this.studyShell) {
      const shell = shellResumeStep(target, this.resumeInfo?.records ?? [], { aiLiteracyOn: this.aiLiteracyOn, isPublic: this.publicLayer.isPublic, immediateProfile: this.immediateProfile, mapPretestOn: this.mapPretestOn });
      if (shell) return this.startResumedShell(shell, plan, interruptedForMs);
    }
    const inView = target.kind === "view" || target.kind === "spam_forced"; // a forced SPAM item lies inside its (run-out) view
    const practiceReplay = inView && target.view === PRACTICE_VIEW_INDEX;
    const fastForward: Parameters<EngineRunLoop["transition"]>[0][] = ["start", "preflight_passed"];
    if (target.kind !== "briefing") fastForward.push("briefing_complete");
    if (target.kind !== "briefing" && !practiceReplay) fastForward.push("warmup_complete");
    const mainViewsBefore = inView && !practiceReplay ? target.view - 1
      : target.kind === "hinge" ? this.scenario.hinge.afterCycle : target.kind === "complete" ? this.lastView : -1;
    if (mainViewsBefore >= 0) fastForward.push("tutorial_complete");
    for (const trigger of fastForward) this.loop.transition(trigger);
    this.replayViews(mainViewsBefore, target.kind === "hinge");
    // A forced SPAM item's view had run out: its own messages were all delivered, so they are restored too.
    this.restoreMessageHistory(target.kind === "spam_forced" ? (practiceReplay ? 0 : target.view)
      : target.kind === "briefing" || practiceReplay ? -1 : Math.max(0, mainViewsBefore));

    // Revision (ah), review L3: both chats come back from the log (the hinge view's clearing rule kept).
    const cycleReplayed = (inView ? target.view : target.kind === "hinge" ? this.scenario.hinge.afterCycle + 1
      : target.kind === "complete" ? this.lastView : PRACTICE_VIEW_INDEX) as CycleIndex;
    this.queries.restoreChats(this.resumeInfo?.records ?? [], cycleReplayed);
    // Difficulty audit (b.3): after VP, the practice feedback again while it has not been left (the head mark from the log).
    const records = this.resumeInfo?.records ?? [];
    const feedbackPending = target.kind === "training" && this.practiceFeedbackOn
      && !records.some((r) => r.kind === "briefing_advanced" && (r.detail as { screenId?: string }).screenId === PRACTICE_FEEDBACK_SCREEN_ID);
    await this.event({ kind: "fault", detail: { faultClass: INTERRUPTION_FAULT_CLASS } });
    await this.event({ kind: "fault_resolved", detail: { faultClass: INTERRUPTION_FAULT_CLASS, elapsedWallClockGapMs: interruptedForMs } });
    await this.event({ kind: "session_resumed", detail: { resumeCount: plan.resumeCount, intervalSinceInterruptionMs: interruptedForMs, cycleReplayed, resumedAt: feedbackPending ? "practice_feedback" : target.kind } });

    switch (target.kind) {
      case "briefing": return this.toBriefing(); // the intro video again, from its start; without it the page is gone: on to the practice view
      case "training":
        if (feedbackPending) { this.practiceHeadMark = practiceHeadMarkOf(records); return this.showPracticeFeedback(); }
        this.showIntro("training"); this.notify(); return;
      case "hinge": return this.enterHinge();
      case "complete": this.step = "complete"; this.completed = plan.alreadyCompleted; this.notify(); return;
      case "view":
        this.step = "exploration";
        if (practiceReplay) await this.event({ kind: "phase_entered", detail: { phase: "practice" } });
        return this.enterCycle(target.view as ViewIndex);
      case "spam_forced": return this.resumeForcedSpam(target);
    }
  }

  /**
   * Revision (ag): resumes INTO a forced SPAM item (`planSessionResume`'s `spam_forced`). The view's time
   * had run out, so it is not replayed and nothing of it is logged again (no `cycle_start`): its state is
   * set up as it stood at its end — the map at its last step, the plan step, the clock paused at the view
   * moment the item was forced at — and the forced item is shown again (`spam_ready` `forced`, `resumed`).
   * When it closes the view ends with the end it was holding, at that view moment (`afterSpam`).
   */
  private async resumeForcedSpam(target: Extract<SessionResumePlan["target"], { kind: "spam_forced" }>): Promise<void> {
    const index = target.view as ViewIndex;
    this.viewClock.stop();
    this.viewOpenedMs = this.realMs();
    this.currentCycle = index;
    this.resumeStep = null; this.tour = null; this.postViewOf = null; this.probeQueue = [];
    this.consult.reset(null); this.planConfidence.reset(); this.viewEnd = null; this.endFreeze = false; // the view's time is over: no notice
    const cycleSpec = this.cycleSpec();
    this.timing = viewTimingOf(cycleSpec, this.previewOverride);
    this.allocationCommitted = this.periodConfirmed = target.planRecorded;
    this.minimumReached = target.atViewSeconds >= this.timing.minViewSeconds;
    this.revisingAllocation = false; this.revisionCount = 0;
    // SPEC/32 §3: the plan recorded is the review's (phase B), which follows the item's close; its revisions continue the count.
    const recorded = lastRecordedPlan(this.resumeInfo?.records ?? [], index);
    this.recordedPlan = recorded.plan; this.revisionCount = recorded.revisions;
    this.review.reset(); this.reviewTrigger = null; this.reviewHeld = null;
    this.capSeconds = this.isPractice() ? PRACTICE_VIEW_MAX_SECONDS : VIEW_MAX_SECONDS; this.capGeneration += 1; // no cap cues: the view's time is over
    this.capReached = false; this.boundaryHeld = false; this.minSecondsLeft = this.capSecondsLeft = null;
    this.step = target.planRecorded ? "awaiting_view_end" : "allocation";
    this.currentStep = cycleSpec.startsAtVirtual / STEP_SECONDS + 1;
    this.renderTree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: cycleSpec });
    if (target.stepBoundaryReached && cycleSpec.stepBoundary) {
      this.loop.clock.advanceTo(cycleSpec.stepBoundary.atVirtual);
      this.currentStep += 1;
      this.renderTree = applyRenderEvent(this.renderTree, { kind: "step_boundary", cycle: cycleSpec });
    }
    const envelope = this.isPractice() ? this.scenario.practice.envelope : this.scenario.envelopes.find((e) => e.cycle === index)!;
    this.renderTree = applyRenderEvent(this.renderTree, { kind: "envelope_revealed", envelope }); // on the map since the view's start; not logged again
    this.queries.startView(index);
    // The clock stands at the forced moment: started without cues and paused there, so the held end reads it (`afterSpam`).
    this.viewClock.start([]);
    this.viewClock.pause(target.atViewSeconds);
    const probe = this.spamProbe();
    if (!probe || probe.id !== target.probeId) throw new Error(`resume: the forced SPAM probe ${target.probeId} is not this view's`);
    this.endHeld = target.viewEndedBy;
    await this.spam.resumeForced(probe, index, target.atViewSeconds, target.viewEndedBy, this.secondSpamOf(probe));
  }

  /** Re-enters a study-shell screen (`shell-resume.ts`): the engine is fast-forwarded to that screen's state, the interruption logged, the screen shown again. */
  private async startResumedShell(shell: ShellResumeStep, plan: SessionResumePlan, interruptedForMs: number): Promise<void> {
    const after = shell === "questionnaire" || shell === "results_optin" || shell === "profile" || shell === "debrief";
    if (shell === "preflight" || shell === "ai_literacy") this.loop.transition("start");
    if (shell === "primer" || shell === "map_pretest") for (const trigger of ["start", "preflight_passed"] as const) this.loop.transition(trigger);
    if (after) {
      for (const trigger of ["start", "preflight_passed", "briefing_complete", "warmup_complete", "tutorial_complete"] as const) this.loop.transition(trigger);
      this.replayViews(this.lastView, false);
      this.restoreMessageHistory(this.lastView);
    }
    const cycleReplayed = (after ? this.lastView : PRACTICE_VIEW_INDEX) as CycleIndex;
    await this.event({ kind: "fault", detail: { faultClass: INTERRUPTION_FAULT_CLASS } });
    await this.event({ kind: "fault_resolved", detail: { faultClass: INTERRUPTION_FAULT_CLASS, elapsedWallClockGapMs: interruptedForMs } });
    await this.event({ kind: "session_resumed", detail: { resumeCount: plan.resumeCount, intervalSinceInterruptionMs: interruptedForMs, cycleReplayed, resumedAt: shell } });
    this.shellShownMs = this.realMs();
    if (shell === "questionnaire") await this.showQuestionnaire("post");
    else if (shell === "ai_literacy") { // reopens on the first screen with an unrated item, the ratings kept
      const records = this.resumeInfo?.records ?? [];
      await this.showAiLiteracy(keptAiLiteracyAnswers(records), aiLiteracySpentMs(records), true);
    }
    else if (shell === "map_pretest") return this.showMapPretest(this.resumeInfo?.records ?? [], true); // the first unanswered item
    else if (shell === "profile") await this.showProfile();
    else if (shell === "debrief") await this.showDebrief();
    else this.step = shell; // the consent, the preflight, the primer (from its first page), the results step (SPEC/36)
    this.notify();
  }

  /**
   * The resume's fast-forward through main views 1..`upTo` (no records): the hinge left unless the session resumes at it; at the
   * session's last view the timeline is closed as that view's end closes it (`closeTimelineAt`: V7 in a phase-A session).
   */
  private replayViews(upTo: number, atHinge: boolean): void {
    for (let v = 1; v <= upTo; v++) {
      this.loop.endCycle();
      if (v === this.scenario.hinge.afterCycle && !atHinge && v !== this.lastView) this.loop.dismissHinge(); // the hinge was left before the interruption
    }
    if (upTo === this.lastView) closeTimelineAt(this.loop, upTo, cycleScheduleOf(this.scenario));
  }

  /** Refills the message log and the bubble history with what the practice view (`upToMainView` ≥ 0) and main views 1..upToMainView delivered — no records (they are in the log already). */
  private restoreMessageHistory(upToMainView: number): void {
    const { bubbles, rows } = deliveredHistory(this.scenario, upToMainView);
    this.bubbleHistory.push(...bubbles);
    this.queries.radioLog.push(...rows);
  }
}
