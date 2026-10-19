/**
 * `aiStatedKey` (SPEC/30 §5.3, H2t; 19 Oct 2026): for every L2/L3 freeze item of a freeze that was shown, whether a Haku
 * or Thinker answer shown to the participant BEFORE that freeze stated the item's key — "borrowed" (the AI said it)
 * against "own" (worked out). Analysis only, a pure fold over the log and the freeze content passed in (TRUTH: the keys
 * and `keyStatements`), never called at runtime and never stored (SPEC/07 §1).
 *
 * - The anchor is the view's actual `freeze_started` record (the one before the view's first `freeze_submitted`, else
 *   its first): V10 and V14's freezes come at the view's end (SPEC/30 §5.1), so a scheduled moment would be wrong.
 * - An answer counts when its `ai_chat_answer_received` precedes the anchor (it reached the screen; an answer that
 *   arrives during the freeze is hidden by the blank screen and does not count), from any earlier view. Haku's text is
 *   its four parts; the Thinker's, its answer (`answer.vastaus`). An Open Thinker fallback shows "unavailable", not
 *   text, and is skipped; Haku's fallback (the local template) is shown and counts.
 * - The rule (`key-statement-match.ts`): the item's `keyStatements` in the session language, else the generic band,
 *   sector and token fallback on the key option's label. `rules` says which could apply (empty: the item could not be
 *   screened, e.g. a map item without `keyStatements` — then `stated` is false and the analysis may drop it as a
 *   sensitivity check); `matchedBy` and `matchedText` let the two coders audit a match.
 * - As the scores, a view replayed after a resume is left out unless `includeReplayed` (`replayedViews`).
 * The session language is the header's (`session_started`), Finnish when absent, unless `opts.lang` is given.
 */

import type { FreezeItemLevel } from "../scenario/types.js";
import { tr } from "../i18n/text.js";
import type { Lang } from "../i18n/lang.js";
import type { LogHeader, LogRecord } from "./log.js";
import type { AiChatAnswerReceivedDetail, FreezeStartedDetail, FreezeSubmittedDetail } from "./record-kinds.js";
import { keyMatcher, type KeyRule } from "./key-statement-match.js";
import { replayedViews, type FreezeContentLike } from "./freeze-measures.js";

export type StatingTool = "haku" | "thinker";

export interface AiStatedKey {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly stated: boolean;
  /** The first answer (before the freeze) that stated the key: its seq, its view and its tool; null when none. */
  readonly firstStatedSeq: number | null;
  readonly statedInView: number | null;
  readonly tool: StatingTool | null;
  readonly matchedBy: KeyRule | null;
  readonly matchedText: string | null;
  /** The rules that could apply to the item; empty when it could not be screened. */
  readonly rules: readonly KeyRule[];
  /** The `freeze_started` the answers were read up to. */
  readonly freezeStartedSeq: number;
}

export interface AiStatedKeyOptions {
  /** The session language; default the header's (`session_started`), else Finnish. */
  readonly lang?: Lang;
  /** An option label in the session language; default `tr(lang, fi)` (`content/i18n/labels.en.json`). */
  readonly label?: (fi: string) => string;
  /** Levels screened; default L2 and L3. */
  readonly levels?: readonly FreezeItemLevel[];
  readonly includeReplayed?: boolean;
}

interface ShownAnswer { readonly seq: number; readonly view: number; readonly tool: StatingTool; readonly text: string }

/** Every chat answer that reached the screen with text, in log order. */
export function shownAnswers(records: readonly LogRecord[]): ShownAnswer[] {
  const out: ShownAnswer[] = [];
  for (const r of records) {
    if (r.kind !== "ai_chat_answer_received") continue;
    const d = r.detail as AiChatAnswerReceivedDetail;
    const tool: StatingTool = d.tool === "haku" ? "haku" : "thinker"; // no `tool`: the structured Thinker, before 8 Oct 2026
    if (tool === "thinker" && d.fallback) continue; // shown as "unavailable"
    const a = d.answer;
    const text = tool === "haku" ? [a.vastaus, a.perusteet, a.varmuus, a.muuttaisi].filter((x) => x).join("\n") : a.vastaus;
    if (text.trim()) out.push({ seq: r.seq as number, view: d.view, tool, text });
  }
  return out;
}

/** The `freeze_started` each view's scored freeze was shown at: the last before the view's first submission, else the first. */
function freezeAnchors(records: readonly LogRecord[]): Map<number, LogRecord> {
  const firstStart = new Map<number, LogRecord>();
  const anchor = new Map<number, LogRecord>();
  const lastStart = new Map<number, LogRecord>();
  for (const r of records) {
    if (r.kind === "freeze_started") {
      const v = (r.detail as FreezeStartedDetail).cycle as number;
      if (!firstStart.has(v)) firstStart.set(v, r);
      lastStart.set(v, r);
    } else if (r.kind === "freeze_submitted") {
      const v = (r.detail as FreezeSubmittedDetail).cycle as number;
      if (!anchor.has(v) && lastStart.has(v)) anchor.set(v, lastStart.get(v)!);
    }
  }
  for (const [v, r] of firstStart) if (!anchor.has(v)) anchor.set(v, r);
  return anchor;
}

const headerLanguage = (records: readonly LogRecord[]): Lang =>
  (records.find((r) => r.kind === "session_started")?.detail as LogHeader | undefined)?.language ?? "fi";

export function aiStatedKey(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: AiStatedKeyOptions = {}): AiStatedKey[] {
  const lang = opts.lang ?? headerLanguage(records);
  const label = opts.label ?? ((fi: string) => tr(lang, fi));
  const levels = opts.levels ?? ["L2", "L3"];
  const replayed = opts.includeReplayed ? new Set<number>() : replayedViews(records);
  const anchors = freezeAnchors(records);
  const answers = shownAnswers(records);
  const out: AiStatedKey[] = [];
  for (const freeze of freezes) {
    const anchor = anchors.get(freeze.cycle);
    if (!anchor || replayed.has(freeze.cycle)) continue;
    const before = answers.filter((a) => a.seq < (anchor.seq as number));
    for (const item of freeze.items) {
      if (!levels.includes(item.level)) continue;
      const matcher = keyMatcher(item, lang, label);
      let hit: { readonly answer: ShownAnswer; readonly rule: KeyRule; readonly text: string } | null = null;
      for (const answer of before) {
        const m = matcher.match(answer.text);
        if (m) { hit = { answer, rule: m.rule, text: m.text }; break; }
      }
      out.push({
        view: freeze.cycle, itemId: item.id, level: item.level, stated: hit !== null,
        firstStatedSeq: hit?.answer.seq ?? null, statedInView: hit?.answer.view ?? null, tool: hit?.answer.tool ?? null,
        matchedBy: hit?.rule ?? null, matchedText: hit?.text ?? null, rules: matcher.rules, freezeStartedSeq: anchor.seq as number,
      });
    }
  }
  return out;
}
