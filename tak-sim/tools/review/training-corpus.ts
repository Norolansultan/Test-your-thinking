/**
 * The training incident's corpus (SPEC/08 (bp) §bp.6): the authored templates of `content/training/corpus.json` filled with the words
 * the site's geometry gives (the fire's side of R5, its spread, the lake's side, the tail's edge, R6's direction from the junction),
 * the English written to `records.en.json` by id, and the S3/S4 keys read from the records (never typed): the survey's area and rate,
 * the newest report on R6, EK51's crew, who reported the head at R5. Every check throws when it fails.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LatLon } from "../../app/engine/primitives.js";

export type Tier = "T1_pushed" | "T2_system" | "T3_person";
export interface CorpusRecord {
  readonly id: string; readonly clock: string; readonly source: string; readonly actorType: string; readonly tier: Tier;
  readonly channel: string; readonly eventType: string; readonly nav: string; readonly place: string;
  readonly template: { readonly fi: string; readonly en: string };
  readonly fi?: string; readonly at?: LatLon;
}
export interface CorpusFile { readonly about: string; readonly step: number; readonly records: readonly CorpusRecord[] }

export function readCorpus(root: string): CorpusFile {
  return JSON.parse(readFileSync(join(root, "content/training/corpus.json"), "utf8")) as CorpusFile;
}

/** Compass words: 8 points from north; the illative of movement, the side ("-puolella" / "… of") and an edge ("-reunaan" / "… edge"). */
const POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Point8 = (typeof POINTS)[number];
const FI_STEM: Record<Point8, string> = { n: "pohjois", ne: "koillis", e: "itä", se: "kaakkois", s: "etelä", sw: "lounais", w: "länsi", nw: "luoteis" };
const FI_TO: Record<Point8, string> = { n: "pohjoiseen", ne: "koilliseen", e: "itään", se: "kaakkoon", s: "etelään", sw: "lounaaseen", w: "länteen", nw: "luoteeseen" };
const EN: Record<Point8, string> = { n: "north", ne: "north-east", e: "east", se: "south-east", s: "south", sw: "south-west", w: "west", nw: "north-west" };

export const compassWords = (p: Point8) => ({ fiTo: FI_TO[p], fiSide: `${FI_STEM[p]}puolella`, fiEdge: `${FI_STEM[p]}reunaan`, en: EN[p] });

/** A bearing as one of `n` compass points (4 or 8), with its margin from the nearest boundary; throws when under `minMargin`. */
export function compassPoint(deg: number, n: 4 | 8, minMargin: number, what: string): { readonly point: Point8; readonly marginDeg: number } {
  const step = 360 / n, b = ((deg % 360) + 360) % 360;
  const k = Math.round(b / step) % n;
  const marginDeg = step / 2 - Math.abs(((b - k * step + 540) % 360) - 180);
  if (marginDeg < minMargin) throw new Error(`training: ${what} at ${b.toFixed(1)}° lies ${marginDeg.toFixed(1)}° from a compass boundary (needs ${minMargin}°)`);
  return { point: POINTS[(k * 8) / n]!, marginDeg: Math.round(marginDeg * 10) / 10 };
}

export interface Wording { readonly lakeSide: Point8; readonly roadSide: Point8; readonly spread: Point8; readonly tailEdge: Point8; readonly r6Dir: Point8 }

/** The slot words of a template in a language. */
export function slotWords(w: Wording, lang: "fi" | "en"): Readonly<Record<keyof Wording, string>> {
  const c = (p: Point8) => compassWords(p);
  return lang === "fi"
    ? { lakeSide: c(w.lakeSide).fiSide, roadSide: c(w.roadSide).fiSide, spread: c(w.spread).fiTo, tailEdge: c(w.tailEdge).fiEdge, r6Dir: c(w.r6Dir).fiTo }
    : { lakeSide: `${c(w.lakeSide).en} of`, roadSide: `${c(w.roadSide).en} of`, spread: c(w.spread).en, tailEdge: c(w.tailEdge).en, r6Dir: c(w.r6Dir).en };
}

export function fill(template: string, words: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = words[k];
    if (v === undefined) throw new Error(`training corpus: no word for {${k}}`);
    return v;
  });
}

/** The corpus with `fi` and `at` filled, and the English by id. */
export function fillCorpus(c: CorpusFile, w: Wording, places: Readonly<Record<string, LatLon>>): { readonly corpus: CorpusFile; readonly en: Record<string, string> } {
  const fi = slotWords(w, "fi"), en = slotWords(w, "en");
  const ids = c.records.map((r) => r.id);
  const want = Array.from({ length: 12 }, (_, i) => `trn.r${String(i + 1).padStart(2, "0")}`);
  if (JSON.stringify(ids) !== JSON.stringify(want)) throw new Error(`training corpus: the ids must be ${want[0]}–${want.at(-1)} in order`);
  if (c.step !== -9) throw new Error("training corpus: the step must be −9");
  const records = c.records.map((r) => {
    const at = places[r.place];
    if (!at) throw new Error(`training corpus: ${r.id} has no place "${r.place}"`);
    if (!["EK51", "EK52", "DR8"].includes(r.source)) throw new Error(`training corpus: ${r.id}'s source ${r.source} is not EK51, EK52 or DR8`);
    return { id: r.id, clock: r.clock, source: r.source, actorType: r.actorType, tier: r.tier, channel: r.channel, eventType: r.eventType, nav: r.nav, place: r.place, template: r.template, fi: fill(r.template.fi, fi), at };
  });
  return { corpus: { about: c.about, step: c.step, records }, en: Object.fromEntries(records.map((r) => [r.id, fill(r.template.en, en)])) };
}

const rec = (c: CorpusFile, id: string) => c.records.find((r) => r.id === id)!;
const text = (c: CorpusFile, id: string) => rec(c, id).fi!;
const num = (s: string) => Number(s.replace(",", "."));
const FI_NUMBERS: Readonly<Record<string, number>> = { kaksi: 2, kolme: 3, neljä: 4, viisi: 5, kuusi: 6 };

/** The S3 and S4 keys and their lures, read from the filled corpus (SPEC/08 (bp) §bp.4 items 7–9, 11, 13). */
export function corpusKeys(c: CorpusFile) {
  const pushed = (id: string) => rec(c, id).tier === "T1_pushed";
  const must = (ok: boolean, why: string) => { if (!ok) throw new Error(`training corpus: ${why}`); };
  // 7. the survey's area (r06, recorded only); the log's 0.4 ha (r03, pushed) and the older 0.2 ha (r01) are the lures.
  const area = (id: string) => num(/noin (\d+,\d) ha/.exec(text(c, id))?.[1] ?? "NaN");
  const records1 = { key: area("trn.r06"), lureLog: area("trn.r03"), lureOlder: area("trn.r01") };
  must(!pushed("trn.r06") && pushed("trn.r03") && !pushed("trn.r01"), "s3.records1's key must be recorded only and its log lure pushed");
  // 8. R6: the newest report (pushed) against the older record that a question about R6 retrieves first.
  const r6 = c.records.filter((r) => /tie R6/.test(r.fi!)).sort((a, b) => a.clock.localeCompare(b.clock));
  const newest = r6.at(-1)!, oldest = r6[0]!;
  must(newest.id === "trn.r09" && pushed("trn.r09") && /tukossa/.test(newest.fi!) && oldest.id === "trn.r02" && !pushed("trn.r02") && /ajettavissa/.test(oldest.fi!), "s3.older: R6's newest report must be r09 (blocked, pushed) and its oldest r02 (passable, recorded)");
  // 9. EK51's crew when asked (r07, recorded only) against the log's "two men on the line" (r05, pushed).
  const crew = FI_NUMBERS[/miehistö (\p{L}+)/u.exec(text(c, "trn.r07"))?.[1] ?? ""];
  const onLine = FI_NUMBERS[/(\p{L}+) miestä linjalla/u.exec(text(c, "trn.r05"))?.[1] ?? ""];
  must(crew !== undefined && onLine !== undefined && !pushed("trn.r07") && pushed("trn.r05"), "s3.records2: EK51's crew (r07, recorded) and the men on the line (r05, pushed)");
  // 11. who reported the head at R5 (r08, pushed); the other callers.
  const head = c.records.filter((r) => /kärki on nyt tiellä R5/.test(r.fi!));
  must(head.length === 1 && head[0]!.id === "trn.r08" && pushed("trn.r08"), "s4.log: one pushed record puts the head at R5");
  const callers = [...new Set(c.records.map((r) => r.source))].sort();
  // 13. the survey's rate.
  const rate = num(/noin (\d+) m\/min/.exec(text(c, "trn.r06"))?.[1] ?? "NaN");
  must(Number.isFinite(records1.key) && Number.isFinite(rate), "the survey's area and rate");
  return { records1, older: { key: "blocked" as const, lure: "passable" as const, newest: newest.id, oldest: oldest.id }, records2: { key: crew!, lure: onLine! }, log: { key: head[0]!.source, callers }, ratePerMin: rate };
}
