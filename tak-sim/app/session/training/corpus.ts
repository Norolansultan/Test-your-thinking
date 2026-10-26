/**
 * The training incident's corpus (SPEC/08 (bp) §bp.6): twelve records, ids `trn.r01`–`trn.r12`, one world-state step (−9), sources
 * EK51, EK52 and DR8 only, built from `content/training/corpus.json` by the session's own `trafficAtom` (the Finnish; the English is
 * `content/training/records.en.json`, looked up by id as every record's, `app/i18n/text.ts`). They are never part of the session's
 * corpus, and the session's records are never part of the training's Haku (`14` (bp)). Five are pushed (T1: the message log shows
 * them); seven are recorded only (T2 filed; T3 filed when asked). Also here: the pre-recorded questions the lessons and S5 quote.
 */

import corpus from "../../../content/training/corpus.json" with { type: "json" };
import { trafficAtom } from "../../scenario/traffic-atoms.js";
import type { ActorType, EventType, InfoAtom, InteractionEvent, NavCategoryId } from "../../scenario/types.js";
import type { Tier } from "../../engine/primitives.js";
import { logRowOf } from "../message-history.js";
import type { RadioLogEntry } from "../snapshot.js";

/** The training's view: before the main session's practice view, one step. */
export const TRAINING_VIEW = { startsAtVirtual: -12_000, steps: 1 } as const;
/** The training's world-state step (never a main-session step). */
export const TRAINING_STEP = -9;
/** The training's "now", 10.18. */
export const TRAINING_NOW_S = -10_920;

/** A clock ("09.41" or "09:41") in virtual seconds on the session's scale (13.20 = 0). */
export function trainingClockS(hhmm: string): number {
  const [h, m] = hhmm.split(/[.:]/).map(Number) as [number, number];
  return (h * 60 + m - (13 * 60 + 20)) * 60;
}

interface CorpusRow {
  readonly id: string; readonly clock: string; readonly source: string; readonly actorType: string; readonly tier: string;
  readonly channel: string; readonly eventType: string; readonly nav: string; readonly fi: string; readonly at: { readonly lat: number; readonly lon: number };
}

function eventOf(r: CorpusRow): InteractionEvent {
  return {
    id: r.id, cycle: TRAINING_STEP, session_view: 0, sim_time_s: trainingClockS(r.clock), timestamp: `${r.clock.replace(".", ":")}:00`,
    actor: r.source, actor_type: r.actorType as ActorType, addressee: null, location: null, place: null, lat: r.at.lat, lon: r.at.lon,
    event_type: r.eventType as EventType, task: null, content: r.fi, tier: r.tier as Tier, channel: r.channel as InteractionEvent["channel"],
    nav: r.nav as NavCategoryId, lang: "fi",
  };
}

export const TRAINING_ATOMS: readonly InfoAtom[] = (corpus.records as readonly CorpusRow[]).map((r) => trafficAtom(eventOf(r)));

/** The log rows shown up to a clock ("10.18" or "10:18"): the pushed records by clock, as the session's log draws them (`logRowOf`). */
export function trainingLogRows(untilHhmm: string): RadioLogEntry[] {
  const until = trainingClockS(untilHhmm);
  return TRAINING_ATOMS.filter((a) => a.tier === "T1_pushed" && (a.provenance.deliveredAt ?? a.provenance.observedAt) <= until)
    .sort((a, b) => (a.provenance.observedAt - b.provenance.observedAt) || (a.id < b.id ? -1 : 1))
    .map((a) => logRowOf(a).row);
}

/**
 * The pre-recorded questions (fi DRAFT / en): the lessons of S3's and S4's feedback ("a Search question such as …") and S5's two
 * examples. `recordIds` are what the question retrieves first, in order (`test/training/retrieval.spec.ts`); the limitation case
 * retrieves nothing that answers it.
 */
export const TRAINING_QUESTIONS: Readonly<Record<string, { readonly fi: string; readonly en: string; readonly recordIds: readonly string[] }>> = {
  "trn.q.dr8_1005": { fi: "Mitä DR8 ilmoitti klo 10.05?", en: "What did DR8 report at 10.05?", recordIds: ["trn.r06"] },
  "trn.q.r6_passable": { fi: "Onko tie R6 ajettavissa?", en: "Is road R6 passable?", recordIds: ["trn.r02", "trn.r09"] },
  "trn.q.ek51_crew": { fi: "Kuinka suuri EK51:n miehistö on?", en: "How large is EK51's crew?", recordIds: ["trn.r07"] },
  "trn.q.ek52_water": { fi: "Paljonko vettä EK52:lla on?", en: "How much water does EK52 have?", recordIds: ["trn.r10"] },
  "trn.q.under_control": { fi: "Onko palo hallinnassa?", en: "Is the fire contained?", recordIds: [] },
};

/** A training record by id (the lessons quote them). */
export function trainingAtom(id: string): InfoAtom {
  const a = TRAINING_ATOMS.find((x) => x.id === id);
  if (!a) throw new Error(`training: no record ${id}`);
  return a;
}
