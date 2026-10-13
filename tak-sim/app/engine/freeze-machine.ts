/**
 * The run loop / freeze state machine — SPEC/05_System_Architecture.md §4,
 * extended by its "Amendment 2026-09-17" (warm-up/tutorial, PROBING_ONLINE).
 *
 * ```
 *             ┌──────────────────────────────────────────┐
 *             │                                          │
 * BOOT ─▶ PREFLIGHT ─▶ BRIEFING ─▶ WARMUP ─▶ TUTORIAL ─▶ RUNNING ─freeze(t)─▶ FREEZING
 *                                                            ▲                    │
 *                                                            │        ┌───────────┴───────────┐
 *                                                            │        ▼                       ▼
 *                                                            │  PROBING_VISIBLE        PROBING_BLANKED
 *                                                            │        │                       │
 *                                                            │        └───────────┬───────────┘
 *                                                            │                    ▼
 *                                                            └──────────────  RESUMING
 *                                                                                 │
 *  BOOT ─consent_declined─▶ ABORTED   (the study shell's consent screen, 5 Oct 2026)
 *  any ─▶ FAULT_PAUSED ─▶ RUNNING | ABORTED                                      ▼
 *                                                                          (next cycle)
 *  RUNNING ─online_probe(t)─▶ PROBING_ONLINE ─▶ RUNNING   (clock NOT halted)
 *  after cycle 10 ─▶ HINGE_PAUSE ─▶ RUNNING
 *  after cycle 20 ─▶ DEBRIEF_HANDOFF ─▶ COMPLETE
 * ```
 *
 * Design note (not settled by the spec, decided here): FAULT_PAUSED is
 * reachable via the `fault` trigger from every state that still has
 * outgoing transitions. COMPLETE and ABORTED are terminal — once a session
 * has ended there is nothing left to interrupt, so they accept no further
 * triggers, `fault` included. This is documented so it is auditable rather
 * than silently assumed.
 */

import { compareStrings } from "./deterministic-object.js";

export const STATES = [
  "BOOT",
  "PREFLIGHT",
  "BRIEFING",
  "WARMUP",
  "TUTORIAL",
  "RUNNING",
  "FREEZING",
  "PROBING_VISIBLE",
  "PROBING_BLANKED",
  "PROBING_ONLINE",
  "RESUMING",
  "HINGE_PAUSE",
  "FAULT_PAUSED",
  "DEBRIEF_HANDOFF",
  "COMPLETE",
  "ABORTED",
] as const;

export type EngineState = (typeof STATES)[number];

export const TERMINAL_STATES: ReadonlySet<EngineState> = new Set(["COMPLETE", "ABORTED"]);

export type Trigger =
  | "start"
  | "consent_declined"
  | "preflight_passed"
  | "preflight_refused"
  | "briefing_complete"
  | "warmup_complete"
  | "tutorial_complete"
  | "freeze"
  | "enter_probing_visible"
  | "enter_probing_blanked"
  | "probe_complete"
  | "resumed"
  | "online_probe"
  | "online_probe_complete"
  | "hinge_reached"
  | "hinge_dismissed"
  | "session_complete"
  | "handoff_complete"
  | "fault"
  | "fault_resolved"
  | "abort";

/**
 * Explicit transitions, excluding the universal `fault` transition which is
 * applied separately in {@link FreezeMachine.transition}.
 */
const TRANSITIONS: Partial<Record<EngineState, Partial<Record<Trigger, EngineState>>>> = {
  // The study shell (5 Oct 2026): consent is asked in BOOT, before anything else is logged; declining ends the session.
  BOOT: { start: "PREFLIGHT", consent_declined: "ABORTED" },
  PREFLIGHT: { preflight_passed: "BRIEFING", preflight_refused: "ABORTED" },
  BRIEFING: { briefing_complete: "WARMUP" },
  WARMUP: { warmup_complete: "TUTORIAL" },
  TUTORIAL: { tutorial_complete: "RUNNING" },
  RUNNING: {
    freeze: "FREEZING",
    online_probe: "PROBING_ONLINE",
    hinge_reached: "HINGE_PAUSE",
    session_complete: "DEBRIEF_HANDOFF",
  },
  FREEZING: {
    enter_probing_visible: "PROBING_VISIBLE",
    enter_probing_blanked: "PROBING_BLANKED",
  },
  PROBING_VISIBLE: { probe_complete: "RESUMING" },
  PROBING_BLANKED: { probe_complete: "RESUMING" },
  PROBING_ONLINE: { online_probe_complete: "RUNNING" },
  RESUMING: { resumed: "RUNNING" },
  HINGE_PAUSE: { hinge_dismissed: "RUNNING" },
  FAULT_PAUSED: { fault_resolved: "RUNNING", abort: "ABORTED" },
  DEBRIEF_HANDOFF: { handoff_complete: "COMPLETE" },
  COMPLETE: {},
  ABORTED: {},
};

/** States in {@link PROBING_BLANKED} vs {@link PROBING_VISIBLE} render differently but both halt the clock and disable the channel (SPEC/05 §4). */
export const CLOCK_HALTED_STATES: ReadonlySet<EngineState> = new Set([
  "FREEZING",
  "PROBING_VISIBLE",
  "PROBING_BLANKED",
  "RESUMING",
  "HINGE_PAUSE",
  "FAULT_PAUSED",
]);

export interface StateTransitionEvent {
  readonly from: EngineState;
  readonly to: EngineState;
  readonly trigger: Trigger;
}

export class InvalidTransitionError extends Error {
  constructor(from: EngineState, trigger: Trigger) {
    super(`No transition "${trigger}" from state "${from}"`);
    this.name = "InvalidTransitionError";
  }
}

export class FreezeMachine {
  private state: EngineState;
  private readonly history: StateTransitionEvent[] = [];

  constructor(initial: EngineState = "BOOT") {
    this.state = initial;
  }

  current(): EngineState {
    return this.state;
  }

  isClockHalted(): boolean {
    return CLOCK_HALTED_STATES.has(this.state);
  }

  isTerminal(): boolean {
    return TERMINAL_STATES.has(this.state);
  }

  /**
   * Returns the set of triggers valid from the current state, for
   * UI/tooling introspection. Sorted (invariant I1: "iteration order is
   * sorted, never insertion order") rather than relying on `Object.keys`
   * object-property order.
   */
  validTriggers(): Trigger[] {
    // determinism-lint-allow: result is sorted immediately below with an explicit comparator, so Object.keys' own iteration order never leaks out (I1).
    const fromTable = (Object.keys(TRANSITIONS[this.state] ?? {}) as Trigger[]).sort(compareStrings);
    if (this.isTerminal()) {
      return fromTable;
    }
    return [...fromTable, "fault" as Trigger].sort(compareStrings);
  }

  /**
   * Applies `trigger`. Returns the transition event. Throws
   * {@link InvalidTransitionError} if `trigger` is not valid from the
   * current state.
   */
  transition(trigger: Trigger): StateTransitionEvent {
    const from = this.state;

    if (trigger === "fault") {
      if (this.isTerminal()) {
        throw new InvalidTransitionError(from, trigger);
      }
      return this.apply(from, "fault", "FAULT_PAUSED");
    }

    const to = TRANSITIONS[from]?.[trigger];
    if (to === undefined) {
      throw new InvalidTransitionError(from, trigger);
    }
    return this.apply(from, trigger, to);
  }

  private apply(from: EngineState, trigger: Trigger, to: EngineState): StateTransitionEvent {
    this.state = to;
    const event: StateTransitionEvent = { from, to, trigger };
    this.history.push(event);
    return event;
  }

  /** Full transition history for this machine instance, in order. */
  getHistory(): readonly StateTransitionEvent[] {
    return this.history;
  }
}
