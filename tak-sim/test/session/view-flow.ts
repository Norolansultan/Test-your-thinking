/**
 * Shared steps for the session specs over the view's flow (researcher decision 1 Oct 2026): run a
 * view's time out to its minimum length, answering the freeze on the way, so a decision made after
 * it ends the view at once (`view_ended` "participant_confirm").
 */

import { vi } from "vitest";
import type { SessionOrchestrator, SessionSnapshot } from "../../app/session/orchestrator.js";
import type { SectorPlan } from "../../app/scenario/plan-types.js";

/**
 * Advances the view's time a second at a time until its minimum length has passed and any SPAM probe
 * has closed; answers any freeze with no items, and a SPAM probe as soon as its prompt shows (ready,
 * the first option, confidence 50: revision (ag), the prompt no longer expires, and a prompt left up
 * would be forced at the view's end — `spam-forced.spec.ts` covers that path).
 */
export async function runOutView(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const view = snap().currentCycle;
  // The practice view's minimum and its cap are both 180 s (researcher, 11 Oct 2026): a plan not yet confirmed
  // at the minimum ends the view by the cap, so VP is run out only to just after its SPAM prompt is answered, and
  // `allocateAndConfirm` confirms the plan and lets the rest of the minimum pass.
  const practice = snap().practice;
  let spamSeen = false;
  const done = () => practice ? spamSeen && snap().spam === null && (snap().step === "allocation" || snap().step === "training") : snap().minimumReached && snap().spam === null;
  while (!done() && snap().currentCycle === view) {
    if (snap().spam !== null) spamSeen = true;
    await answerSpamNow(o, snap);
    if (!done()) await vi.advanceTimersByTimeAsync(1_000);
    if (snap().step === "freeze") await o.submitFreeze([]);
  }
}

/**
 * SPEC/32 §3: the plan review on screen (phase B) is kept — once it shows (the guide group's lookup may take up to its timeout;
 * the view's clock stands still meanwhile). False when no review is open.
 */
export async function keepReview(o: SessionOrchestrator): Promise<boolean> {
  for (let i = 0; i < 40 && snapshotOf(o).step === "plan_review" && snapshotOf(o).planReview === null; i++) await vi.advanceTimersByTimeAsync(250);
  if (snapshotOf(o).step !== "plan_review") return false;
  await o.keepPlan();
  return true;
}

/** Answers the SPAM probe on screen at once, whatever its phase (ready, the first option, confidence 50). */
export async function answerSpamNow(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const spam = snap().spam;
  if (!spam) return;
  if (spam.phase === "ready") await o.spamReady();
  const item = snap().spam;
  if (item?.phase === "item") await o.answerSpam(item.options[0]!.id);
  if (snap().spam?.phase === "confidence") await o.submitSpamConfidence(50);
}

/** The orchestrator's current snapshot (`subscribe` calls back at once). */
export function snapshotOf(o: SessionOrchestrator): SessionSnapshot {
  let s: SessionSnapshot | null = null;
  o.subscribe((x) => (s = x))();
  return s!;
}

/** A forced SPAM item on screen (revision (ag)) is answered — its first option, confidence 50 — so the view ends. */
export async function answerForcedSpam(o: SessionOrchestrator, optionId?: string): Promise<boolean> {
  const spam = snapshotOf(o).spam;
  if (!spam || spam.phase === "ready" || !spam.forced) return false;
  if (spam.phase === "item") await o.answerSpam(optionId ?? spam.options[0]!.id);
  await o.submitSpamConfidence(50);
  return true;
}

/**
 * Leaves the hinge: the directive read, the manipulation check answered (brief D3, 4 Oct 2026 — its
 * option "a", whatever the key), then Continue. Continue is refused before the check is answered.
 */
export async function passHinge(o: SessionOrchestrator, optionId = "a"): Promise<void> {
  await o.showHingeCheck();
  await o.answerHingeCheck(optionId);
  await o.dismissHinge();
}

/** A plan with only the main effort: no secondary sector, the drones carry on. */
export const PLAN: SectorPlan = { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null };

/**
 * The sector plan — the only response a view asks for (revision (x), 6 Oct 2026) — which confirms the
 * period; a SPAM item the confirmation forces at the view's end (revision (ag)) is answered (both items of a
 * delivery with a second, SPEC/30 §5.2), then what follows the view's end (`finishViewEnd`).
 */
export async function allocateAndConfirm(o: SessionOrchestrator, _snap?: () => SessionSnapshot): Promise<void> {
  const view = snapshotOf(o).currentCycle;
  await submitPlan(o, PLAN);
  while (await answerForcedSpam(o)) { /* a delivery's second item follows its first */ }
  await finishViewEnd(o, view);
}

/**
 * SPEC/30: what follows a main view's end, while `view` is still on screen — its plan's confidence (`value`) and, in V10
 * and V14, the freeze at the view's end (no items, as `runOutView` answers a freeze) — so the next view, the training,
 * the hinge or the end is on screen. V14's after-view probes are left to the caller. A slow sink lags the item a tick.
 * SPEC/32 §3: in phase B the plan review comes before the view's end; it is kept (`keepPlan`) once on screen (the guide
 * group's lookup may take up to its timeout first: the view's clock stands still meanwhile).
 */
export async function finishViewEnd(o: SessionOrchestrator, view: number, value = 50): Promise<void> {
  let rated = false; // only a freeze after the plan's confidence is the view's end-of-view freeze
  for (let i = 0; i < 60; i++) {
    const s = snapshotOf(o);
    if (s.currentCycle !== view) return;
    if (s.step === "plan_review" && s.planReview) await o.keepPlan();
    else if (s.step === "plan_review") await vi.advanceTimersByTimeAsync(250);
    else if (s.step === "plan_confidence" && s.planConfidence) { await o.submitPlanConfidence(value); rated = true; }
    else if (s.step === "freeze" && rated) await o.submitFreeze([]);
    else if (s.step === "plan_confidence") await vi.advanceTimersByTimeAsync(0);
    else return;
  }
}

/**
 * Submits a plan after `runOutView`. In a main view the minimum has passed, so the plan ends the view at once; the
 * practice view is run out only to its SPAM prompt (see `runOutView`), so the plan confirms the period and the rest of
 * the practice view's minimum (180 s) passes before it ends.
 */
export async function submitPlan(o: SessionOrchestrator, plan: SectorPlan): Promise<void> {
  const view = snapshotOf(o).currentCycle;
  await o.submitAllocation(plan);
  // Until the minimum has passed and the view has ended or a forced SPAM item holds it (a slow sink lags the snapshot a tick);
  // then (SPEC/30) its plan's confidence and an end-of-view freeze are answered, unless a forced item holds the end.
  for (let i = 0; i < 400; i++) {
    const now = snapshotOf(o);
    if (!now.practice || now.currentCycle !== view || now.spam !== null || (now.minimumReached && now.step !== "awaiting_view_end")) {
      if (now.spam === null) await finishViewEnd(o, view);
      return;
    }
    await vi.advanceTimersByTimeAsync(1_000);
  }
  throw new Error("submitPlan: the practice view did not end");
}
