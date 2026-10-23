/**
 * The public-audience setting in the session (SPEC/35, 21 Oct 2026; work package P1). Split out of `orchestrator.ts`.
 *
 * - **The setting** (§2): `?yleiso` on a study link makes the session `audience: "public"` (default `expert`); `?laajuus=a` makes
 *   it `scope: "phaseA"` (default `full`): the session ends at the hinge, after V7, and goes on to the questionnaire. Both are
 *   chosen on the start page from the URL and logged in the header (`audience`, `scope`).
 * - **The public steps** (§3, §4): the primer after the pre-session item and before the intro video and the practice view
 *   (`primer`; left with `briefing_advanced` "briefing.primer"). The commander profile after the post-session questionnaire
 *   (`profile`; `profile_shown`) is, since SPEC/36 (23 Oct 2026), off by default in every audience and shown only with
 *   `?profiili=heti`. Both are full-screen pages outside the views: nothing in a view changes.
 * - **The explanation layer's records** (§3, §6): a primer page left (`primer_page`), a primer check answered (`primer_check`),
 *   a glossary term opened (`glossary_opened`) and a help-card section opened (`help_card_opened`). Logged as they happen, in public
 *   sessions only; they never touch the run's timing (no clock pause, no step or view change). An expert session logs none.
 *
 * Validation at the boundary: the ids come from the render layer (the primer's and the glossary's content), so each record's
 * fields are checked here (a RangeError for a malformed one) before anything is written.
 */

import type { EngineRunLoop } from "../engine/run-loop.js";
import type { CycleSchedule } from "../engine/cycle-sequencer.js";
import type { GlossarySurface, HelpCardSection, TelemetryEvent } from "../telemetry/record-kinds.js";
import type { JudgementStep, ViewIndex } from "./snapshot.js";

export type Audience = "expert" | "public";
export type SessionScope = "full" | "phaseA";

/** The study link's parameters (SPEC/35 §2): `?yleiso` (present: public) and `?laajuus=a` (phase A only). */
export const AUDIENCE_PARAM = "yleiso";
export const SCOPE_PARAM = "laajuus";
const SCOPE_PARAM_VALUES: Readonly<Record<string, SessionScope>> = { a: "phaseA" };

export type SessionSetting = { readonly audience: Audience; readonly scope: SessionScope } | { readonly invalid: string };

/** The audience and the scope from a URL query string; an unknown `?laajuus=` value is refused rather than guessed. */
export function sessionSettingFromUrl(search: string): SessionSetting {
  const params = new URLSearchParams(search);
  const audience: Audience = params.has(AUDIENCE_PARAM) ? "public" : "expert";
  const raw = params.get(SCOPE_PARAM);
  if (raw === null) return { audience, scope: "full" };
  const scope = Object.hasOwn(SCOPE_PARAM_VALUES, raw) ? SCOPE_PARAM_VALUES[raw] : undefined;
  if (!scope) return { invalid: `?${SCOPE_PARAM}= must be "a" (phase A only); got "${raw}"` };
  return { audience, scope };
}

/**
 * SPEC/36 (23 Oct 2026): `?profiili=heti` shows the commander profile on screen after the questionnaire (demonstrations and teaching
 * before a lecture), in either audience; logged in the header (`immediateProfile`). Without it, the default for everyone, the
 * profile is not shown: personal results are sent after the study closes. Any other value leaves it off.
 */
export const PROFILE_PARAM = "profiili";
export const PROFILE_NOW_VALUE = "heti";

export function immediateProfileFromUrl(search: string): boolean {
  return new URLSearchParams(search).get(PROFILE_PARAM) === PROFILE_NOW_VALUE;
}

/** The last main view the session runs: V14, or the hinge view (V7) in a phase-A session. */
export function lastViewOf(scope: SessionScope, schedule: Pick<CycleSchedule, "count" | "hingeAfter">): number {
  return scope === "phaseA" ? schedule.hingeAfter : schedule.count;
}

/** The schedule as the resume plan reads it (`planSessionResume`): a phase-A session's end is the hinge view's. */
export function scopedSchedule(scope: SessionScope, schedule: Pick<CycleSchedule, "count" | "hingeAfter">): Pick<CycleSchedule, "count" | "hingeAfter"> {
  return { count: lastViewOf(scope, schedule), hingeAfter: schedule.hingeAfter };
}

/**
 * Ends the engine's main timeline after `views` main views (SPEC/26 §3), without logging — as the last view's own end does
 * (V14 enters DEBRIEF_HANDOFF inside `endCycle`). In a phase-A session the hinge view's end leaves the engine in HINGE_PAUSE: the
 * hinge is passed and the session completes (RUNNING -> DEBRIEF_HANDOFF), so the questionnaire and the debrief run as after V14.
 */
export function closeTimelineAt(loop: EngineRunLoop, views: number, schedule: Pick<CycleSchedule, "count" | "hingeAfter">): void {
  if (views === schedule.count || loop.freeze.current() !== "HINGE_PAUSE") return;
  loop.dismissHinge();
  loop.transition("session_complete");
}

/** The primer's page id in `briefing_advanced` when it is left (its dwell, as the briefing's and the video's pages). */
export const PRIMER_SCREEN_ID = "briefing.primer";

/** The steps inside a view: a glossary term opened in them carries the view; elsewhere (the primer, a full-screen page) null. */
const VIEW_STEPS: ReadonlySet<JudgementStep> = new Set<JudgementStep>(["exploration", "freeze", "allocation", "awaiting_view_end", "probe", "plan_confidence", "plan_review"]);

/** A use of the explanation layer as the render layer reports it (`AudienceInfo`'s callbacks); the session adds the view. */
export type AudienceEvent =
  | { readonly kind: "glossary_opened"; readonly termId: string; readonly surface: GlossarySurface }
  | { readonly kind: "help_card_opened"; readonly section: HelpCardSection };

const SURFACES: ReadonlySet<string> = new Set<GlossarySurface>(["message_log", "record", "freeze", "spam", "plan", "review", "search", "guide", "help_card", "other"]);
const SECTIONS: ReadonlySet<string> = new Set<HelpCardSection>(["glossary", "roster", "legend"]);
const ID = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,79}$/u;

function checkId(what: string, id: unknown): string {
  if (typeof id !== "string" || !ID.test(id)) throw new RangeError(`${what}: "${String(id)}" is not an id`);
  return id;
}

function checkCount(what: string, n: unknown, min: number): number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < min) throw new RangeError(`${what}: ${String(n)} is not a whole number from ${min}`);
  return n;
}

export interface PublicLayerHost {
  readonly event: (event: TelemetryEvent) => Promise<unknown>;
}

/** The public layer's records (none in an expert session). The orchestrator owns the steps; this checks and writes the records. */
export class PublicLayer {
  constructor(private readonly host: PublicLayerHost, readonly audience: Audience, readonly scope: SessionScope) {}

  get isPublic(): boolean { return this.audience === "public"; }

  /** A primer page left, with its dwell as the screen measured it (rounded to whole ms). */
  async primerPage(step: JudgementStep, pageId: string, dwellMs: number): Promise<void> {
    this.assertPrimer(step, "primerPage");
    if (typeof dwellMs !== "number" || !Number.isFinite(dwellMs) || dwellMs < 0) throw new RangeError(`primerPage: dwell ${String(dwellMs)}`);
    await this.host.event({ kind: "primer_page", detail: { pageId: checkId("primerPage", pageId), dwellMs: Math.round(dwellMs) } });
  }

  /** A primer check answered (an attempt: a wrong answer is followed by the explanation and the question again). */
  async primerCheck(step: JudgementStep, questionId: string, chosen: number, correct: boolean, attempt: number): Promise<void> {
    this.assertPrimer(step, "primerCheck");
    if (typeof correct !== "boolean") throw new RangeError(`primerCheck: correct ${String(correct)}`);
    await this.host.event({ kind: "primer_check", detail: { questionId: checkId("primerCheck", questionId), chosen: checkCount("primerCheck chosen", chosen, 0), correct, attempt: checkCount("primerCheck attempt", attempt, 1) } });
  }

  /**
   * A glossary term or a help-card section opened (SPEC/35 §3): written at once with the view it was opened in, nothing else
   * changed. Ignored in an expert session, before the consent decision and after the session completed (`closed`).
   */
  async use(event: AudienceEvent, step: JudgementStep, view: ViewIndex, closed: boolean): Promise<void> {
    if (!this.isPublic || closed) return;
    if (event.kind === "help_card_opened") {
      if (!SECTIONS.has(event.section)) throw new RangeError(`help card: "${String(event.section)}" is not a section`);
      await this.host.event({ kind: "help_card_opened", detail: { section: event.section } });
      return;
    }
    if (!SURFACES.has(event.surface)) throw new RangeError(`glossary: "${String(event.surface)}" is not a surface`);
    await this.host.event({ kind: "glossary_opened", detail: { termId: checkId("glossary", event.termId), surface: event.surface, view: VIEW_STEPS.has(step) ? view : null } });
  }

  private assertPrimer(step: JudgementStep, what: string): void {
    if (!this.isPublic || step !== "primer") throw new Error(`${what} in step ${step}${this.isPublic ? "" : " (an expert session has no primer)"}`);
  }
}
