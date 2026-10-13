/**
 * Derived measures for SPAM and the hinge manipulation check (round 2, 4 Oct 2026, agent C; SPAM revision
 * (ag), 9 Oct 2026) — pure folds over the raw records (SPEC/07 §1: nothing derived is ever stored). The
 * keys are TRUTH and are passed in by the analysis (from the scenario's invariants, `spamKeysOf`), never
 * read from the log.
 *
 * SPAM, per probe (SPEC/15 §5; Durso & Dattel; SPEC/27 (ag)). A probe's records are those after its
 * `spam_prompt_shown` and before the next prompt of the same probe (a replayed view prompts again). The
 * ITEM is shown at its first `spam_ready` that is not `skipped` (voluntary or `forced`); a forced item
 * re-shown after an interruption logs a further `spam_ready` (`resumed`).
 * - `readyLatencyMs` = first `spam_ready` − `spam_prompt_shown` (the workload index). Revision (ag): with
 *   `forced` it is CENSORED at the view's end (`readyCensored`: the participant had not said ready by
 *   then — a lower bound, for a survival / censored model or a sensitivity analysis without forced
 *   probes). Null on a pre-(ag) ready timeout and on a demonstration skip.
 * - `forced`, `skipped`, `readyTimedOut` (logs before revision (ag) only), `collapses` (`spam_collapsed`
 *   during the ready prompt).
 * - `answerLatencyMs` = `spam_answered` − the last item display before it (time to produce the answer
 *   with the display visible — revision (ag): including any Haku or Thinker query made meanwhile);
 *   null when the item was not shown or the answer timed out.
 * - `correct` against the key; null when there is no answer. `confidence`
 *   (`recall_confidence_submitted` for the probe), null when not given.
 * - `itemOpenMs` = `spam_closed` − the first item display (was `toolsLockedMs`: the tools are no longer
 *   locked by an item, revision (ag)).
 * - Tool use inside the item's window (revision (ag): Haku and the Thinker stay usable), from the item's
 *   display to `spam_closed`: `hakuQueries` (Haku's free text `query_submitted`, its navigation
 *   `nav_query_submitted`, its chat `ai_chat_query_submitted` `tool: "haku"`), `thinkerQueries` (the Open
 *   Thinker's `ai_chat_query_submitted`; a record without `tool` predates 8 Oct 2026 and was the
 *   Thinker's), `toolQueries` (their sum), `toolQueryIds` (their `queryId`s, linking the queries' own
 *   records — which carry the view — to the probe), and `answeredAfterToolAnswer`: a tool answer reached
 *   the screen between the item's display and the option (Haku's free text and navigation return with
 *   their query record; a chat answer is its `ai_chat_answer_received`); null when there is no answer.
 * - `thinkerPendingAtPrompt`: a Thinker question asked before the prompt whose answer had not arrived
 *   by it — the covariate for reading the ready latency across the cells (the participant may simply
 *   be waiting).
 * Times are `tWallOffsetMs` (real ms since the session started).
 */

import type { LogRecord } from "./log.js";
import type { HingeCheckAnsweredDetail, HingeCheckPresentedDetail, RecallConfidenceSubmittedDetail, SpamAnsweredDetail, SpamPromptShownDetail, SpamReadyDetail } from "./record-kinds.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail } from "./record-kinds-interaction.js";

export interface SpamMeasure {
  readonly probeId: string;
  readonly view: number;
  readonly readyLatencyMs: number | null;
  /** Revision (ag): the ready latency is censored at the view's end (the item was forced). */
  readonly readyCensored: boolean;
  readonly forced: boolean;
  readonly skipped: boolean;
  /** Logs before revision (ag) only (the ready prompt expired after 15 s). */
  readonly readyTimedOut: boolean;
  readonly collapses: number;
  readonly answerLatencyMs: number | null;
  readonly answerTimedOut: boolean;
  readonly response: string | null;
  readonly correct: boolean | null;
  readonly confidence: number | null;
  readonly itemOpenMs: number | null;
  readonly toolQueries: number;
  readonly hakuQueries: number;
  readonly thinkerQueries: number;
  readonly toolQueryIds: readonly string[];
  readonly answeredAfterToolAnswer: boolean | null;
  readonly thinkerPendingAtPrompt: boolean;
}

/** TRUTH: each SPAM probe's key option id, from the scenario's probes and invariants (`spam.cycle_<n>`). */
export function spamKeysOf(
  probes: readonly { readonly id: string; readonly type: string; readonly invariantName: string }[],
  invariants: readonly { readonly name: string; readonly expected: unknown }[],
): ReadonlyMap<string, string> {
  const byName = new Map(invariants.map((i) => [i.name, i.expected]));
  return new Map(probes.filter((p) => p.type === "S").flatMap((p) => {
    const key = byName.get(p.invariantName);
    return typeof key === "string" ? [[p.id, key] as const] : [];
  }));
}

const probeOf = (r: LogRecord): string | undefined => (r.detail as { probeId?: string }).probeId;

export function spamMeasures(records: readonly LogRecord[], keys: ReadonlyMap<string, string>): SpamMeasure[] {
  const bySeq = records.slice().sort((a, b) => a.seq - b.seq);
  return bySeq.filter((r) => r.kind === "spam_prompt_shown").map((prompt) => {
    const { probeId, cycle } = prompt.detail as SpamPromptShownDetail;
    // This prompt's records: after it, before the same probe's next prompt (a replayed view).
    const next = bySeq.find((r) => r.seq > prompt.seq && r.kind === "spam_prompt_shown" && probeOf(r) === probeId);
    const own = bySeq.filter((r) => r.seq > prompt.seq && (next === undefined || r.seq < next.seq));
    const mine = (kind: string) => own.filter((r) => r.kind === kind && probeOf(r) === probeId);
    const readies = mine("spam_ready");
    const displays = readies.filter((r) => { const d = r.detail as SpamReadyDetail; return !d.timedOut && !d.skipped; });
    const first = readies[0], shown = displays[0];
    const firstDetail = first?.detail as SpamReadyDetail | undefined;
    const answered = mine("spam_answered")[0];
    const confidence = mine("recall_confidence_submitted")[0];
    const closed = mine("spam_closed")[0];
    const response = answered && !(answered.detail as SpamAnsweredDetail).timedOut ? (answered.detail as SpamAnsweredDetail).response : null;
    const shownForAnswer = answered ? displays.filter((r) => r.seq < answered.seq).at(-1) : undefined;
    const key = keys.get(probeId);
    const tools = shown ? toolUse(own.filter((r) => r.seq > shown.seq && (closed === undefined || r.seq < closed.seq)), answered?.seq ?? null) : NO_TOOL_USE;
    return {
      probeId, view: cycle,
      readyLatencyMs: shown ? shown.tWallOffsetMs - prompt.tWallOffsetMs : null,
      readyCensored: firstDetail?.forced === true,
      forced: firstDetail?.forced === true,
      skipped: firstDetail?.skipped === true,
      readyTimedOut: firstDetail?.timedOut ?? false,
      collapses: mine("spam_collapsed").length,
      answerLatencyMs: shownForAnswer && response !== null ? answered!.tWallOffsetMs - shownForAnswer.tWallOffsetMs : null,
      answerTimedOut: (answered?.detail as SpamAnsweredDetail | undefined)?.timedOut ?? false,
      response,
      correct: response === null || key === undefined ? null : response === key,
      confidence: (confidence?.detail as RecallConfidenceSubmittedDetail | undefined)?.value ?? null,
      itemOpenMs: shown && closed ? closed.tWallOffsetMs - shown.tWallOffsetMs : null,
      ...tools,
      answeredAfterToolAnswer: response === null ? null : tools.answeredAfterToolAnswer,
      thinkerPendingAtPrompt: thinkerPendingAt(bySeq, prompt.seq),
    };
  });
}

type ToolUse = Pick<SpamMeasure, "toolQueries" | "hakuQueries" | "thinkerQueries" | "toolQueryIds"> & { readonly answeredAfterToolAnswer: boolean };
const NO_TOOL_USE: ToolUse = { toolQueries: 0, hakuQueries: 0, thinkerQueries: 0, toolQueryIds: [], answeredAfterToolAnswer: false };

/** The Haku and Thinker queries in an item's window, and whether a tool answer came before the option (`answeredSeq`). */
function toolUse(window: readonly LogRecord[], answeredSeq: number | null): ToolUse {
  const haku: string[] = [], thinker: string[] = [];
  let answerBefore = false;
  for (const r of window) {
    const id = (r.detail as { queryId?: string }).queryId ?? "";
    const beforeAnswer = answeredSeq !== null && r.seq < answeredSeq;
    if (r.kind === "query_submitted" || r.kind === "nav_query_submitted") { haku.push(id); answerBefore ||= beforeAnswer; } // results return with the query
    else if (r.kind === "ai_chat_query_submitted") ((r.detail as AiChatQuerySubmittedDetail).tool === "haku" ? haku : thinker).push(id);
    else if (r.kind === "ai_chat_answer_received") answerBefore ||= beforeAnswer;
  }
  return { toolQueries: haku.length + thinker.length, hakuQueries: haku.length, thinkerQueries: thinker.length, toolQueryIds: [...haku, ...thinker], answeredAfterToolAnswer: answerBefore };
}

/** A Thinker question logged before `seq` whose answer was not logged before it. */
function thinkerPendingAt(records: readonly LogRecord[], seq: number): boolean {
  const before = records.filter((r) => r.seq < seq);
  const answered = new Set(before.filter((r) => r.kind === "ai_chat_answer_received").map((r) => (r.detail as AiChatAnswerReceivedDetail).queryId));
  return before.some((r) => r.kind === "ai_chat_query_submitted" && !answered.has((r.detail as AiChatQuerySubmittedDetail).queryId));
}

/**
 * The manipulation check on the hinge screen (brief D3): `readingMs` = `hinge_check_presented` −
 * `hinge_pause_start` (the directive's reading time before the question), `answerLatencyMs` =
 * `hinge_check_answered` − `hinge_check_presented`, and `correct` against the key (TRUTH, the
 * invariant `manipulation_check.hinge`, passed in). Null when the session never reached the check.
 */
export interface HingeCheckMeasure {
  readonly itemId: string;
  readonly readingMs: number | null;
  readonly answerLatencyMs: number | null;
  readonly optionId: string | null;
  readonly correct: boolean | null;
}

export function hingeCheckMeasure(records: readonly LogRecord[], key: string): HingeCheckMeasure | null {
  const presented = records.find((r) => r.kind === "hinge_check_presented");
  if (!presented) return null;
  const { itemId } = presented.detail as HingeCheckPresentedDetail;
  const start = records.find((r) => r.kind === "hinge_pause_start" && r.seq < presented.seq);
  const answered = records.find((r) => r.kind === "hinge_check_answered" && (r.detail as HingeCheckAnsweredDetail).itemId === itemId);
  const optionId = answered ? (answered.detail as HingeCheckAnsweredDetail).optionId : null;
  return {
    itemId,
    readingMs: start ? presented.tWallOffsetMs - start.tWallOffsetMs : null,
    answerLatencyMs: answered ? answered.tWallOffsetMs - presented.tWallOffsetMs : null,
    optionId,
    correct: optionId === null ? null : optionId === key,
  };
}
