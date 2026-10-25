/**
 * What each play command costs in virtual time (`tools/play/`), in seconds, in one place. A participant's actions take real time
 * while the view's clock runs (the freeze, the plan review, a visible probe and the tour stand it still); a player's command
 * takes these instead, so the session's clocks, caps and countdowns meet the player as they would a participant. `look` is free:
 * the participant sees the screen continuously. The costs are DRAFT guesses at a practised participant's pace, not measured;
 * each run stores the costs it spent (`actions.json`), so changing them here never changes an old run's replay.
 */

export const COST_S = {
  /** Haku: typing the question (before it is sent; the records gate at the moment it is sent), then reading the answer. */
  hakuType: 15,
  hakuRead: 15,
  /** Reading a glossary definition or a help-card section (public sessions). */
  glossary: 5,
  help: 10,
  /** Rereading Haku's earlier answers in its pane. */
  hakuHistory: 5,
  /** Moving the live map (a zoom button, a wheel step, a drag). */
  mapMove: 3,
  /** The TAK tools: reading the Contacts pane; one Range & Bearing measurement (two taps). */
  contacts: 8,
  measure: 8,
  /** Full-screen texts left with one button: the guided tour, the intro video, the practice feedback, the training text, the debrief. */
  tour: 60,
  introVideo: 60,
  practiceFeedback: 45,
  training: 45,
  debrief: 20,
  /** The hinge: reading the directive, answering its check, continuing. */
  hingeRead: 30,
  hingeAnswer: 10,
  hingeContinue: 5,
  /** The primer (public): answering a page's check, retrying, leaving a page (reading it). */
  primerAnswer: 10,
  primerRetry: 5,
  primerNext: 20,
  /** The map training (was the pretest): one task answered; its feedback read. */
  pretestAnswer: 20,
  pretestFeedback: 10,
  /** A freeze: one item answered and left ("Seuraava"), and the last button. */
  freezeAnswer: 10,
  freezeSubmit: 2,
  /** SPAM: "Valmis", then an option and its confidence; collapsing or expanding the prompt. */
  spamReady: 2,
  spamAnswer: 10,
  spamToggle: 1,
  /** The plan form: setting its fields (one command), confirming, reopening it. */
  plan: 10,
  confirm: 2,
  revise: 2,
  /** After the view's end: the plan's confidence; the plan review (phase B). */
  planConfidence: 4,
  review: 4,
  /** A visible probe (V13, V14). */
  probeAnswer: 10,
  /** The consult notification's buttons. */
  consult: 2,
  /** B1 (25 Oct 2026): clicking the Haku group's suggested-question chip (no typing; the answer is read as `hakuRead`). */
  chip: 2,
  /** B2 (25 Oct 2026): the hinge's optional fatigue item (one click). */
  hingeFatigue: 3,
  /** The questionnaires: one item answered; the post-session form's submission (the rest left blank), the pre-session form's. */
  questAnswer: 6,
  questSubmit: 20,
  questSubmitPre: 5,
} as const;

/** `wait` without a number waits this long (it stops earlier when something comes up). */
export const DEFAULT_WAIT_S = 10;
/** The longest single `wait`. */
export const MAX_WAIT_S = 300;
