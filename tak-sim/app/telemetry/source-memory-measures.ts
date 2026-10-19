/**
 * The source-memory measures (SPEC/30 §5.5, 19 Oct 2026): pure folds over a session's log, like `derived-measures.ts` — never
 * stored back. For each fact of the post-session block (`app/scenario/source-memory.ts`) and the participant:
 *
 * - `answer`: where the participant says the fact came from (`questionnaire_submitted`, item `source.<fact>`; the first post
 *   questionnaire submitted counts): `self` (worked it out), `records` (a report, the message log or the map), `haku`, `thinker`
 *   (Thinker cells only), `unknown` (did not know it); null when left blank; undefined when no post questionnaire was submitted;
 * - `aiStated`: an AI answer shown before the post-session block (`ai_chat_answer_received`, either tool: Haku's chat or the Thinker)
 *   stated the fact, by the fact's `keyStatements` (in the session language when given, else both), with the first such answer's
 *   seq and the tools that stated it. The answer's text is its four fields (`answer.*`); the question (`text`) is not read;
 * - `recordReached`: one of the fact's records reached the participant before the block by a route that shows the record itself —
 *   pushed (`bubble`), a Haku result (`haku`) or an older format's (`traffic`, `result_expanded`) — read with `atomExposure`
 *   (`freeze-measures.ts`); a retrieval by an AI answer (`haku_chat`, `thinker`) is reported apart (`retrievedByAi`), since a
 *   retrieval does not show the record;
 * - `aiFirst`: the AI stated the fact before any of its records reached the participant (or none ever did);
 * - `misattribution`: the AI stated it first, its record never reached the participant, and the answer is `self` or `records` —
 *   AI-supplied knowledge remembered as one's own or as read in a report (SPEC/11 §7.15).
 *
 * The anchor of "before the block" is the post questionnaire's `questionnaire_presented` (else its `questionnaire_submitted`;
 * with neither, the whole log). Exploratory (SPEC/30 §6, "Source memory"): the misattribution rate by group.
 */

import { SOURCE_MEMORY_FACTS, sourceItemId, type SourceMemoryFact } from "../scenario/source-memory.js";
import { atomExposure, type ExposureRoute } from "./freeze-measures.js";
import type { LogRecord } from "./log.js";
import type { AiChatAnswerReceivedDetail, QuestionnairePresentedDetail, QuestionnaireSubmittedDetail } from "./record-kinds.js";
import type { AiChatTool } from "./record-kinds-interaction.js";

export type SourceAnswer = "self" | "records" | "haku" | "thinker" | "unknown";
/** A source the participant names for what they saw in a record (the misattribution answers). */
const OWN_OR_RECORD: ReadonlySet<string> = new Set(["self", "records"]);
const DIRECT_ROUTES: ReadonlySet<ExposureRoute> = new Set(["bubble", "haku", "traffic", "result_expanded"]);

export interface SourceMemoryRow {
  readonly factId: string;
  readonly itemId: string;
  /** The option answered; null when left blank; undefined when no post questionnaire was submitted. */
  readonly answer: string | null | undefined;
  readonly aiStated: boolean;
  /** Seq of the first AI answer before the block that stated the fact. */
  readonly aiStatedSeq: number | null;
  /** Every tool whose answer stated it before the block, in order of first statement. */
  readonly aiStatedTools: readonly AiChatTool[];
  readonly recordReached: boolean;
  /** Routes by which one of its records reached the participant before the block (all routes, AI retrievals included), in order. */
  readonly routes: readonly ExposureRoute[];
  /** An AI answer retrieved one of its records before the block (not proof that it was shown). */
  readonly retrievedByAi: boolean;
  readonly aiFirst: boolean;
  readonly misattribution: boolean;
}

export interface SourceMemoryOptions {
  /** The session language (`header.language`): only that language's statements are read; both when absent. */
  readonly language?: "fi" | "en";
  /** The facts (default: the session's seven). */
  readonly facts?: readonly SourceMemoryFact[];
}

const isPost = (r: LogRecord, kind: string) => r.kind === kind && (r.detail as { questionnaireId?: string }).questionnaireId === "post";

/** The text an AI answer showed: its four fields (the Open Thinker's plain answer is in `vastaus`). */
export function aiAnswerText(d: AiChatAnswerReceivedDetail): string {
  return [d.answer.vastaus, d.answer.perusteet, d.answer.varmuus, d.answer.muuttaisi].filter((s) => s && s.length > 0).join("\n");
}

/** Whether a text states a fact, by its statements in `language` (both languages when absent). */
export function statesFact(text: string, fact: SourceMemoryFact, language?: "fi" | "en"): boolean {
  const sources = language ? fact.keyStatements[language] : [...fact.keyStatements.fi, ...fact.keyStatements.en];
  return sources.some((s) => new RegExp(s, "i").test(text));
}

/** One row per fact: the answer, what the AI stated before the block, whether the record reached the participant, and the flag. */
export function sourceMemoryMeasures(records: readonly LogRecord[], opts: SourceMemoryOptions = {}): SourceMemoryRow[] {
  const facts = opts.facts ?? SOURCE_MEMORY_FACTS;
  const presented = records.find((r) => isPost(r, "questionnaire_presented"));
  const submitted = records.find((r) => isPost(r, "questionnaire_submitted"));
  const anchorSeq = ((presented ?? submitted)?.seq as number | undefined) ?? Number.POSITIVE_INFINITY;
  const answers = submitted ? (submitted.detail as QuestionnaireSubmittedDetail).answers : null;
  const shownItems = presented ? new Set((presented.detail as QuestionnairePresentedDetail).itemIds) : null;
  const aiAnswers = records.filter((r) => r.kind === "ai_chat_answer_received" && (r.seq as number) < anchorSeq);

  return facts.map((fact): SourceMemoryRow => {
    const itemId = sourceItemId(fact.id);
    const given = answers?.find((a) => a.itemId === itemId);
    const answer = answers === null ? undefined : shownItems && !shownItems.has(itemId) ? undefined : typeof given?.value === "string" ? given.value : null;

    const stating = aiAnswers.filter((r) => statesFact(aiAnswerText(r.detail as AiChatAnswerReceivedDetail), fact, opts.language));
    const tools: AiChatTool[] = [];
    for (const r of stating) {
      const tool = (r.detail as AiChatAnswerReceivedDetail).tool ?? "open_thinker";
      if (!tools.includes(tool)) tools.push(tool);
    }
    const aiStatedSeq = stating.length > 0 ? (stating[0]!.seq as number) : null;

    const anchor = Number.isFinite(anchorSeq) ? anchorSeq : Math.max(-1, ...records.map((r) => r.seq as number)) + 1;
    const exposure = atomExposure(records, fact.atomIds, anchor);
    const routes: ExposureRoute[] = [];
    for (const e of exposure) for (const route of e.routes) if (!routes.includes(route)) routes.push(route);
    const recordReached = routes.some((r) => DIRECT_ROUTES.has(r));
    const reachedBeforeAi = aiStatedSeq !== null && atomExposure(records, fact.atomIds, aiStatedSeq).some((e) => e.routes.some((r) => DIRECT_ROUTES.has(r)));
    const aiFirst = aiStatedSeq !== null && !reachedBeforeAi;

    return {
      factId: fact.id, itemId, answer,
      aiStated: aiStatedSeq !== null, aiStatedSeq, aiStatedTools: tools,
      recordReached, routes, retrievedByAi: routes.some((r) => !DIRECT_ROUTES.has(r)),
      aiFirst,
      misattribution: aiFirst && !recordReached && typeof answer === "string" && OWN_OR_RECORD.has(answer),
    };
  });
}

export interface SourceMemorySummary {
  /** Facts answered (an option, not blank). */
  readonly answered: number;
  /** Facts the AI stated first whose record never reached the participant: the ones that can be misattributed. */
  readonly atRisk: number;
  readonly misattributed: number;
  /** misattributed / atRisk among the answered; null when nothing was at risk. */
  readonly rate: number | null;
}

/** A participant's misattribution summary over the rows (exploratory: the rate is compared by group). */
export function sourceMemorySummary(rows: readonly SourceMemoryRow[]): SourceMemorySummary {
  const answered = rows.filter((r) => typeof r.answer === "string");
  const atRisk = answered.filter((r) => r.aiFirst && !r.recordReached);
  const misattributed = atRisk.filter((r) => r.misattribution).length;
  return { answered: answered.length, atRisk: atRisk.length, misattributed, rate: atRisk.length === 0 ? null : misattributed / atRisk.length };
}
