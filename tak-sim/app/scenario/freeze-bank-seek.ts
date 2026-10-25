/**
 * Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk), SPEC/09 (bk), SPEC/08 (bk)): the phase-A freeze items converted to
 * SEEK-DEPENDENT items so that H2's primary test (the confidence–accuracy gap on the audit's seek-dependent items) holds more of H2's 23
 * items: 9 (was 5), four converted where criteria (a)–(f) allowed. V5 `hose_short` is converted by its record alone (EK11's 15.35 hose request held for seeking, `view-traffic.ts`) and
 * stays in `freeze-bank.ts`; these three are defined here, each at its old place in its freeze (so the option arrangement's draws, and
 * every other item's order, are unchanged):
 *
 * - V2 `south_flank` (L2): EK12's 14.08 report held for seeking; the stale 13.20 state is a distractor (`flames`, was `lost`).
 * - V5 `reinforcements` (L3, replaces `wind_shift`): P2's dispatch held for seeking (the request stays pushed).
 * - V7 `north_help` (L2, re-keyed, slug kept): EK14's line access, on record only in its lateral line to EK15.
 *
 * Every converted item keeps safety in the stream (no crew danger, withdrawal, entrapment or live-line warning moves), is findable with two
 * natural questions per language (`tools/review/seek-questions.ts`, `test/retrieval/seek-items-retrieval.spec.ts`), and has a stale or
 * partial pushed state as a distractor, so a non-searcher's default is not the key. DRAFT Finnish, for the native and domain review.
 * Considered and rejected: V4 (every V4 key rests on the crown run's safety lines, the withdrawals and the spotting, which stay pushed; an
 * air-support item on the helicopter's ETA would make HELI1 salient before F7's truth record, a cue to H9).
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { choice, withinHorizonFi, type ItemDef } from "./freeze-bank-core.js";
import { storyId, trafficId } from "./freeze-keys.js";

/**
 * Revision (bk), 25 Oct 2026 (SPEC/30 (bk)): the recorded key records of the two re-authored seek-dependent items — P2's dispatch (V5
 * `reinforcements`, held for seeking) and EK14's access line to EK15 (V7 `north_help`, lateral). The dispatch item's key: every
 * reinforcement P2 names at the CP by step 11 (radio), the out-of-region tankers not before step 16.
 */
export const DISPATCH = storyId(7, /^Lisäyksiköitä hälytetty: EK15 saapuu johtopaikalle arviolta klo 16\.20, EK16 ja KY23 arviolta klo 16\.40/);
export const EK14_ACCESS = trafficId(10, /^EK15, EK14: meille ei pääse autolla lähemmäs kuin \d+ m, ajoura on pehmeä\. Jos tuotte letkua, kantakaa kaakosta/);
const REINFORCEMENTS_KEY = (() => {
  const arrival = (id: string) => SITE_SCENARIO.radio.find((r) => r.from === id && /^\w+: saavuimme /.test(r.text))?.cycle ?? Number.POSITIVE_INFINITY;
  const by11 = ["EK15", "EK16", "KY23"].filter((id) => arrival(id) <= 11).length;
  if (by11 !== 3 || Math.min(arrival("OUT1"), arrival("OUT2")) <= 11) throw new Error(`freeze key V5 reinforcements: ${by11} of EK15, EK16, KY23 at the CP by step 11, or OUT1/OUT2 before it; re-author the item`);
  return "three";
})();

export const SOUTH_FLANK: ItemDef = choice({
  // `31` F10: replaces fuel_ahead (DR1's 'tiheä kuusikko' recalled, and a cue to spruce_behaviour); two EK12 reports integrated.
  // FOR THE RESEARCHER (20 Oct 2026, the phase-A flame table): EK12's 14.06 report now states the table's "liekit 2–3 m" (was
  // "0,3–1 m"), while its 14.08 report still says "matalaa paloa" (a descriptor, not a band) and the key's option reads "Reuna pysyy
  // matalana". The key is unchanged ("held_low"; the other options stay false); whether the option or the item is re-worded is yours.
  slug: "south_flank", level: "L2", goal: "containment", promptFi: "Mitä EK12:n ilmoitukset kertovat kärjen eteläsivustan tilanteesta?",
  // Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk); DRAFT, native check): seek-dependent. EK12's 14.08 report is held
  // for seeking (`view-traffic.ts` HELD_FOR_SEEKING), so the latest PUSHED EK12 report is 13.20's (V1: flames 2–3 m, moving east), which
  // the new option `flames` states — the stale state a non-searcher holds (was `lost`, "the flank is lost, the fire spreads south").
  options: [
    ["held_low", "Reuna pysyy matalana, mutta kärki pääsee ohi"], ["stopped", "Kärki on pysäytetty EK12:n linjaan"],
    ["flames", "Sivustalla palaa 2–3 metrin liekein, reuna etenee itään"], ["dry", "Vesi on loppunut, ja linja on keskeytetty"],
  ], key: "held_low",
  // SPEC/33 stage 9 (20 Oct 2026): the generated EK12 reports changed with the fire; the "kärki menee ohitsemme" report (13.51) is
  // recorded, step 2. Revision (bk): the key records are the two recorded reports that state it (13.51, reachable from the view's start,
  // and 14.08, from its boundary; either suffices, so the item is not late); the pushed 13.20 one is the lure's basis.
  keyAtomIds: [trafficId(2, /^EK12, kärki, eteläsivusta: kärki etenee koilliseen meidän ohi, omalla pätkällämme matalaa paloa/), trafficId(3, /^EK12, kärki, eteläsivusta: pintapaloa kuivaa männikkökangasta, liekit 1–2 m\. Letkulinja \d+ m, paine riittää/)], rule: "cited",
  basis: "revision (bk), seek-dependent: EK12's recorded 13.51 report 'kärki etenee koilliseen meidän ohi, omalla pätkällämme matalaa paloa' states the key, and its recorded 14.08 report (held for seeking since (bk)) a surface fire in dry pine heath, flames 1–2 m, the 680 m line with pressure enough; the latest PUSHED EK12 report is 13.20's (V1: flames 2–3 m, moving east, the head ~300 m to its north), the stale state option `flames` states; EK13 refilled EK12's basin at 14.01 (recorded; the 13.4x 'water running out' report is the `dry` lure for a partial search)",
});

export const REINFORCEMENTS: ItemDef = choice({
  // Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk); DRAFT, domain and native review): replaces `wind_shift` (its stem
  // stated the premise, "if the wind blows from the south", and it sat beside `ek14_shelter` on the same turn, `11` §7.x). A seek-dependent
  // projection of a non-critical resource: P2's dispatch (story 7.1) is held for seeking; pushed is only EK11's "Pyydetään lisäyksiköitä"
  // (the `none` state). Truth: EK15 at the CP at 16.22 (radio 10), EK16 and KY23 at 16.42–16.43 (radio 11), held for the region on arrival.
  slug: "reinforcements", level: "L3", goal: "resources", keySteps: [7, 11], promptFi: `Mitä lisäyksiköitä palolle on saapunut ${withinHorizonFi(5, 11)}?`,
  options: [
    ["three", "Kolme hälytettyä pelastusyksikköä"], ["none", "Ei vielä yhtään: lisäyksiköitä on vasta pyydetty"],
    ["one", "Yksi säiliöauto naapuriasemalta"], ["heavy", "Raskaat säiliöyksiköt alueen ulkopuolelta"],
  ], key: REINFORCEMENTS_KEY,
  keyAtomIds: [DISPATCH], rule: "cited", basisKind: "record", basisAtomIds: [DISPATCH],
  basis: "SPEC/30 §5.1 (DRAFT), revision (bk): P2's 15.30 dispatch (story 7.1, held for seeking: recorded, T2): EK15 at the CP at about 16.20, EK16 and KY23 at about 16.40; pushed is only EK11's request (story 7.0); EK15 arrives at 16.22 (radio 10.2), EK16 and KY23 at 16.42–16.43 (radio 11; the region holds both on arrival, said then); OUT1 and OUT2 come at step 16",
});

export const NORTH_HELP: ItemDef = choice({
  // Revision (bk), 25 Oct 2026 (researcher decision; SPEC/30 (bk); DRAFT, domain and native review): re-keyed, seek-dependent (was "what
  // KY21's and VPK's move means for EK14", whose stem stated the moves and so the key). The slug is kept (a logged id; still help for the
  // north edge). What sending a unit to EK14's line involves is on record only in EK14's lateral line to EK15 (`EK14_ACCESS`, T4); pushed
  // is EK14's own move through the burned area in its terrain vehicle (radio 10.5) — the `burned` state a non-searcher holds.
  slug: "north_help", level: "L2", goal: "resources", promptFi: "Mitä toisen yksikön lähettäminen EK14:n avuksi pohjoisreunalle vaatii viimeisimpien tietojen mukaan?",
  options: [
    ["carry", "Autolla ei pääse linjalle asti: kalusto kannetaan kaakosta"], ["burned", "Paloauto pääsee palaneen alueen kautta linjalle asti"],
    ["track", "Ajoura kantaa raskaankin auton linjan viereen"], ["cut", "Linjalle ei pääse lainkaan, palo on katkaissut reitin"],
  ], key: "carry",
  keyAtomIds: [EK14_ACCESS], rule: "cited",
  basis: "revision (bk), seek-dependent: EK14's lateral line to EK15 (recorded, T4): a vehicle gets no closer to its line than about 300 m, the track is soft, hose is carried in from the south-east; pushed are only EK14's moves (radio 10.1, 10.5: through the burned area in its own terrain vehicle, the `burned` state) and EK15 waiting at the CP for a task; the route is not cut (EK14 is on the line)",
});
