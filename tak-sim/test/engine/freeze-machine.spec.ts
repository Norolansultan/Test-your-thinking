import { describe, expect, it } from "vitest";
import {
  CLOCK_HALTED_STATES,
  FreezeMachine,
  InvalidTransitionError,
  STATES,
  TERMINAL_STATES,
  type EngineState,
  type Trigger,
} from "../../app/engine/freeze-machine.js";

/** The full, intended happy-path route through every non-terminal state. */
const HAPPY_PATH: readonly Trigger[] = [
  "start", // BOOT -> PREFLIGHT
  "preflight_passed", // -> BRIEFING
  "briefing_complete", // -> WARMUP
  "warmup_complete", // -> TUTORIAL
  "tutorial_complete", // -> RUNNING
  "online_probe", // -> PROBING_ONLINE
  "online_probe_complete", // -> RUNNING
  "hinge_reached", // -> HINGE_PAUSE
  "hinge_dismissed", // -> RUNNING
  "freeze", // -> FREEZING
  "enter_probing_visible", // -> PROBING_VISIBLE
  "probe_complete", // -> RESUMING
  "resumed", // -> RUNNING
  "session_complete", // -> DEBRIEF_HANDOFF
  "handoff_complete", // -> COMPLETE
];

describe("FreezeMachine — happy path", () => {
  it("walks BOOT through COMPLETE via every intermediate state", () => {
    const m = new FreezeMachine();
    const visited: EngineState[] = [m.current()];
    for (const trigger of HAPPY_PATH) {
      m.transition(trigger);
      visited.push(m.current());
    }
    expect(visited).toEqual([
      "BOOT",
      "PREFLIGHT",
      "BRIEFING",
      "WARMUP",
      "TUTORIAL",
      "RUNNING",
      "PROBING_ONLINE",
      "RUNNING",
      "HINGE_PAUSE",
      "RUNNING",
      "FREEZING",
      "PROBING_VISIBLE",
      "RESUMING",
      "RUNNING",
      "DEBRIEF_HANDOFF",
      "COMPLETE",
    ]);
  });

  it("supports the PROBING_BLANKED branch out of FREEZING", () => {
    const m = new FreezeMachine("RUNNING");
    m.transition("freeze");
    m.transition("enter_probing_blanked");
    expect(m.current()).toBe("PROBING_BLANKED");
    m.transition("probe_complete");
    expect(m.current()).toBe("RESUMING");
  });

  it("preflight can refuse straight to ABORTED", () => {
    const m = new FreezeMachine("PREFLIGHT");
    m.transition("preflight_refused");
    expect(m.current()).toBe("ABORTED");
  });
});

describe("FreezeMachine — clock-halted states (SPEC/05 §4)", () => {
  it("FREEZING, both probing modes, RESUMING, HINGE_PAUSE and FAULT_PAUSED halt the clock", () => {
    expect(CLOCK_HALTED_STATES).toEqual(
      new Set(["FREEZING", "PROBING_VISIBLE", "PROBING_BLANKED", "RESUMING", "HINGE_PAUSE", "FAULT_PAUSED"]),
    );
  });

  it("PROBING_ONLINE does NOT halt the clock (amendment 2026-09-17)", () => {
    const m = new FreezeMachine("RUNNING");
    m.transition("online_probe");
    expect(m.current()).toBe("PROBING_ONLINE");
    expect(m.isClockHalted()).toBe(false);
  });

  it("RUNNING, BOOT/PREFLIGHT/BRIEFING/WARMUP/TUTORIAL and terminal states do not halt the clock", () => {
    for (const s of ["BOOT", "PREFLIGHT", "BRIEFING", "WARMUP", "TUTORIAL", "RUNNING", "DEBRIEF_HANDOFF", "COMPLETE", "ABORTED"] as const) {
      const m = new FreezeMachine(s);
      expect(m.isClockHalted()).toBe(false);
    }
  });
});

describe("FreezeMachine — FAULT_PAUSED reachable from every state (M1 acceptance)", () => {
  const nonTerminal = STATES.filter((s) => !TERMINAL_STATES.has(s));

  it.each(nonTerminal)("fault from %s lands on FAULT_PAUSED", (state) => {
    const m = new FreezeMachine(state);
    const event = m.transition("fault");
    expect(event).toEqual({ from: state, to: "FAULT_PAUSED", trigger: "fault" });
    expect(m.current()).toBe("FAULT_PAUSED");
  });

  it.each([...TERMINAL_STATES])("fault from terminal state %s is rejected", (state) => {
    const m = new FreezeMachine(state);
    expect(() => m.transition("fault")).toThrow(InvalidTransitionError);
  });

  it("FAULT_PAUSED can resolve back to RUNNING", () => {
    const m = new FreezeMachine("FAULT_PAUSED");
    m.transition("fault_resolved");
    expect(m.current()).toBe("RUNNING");
  });

  it("FAULT_PAUSED can be aborted", () => {
    const m = new FreezeMachine("FAULT_PAUSED");
    m.transition("abort");
    expect(m.current()).toBe("ABORTED");
  });
});

describe("FreezeMachine — invalid transitions", () => {
  it("throws InvalidTransitionError for a trigger not valid from the current state", () => {
    const m = new FreezeMachine("BOOT");
    expect(() => m.transition("resumed")).toThrow(InvalidTransitionError);
  });

  it("records no history entry on a rejected transition", () => {
    const m = new FreezeMachine("BOOT");
    try {
      m.transition("resumed");
    } catch {
      // expected
    }
    expect(m.getHistory()).toHaveLength(0);
    expect(m.current()).toBe("BOOT");
  });

  it("validTriggers() reflects exactly what transition() will accept", () => {
    const m = new FreezeMachine("RUNNING");
    for (const t of m.validTriggers()) {
      const clone = new FreezeMachine("RUNNING");
      expect(() => clone.transition(t)).not.toThrow();
    }
  });
});

describe("FreezeMachine — history and determinism", () => {
  it("is a pure function of the trigger sequence", () => {
    const run = () => {
      const m = new FreezeMachine();
      for (const t of HAPPY_PATH) m.transition(t);
      return { state: m.current(), history: m.getHistory() };
    };
    const a = run();
    const b = run();
    expect(a.state).toBe(b.state);
    expect(a.history).toEqual(b.history);
  });

  it("history records every from/to/trigger in order", () => {
    const m = new FreezeMachine("RUNNING");
    m.transition("freeze");
    m.transition("enter_probing_visible");
    expect(m.getHistory()).toEqual([
      { from: "RUNNING", to: "FREEZING", trigger: "freeze" },
      { from: "FREEZING", to: "PROBING_VISIBLE", trigger: "enter_probing_visible" },
    ]);
  });
});
