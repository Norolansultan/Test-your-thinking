/**
 * Drives a whole session quickly (a 5 s preview minimum, the Haku group) for the persistence,
 * header and resume specs. The real clock is the fake timers' `Date.now()` (set to 0 by the spec),
 * so every `tWallOffsetMs` is deterministic.
 */

import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { allocateAndConfirm, passHinge, runOutView } from "./view-flow.js";

export const scenario = buildDemoScenario();
export const FAST = { minViewSeconds: 5 } as const;

export function newSession(options: SessionOptions = {}) {
  const o = new SessionOrchestrator(scenario, "directed", { previewOverride: FAST, participantCode: "P-7", realClockMs: () => Date.now(), ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

/** Completes the view on screen (its time run out, then the plan); the training and the hinge after it. */
export async function completeView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  await runOutView(o, snap);
  await allocateAndConfirm(o, snap);
  if (snap().step === "training") await o.completeTraining();
  if (snap().step === "hinge_pause") await passHinge(o);
}

/** Starts the session and completes views VP..`lastView` (−1: only the briefing is on screen). */
export async function runThrough(lastView: number, options: SessionOptions = {}) {
  const s = newSession(options);
  await s.o.start();
  if (lastView < 0) return s;
  for (let v = 0; v <= lastView; v++) await completeView(s.o, s.snap);
  return s;
}
