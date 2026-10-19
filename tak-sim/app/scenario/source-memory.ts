/**
 * SPEC/30 §5.5 (19 Oct 2026): the source-memory facts — seven true facts from the session that both groups could know, asked
 * after the session ("Where did this come from for you?"; `questionnaire.ts`, block `source`). With the log they measure
 * misattribution: knowledge an AI answer supplied, remembered as one's own or as read in a report (`source-memory-measures.ts`).
 *
 * All seven are from phase A (V1–V7), mixing facts an AI answer would likely state when asked the usual questions (the head's
 * rate, the forecast, the burned area) with facts only in the records (a spot fire, a reinforcement's arrival, a pump's fuel)
 * or on the map (where Mökkiranta lies). No freeze or SPAM prompt or option states any of them, so a participant cannot have
 * learnt one from a probe (the forecast record is evidence behind V5's wind items and V6's second SPAM item, never stated in
 * them); none names a designed event (the questionnaire comes before the debrief).
 *
 * Each fact: its statement (fi, en), the records it rests on (found by content: generated ids shift when the traffic is
 * regenerated; a missing or ambiguous record fails the build), and `keyStatements` — regular-expression sources, matched
 * case-insensitively against AI answer text, that would detect an answer stating the fact (as the freeze items' keyStatements).
 *
 * `31` F17 (19 Oct 2026): nine facts. The facts an AI answer would likely state are now recorded-only (no pushed record states them)
 * and cued by no probe — the 14.00–14.20 head rate (pushed to everyone) stays as a `pushed` control, the pushed 15.35 area is gone, and
 * the forecast's turn is swapped (V5's `ek14_shelter` named it, F07) — and two false lure facts, stated by no record, separate recognition
 * from acquiescence: their only right answer is "I did not know this". `SOURCE_ANSWER_CLASS` defines the scoring where the sources
 * overlap (Haku's results are records).
 *
 * DRAFT: facts, wording and patterns for the domain and native-speaker review (SPEC/30 §8).
 */

import type { CycleIndex } from "../engine/primitives.js";
import { CYCLE_STORY } from "./demo-story.js";
import { SITE_SCENARIO } from "./site-scenario.js";

/**
 * Where the fact sat in the session, by design (an analysis covariate, not shown): `ai_likely` — an AI answer would likely state it, and
 * only recorded (searchable) records do; `pushed` — the stream gave it to everyone (a control); `record_only` — in the records, an AI
 * unlikely to state it; `map` — on the map; `lure` — FALSE: no record states it (`31` F17).
 */
export type SourceMemoryExpected = "ai_likely" | "pushed" | "record_only" | "map" | "lure";

export interface SourceMemoryFact {
  /** The item id is `source.<id>`. */
  readonly id: string;
  readonly statementFi: string;
  readonly statementEn: string;
  /** TRUTH: the records the fact rests on (pushed or recorded), by id; none for a lure. */
  readonly atomIds: readonly string[];
  /** Regular-expression sources that detect an AI answer stating the fact, per session language. */
  readonly keyStatements: { readonly fi: readonly string[]; readonly en: readonly string[] };
  readonly expected: SourceMemoryExpected;
  /** The view whose records first carry the fact. */
  readonly view: number;
}

/** TRUTH: the one record of `step` whose text matches `re` (traffic, crew radio or story bubble); none or several throws. */
function recordAt(step: number, re: RegExp): string {
  const ids = [
    ...SITE_SCENARIO.traffic.filter((x) => x.cycle === step && re.test(x.content)).map((x) => x.id),
    ...SITE_SCENARIO.radio.filter((r) => r.cycle === step).flatMap((r, k) => (re.test(r.text) ? [`atom.radio.${step}.${k}`] : [])),
    ...(CYCLE_STORY[step as CycleIndex]?.bubbles ?? []).flatMap((b, k) => (re.test(b.text) ? [`atom.demo.${step}.${k}`] : [])),
  ];
  if (ids.length !== 1) throw new Error(`source-memory fact: step-${step} pattern ${re} matches ${ids.length} records`);
  return ids[0]!;
}

/** Up to `n` characters within one sentence: anything but a full stop, which may still stand inside a number ("2.1 km"). */
const S = (n: number): string => `(?:[^.]|\\.(?=\\d)){0,${n}}`;
const M_FI = "(?:m\\b|metri)", M_EN = "(?:m\\b|met(?:re|er))";

export const SOURCE_MEMORY_FACTS: readonly SourceMemoryFact[] = [
  {
    // `31` F17: pushed to everyone (DR1's 14.25 thermal image), so misattribution of an AI's statement cannot be told from reading it: a control.
    id: "head_rate_1420", view: 3, expected: "pushed",
    statementFi: "Klo 14.00–14.20 palon kärki eteni koilliseen noin 10,6 metriä minuutissa.",
    statementEn: "Between 14.00 and 14.20 the head of the fire spread north-east at about 10.6 metres a minute.",
    atomIds: [recordAt(4, /^DR1 lämpökuva, kärki klo 14\.25: reuna etenee koilliseen noin 10,6 m\/min/), recordAt(4, /^DR1 mittaus: kärjen etenemä 210 m klo 14\.00–14\.20/)],
    keyStatements: { fi: ["10[,.]6\\s*(?:m\\/min|metri\\S* minuuti)"], en:["10\\.6\\s*(?:m\\/min|m per min|met(?:re|er)s? (?:a|per) minute)"] },
  },
  {
    // `31` F17: replaces the forecast's south-east turn (V5's ek14_shelter named it, F07). Recorded only: DR3's smoke-column logs (T2).
    id: "smoke_visibility", view: 2, expected: "ai_likely",
    statementFi: "Savu laskeutui palon koillispuolelle, ja näkyvyys siellä oli alle 100 metriä.",
    statementEn: "The smoke settled on the north-east side of the fire, and visibility there was under 100 metres.",
    atomIds: [recordAt(2, /^DR3 savupatsas: .*Savu laskeutuu palon koillispuolelle, näkyvyys siellä alle 100 m/), recordAt(3, /^DR3 savupatsas: .*Savu laskeutuu palon koillispuolelle, näkyvyys siellä alle 100 m/)],
    keyStatements: {
      fi: [`koillis${S(80)}näkyvyy\\w*${S(40)}alle 100\\s*${M_FI}`, `näkyvyy\\w*${S(40)}alle 100\\s*${M_FI}${S(80)}koillis`],
      en: [`north-?east${S(80)}visibility${S(40)}(?:under|below|less than) 100\\s*${M_EN}`, `visibility${S(40)}(?:under|below|less than) 100\\s*${M_EN}${S(80)}north-?east`],
    },
  },
  {
    // `31` F17: replaces the burnt area at 15.35 (pushed to everyone). Recorded only: DR1's and DR3's measurement logs (T2).
    id: "intensity_1440", view: 4, expected: "ai_likely",
    statementFi: "Klo 14.40–15.00 kärjen intensiteetti mitattiin luokkaan 5/5.",
    statementEn: "Between 14.40 and 15.00 the head's intensity was measured at class 5/5.",
    atomIds: [recordAt(6, /^DR1 mittaus: kärjen etenemä \d+ m klo 14\.40–15\.00 .*Intensiteettiluokka 5\/5/), recordAt(6, /^DR3 mittaus: Kuusimäen reunan etenemä \d+ m klo 14\.40–15\.00 .*Intensiteettiluokka 5\/5/)],
    keyStatements: { fi: ["(?<![\\d/])5\\s*\\/\\s*5(?![\\d/])"], en: ["(?<![\\d/])5\\s*\\/\\s*5(?![\\d/])"] },
  },
  {
    id: "pp3_600", view: 5, expected: "record_only",
    statementFi: "Pistepalo PP3 vahvistettiin noin 600 metriä kärjen edessä.",
    statementEn: "Spot fire SF3 was confirmed about 600 metres ahead of the head.",
    atomIds: [recordAt(7, /^DR1: pistepalo PP3 vahvistettu lämpökuvasta, noin 600 m kärjen edessä/)],
    keyStatements: {
      fi: [`PP3${S(80)}600\\s*${M_FI}`, `600\\s*${M_FI}\\w*${S(80)}PP3`],
      en: [`(?:SF3|PP3)${S(80)}600\\s*${M_EN}`, `600\\s*${M_EN}\\w*${S(80)}(?:SF3|PP3)`],
    },
  },
  {
    id: "ek15_arrival", view: 7, expected: "record_only",
    statementFi: "Vahvennusyksikkö EK15 saapui johtopaikalle noin klo 16.20.",
    statementEn: "The reinforcement unit EK15 arrived at the command post at about 16.20.",
    atomIds: [recordAt(10, /^EK15 saapunut johtopaikalle/), recordAt(10, /^EK15, johtopaikka: valmiina johtopaikalla/)],
    keyStatements: { fi: [`EK15${S(80)}(?:saapu|johtopaik)`, `(?:saapu\\w*|johtopaik\\w*)${S(60)}EK15`], en: [`EK15${S(80)}(?:arriv|command post)`, `(?:arriv\\w*|command post)${S(60)}EK15`] },
  },
  {
    id: "ek14_fuel", view: 5, expected: "record_only",
    statementFi: "EK14 pyysi bensiiniä moottoriruiskuunsa, jonka polttoaine oli loppumassa.",
    statementEn: "EK14 asked for petrol for its portable pump, which was running out of fuel.",
    atomIds: [recordAt(7, /^EK14 pohjoisreuna — moottoriruiskun polttoaine riittää noin 40 min/), recordAt(10, /^EK14 pohjoisreuna, Karhujärven puoli — moottoriruiskun polttoaine riittää noin 60 min/)],
    keyStatements: { fi: [`EK14${S(120)}(?:polttoaine|bensiini|bensaa)`, `(?:polttoaine|bensiini)\\w*${S(80)}EK14`], en: [`EK14${S(120)}(?:fuel|petrol|gasoline)`, `(?:fuel|petrol)${S(80)}EK14`] },
  },
  {
    id: "cabins_nw", view: 1, expected: "map",
    statementFi: "Mökkirannan mökit ovat Karhujärven rannalla, palosta luoteeseen.",
    statementEn: "The Lakeside Cottages are on the shore of Bear Lake, north-west of the fire.",
    atomIds: ["evt.vp.011", recordAt(1, /^Lähin asutus: Mökkiranta 2,1 km luoteeseen/)],
    keyStatements: {
      fi: [`Mökkiran\\w*${S(80)}luotee`, `luotee\\w*${S(80)}Mökkiran`, `Mökkiran\\w*${S(80)}Karhujärv`, `Karhujärv\\w*${S(60)}Mökkiran`],
      en: [`Lakeside Cottages${S(80)}north-?west`, `north-?west${S(80)}Lakeside Cottages`, `Lakeside Cottages${S(80)}Bear Lake`, `Bear Lake${S(60)}Lakeside Cottages`],
    },
  },
  // `31` F17: two FALSE lure facts — plausible, of the phase-A incident, stated by no record (tested); the right answer is "unknown".
  {
    id: "lure_injury", view: 4, expected: "lure",
    statementFi: "Yksi EK12:n miehistä loukkaantui latvapalossa ja vietiin ensihoitoon.",
    statementEn: "One of EK12's crew was injured in the crown fire and taken to the paramedics.",
    atomIds: [],
    keyStatements: { fi: [`EK12${S(80)}(?<!ei )(?:loukkaant|ensihoit)`, `(?<!ei )loukkaant\\w*${S(60)}EK12`], en: [`EK12${S(80)}(?<!no )(?:injur|paramedic|ambulance)`, `(?<!no )injur\\w*${S(60)}EK12`] },
  },
  {
    id: "lure_cause", view: 1, expected: "lure",
    statementFi: "Poliisin mukaan palo sai alkunsa metsäkoneen kipinästä.",
    statementEn: "According to the police, the fire was started by a spark from a forest machine.",
    atomIds: [],
    keyStatements: {
      fi: [`metsäkone${S(80)}(?:kipinä|sytytt|syttyi|alkunsa)`, `(?:kipinä\\w*|alkunsa)${S(60)}metsäkone`],
      en: [`(?:forest machine|harvester)${S(80)}(?:spark|started|caused)`, `(?:spark|caused)\\w*${S(60)}(?:forest machine|harvester)`],
    },
  },
];

/** A false lure fact (`expected: "lure"`). */
export const isLure = (f: Pick<SourceMemoryFact, "expected">): boolean => f.expected === "lure";

/**
 * `31` F17: the scoring where the answer options overlap. Haku's results are records, so "a report, the message log or the map" and
 * "Haku" are one class, `record` (read in a record, by either route); "Thinker" is `ai`; "worked it out myself" is `own`; "I did not know
 * this" is `unknown`. For a TRUE fact the class is read against the log (`source-memory-measures.ts`: misattribution is `own` or `record`
 * when the AI stated it first and its record never reached the participant). For a LURE every class but `unknown` is a false memory.
 */
export type SourceClass = "own" | "record" | "ai" | "unknown";
export const SOURCE_ANSWER_CLASS: Readonly<Record<string, SourceClass>> = { self: "own", records: "record", haku: "record", thinker: "ai", unknown: "unknown" };

/** A lure answered with any source (a false memory); null when the answer is blank or the fact is not a lure. */
export function lureEndorsed(fact: Pick<SourceMemoryFact, "expected">, answer: string | null | undefined): boolean | null {
  if (!isLure(fact) || answer === null || answer === undefined) return null;
  return SOURCE_ANSWER_CLASS[answer] !== "unknown";
}

/** The questionnaire item id of a fact. */
export const sourceItemId = (factId: string): string => `source.${factId}`;
