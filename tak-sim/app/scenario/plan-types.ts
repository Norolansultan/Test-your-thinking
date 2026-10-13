/**
 * The view's decision (researcher decision 2 Oct 2026, SPEC/16 revision (s)).
 *
 * The OUTLOOK (the next 30 minutes' development and the need for more resources) is no longer asked
 * (revision (x), 6 Oct 2026: a per-view forecast rehearses what the freeze L3 items measure); its
 * types stay so older logs (`outlook_submitted`) still type.
 *
 * The SECTOR PLAN replaces the per-unit order sheet: the crews' main effort (a sector), optionally
 * a secondary sector with its purpose, and optionally the observation drone teams' task. Nothing is
 * offered as a ready option and nothing is preselected, so the plan is the participant's own (the
 * L3 anticipation of the rekindle, H10, still needs them to think of L3 themselves). It confirms
 * the period; the course-of-action item is no longer asked.
 */

export const OUTLOOK_DEVELOPMENTS = ["calms", "unchanged", "worsens", "worsens_sharply"] as const;
export type OutlookDevelopment = (typeof OUTLOOK_DEVELOPMENTS)[number];

export interface OutlookAnswer {
  readonly development: OutlookDevelopment;
  readonly developmentConfidence: number;
  readonly resourcesNeeded: boolean;
  readonly resourcesConfidence: number;
}

/**
 * The secondary sector's purposes. Direct attack added 6 Oct 2026 (researcher decision): at V14 a
 * direct attack on the flare-up as the secondary sector, the main effort protecting Lahdenkylä, is sound.
 */
export const SECONDARY_TASK_IDS = ["task.direct-attack", "task.hold-line", "task.mopup"] as const;
export type SecondaryTaskId = (typeof SECONDARY_TASK_IDS)[number];
/** The observation drone teams' tasks (`DRONE_SURVEY_TASK_IDS` in `derived-measures.ts`). */
export const PLAN_DRONE_TASK_IDS = ["task.thermal-survey", "task.perimeter-map", "task.watch"] as const;
export type PlanDroneTaskId = (typeof PLAN_DRONE_TASK_IDS)[number];

/**
 * The main effort's posture (phase-B directive redesign, researcher decision 4 Oct 2026): how the
 * crews work in the main-effort sector. Asked in every view (practice and phase A too, so phase A
 * gives a baseline); nothing preselected, and no justification asked when it departs from the
 * directive. Scored only against the truth-only keys of `demo-directive.ts` (`directiveAdherence`).
 */
export const MAIN_EFFORT_POSTURES = ["direct_attack", "barrier_line", "protect_values"] as const;
export type MainEffortPosture = (typeof MAIN_EFFORT_POSTURES)[number];

export interface SectorPlan {
  /** The crews' main effort: a sector id (L1–L4). */
  readonly mainEffort: string;
  /** How the main effort works (4 Oct 2026): required. */
  readonly posture: MainEffortPosture;
  /** Null: no secondary sector. Never the main effort's sector. */
  readonly secondary: { readonly sectorId: string; readonly taskId: SecondaryTaskId } | null;
  /** Null: the observation drone teams carry on with their current tasks. */
  readonly drones: { readonly sectorId: string; readonly taskId: PlanDroneTaskId } | null;
  /**
   * The departure note (fix pass 6, D5, 8 Oct 2026): from V8 on, identically in both conditions, an optional checkbox "I am departing
   * from the command directive". Absent in views before V8 and in older logs. The reason only with the checkbox: since revision (ai),
   * 9 Oct 2026, an optional single choice of {@link DEPARTURE_REASONS} (nothing preselected; no free text). Logs before (ai) may carry
   * a one-line free-text reason here.
   */
  readonly departureNoted?: boolean;
  readonly departureReason?: DepartureReason;
}

/** The departure note is offered from this view on (V8). */
export const DEPARTURE_NOTE_FROM_VIEW = 8;
/**
 * The departure's main reason (revision (ai), 9 Oct 2026; descriptive, SPEC/27): no "a tool suggested
 * it" option (two of three reviewers; the HCI reviewer's dissent is in SPEC/11). Never sent to the
 * Thinker (the plan context is derived on the server from the view, `openPlanContext`).
 */
export const DEPARTURE_REASONS = ["crew_safety", "protect_people_property", "new_fire_info", "directive_unfit", "resources", "other"] as const;
export type DepartureReason = (typeof DEPARTURE_REASONS)[number];
