/**
 * The English of scenario labels and records (`lang.ts` says where each lives). Finnish is always
 * the source and the fallback: a label or record without English is shown in Finnish, and
 * `test/i18n/coverage.spec.ts` lists every one that is missing.
 */

import labelsEn from "../../content/i18n/labels.en.json" with { type: "json" };
import authoredEn from "../../content/i18n/authored.en.json" with { type: "json" };
import overridesEn from "../../content/i18n/records.en.overrides.json" with { type: "json" };
import { SITE_SCENARIO } from "../scenario/site-scenario.js";
import type { Lang } from "./lang.js";

const LABELS: Readonly<Record<string, string>> = labelsEn;
/** Generated records (the bundle's `english`), then the authored ones, then the hand overrides, which win. */
const RECORDS: Readonly<Record<string, string>> = { ...(SITE_SCENARIO.english ?? {}), ...authoredEn, ...overridesEn };

/** A scenario label, question or option (given in Finnish) in the session language. */
export function tr(lang: Lang, fi: string): string {
  return lang === "en" ? LABELS[fi] ?? fi : fi;
}

/**
 * A source's name as shown (Haku's source list, its results, the message log) in the session language
 * (researcher decision 6 Oct 2026): the Finnish word-names (SAA, JOHTOPAIKKA, VPK, P2 …) have English in
 * `labels.en.json`; unit call signs (EK11, DR1 …) have none and stay as they are. Display only: retrieval
 * and the logged data keep the source id.
 */
export function sourceName(lang: Lang, sourceId: string): string {
  return lang === "fi" ? SOURCE_NAME_FI[sourceId] ?? sourceId : tr(lang, sourceId);
}

/**
 * Finnish display names where the source id misreads (SPEC/31 §2.3, display only; the ids, retrieval and the logs keep them):
 * radio TE-12, "SAA" reads as the verb *saa*; CS-06, one spelling "drooni" (the roster and the briefing).
 */
const SOURCE_NAME_FI: Readonly<Record<string, string>> = { SAA: "Sääasema", DRONERYHMÄ: "Drooniryhmä" };

/** Whether a Finnish label has an English version. */
export function hasLabelEn(fi: string): boolean {
  return LABELS[fi] !== undefined;
}

/** The English text of a record, by id, or undefined when it has none yet. */
export function recordEn(id: string): string | undefined {
  return RECORDS[id];
}

/** A record's text in the session language: the English by id, else the Finnish. */
export function recordIn(lang: Lang, id: string, fi: string): string {
  return lang === "en" ? RECORDS[id] ?? fi : fi;
}
