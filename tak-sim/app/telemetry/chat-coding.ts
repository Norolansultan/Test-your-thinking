/**
 * The extractor for H2a's question coding (SPEC/09 revision (aa) note on question coding): every
 * question typed into either chat, with what the coders need and nothing that names the cell. A pure
 * fold over the raw records. The coding scheme itself is in SPEC/09.
 *
 * `chatQuestionsForCoding` returns the full rows for the analysis (they carry `tool`, which reveals
 * that the participant had the Open Thinker); `blindCodingSheet` strips `tool` and the true query id
 * for the coders, who are blind to the cell, adds the question before it in the same thread (a follow-up
 * such as "and now?" cannot be coded without it) and redacts the tools' names from both texts: a
 * participant who writes "Thinker" or "Haku" in a question would otherwise reveal the cell (fix pass 6).
 */

import { sha256Hex } from "./sha256.js";
import type { LogRecord } from "./log.js";
import type { AiChatAnswerReceivedDetail, AiChatQuerySubmittedDetail } from "./record-kinds.js";
import type { AiChatTool } from "./record-kinds-interaction.js";
import { PRACTICE_VIEW_INDEX } from "../scenario/views.js";

export interface ChatQuestionRow {
  readonly queryId: string;
  /** From the matching answer record; the query's own `tool` when no answer came back; null in logs without either. */
  readonly tool: AiChatTool | null;
  readonly view: number;
  /**
   * Revision (an), 10 Oct 2026: asked in the practice view (VP, view 0). Since revision (am) the Thinker cells
   * meet the Thinker in VP; those questions are practice, not data, and are left out unless asked for.
   */
  readonly practice: boolean;
  readonly virtualTimeS: number;
  /** Real ms since the session started (`tWallOffsetMs` of the query record). */
  readonly wallMs: number;
  readonly phase: "exploration" | "decision";
  readonly text: string;
  /** The question before this one in the same thread (the same chat tool within the same view), or null for the first. */
  readonly previousText: string | null;
  /** A hash of the salt and the query id: stable, unique across sessions, says nothing of the cell. */
  readonly blindId: string;
}

export interface ChatQuestionsOptions {
  /** Revision (an): include the practice view's questions (flagged `practice: true`). Default false: they are excluded. */
  readonly includePractice?: boolean;
}

/**
 * Every `ai_chat_query_submitted`, in log order. `salt` (e.g. the session id) makes the blind ids unique
 * across sessions. Revision (an): the practice view's questions are excluded by default; `includePractice`
 * keeps them, flagged `practice`.
 */
export function chatQuestionsForCoding(records: readonly LogRecord[], salt: string, options: ChatQuestionsOptions = {}): ChatQuestionRow[] {
  const toolOfAnswer = new Map<string, AiChatTool | undefined>();
  for (const r of records) {
    if (r.kind !== "ai_chat_answer_received") continue;
    const d = r.detail as AiChatAnswerReceivedDetail;
    if (!toolOfAnswer.has(d.queryId)) toolOfAnswer.set(d.queryId, d.tool);
  }
  const out: ChatQuestionRow[] = [];
  const lastInThread = new Map<string, string>();
  for (const r of records) {
    if (r.kind !== "ai_chat_query_submitted") continue;
    const d = r.detail as AiChatQuerySubmittedDetail;
    const practice = d.view === PRACTICE_VIEW_INDEX;
    if (practice && options.includePractice !== true) continue;
    const tool = toolOfAnswer.get(d.queryId) ?? d.tool ?? null;
    const thread = `${tool ?? ""}|${d.view}`;
    out.push({
      queryId: d.queryId, tool, view: d.view, practice, virtualTimeS: d.virtualTimeS,
      wallMs: r.tWallOffsetMs, phase: d.phase, text: d.text, previousText: lastInThread.get(thread) ?? null, blindId: `Q${sha256Hex(`${salt}|${d.queryId}`).slice(0, 12)}`,
    });
    lastInThread.set(thread, d.text);
  }
  return out;
}

export type BlindChatQuestion = Pick<ChatQuestionRow, "blindId" | "view" | "virtualTimeS" | "phase" | "text" | "previousText">;

/** The tools' names as a participant may write them ("Haku", "Hakua", "Thinker", "Open Thinker's", "Thinkerille"): replaced in the coders' texts. */
const TOOL_NAME = /\b(?:open\s+)?(?:thinker|haku)\p{L}*/giu;
export const redactToolNames = (text: string): string => text.replace(TOOL_NAME, "[tool]");

/** What the coders see: no tool, no true query id, the previous question of the thread, the tools' names redacted, and a fixed order by blind id, not the log's. */
export function blindCodingSheet(rows: readonly ChatQuestionRow[]): BlindChatQuestion[] {
  return rows
    .map(({ blindId, view, virtualTimeS, phase, text, previousText }) => ({
      blindId, view, virtualTimeS, phase, text: redactToolNames(text), previousText: previousText === null ? null : redactToolNames(previousText),
    }))
    .sort((a, b) => (a.blindId < b.blindId ? -1 : a.blindId > b.blindId ? 1 : 0));
}
