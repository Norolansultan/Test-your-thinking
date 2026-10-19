/**
 * The pre- and post-session questionnaires (SPEC/09 §2, §6.1; SPEC/27 §4.1; work package I, 5 Oct
 * 2026). The items' structure lives here, their wording in `app/i18n/study-texts.ts`. Answers are
 * logged raw (`questionnaire_submitted`): an option id, a number, a list of option ids (with the order
 * they were shown in), null when left blank or not shown.
 * Nothing is scored here; the retention item's correctness is derived later against the scenario's
 * hinge-check invariant, as for the hinge check itself.
 *
 * - `pre` (after the preflight, before the briefing): fatigue at the start (SPEC/09 §6.1).
 * - `post` (after V14, before the debrief, SPEC/09 §5.1): first the retention repeat of the hinge
 *   check (all cells, options reordered), in the Thinker cells the perception item (SPEC/27 §4.1), and
 *   the directive's fit (the Paper 2 manipulation check, revision (ai)); then the source-memory block
 *   (SPEC/30 §5.5, 19 Oct 2026: seven facts, "Where did this come from for you?"); then workload (raw NASA-TLX),
 *   fatigue at the end, the picture, trust and the walkthrough substitutes (§6.1) and the
 *   instructed-response attention check (§6.2); the prior-knowledge item (§6.2 exclusion);
 *   then the background covariates (§2). `service.country` and `terms.familiarity` are added for
 *   R2 (who the participants are is open): researcher to confirm.
 * - Revision (x), 6 Oct 2026: no containment judgement is asked any more, so `accuracy.perceived`
 *   (perceived own judgement accuracy) is removed, and `last.possibilities` / `last.basis` ask
 *   about the participant's last allocation instead of the last judgement (same response formats).
 * - Revision (ai), 9 Oct 2026 (researcher: no open-ended questions in the session; three professor
 *   reviews): no free text is left. `last.basis` and `disagreement.action` are multi-select (`multi`:
 *   language-neutral option ids, an optional exclusive option, options filtered by cell, the order
 *   drawn once from the scenario seed, the same for everyone, with fixed-last options, `option-order.ts`); `last.basis.main` asks which
 *   ticked basis mattered most (`pick_from`, shown when two or more are ticked); `disagreement.action`
 *   is shown only after `disagreement.recall` = yes (`showIf`); `felt.wrong` is yes/no/unsure with no
 *   content list (a list would cue the planted errors); `directive.fit` is new. The only difference
 *   between cells is the Thinker cells' filter.
 *
 * - `31` §3.10 (19 Oct 2026; sagat F17, proposal (a), parity P-6, P-12): the source block holds nine facts, two of them false lures;
 *   after `prior.knowledge` come the believability item, the recognition item ("did it remind you of a real fire?") with what was
 *   recognised (shown on yes), the prior use of the web demonstration or game mode, and two perceived-reliability items (exploratory).
 *   Each has the pre-registered exclusion or sensitivity rule of `POST_SESSION_RULES` (about +1.5 min; `15` (ay) the shortening order).
 *
 * DRAFT: the items and their order await the researcher; the TLX wording needs a validated Finnish version.
 */

import type { Cell } from "../scenario/types.js";
import type { QuestionnaireId } from "../telemetry/record-kinds.js";
import { SOURCE_MEMORY_FACTS, sourceItemId } from "../scenario/source-memory.js";
import { participantOptionOrder, type OptionOrderSeed } from "./option-order.js";

/** An item is shown only when an earlier item was answered with a given option. */
export interface ShowIf {
  readonly itemId: string;
  readonly equals: string;
}

/** A multi-select option: a language-neutral id, optionally only in some cells. */
export interface MultiOption {
  readonly id: string;
  readonly cells?: readonly Cell[];
}

interface ItemBase {
  readonly id: string;
  readonly section: string;
  readonly cells?: readonly Cell[];
  readonly showIf?: ShowIf;
}

export type QuestionnaireItem =
  /**
   * One option. `optionCells` (SPEC/30 §5.5): an option listed there is offered only in those cells; in a questionnaire's view
   * (`resolveItems`) `options` are already filtered for the cell, in the authored order.
   */
  | (ItemBase & { readonly kind: "choice"; readonly options: readonly string[]; readonly optionCells?: Readonly<Record<string, readonly Cell[]>> })
  | (ItemBase & { readonly kind: "scale"; readonly min: number; readonly max: number })
  | (ItemBase & { readonly kind: "number"; readonly min: number; readonly max: number })
  /**
   * Multi-select (revision (ai)): any number of `options`; `exclusive`, when ticked, is the only answer;
   * `fixedLast` stay last, the rest in the participant's order. In a questionnaire's view the options
   * are already filtered for the cell and in the order shown (`resolveItems`).
   */
  | (ItemBase & { readonly kind: "multi"; readonly options: readonly MultiOption[]; readonly exclusive?: string; readonly fixedLast?: readonly string[] })
  /** One of the options ticked in the multi item `from`, shown when two or more are ticked (revision (ai)). */
  | (ItemBase & { readonly kind: "pick_from"; readonly from: string })
  /** The hinge check repeated: its options come from the scenario, reordered (`retentionOrder`). */
  | (ItemBase & { readonly kind: "retention" });

export const THINKER_CELLS: readonly Cell[] = ["reasoning_once", "reasoning_intent"];
const scale7 = (id: string, section: string, cells?: readonly Cell[]): QuestionnaireItem => ({ id, section, kind: "scale", min: 1, max: 7, ...(cells ? { cells } : {}) });
const tlx = (id: string): QuestionnaireItem => ({ id, section: "workload", kind: "scale", min: 0, max: 20 });
const yesNoUnsure = ["yes", "no", "unsure"] as const;

export const PRE_ITEMS: readonly QuestionnaireItem[] = [scale7("fatigue.start", "session")];

export const RETENTION_ITEM_ID = "retention.hinge";

/**
 * The instructed-response attention check (SPEC/09 §6.2, researcher, 8 Oct 2026): a 1–7 item whose
 * text tells the participant which value to choose. The same in every cell; `attentionCheckPassed`
 * (`app/telemetry/derived-measures.ts`) compares the logged answer with `ATTENTION_CHECK_CORRECT`.
 */
export const ATTENTION_CHECK_ID = "attention.check";
export const ATTENTION_CHECK_CORRECT = 2;

/**
 * What the last allocation rested on (revision (ai)): exploratory; reliance is measured from the logs.
 * `directive`: the directive is in force from V8, so always by V14 — offered in every cell. No "none".
 */
const BASIS_OPTIONS: readonly MultiOption[] = [
  { id: "projection" }, { id: "unit_reports" }, { id: "drone_sensor" }, { id: "situation_log" }, { id: "search" },
  { id: "thinker", cells: THINKER_CELLS }, { id: "directive" }, { id: "experience" }, { id: "other" },
];
/** What the participant did about a disagreement with the projection (revision (ai)); `nothing` is exclusive. */
const ACTION_OPTIONS: readonly MultiOption[] = [
  { id: "checked_reports" }, { id: "asked_search" }, { id: "asked_thinker", cells: THINKER_CELLS }, { id: "placed_on_own_estimate" },
  { id: "safety_margin" }, { id: "went_with_projection" }, { id: "nothing" },
];

/**
 * The source-memory block (SPEC/30 §5.5, 19 Oct 2026): one item per fact (`source-memory.ts`), "Where did this come from for you?",
 * after the recall items and before the workload items, in every cell. The Thinker option is offered in the Thinker cells only;
 * "I did not know this" is always last. Logged as ordinary questionnaire answers (`questionnaire_submitted`, item `source.<fact>`);
 * misattribution is read with the log (`source-memory-measures.ts`). DRAFT: the facts and the wording await the domain and native review.
 */
export const SOURCE_SECTION = "source";
export const SOURCE_OPTIONS = ["self", "records", "haku", "thinker", "unknown"] as const;
export type SourceOption = (typeof SOURCE_OPTIONS)[number];
export const SOURCE_ITEMS: readonly QuestionnaireItem[] = SOURCE_MEMORY_FACTS.map((f) => ({
  id: sourceItemId(f.id), section: SOURCE_SECTION, kind: "choice", options: SOURCE_OPTIONS, optionCells: { thinker: THINKER_CELLS },
}));

/**
 * `31` §3.10 (19 Oct 2026): the post-session items that guard the sample and their pre-registered rules (`09` (ay), INT). Applied in the
 * analysis (WP-3), never in the session. `exclude`: the participant leaves the primary analyses and enters a sensitivity analysis that
 * keeps them; `sensitivity`: a sensitivity analysis without them; `exploratory`: no rule.
 */
export const POST_SESSION_RULES: Readonly<Record<string, { readonly rule: "exclude" | "sensitivity" | "exploratory"; readonly when: string }>> = {
  believability: { rule: "sensitivity", when: "answered 1 or 2 (the situation did not feel believable)" },
  "recognition.real_fire": { rule: "sensitivity", when: "yes (reminded of a real fire), whatever was recognised" },
  "recognition.what": { rule: "exclude", when: "the fire itself, its rescue department or its units recognised (parity P-6; the course of events alone: sensitivity)" },
  "prior.demo": { rule: "exclude", when: "the web demonstration, the game mode or both used before the session (parity P-12)" },
  "reliability.answers": { rule: "exploratory", when: "perceived reliability against the log's (`31` proposal (a))" },
  "reliability.projection": { rule: "exploratory", when: "perceived reliability of the projection against its flags (`31` proposal (a))" },
};

export const POST_ITEMS: readonly QuestionnaireItem[] = [
  { id: RETENTION_ITEM_ID, section: "recall", kind: "retention" },
  { id: "ai.directive_relation", section: "recall", kind: "choice", options: ["yes", "no", "dont_know"], cells: THINKER_CELLS },
  { id: "directive.fit", section: "recall", kind: "choice", options: ["fitted", "not_at_times", "not_mostly", "dont_know"] },
  ...SOURCE_ITEMS,
  tlx("tlx.mental"), tlx("tlx.physical"), tlx("tlx.temporal"), tlx("tlx.performance"), tlx("tlx.effort"), tlx("tlx.frustration"),
  scale7("fatigue.end", "session"),
  scale7("picture.quality", "session"),
  scale7("picture.trust", "session"),
  scale7("tools.trust", "session"),
  scale7(ATTENTION_CHECK_ID, "session"),
  scale7("thinker.trust", "session", THINKER_CELLS),
  { id: "last.possibilities", section: "session", kind: "choice", options: ["1", "2", "3", "4", "5plus"] },
  { id: "last.basis", section: "session", kind: "multi", options: BASIS_OPTIONS, fixedLast: ["other"] },
  { id: "last.basis.main", section: "session", kind: "pick_from", from: "last.basis" },
  { id: "disagreement.recall", section: "session", kind: "choice", options: yesNoUnsure },
  { id: "disagreement.action", section: "session", kind: "multi", options: ACTION_OPTIONS, exclusive: "nothing", fixedLast: ["nothing"], showIf: { itemId: "disagreement.recall", equals: "yes" } },
  { id: "felt.wrong", section: "session", kind: "choice", options: yesNoUnsure },
  { id: "prior.knowledge", section: "session", kind: "choice", options: yesNoUnsure },
  // `31` §3.10 (parity P-6, P-12; sagat proposal (a)): the sample's guards and the perceived reliability, every cell. DRAFT, native check.
  scale7("believability", "session"),
  { id: "recognition.real_fire", section: "session", kind: "choice", options: yesNoUnsure },
  { id: "recognition.what", section: "session", kind: "multi", options: [{ id: "fire" }, { id: "department" }, { id: "units" }, { id: "course" }], showIf: { itemId: "recognition.real_fire", equals: "yes" } },
  { id: "prior.demo", section: "session", kind: "choice", options: ["no", "demo", "game", "both", "unsure"] },
  { id: "reliability.answers", section: "session", kind: "choice", options: ["lt25", "m25_50", "m50_75", "gt75", "no_use"] },
  { id: "reliability.projection", section: "session", kind: "choice", options: ["rarely", "sometimes", "mostly", "always"] },
  { id: "role.rank", section: "background", kind: "choice", options: ["crew", "crew_commander", "platoon_commander", "duty_chief", "student", "other"] },
  { id: "years.service", section: "background", kind: "number", min: 0, max: 50 },
  { id: "incidents.commanded", section: "background", kind: "choice", options: ["none", "1_5", "6_20", "21_50", "over_50"] },
  { id: "sim.exposure", section: "background", kind: "choice", options: ["none", "1_2", "3_10", "over_10"] },
  scale7("region.familiarity", "background"),
  { id: "service.country", section: "background", kind: "choice", options: ["finland", "other"] },
  scale7("terms.familiarity", "background"),
];

/** Every item of every questionnaire (for the texts' coverage and the review packet). */
export const ALL_QUESTIONNAIRE_ITEMS: readonly QuestionnaireItem[] = [...PRE_ITEMS, ...POST_ITEMS];

/**
 * A questionnaire's items for a cell, in the order shown; multi items' options filtered for the cell
 * and, given the participant's `seed`, in the participant's order (without it, the authored order).
 */
export function questionnaireItems(id: QuestionnaireId, cell: Cell, seed?: OptionOrderSeed): readonly QuestionnaireItem[] {
  return resolveItems((id === "pre" ? PRE_ITEMS : POST_ITEMS).filter((it) => !it.cells || it.cells.includes(cell)), cell, seed);
}

function resolveItems(items: readonly QuestionnaireItem[], cell: Cell, seed: OptionOrderSeed | undefined): QuestionnaireItem[] {
  return items.map((item) => {
    if (item.kind === "choice" && item.optionCells) {
      const cells = item.optionCells;
      return { ...item, options: item.options.filter((o) => !cells[o] || cells[o]!.includes(cell)) };
    }
    if (item.kind !== "multi") return item;
    const inCell = item.options.filter((o) => !o.cells || o.cells.includes(cell));
    const ids = seed ? participantOptionOrder(inCell.map((o) => o.id), item.fixedLast ?? [], seed, item.id) : inCell.map((o) => o.id);
    return { ...item, options: ids.map((oid) => inCell.find((o) => o.id === oid)!) };
  });
}

/** The multi items' option orders as shown (logged with `questionnaire_presented`). */
export function multiOptionOrders(items: readonly QuestionnaireItem[]): { readonly itemId: string; readonly optionIds: readonly string[] }[] {
  return items.flatMap((i) => (i.kind === "multi" ? [{ itemId: i.id, optionIds: i.options.map((o) => o.id) }] : []));
}

/**
 * The retention item's option order (SPEC/27 §4.1 "options reordered"): the hinge check's order
 * rotated by two, so no option stands where it stood at the hinge. Fixed, the same for everyone.
 */
export function retentionOrder<T>(hingeOrder: readonly T[]): T[] {
  const k = hingeOrder.length > 2 ? 2 : hingeOrder.length > 1 ? 1 : 0;
  return [...hingeOrder.slice(k), ...hingeOrder.slice(0, k)];
}

export type QuestionnaireValue = string | number | readonly string[] | null;
export type QuestionnaireAnswer = {
  readonly itemId: string;
  readonly value: QuestionnaireValue;
  /** Multi items: the option ids in the order shown (the value lists the ticked ones in that order). */
  readonly optionOrder?: readonly string[];
  /** The item's condition was not met (`showIf`, or fewer than two ticked for `pick_from`): not shown, value null. */
  readonly notShown?: true;
};

type Given = Readonly<Record<string, QuestionnaireValue | undefined>>;

/** Whether an item is on screen given the answers so far: its `showIf` met; a `pick_from` with two or more ticked in its source. */
export function itemShown(item: QuestionnaireItem, given: Given): boolean {
  if (item.showIf && given[item.showIf.itemId] !== item.showIf.equals) return false;
  if (item.kind === "pick_from") {
    const from = given[item.from];
    return Array.isArray(from) && from.length >= 2;
  }
  return true;
}

const isBlank = (raw: QuestionnaireValue | undefined) => raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);

/**
 * The answers as logged: one per item of the questionnaire, in the order shown, each checked against
 * its item (an unknown item, an option not offered, a number out of range, an exclusive option with
 * another, or an answer to an item not shown is refused); an item without an answer is null.
 * `retentionOptions` are the hinge check's option ids.
 */
export function checkQuestionnaireAnswers(items: readonly QuestionnaireItem[], given: Given, retentionOptions: readonly string[] = []): QuestionnaireAnswer[] {
  const known = new Set(items.map((i) => i.id));
  for (const id of Object.keys(given).sort()) if (!known.has(id)) throw new RangeError(`questionnaire: "${id}" is not an item shown`); // determinism-lint-allow: sorted keys, validation only
  return items.map((item): QuestionnaireAnswer => {
    const raw = given[item.id];
    const order = item.kind === "multi" ? { optionOrder: item.options.map((o) => o.id) } : {};
    if (!itemShown(item, given)) {
      if (!isBlank(raw)) throw new RangeError(`questionnaire: ${item.id} was not shown`);
      return { itemId: item.id, value: null, ...order, notShown: true };
    }
    if (isBlank(raw)) return { itemId: item.id, value: null, ...order };
    switch (item.kind) {
      case "choice":
        if (typeof raw !== "string" || !item.options.includes(raw)) throw new RangeError(`questionnaire: "${String(raw)}" is not an option of ${item.id}`);
        return { itemId: item.id, value: raw };
      case "retention":
        if (typeof raw !== "string" || !retentionOptions.includes(raw)) throw new RangeError(`questionnaire: "${String(raw)}" is not an option of ${item.id}`);
        return { itemId: item.id, value: raw };
      case "scale":
      case "number":
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < item.min || raw > item.max) throw new RangeError(`questionnaire: ${String(raw)} is out of range for ${item.id}`);
        return { itemId: item.id, value: raw };
      case "multi": {
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) throw new RangeError(`questionnaire: ${item.id} takes a list of options`);
        const ids = order.optionOrder!;
        if (new Set(raw).size !== raw.length) throw new RangeError(`questionnaire: ${item.id} lists an option twice`);
        for (const v of raw) if (!ids.includes(v)) throw new RangeError(`questionnaire: "${v}" is not an option of ${item.id}`);
        if (item.exclusive !== undefined && raw.includes(item.exclusive) && raw.length > 1) throw new RangeError(`questionnaire: "${item.exclusive}" in ${item.id} is the only answer when chosen`);
        return { itemId: item.id, value: ids.filter((id) => raw.includes(id)), ...order };
      }
      case "pick_from": {
        const from = given[item.from] as readonly string[];
        if (typeof raw !== "string" || !from.includes(raw)) throw new RangeError(`questionnaire: "${String(raw)}" was not ticked in ${item.from}`);
        return { itemId: item.id, value: raw };
      }
    }
  });
}
