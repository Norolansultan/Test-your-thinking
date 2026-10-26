/**
 * Drives a study session to the training incident and through it (SPEC/15 (bp)), generically over any `TrainingSpec` (the fixture or
 * A's real data): an item is answered with its key (or, `right: false`, another option or a point ~110 m off), a question card through
 * the SPAM card's own calls, a freeze item through the freeze screen's, the memory exposure waited out, S5 left after its dwell. The
 * real clock is the fake timers' `Date.now()`.
 */

import { vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { MAP_POINT_OPTION_ID } from "../../app/session/freeze-answers.js";
import type { TrainingAnswer } from "../../app/session/training/host.js";
import type { TrainingItem, TrainingSpec } from "../../app/session/training/spec.js";
import type { LogRecord } from "../../app/telemetry/log.js";

export const scenario = buildDemoScenario();

export const GOOD_ENV: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};

/** The app's options for a study session (`useSession.ts`), the training on; a failing transport (Haku falls back to its template). */
export const TRAINING_OPTIONS: SessionOptions = {
  cell: "radio", studyShell: true, aiLiteracyTest: true, introVideo: "/video/intro.mp4", previewOverride: { minViewSeconds: 5 }, trainingIncident: true,
  participantCode: "P-bp", realClockMs: () => Date.now(),
  thinker: { transport: vi.fn(async () => { throw new Error("offline"); }), wait: async () => undefined },
};

export function newTrainingSession(options: SessionOptions = {}) {
  const o = new SessionOrchestrator(scenario, conditionOfCell(options.cell ?? "radio"), { ...TRAINING_OPTIONS, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

/** From the consent to the first screen of `stop` (the training incident by default). */
export async function driveTo(o: SessionOrchestrator, snap: () => SessionSnapshot, stop: SessionSnapshot["step"] = "training_incident"): Promise<void> {
  for (let guard = 0; guard < 20 && snap().step !== stop; guard++) {
    const s = snap();
    switch (s.step) {
      case "consent": await o.decideConsent(true, true); break;
      case "ai_literacy": await o.skipAiLiteracy(); break;
      case "preflight": await o.submitPreflight(GOOD_ENV); break;
      case "questionnaire": await o.submitQuestionnaire({ "fatigue.start": 3 }); break;
      case "primer": await o.finishPrimer(); break;
      case "briefing": await o.finishIntroVideo("ended"); break;
      default: throw new Error(`driveTo: stuck at ${s.step}`);
    }
  }
}

/** An answer to `item`: its key, or (`right: false`) another option / a point ~110 m north of it. Card and freeze items carry 50. */
export function answerFor(spec: TrainingSpec, item: TrainingItem, right = true): TrainingAnswer {
  const confidence = item.mode === "live" ? {} : { confidence: 50 as const };
  if (item.answer === "point") {
    const base = "point" in item.key ? item.key.point : spec.area.centre;
    return { point: right ? base : { lat: base.lat + 0.001, lon: base.lon }, ...confidence };
  }
  const keyId = "optionId" in item.key ? item.key.optionId : item.options[0]!.id;
  return { choiceId: right ? keyId : item.options.find((x) => x.id !== keyId)?.id ?? keyId, ...confidence };
}

/** Answers the item on screen as its real component does: a live item directly, a card through the SPAM card, a freeze item through the freeze screen. */
export async function answerOnScreen(o: SessionOrchestrator, spec: TrainingSpec, item: TrainingItem, right = true): Promise<void> {
  const a = answerFor(spec, item, right);
  if (item.mode === "card" && "choiceId" in a) { await o.answerSpam(a.choiceId); await o.submitSpamConfidence(a.confidence!); return; }
  if (item.mode === "freeze") {
    await o.submitFreeze([{ itemId: item.id, optionId: "point" in a ? MAP_POINT_OPTION_ID : a.choiceId, confidence: a.confidence!, ...("point" in a ? { point: a.point } : {}) }]);
    return;
  }
  await o.answerTraining(item.id, a);
}

/** One move on the training on screen. */
export async function trainingMove(o: SessionOrchestrator, snap: () => SessionSnapshot, spec: TrainingSpec, right = true): Promise<void> {
  const v = snap().training!;
  const item = spec.items.find((it) => it.id === v.itemId);
  switch (v.phase) {
    case "intro": return o.trainingStart();
    case "section": return o.trainingLeaveSection();
    case "study": await vi.advanceTimersByTimeAsync(item!.memory!.exposureMs); return;
    case "question": return answerOnScreen(o, spec, item!, right);
    case "feedback": return o.leaveTrainingFeedback(v.itemId!);
    case "demo": await vi.advanceTimersByTimeAsync(spec.demoMinDwellMs); return o.leaveTrainingDemo();
    case "ended": return;
  }
}

/** The training on screen, to its end (or until `until` says stop). */
export async function passTraining(o: SessionOrchestrator, snap: () => SessionSnapshot, spec: TrainingSpec, until: (s: SessionSnapshot) => boolean = () => false): Promise<void> {
  for (let guard = 0; guard < 200 && snap().step === "training_incident" && snap().training && !until(snap()); guard++) await trainingMove(o, snap, spec);
}

export const kinds = (records: readonly LogRecord[]): string[] => records.map((r) => r.kind);
export const ofKind = <T>(records: readonly LogRecord[], kind: string): T[] => records.filter((r) => r.kind === kind).map((r) => r.detail as T);
