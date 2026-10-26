/**
 * The public-audience version's record details (SPEC/35 §6, 21 Oct 2026; format 0.13.0), split out of `record-kinds.ts` as the
 * interaction records are (`record-kinds-interaction.ts`). Written in public sessions only: an expert session writes none of them.
 * Raw (SPEC/07 §1): the primer's dwell is measured by its screen; nothing here is derived.
 */

import type { CycleIndex } from "../engine/primitives.js";
import type { PracticeViewIndex } from "../scenario/types.js";

/**
 * Where a glossary term was opened (SPEC/35 §3 item 2); the same list as the render layer's (`audience-context.ts`). `training`
 * (0.18.0, SPEC/35 (bp)): a training-incident text (its intro, section cards, item stems on the live map, feedback and S5); the items
 * it shows through the freeze screen and the question card keep `freeze` and `spam`.
 */
export type GlossarySurface = "message_log" | "record" | "freeze" | "spam" | "plan" | "review" | "search" | "guide" | "help_card" | "training" | "other";
/** A section of the help card (SPEC/35 §3 item 3). */
export type HelpCardSection = "glossary" | "roster" | "legend";

/** A glossary term's definition shown: the term, the text surface, and the view (0 = VP; null outside the views, e.g. the primer). */
export interface PublicGlossaryOpenedDetail {
  readonly termId: string;
  readonly surface: GlossarySurface;
  readonly view: CycleIndex | PracticeViewIndex | null;
}
/** A primer page was left (SPEC/35 §3 item 1): its id and how long it was on screen (measured by the screen, ms). */
export interface PrimerPageDetail {
  readonly pageId: string;
  readonly dwellMs: number;
}
/**
 * A primer check question answered: the option chosen (its index), whether it was the primer's right answer, and the attempt (1, 2, …;
 * a wrong answer shows the explanation, then the question again). The primer's own key, about the words; never a study item's.
 */
export interface PrimerCheckDetail {
  readonly questionId: string;
  readonly chosen: number;
  readonly correct: boolean;
  readonly attempt: number;
}
/** A help-card section opened (SPEC/35 §3 item 3). */
export interface HelpCardOpenedDetail {
  readonly section: HelpCardSection;
}

/**
 * SPEC/36 (23 Oct 2026, 0.14.0): the participant's answer on the step "Personal results after the study", after the post-session
 * questionnaire and before the debrief, in every session (both audiences, every cell). `optedIn` is true only when the study server
 * accepted a contact address for this session; skipping, or continuing after the server could not be reached, is false. The address
 * itself never enters the log: it goes to the server's separate contact store (`/api/results-contact`).
 */
export interface ResultsOptInDetail {
  readonly optedIn: boolean;
}
