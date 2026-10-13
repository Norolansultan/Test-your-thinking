/**
 * The English of the generated records (session language "en", researcher decision 1 Oct 2026):
 * each step's traffic is generated twice — in Finnish (the corpus) and in English with the Finnish
 * run's choices replayed (`Tape`) — and the two runs must agree event for event, so an English
 * record always says what its Finnish record says. Radio messages (moves, crossings, stops, holds)
 * carry their English from the same place their Finnish comes from.
 *
 * The English lands in the bundle's `english` map (record id → text); the Finnish corpus is
 * unchanged. To reword the English of one record without touching the generator, use
 * `content/i18n/records.en.overrides.json` (`app/i18n/lang.ts`).
 */

import type { SiteRadio } from "../../app/scenario/site-scenario.js";
import type { InteractionEvent } from "../../app/scenario/types.js";
import { withLang } from "./traffic-text.js";
import { recordTape, replayTape, type TrafficEvent } from "./traffic-types.js";

/** Runs one step's generator in Finnish then in English (choices replayed); throws if the runs differ. */
export function bilingual(n: number, run: (tape: ReturnType<typeof recordTape>, lang: "fi" | "en") => TrafficEvent[]): { fi: TrafficEvent[]; en: TrafficEvent[] } {
  const tape = recordTape();
  const fi = run(tape, "fi");
  const en = withLang("en", () => run(replayTape(tape), "en"));
  const key = (e: TrafficEvent) => `${e.offsetS}|${e.actor}|${e.addressee}|${e.tier}|${e.channel}|${e.event_type}|${e.nav}`;
  if (fi.length !== en.length || fi.some((e, k) => key(e) !== key(en[k]!))) {
    const k = fi.findIndex((e, i) => !en[i] || key(e) !== key(en[i]!));
    throw new Error(`step ${n}: the English traffic differs from the Finnish at event ${k} (${fi[k] ? key(fi[k]!) : "—"} vs ${en[k] ? key(en[k]!) : "—"})`);
  }
  return { fi, en };
}

/** The English by record id of one step's events (the ids `toInteractionEvents` gives the Finnish run). */
export function englishById(events: readonly InteractionEvent[], en: readonly TrafficEvent[]): Record<string, string> {
  return Object.fromEntries(events.map((e, k) => [e.id, en[k]!.content]));
}

/** The English Finnish-authored hold lines (`scenario-18.ts` `radioFi`) are said in. DRAFT translation. */
const HOLD_EN: Readonly<Record<string, string>> = {
  "Palo yritti ylittää tien R1 kärjen kohdalla puuskissa. Kastelimme tien pohjoisreunan, ylitys pysäytetty. Linja pitää.":
    "The fire tried to cross road R1 at the head in the gusts. We wetted the north verge of the road and stopped the crossing. The line holds.",
};
export const holdEn = (fi: string): string => HOLD_EN[fi] ?? fi;

/** The radio atoms' English, by the id `demo-map.ts` gives them (`atom.radio.<step>.<k>`, in bundle order). */
export function radioEnglish(radio: readonly (SiteRadio & { readonly textEn?: string })[]): Record<string, string> {
  const k = new Map<number, number>();
  const out: Record<string, string> = {};
  for (const r of radio) {
    const i = k.get(r.cycle) ?? 0;
    k.set(r.cycle, i + 1);
    if (r.textEn) out[`atom.radio.${r.cycle}.${i}`] = r.textEn;
  }
  return out;
}

/** The bundle's radio without the English (it goes to `english`). */
export const withoutEnglish = (radio: readonly (SiteRadio & { readonly textEn?: string })[]): SiteRadio[] => radio.map(({ textEn: _en, ...r }) => r);
