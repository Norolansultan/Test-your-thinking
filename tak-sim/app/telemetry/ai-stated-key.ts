/**
 * `aiStatedKey` (SPEC/30 §5.3, H2t; 19 Oct 2026): for every L2/L3 freeze item of a freeze that was shown, whether a Haku
 * or Thinker answer shown to the participant BEFORE that freeze stated the item's key — "borrowed" (the AI said it)
 * against "own" (worked out). Analysis only, a pure fold over the log and the freeze content passed in (TRUTH: the keys
 * and `keyStatements`), never called at runtime and never stored (SPEC/07 §1).
 *
 * - The anchor is the view's actual `freeze_started` record (the one before the view's first `freeze_submitted`, else
 *   its first): V10 and V14's freezes come at the view's end (SPEC/30 §5.1), so a scheduled moment would be wrong.
 * - An answer counts when its `ai_chat_answer_received` precedes the anchor (it reached the screen; an answer that
 *   arrives during the freeze is hidden by the blank screen and does not count). Haku's text is its four parts; the
 *   Thinker's, its answer (`answer.vastaus`). An Open Thinker fallback shows "unavailable", not text, and is skipped;
 *   Haku's fallback (the local template) is shown and counts.
 * - **The plan review's premise lines** (SPEC/32 §3, 20 Oct 2026): the guide group's lines on `plan_review_shown` are AI-stated
 *   text shown at that record (its seq, its view, its virtual time), counted as a Thinker answer (`tool: "thinker"`). The Haku
 *   group's review and a failed lookup carry no lines and count for nothing.
 * - **The window** (SPEC/31 §3.6, sagat F16): only answers in the freeze's view or the one before, and asked at or after the
 *   item's basis records were released (its `keyAtomIds` and `basisAtomIds`, by `releaseS`: when each became reachable, from
 *   `recordReleaseTimes`; without `releaseS`, or with none of the item's records in it, the view window alone). `allEarlierAnswers`
 *   restores the rule before (ay): every earlier answer from V1 on (`window: "all_before"`), for comparison.
 * - The rule (`key-statement-match.ts`): the item's `keyStatements` in the session language, else the generic band,
 *   sector and token fallback on the key option's label; element-tied where the item has `elementPatterns` (F16). `rules` says
 *   which could apply (empty: the item could not be screened, e.g. a map item without `keyStatements` — then `stated` is false
 *   and the analysis may drop it as a sensitivity check); `matchedBy` and `matchedText` let the two coders audit a match.
 * - **`statedLure`** (F16): an answer in the same window stated a distractor (`lureMatchers`: its `lureStatements`, else the
 *   generic rules on its label), e.g. the map-now 950 m or DR3's 125.9 ha; `lureOptionIds` lists every distractor stated. Reported
 *   with H2t; the error-class fold reads it (STATED_LURE).
 * - **The three-way told class** (§3.6, parity P-3; RC for H2t): `stream_told` when every key record (`keyAtomIds`, non-empty)
 *   was pushed to the participant (`bubble`) before the freeze — the stream told everyone; else `ai_told` when `stated`; else
 *   `neither`. H2t contrasts AI-told against neither and reports stream-told (`h2tSplit`).
 * - As the scores, a view replayed after a resume is left out unless `includeReplayed` (`replayedViews`).
 * The session language is the header's (`session_started`), Finnish when absent, unless `opts.lang` is given.
 */

import type { FreezeItemLevel } from "../scenario/types.js";
import { STEP_SECONDS } from "../scenario/views.js";
import { tr } from "../i18n/text.js";
import type { Lang } from "../i18n/lang.js";
import type { LogHeader, LogRecord } from "./log.js";
import type { AiChatAnswerReceivedDetail, FreezeStartedDetail, FreezeSubmittedDetail, PlanReviewShownDetail } from "./record-kinds.js";
import { keyMatcher, lureMatchers, type KeyRule } from "./key-statement-match.js";
import { atomExposure, replayedViews, type AnalysisFreezeItem, type FreezeContentLike } from "./freeze-measures.js";

export type StatingTool = "haku" | "thinker";

/** SPEC/31 §3.6: how the item's key reached the participant before the freeze. */
export type ToldClass = "stream_told" | "ai_told" | "neither";

export interface AiStatedKey {
  readonly view: number;
  readonly itemId: string;
  readonly level: FreezeItemLevel;
  readonly stated: boolean;
  /** The first answer (in the window) that stated the key: its seq, its view and its tool; null when none. */
  readonly firstStatedSeq: number | null;
  readonly statedInView: number | null;
  readonly tool: StatingTool | null;
  readonly matchedBy: KeyRule | null;
  readonly matchedText: string | null;
  /** The rules that could apply to the item; empty when it could not be screened. */
  readonly rules: readonly KeyRule[];
  /** The `freeze_started` the answers were read up to. */
  readonly freezeStartedSeq: number;
  /** SPEC/31 F16: an answer in the window stated a distractor; every distractor stated (option order); the first such answer and match. */
  readonly statedLure: boolean;
  readonly lureOptionIds: readonly string[];
  readonly firstLureSeq: number | null;
  readonly lureMatchedText: string | null;
  /** Every key record (`keyAtomIds`, non-empty) was pushed (`bubble`) before the freeze. */
  readonly keyPushed: boolean;
  readonly toldClass: ToldClass;
  /** Which answers were read: the F16 window, or every earlier one (`allEarlierAnswers`). */
  readonly window: "f16" | "all_before";
  /** The virtual time from which an answer counts (the latest release of the item's basis records); null when none is known. */
  readonly basisReleasedAtS: number | null;
}

export interface AiStatedKeyOptions {
  /** The session language; default the header's (`session_started`), else Finnish. */
  readonly lang?: Lang;
  /** An option label in the session language; default `tr(lang, fi)` (`content/i18n/labels.en.json`). */
  readonly label?: (fi: string) => string;
  /** Levels screened; default L2 and L3. */
  readonly levels?: readonly FreezeItemLevel[];
  readonly includeReplayed?: boolean;
  /** Record id → the virtual seconds from which it is reachable (`recordReleaseTimes`); absent: the view window alone. */
  readonly releaseS?: ReadonlyMap<string, number>;
  /** The rule before SPEC/31 (every answer before the freeze, from any earlier view), for comparison. */
  readonly allEarlierAnswers?: boolean;
}

interface ShownAnswer { readonly seq: number; readonly view: number; readonly virtualTimeS: number; readonly tool: StatingTool; readonly text: string }

/** Every chat answer that reached the screen with text, and every plan review's premise lines (SPEC/32 §3), in log order. */
export function shownAnswers(records: readonly LogRecord[]): ShownAnswer[] {
  const out: ShownAnswer[] = [];
  for (const r of records) {
    if (r.kind === "plan_review_shown") {
      const d = r.detail as PlanReviewShownDetail;
      const text = (d.premiseLines ?? []).join("\n");
      if (text.trim()) out.push({ seq: r.seq as number, view: d.cycle as number, virtualTimeS: r.tVirtual as number, tool: "thinker", text });
      continue;
    }
    if (r.kind !== "ai_chat_answer_received") continue;
    const d = r.detail as AiChatAnswerReceivedDetail;
    const tool: StatingTool = d.tool === "haku" ? "haku" : "thinker"; // no `tool`: the structured Thinker, before 8 Oct 2026
    if (tool === "thinker" && d.fallback) continue; // shown as "unavailable"
    const a = d.answer;
    const text = tool === "haku" ? [a.vastaus, a.perusteet, a.varmuus, a.muuttaisi].filter((x) => x).join("\n") : a.vastaus;
    if (text.trim()) out.push({ seq: r.seq as number, view: d.view, virtualTimeS: d.virtualTimeS, tool, text });
  }
  return out;
}

/**
 * TRUTH-free helper: when each record becomes reachable, in virtual seconds — the start of its world-state step (`reachableAtoms`: a
 * step-k record from step k on; step k starts at (k − 1) × `STEP_SECONDS`). Pass the scenario's atoms; the result is `releaseS`.
 */
export function recordReleaseTimes(atoms: readonly { readonly id: string; readonly cycle: number }[]): Map<string, number> {
  return new Map(atoms.map((a) => [a.id, (a.cycle - 1) * STEP_SECONDS]));
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

/** The item's basis records: its key records and its `basisAtomIds`, without repeats, in that order. */
export function basisRecordIds(item: AnalysisFreezeItem): string[] {
  return [...new Set([...(item.keyAtomIds ?? []), ...(item.basisAtomIds ?? [])])];
}

/** The latest release among the item's basis records known to `releaseS`; null when none is. */
function basisRelease(item: AnalysisFreezeItem, releaseS: ReadonlyMap<string, number> | undefined): number | null {
  if (!releaseS) return null;
  const known = basisRecordIds(item).map((id) => releaseS.get(id)).filter((t): t is number => t !== undefined);
  return known.length === 0 ? null : Math.max(...known);
}

export function aiStatedKey(records: readonly LogRecord[], freezes: readonly FreezeContentLike[], opts: AiStatedKeyOptions = {}): AiStatedKey[] {
  const lang = opts.lang ?? headerLanguage(records);
  const label = opts.label ?? ((fi: string) => tr(lang, fi));
  const levels = opts.levels ?? ["L2", "L3"];
  const replayed = opts.includeReplayed ? new Set<number>() : replayedViews(records);
  const anchors = freezeAnchors(records);
  const answers = shownAnswers(records);
  const window = opts.allEarlierAnswers ? "all_before" : "f16";
  const out: AiStatedKey[] = [];
  for (const freeze of freezes) {
    const anchor = anchors.get(freeze.cycle);
    if (!anchor || replayed.has(freeze.cycle)) continue;
    const before = answers.filter((a) => a.seq < (anchor.seq as number) && (window === "all_before" || a.view === freeze.cycle || a.view === freeze.cycle - 1));
    for (const item of freeze.items) {
      if (!levels.includes(item.level)) continue;
      const released = window === "f16" ? basisRelease(item, opts.releaseS) : null;
      const eligible = released === null ? before : before.filter((a) => a.virtualTimeS >= released);
      const matcher = keyMatcher(item, lang, label);
      let hit: { readonly answer: ShownAnswer; readonly rule: KeyRule; readonly text: string } | null = null;
      for (const answer of eligible) {
        const m = matcher.match(answer.text);
        if (m) { hit = { answer, rule: m.rule, text: m.text }; break; }
      }
      const lures = lureMatchers(item, lang, label);
      const lureOptionIds: string[] = [];
      let firstLure: { readonly seq: number; readonly text: string } | null = null;
      for (const answer of eligible) {
        for (const l of lures) {
          const m = l.matcher.match(answer.text);
          if (!m) continue;
          if (!lureOptionIds.includes(l.optionId)) lureOptionIds.push(l.optionId);
          if (firstLure === null) firstLure = { seq: answer.seq, text: m.text };
        }
      }
      const keyIds = item.keyAtomIds ?? [];
      const keyPushed = keyIds.length > 0 && atomExposure(records, keyIds, anchor.seq as number).every((e) => e.routes.includes("bubble"));
      out.push({
        view: freeze.cycle, itemId: item.id, level: item.level, stated: hit !== null,
        firstStatedSeq: hit?.answer.seq ?? null, statedInView: hit?.answer.view ?? null, tool: hit?.answer.tool ?? null,
        matchedBy: hit?.rule ?? null, matchedText: hit?.text ?? null, rules: matcher.rules, freezeStartedSeq: anchor.seq as number,
        statedLure: lureOptionIds.length > 0, lureOptionIds: lures.filter((l) => lureOptionIds.includes(l.optionId)).map((l) => l.optionId),
        firstLureSeq: firstLure?.seq ?? null, lureMatchedText: firstLure?.text ?? null,
        keyPushed, toldClass: keyPushed ? "stream_told" : hit !== null ? "ai_told" : "neither",
        window, basisReleasedAtS: released,
      });
    }
  }
  return out;
}
