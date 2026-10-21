/**
 * Drives a whole study-shell session (SPEC/35 P1): consent, the AI literacy test (skipped), the preflight, the pre-session
 * item, the primer (public sessions), the intro video, VP, the training, V1–V14 (or V1–V7 with `scope: "phaseA"`), the hinge,
 * the post-session questionnaire, the commander profile (public sessions), the debrief and the end. The real clock is the
 * fake timers' `Date.now()` (the spec sets it to 0), so every record is deterministic.
 */

import { vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { completeView } from "../session/session-run.js";

export const scenario = buildDemoScenario();

export const GOOD_ENV: PreflightEnv = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};

/** The options the app gives a study session (`useSession.ts`), the Haku group, a 5 s preview minimum. */
export const APP_OPTIONS: SessionOptions = {
  cell: "radio", studyShell: true, aiLiteracyTest: true, introVideo: "/video/intro.mp4", previewOverride: { minViewSeconds: 5 },
  participantCode: "P-35", realClockMs: () => Date.now(), thinker: { transport: vi.fn() },
};

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
 * Moves the session on from the screen it is at until `stopAt` is on screen (or the end is complete). Each step is
 * answered as a participant would: the pre-session item 3, the post-session questionnaire blank.
 */
export async function driveSession(o: SessionOrchestrator, snap: () => SessionSnapshot, stopAt: readonly SessionSnapshot["step"][] = []): Promise<void> {
  for (let guard = 0; guard < 400; guard++) {
    const s = snap();
    if (stopAt.includes(s.step)) return;
    await driveStep(o, snap);
    if (s.step === "complete") return;
  }
  throw new Error(`driveSession: no end (at ${snap().step})`);
}

/** Answers the screen on show: one shell screen, or the whole view on screen (with the training or the hinge after it). */
export async function driveStep(o: SessionOrchestrator, snap: () => SessionSnapshot): Promise<void> {
  const s = snap();
  switch (s.step) {
    case "consent": return o.decideConsent(true, true);
    case "ai_literacy": return o.skipAiLiteracy();
    case "preflight": await o.submitPreflight(GOOD_ENV); return;
    case "questionnaire": return o.submitQuestionnaire(s.questionnaire!.id === "pre" ? { "fatigue.start": 3 } : {});
    case "primer": return passPrimer(o);
    case "briefing": return o.finishIntroVideo("ended");
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
