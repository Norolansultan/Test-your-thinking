/**
 * The complete telemetry record enumeration — SPEC/07_Telemetry_and_Logging.md
 * §2, reconciled with its "Amendment 2026-09-17" and "Revision 2026-09-17 (d)"
 * (which supersedes the amendment where they conflict) to a single final
 * state, the same way `app/scenario/types.ts` reconciles SPEC/04.
 *
 * "Adding a kind is a `formatVersion` bump" (SPEC/04 §10) — so this is the
 * complete list, not an extensible-by-convention one. Each `TelemetryEvent`
 * variant pairs a `kind` with its typed `detail`, mirroring the
 * `RecordPayload` discriminated-union pattern in `scenario/types.ts`.
 *
 * Principle governing every shape here (SPEC/07 §1): "Capture raw events
 * with precise timing and identity. Derive nothing at runtime." No detail
 * type below computes a latency, a dwell time, or any other derived
 * value — those are named in `derived-measures.ts` and computed only from
 * these raw records.
 *
 * What must never be logged (SPEC/07 §3), enforced by omission from this
 * file rather than by a runtime filter: no correctness value, flag, truth
 * annotation, or invariant comparison; no raw in-progress keystroke
 * content (`query_edit` carries a count, never text); no personal
 * identifier beyond the pseudonymous participant code already in
 * `LogHeader`.
 */

import type { CycleIndex, LatLon, Polygon, VirtualTime, WarmupIndex } from "../engine/primitives.js";
import type { Certainty, ContainmentJudgement, PracticeViewIndex, ProbeMode, ProbeType, StructuredCorrection } from "../scenario/types.js";
import type { OutlookAnswer, SectorPlan } from "../scenario/plan-types.js";
import type { LogHeader } from "./log.js";
import type {
  ClickDetail, ElementEnterLeaveDetail, LayerToggledDetail, ViewportChangedDetail, TextScrolledDetail, PointerTrackDetail,
  FreezeMapPickDetail, MapLabelsPlacedDetail, WindowSizeWarningDetail,
  DrawerOpenedDetail, DrawerClosedDetail, DrawerTabChangedDetail, DrawerStateAtCycleBoundaryDetail,
  QueryEditDetail, QuerySubmittedDetail, QueryClearedDetail, RetrievalMissDetail, ResultItemDetail, TrafficRequestedDetail,
  NavSlotChangedDetail, NavQuerySubmittedDetail, AiChatQuerySubmittedDetail, AiChatAnswerReceivedDetail,
} from "./record-kinds-interaction.js";

// ---------------------------------------------------------------------------
// §2.1 Session and lifecycle
// ---------------------------------------------------------------------------

export interface PreflightResultDetail {
  readonly benchmarkScore: number;
  readonly viewport: { readonly w: number; readonly h: number; readonly dpr: number };
  readonly refusalReason: string | null;
  /**
   * The study shell's preflight (5 Oct 2026, `app/session/preflight.ts`; all optional, absent in older
   * logs): whether it passed, every failed check (`refusalReason` is the first), whether a failure is
   * one the participant cannot fix in this session (`hard`: the session aborts), the environment
   * descriptors SPEC/09 §2 asks for, the Thinker proxy's reachability (Thinker cells only), whether
   * the benchmark ran (it is not built: `benchmarkScore` is then 0), and a demonstration-only override.
   */
  readonly passed?: boolean;
  readonly failures?: readonly string[];
  readonly hard?: boolean;
  readonly userAgent?: string;
  readonly pointer?: "fine" | "coarse" | "none";
  readonly maxTouchPoints?: number;
  readonly indexedDb?: boolean;
  readonly webgl2?: boolean;
  readonly proxy?: "reachable" | "unreachable" | "not_needed";
  readonly benchmark?: "not_run";
  readonly overridden?: boolean;
}
export interface BriefingAdvancedDetail {
  readonly screenId: string;
  readonly dwellMs: number;
  /** Revision (ae), 9 Oct 2026: the briefing page is gone; "briefing.setting" is logged at once with these set. */
  readonly auto?: true;
  readonly screenRemoved?: true;
  /** 10 Oct 2026: "briefing.video", the intro video before the practice view — how its page was left. */
  readonly videoOutcome?: IntroVideoOutcome;
}
/** The intro video's page was left when the video ended, when it could not be played, or skipped (demonstration only). */
export type IntroVideoOutcome = "ended" | "error" | "skipped";
/**
 * SPEC/26 D3: the practice view VP is logged as view 0 with phase `"practice"` (and is bracketed by
 * `phase_entered` "practice" … "phase_a"), so analysis drops it by that tag. Its probe and item ids
 * also carry `practice`. The W1–W5 prologue it replaces is gone.
 */
export interface CycleStartDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly phase: "A" | "B" | "practice";
  readonly clockLabel: string;
  /** The view's schedule, so it is auditable from the log alone (SPEC/07 revision (r)); absent in logs before 2 Oct 2026. */
  readonly minViewSeconds?: number;
  readonly freezeAtSeconds?: number | null;
  /** The KUKA list offered in this view (0.8.2; it grows view by view, `navigation.ts`). */
  readonly navSources?: readonly string[];
}
export interface CycleEndDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly totalRealDurationMs: number;
}
export interface HingePauseStartDetail {
  readonly pauseSeconds: number;
}
export interface HingePauseEndDetail {
  readonly realDurationMs: number;
  readonly dismissedEarly: boolean;
}
export interface StateTransitionDetail {
  readonly from: string;
  readonly to: string;
  readonly trigger: string;
}
export interface FaultDetail {
  readonly faultClass: string;
}
export interface FaultResolvedDetail {
  readonly faultClass: string;
  readonly elapsedWallClockGapMs: number;
}
export interface FrameStatsDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly medianFrameTimeMs: number;
  readonly longTaskCount: number;
}
export interface SessionResumedDetail {
  readonly resumeCount: number;
  readonly intervalSinceInterruptionMs: number;
  /** The view replayed from its start; 0 (the practice view) also for a resume into the briefing or the training before V1. */
  readonly cycleReplayed: CycleIndex | WarmupIndex | PracticeViewIndex;
  /**
   * Where the resumed session re-entered (5 Oct 2026, `app/telemetry/resume.ts` `planSessionResume`):
   * the briefing, a view's start (the practice view or V1–V14), the training, the hinge screen, or
   * the end of the session. Absent in logs written before the browser resume was wired.
   * `spam_forced` (revision (ag), 9 Oct 2026): the view's time had run out and its forced SPAM item was
   * open; the session resumed into that item (not a replay: `cycleReplayed` names the view, which is
   * not run again, and the analysis does not count it as replayed).
   */
  readonly resumedAt?: "briefing" | "view" | "training" | "hinge" | "complete" | "consent" | "ai_literacy" | "preflight" | "questionnaire" | "debrief" | "spam_forced";
}
export type PhaseEnteredDetail = { readonly phase: "practice" | "tutorial" | "phase_a" | "hinge" | "phase_b" };

// ---------------------------------------------------------------------------
// §2.2 Stimulus onsets — the latency anchors
// ---------------------------------------------------------------------------

export interface BubbleAvailableDetail {
  readonly atomId: string;
  readonly mapPosition: LatLon | null;
  readonly tier: "T1_pushed" | "T2_system" | "T3_person" | "T4_lateral";
  readonly sourceId: string;
}
export interface EnvelopeRevealedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly envelopeId: string;
}
/** SPEC/07 §2.2: "Cycle index, the full signal payload including the traffic summary." The channel is unused in this study (SPEC/02 revision (g)) but the record kind is kept so a later study can reinstate it without a schema change. */
export interface ChannelSignalEmittedDetail {
  readonly cycle: CycleIndex | WarmupIndex;
  readonly signals: readonly {
    readonly category: string;
    readonly urgency: 0 | 1 | 2 | 3;
    readonly certainty: Certainty;
    readonly attribution: readonly string[];
    readonly quiet: boolean;
    readonly text: string;
  }[];
  readonly trafficSummary: string;
  readonly restatesIntent: boolean;
}
export interface DutyOfficerMessageDeliveredDetail {
  readonly messageId: string;
  readonly isStrategicGuidance: boolean;
}
export interface ProbePresentedDetail {
  readonly probeId: string;
  readonly type: ProbeType;
  readonly mode: ProbeMode;
  readonly optionIds: readonly string[];
  /**
   * Appended 5 Oct 2026 (visible probes E, F, U, `visible-probes.ts`): the view, the moment on the
   * view's clock (null after the view has ended: V14's backup and coverage items) and the panel step
   * the participant was in. The view's clock stands still from this record to the probe's answer
   * (`expectation_marked` or `probe_submitted`).
   */
  readonly cycle?: number;
  readonly atViewSeconds?: number | null;
  readonly decisionStep?: string | null;
}
export interface RetrievalReturnedDetail {
  readonly queryId: string;
  /** Ranked package ids, in rank order (revision (e)/(f): reasoning-only engine; "fact" packages remain an expandable layer, never a top-level answer). */
  readonly packageIds: readonly string[];
  readonly packageTypes: readonly ("fact" | "situation" | "meaning" | "projection")[];
  readonly scores: readonly number[]; // fixed precision, SPEC/14 §5
  readonly intentLineShown: boolean; // revision (d)
}
export interface TrafficReturnedDetail {
  readonly requestId: string;
  readonly selector: { readonly byUnit?: string; readonly byGroup?: string; readonly byTimeWindow?: readonly [VirtualTime, VirtualTime] };
  readonly entryIds: readonly string[];
}

// §2.3 pointer and element interaction, §2.4 drawers, §2.5 query capture: `record-kinds-interaction.ts`.
export type {
  ClickTargetKind, ClickDetail, ElementEnterLeaveDetail, LayerToggledDetail, ViewportChangedDetail, TextScrolledDetail, PointerTrackDetail,
  FreezeMapPickDetail, MapLabelsPlacedDetail, WindowSizeWarningDetail,
  DrawerId, DrawerOpenedDetail, DrawerClosedDetail, DrawerTabChangedDetail, DrawerStateAtCycleBoundaryDetail,
  QueryEditDetail, QuerySubmittedDetail, QueryClearedDetail, RetrievalMissDetail, ResultItemDetail, TrafficRequestedDetail,
  NavSlotChangedDetail, NavQuerySubmittedDetail, AiChatQuerySubmittedDetail, AiChatAnswerReceivedDetail,
} from "./record-kinds-interaction.js";

// ---------------------------------------------------------------------------
// §2.6 Probe and decision interaction
// ---------------------------------------------------------------------------

export interface ProbeOptionHoveredDetail {
  readonly probeId: string;
  readonly optionId: string;
}
export interface ProbeAnswerChangedDetail {
  readonly probeId: string;
  readonly from: string | null;
  readonly to: string;
}
export interface ConfidenceSliderMovedDetail {
  readonly probeId: string;
  readonly value: number;
  readonly settle: boolean;
}
export interface ProbeSubmittedDetail {
  readonly probeId: string;
  /**
   * Narrowed per ProbeType at the call site; the log's job is custody, not re-typing every probe's answer shape here.
   * Revision (ai), 9 Oct 2026: V13's area item logs `{ unsure, areas, optionOrder }` (areas and the order as option ids);
   * the V14 backup an option id with `confidence`.
   */
  readonly response: unknown;
  /** The answer's confidence on the one scale, for a visible probe that collects one (the V14 backup, revision (ai)). */
  readonly confidence?: number;
}

/** V13's area item's `response` (revision (ai)): the yes/no, the parts chosen and the order they were shown in. */
export interface AreaCheckResponse {
  readonly unsure: boolean;
  readonly areas: readonly string[];
  readonly optionOrder: readonly string[];
}
/** Type E's answer; no longer emitted since Type E was withdrawn (6 Oct 2026), kept so older logs still type. */
export interface ExpectationMarkedDetail {
  readonly probeId: string;
  readonly markedGeometry: Polygon;
  readonly confidence: number;
}
export interface ContainmentJudgementSubmittedDetail {
  readonly probeId: string;
  readonly judgement: ContainmentJudgement;
  readonly confidence: number;
  readonly breachPoint?: LatLon;
  /** The structured correction after `fundamentally_wrong` (0.8.2; was `correctedProjection`, a polygon). */
  readonly correction?: StructuredCorrection;
}
export interface FailureLocationMarkedDetail {
  readonly probeId: string;
  readonly markedPoint?: LatLon;
  readonly markedPolygon?: Polygon;
}
export interface CorrectedProjectionDrawnDetail {
  readonly probeId: string;
  readonly polygon: Polygon;
  readonly vertexCount: number;
  readonly drawingDurationMs: number;
}
export interface AllocationChangedDetail {
  readonly assetId: string;
  readonly previousSectorId: string | null;
  readonly previousTaskId: string | null;
  readonly newSectorId: string;
  readonly newTaskId: string;
}
export interface AllocationSubmittedDetail {
  /** The sector plan (0.9.0, SPEC/16 revision (s)); it replaced the per-unit `assignments`. Its submission confirms the period. With the main effort's `posture` since 0.9.4. */
  readonly plan: SectorPlan;
  /**
   * SPEC/15 revision (o): the free-text rationale is asked only in a view where the participant's
   * Type J judgement rejected the projection. `rationaleAsked: false` with `rationaleFi: null` means
   * the field was never shown — not an answer left empty.
   */
  readonly rationaleAsked: boolean;
  readonly rationaleFi: string | null;
}
/** SPEC/16 revision 1 Oct 2026: one per drone-team asset (drone, water drone, robot) tasked in an allocation. The world does not respond. */
export interface DroneTaskedDetail {
  readonly view: number; // 0 = the practice view
  readonly assetId: string;
  readonly assetType: "drone" | "vesidrooni" | "robotti";
  readonly targetSectorId: string;
  readonly taskId: string;
  readonly clockLabel: string; // the map clock when the order was given (the record's tVirtual is the same instant)
}
export interface PolygonToolDetail {
  readonly probeId: string;
}
export interface BranchListPresentedDetail {
  readonly probeId: string;
  readonly statementIds: readonly string[]; // presented order, "Ei mikään näistä" always last
}
export interface BranchOptionHoveredDetail {
  readonly statementId: string;
}
export interface BranchSelectedDetail {
  readonly statementId: string | "none_of_these";
}
export interface BranchListAbandonedDetail {
  readonly probeId: string;
}

// ---------------------------------------------------------------------------
// Amendment: SPAM (Type S), recall confidence
// ---------------------------------------------------------------------------

/*
 * SPAM delivery (round 2, 4 Oct 2026, agent C): raw events only — every latency is a difference of
 * two records' `tWallOffsetMs` (`spam-measures.ts`); the earlier `latencyFromOnsetMs` and
 * `latencyFromReadyMs` fields (never emitted) were derived values and are removed (SPEC/07 §1).
 * Sequence: `spam_prompt_shown` → (`spam_collapsed` / `spam_expanded`)* → `spam_ready` (accepted;
 * `forced` at the view's end; `skipped` in a demonstration; `timedOut` only in logs before revision
 * (ag)) → `spam_answered` (an option, or `timedOut` with `response: null`) →
 * `recall_confidence_submitted` (the item's confidence, same `probeId`) → `spam_closed`.
 * Revision (ag), 9 Oct 2026: the ready prompt no longer expires (no new `timedOut: true`); Haku and the
 * Thinker are no longer locked while the item is open (their records inside the probe's window are
 * the per-probe tool use, `spam-measures.ts`).
 */
export interface SpamPromptShownDetail {
  readonly probeId: string;
  /** 0 for the practice item (VP, 5 Oct 2026; not scored). */
  readonly cycle: CycleIndex | PracticeViewIndex;
  /** The prompt's scheduled moment on the view's clock (the preview override applied). */
  readonly atViewSeconds: number;
}
export interface SpamReadyDetail {
  readonly probeId: string;
  /** true = spam_ready_timeout: the participant never said ready; the item is not shown. Only in logs before revision (ag) (always false since). */
  readonly timedOut: boolean;
  /**
   * Revision (ag): the view's end fell due during the ready prompt, so the item was forced (the view's
   * clock paused, the view ended when the probe closed). This record's time CENSORS the ready latency.
   */
  readonly forced?: true;
  /** With `forced`: the view moment the clock stands at (the view's end) and the end it holds (`view_ended.endedBy` once the probe closes). */
  readonly atViewSeconds?: number;
  readonly viewEndedBy?: "minimum_length" | "participant_confirm" | "time_cap" | "skipped";
  /** With `forced`: the forced item shown again after an interruption (resumed into it; no new `spam_prompt_shown`). */
  readonly resumed?: true;
  /** Demonstration only: the presenter skipped the view during the ready prompt; no item is shown. */
  readonly skipped?: true;
}
/** Revision (ag): the participant collapsed the ready prompt to its pill, or expanded it again; the probe stays pending. */
export interface SpamCollapseDetail {
  readonly probeId: string;
}
export interface SpamAnsweredDetail {
  readonly probeId: string;
  /** The chosen option's id ("a"–"d" as shown), or null on a timeout. */
  readonly response: string | null;
  readonly timedOut: boolean; // true = spam_answer_timeout
}
/** The SPAM probe is over (answered and rated, or timed out): the tools are unlocked from here. */
export interface SpamClosedDetail {
  readonly probeId: string;
  /** 0 for the practice item (VP, 5 Oct 2026; not scored, analysis drops it by its id `probe.s.practice`). */
  readonly cycle: CycleIndex | PracticeViewIndex;
}
/** The manipulation check is shown, after the directive (brief D3): the time base of its answer latency. */
export interface HingeCheckPresentedDetail {
  readonly itemId: string;
}
export interface HingeCheckAnsweredDetail {
  readonly itemId: string;
  readonly optionId: string;
}
/** The hinge screen's per-cell sentence was shown (SPEC/27 §3.2; 5 Oct 2026). Thinker cells only. */
export interface HingeCellNoteShownDetail {
  readonly noteId: "linjaus_line" | "unchanged";
}
/**
 * The command directive's persistent line appeared on screen (D1, 8 Oct 2026), with the P2 radio message at the hinge: logged once per
 * session, in every cell. `messageId` is the duty officer message it came with.
 */
export interface DirectiveShownDetail {
  readonly view: number;
  readonly messageId: string;
  readonly clockLabel: string;
}
/**
 * The right-panel tool tab the participant selected (P1-1, 8 Oct 2026): Haku, the Open Thinker (AI cells) or none (the panel closed).
 * The tool-use sequence of the information-seeking measures; `phase` as for the chat records.
 */
export interface TabSelectedDetail {
  readonly tool: "haku" | "open_thinker" | "indexed_search" | "none";
  readonly view: number;
  readonly phase: "exploration" | "decision";
}
export interface RecallConfidenceSubmittedDetail {
  readonly probeId: string;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// SPEC/16 §8, as narrowed by revision (d): only decision_presented,
// decision_option_hovered and decision_initial_submitted survive —
// alignment_feedback_shown and decision_final_submitted are removed
// ("the machine never comments on the participant's decisions").
// ---------------------------------------------------------------------------

export interface DecisionPresentedDetail {
  readonly itemId: string;
  readonly presentedOptionOrder: readonly string[];
}
export interface DecisionOptionHoveredDetail {
  readonly optionId: string;
}
export interface DecisionInitialSubmittedDetail {
  readonly optionId: string;
  readonly confidence: number;
  readonly latencyFromPresentationMs: number;
}

// ---------------------------------------------------------------------------
// The view's flow (researcher decision 1 Oct 2026, superseding SPEC/15 §9's
// locked two-phase cycle): the decision panel opens 20 s into the view, the
// view lasts at least its minimum length, and the SAGAT freeze interrupts at a
// pre-planned moment, whatever the participant is doing. (The Haku group's
// own-projection task of SPEC/15 §10.1 is withdrawn by SPEC/15 revision (o).)
// View seconds exclude freeze time: the view's time stands still in a freeze.
// ---------------------------------------------------------------------------

/** At the start of every view: `explorationSeconds` is how long the map is shown before the decision panel opens (20 s, or scaled in a preview). */
export interface ExplorationPhaseStartDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly explorationSeconds: number;
}
/** No longer emitted from 0.8.0 (`decision_panel_opened` replaces it); kept so older logs still type. */
export interface DecisionPhaseStartDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
}
/** The decision panel opened (the Type J judgement is offered), `atViewSeconds` into the view. */
export interface DecisionPanelOpenedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly atViewSeconds: number;
}
/**
 * The participant resubmitted the allocation after confirming the period, while the view was
 * still open (its minimum length not yet reached). `revision` counts 1, 2, … within the view; the
 * first submission is `allocation_submitted`. Each drone-team asset in `marks` also gets a `drone_tasked`.
 */
export interface AllocationRevisedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly revision: number;
  readonly plan: SectorPlan;
}
/** The guided tour (or V1's tool reminder) finished; the view's time starts then (0.9.1, SPEC/15 r.11). */
export interface TourCompletedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly tour: "practice" | "tools";
  readonly stepsSeen: number;
  readonly dwellMs: number;
}
/** The view's outlook (0.9.0): the next 30 minutes' development and the need for more resources, each with a confidence. */
export interface OutlookSubmittedDetail extends OutlookAnswer {
  readonly cycle: CycleIndex | PracticeViewIndex;
}
/**
 * The SAGAT freeze began, `atViewSeconds` into the view (the scenario's `freezeAtSeconds`).
 * `decisionCommittedBeforeFreeze`: this view's allocation (the decision) was already submitted.
 * `decisionStep`: the step the participant was on — `"exploration"` before the panel opened, then
 * `"judging"`, `"confidence"`, a follow-up, `"verification"`, `"allocation"` (also while revising),
 * `"coa"`, or `"awaiting_view_end"` (the period confirmed). They resume there after the freeze.
 */
export interface FreezeStartedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly atViewSeconds: number;
  readonly decisionCommittedBeforeFreeze: boolean;
  readonly decisionStep: string;
}
/**
 * The view ended, `viewSeconds` into it: at its minimum length when the participant had confirmed
 * the period earlier (`"minimum_length"`), or at the confirmation when that came later (`"participant_confirm"`).
 */
/** "Muuta kohdennusta" was opened (a revision begun; it is `allocation_revised` only once resubmitted). */
export interface AllocationRevisionOpenedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly atViewSeconds: number;
}
export interface ViewEndedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly viewSeconds: number;
  /**
   * `time_cap`: the cap (0.8.2; 150 s since revision (x)) ended the view before the participant confirmed it.
   * `skipped` (demonstration only, 6 Oct 2026): the presenter skipped the rest of the view (`skipView`).
   */
  readonly endedBy: "minimum_length" | "participant_confirm" | "time_cap" | "skipped";
  /** With `time_cap` or `skipped`: the panel step the participant was on (what was left unanswered). */
  readonly stepAtEnd?: string;
}
/**
 * A merged view reached its second step (0.9.4, review round 2, 4 Oct 2026): the clock moved to the
 * step's start and its pushed items follow. Once per merged view, `atViewSeconds` into it (half its
 * minimum length, scaled in a preview). `directiveAdherence` reads it (`afterBoundary`).
 */
export interface StepBoundaryReachedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly atViewSeconds: number;
}
export interface FreezeItemAnsweredDetail {
  readonly itemId: string;
  /** The chosen option's id; `"map_point"` for a map item (the tap is in `point`). */
  readonly optionId: string;
  readonly confidence: number;
  /** The withdrawn source question's answer (map | message_log | search | own_inference | thinker): only in logs before format 0.9.3; never written now. */
  readonly source?: string;
  /** A `map_point` item's answer: the tapped point. */
  readonly point?: LatLon;
  /**
   * When the item was answered (P1-5, 7 Oct 2026): the moment it was left with "Seuraava", or the
   * submission for the last item, in real ms since the session started (the base of `tWallOffsetMs`).
   * Written by the session (`SessionOrchestrator.submitFreeze`), never taken from the screen; absent
   * in older logs.
   */
  readonly answeredAtWallMs?: number;
  /** The same moment, real ms since the freeze was shown (`freeze_started` durable). */
  readonly msSinceFreezeOpened?: number;
}
/**
 * An idle period's end (SPEC/07 §2.1): at the next input, or — `endedBy: "wait_started"` (P1-8, 7 Oct
 * 2026) — when a wait on the session began (a Thinker request, a freeze, a visible probe or a SPAM
 * item; `attention.ts`), so idle periods are net of those waits.
 */
export interface IdleEndDetail {
  readonly endedBy?: "wait_started";
}
/**
 * A freeze item left with "Seuraava" (fix pass 3, 7 Oct 2026): its answer moment, durable at once so
 * it survives a reload during the freeze (the answers themselves are in `freeze_submitted`). The
 * last item has none: its moment is the submission.
 */
export interface FreezeItemCompletedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly itemId: string;
  readonly msSinceFreezeOpened: number;
}
export interface FreezeSubmittedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly responses: readonly FreezeItemAnsweredDetail[];
  /**
   * Demonstration only (6 Oct 2026, `SessionOptions.allowViewSkip`): the presenter skipped the rest of the
   * freeze; `responses` holds only the items answered in full so far. Absent in a study log.
   */
  readonly skipped?: true;
  /** Fix pass 7 (9 Oct 2026, revision (ad)): the freeze's cap (`FREEZE_MAX_SECONDS`, 180 s) closed it; `responses` holds the items confirmed by then. */
  readonly timedOut?: true;
  /**
   * Fix pass 7: the items of the freeze not answered (a skipped or timed-out freeze only), in the freeze's order. MISSING, not wrong:
   * the scores leave them out, and a view with more than half its items missing is excluded from that view's SA score (`exclusions.ts`).
   */
  readonly missing?: readonly string[];
}

// ---------------------------------------------------------------------------
// The study shell (5 Oct 2026, work package I): consent, the questionnaires, the debrief, the glossary.
// Raw only: answers as given, no score; the hinge retention item's correctness is derived later
// against the scenario's invariant (`manipulation_check.hinge`).
// ---------------------------------------------------------------------------

/** The consent screen's decision (SPEC/09 §3, §9): the first record after the header; the time is its `tWallOffsetMs`. */
export interface ConsentDecidedDetail {
  readonly decision: "accepted" | "declined";
  /** The attestation (SPEC/09 §3: one sitting, no outside sources, no discussion); `false` is an exclusion rule (§6.2), not a refusal. */
  readonly attested: boolean;
  /** Which consent text was shown (`study-texts.ts` `CONSENT_TEXT_ID`); the text is a placeholder until the ethics board approves one. */
  readonly textId: string;
  readonly dwellMs: number;
}
export type QuestionnaireId = "pre" | "post";
/** A questionnaire is shown: its items in the order shown (and the hinge retention item's option order). */
export interface QuestionnairePresentedDetail {
  readonly questionnaireId: QuestionnaireId;
  readonly itemIds: readonly string[];
  readonly retentionOptionOrder?: readonly string[];
  /** Revision (ai): each multi-select item's option ids in the order shown (per participant, `option-order.ts`). */
  readonly multiOptionOrders?: readonly { readonly itemId: string; readonly optionIds: readonly string[] }[];
}
/**
 * A questionnaire's answers, raw: an option id, a number, a list of option ids (multi-select, revision
 * (ai), with the order shown in `optionOrder`), or null for an item left blank. `notShown`: the item's
 * condition was not met (e.g. `disagreement.action` without "yes" to `disagreement.recall`). Logs before
 * revision (ai) may carry free text for `last.basis`, `disagreement.action` and `felt.wrong`.
 */
export interface QuestionnaireSubmittedDetail {
  readonly questionnaireId: QuestionnaireId;
  readonly answers: readonly {
    readonly itemId: string;
    readonly value: string | number | readonly string[] | null;
    readonly optionOrder?: readonly string[];
    readonly notShown?: true;
  }[];
  readonly dwellMs: number;
}
/** The debrief is shown (after the post-session questionnaire, SPEC/09 §5.1): which text, by cell. */
export interface DebriefShownDetail {
  readonly textId: string;
}
export interface DebriefClosedDetail {
  readonly textId: string;
  readonly dwellMs: number;
}
/** The English glossary (R2) opened from the message log, and closed. Not emitted since revision (ae) (the glossary is gone); kept so older logs still type. */
export interface GlossaryOpenedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
}
export interface GlossaryClosedDetail {
  readonly cycle: CycleIndex | PracticeViewIndex;
  readonly dwellMs: number;
}

// ---------------------------------------------------------------------------
// The AI literacy questionnaire (9 Oct 2026; SPEC/15 and SPEC/09 revision (ac), amended: SNAIL;
// `app/session/ai-literacy.ts`): 31 self-report items rated 1–7, four per screen, right after
// consent, a 5-minute cap, skippable. Every rating is logged as it is given (the last per item
// counts), with its item and the time since the previous rating; the end record carries why the
// questionnaire ended and which items were rated. Raw only (SPEC/07 §3): the TU/CA/PA subscale
// means are computed in the analysis (`app/telemetry/ai-literacy-score.ts`).
// ---------------------------------------------------------------------------

/** Why it ended: "Next" on the last screen, the 5-minute cap, or the participant's "skip the test". */
export type AiLiteracyEndReason = "completed" | "timeout" | "skipped";
/** A rating, 1 ("strongly disagree") to 7 ("strongly agree"). */
export type AiLiteracyResponse = number;
/** The questionnaire is shown and its clock starts (again after a resume, with the ratings already logged kept). */
export interface AiLiteracyStartedDetail {
  readonly instrumentId: string;
  /** `ai-literacy-items.ts` `AI_LITERACY_VERSION`: the wording, order, factors and scale in force. */
  readonly version: string;
  /** Every item, in the order shown. */
  readonly itemIds: readonly string[];
  readonly timeLimitMs: number;
  readonly itemsPerPage: number;
  /** The screen this attempt opens on (0-based): the first with an item not yet rated. */
  readonly firstPage: number;
  /** The time this attempt has: the limit, less the active time already logged before a resume. */
  readonly remainingMs: number;
  readonly resumed: boolean;
  /** Items rated before the interruption, kept (shown rated if their screen is shown again). */
  readonly keptItemIds: readonly string[];
  /** True only while the items are a placeholder (`AI_LITERACY_ITEMS_PENDING`): such a log is no measurement. */
  readonly itemsPending: boolean;
}
/** One item rated (or re-rated: the last rating counts). */
export interface AiLiteracyAnsweredDetail {
  readonly itemId: string;
  /** SNAIL's variable number (V01–V39). */
  readonly sourceItemId: string;
  /** 1-based position in the questionnaire. */
  readonly position: number;
  /** 0-based screen. */
  readonly page: number;
  readonly response: AiLiteracyResponse;
  /** Real ms since the screen appeared or the previous rating on it, whichever is later (their sum is the active time). */
  readonly timeOnItemMs: number;
}
/** The questionnaire ended. Unrated items are missing (null); no score here (SPEC/07 §3). */
export interface AiLiteracySubmittedDetail {
  readonly endReason: AiLiteracyEndReason;
  readonly version: string;
  /** One per item, in the order shown: its last rating, null when not rated. */
  readonly responses: readonly { readonly itemId: string; readonly response: AiLiteracyResponse | null }[];
  readonly itemCount: number;
  readonly answeredCount: number;
  readonly missingItemIds: readonly string[];
  /** Real ms of this attempt (from its `ai_literacy_started`). */
  readonly durationMs: number;
  readonly timeLimitMs: number;
}

// ---------------------------------------------------------------------------
// The complete kind -> detail pairing.
// ---------------------------------------------------------------------------

export type TelemetryEvent =
  // §2.1
  | { readonly kind: "session_started"; readonly detail: LogHeader }
  | { readonly kind: "preflight_result"; readonly detail: PreflightResultDetail }
  | { readonly kind: "briefing_advanced"; readonly detail: BriefingAdvancedDetail }
  | { readonly kind: "cycle_start"; readonly detail: CycleStartDetail }
  | { readonly kind: "cycle_end"; readonly detail: CycleEndDetail }
  | { readonly kind: "hinge_pause_start"; readonly detail: HingePauseStartDetail }
  | { readonly kind: "hinge_pause_end"; readonly detail: HingePauseEndDetail }
  | { readonly kind: "state_transition"; readonly detail: StateTransitionDetail }
  | { readonly kind: "fault"; readonly detail: FaultDetail }
  | { readonly kind: "fault_resolved"; readonly detail: FaultResolvedDetail }
  | { readonly kind: "window_blur"; readonly detail: Record<string, never> }
  | { readonly kind: "window_focus"; readonly detail: Record<string, never> }
  | { readonly kind: "idle_start"; readonly detail: Record<string, never> }
  | { readonly kind: "idle_end"; readonly detail: IdleEndDetail }
  | { readonly kind: "frame_stats"; readonly detail: FrameStatsDetail }
  | { readonly kind: "session_completed"; readonly detail: Record<string, never> }
  | { readonly kind: "session_resumed"; readonly detail: SessionResumedDetail }
  | { readonly kind: "phase_entered"; readonly detail: PhaseEnteredDetail }
  // §2.2
  | { readonly kind: "bubble_available"; readonly detail: BubbleAvailableDetail }
  | { readonly kind: "envelope_revealed"; readonly detail: EnvelopeRevealedDetail }
  | { readonly kind: "channel_signal_emitted"; readonly detail: ChannelSignalEmittedDetail }
  | { readonly kind: "duty_officer_message_delivered"; readonly detail: DutyOfficerMessageDeliveredDetail }
  | { readonly kind: "probe_presented"; readonly detail: ProbePresentedDetail }
  | { readonly kind: "retrieval_returned"; readonly detail: RetrievalReturnedDetail }
  | { readonly kind: "traffic_returned"; readonly detail: TrafficReturnedDetail }
  // §2.3
  | { readonly kind: "click"; readonly detail: ClickDetail }
  | { readonly kind: "element_enter"; readonly detail: ElementEnterLeaveDetail }
  | { readonly kind: "element_leave"; readonly detail: ElementEnterLeaveDetail }
  | { readonly kind: "layer_toggled"; readonly detail: LayerToggledDetail }
  | { readonly kind: "viewport_changed"; readonly detail: ViewportChangedDetail }
  | { readonly kind: "text_scrolled"; readonly detail: TextScrolledDetail }
  | { readonly kind: "pointer_track"; readonly detail: PointerTrackDetail }
  // §2.4
  | { readonly kind: "drawer_opened"; readonly detail: DrawerOpenedDetail }
  | { readonly kind: "drawer_closed"; readonly detail: DrawerClosedDetail }
  | { readonly kind: "drawer_tab_changed"; readonly detail: DrawerTabChangedDetail }
  | { readonly kind: "drawer_state_at_cycle_boundary"; readonly detail: DrawerStateAtCycleBoundaryDetail }
  // §2.5
  | { readonly kind: "query_focus"; readonly detail: Record<string, never> }
  | { readonly kind: "query_first_keystroke"; readonly detail: Record<string, never> }
  | { readonly kind: "query_edit"; readonly detail: QueryEditDetail }
  | { readonly kind: "query_submitted"; readonly detail: QuerySubmittedDetail }
  | { readonly kind: "query_cleared"; readonly detail: QueryClearedDetail }
  | { readonly kind: "retrieval_miss"; readonly detail: RetrievalMissDetail }
  | { readonly kind: "result_item_expanded"; readonly detail: ResultItemDetail }
  | { readonly kind: "result_item_collapsed"; readonly detail: ResultItemDetail }
  | { readonly kind: "traffic_requested"; readonly detail: TrafficRequestedDetail }
  | { readonly kind: "nav_slot_changed"; readonly detail: NavSlotChangedDetail }
  | { readonly kind: "nav_query_submitted"; readonly detail: NavQuerySubmittedDetail }
  | { readonly kind: "ai_chat_query_submitted"; readonly detail: AiChatQuerySubmittedDetail }
  | { readonly kind: "ai_chat_answer_received"; readonly detail: AiChatAnswerReceivedDetail }
  // §2.6
  | { readonly kind: "probe_option_hovered"; readonly detail: ProbeOptionHoveredDetail }
  | { readonly kind: "probe_answer_changed"; readonly detail: ProbeAnswerChangedDetail }
  | { readonly kind: "confidence_slider_moved"; readonly detail: ConfidenceSliderMovedDetail }
  | { readonly kind: "probe_submitted"; readonly detail: ProbeSubmittedDetail }
  | { readonly kind: "expectation_marked"; readonly detail: ExpectationMarkedDetail }
  | { readonly kind: "containment_judgement_submitted"; readonly detail: ContainmentJudgementSubmittedDetail }
  | { readonly kind: "containment_judgement_revised"; readonly detail: ContainmentJudgementSubmittedDetail }
  | { readonly kind: "failure_location_marked"; readonly detail: FailureLocationMarkedDetail }
  | { readonly kind: "corrected_projection_drawn"; readonly detail: CorrectedProjectionDrawnDetail }
  | { readonly kind: "allocation_changed"; readonly detail: AllocationChangedDetail }
  | { readonly kind: "allocation_submitted"; readonly detail: AllocationSubmittedDetail }
  | { readonly kind: "drone_tasked"; readonly detail: DroneTaskedDetail }
  | { readonly kind: "polygon_tool_opened"; readonly detail: PolygonToolDetail }
  | { readonly kind: "polygon_tool_abandoned"; readonly detail: PolygonToolDetail }
  | { readonly kind: "branch_list_presented"; readonly detail: BranchListPresentedDetail }
  | { readonly kind: "branch_option_hovered"; readonly detail: BranchOptionHoveredDetail }
  | { readonly kind: "branch_selected"; readonly detail: BranchSelectedDetail }
  | { readonly kind: "branch_list_abandoned"; readonly detail: BranchListAbandonedDetail }
  // Amendment
  | { readonly kind: "spam_prompt_shown"; readonly detail: SpamPromptShownDetail }
  | { readonly kind: "spam_ready"; readonly detail: SpamReadyDetail }
  | { readonly kind: "spam_collapsed"; readonly detail: SpamCollapseDetail }
  | { readonly kind: "spam_expanded"; readonly detail: SpamCollapseDetail }
  | { readonly kind: "spam_answered"; readonly detail: SpamAnsweredDetail }
  | { readonly kind: "recall_confidence_submitted"; readonly detail: RecallConfidenceSubmittedDetail }
  // SPEC/16 §8 (as narrowed by revision (d))
  | { readonly kind: "decision_presented"; readonly detail: DecisionPresentedDetail }
  | { readonly kind: "decision_option_hovered"; readonly detail: DecisionOptionHoveredDetail }
  | { readonly kind: "decision_initial_submitted"; readonly detail: DecisionInitialSubmittedDetail }
  // SPEC/15 §9 (23 Sep 2026) — two-phase cycle
  | { readonly kind: "exploration_phase_start"; readonly detail: ExplorationPhaseStartDetail }
  | { readonly kind: "decision_phase_start"; readonly detail: DecisionPhaseStartDetail }
  | { readonly kind: "freeze_submitted"; readonly detail: FreezeSubmittedDetail }
  // The view's flow (1 Oct 2026)
  | { readonly kind: "decision_panel_opened"; readonly detail: DecisionPanelOpenedDetail }
  | { readonly kind: "allocation_revised"; readonly detail: AllocationRevisedDetail }
  | { readonly kind: "allocation_revision_opened"; readonly detail: AllocationRevisionOpenedDetail }
  | { readonly kind: "outlook_submitted"; readonly detail: OutlookSubmittedDetail }
  | { readonly kind: "tour_completed"; readonly detail: TourCompletedDetail }
  | { readonly kind: "freeze_started"; readonly detail: FreezeStartedDetail }
  | { readonly kind: "freeze_item_completed"; readonly detail: FreezeItemCompletedDetail }
  | { readonly kind: "view_ended"; readonly detail: ViewEndedDetail }
  | { readonly kind: "step_boundary_reached"; readonly detail: StepBoundaryReachedDetail }
  // SPAM delivery and the manipulation check (round 2, 4 Oct 2026)
  | { readonly kind: "spam_closed"; readonly detail: SpamClosedDetail }
  | { readonly kind: "hinge_check_presented"; readonly detail: HingeCheckPresentedDetail }
  | { readonly kind: "hinge_check_answered"; readonly detail: HingeCheckAnsweredDetail }
  // SPEC/27 reconciliation (5 Oct 2026)
  | { readonly kind: "hinge_cell_note_shown"; readonly detail: HingeCellNoteShownDetail }
  // Final fix pass (8 Oct 2026): the directive's display and the tool tab
  | { readonly kind: "directive_shown"; readonly detail: DirectiveShownDetail }
  | { readonly kind: "tab_selected"; readonly detail: TabSelectedDetail }
  // The study shell (5 Oct 2026, work package I)
  | { readonly kind: "consent_decided"; readonly detail: ConsentDecidedDetail }
  | { readonly kind: "questionnaire_presented"; readonly detail: QuestionnairePresentedDetail }
  | { readonly kind: "questionnaire_submitted"; readonly detail: QuestionnaireSubmittedDetail }
  | { readonly kind: "debrief_shown"; readonly detail: DebriefShownDetail }
  | { readonly kind: "debrief_closed"; readonly detail: DebriefClosedDetail }
  | { readonly kind: "glossary_opened"; readonly detail: GlossaryOpenedDetail }
  | { readonly kind: "glossary_closed"; readonly detail: GlossaryClosedDetail }
  // The AI literacy test (9 Oct 2026, revision (ac))
  | { readonly kind: "ai_literacy_started"; readonly detail: AiLiteracyStartedDetail }
  | { readonly kind: "ai_literacy_answered"; readonly detail: AiLiteracyAnsweredDetail }
  | { readonly kind: "ai_literacy_submitted"; readonly detail: AiLiteracySubmittedDetail }
  // Map use (10 Oct 2026, SPEC/07 revision (al))
  | { readonly kind: "freeze_map_pick"; readonly detail: FreezeMapPickDetail }
  | { readonly kind: "map_labels_placed"; readonly detail: MapLabelsPlacedDetail }
  | { readonly kind: "window_size_warning"; readonly detail: WindowSizeWarningDetail };

export type RecordKind = TelemetryEvent["kind"];

/** Every record kind, as a value array — used by the coverage test to assert nothing is missed. Order here is the declaration order above (§2.1 -> §2.6 -> amendment -> decision), not alphabetical or insertion-derived from an object, so it stays stable (I1). */
/**
 * The log format version. "Adding a kind is a `formatVersion` bump" (SPEC/04 §10):
 * 0.2.0 adds `nav_slot_changed` and `nav_query_submitted` (SPEC/25 §7).
 * 0.3.0 adds the two-phase cycle's records and `phase` fields (SPEC/15 §9, SPEC/07 revision (i)).
 * 0.4.0 (SPEC/26): cycles are views 1–14; the practice view is view 0, phase `"practice"`
 * (`"warmup"` is gone); `decision_phase_start` drops `hasDecisionItem`; the header may carry
 * `previewOverride`.
 * 0.5.0 (SPEC/02 revision (o), SPEC/07 revision (j)): `own_projection_submitted` is removed (both
 * groups judge the envelope); the radio kinds `radio_request_submitted` and `unit_reply_delivered`
 * are removed (the participant cannot transmit); `allocation_submitted` gains `rationaleAsked` and
 * `rationaleFi` may be null (SPEC/15 revision (o)); the drawer id `"radio"` is removed.
 * 0.6.0 (SPEC/07 revision (q), SPEC/14 revision (q)): `ai_chat_query_submitted` carries `queryId`,
 * `view` and `virtualTimeS` and drops `resultAtomIds`; `ai_chat_answer_received` is added.
 * 0.7.0 (SPEC/16 revision 1 Oct 2026): `drone_tasked` is added.
 * 0.8.0 (the view's flow, researcher decision 1 Oct 2026): `decision_panel_opened`,
 * `allocation_revised`, `freeze_started` and `view_ended` are added; `decision_phase_start` is no
 * longer emitted; `exploration_phase_start.explorationSeconds` is the time before the decision panel
 * opens; the header's `previewOverride` carries `minViewSeconds`.
 * 0.9.4 (4 Oct 2026, the phase-B directive): `allocation_submitted` and `allocation_revised` plans
 * carry the main effort's `posture` (direct_attack | barrier_line | protect_values), required; the
 * duty officer's messages are from P2 (was P3); the V8 guidance is the directive.
 * Review round 2 (4 Oct 2026, same version, not yet released): `step_boundary_reached` is added
 * (a merged view reaches its second step); `hinge_pause_end` carries the real dwell
 * (`realDurationMs`, `dismissedEarly`), no longer the placeholder 0 / true.
 * Phase B round 2 (4 Oct 2026, same version, not yet released; D1/D2): the header's `cell` is the
 * real cell (`radio` | `reasoning_once` | `reasoning_intent`, from `?solu=` (opaque codes)), no longer derived
 * from the condition; `ai_chat_answer_received` carries `promptVariant` (`standard` | `intent`)
 * and, for the strategy-guided variant, `linjaus` {tila, perustelu} and `linjausTila`.
 * Round 2, agent C (4 Oct 2026, same version, not yet released): SPAM is delivered —
 * `spam_prompt_shown` carries `cycle` and `atViewSeconds`, `spam_ready` and `spam_answered` carry
 * `probeId` and no latency (`response` may be null), `spam_closed` is added; the manipulation check
 * on the hinge screen adds `hinge_check_presented` and `hinge_check_answered`.
 * SPEC/27 reconciliation (5 Oct 2026, same version, not yet released): `hinge_cell_note_shown` is
 * added (the Thinker cells' sentence about the `linjaus` line, after the hinge check); the header
 * may carry `assignment` (where the cell came from: the allocation table by participant code, `?solu=`,
 * or the start page).
 * Visible probes (5 Oct 2026, same version, not yet released; agent H): Type E, F and U are delivered —
 * `probe_presented` gains `cycle`, `atViewSeconds` and `decisionStep`; E answers as
 * `expectation_marked`, F and U as `probe_submitted` (text, option id, or the coverage confidence).
 * No new kind.
 * Type E withdrawn (researcher decision 6 Oct 2026, same version, not yet released; SPEC/08 revision (w)):
 * `expectation_marked` is no longer emitted and the header no longer carries `counterbalance`; both are
 * kept in the types so older logs still type. `probe_presented.type` is F or U.
 * English retrieval (SPEC/14 revision (v), 5 Oct 2026, same version, not yet released):
 * `ai_chat_answer_received` carries `retrievalLanguage` (`fi` | `en`), and `retrievalMode` may be
 * `hybrid_fi_fallback` (a demonstration proxy without the English index answered over the Finnish one).
 * Study shell (5 Oct 2026, work package I; same version, not yet released): `consent_decided`,
 * `questionnaire_presented`, `questionnaire_submitted`, `debrief_shown`, `debrief_closed`,
 * `glossary_opened` and `glossary_closed` are added; `preflight_result` gains optional fields (the
 * checks, the environment, the proxy); `spam_prompt_shown` and `spam_closed` may carry cycle 0 (the
 * practice SPAM item in VP, `probe.s.practice`); the engine gains the trigger `consent_declined`
 * (BOOT -> ABORTED).
 * Haku / Open Thinker redesign (8 Oct 2026, same version, not yet released): `ai_chat_query_submitted`
 * and `ai_chat_answer_received` carry `tool` (`haku` | `open_thinker`); Haku's chat is asked in every
 * cell and view, always `promptVariant: "standard"` (no `linjaus`).
 * Final fix pass (8 Oct 2026, same version, not yet released): `directive_shown` (the directive's persistent line
 * appears with P2's message at the hinge, once, every cell) and `tab_selected` (the right-panel tool tab: haku | open_thinker | none) are added.
 * Per-item freeze answer time (P1-5, 7 Oct 2026, same version, not yet released): each
 * `freeze_submitted` answer carries `answeredAtWallMs` and `msSinceFreezeOpened`; fix pass 3 adds
 * `freeze_item_completed`, logged as each item is left, so the moments survive a reload. Idle net of waits
 * (P1-8, same day): no idle time is counted while a Thinker request is pending or a freeze, visible
 * probe or SPAM item is open; `idle_end` may carry `endedBy: "wait_started"`.
 * AI literacy test (9 Oct 2026, revision (ac), same version, not yet released): `ai_literacy_started`,
 * `ai_literacy_answered` and `ai_literacy_submitted` are added (SNAIL after consent; AILIT-S in the
 * first build of the same day); the header
 * may carry `aiLiteracyTest`; `session_resumed.resumedAt` may be `ai_literacy`.
 * SPAM revision (ag) (9 Oct 2026, same version, not yet released): the ready prompt does not expire;
 * `spam_ready` may carry `forced` (with `atViewSeconds`, `viewEndedBy`, `resumed`) or `skipped`;
 * `spam_collapsed` and `spam_expanded` are added; `session_resumed.resumedAt` may be `spam_forced`.
 * Demonstration skip (6 Oct 2026, same version, not yet released): `freeze_submitted` may carry
 * `skipped: true` (the presenter skipped the rest of the freeze; only the items answered in full are
 * in `responses`), only in a log whose header carries `viewSkipAllowed`.
 * 0.9.3 (2 Oct 2026): the source question is withdrawn — `freeze_submitted` answers carry no `source`.
 * 0.9.2 (SPEC/15 r.12, SPEC/08 amendment 2 Oct): `freeze_submitted` answers carry `point` for map
 * items; `source` is asked on L2/L3 items only; freeze items carry `kind`/`goal` (content).
 * 0.9.1 (SPEC/15 r.11): `tour_completed` is added; the header's `guidedTour`.
 * 0.9.0 (SPEC/16 revision (s), 2 Oct 2026): `outlook_submitted` is added; `allocation_submitted`
 * and `allocation_revised` carry a sector `plan` (main effort, secondary sector, the drone teams'
 * task) instead of per-unit orders; the course-of-action item is no longer asked, so
 * `decision_presented` and `decision_initial_submitted` are not emitted; the panel step `coa` is
 * gone and `outlook` is new; `view_ended.endedBy` may be `time_cap`; `cycle_start.navSources`.
 * 0.8.2 (2 Oct 2026): the `fundamentally_wrong` follow-up is a structured correction (direction
 * and reach beyond the projection) — `containment_judgement_submitted.correction` replaces
 * `correctedProjection`, and the panel step `follow_up_draw` is now `follow_up_correction`.
 * 0.8.1 (review 2 Oct 2026): `allocation_revision_opened` is added; `cycle_start` carries
 * `minViewSeconds` and `freezeAtSeconds`; `tWallOffsetMs` is real milliseconds since the session started.
 */
/*
 * Map use (10 Oct 2026, SPEC/07 revision (al), same version, not yet released): `viewport_changed` is emitted (it had
 * no emitter) and gains `bearing`, `mapPx`, `view`, `cause` and `input`; `element_enter` / `element_leave` / `click`
 * are emitted for unit markers and stack badges (target kinds `unit`, `drone`, `unit_stack`); `layer_toggled` for the
 * legend (`layerId: "legend"`); `freeze_map_pick`, `map_labels_placed` and `window_size_warning` are added.
 */
export const TELEMETRY_FORMAT_VERSION = "0.9.4";

export const ALL_RECORD_KINDS: readonly RecordKind[] = [
  "session_started", "preflight_result", "briefing_advanced", "cycle_start", "cycle_end", "hinge_pause_start", "hinge_pause_end",
  "state_transition", "fault", "fault_resolved", "window_blur", "window_focus", "idle_start", "idle_end", "frame_stats",
  "session_completed", "session_resumed", "phase_entered",
  "bubble_available", "envelope_revealed", "channel_signal_emitted", "duty_officer_message_delivered", "probe_presented", "retrieval_returned",
  "traffic_returned",
  "click", "element_enter", "element_leave", "layer_toggled", "viewport_changed", "text_scrolled", "pointer_track",
  "drawer_opened", "drawer_closed", "drawer_tab_changed", "drawer_state_at_cycle_boundary",
  "query_focus", "query_first_keystroke", "query_edit", "query_submitted", "query_cleared", "retrieval_miss",
  "result_item_expanded", "result_item_collapsed", "traffic_requested",
  "nav_slot_changed", "nav_query_submitted", "ai_chat_query_submitted", "ai_chat_answer_received",
  "probe_option_hovered", "probe_answer_changed", "confidence_slider_moved", "probe_submitted", "expectation_marked",
  "containment_judgement_submitted", "containment_judgement_revised", "failure_location_marked",
  "corrected_projection_drawn", "allocation_changed", "allocation_submitted", "drone_tasked", "polygon_tool_opened",
  "polygon_tool_abandoned", "branch_list_presented", "branch_option_hovered", "branch_selected", "branch_list_abandoned",
  "spam_prompt_shown", "spam_ready", "spam_collapsed", "spam_expanded", "spam_answered", "recall_confidence_submitted",
  "decision_presented", "decision_option_hovered", "decision_initial_submitted",
  "exploration_phase_start", "decision_phase_start", "freeze_submitted",
  "decision_panel_opened", "allocation_revised", "allocation_revision_opened", "freeze_started", "freeze_item_completed", "view_ended",
  "outlook_submitted", "tour_completed", "step_boundary_reached",
  "spam_closed", "hinge_check_presented", "hinge_check_answered",
  "hinge_cell_note_shown", "directive_shown", "tab_selected",
  "consent_decided", "questionnaire_presented", "questionnaire_submitted", "debrief_shown", "debrief_closed", "glossary_opened", "glossary_closed",
  "ai_literacy_started", "ai_literacy_answered", "ai_literacy_submitted",
  "freeze_map_pick", "map_labels_placed", "window_size_warning",
];
