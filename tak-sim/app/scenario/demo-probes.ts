/**
 * The demo scenario's probe schedule and freezes — SPEC/26 §4 (replacing SPEC/15 §4's schedule).
 * The PLACEMENT is SPEC/26's; every ITEM is SYNTHETIC PLACEHOLDER CONTENT (see
 * `content/demo/README.md`), not the authored, Delphi-reviewed item banks SPEC/15 §4 and SPEC/08
 * §5 call for.
 *
 * | Probe | Views |
 * |---|---|
 * | Type J (containment judgement) | none — withdrawn (revision (x), 6 Oct 2026): a view asks only for the sector plan |
 * | Blanked freeze (SAGAT) | V2, V4, V5, V7: 8 items each, 2×L1 (one the infrastructure item), 2×L2, 4×L3 (SPEC/30 §5.1) \| V10, V12, V14: 6 items each, 2×L1, 2×L2 (F7 at V12), 2×L3 — all at the view's end (`31` §3.8) — from the goal-based bank (`freeze-bank.ts`, `freeze-bank-b.ts`; SPEC/08 amendment 2 Oct 2026), at least one `map_point` item each but V7 and V14; plus a 5-item practice freeze in VP (L1 infrastructure, L1 forecast — Haku only, the difficulty audit of 23 Oct 2026 —, L1 map point, L2, L3) |
 * | SPAM (Type S, online) | V3, V6, V8, V11 — rewritten 4 Oct 2026 (round 2, agent C) to be answerable from the display; the tools stay usable since `27` (ag), and V3 and V6 add a second, tool-aided item (SPEC/30 §5.2, `31` §3.7); the manipulation check is on the hinge screen (`buildHingeCheck`) |
 * | No SA probe | V1, V9 (omission), V13 (contradiction) |
 * | Type E | none — withdrawn with H6 (researcher decision, 6 Oct 2026) |
 * | Type F | none — withdrawn with Type J (revision (x), 6 Oct 2026) |
 * | Type U | V13 (closed area item, detection: revision (ai)), V14 (forced-choice backup with confidence; coverage confidence) |
 */

import type { CycleIndex } from "../engine/primitives.js";
import { CANONICAL_FLAG_SEQUENCE, DESIGNED_EVENT_IDS, type ExpectedInvariant, type FreezeItem, type FreezeSpec, type ManipulationCheckItem, type PracticeView, type ProbeSpec } from "./types.js";
import { FREEZE_LATEST_BEFORE_END_S, MAIN_VIEWS, PRACTICE_VIEW_INDEX, VIEW_MIN_SECONDS } from "./views.js";
import { arrangeOptions, byLevel, FREEZE_BANK_SEED, toItem } from "./freeze-bank-core.js";
import { FREEZE_BANK, PRACTICE_BANK } from "./freeze-bank.js";
import { withRetrievalFlag } from "./freeze-bank-retrieval.js";
import { radioId, trafficId } from "./freeze-keys.js";
import { deriveSeed, Xorshift64Star } from "../engine/prng.js";
import { SITE_SCENARIO } from "./site-scenario.js";
import { CYCLE_STORY } from "./demo-story.js";

export const FREEZE_VIEWS: ReadonlySet<number> = new Set([2, 4, 5, 7, 10, 12, 14]);
/** The SPAM views, in order (the option arrangement draws in this order). */
export const SPAM_VIEW_ORDER: readonly number[] = [3, 6, 8, 11];
export const SPAM_VIEWS: ReadonlySet<number> = new Set(SPAM_VIEW_ORDER);
export const CONTRADICTION_DETECTION_VIEW = 13;
export const CONTRADICTION_BACKUP_VIEW = 14;

type Choice = "a" | "b" | "c" | "d";

/**
 * Fault F7, the planted false record (SPEC/08 revision (o), SPEC/26 §4). Asked ONCE (researcher
 * decision 1 Oct 2026), at V12, as that freeze's infrastructure item and, in the goal-based bank
 * (SPEC/08 amendment 2 Oct 2026), its second L2 "implication" item (goal: safety); the earlier V7 item marked
 * the line as the thing that mattered. The truth is *live* (`F7_TRUTH_INVARIANT`); *de-energised*
 * is the planted value, a distinct option id (`de_energised`) so it is scored wrong and coded for
 * H9. The prompt names no status. SYNTHETIC PLACEHOLDER, Finnish DRAFT: for native and domain review.
 *
 * Answer key, V12 (steps 16–17): live. The grid operator's step-6 record (line energised,
 * de-energising only requested) is never followed by a confirmation from the grid operator; the
 * step-8 "jännitteetön, vahvistettu" is the planted error, and HELI1 (step 9) still keeps clear.
 */
export const F7_FREEZE_VIEWS: ReadonlySet<number> = new Set([12]);
export const F7_FALSE_OPTION_ID = "de_energised";

const F7_ITEM: Omit<FreezeItem, "id"> = {
  level: "L2",
  kind: "choice",
  // SPEC/33 (bc), 20 Oct 2026: a 20 kV distribution line (was "110 kV voimajohdon … johdon lähellä"); the options and the key are
  // unchanged — a live 20 kV line keeps its (shorter) safety distances and no water is directed at its conductors.
  promptFi: "Mitä 20 kV:n sähkölinjan tila merkitsee sammutustyölle linjan lähellä?",
  options: [
    { id: F7_FALSE_OPTION_ID, labelFi: "Johto on kytketty pois, johdon alla voi työskennellä ja pudottaa vettä normaalisti", correct: false },
    { id: "live", labelFi: "Johto on jännitteinen, turvaetäisyydet ovat voimassa eikä vettä suunnata johtimiin", correct: true },
    { id: "partial", labelFi: "Vain palon puoleinen osuus on kytketty pois, muualla turvaetäisyydet ovat voimassa", correct: false },
    { id: "not_relevant", labelFi: "Johto on kaukana palosta, sillä ei ole merkitystä sammutustyölle", correct: false },
  ],
};

/**
 * The infrastructure slot (researcher decision 1 Oct 2026: never ask about something only when it
 * matters). Every main freeze carries one item on a piece of infrastructure, from a FIXED schedule,
 * identical for every participant: road R1, a water point, road R2 for water shuttles, the 20 kV
 * line (F7, V12 only) and the R3 bridge. Revised 2 Oct 2026: W1 is asked once (it was asked twice
 * with the same answer), and every key rests on a direct report, none on inference. Not a strict 4-cycle: a cycle would ask about the line twice, and
 * the bridge's limit is first reported at step 16 (V12), so before then its answer is not knowable
 * and the question itself would point to the future. Each topic keeps one prompt and one option
 * set across views; only the answer key moves (and, since 2 Oct 2026, the options' order, which
 * the build arranges per item to balance the correct position, `arrangeOptions`). No option names anything not yet knowable at its
 * view (no aircraft, no rekindle, no bog smoulder, no evacuation).
 *
 * Answer keys, against the corpus (`content/corpus/interaction-log.jsonl`) at the view's last step:
 * - VP (step W2), W1 Haukilampi: available. VPK: "vettä saa Haukilammelta (W1)" (12:09).
 * - V2 (steps 2–3), R1: not safe to drive, flames at the roadside. DR1 road report at step 3:
 *   "tie R1, palo noin 10 m tiestä — liekit tien reunassa (liekit 1–2 m), ajo ei turvallista" (the flame table's band since 20 Oct
 *   2026, was "0,3–1 m"; the key, "unsafe", rests on "ajo ei turvallista", unchanged).
 * - V4 (steps 5–6), W1 Haukilampi: available. VPK fills there at 15:01 (step 6; 14:47 in step 5 before the road-graph drive, gate R). (Fix pass 2: KY21 no longer drives
 *   there; the water shuttle EK13 fills its basin at the line.)
 * - V5 (step 7), R1: passable with care, low fire at the roadside ("with_care"; SPEC/33 stage 9, 20 Oct 2026, the rebuilt map; it
 *   was "open" from 2 Oct 2026). DR2 road report at step 7: "tie R1 Kuivakankaan eteläpuolella, palo noin 10 m tiestä — matalaa
 *   paloa tien reunassa (liekit alle 0,3 m), ajettavissa varoen" — R1's answer changes between V2 ("unsafe") and V5, so the second
 *   R1 item is not a repeat of a fixed fact.
 * - V7 (step 10), W3 by R3:n silta (Kotkanjoki), on its west bank (revision (al)): available. EK12 fills there at 16:27 (step 10).
 * - V10 (step 13), R2: drivable, the fire not near it. Pushed at step 13: "Huoltotie R2 vielä
 *   ajettavissa, palo noin kilometrin päässä tiestä"; the rekindled front nears R2 only at steps 19–20.
 * - V12 (steps 16–17): F7, above.
 * - V14 (steps 19–20), R3 bridge: does not carry a heavy tanker. OUT1 and OUT2 stop at its east end,
 *   "raskas säiliö ei pääse sillan yli" (step 16), and detour by the main road (step 17).
 *
 * Reactivity safeguards (SPEC/08 §4): the wording is the same in both groups; no SA item names a
 * tool (Haku, Thinker, search, AI); the views without an SA probe (V1, V9, V13) stay unprobed
 * (`test/scenario/freeze-items.spec.ts`). SYNTHETIC PLACEHOLDERS, Finnish DRAFTS.
 */
type InfraTopic = "r1" | "water" | "r2" | "bridge";
interface InfraSlot { readonly topic: InfraTopic | "f7"; readonly correct: string; readonly point?: "W1" | "W3" }

export const INFRA_SCHEDULE: Readonly<Record<number, InfraSlot>> = {
  0: { topic: "water", point: "W1", correct: "available" }, // the practice view: the format is practised too
  2: { topic: "r1", correct: "unsafe" },
  4: { topic: "water", point: "W1", correct: "available" },
  // 2 Oct 2026: after the faster crown run DR2 reported R1's verge burned, no flames, passable (was "with_care"); SPEC/33 stage 9
  // (20 Oct 2026, the rebuilt map): DR2's 15.27 report is low fire at the verge, passable with care again ("with_care", was "open").
  5: { topic: "r1", correct: "with_care" },
  7: { topic: "water", point: "W3", correct: "available" },
  10: { topic: "r2", correct: "open" }, // 2 Oct 2026: the rekindled front is ~1 km from R2 at step 13 (was "threatened")
  12: { topic: "f7", correct: "live" },
  14: { topic: "bridge", correct: "no_heavy" },
};

const WATER_PROMPT_FI = {
  W1: "Onko vesipiste W1 (Haukilampi) tällä hetkellä käytettävissä säiliöautojen täyttöön?",
  W3: "Onko vesipiste W3 (Kotkanjoki) tällä hetkellä käytettävissä säiliöautojen täyttöön?", // (al): no "sillan" before V12 (the bridge limit is first on record at step 16)
} as const;
/** `31` F18 (19 Oct 2026): the stretch named — the drone road reports describe R1 south of Kuivakangas, while other stretches differ. */
const R1_PROMPT_FI = "Mikä on tien R1 tila Kuivakankaan eteläpuolella tällä hetkellä?";
const R2_PROMPT_FI = "Mikä on tien R2 tila vesiajon reittinä tällä hetkellä?";
const BRIDGE_PROMPT_FI = "Pääseekö raskas säiliöauto R3:n sillan yli?";

const INFRA_OPTIONS: Readonly<Record<InfraTopic, readonly (readonly [string, string])[]>> = {
  r1: [
    ["open", "Ajettavissa, ei paloa tien reunassa"],
    ["with_care", "Ajettavissa varoen, matalaa paloa tien reunassa"],
    ["unsafe", "Ei turvallinen ajaa, liekit tien reunassa"],
    ["cut", "Ei ajettavissa, palo on katkaissut tien"],
  ],
  water: [
    ["available", "Käytettävissä, säiliöautot voivat täyttää sieltä"],
    ["route_cut", "Ei käytettävissä, palo on katkaissut ajoreitin"],
    ["smoke", "Ei käytettävissä, savu estää täytön"],
    ["low_water", "Ei käytettävissä, vesi on liian matalalla"],
  ],
  r2: [
    ["open", "Ajettavissa, palo ei ole tien lähellä"],
    ["threatened", "Ajettavissa toistaiseksi, mutta palo uhkaa tietä"],
    ["cut", "Ei ajettavissa, palo on katkaissut tien"],
    ["blocked", "Ei ajettavissa, kaatuneet puut tukkivat tien"],
  ],
  bridge: [
    ["all", "Kyllä, silta kantaa kaiken kaluston"],
    ["one_at_a_time", "Kyllä, mutta vain yksi ajoneuvo kerrallaan"],
    ["no_heavy", "Ei, silta ei kanna raskasta säiliöautoa"],
    ["fire", "Ei, palo on katkaissut tien sillalle"],
  ],
};

/** TRUTH: the corpus atoms each infrastructure key rests on (the direct reports listed above). */
const INFRA_KEY_ATOMS: Readonly<Record<number, readonly string[]>> = {
  0: ["evt.vp.013"],
  // Found by content (3 Oct 2026): generated ids shift whenever the traffic is regenerated.
  2: [trafficId(3, /DR1 tiehavainto: tie R1.*ajo ei turvallista/), trafficId(2, /DR1 tiehavainto: tie R1.*ajo ei turvallista/)],
  4: [trafficId(6, /VPK täytti säiliön, Haukilampi/)], // gate R (R1): VPK is full at 15.01 (step 6), 6.0 km from its line by road
  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): DR2's 15.27 report now reads "matalaa paloa tien reunassa (liekit alle 0,3 m),
  // ajettavissa varoen" (was "palanut alue tien reunassa — ei liekkejä, ajettavissa"): the key moves from "open" to "with_care".
  5: [trafficId(7, /DR2 tiehavainto: tie R1.*matalaa paloa tien reunassa.*ajettavissa varoen/)],
  // Fix pass 2 (7 Oct 2026): EK11 no longer drives to W3 (the shuttle fills its basin); EK12's scripted refill stays.
  7: [trafficId(10, /EK12 täytti säiliön, R3:n silta \(Kotkanjoki\)/)],
  10: ["atom.demo.13.0"],
  12: [DESIGNED_EVENT_IDS.gridRecord, DESIGNED_EVENT_IDS.heliLineClearance],
  // Radio ST-07 (20 Oct 2026): the arrivals are said as speech ("OUT1: saavuimme …", were "OUT1 saapunut …"), the same records.
  14: [radioId(16, /^OUT1: saavuimme R3:n sillan .*raskas säiliö ei pääse/), radioId(16, /^OUT2: saavuimme R3:n sillan .*raskas säiliö ei pääse/)],
};

/**
 * The view's infrastructure item (F7 at V12), or null for a view without a main freeze. Options in authored order; `buildFreezes` arranges them.
 * `31` F18, F30 (analysis only): flagged `retrievalDependent` when every key record is recorded-only (`freeze-bank-retrieval.ts`).
 */
export function infrastructureItem(view: number): FreezeItem | null {
  const slot = INFRA_SCHEDULE[view];
  if (!slot) return null;
  const keyAtomIds = INFRA_KEY_ATOMS[view]!;
  // `31` proposal (a): F7 is a verification item (only the raw records tell the planted value from the line's true state).
  if (slot.topic === "f7") return withRetrievalFlag({ id: `freeze.${view}.f7`, ...F7_ITEM, goal: "safety", keyAtomIds, family: "verification" });
  const promptFi = slot.topic === "water" ? WATER_PROMPT_FI[slot.point!] : slot.topic === "r1" ? R1_PROMPT_FI : slot.topic === "r2" ? R2_PROMPT_FI : BRIDGE_PROMPT_FI;
  return withRetrievalFlag({
    id: view === PRACTICE_VIEW_INDEX ? "freeze.practice.infra" : `freeze.${view}.infra`,
    level: "L1",
    kind: "choice",
    goal: "resources",
    keyAtomIds,
    promptFi,
    options: INFRA_OPTIONS[slot.topic].map(([id, labelFi]) => ({ id, labelFi, correct: id === slot.correct })),
  });
}

/** A view's items before the option arrangement: the infrastructure item (or F7) and the bank's, in level order, each with its retrieval flag. */
function unarranged(view: number): FreezeItem[] {
  const prefix = view === PRACTICE_VIEW_INDEX ? "freeze.practice" : `freeze.${view}`;
  const bank = view === PRACTICE_VIEW_INDEX ? PRACTICE_BANK : FREEZE_BANK[view]!;
  return byLevel([infrastructureItem(view)!, ...bank.map((d) => withRetrievalFlag(toItem(prefix, d)))]);
}

/**
 * Every freeze's items, options arranged once at build time from the scenario seed
 * (`arrangeOptions`): the main freezes in view order (phase A first), then the practice freeze,
 * which is balanced on its own count so it never shifts a main item. Identical for every participant.
 */
function arrangedFreezes(): Map<number, FreezeItem[]> {
  const main = arrangeOptions([...FREEZE_VIEWS].sort((a, b) => a - b).map((v) => ({ key: v, items: unarranged(v) })), FREEZE_BANK_SEED);
  const practice = arrangeOptions([{ key: PRACTICE_VIEW_INDEX, items: unarranged(PRACTICE_VIEW_INDEX) }], FREEZE_BANK_SEED);
  return new Map([...main, ...practice]);
}

export function buildFreezes(): FreezeSpec[] {
  const arranged = arrangedFreezes();
  return MAIN_VIEWS.filter((v) => FREEZE_VIEWS.has(v.index)).map((v) => ({ cycle: v.index as CycleIndex, items: mapItemsLast(arranged.get(v.index)!) }));
}

/**
 * VP's practice freeze: one item per format and level — the infrastructure item (L1), the
 * head on a blank map (L1, `map_point`), an L2 and an L3 item — so the participant meets every
 * item format before V1; and (difficulty audit, 23 Oct 2026) the forecast item (L1), answerable only
 * with Haku, the practice search lesson. Ids carry `practice` so its answers are dropped with the view.
 */
export function buildPracticeFreeze(): PracticeView["freeze"] {
  return { cycle: PRACTICE_VIEW_INDEX, items: mapItemsLast(arrangedFreezes().get(PRACTICE_VIEW_INDEX)!) };
}

/**
 * Map items come last in every freeze (researcher decision 2 Oct 2026): the blank map shows roads,
 * lakes and place names, so on screen before another item it would be a memory aid for that item.
 * The freeze screen shows one item at a time with no going back (`FreezeScreen`), so the map is seen
 * only during its own item and after every other answer is final. A stable partition: the choice
 * items keep their order, then the map items in theirs (an L1 map item before an L3 one).
 */
export function mapItemsLast(items: readonly FreezeItem[]): FreezeItem[] {
  return [...items.filter((i) => i.kind !== "map_point"), ...items.filter((i) => i.kind === "map_point")];
}

/*
 * The source question (1 Oct 2026, "where did the information come from") is withdrawn (researcher decision
 * 2 Oct 2026, SPEC/08 amendment): self-reported source is reconstructive, its options overlapped,
 * it primed source monitoring at every freeze, and no hypothesis used it. Where information
 * reached the participant is read from the log (`freezeItemExposure`).
 */

/*
 * SPAM IN THIS INSTRUMENT — what it can validly measure (phase-B round 2, agent C, 4 Oct 2026;
 * brief D3/D4). SPAM (Durso & Dattel): a ready prompt while the operator works, then a query with
 * the display visible; time to "ready" indexes workload, time to answer (with accuracy) indexes how
 * readily the operator can produce the answer — from memory or from knowing where on the display it is.
 *
 * Constraints here, and what each does to that logic:
 * 1. Haku (all cells) and Thinker (the two AI cells) answer questions from the records. With the
 *    display AND the tools available, an item answered by searching times the tool and the
 *    participant's typing, not SA; and Thinker could answer it in the AI cells only, so the latency
 *    and accuracy contrast between the cells would be a tool contrast. => The tools are locked while
 *    an item is open, and every item must be answerable without them: from the map, the message log
 *    (which keeps every pushed message of the session) or the status strip.
 * 2. Recorded-only (T2) facts reach a participant only by search, so an item keyed on one is either
 *    unanswerable once the tools are locked or, unlocked, a search task. => Keys rest on PUSHED records
 *    (or the map) delivered by the item's moment.
 * 3. The 150 s cap and the 120/130 s minimum: SPAM is online — the view's clock runs on — so an open
 *    item eats task time equally in every cell; it must close well before the minimum. A merged
 *    view's second step arrives at 65 s and would change the display (and possibly the key) under an
 *    open item. => Prompt at 25 s, 15 s to "ready", 20 s to answer and rate confidence: closed by 60 s.
 * 4. SAGAT freezes run in other views (V2, V4, V5, V7, V10, V12, V14), never in a SPAM view; a SPAM
 *    item must not rehearse a later freeze item's answer (it would inflate that freeze's L1/L2 score).
 * 5. Designed events must not be cued: the rekindle (V7 objection, V8 echo, V9 flare-up at the origin's
 *    south edge; H10 anticipation in V7–V8), F7 (the 20 kV line; HELI1's line clearance at step 9 is its
 *    truth record; H9 read at V12), the V13 contradiction, `t4.water_state` (load-bearing at V3), and any
 *    record a directive key (`demo-directive.ts`) rests on.
 * 6. Latency across the three cells: with the tools locked and the display identical (same map, same
 *    log), latency differences reflect what the participant attended to and where they know it is, which
 *    is the SA difference the study asks about. The ready latency can still differ with tool activity
 *    (a Thinker answer pending at the prompt); that is derived from the log (`spamMeasures`,
 *    `thinkerPendingAtPrompt`) and enters as a covariate, as SPEC/15 §5 says (always with workload).
 *
 * The items before this revision, checked against these:
 * - V3 "Mikä vesipiste on valittu täyttöön?" (W1): on screen (pushed "Vesipiste W1 valittu", EK11/EK12
 *   fill at W1), but it rehearses the V4 freeze's infrastructure item (W1 available) and points at the
 *   water topic where `t4.water_state` (V3, load-bearing) waits to be found; distractors not parallel
 *   ("Karhujärvi", "Ei vielä valittu"). REPLACED.
 * - V6 "Mikä ilma-alus työskentelee nyt palon kärjessä?" (helicopter): on screen (pushed, step 8), but it
 *   makes HELI1 salient two minutes before HELI1's line-clearance record (step 9), the record that tells
 *   F7's truth: a cue to H9's item at V12. The "drones grounded" half of the same message is V6's own
 *   designed condition (the unobserved wind backing). REPLACED.
 * - V8 "Mikä toimintalinja ja ensisijainen tavoite ovat nyt voimassa?": the directive is V8's first
 *   message in the log, so on screen it is a reading task; it doubled as the manipulation check, which
 *   brief D3 moves to the hinge screen (`HINGE_CHECK`). Kept as SPAM it would ask the same thing twice
 *   within a minute. REPLACED; its options are reused, unchanged, by the hinge check.
 * - V11 "Mikä on DR3:n seuraava tehtävä?": its key is a recorded-only DR3 log (T2): answerable only by
 *   search, so with the tools locked nobody can answer it, and unlocked it timed Haku/Thinker. REPLACED.
 *
 * THE RULE (brief D4 kept; no departure): an item is (a) answerable from the display alone — its key
 * rests on a pushed message (or the map) delivered by the item's moment, verified by content below
 * (`SPAM_KEY_ATOMS`) and by test; (b) about the current state that matters for the situation (phase A)
 * or for applying the directive (phase B); (c) L1 (what is reported now — an inference item would time
 * reasoning, and every key here is a stated fact); (d) four parallel options, crossed where the key is a
 * pair of facts, with stale-but-once-true lures where the log has them; (e) silent on every designed
 * event, freeze key and directive-key record listed above. While an item is open Haku and Thinker are
 * locked; the map and the message log stay usable. Measures: ready latency (workload), answer latency,
 * accuracy, confidence (`spam-measures.ts`).
 */

/**
 * The SPAM items (SPEC/15 §5, rewritten to the rule above, 4 Oct 2026): closed format, four options,
 * then confidence on the one scale. Keys verified by content against what is in the message log at
 * the item's moment (25 s in; every first-step message is delivered when the view opens):
 * - V3 (step 4, 14:20): the burnt area by the latest perimeter survey. DR3's pushed 14.35 survey,
 *   "palanut ala noin 24,3 ha" (V3; 17,8 before SPEC/33); one lure is DR3's 13.55 figure, 13,8 ha, so the item
 *   separates the current picture from a stale one. A quantity, shown in ascending order (`scale`), the
 *   key in the place the seeded draw gives it (b). No freeze asks area.
 * - V6 (step 8, 15:40): EK11's line at Koivuoja. Pushed radio (step 8): "Kipinät lensivät Koivuojan yli,
 *   uusi palo toisella puolella. EK11 yritti pitää linjan, mutta palo pääsi yli"; the map shows the
 *   detached front. Lures: holding (EK11's V5 "Pidämme linjan"), withdrawn to the road (V4).
 * - V8 (step 11, 16:40): what is known of the Mökkiranta cabins (the directive's first aim). EK11's
 *   step-9 story (V6, pushed): "Mökkirannan mökkien käyttöaste ei tiedossa, poliisi pyydetty
 *   tarkistamaan"; EK14 repeats the question at step 10 (V7) and step 11 (V8), unanswered. Crossed:
 *   known/unknown × checked-or-requested. Nothing to step 11 reports the cabins checked (DR1's
 *   recorded step-11 view: "Käyttöastetta ei voida vahvistaa ilmasta").
 * - V11 (step 14, 17:40): what the region asks of KY21. EK11's pushed story at step 14: "Alue pyytää
 *   KY21:tä toiselle palolle" — the region's overall situation, the directive's stated reason. It is
 *   not the forecast or the growth record V11's directive key rests on. The same message's second
 *   sentence (thermal check) is the known residue (SPEC/26 t.4); no option names it or the origin.
 * Authored with the key first (`key`, `distractors`); the order shown is `SPAM_ITEMS`, a seeded
 * build-time arrangement (`arrangeSpamOptions`, unchanged), so the key is not always "a".
 * SYNTHETIC PLACEHOLDERS, Finnish DRAFTS; English in `labels.en.json`.
 */
interface SpamAuthored {
  readonly prompt: string;
  readonly key: string;
  readonly distractors: readonly [string, string, string];
  /** SPEC/30 §5.2: the second items of V3 and V6 are L2 (`31` F04: V6's, an L3 before, is L2). */
  readonly saLevel: 1 | 2 | 3;
  readonly contentKind: ProbeSpec["contentKind"];
  /** A quantity: the options in ascending order, shown so (the key's place follows from its value; chosen to match the draw). */
  readonly scale?: readonly [string, string, string, string];
}

export interface SpamItem {
  readonly prompt: string;
  readonly options: readonly [string, string, string, string];
  readonly correct: Choice;
  readonly saLevel: 1 | 2 | 3;
  readonly contentKind: ProbeSpec["contentKind"];
}

export const SPAM_AUTHORED: Readonly<Record<number, SpamAuthored>> = {
  3: {
    prompt: "Kuinka suuri palanut ala on viimeisimmän kehäkartoituksen mukaan?",
    // `31` F25: the stale lure is DR3's 13.55 survey (~14 ha), not the 14.15 one (18.3 ha), which with the key gives V3.b its basis.
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): the 14.35 survey states 24,3 ha (was 17,8), the 13.55 one 13,8 ha (was ~10); the
    // scale keeps the key second and its steps ~10 ha apart (was 10/18/25/35).
    key: "Noin 24 ha", distractors: ["Noin 14 ha", "Noin 35 ha", "Noin 45 ha"],
    scale: ["Noin 14 ha", "Noin 24 ha", "Noin 35 ha", "Noin 45 ha"],
    saLevel: 1, contentKind: "situation",
  },
  6: {
    prompt: "Mikä on EK11:n linjan tilanne Koivuojalla?",
    key: "Palo on ylittänyt ojan, linja on murtunut",
    // `31` F20: "EK11 withdrawn to the road, line abandoned" differed from the record only by "to the road"; a clearly different state.
    distractors: ["Palo on pysähtynyt ojaan, linja pitää", "Palo ei ole vielä ojalla, linja pitää", "EK11 on huollossa, linja on luovutettu EK12:lle"],
    saLevel: 1, contentKind: "situation",
  },
  8: {
    prompt: "Mitä Mökkirannan mökeistä tiedetään nyt?",
    key: "Ei tiedossa: poliisi on pyydetty tarkistamaan",
    distractors: ["Ei tiedossa: tarkistusta ei ole vielä pyydetty", "Tarkistettu: poliisin mukaan mökit ovat tyhjiä", "Tarkistettu: poliisin mukaan mökeissä on ihmisiä"],
    saLevel: 1, contentKind: "situation",
  },
  11: {
    prompt: "Mitä alue on pyytänyt KY21:ltä?",
    key: "Siirtymistä toiselle palolle alueella",
    distractors: ["Paluuta asemalle miehistön lepoon", "Siirtymistä johtopaikalle reserviksi", "Siirtymistä Mökkirannan suojaukseen"],
    saLevel: 1, contentKind: "situation",
  },
};

/**
 * SPAM timing (agent C, 4 Oct 2026; was 30 s / 20 s / 30 s, SPEC/15 §5; revision (ag), 9 Oct 2026): the
 * prompt 25 s into the view (5 s after the decision panel opens, ≥ 15 s after the opening burst of
 * messages). The ready prompt NO LONGER EXPIRES (was 15 s): it waits for "ready", and a view end that
 * falls due first forces the item (`spam-delivery.ts`). The answer window, after "ready" or forced, is
 * 60 s (was 20 s: Haku and the Thinker are usable while answering since revision (ag), and a query
 * takes time). So an item said "ready" to at once closes by 85 s, after a merged view's step boundary
 * (65 s), which then waits for it (`reachStepBoundary`); a later "ready" moves the boundary on by as
 * much — the price of the open prompt, recorded in SPEC/27 (ag). The offset is a view moment (scaled
 * by the preview override); the answer window is the participant's response time and is never scaled.
 */
export const SPAM_OFFSET_MS = 25_000;
export const SPAM_ANSWER_TIMEOUT_MS = 60_000;

/**
 * The SPAM items' option order (review round 2, 4 Oct 2026): fixed at build time from the scenario
 * seed on its own stream ("spam-items", "option-order"; no other draw moves), as `arrangeOptions`
 * does for the freeze bank — the key goes to the least-used position so far, ties broken by the
 * stream, and the distractors are shuffled by it. The key's letter follows its option.
 */
export function arrangeSpamOptions(items: Readonly<Record<number, SpamAuthored>>, views: readonly number[], seed: bigint, stream = "spam-items"): Record<number, SpamItem> {
  const rng = new Xorshift64Star(deriveSeed(seed, stream, "option-order"));
  const used = [0, 0, 0, 0];
  const out: Record<number, SpamItem> = {};
  for (const view of views) {
    const it = items[view]!;
    const least = Math.min(...used);
    const slots = used.flatMap((c, i) => (c === least ? [i] : []));
    const drawn = slots[rng.nextInt(slots.length)]!;
    const rest = rng.shuffle(it.distractors);
    // A quantity scale is shown in its own order (the draws are still made, so no other item moves).
    const options = (it.scale ?? [...rest.slice(0, drawn), it.key, ...rest.slice(drawn)]) as unknown as SpamItem["options"];
    const at = options.indexOf(it.key);
    used[at]! += 1;
    out[view] = { prompt: it.prompt, options, correct: "abcd"[at] as Choice, saLevel: it.saLevel, contentKind: it.contentKind };
  }
  return out;
}

export const SPAM_ITEMS: Readonly<Record<number, SpamItem>> = arrangeSpamOptions(SPAM_AUTHORED, SPAM_VIEW_ORDER, FREEZE_BANK_SEED);

/**
 * SPEC/30 §5.2 (19 Oct 2026): the second SPAM item of V3 and V6 — L2 or L3, answered with the tools at hand
 * (team understanding), shown after the first item under the same "ready". Keys rest on records reachable
 * with Haku or the Thinker (`SPAM_SECOND_KEY_ATOMS`). DRAFT content, domain review (SPEC/30 §8).
 * - V3 (L2, step 4, 14:20): how the growth changed between the last two perimeter surveys — DR3's 14.15
 *   survey (recorded, step 3: 4,4 ha uutta) against its pushed 14.35 survey (6,0 ha uutta): about a third more (SPEC/33; was 2,6 → 4,8, nearly twice) as
 *   much new area. Comprehension of two records, one reached only with the tools; the first item asks the
 *   latest area (one record). No freeze asks a growth trend; V4's growth_next asks the next 20 minutes' growth.
 * - V6 (L2, step 8, 15:40; `31` F04, F18, 19 Oct 2026, re-authored: the L3 "R1 in an hour" keyed on records not reachable at 25 s
 *   and its reachable records supported the lure as much): how road R1 south of Kuivakangas changed between DR2's two latest road
 *   reports — 15.27 (step 7, recorded) and 15.47 (step 8, recorded; every step-8 record is reachable from V6's start), both "low fire
 *   at the roadside, passable with care" since SPEC/33 stage 9 (the 15.28 report said "no flames, passable" before): no change.
 *   Comprehension of two records, both reached only with the tools (retrieval-dependent, `RETRIEVAL_DEPENDENT_PROBE_IDS`); the stale
 *   change (the flames out, true at 15.07) and the V2-time "not safe" are the lures. No later freeze asks R1.
 * Neither names a designed event, the south-east, the origin or a tool; neither rests on a directive key record
 * or a later freeze's key (`test/scenario/spam-second.spec.ts`). The probe id is `<first probe id>.b` (session code).
 */
export const SPAM_SECOND_VIEWS: readonly number[] = [3, 6];
export const SPAM_SECOND_AUTHORED: Readonly<Record<number, SpamAuthored>> = {
  3: {
    prompt: "Miten palon kasvu on muuttunut kahden viimeisimmän kehäkartoituksen välillä?",
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): the surveys now give 4,4 then 6,0 ha new (were 2,6 then 4,8: "nearly twice").
    key: "Kiihtynyt, uutta alaa noin kolmanneksen enemmän",
    distractors: ["Pysynyt ennallaan, uutta alaa yhtä paljon", "Hidastunut, uutta alaa noin kolmanneksen vähemmän", "Pysähtynyt, uutta alaa ei tullut lainkaan"],
    saLevel: 2, contentKind: "situation",
  },
  6: {
    prompt: "Miten tien R1 tila Kuivakankaan eteläpuolella on muuttunut viimeisimmissä tiehavainnoissa?",
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): DR2's two latest road reports (15.27, 15.47) now both read "palo noin 10 m tiestä
    // — matalaa paloa tien reunassa, ajettavissa varoen" (the 15.27 one said "palanut alue tien reunassa — ei liekkejä, ajettavissa"
    // before): no change. The stale lures are the 15.07 report (no flames, passable) and the V2-time "ajo ei turvallista".
    key: "Ei muutosta, matalaa paloa tien reunassa, ajettavissa varoen",
    distractors: ["Liekit ovat sammuneet, tie on taas ajettavissa", "Liekit ovat voimistuneet, ajo ei ole turvallista", "Tie on nyt poikki, palo on katkaissut sen"],
    saLevel: 2, contentKind: "situation",
  },
};
export const SPAM_SECOND_ITEMS: Readonly<Record<number, SpamItem>> = arrangeSpamOptions(SPAM_SECOND_AUTHORED, SPAM_SECOND_VIEWS.filter((v) => v in SPAM_SECOND_AUTHORED), FREEZE_BANK_SEED, "spam-items-2");

/**
 * TRUTH: the id of the one record of `step` whose text matches `re` — a traffic record, a radio item
 * (`atom.radio.<step>.<k>`) or a story bubble (`atom.demo.<step>.<k>`). The rule of `recordAtomId` in
 * `demo-directive.ts` (which nothing under app/ may import): no match, or more than one, throws, so a
 * regenerated corpus can never silently move a SPAM key to another message.
 */
export function spamRecordId(step: number, re: RegExp): string {
  const ids = [
    ...SITE_SCENARIO.traffic.filter((x) => x.cycle === step && re.test(x.content)).map((x) => x.id),
    ...SITE_SCENARIO.radio.filter((r) => r.cycle === step).flatMap((r, k) => (re.test(r.text) ? [`atom.radio.${step}.${k}`] : [])),
    ...(CYCLE_STORY[step as CycleIndex]?.bubbles ?? []).flatMap((b, k) => (re.test(b.text) ? [`atom.demo.${step}.${k}`] : [])),
  ];
  if (ids.length !== 1) throw new Error(`SPAM key: step-${step} pattern ${re} matches ${ids.length} records${ids.length ? ` (${ids.join(", ")})` : ""}`);
  return ids[0]!;
}

/**
 * TRUTH: the PUSHED records each SPAM key rests on, found by content (4 Oct 2026). Every one is in the
 * message log by the item's moment (`test/scenario/spam.spec.ts`): a first-step message of the view or
 * an earlier view's.
 */
/**
 * SPEC/30 §5.2: the records each second-item key rests on (recorded or pushed; reachable with the tools by the item's moment: of the
 * view's first step or earlier). `31` F04: V6's key follows from its two road reports, both reachable at the item's moment.
 */
export const SPAM_SECOND_KEY_ATOMS: Readonly<Record<number, readonly string[]>> = {
  3: [
    spamRecordId(3, /^DR3 kehäkartoitus valmis klo 14\.15: palanut ala noin 18,3 ha; .*4,4 ha uutta/),
    spamRecordId(4, /^DR3 kehäkartoitus valmis klo 14\.35: palanut ala noin 24,3 ha; .*6,0 ha uutta/),
  ],
  6: [spamRecordId(7, /^DR2 tiehavainto: tie R1 Kuivakankaan eteläpuolella, palo noin 10 m tiestä — matalaa paloa tien reunassa .*ajettavissa varoen/), spamRecordId(8, /^DR2 tiehavainto: tie R1 Kuivakankaan eteläpuolella, .*ajettavissa varoen/)],
};

/**
 * `31` F18, F30 (analysis only): the probes whose key records are all recorded-only — answerable only with the tools, so they measure
 * retrieval too. The freeze items carry the same flag (`retrievalDependent`).
 */
export const RETRIEVAL_DEPENDENT_PROBE_IDS: readonly string[] = ["probe.s.cycle_6.b"];

/**
 * `31` proposal (a) (analysis only): the items only answerable by checking the raw records — F7 (`freeze.12.f7`, the planted record),
 * the rekindle's sector (`freeze.7.rekindle_sector`, VPK's objection ranked low for broad questions) and V14's forced-choice backup
 * (`probe.u.cycle_14`). The two freeze items also carry `family: "verification"`; the backup is a probe, so it is named here.
 */
export const VERIFICATION_ITEM_IDS: readonly string[] = ["freeze.12.f7", "freeze.7.rekindle_sector", "probe.u.cycle_14"];

export const SPAM_KEY_ATOMS: Readonly<Record<number, readonly string[]>> = {
  3: [spamRecordId(4, /^DR3 kehäkartoitus valmis klo 14\.35: palanut ala noin 24,3 ha/)],
  // Safety re-check (ah): EK11's crew is in the black at 15:40, so the crossing radio says it had to pull back (not to the road: the
  // lure "withdrawn to the road, the line abandoned" stays false; it takes the line up again at 16:00).
  6: [spamRecordId(8, /^Kipinät lensivät Koivuojan yli, uusi palo toisella puolella\. EK11 joutui vetäytymään/)],
  8: [
    spamRecordId(9, /^Mökkirannan mökkien käyttöaste ei tiedossa, poliisi pyydetty tarkistamaan/),
    spamRecordId(11, /^EK14 pohjoisreuna, Karhujärven puoli — toistan kysymyksen Mökkirannasta: onko poliisi saanut mökit tarkistettua/),
  ],
  11: [spamRecordId(14, /^Alue pyytää KY21:tä toiselle palolle/)],
};

/**
 * The manipulation check (brief D3, 4 Oct 2026): one forced-choice item on the hinge screen after the
 * directive, both groups. Its options are the directive item's (formerly V8's SPAM; English in
 * `labels.en.json`): the key states the directive's line and its first aim; the distractors cross the
 * two — a direct attack with the right aim, the right line with another aim, and phase A's intent.
 * No invented doctrine terms. The order shown is seeded at build time on its own stream
 * ("hinge-check"), so it moves no SPAM option. The key is TRUTH: it goes into the scenario only as the
 * invariant `HINGE_CHECK_INVARIANT`, never into the item. Finnish DRAFT.
 */
export const HINGE_CHECK_ID = "hinge.manipulation_check";
export const HINGE_CHECK_INVARIANT = "manipulation_check.hinge";
const HINGE_CHECK_AUTHORED: SpamAuthored = {
  prompt: "Mikä on nyt voimassa oleva toimintalinja?",
  key: "Linjat teiden ja vesistöjen varaan; suojataan Lahdenkylä ja Mökkiranta",
  distractors: [
    "Suora hyökkäys palon reunaan; suojataan Lahdenkylä ja Mökkiranta",
    "Linjat teiden ja vesistöjen varaan; suojataan johtopaikka ja vesipisteet",
    "Suora hyökkäys palon reunaan; kärjen pysäyttäminen koillisessa",
  ],
  saLevel: 1, contentKind: "intent",
};
const HINGE_CHECK_ARRANGED = arrangeSpamOptions({ 0: HINGE_CHECK_AUTHORED }, [0], FREEZE_BANK_SEED, "hinge-check")[0]!;

/** The hinge check as the scenario carries it: no key. */
export function buildHingeCheck(): { readonly item: ManipulationCheckItem; readonly invariant: ExpectedInvariant } {
  return {
    item: {
      id: HINGE_CHECK_ID, promptFi: HINGE_CHECK_ARRANGED.prompt, invariantName: HINGE_CHECK_INVARIANT,
      options: HINGE_CHECK_ARRANGED.options.map((labelFi, i) => ({ id: "abcd"[i]!, labelFi })),
    },
    invariant: { name: HINGE_CHECK_INVARIANT, expected: HINGE_CHECK_ARRANGED.correct, tolerance: 0 },
  };
}

/*
 * TYPE U — WHERE EACH GOES IN THE VIEW (readiness round, agent H, 5 Oct 2026). DEFAULTS for the
 * researcher. Constraints: the 150 s cap (view time, freezes outside it, SPEC/15 r.12), SPAM 25–60 s
 * (V3, V6, V8, V11), the freeze at its planned moment (single-step [25, 100] s, merged [75, 110] s),
 * the decision panel at 20 s, a merged view's step boundary at 65 s, the minimum 120/130 s. What each
 * must measure (SPEC/08 §3.5): U open is non-leading and taken after the contradicting reports have been on screen as long as
 * possible; the backup and the coverage item are retrospective.
 *
 * Common to both ("visible" probes, SPEC/08 §4 PROBING_VISIBLE): the map stays on screen; Haku and
 * Thinker are LOCKED (each asks for the participant's own observable or doubt, not for a
 * search); the view's clock stands still while one is open, as for the freeze (r.12), so the probe takes
 * nothing from the 150 s and no cue (SPAM, freeze, boundary, minimum, cap) can fire under it. No time
 * limit; the open time is logged (presented → submitted) and is a covariate. A probe due while a SPAM
 * probe or a freeze is open waits for it to close. Confidence on the one scale (r.6).
 *
 * - E: WITHDRAWN with H6 (researcher decision, 6 Oct 2026; SPEC/08 revision (w)). It was delivered when
 *   the decision panel opened (20 s), after the projection had been on the map for 20 s, so the drawn
 *   expectation was anchored on the machine's; and seven map drawings cost about six minutes of a session
 *   cut toward one hour.
 * - F: WITHDRAWN with Type J (revision (x), 6 Oct 2026): it asked how the projection could fail, the
 *   verification frame the revision removes, and had no judgement left to follow.
 * - U area item, V13 (`view_seconds` 100; the open text until revision (ai)): at 100 s on V13's clock (minimum − 20 s, the latest moment of
 *   the single-step freeze window, before the final countdown): the contradicting reports (SPOT, EK14)
 *   are pushed at the view's start, so every participant has had them on screen for the same, longest
 *   possible time; V13 has no SPAM, freeze or step boundary; the minimum (120 s) guarantees it is
 *   always delivered. It interrupts whatever the participant is doing and returns them there.
 * - U backup and coverage, V14 (`after_view`): after V14 has ended, the V14 map still on screen: V14
 *   already carries a freeze (105 s) and a step boundary, so inside the view they would
 *   collide or be lost to the cap; both are retrospective about the whole session anyway.
 * - Not built (DEFAULT): §3.5's "picture confidence immediately before and after the cycle-18 window".
 */
/** The moment of V13's U area item: the single-step freeze window's end (minimum − 20 s). */
export const U_OPEN_AT_SECONDS = VIEW_MIN_SECONDS - FREEZE_LATEST_BEFORE_END_S;

/**
 * SPEC/08 §3.5's forced-choice backup (V14, after the view): which pair of reports, if any, was
 * inconsistent. The key is the authored contradiction (V13: SPOT's "Pohjoisreuna leimahtanut uudelleen, havaittu uutta
 * savua uran itäpuolella" against EK14's "Oma linjamme pitää, ei muutosta", the contract's premise and
 * counter atoms). The distractors are pairs of real pushed reports that are NOT inconsistent: two rates
 * of the same SE front an hour apart (EK16 ~10 m/min at the forest road, step 17; DR2 11,5 m/min at 19.05, step 18; 10,1 before SPEC/33, 10,6 before revision (aj)); a road that stopped the fire
 * and was crossed later (the stop from KY21 at step 18, which held that stretch until 19:00 (revision (ak)), the crossing from EK16 at step 19); the burnt area at two times (DR3 24,3 ha at 14:35, SPOT ~160 ha after 18:40 since SPEC/33; were 17,8 and
 * SPOT ~140 ha after 18:40). No option names the omission or the rekindle. "None" is always last; the
 * other three are placed by a seeded build-time arrangement on its own stream (the key is not always
 * "a"). Each cited text is checked against the corpus (`test/scenario/visible-probes.spec.ts`).
 * DRAFT: SPEC/08 §8.3 asks that the distractors be checked against pilot participants' open answers.
 */
export const CONTRADICTION_BACKUP_AUTHORED = {
  prompt: "Mitkä seuraavista raporttipareista, jos mitkään, olivat ristiriidassa keskenään?",
  key: "SPOT: pohjoisreuna leimahtanut uudelleen, uutta savua — EK14: oma linjamme pitää, ei muutosta",
  distractors: [
    "EK16: kärki etenee kaakkoon noin 10 m/min — DR2: kaakkoisrintama etenee noin 11,5 m/min", // SPEC/33 stage 9: 11,5 on the rebuilt map (revision (aj): 10,1; was 10,6)
    "KY21: palo pysähtyi Honkaharjun metsäautotielle (klo 19.03) — EK16: kärki ylitti saman tien puuskissa (klo 19.22)", // revision (ak): KY21 held the road through the stop and reports it
    "DR3: palanut ala noin 24,3 ha (klo 14.35) — SPOT: palanut ala noin 160 ha (klo 18.40 jälkeen)", // SPEC/33 stage 9: 24,3 and 160 ha (were 17,8 and 140)
  ],
  none: "Mitkään raportit eivät olleet ristiriidassa",
} as const;
const CONTRADICTION_BACKUP_ARRANGED = arrangeSpamOptions(
  { 0: { prompt: CONTRADICTION_BACKUP_AUTHORED.prompt, key: CONTRADICTION_BACKUP_AUTHORED.key, distractors: [...CONTRADICTION_BACKUP_AUTHORED.distractors] as [string, string, string], saLevel: 2, contentKind: "situation" } },
  [0], FREEZE_BANK_SEED, "contradiction-backup",
)[0]!;
/** Shown: the four pairs in the seeded order, then "none" as e (always last). */
const CONTRADICTION_PAIRS: readonly string[] = [...CONTRADICTION_BACKUP_ARRANGED.options, CONTRADICTION_BACKUP_AUTHORED.none];

export const UNCERTAINTY_PROMPT_FI = "Onko nykyisessä tilannekuvassa jotain, josta olet epävarma tai jonka haluaisit tarkistaa?";

/**
 * V13's closed area item (revision (ai), 9 Oct 2026, researcher: no open-ended questions in the
 * session; reviewed by three professors). Replaces the open text: (a) the same non-leading question,
 * yes/no; (b) only on yes, "which part of the picture?", any number of the parts below. No option
 * names a report, a record, a conflict or a contradiction. The order is drawn once from the scenario seed (the same for everyone) at
 * the session (`app/session/option-order.ts`) and logged; "other" is always last.
 *
 * TRUTH (the invariant `contradiction.area_hit`, read only by the analysis): the contradiction is on
 * the north edge — SPOT's "Pohjoisreuna leimahtanut uudelleen" against EK14's "Oma linjamme pitää"
 * (EK14 holds the north flank; after the (ah) rebuild the flare-up is the north-edge holdover US2),
 * so the area hit is `north_edge` among the parts chosen.
 */
export const AREA_FOLLOW_UP_PROMPT_FI = "Mistä tilannekuvan osasta?";
export const AREA_OPTIONS: readonly { readonly id: string; readonly fi: string }[] = [
  { id: "north_edge", fi: "Pohjoisreuna" },
  { id: "east_old_head", fi: "Itäpuoli (vanhan kärjen puoli)" },
  { id: "southeast_front", fi: "Kaakkoisrintama" },
  { id: "west_bog", fi: "Länsipuoli" }, // `31` coa F11: terrain-neutral (was "… ja suo", one view before V14's west flare-up)
  { id: "units", fi: "Yksiköiden sijainnit tai tila" },
  { id: "weather", fi: "Sää" },
  { id: "projection", fi: "Leviämisennuste" },
  { id: "other", fi: "Muu" },
];
export const AREA_FIXED_LAST: readonly string[] = ["other"];
/** The part of the picture the contradiction concerns (the area item's key). */
export const CONTRADICTION_AREA_KEY = "north_edge";
export const COVERAGE_PROMPT_FI = "Kuinka varma olet, että palon todellinen kehitys pysyi sinulle näytettyjen ennusteiden sisällä?";

const options = (labels: readonly string[]) => labels.map((fi, i) => ({ id: "abcde"[i]!, fi }));

export interface ProbeScheduleBuild {
  readonly probes: ProbeSpec[];
  readonly invariants: ExpectedInvariant[];
  /** The probe ids of each main view, in presentation order. */
  readonly probeIdsByView: ReadonlyMap<number, readonly string[]>;
  readonly contradictionDetectionProbeId: string;
  readonly contradictionBackupProbeId: string;
}

/** The main views' probes (the practice view has none in the schedule). */
export function buildProbeSchedule(): ProbeScheduleBuild {
  const probes: ProbeSpec[] = [];
  const invariants: ExpectedInvariant[] = [];
  const probeIdsByView = new Map<number, string[]>();
  const add = (view: number, probe: ProbeSpec) => {
    probes.push(probe);
    probeIdsByView.set(view, [...(probeIdsByView.get(view) ?? []), probe.id]);
  };

  for (const v of MAIN_VIEWS) {
    const i = v.index;
    const cycle = i as CycleIndex;

    // 1. SPAM, online (the view's clock runs on): the prompt 25 s in, clear of the opening burst at 0 s
    //    (SPEC/15 §5's 15-s rule); it waits for "ready" or is forced at the view's end (revision (ag)),
    //    then 60 s to answer; never in a freeze view (delivered by the orchestrator, `SessionOrchestrator`'s SPAM part).
    const spam = SPAM_ITEMS[i];
    if (SPAM_VIEWS.has(i) && FREEZE_VIEWS.has(i)) throw new Error(`V${i}: a SPAM view cannot also carry a freeze`);
    if (SPAM_VIEWS.has(i) && spam) {
      invariants.push({ name: `spam.cycle_${i}`, expected: spam.correct, tolerance: 0 });
      add(i, {
        id: `probe.s.cycle_${i}`, type: "S", mode: "ONLINE", cycle, orderWithinCycle: 1, invariantName: `spam.cycle_${i}`,
        prompt: spam.prompt, response: { kind: "categorical", options: options(spam.options) },
        offsetInWorkingPeriodMs: SPAM_OFFSET_MS, answerTimeoutMs: SPAM_ANSWER_TIMEOUT_MS,
        collectsConfidence: true, contentKind: spam.contentKind, saLevel: spam.saLevel,
      });
    }
    // 2. (Type E, expectation marking, withdrawn with H6 — researcher decision, 6 Oct 2026.)
    // 3–4. (Type J and Type F withdrawn — revision (x), 6 Oct 2026: a view asks only for the sector plan.)
    // 5. Type U (SPEC/08 §3.5, revision (ai)): the closed area item at the contradiction, deliberately non-leading.
    if (i === CONTRADICTION_DETECTION_VIEW) {
      invariants.push({ name: "contradiction.area_hit", expected: CONTRADICTION_AREA_KEY, tolerance: 0 });
      add(i, {
        id: `probe.u.cycle_${i}`, type: "U", mode: "PROBING_VISIBLE", cycle, orderWithinCycle: 5, invariantName: "contradiction.area_hit",
        prompt: UNCERTAINTY_PROMPT_FI,
        response: { kind: "area_check", followUpPrompt: AREA_FOLLOW_UP_PROMPT_FI, options: AREA_OPTIONS, fixedLastIds: AREA_FIXED_LAST },
        collectsConfidence: false, contentKind: "situation", delivery: { at: "view_seconds", seconds: U_OPEN_AT_SECONDS },
      });
    }
    // 6. Type U backup and coverage confidence, the last view.
    if (i === CONTRADICTION_BACKUP_VIEW) {
      // TRUTH: the backup's key as shown, and whether the actual development stayed inside every projection (all 14 flags hold).
      invariants.push(
        { name: "contradiction.pair", expected: CONTRADICTION_BACKUP_ARRANGED.correct, tolerance: 0 },
        { name: "coverage.all_inside", expected: CANONICAL_FLAG_SEQUENCE.every((f) => f === "holds"), tolerance: 0 },
      );
      add(i, {
        id: `probe.u.cycle_${i}`, type: "U", mode: "PROBING_VISIBLE", cycle, orderWithinCycle: 5, invariantName: "contradiction.pair",
        prompt: CONTRADICTION_BACKUP_AUTHORED.prompt,
        response: { kind: "categorical", options: options(CONTRADICTION_PAIRS) }, collectsConfidence: true, contentKind: "situation", delivery: { at: "after_view" }, // confidence: revision (ai)
      });
      add(i, {
        id: `probe.u.coverage.cycle_${i}`, type: "U", mode: "PROBING_VISIBLE", cycle, orderWithinCycle: 6, invariantName: "coverage.all_inside",
        prompt: COVERAGE_PROMPT_FI, // answered on the one scale 25/50/75/100 (SPEC/15 r.6)
        response: { kind: "confidence", min: 0, max: 100 }, collectsConfidence: false, contentKind: "situation", delivery: { at: "after_view" },
      });
    }
  }

  return {
    probes,
    invariants,
    probeIdsByView,
    contradictionDetectionProbeId: `probe.u.cycle_${CONTRADICTION_DETECTION_VIEW}`,
    contradictionBackupProbeId: `probe.u.cycle_${CONTRADICTION_BACKUP_VIEW}`,
  };
}
