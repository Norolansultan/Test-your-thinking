/**
 * The demo scenario's story beats — SYNTHETIC PLACEHOLDER CONTENT (see `content/demo/README.md`):
 * short, invented Finnish text per 20-minute STEP, register not reviewed. Split out of
 * `demo-scenario.ts`; that file assembles them into views.
 *
 * SPEC/26 §6: pushed volume stays at 6–20 items per main view. A beat marked `recorded` is a
 * routine duplicate of pushed radio or traffic in an over-full view; it is recorded (T2, reachable
 * through Haku and search), not pushed. Load-bearing items are never demoted.
 */

import { asVirtualTime, type CycleIndex } from "../engine/primitives.js";
import type { SiteStep } from "./site-scenario.js";
import type { InfoAtom, NavCategoryId } from "./types.js";
import { viewOfStep } from "./views.js";

/** The five first-alarm units, which carry the filler traffic. Reinforcements join later (SPEC/18 §8.1). */
export const UNIT_IDS = ["EK11", "EK12", "EK14", "KY21", "VPK"] as const;
export type UnitId = (typeof UNIT_IDS)[number];

/**
 * Who else sends a story beat (fix pass 2, 7 Oct 2026, FF11): the duty officer P2 (the region's requests,
 * aviation), the helicopter, the out-of-region crew OUT1 — not EK11, who is a crew on the line. The play-test
 * decisions (24 Oct 2026) add the command post's situation picture (TILANNEKUVA: V9's area) and EK16 (its CO reading).
 */
type OtherSource = "P2" | "HELI1" | "OUT1" | "DRONERYHMÄ" | "TILANNEKUVA" | "EK16";

interface BubbleSeed {
  readonly authorUnitId: UnitId | "DR1" | "DR2" | "SPOT" | OtherSource;
  readonly text: string;
  /** SPEC/26 §6: a routine beat in an over-full view — recorded (searchable), not pushed. */
  readonly recorded?: true;
  /**
   * Play-test D9 (c), 24 Oct 2026: a crew's answer when asked (T3, "(kysyttäessä)", as the generated status answers): recorded, never
   * pushed, reachable by a search like every recorded record.
   */
  readonly asked?: true;
  /**
   * Revision (bk), 25 Oct 2026 (SPEC/30 (bk), H2 on the seek-dependent items): a beat that WAS pushed and is now recorded (T2, in Haku
   * and the Thinker), so that an H2 item's key must be sought. The generator's push cap still counts it (`view-traffic.ts`
   * `countsTowardCap`), so no other record moves into or out of the stream.
   */
  readonly heldForSeeking?: true;
  /** When it was observed, seconds into its step, where the text names a time (default 60 s × (index + 1)). */
  readonly atS?: number;
  /** The navigation category, where the default (the air for a drone or an aircraft, else the fire) would misfile it. */
  readonly nav?: NavCategoryId;
}

/** A drone's story beat (DR1, DR2): a sensor origin on the air nav. */
const isDrone = (id: string): boolean => id === "DR1" || id === "DR2";
/** A beat from the air (the spotter aircraft, the helicopter) or from above (the duty officer, the command post's situation picture): not a crew's. */
const isAbove = (id: string): boolean => id === "SPOT" || id === "HELI1" || id === "P2" || id === "TILANNEKUVA";
/** A story beat pushed to the message log: neither a routine beat demoted to the records, nor a crew's answer when asked, nor held for seeking. */
export const isPushedBeat = (b: Pick<BubbleSeed, "recorded" | "asked" | "heldForSeeking">): boolean => !b.recorded && !b.asked && !b.heldForSeeking;
/** Revision (bk): the beats the generator's push cap counts — the pushed ones and those held for seeking (they were pushed before (bk)). */
export const countsTowardCap = (b: Pick<BubbleSeed, "recorded" | "asked" | "heldForSeeking">): boolean => isPushedBeat(b) || b.heldForSeeking === true;

export const CYCLE_STORY: Readonly<Record<CycleIndex, { readonly title: string; readonly bubbles: readonly BubbleSeed[] }>> = {
  // Fix pass 7 (9 Oct 2026, researcher's open item): EK11, the first-arriving officer, hands command over to the participant, the incident
  // commander (was "Johtovastuu otettu", "command assumed", which said EK11 held command).
  // Radio CO-03 (SPEC/31): DR1 says the edge is already ~30 m across R1 at the head at 13:20, so EK11's 13:41 crossing along the edge
  // (radio 2.1) reads as a second point, not as news of the first (DRAFT Finnish, native check).
  // Play-test D9 (a), 24 Oct 2026 (DRAFT Finnish): no record said whether air support was coming, a commander's first question at
  // handover. The handover now says it: requested, at the region's other fire, P2's estimate 15.40 (HELI1 is first over the head at
  // 15.41, story 8.0, and DR1 and DR3 land for it at 15.39). Said in the handover rather than as a beat of its own: V1 pushes 18, the
  // generator's cap (`view-traffic.ts`), and one more beat would demote a generated V1 record to the records.
  // Revision (bk) considered and rejected (25 Oct 2026): holding the helicopter's ETA for seeking under a V4 item on air support — an item
  // that names the helicopter would make HELI1 salient before its step-9 line clearance, F7's truth record (a cue to H9; `demo-probes.ts`
  // rule 5, `freeze-new-l3.spec.ts`). The handover is unchanged.
  1: { title: "Komennon siirto", bubbles: [{ authorUnitId: "EK11", text: "Johtovastuu siirretty teille. Kärki koilliseen. EK14 ja KY21 tulossa. Sammutushelikopteri pyydetty; se on alueen toisella palolla, P2:n arvio perillä noin klo 15.40." }, { authorUnitId: "DR1", text: "Kuva päivitetty. Reuna on ylittänyt tien R1 kärjen kohdalla, noin 50 m tien pohjoispuolella." }] },
  // Review 6 Oct 2026 (D2 b): the fuel ahead of the head is on record before the V2 freeze (first bubble: pushed at 60 s,
  // the freeze is at 105 s). Against the fuel truth: the head at 13:40 is ~400 m from mature spruce to the north-east
  // (the step-6 crown run burns through it). EK14's line moves to the second bubble (pushed at 120 s).
  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): along the head's line (50°) the continuous Kuusimäki stand begins ~550 m ahead of
  // the 13:40 head, so "noin 500 m" (was 400 m); DR1's 13:20 edge is ~45 m north of R1 at the head ("noin 50 m", was 30 m); the esker
  // ignition is ~100 m ahead of the head (scenario-18.ts step 3, "noin 100 m", was 150 m).
  2: { title: "Linjan rakentaminen", bubbles: [
    { authorUnitId: "DR1", text: "Kärjen edessä koilliseen, noin 500 m päässä, alkaa tiheä kuusikko (Kuusimäki). Kärki etenee sitä kohti." },
    { authorUnitId: "EK14", text: "Aloitamme linjan pohjoisreunalle. Perääntymistie tarkistettu." },
  ] },
  // Play-test D9 (c), 24 Oct 2026 (DRAFT Finnish): no CO reading anywhere, though MPV25 draws the danger zones by CO (immediate danger
  // when the 15-minute limit of 75 ppm is exceeded). EK11 on the esker, ~70 m from the head on its right (south-east) flank, beside the
  // head's smoke rather than under it (the SW wind carries it north-east): a danger-area reading, under the limit, asked-only (T3).
  3: { title: "Toinen syttymä", bubbles: [
    { authorUnitId: "EK11", text: "Uusi savu Kuivakankaan harjulla, noin 100 m kärjestä. Syytä ei tiedossa." }, { authorUnitId: "SPOT", text: "Havaittu pieni liekki harjun laella." },
    { authorUnitId: "EK11", asked: true, atS: 480, nav: "yksikot", text: "EK11 (kysyttäessä): Häkämittari harjulla noin 25 ppm, savun kääntyessä hetkittäin noin 50 ppm. Raja 75 ppm ei ylity, työskentelemme ilman paineilmalaitteita." },
  ] },
  // Play-test D3, 24 Oct 2026 (DRAFT Finnish; V4 `crown_drops` had no basis on any surface): DR1 over the head at 14.27 names the fuel
  // ahead, as the fuel grids have it (`tools/topo-map/landcover.ts`: Kuusimäki's spruce 1.3–2.2 km from the origin on the head's bearing,
  // the head ~1.1 km out at 14.20; the birch–aspen strip along Koivuoja 2.25–2.45 km). The fuel only, never what the fire will do in it.
  4: { title: "Liittymä", bubbles: [
    { authorUnitId: "EK12", text: "Palot yhdistyneet. Vesipiste W1 valittu, matka pitkä." },
    { authorUnitId: "DR1", atS: 420, nav: "maasto", text: "Kärjen edessä alkaa pian Kuusimäen kuusikko, joka jatkuu koilliseen noin kilometrin. Kuusikon takana Koivuojan varressa on kapea koivikko ja haavikko." },
  ] },
  5: { title: "Kuusikkoon", bubbles: [{ authorUnitId: "EK12", text: "Kärki Kuusimäen kuusikon reunalla. Tiheä alikasvos, näkyvyys huono." }] },
  // Radio TE-08 (SPEC/31): an image is "saturoitunut", not "kylläinen" (chemistry). 6.0 is a V4 key record: unchanged (WP-6).
  // Play-test D7, 24 Oct 2026 (DRAFT Finnish): no forecast was ever pushed, though a commander hears the updates by radio. P2 relays the
  // 15.00 update's headline at 15.05 (the full forecast stays recorded, `evt.wx.03`, 15.03; `FORECAST_HEADLINE` in `freeze-bank.ts`
  // checks the two agree). The 16.00 update stays recorded only: its front and WNW turn would cue V7's rekindle item (H10).
  6: { title: "Latvapalo", bubbles: [
    { authorUnitId: "EK12", text: "Latvapalo alkanut. Vetäydymme, kipinöintiä havaittu 200-400 m eteenpäin." }, { authorUnitId: "DR1", text: "Lämpökameran kuva saturoitunut latvapalon kohdalla, reunaa ei erota." },
    { authorUnitId: "P2", atS: 300, nav: "saa", text: "Sääennusteen päivitys klo 15.00: tuuli kääntyy lounaasta etelän kautta kaakkoon klo 15.30–16.00 ja heikkenee samalla 4–5 m/s:iin." },
  ] },
  // Play-test D9 (b), 24 Oct 2026 (DRAFT Finnish): the reinforcements that arrive later were never dispatched on record. P2 at 15.30, after
  // EK11's request: the ETAs are their arrivals at the CP (EK15 radio 10, 16.22; EK16 and KY23 radio 11, 16.42–16.43). That the region
  // holds EK16 and KY23 on arrival is said when they arrive, as before.
  // Revision (bk), 25 Oct 2026 (SPEC/30 (bk)): the dispatch is held for seeking (recorded, T2: the alerting system's entry, not radio),
  // the key record of V5 `reinforcements`; the request (EK11's beat) stays pushed. The cap still counts it, so no other V5 record moves.
  7: { title: "Resurssit", bubbles: [
    { authorUnitId: "EK11", text: "Latvapalo laskeutunut Koivuojan koivikkoon, pintapalo jatkuu. Pyydetään lisäyksiköitä." },
    { authorUnitId: "P2", heldForSeeking: true, atS: 600, nav: "yksikot", text: "Lisäyksiköitä hälytetty: EK15 saapuu johtopaikalle arviolta klo 16.20, EK16 ja KY23 arviolta klo 16.40." },
  ] },
  // Fix pass 2–3 (FF11): the drone team reports that the helicopter has the airspace and its drones are down (fix pass 3:
  // was P2, who would not report the drones); EK14 is in the F3 radio dead zone at step 9, so the wind turn is the
  // helicopter's (it works the head and sees the north flank).
  // Radio CS-06 (SPEC/31): one spelling, "drooni", as the roster and the briefing.
  8: { title: "Ilmatuki", bubbles: [{ authorUnitId: "DRONERYHMÄ", text: "Helikopteri työskentelee kärjessä. Droonit laskeutuneet tien pohjoispuolelle." }] },
  9: { title: "Tuuli kääntyy", bubbles: [{ authorUnitId: "HELI1", text: "Tuuli kääntynyt kaakkoon, pohjoisreuna aktivoitunut kohti Karhujärveä." }, { authorUnitId: "EK11", text: "Mökkirannan mökkien käyttöaste ei tiedossa, poliisi pyydetty tarkistamaan." }] },
  10: { title: "Näennäinen hallinta", bubbles: [{ authorUnitId: "EK11", text: "Lohko 2 hallinnassa, lohko 1 lähes. Tuuli heikkenee ja kääntyy, pohjoisreuna etenee enää hitaasti matalana pintapalona, savu vähenee." }] }, // 8 Oct 2026: the thermal-inertia retune leaves the north edge moving ~3.5 m/min at 16:20–16:40 (DR3), not creeping in moss // no shower (2 Oct 2026): the lull is the wind easing and backing; control staged (2 Oct audit P4; fix pass 7, 9 Oct 2026: L2 at 16:20, L1 and L4 at 16:40) // VPK warm-ground cue withdrawn (SPEC/03 revision (g); SPEC/26 §5)
  // V8 (19 pushed): repeats EK11's pushed move to the CP "vapautuksen suunnittelu".
  11: { title: "Rauhallinen jakso", bubbles: [{ authorUnitId: "EK11", text: "Tilanne rauhallinen. Vapautusta suunnitellaan lohkolla 1.", recorded: true }] },
  // Reported from the air: KY21 and VPK were on L1B and could not see the origin's south edge. Revised 2 Oct 2026
  // (researcher, Kalajoki-type): the old edge flares up as the wind turns; the CA's new front is ~120 m SE of the
  // ignition point, just outside the burned edge (anchored to it 6 Oct 2026, D4; was ~200 m). The wind at 17:00 is
  // west-north-westerly since review fixes (ah), 9 Oct 2026 (the front passes; was south-westerly, "käännyttyä lounaaseen", A13):
  // "käännyttyä länsiluoteeseen".
  // Phase-B rebuild round 2 (5 Oct 2026, SPEC/27 §7.2 V9): SPOT's second pass gives the flare-up's size
  // and rate, recorded only (the existence stays pushed in the first bubble). Against the CA: the
  // rekindle is ~0.4 ha at 17:00 (radius 35 m) and 0.75 ha at 17:20 (step 12 truthDetached), its head
  // moving ~70 m in the step (~3.5 m/min); the wind is west-north-westerly 3 m/s ((ah)), so the edge runs ESE and the smoke drifts ESE.
  12: { title: "Uudelleensyttymä", bubbles: [
    { authorUnitId: "SPOT", text: "Avotulta ja savua syttymäkohdan kaakkoispuolella, vanhan eteläreunan ulkopuolella, noin 120 m syttymäkohdasta. Ei ollut kartalla. Vanha reuna on syttynyt uudelleen tuulen käännyttyä länsiluoteeseen." },
    // SPEC/31 §3.11 (D1, RC for the keys): the flames are the provisional table's at the rate SPOT states (3 m/min: Byram 2.5 m, band
    // 2–3 m; the CA's head 4.5 m/min gives the same band; `tools/fire-ca/flame-table.ts`, checked in `test/fire-ca/flame-table.spec.ts`).
    // Were "alle metrin". A direct attack on it is then a flank attack from the black (the panel keys it).
    { authorUnitId: "SPOT", recorded: true, atS: 600, text: "SPOT, toinen ylilento klo 17.10: syttymäkohdan kaakkoispuolen uusi palo noin 0,5–1 ha (lohko L3, syttymäkohdan kaakkoispuolella), pintapaloa karikkeessa, liekit 2–3 m. Reuna etenee itäkaakkoon, arviolta 3 m/min. Savu painuu itäkaakkoon." },
    // Play-test D5, 24 Oct 2026 (DRAFT Finnish): no area figure was pushed between 15.35 (76,4 ha) and 18.54 (SPOT ~160 ha). The command
    // post's situation picture at 17.05, in the generated situation pictures' form (`traffic.ts`, recorded from 18.15): the area the
    // 17.00 map draws, the fire model's area at the end of step 11 (checked against the bundle in `freeze-bank-b.ts`, `V9_PICTURE`);
    // the rekindle is not on that map (SPOT 17.01).
    { authorUnitId: "TILANNEKUVA", atS: 300, text: "Tilannekuva klo 17.05: palorajan kartta päivitetty yksiköiden ilmoitusten ja droonikuvien perusteella. Palanut ala noin 152,6 ha. Syttymäkohdan kaakkoispuolen uusi palo ei ole vielä kartalla." },
  ] },
  // Phase-B rebuild (4 Oct 2026): "the fire" is the new front, ~1.3 km from R2 in the CA at 17:20 (the old
  // fire's north-east corner is ~540 m from R2's north end, which the drones' later road reports measure).
  // Round 2 (5 Oct 2026): said by DR2, which orbits the new front in step 13 (was KY21, which now stays on
  // the north flank until step 14: no crew on the new front in V10).
  // D2 a (6 Oct 2026): R2's role is on record before the V10 freeze (its r2_meaning key cites this atom).
  // Radio DF-02 (SPEC/31): "uusi palo", not "uusi rintama" (a front), which pushed an implicit size cue in the view whose deciding
  // quantity (small) is on record only. Its R2 sentences (V10's `r2_meaning` key) are unchanged.
  // Play-test R3 (researcher 25 Oct 2026; DRAFT, native check): "Huoltotie R2 ajettavissa" (was "vielä ajettavissa", "still passable",
  // which read as "for now" and led all five play-test runs to V10 infra's "threatened" option): a plain current state for the L1 item.
  13: { title: "Uudelleenvakiinnutus", bubbles: [{ authorUnitId: "DR2", text: "Uusi palo etenee itään vanhan eteläreunan suuntaisesti. Huoltotie R2 ajettavissa, uusi palo runsaan kilometrin päässä tiestä. Huoltotie R2 on säiliöautojen vesikuljetusreitti." }] },
  // Phase-B rebuild: the dropped hinge rule 3 ("Ei vapauteta ennen lämpökameravarmistusta") is gone; the region's request stays.
  14: { title: "Konflikti", bubbles: [{ authorUnitId: "P2", text: "Alue pyytää KY21:tä toiselle palolle." }] },
  15: { title: "Syvyys", bubbles: [{ authorUnitId: "KY21", text: "Tien pohjoispuolella palo palaa syvällä kunttakerroksessa ja kantojen juurissa, 20–40 cm. Vesi ei imeydy kuivaan kunttaan. Harkitaan kasteluainetta." }] }, // round 2: soft hyphen removed (SPEC/27 §7.3 b); (al): the depth placed — KY21's line is on mineral soil, the drained peat of Rahkasuo ~170 m south of the road, beyond the fire until 19:00
  // V12 (20 pushed): OUT1/OUT2 report the bridge limit; the moves, SPOT's smoke column, DR1's hot
  // spots and VPK's evacuation to Lahdenkylä carry the wind event.
  16: { title: "Vahvistus", bubbles: [{ authorUnitId: "OUT1", text: "Uudet yksiköt saapumassa. Silta rajoittaa raskaan kaluston reittiä.", recorded: true }] },
  // Play-test D9 (c), 24 Oct 2026 (DRAFT Finnish): the forest road at 18.45, the second CO moment. EK16 holds it ~360 m south-east of the
  // head, downwind in the north-westerly (9 m/s, gusts 14): a danger-area reading near the limit, breathing apparatus ready (MPV25: the
  // immediate danger area begins when the 15-minute limit of 75 ppm is exceeded). Asked-only (T3), as EK11's at 14.08.
  17: { title: "Toinen tuulitapahtuma", bubbles: [
    { authorUnitId: "EK14", text: "Puuskat voimistuneet luoteesta. Lahdenkylän suunnalle liikettä.", recorded: true }, { authorUnitId: "SPOT", text: "Kärki etenee kaakkoon kohti Lahdenkylää.", recorded: true },
    { authorUnitId: "EK16", asked: true, atS: 300, nav: "yksikot", text: "EK16 (kysyttäessä): Häkämittari metsäautotiellä (Honkaharju) noin 45 ppm, savun painuessa tielle hetkittäin yli 100 ppm. Paineilmalaitteet valmiina, 15 minuutin raja 75 ppm ei vielä ylity." },
  ] },
  18: { title: "Ristiriita", bubbles: [{ authorUnitId: "SPOT", text: "Pohjoisreuna leimahtanut uudelleen, havaittu uutta savua ja liekkejä uran itäpuolella." }, { authorUnitId: "EK14", text: "Oma linjamme pitää, ei muutosta." }] },
  // Phase-B rebuild (4 Oct 2026): was EK14 (north edge) with "noin 200 m tiestä", against DR1's ~530 m
  // (19:26, recorded) and the CA (~520 m at 19:20, ~500 m at 19:40). Now EK12, on the south-east front,
  // says only that the front is heading for R2; the distance is in the drones' recorded road reports.
  // Round 2 (5 Oct 2026): the second rekindle (scenario-18.ts step 19, sector L4). Fix pass 2 (7 Oct 2026, FC3): its
  // existence is pushed by SPOT's evening patrol (DR2 stays over the south-east front, DR1 over Lahdenkylä), and its
  // size is SPOT's second pass, recorded only (as at step 12; SPEC/27 §7.1). Against the CA: ~0.3 ha at 19:20, the
  // north-westerly drives the smoke south-east. At step 20 SPOT reports its state again, without a size (P2-6), so the
  // deciding fire stays on the radio after V14's boundary.
  19: { title: "Väsymys", bubbles: [
    { authorUnitId: "EK11", text: "Miehistö kentällä yli seitsemän tuntia. Kierto käynnissä." },
    { authorUnitId: "EK12", text: "Kaakkoisrintama etenee kohti huoltotietä R2. Jos palo pääsee tielle, vesikuljetusreitti katkeaa." },
    { authorUnitId: "SPOT", text: "Uutta savua ja liekkejä syttymäkohdan länsipuolella, vanhan länsireunan ulkopuolella, noin 130 m syttymäkohdasta. Vanha reuna on syttynyt uudelleen." },
    // SPEC/31 §3.11 (D1): the table's flames at the flare-up's own advance (the CA's US3: ~35 m in 19:40–20:00, ~1.75 m/min; Byram
    // 1.9 m, band 1–2 m; checked in `test/fire-ca/flame-table.spec.ts`). Were "alle metrin". Still within a hose line's reach.
    { authorUnitId: "SPOT", recorded: true, atS: 600, text: "SPOT, toinen ylilento klo 19.30: syttymäkohdan länsipuolen uusi palo noin 0,3 ha, pintapaloa karikkeessa, liekit 1–2 m. Savu painuu kaakkoon." },
  ] },
  20: { title: "Luovutus", bubbles: [
    { authorUnitId: "EK11", text: "Yöorganisaatio ottaa vastuun klo 20. Tilanne kirjattu." },
    { authorUnitId: "SPOT", text: "Syttymäkohdan länsipuolen uudelleensyttymä palaa edelleen, liekkejä näkyy. Savu painuu kaakkoon Rahkasuon suuntaan." },
  ] },
};

export const BRANCH_TEMPLATES: readonly [string, string, string, string] = [
  "Palo hidastuu ja pysyy nykyisten linjojen sisällä.",
  "Kärki jatkaa samaan suuntaan, nopeus kasvaa hieman.",
  "Uusi kehitys ilmenee alueella, jota ei ole vielä havaittu.",
  "Palo jakautuu kahteen suuntaan nykyisestä kärjestä.",
];

/**
 * A step's story bubbles as atoms, delivered `offsetS` seconds into the view (SPEC/26 §6).
 * `pushed` lists the ones pushed, with their offsets; `recorded` beats are atoms but not pushed.
 */
export function storyAtoms(step: number, offsetS: number, perimeter: SiteStep["reported"]): { atoms: InfoAtom[]; pushed: { id: string; t: number }[] } {
  const story = CYCLE_STORY[step as CycleIndex];
  const atoms: InfoAtom[] = [];
  const pushed: { id: string; t: number }[] = [];
  story.bubbles.forEach((seed_, bIdx) => {
    const id = `atom.demo.${step}.${bIdx}`;
    const at = (step - 1) * 1200 + (seed_.atS ?? 60 * (bIdx + 1));
    const sourceIsUnit = (UNIT_IDS as readonly string[]).includes(seed_.authorUnitId) || ["OUT1", "P2", "EK16"].includes(seed_.authorUnitId);
    const isPushed = isPushedBeat(seed_);
    atoms.push({
      id,
      // A crew's answer when asked is T3, as the generated status answers (`traffic-atoms.ts`): recorded, asked of the unit.
      tier: isPushed ? "T1_pushed" : seed_.asked ? "T3_person" : "T2_system",
      origin: isDrone(seed_.authorUnitId) ? "sensor" : isAbove(seed_.authorUnitId) ? "above" : "below",
      cycle: step as CycleIndex,
      loadBearing: false,
      navCategory: seed_.nav ?? (isDrone(seed_.authorUnitId) || seed_.authorUnitId === "SPOT" || seed_.authorUnitId === "HELI1" || seed_.authorUnitId === "DRONERYHMÄ" ? "ilma" : "palo"),
      routes: isPushed
        ? { directed: { kind: "pushed" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "pushed" } }
        : seed_.asked
          ? { directed: { kind: "ask_unit", unitId: seed_.authorUnitId }, assistive: { kind: "ask_unit", unitId: seed_.authorUnitId }, substitutive: { kind: "free_text", exampleQueries: [seed_.authorUnitId] } }
          : { directed: { kind: "browse", surface: "situation_log" }, assistive: { kind: "browse", surface: "situation_log" }, substitutive: { kind: "free_text", exampleQueries: [seed_.authorUnitId.toLowerCase()] } },
      record:
        isDrone(seed_.authorUnitId)
          ? { kind: "aerial_observation", platform: "drone", platformId: seed_.authorUnitId, at: asVirtualTime(at), geometry: perimeter, text: seed_.text, available: true }
          : { kind: "situation_log", entryId: `log.${id}`, authorUnitId: seed_.authorUnitId, text: seed_.text },
      provenance: {
        sourceId: seed_.authorUnitId,
        sourceClassId: sourceIsUnit ? "sc.experienced" : "sc.sensor",
        sourceReliability: "known-good",
        observedAt: asVirtualTime(at),
        recordedAt: asVirtualTime(at + 30),
        deliveredAt: isPushed ? asVirtualTime(at + 30) : null,
        certainty: { kind: "confirmed" },
        supports: [],
        contradicts: [],
      },
      degradation: [],
      retrievalKeys: [seed_.authorUnitId.toLowerCase(), ...seed_.text.toLowerCase().split(/\s+/).slice(0, 4)],
      truth: { isGroundTruth: true, isDecoy: false, relevantInvariants: [`containment.cycle_${viewOfStep(step)!.index}`] },
    });
    // In the log at the clock it states (`atS`, the play-test records of 24 Oct 2026); every beat of a step still arrives in its step's burst.
    if (isPushed) pushed.push({ id, t: offsetS + (seed_.atS ?? 60 * (bIdx + 1)) });
  });
  return { atoms, pushed };
}
