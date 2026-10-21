/**
 * What the session orchestrator exposes to the UI — built from `Renderable*` types plus plain UI
 * state, never truth (I4). Split out of `orchestrator.ts`.
 */

import type { RenderableAtom, RenderableEnvelope } from "../boundary/render-boundary.js";
import type { CycleIndex, LatLon, Polygon } from "../engine/primitives.js";
import type { RenderTree } from "../render/render-tree.js";
import type { PracticeViewIndex, ScenarioContract } from "../scenario/types.js";
import type { AllocationView } from "./allocation.js";
import type { SectorPlan } from "../scenario/plan-types.js";
import type { PreviewOverride } from "./preview.js";
import type { TemplateAnswer } from "./template-answer.js";
import type { OpenStructuredView } from "./open-answer.js";
import type { Lang } from "../i18n/lang.js";
import type { VisibleProbeView } from "./visible-probes.js";
import type { Cell } from "../scenario/types.js";
import type { QuestionnaireItem } from "./questionnaire.js";
import type { PreflightOutcome } from "./preflight.js";
import type { QuestionnaireId } from "../telemetry/record-kinds.js";
import type { AiLiteracyView } from "./ai-literacy.js";
import type { ConsultPromptView } from "./consult-notice.js";
import type { PlanConfidenceView } from "./plan-confidence.js";
import type { PlanReviewView } from "./plan-review.js";

export type CyclePhase = "exploration" | "freeze" | "decision";

/** The cycle phase a judgement step belongs to. */
export function cyclePhaseOf(step: JudgementStep): CyclePhase {
  return step === "exploration" || step === "freeze" ? step : "decision";
}

/**
 * Where the participant is. `briefing` (the setting text) comes before the practice view and
 * `training` (the group-specific text) after it, before V1 (SPEC/15 §2, SPEC/05 §4). In a view
 * (decision 1 Oct 2026): `exploration` until the decision panel opens, then the `allocation` (the
 * sector plan, the decision, whose submission confirms the period — the only response a view asks
 * for since revision (x), 6 Oct 2026: Type J, its follow-ups, the verification step and the outlook
 * are withdrawn), and `awaiting_view_end` until the view's minimum length is reached (the plan may be
 * revised meanwhile). `freeze` interrupts any of them and returns there. A view also ends at its
 * 150 s cap, wherever the participant is. SPEC/30: after a main view's end, `plan_confidence`; in V10
 * and V14 then the end-of-view `freeze`, which leads on to what follows the view. SPEC/32 §3: in phase B, `plan_review` at the
 * moment the plan would become final (the clock standing still), before the view ends.
 */
export type JudgementStep =
  | "briefing"
  | "training"
  | "exploration"
  | "freeze"
  | "allocation"
  | "awaiting_view_end"
  | "hinge_pause"
  | "complete"
  /** A visible probe (Type U) is open: the map stays, the clock stands still, the participant returns to `resumeStep` (5 Oct 2026). */
  | "probe"
  /** SPEC/30 §5.4: a main view has ended; its plan's confidence is asked (the map stays, the tools are closed). */
  | "plan_confidence"
  /** SPEC/32 §3: phase B, the plan review at commitment (the map and the message log stay, the tools are closed, the clock stands still). */
  | "plan_review"
  // The study shell (5 Oct 2026, `SessionOptions.studyShell`): consent and the preflight before the
  // briefing, the pre-session item after them; the post-session questionnaire and the debrief after V14.
  | "consent"
  | "consent_declined"
  /** The AI literacy test (9 Oct 2026, revision (ac)): right after consent, before the preflight (`ai-literacy.ts`). */
  | "ai_literacy"
  | "preflight"
  | "preflight_refused"
  | "questionnaire"
  | "debrief"
  /** SPEC/35 §3 item 1 (public sessions): the primer, after the pre-session item and before the intro video and VP (`public-session.ts`). */
  | "primer"
  /** SPEC/35 §4 (public sessions): the commander profile, after the post-session questionnaire and before the debrief. */
  | "profile";

/** The guided tour at VP and the tool reminder at V1 (SPEC/15 r.11). */
export type TourId = "practice" | "tools";

/** A view index: 0 = the practice view VP, 1–14 = V1–V14. */
export type ViewIndex = CycleIndex | PracticeViewIndex;

export interface AiChatTurn {
  readonly query: string;
  readonly answer: TemplateAnswer;
}

export interface OpenThinkerTurn {
  readonly query: string;
  /** Empty when the Thinker was unavailable (M1, 8 Oct 2026). */
  readonly answer: string;
  /** The model did not answer (any fallback): the tab shows the unavailable state. */
  readonly unavailable: boolean;
  /** Revision (aq): the structured answer `answer` was rendered from; absent for a turn restored from the log or answered by an older proxy (the tab draws the text). */
  readonly structured?: OpenStructuredView;
}

export interface RadioLogEntry {
  /** The record shown (its English is looked up by id, `app/i18n/text.ts`); none for the duty officer's messages. */
  readonly id?: string;
  readonly clockLabel: string;
  readonly from: string;
  readonly text: string;
}

/**
 * A freeze as the UI shows it: its items, without the cycle it belongs to and without any TRUTH —
 * no `mapKey`, no `projectionPoint`, no `keyAtomIds` and (round 2, 4 Oct 2026) no option's `correct` flag.
 */
export interface FreezeView {
  readonly items: readonly RenderableFreezeItem[];
}
type FreezeItemSpec = ScenarioContract["freezes"][number]["items"][number];
export type RenderableFreezeItem = Omit<FreezeItemSpec, "mapKey" | "projectionPoint" | "projectionOptionId" | "keyAtomIds" | "options"> & {
  readonly options: readonly Omit<FreezeItemSpec["options"][number], "correct">[];
};

export interface SessionSnapshot {
  readonly currentCycle: ViewIndex;
  /** The session language, chosen on the first page (`app/i18n/lang.ts`). */
  readonly language: Lang;
  /** The guided tour showing (SPEC/15 r.11): `practice` at VP, `tools` (the tool reminder) at V1; the view's time waits. */
  readonly tour: TourId | null;
  /**
   * The superior's directive (Finnish; its English by `tr`) while the hinge pause shows, else null
   * (4 Oct 2026): identical for both groups, and also V8's opening message (`radioLog`, from P2).
   */
  readonly hingeDirective: string | null;
  /** True in the practice view (SPEC/26 D3). */
  readonly practice: boolean;
  /** "Harjoitus" or "Jakso n / 14" (SPEC/26 §3). */
  readonly viewLabel: string;
  readonly phase: "A" | "B";
  readonly clockLabel: string;
  readonly step: JudgementStep;
  readonly cyclePhase: CyclePhase;
  /** The view's minimum length and the moment its decision panel opens, in view seconds, the preview override applied. */
  readonly minViewSeconds: number;
  readonly decisionOpensAtSeconds: number;
  /** The view's minimum length has passed: confirming the period now ends the view. */
  readonly minimumReached: boolean;
  /** The participant is resubmitting the allocation after confirming the period. */
  readonly revisingAllocation: boolean;
  /**
   * The plan last recorded in this view (submitted, or its latest revision), else null (6 Oct 2026): the
   * "recorded" line while the view waits for its end, and the form's prefill when "Muuta kohdennusta"
   * reopens it. The participant's own answer, a copy; no key.
   */
  readonly recordedPlan: SectorPlan | null;
  /** The previous view ended at its cap with no plan recorded (6 Oct 2026): true only during this view's exploration step. */
  readonly previousViewTimedOutWithoutPlan: boolean;
  readonly freeze: FreezeView | null;
  readonly renderTree: RenderTree;
  readonly currentEnvelope: RenderableEnvelope | null;
  /** The allocation step's offer: crews and drone teams on scene in this view, their tasks, the sectors (SPEC/16 revision 1 Oct 2026). */
  readonly allocation: AllocationView;
  readonly bubbleHistory: readonly RenderableAtom[];
  readonly radioLog: readonly RadioLogEntry[];
  readonly aiChatHistory: readonly AiChatTurn[];
  readonly openThinkerHistory: readonly OpenThinkerTurn[];
  readonly logRecordCount: number;
  readonly conditionLabel: "directed" | "substitutive";
  /** The Thinker tool is offered: the AI condition, outside the practice view (SPEC/26 D3). */
  readonly aiAvailable: boolean;
  /** The development preview override, when active (`preview.ts`). */
  readonly previewOverride: PreviewOverride | null;
  /** Whole seconds left in the final countdown before the view's minimum length (last 20 s), else null. */
  readonly secondsLeft: number | null;
  /** Whether freeze items show their SA level (demonstration) or not (study, `?tuotanto`). */
  readonly showProbeLevels: boolean;
  /** Demonstration only (`SessionOptions.allowViewSkip`): the presenter may skip views and freezes. */
  readonly skipAllowed: boolean;
  /** "Skip the rest of this view" is offered now (`SessionOrchestrator.skipView`); a freeze has its own skip. */
  readonly skipAvailable: boolean;
  /** The SPAM probe on screen (online: the map and the message log stay), else null. Carries no key. */
  readonly spam: SpamView | null;
  /** Haku and Thinker are locked: a visible probe (U; Types E and F withdrawn) is open (5 Oct 2026). Not during a SPAM item since revision (ag) (9 Oct 2026). The map and the message log stay usable. */
  readonly toolsLocked: boolean;
  /** The decision strip is held (inert, drafts kept): a SPAM item or a visible probe is open. */
  readonly decisionHeld: boolean;
  /** The participant waits on the session — a Thinker request pending, or a freeze, visible probe or SPAM item open: idle time is not counted (`attention.ts`, P1-8). */
  readonly waitingOnSession: boolean;
  /** The visible probe on screen (Type F or U; `visible-probes.ts`), else null. Carries no key. */
  readonly visibleProbe: VisibleProbeView | null;
  /** The manipulation check on the hinge screen (brief D3), else null. Carries no key. */
  readonly hingeCheck: HingeCheckView | null;
  /**
   * The command directive (Finnish; its English by `tr`) from V8 on, else null (D1, 8 Oct 2026): the
   * persistent "Johdon linjaus" line at the top of the right panel, identical in every cell.
   */
  readonly directiveInForce: string | null;
  /**
   * Reading time after an answer (P1-1, 8 Oct 2026): for this many ms after a Thinker answer arrives
   * the participant is reading, not idle (`attention.ts`); 0 while no answer is being read.
   */
  readonly readingGraceMs: number;
  /** The study shell's preflight (step `preflight` / `preflight_refused`): whether the proxy is checked, the last outcome, whether a demonstration may override. */
  readonly preflight: PreflightView | null;
  /** The questionnaire on screen (step `questionnaire`), else null. Carries no key. */
  readonly questionnaire: QuestionnaireView | null;
  /** The AI literacy test on screen (step `ai_literacy`), else null. Carries no key. */
  readonly aiLiteracy: AiLiteracyView | null;
  /** The debrief on screen (step `debrief`): its text id and the cell it is written for. */
  readonly debrief: { readonly textId: string; readonly cell: Cell } | null;
  /** The intro video before the practice view (step `briefing`, `SessionOptions.introVideo`): its URL and whether a demonstration may skip it. */
  readonly introVideo: { readonly src: string; readonly skippable: boolean } | null;
  /** SPEC/30 §4: the consult notification on screen (beside the tool button), else null. Carries no content. */
  readonly consultPrompt: ConsultPromptView | null;
  /** SPEC/30 §4: the guide's suggested-question chip above the Thinker's input (`reasoning_intent`, from V8), else false. */
  readonly suggestedQuestion: boolean;
  /** SPEC/30 §5.4: the plan-confidence item on screen (step `plan_confidence`, once its record is durable), else null. */
  readonly planConfidence: PlanConfidenceView | null;
  /** SPEC/32 §3: the plan review on screen (step `plan_review`, once `plan_review_shown` is durable), else null. Carries no key. */
  readonly planReview: PlanReviewView | null;
}

export interface PreflightView {
  readonly proxyNeeded: boolean;
  readonly outcome: PreflightOutcome | null;
  readonly overrideAllowed: boolean;
}

export interface QuestionnaireView {
  readonly id: QuestionnaireId;
  readonly items: readonly QuestionnaireItem[];
  /** The hinge check's options in the retention item's order (SPEC/27 §4.1), no key. */
  readonly retentionOptions: readonly { readonly id: string; readonly labelFi: string }[];
}

/**
 * A SPAM probe as the UI shows it (SPEC/15 §5, round 2; revision (ag)): `ready` — the ready prompt
 * only, the question not yet shown, `collapsed` to its pill or not; `item` — the question and its
 * options, the decision panel held; `confidence` — the option chosen (final), its confidence asked.
 * Haku and the Thinker stay usable throughout (revision (ag)). `forced`: the view's time is up and the
 * item was forced before the view ends (shown as a modal step over the map and the decision strip).
 */
export type SpamView =
  | { readonly phase: "ready"; readonly probeId: string; readonly collapsed: boolean }
  | {
    readonly phase: "item" | "confidence"; readonly probeId: string; readonly promptFi: string; readonly options: readonly { readonly id: string; readonly fi: string }[]; readonly chosen: string | null; readonly forced: boolean;
    /** SPEC/30 §5.2: which item of the delivery this is (1 or 2) and how many it has (2 in V3 and V6 once authored). */
    readonly itemIndex: 1 | 2; readonly itemCount: 1 | 2;
  };

/** The hinge check: `directive` — the directive on screen; `item` — the question; `answered` — Continue enabled. */
export interface HingeCheckView {
  readonly phase: "directive" | "item" | "answered";
  readonly promptFi: string;
  readonly options: readonly { readonly id: string; readonly labelFi: string }[];
  readonly chosen: string | null;
}
