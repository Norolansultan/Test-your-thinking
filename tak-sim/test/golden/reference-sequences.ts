/**
 * The three reference input sequences for the M1 golden-run test
 * (SPEC/10 M1: "replays three reference input sequences and produces
 * byte-identical logs against committed fixtures"). Shared between the
 * fixture generator and the spec so there is exactly one definition.
 */

import type { ReferenceAction } from "./reference-runner.js";

const BOOT_TO_RUNNING: readonly ReferenceAction[] = [
  { type: "transition", trigger: "start" },
  { type: "transition", trigger: "preflight_passed" },
  { type: "transition", trigger: "briefing_complete" },
  { type: "transition", trigger: "warmup_complete" },
  { type: "transition", trigger: "tutorial_complete" },
];

/** Sequence 1 — a full session of 14 views (SPEC/26 §3), boot to COMPLETE, cycling through every freeze mode. */
export function fullHappyPathSequence(): ReferenceAction[] {
  const actions: ReferenceAction[] = [...BOOT_TO_RUNNING, { type: "draw_u64", label: "session-init" }];

  for (let cycle = 1; cycle <= 14; cycle++) {
    actions.push({ type: "draw_int", bound: 6, label: `probe-order-cycle-${cycle}` });

    if (cycle % 3 === 0) {
      actions.push(
        { type: "transition", trigger: "freeze" },
        { type: "transition", trigger: "enter_probing_visible" },
        { type: "transition", trigger: "probe_complete" },
        { type: "transition", trigger: "resumed" },
      );
    } else if (cycle % 5 === 0) {
      actions.push(
        { type: "transition", trigger: "freeze" },
        { type: "transition", trigger: "enter_probing_blanked" },
        { type: "transition", trigger: "probe_complete" },
        { type: "transition", trigger: "resumed" },
      );
    } else if (cycle % 7 === 0) {
      actions.push({ type: "transition", trigger: "online_probe" }, { type: "transition", trigger: "online_probe_complete" });
    }

    actions.push({ type: "advance", deltaSeconds: 90 }, { type: "end_cycle" });

    if (cycle === 7) {
      actions.push({ type: "dismiss_hinge" });
    }
  }

  actions.push({ type: "transition", trigger: "handoff_complete" });
  return actions;
}

/** Sequence 2 — a short, partial session (does not reach COMPLETE) exercising every probe mode plus shuffle/draw_int PRNG draws. */
export function shortMixedProbesSequence(): ReferenceAction[] {
  return [
    ...BOOT_TO_RUNNING,
    { type: "transition", trigger: "online_probe" },
    { type: "draw_int", bound: 4, label: "spam-question-pick" },
    { type: "transition", trigger: "online_probe_complete" },
    { type: "advance", deltaSeconds: 45 },
    { type: "end_cycle" }, // V1

    { type: "transition", trigger: "freeze" },
    { type: "transition", trigger: "enter_probing_blanked" },
    { type: "shuffle", items: ["r1", "r2", "r3", "r4"], label: "recall-item-order" },
    { type: "transition", trigger: "probe_complete" },
    { type: "transition", trigger: "resumed" },
    { type: "advance", deltaSeconds: 60 },
    { type: "end_cycle" }, // V2

    { type: "draw_u64", label: "mid-session-marker" },
    { type: "shuffle", items: ["holds", "partly_wrong", "fundamentally_wrong"], label: "not-actually-shuffled-in-prod-fixed-order-here" },
    { type: "advance", deltaSeconds: 30 },
    { type: "end_cycle" }, // V3

    { type: "transition", trigger: "freeze" },
    { type: "transition", trigger: "enter_probing_visible" },
    { type: "draw_int", bound: 100, label: "confidence-settle" },
    { type: "transition", trigger: "probe_complete" },
    { type: "transition", trigger: "resumed" },
    { type: "advance", deltaSeconds: 70 },
    { type: "end_cycle" }, // V4
  ];
}

/** Sequence 3 — induces two faults (one in phase A, one in phase B) and proves determinism survives fault/resume. Does not reach COMPLETE. */
export function faultAndResumeSequence(): ReferenceAction[] {
  const actions: ReferenceAction[] = [...BOOT_TO_RUNNING, { type: "draw_u64", label: "init" }];

  actions.push({ type: "advance", deltaSeconds: 60 }, { type: "end_cycle" }); // V1

  // Fault mid-V2, before it ends.
  actions.push(
    { type: "transition", trigger: "fault" },
    { type: "draw_u64", label: "during-fault-a" },
    { type: "transition", trigger: "fault_resolved" },
    { type: "advance", deltaSeconds: 30 },
    { type: "end_cycle" }, // V2
  );

  for (let cycle = 3; cycle <= 7; cycle++) {
    actions.push({ type: "advance", deltaSeconds: 90 }, { type: "end_cycle" });
  }
  actions.push({ type: "dismiss_hinge" }); // -> V8

  // Fault again, this time in phase B.
  actions.push(
    { type: "transition", trigger: "fault" },
    { type: "draw_u64", label: "during-fault-b" },
    { type: "transition", trigger: "fault_resolved" },
    { type: "advance", deltaSeconds: 90 },
    { type: "end_cycle" }, // V8
  );

  actions.push({ type: "advance", deltaSeconds: 90 }, { type: "end_cycle" }); // V9

  return actions;
}

export const REFERENCE_SEQUENCES = {
  "full-happy-path": { scenarioId: "golden-scenario-full", seed: 1234567890123n, actions: fullHappyPathSequence() },
  "short-mixed-probes": { scenarioId: "golden-scenario-mixed", seed: 42n, actions: shortMixedProbesSequence() },
  "fault-and-resume": { scenarioId: "golden-scenario-fault", seed: 987654321n, actions: faultAndResumeSequence() },
} as const;
