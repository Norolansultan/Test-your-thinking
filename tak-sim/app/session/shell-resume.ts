/**
 * Which study-shell screen a resumed session re-enters (SPEC/05 §9; 5 Oct 2026), split out of `orchestrator.ts` (21 Oct 2026, to
 * keep it from growing). A pure read of the durable log; the orchestrator fast-forwards the engine and shows the screen.
 */

import type { LogRecord } from "../telemetry/log.js";
import type { SessionResumePlan } from "../telemetry/resume.js";
import { aiLiteracyEnded } from "./ai-literacy.js";
import { PRIMER_SCREEN_ID } from "./public-session.js";
import { trainingCompleted } from "./training/resume.js";

/** The study-shell screens a resume can re-enter. */
export type ShellResumeStep = "consent" | "ai_literacy" | "preflight" | "primer" | "training_incident" | "questionnaire" | "results_optin" | "profile" | "debrief";

/**
 * With the study shell, the parts around the views a resume re-enters: before the briefing, the consent (not yet decided), the AI
 * literacy test (consent given, the test on and not yet ended; revision (ac)) or the preflight (the pre-session item not yet
 * submitted); after the last view, the post-session questionnaire or the debrief while not yet closed. `null`: the plain plan
 * applies. SPEC/35: a public session's primer (the pre-session item submitted, the primer not left) and its profile (the
 * questionnaire submitted, the debrief not yet shown); a phase-A session's last view is V7 (`scopedSchedule`). SPEC/36: every
 * session's results step (the questionnaire submitted, `results_optin` not yet written); the profile only when it is on screen
 * (`immediateProfile`, `?profiili=heti`). Difficulty audit (23 Oct 2026): the map-reading pretest (on, after the pre-session item and
 * the primer, not yet ended) is re-entered at its first unanswered item; since 25 Oct 2026 the map training, at its first task not
 * finished. SPEC/15 (bp) (26 Oct 2026): the training incident in that step (`trainingOn`, after the pre-session item and the primer)
 * while `training_completed` is not logged — re-opened where its log says (`training/resume.ts`).
 */
export function shellResumeStep(target: SessionResumePlan["target"], records: readonly LogRecord[], session: { readonly aiLiteracyOn: boolean; readonly isPublic: boolean; readonly immediateProfile?: boolean; readonly trainingOn?: boolean }): ShellResumeStep | null {
  const has = (kind: string, pred: (d: Record<string, unknown>) => boolean = () => true) => records.some((r) => r.kind === kind && pred(r.detail as Record<string, unknown>));
  if (target.kind === "briefing") {
    if (!has("consent_decided", (d) => d.decision === "accepted")) return "consent";
    if (session.aiLiteracyOn && !aiLiteracyEnded(records)) return "ai_literacy";
    if (!has("questionnaire_submitted", (d) => d.questionnaireId === "pre")) return "preflight";
    if (session.isPublic && !has("briefing_advanced", (d) => d.screenId === PRIMER_SCREEN_ID)) return "primer";
    if (session.trainingOn === true && !trainingCompleted(records)) return "training_incident";
    return null;
  }
  if (target.kind !== "complete" || has("debrief_closed")) return null;
  if (!has("questionnaire_submitted", (d) => d.questionnaireId === "post")) return "questionnaire";
  if (!has("results_optin")) return "results_optin";
  return session.immediateProfile === true && !has("debrief_shown") ? "profile" : "debrief";
}
