/**
 * Drives a whole study-shell session (SPEC/35 P1): consent, the AI literacy test (skipped), the preflight, the pre-session
 * item, the primer (public sessions), the training incident (revision (bp), 26 Oct 2026: each card and feedback left at once, each
 * item's first option or the square's centre with confidence 50 where asked, the memory unit and S5's 10 s waited out), the intro
 * video, VP (the first look), the group's training text, V1–V14 (or V1–V7 with `scope: "phaseA"`), the hinge,
 * the post-session questionnaire, the results step (SPEC/36: skipped here unless `optIn`), the commander profile (only with
 * `immediateProfile`), the debrief and the end. The real clock is the fake timers' `Date.now()` (the spec sets it to 0), so every
 * record is deterministic.
 */

import { vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { completeView } from "../session/session-run.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { inTraining, TRAINING_SESSION_OPTION, trainingHostOf, trainingItemOf, trainingViewOf } from "../../tools/play/training-host.js";

export const scenario = buildDemoScenario();

export const GOOD_ENV: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};

/**
 * The options the app gives a study session (`useSession.ts`), the Haku group, a 5 s preview minimum. Revision (bp), 26 Oct 2026: the
 * map training and the practice feedback are retired (their options are gone); the training incident is on in every session
 * (`TRAINING_SESSION_OPTION`, the one seam to work package B's option, `tools/play/training-host.ts`).
 */
export const APP_OPTIONS: SessionOptions = {
  cell: "radio", studyShell: true, aiLiteracyTest: true, introVideo: "/video/intro.mp4", previewOverride: { minViewSeconds: 5 },
  participantCode: "P-35", realClockMs: () => Date.now(), thinker: { transport: vi.fn() }, ...TRAINING_SESSION_OPTION,
};

/**
 * Revision (bp): whether this tree runs the training incident end to end — package A's content (`TRAINING`) and package B's orchestrator
 * methods. Before the three packages are merged it has neither: the specs then check that the session runs without it (and the
 * training's own assertions wait for the merge).
 */
export const TRAINING_IN_TREE = TRAINING.items.length > 0 && typeof (SessionOrchestrator.prototype as unknown as Record<string, unknown>).answerTraining === "function";

export function newStudySession(options: SessionOptions = {}, base: SessionOptions = APP_OPTIONS) {
  const o = new SessionOrchestrator(scenario, conditionOfCell(options.cell ?? "radio"), { ...base, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

/** What the primer does on screen in these specs: two pages, one check answered wrong and then right, then done. */
export async function passPrimer(o: SessionOrchestrator): Promise<void> {
  await o.primerPage("p1.role", 4_000);
  await o.primerCheck("q1.role", 2, false, 1);
  await o.primerCheck("q1.role", 0, true, 2);
  await o.primerPage("p2.units", 3_000);
  await o.finishPrimer();
}

/**
 * Revision (bp): one move on the training incident's screen — the intro, a section card or a feedback left at once; an item answered
 * (a choice's first option, a point the square's centre; confidence 50 on a card or freeze item); the memory unit's exposure and S5's
 * 10 s waited out (the timers advance), S5 then left.
 */
export async function trainingStep(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const v = trainingViewOf(snap())!;
  const host = trainingHostOf(o);
  switch (v.phase) {
    case "intro": return host.trainingStart();
    case "section": return host.trainingLeaveSection();
    case "feedback": return host.leaveTrainingFeedback(v.itemId!);
    case "study": await vi.advanceTimersByTimeAsync(Math.max(1, host.trainingStudySecondsLeft()) * 1000); return;
    case "demo": await vi.advanceTimersByTimeAsync(TRAINING.demoMinDwellMs); return host.leaveTrainingDemo();
    case "question": {
      const item = trainingItemOf(v)!;
      const confidence = item.mode === "live" ? {} : { confidence: 50 as const };
      return host.answerTraining(item.id, item.answer === "point" ? { point: TRAINING.area.centre, ...confidence } : { choiceId: item.options[0]!.id, ...confidence });
    }
    default: await vi.advanceTimersByTimeAsync(1_000);
  }
}

/** Runs the training incident on screen to its end, as `trainingStep` moves (nothing when the session has none). */
export async function passTraining(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  for (let guard = 0; inTraining(snap()); guard++) {
    if (guard > 200) throw new Error("passTraining: the training does not end");
    await trainingStep(o, snap);
  }
}

/**
 * @deprecated Revision (bp): the map training is retired; kept only so that `test/session/map-training.spec.ts` (work package B's,
 * retired with the map training) compiles until the merge removes it. It drives the training incident.
 */
export const passPretest = passTraining;

/**
 * Moves the session on from the screen it is at until `stopAt` is on screen (or the end is complete). Each step is
 * answered as a participant would: the pre-session item 3, the post-session questionnaire blank.
 */
export async function driveSession(o: SessionOrchestrator, snap: () => SessionSnapshot, stopAt: readonly SessionSnapshot["step"][] = [], optIn = false): Promise<void> {
  for (let guard = 0; guard < 400; guard++) {
    const s = snap();
    if (stopAt.includes(s.step)) return;
    await driveStep(o, snap, optIn);
    if (s.step === "complete") return;
  }
  throw new Error(`driveSession: no end (at ${snap().step})`);
}

/** Answers the screen on show: one shell screen, or the whole view on screen (with the training or the hinge after it). */
export async function driveStep(o: SessionOrchestrator, snap: () => SessionSnapshot, optIn = false): Promise<void> {
  const s = snap();
  if (inTraining(s)) return trainingStep(o, snap); // revision (bp): the training incident, each move as `trainingStep`
  switch (s.step) {
    case "consent": return o.decideConsent(true, true);
    case "ai_literacy": return o.skipAiLiteracy();
    case "preflight": await o.submitPreflight(GOOD_ENV); return;
    case "questionnaire": return o.submitQuestionnaire(s.questionnaire!.id === "pre" ? { "fatigue.start": 3 } : {});
    case "primer": return passPrimer(o);
    case "briefing": return o.finishIntroVideo("ended");
    case "training": return o.completeTraining();
    case "results_optin": return o.decideResultsOptIn(optIn);
    case "profile": return o.finishProfile();
    case "debrief": return o.finishDebrief();
    case "complete": return o.completeSession();
    default: return completeView(o, snap);
  }
}

/** A whole session from its start to `session_completed`; its records. */
export async function wholeSession(options: SessionOptions = {}): Promise<{ readonly o: SessionOrchestrator; readonly records: readonly LogRecord[] }> {
  vi.setSystemTime(0);
  const { o, snap } = newStudySession(options);
  await o.start();
  await driveSession(o, snap);
  return { o, records: await o.logRecords() };
}

export const kinds = (records: readonly LogRecord[]): string[] => records.map((r) => r.kind);
