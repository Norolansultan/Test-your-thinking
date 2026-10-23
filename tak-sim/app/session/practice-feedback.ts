/**
 * The practice feedback screen (difficulty audit, 23 Oct 2026; `docs/audits/2026-10-23-difficulty/proposal.md` (b.3) and
 * `proposal-map.md` c.3), shown once after the practice view VP ends and before the training text, in both groups and both audiences.
 * Split out of `orchestrator.ts`, which owns the step (`practice_feedback`).
 *
 * SOURCE-ONLY (the researcher's choice of the two variants in (g.3), so that SPEC/32 §1's "no outcome feedback in the session" holds):
 * for each practice-freeze item it says WHERE its information could be found — the message log (with the messages' senders and times),
 * the map, the records through Haku, or worked out from the log and the map — and never which option was right or whether the
 * participant's answer was. Practice only: no scored freeze or SPAM item ever gets feedback.
 *
 * The two practice map tasks (`proposal-map.md` c.3) are the exception the researcher asked for, and they teach a SKILL, not the
 * situation: the head mark is shown beside the head of the fire as the practice map drew it (the drawn outline's furthest point
 * downwind; never the CA truth, invariant I4), and the measuring task states the measured distance and how the measure tool works.
 *
 * Everything here is computed from the scenario's practice view, which is identical for every participant; the only participant input
 * is their own head mark. Logged by the orchestrator: `practice_feedback_shown {itemIds}` when shown, `briefing_advanced`
 * "practice.feedback" with its dwell when left.
 */

import type { LatLon } from "../engine/primitives.js";
import { PRACTICE_MEASURE } from "../scenario/practice-measure.js";
import type { ScenarioContract } from "../scenario/types.js";
import type { LogRecord } from "../telemetry/log.js";
import type { FreezeSubmittedDetail } from "../telemetry/record-kinds.js";
import { recordClockLabel } from "./message-history.js";

/** The screen's id in `briefing_advanced` when it is left (with its dwell, as the primer's and the training's). */
export const PRACTICE_FEEDBACK_SCREEN_ID = "practice.feedback";

/** Where a practice item's information could be found. */
export type PracticeSource = "log" | "map" | "records" | "worked_out";

export interface PracticeFeedbackRecord {
  /** The record's source id (shown by `sourceName`) and its clock, as the message log lists it. */
  readonly sourceId: string;
  readonly clockLabel: string;
}

export interface PracticeFeedbackItem {
  readonly itemId: string;
  /** The item's question (Finnish; its English by `tr`): the screen names the question, never its answer. */
  readonly promptFi: string;
  readonly source: PracticeSource;
  /** The records the item's information was in (none for a map or a worked-out item), in time order. */
  readonly records: readonly PracticeFeedbackRecord[];
  /** A records item: an example question that finds it with Haku (`EXAMPLE_QUESTIONS`). */
  readonly exampleQuestion: { readonly fi: string; readonly en: string } | null;
}

export interface PracticeFeedbackView {
  readonly items: readonly PracticeFeedbackItem[];
  /** The head-mark task: the participant's mark (null when not placed), the head as the practice map drew it, and the drawn outline. */
  readonly head: { readonly mark: LatLon | null; readonly head: LatLon; readonly outline: readonly LatLon[] };
  /** The measuring task: the measured distance (rounded, km) and its direction from the fire. */
  readonly measure: { readonly km: number; readonly directionFi: string; readonly directionEn: string };
}

/** An example question per records item (`proposal.md` (b.3)); its Haku ranks the record first (the audit's lexical check). DRAFT. */
const EXAMPLE_QUESTIONS: Readonly<Record<string, { readonly fi: string; readonly en: string }>> = {
  "freeze.practice.forecast": { fi: "Mikä on sääennuste?", en: "What is the weather forecast?" },
};

/** The head of the drawn practice fire: the vertex of its head edge (else of its outline) furthest downwind of the observed wind. */
export function drawnHeadOf(spec: ScenarioContract["practice"]["cycle"]): { readonly head: LatLon; readonly outline: readonly LatLon[] } {
  const outline = spec.perimeter[0] ?? [];
  const headLine = spec.fire.perimeter_current.filter((s) => s.is_head).flatMap((s) => s.line);
  const candidates = headLine.length > 0 ? headLine : outline;
  if (candidates.length === 0) throw new Error("practice feedback: the practice view draws no fire");
  const to = ((spec.wind.fromDeg + 180) % 360) * (Math.PI / 180);
  const along = (p: LatLon) => (p.lat * Math.cos(to)) + (p.lon * Math.cos((p.lat * Math.PI) / 180) * Math.sin(to));
  const head = candidates.reduce((best, p) => (along(p) > along(best) ? p : best));
  return { head, outline };
}

/** The practice freeze's head item (`freeze-bank.ts` PRACTICE_BANK `head_now`). */
export const PRACTICE_HEAD_ITEM_ID = "freeze.practice.head_now";

/** The participant's practice head mark from the log (the last practice `freeze_submitted`), or null when none was placed. */
export function practiceHeadMarkOf(records: readonly LogRecord[]): LatLon | null {
  let mark: LatLon | null = null;
  for (const r of records) {
    if (r.kind !== "freeze_submitted") continue;
    const d = r.detail as FreezeSubmittedDetail;
    if (d.cycle !== 0) continue;
    mark = d.responses.find((x) => x.itemId === PRACTICE_HEAD_ITEM_ID)?.point ?? null;
  }
  return mark;
}

/** The feedback screen's content for the practice view, with the participant's head mark (null when they placed none). */
export function practiceFeedbackView(scenario: ScenarioContract, headMark: LatLon | null): PracticeFeedbackView {
  const practice = scenario.practice;
  const pushed = new Set(practice.cycle.pushedAtomIds);
  const items = practice.freeze.items.map((it): PracticeFeedbackItem => {
    const atoms = (it.keyAtomIds ?? []).map((id) => scenario.atoms.find((a) => a.id === id)).filter((a) => a !== undefined);
    const source: PracticeSource = (it.kind ?? "choice") === "map_point" ? "map"
      : atoms.length === 0 ? "worked_out"
      : atoms.every((a) => pushed.has(a.id)) ? "log" : "records";
    const records = source === "log" || source === "records"
      ? atoms.filter((a) => source === "records" || pushed.has(a.id)).map((a) => ({ sourceId: a.provenance.sourceId, clockLabel: recordClockLabel(a) }))
        .sort((a, b) => (a.clockLabel < b.clockLabel ? -1 : a.clockLabel > b.clockLabel ? 1 : 0))
      : [];
    return { itemId: it.id, promptFi: it.promptFi, source, records, exampleQuestion: source === "records" ? EXAMPLE_QUESTIONS[it.id] ?? null : null };
  });
  const { head, outline } = drawnHeadOf(practice.cycle);
  return { items, head: { mark: headMark, head, outline }, measure: { km: PRACTICE_MEASURE.keyKm, directionFi: PRACTICE_MEASURE.directionFi, directionEn: PRACTICE_MEASURE.directionEn } };
}
