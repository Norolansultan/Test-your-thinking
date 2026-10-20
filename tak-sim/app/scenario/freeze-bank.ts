/**
 * The goal-based freeze item bank, VP and phase A (SPEC/08 amendment 2 Oct 2026); phase B is in
 * `freeze-bank-b.ts`. It replaces the two items every freeze repeated ("Missä yksikkö EK11
 * viimeksi raportoitiin olevan?", "Mikä lohko on tällä hetkellä eniten uhattuna?").
 *
 * Each phase-A freeze (V2, V4, V5, V7) has eight items, 2×L1, 2×L2, 4×L3 (SPEC/30 §5.1); each phase-B freeze six, 2×L1, 2×L2, 2×L3;
 * the infrastructure item (or, at V12, F7 as the L2 implication item) is added by `demo-probes.ts`; the practice freeze has four, one
 * per format and level. A merged view's map draws its FIRST step's fire and its SECOND step's units (`demo-map.ts`), and every pushed
 * item of both steps has arrived before the freeze.
 *
 * `31` (19 Oct 2026, the SA probe audit decided; DRAFT for the domain and native review):
 * - the six phase-A L2 items are rewritten as comprehension items that integrate two records or relate one to a goal (F10):
 *   `ek11_between`, `south_flank` (V2), `head_unattended` (V4), `lines_breached`, `hose_short` (V5), `north_help` (V7);
 * - V4 `growth_next` is replaced by `return_danger` (F01, RC): its report-keyed and truth bands could not agree (the reports lag the
 *   crown run four-fold), and its basis was never drawn;
 * - report-keyed keys read only delivered reports (`deliveredAreaAt`, `deliveredPointDistanceAt`, `trafficFigure`; rule (1)), with
 *   the truth in the same band; every L3 stem names its horizon (F08); ordinal bands ascend (F11); V2's map horizon is an hour (F03);
 *   `ek14_shelter` comes before `wind_shift` and no longer names the forecast (F07); polarity-balanced options (F15); distractors (F06,
 *   F24); `relief_next` keyed on pushed arrival records (F19); basis figures computed here (F22).
 * No item names a tool, and no option names anything not knowable at its view (`freeze-items.spec.ts`, `freeze-bank.spec.ts`).
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { sortedEntries } from "../engine/deterministic-object.js";
import { choice, headLaterFi, inMinutesFi, minutesAhead, point, withinMinutesFi, type ItemDef } from "./freeze-bank-core.js";
import { PHASE_B_BANK } from "./freeze-bank-b.js";
import {
  deliveredAreaAt, deliveredPointDistanceAt, distanceM, distanceToLineM, distanceToTruthM, firstDetachedFrontAfter, headNow, keyBand, projectionHeadAtEndOf, R1_LINE, radioId, siteStep,
  trafficFigure, trafficId, truthHeadAtEndOf, type KeyBand,
} from "./freeze-keys.js";

const F = SITE_SCENARIO.features;

/**
 * Crew radio key atoms, found by content (`radioId`): their indices shift whenever the radio is regenerated. Radio ST-07 (SPEC/31; 20 Oct
 * 2026): the three moves below are said as speech now ("EK11: siirrymme …", "EK11: vetäydymme …"; were "EK11 siirtyy …", "EK11 vetäytyy
 * …"), the same records (`test/scenario/freeze-bank.spec.ts`).
 */
const RADIO = {
  ek11Ridge: radioId(3, /^EK11: siirrymme .*harjulle/),
  ek11Withdraws: radioId(6, /^EK11: vetäydymme .*latvapalo/),
  ek12Withdraws: radioId(6, /^EK12: vetäydymme .*palaneelle alueelle/), // review fixes (ah): to R1 in the black (was the R1/R2 junction)
  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): no forest road crosses the crown run's path at Kuusimäki any more, so the step-7
  // "Kipinät lensivät metsäautotien (Kuusimäki) yli" crossing and its step-8 repeat are gone; the step-7 Koivuoja stop and the step-8
  // ember crossing of Koivuoja carry V5's two crossing items instead.
  sparksKorpioja: radioId(7, /^Kipinät lensivät Korpiojan yli/),
  koivuojaStop: radioId(7, /^Palo pysähtyi Koivuojan kohdalle/),
  koivuojaSparks: radioId(8, /^Kipinät lensivät Koivuojan yli/),
  ky21North: radioId(10, /^KY21, lohkon L3 johtaja: .*siirrän .*KY21:n ja VPK:n nyt pohjoisreunalle/), // fix pass 3: the L3 sector leader moves KY21 and VPK (FF11)
  vpkNorth: radioId(10, /^VPK: lohkonjohtaja KY21:n käskystä siirrymme nyt pohjoisreunalle/),
  ek14North: radioId(10, /^EK14: siirrymme pohjoisreunalle Karhujärven suuntaan/),
  ek14Arrives: radioId(2, /^EK14: saavuimme pohjoisreunalle/),
  ky21Arrives: radioId(3, /^KY21: saavuimme syttymäkohdan eteläreunalle/),
};

const HEAD_NOW_FI = "Merkitse kartalle palon kärki.";
const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => n.toFixed(0);
/** A report-keyed key's figures for its basis text (F22): the delivered value, its margin, and the truth's value and band. */
const figures = (k: KeyBand, unit: string, fmt = f1) => `~${fmt(k.value)} ${unit}, ${fmt(k.margin)} ${unit} from the nearest band edge; the CA's truth ~${fmt(k.truthValue!)} ${unit}, ${k.truthId === k.id ? "the same band" : `band ${k.truthId}`}`;

/** VP: the minutes the head needs to reach R1 at its reported rate (the W2 head and its rate mark). */
const R1_ARRIVAL = (() => {
  const s = siteStep(-3);
  const m = distanceToLineM(headNow(-3), R1_LINE);
  const minutes = m / s.observedHead.rateMpm;
  return { m, rate: s.observedHead.rateMpm, minutes, key: minutes < 15 ? "lt15" : minutes < 30 ? "m15_30" : minutes < 60 ? "m30_60" : "gt60" };
})();

/**
 * V2 (now 14.00; REPORT-keyed, D4; `31` rule (1)): the burnt area 40 minutes on (14.40, the end of step 4) through the reported fire the
 * maps of V1 and V2 draw (steps 1 and 2; V2's second step is not drawn). Edges 15/25/35 (`31` §3.5: were 15/22/30, where the CA's ~23 ha
 * fell in another band than the reports' ~18.5 ha). SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): edges 20/35/50 (were 15/25/35, where the
 * reports' ~24.8 ha lay 0.2 ha from the 25 edge); the reports give ~24.8 ha, the truth ~29.7 ha, both in 20–35; the map now (~13.7 ha) and
 * DR3's recorded 14.15 survey (18.3 ha) are the lures, under 20.
 */
export const V2_AREA = keyBand(deliveredAreaAt(1, 2, 4), [20, 35, 50], ["lt20", "m20_35", "m35_50", "gt50"], 2, "V2 area_40", { value: siteStep(4).areaHa, minMargin: 2 });

/**
 * V5 (now 15.20; REPORT-keyed, D4): the burnt area an hour on (16.20, the end of step 9): the pushed 15.35 perimeter survey (DR3: the
 * area and the last 20 minutes' new area, comparing the 15.00 and 15.20 images) carried on for three steps. The map draws step 7 too.
 */
const V5_SURVEY = {
  area: trafficFigure(7, /^DR3 kehäkartoitus valmis klo 15\.35: palanut ala noin (\d+,\d) ha/),
  added: trafficFigure(7, /^DR3 kehäkartoitus valmis klo 15\.35: .*\((\d+,\d) ha uutta/),
};
// SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): edges 90/140/190 (were 80/110/140, where the survey's 76.4 + 3 × 35.8 ≈ 184 ha and the
// truth's ~148 ha both fell in the open top band, which has no key statements); both now in 140–190, the map now (~77 ha) under 90.
export const V5_AREA = keyBand(V5_SURVEY.area.value + 3 * V5_SURVEY.added.value, [90, 140, 190], ["lt90", "m90_140", "m140_190", "gt190"], 5, "V5 area_hour", { value: siteStep(9).areaHa, minMargin: 5 });

/**
 * V2 (SPEC/30 §5.1; REPORT-keyed, D4; `31` rule (1)): the reported fire's distance to the R1/R2 junction (where the water-shuttle road
 * R2 meets R1) an hour from now (15.00, the end of step 5), through the maps of V1 and V2 (steps 1 and 2). The map now (~950 m) is the lure.
 */
export const V2_JUNCTION = keyBand(deliveredPointDistanceAt(1, 2, 5, F["R1_R2"]!), [400, 700, 1000], ["lt400", "m400_700", "m700_1000", "gt1000"], 50, "V2 junction_hour", { value: distanceToTruthM(5, F["R1_R2"]!), minMargin: 50 });

/** The distance options of the junction item (the labels V10's R2 item uses; English in `labels.en.json`), ascending (F11). */
const JUNCTION_BANDS: readonly (readonly [string, string])[] = [["lt400", "Alle 400 metrin päässä"], ["m400_700", "400–700 metrin päässä"], ["m700_1000", "700–1000 metrin päässä"], ["gt1000", "Yli kilometrin päässä"]];

/** V7: the CA fire keeps away from the cabins for the next hour (steps 10–12); a regenerated fire that reaches them fails the build (re-author). */
function cabinsReachKey(): string {
  const nearest = Math.min(...[10, 11, 12].map((st) => distanceToTruthM(st, F["CABINS"]!)));
  if (nearest < 300) throw new Error(`freeze key V7 cabins_reach: the CA fire comes within ${nearest.toFixed(0)} m of the cabins; re-author the item`);
  return "no";
}

/**
 * V7 (SPEC/30 §5.1): the command post stays clear for the next hour from the freeze's now (steps 10–12) when the CA fire keeps over 300 m
 * from it (it keeps ~760 m). A regenerated fire that comes nearer fails the build: the item's key would change, so it is re-authored.
 */
function cpSafeKey(): string {
  const nearest = Math.min(...[10, 11, 12].map((st) => distanceToTruthM(st, F["CP"]!)));
  if (nearest < 300) throw new Error(`freeze key V7 cp_safe: the CA fire comes within ${nearest.toFixed(0)} m of the CP; re-author the item`);
  return "stays";
}

/**
 * V7 `relief_next` (`31` F19): the crews' time on scene at 16.20 from PUSHED records only — VPK's and EK12's own "olemme olleet täällä"
 * at 13.2x (V1) and EK14's and KY21's arrival radios (V2) — against EK11's pushed relief request at 4.5 h. The key is the crew with the
 * most time after EK11, at least half an hour ahead of the next (a close call fails the build).
 */
const RELIEF = (() => {
  const now = 16 * 60 + 20;
  const onScene = (h: number, at: number) => h + (now - at) / 60;
  const vpk = trafficFigure(1, /^VPK, syttymäkohdan eteläreuna: olemme olleet täällä noin (\d+,\d) h/);
  const ek12 = trafficFigure(1, /^EK12, kärki, eteläsivusta: olemme olleet täällä noin (\d+,\d) h/);
  const hours: Readonly<Record<string, number>> = {
    VPK: onScene(vpk.value, 13 * 60 + 22), EK12: onScene(ek12.value, 13 * 60 + 20), EK14: onScene(0, 13 * 60 + 41), KY21: onScene(0, 14 * 60 + 1),
  };
  const ranked = sortedEntries(hours).sort((a, b) => b[1] - a[1]);
  if (ranked[0]![1] - ranked[1]![1] < 0.5) throw new Error(`freeze key V7 relief_next: no clear next crew (${JSON.stringify(ranked)})`);
  return { key: ranked[0]![0], hours, ids: [vpk.id, ek12.id] };
})();

export const PRACTICE_BANK: readonly ItemDef[] = [
  point({
    slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_FI, point: headNow(-3),
    keyAtomIds: ["evt.vp.002", "evt.vp.008"], rule: "computed", basis: "the observed head W2 draws (observedHead.anchor)",
  }),
  choice({
    slug: "first_target", level: "L2", goal: "values", promptFi: "Mihin kohteeseen palo ehtii ensimmäisenä, jos se jatkaa nykyiseen suuntaan?",
    options: [["r1", "Tie R1"], ["cabins", "Mökkiranta"], ["village", "Lahdenkylä"], ["w1", "Haukilampi (W1)"]], key: "r1",
    keyAtomIds: ["evt.vp.002", "evt.vp.003", "evt.vp.011"], rule: "cited",
    basis: "EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east",
  }),
  choice({
    // `31` F27: one form, "kuluttua", in every option (the distractors said "-ssa"). The horizon is the answer itself (a time to arrival).
    slug: "r1_arrival", level: "L3", goal: "containment", keySteps: [-3, -3], promptFi: "Kuinka pian palon kärki saavuttaa tien R1, jos se etenee nykyistä vauhtia?",
    options: [["lt15", "Alle 15 minuutin kuluttua"], ["m15_30", "15–30 minuutin kuluttua"], ["m30_60", "30–60 minuutin kuluttua"], ["gt60", "Yli tunnin kuluttua"]], key: R1_ARRIVAL.key,
    keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [-3],
    basis: `the drawn W2 head's distance to R1 (~${f0(R1_ARRIVAL.m)} m) ÷ its drawn rate (${R1_ARRIVAL.rate} m/min) ≈ ${f0(R1_ARRIVAL.minutes)} min; the CA head is at R1 at 13.20 (step 1)`,
  }),
];

export const PHASE_A_BANK: Readonly<Record<number, readonly ItemDef[]>> = {
  2: [
    point({
      slug: "ek11_point", level: "L1", goal: "safety", promptFi: "Merkitse kartalle, missä EK11 työskentelee nyt.", point: siteStep(3).units["EK11"]!,
      keyAtomIds: [RADIO.ek11Ridge], rule: "computed", basis: "EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker)",
    }),
    choice({
      // `31` F10: replaces nearest_head (EK11 nearest the head, one record recalled); comprehension: EK11's place against the new ignition.
      slug: "ek11_between", level: "L2", goal: "safety", promptFi: "Mitä harjun uusi palo merkitsee siellä työskentelevälle EK11:lle?",
      options: [
        ["between", "EK11 voi jäädä kärjen ja uuden palon väliin"], ["head", "EK11 pääsee nyt sammuttamaan kärkeä edestä"],
        ["south", "EK11 joutuu siirtymään eteläsivustalle"], ["out", "Uusi palo on sammunut, EK11 palaa kärkeen"],
      ], key: "between",
      // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): on the new esker EK11 works the head's right (south-east) flank, so its 14.03 report
      // says "oikealla sivustalla" (was "vasemmalla"); the new ignition is ~100 m ahead of the head (was ~150 m).
      keyAtomIds: [RADIO.ek11Ridge, "atom.demo.3.0", trafficId(3, /^EK11, Kuivakangas: olemme kärjen oikealla sivustalla/)], rule: "cited",
      basis: "integrates EK11's move to the new ignition on the esker (radio 3.0, pushed), the new smoke ~100 m from the head (story 3.0, pushed) and EK11's own place ~50 m from the head on its right flank (14.03, pushed): a crew between the head and a fire ahead of it can be cut off (EK11's recorded 14.05 radio: it will not go between them)",
    }),
    choice({
      // `31` F10: replaces fuel_ahead (DR1's 'tiheä kuusikko' recalled, and a cue to spruce_behaviour); two EK12 reports integrated.
      // FOR THE RESEARCHER (20 Oct 2026, the phase-A flame table): EK12's 14.06 report now states the table's "liekit 2–3 m" (was
      // "0,3–1 m"), while its 14.08 report still says "matalaa paloa" (a descriptor, not a band) and the key's option reads "Reuna pysyy
      // matalana". The key is unchanged ("held_low"; the other options stay false); whether the option or the item is re-worded is yours.
      slug: "south_flank", level: "L2", goal: "containment", promptFi: "Mitä EK12:n ilmoitukset kertovat kärjen eteläsivustan tilanteesta?",
      options: [
        ["held_low", "Reuna pysyy matalana, mutta kärki pääsee ohi"], ["stopped", "Kärki on pysäytetty EK12:n linjaan"],
        ["lost", "Sivusta on menetetty, palo leviää etelään"], ["dry", "Vesi on loppunut, ja linja on keskeytetty"],
      ], key: "held_low",
      // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): the generated EK12 reports changed with the fire. By the V2 freeze EK12 has pushed
      // two: 13.20 (flames 2–3 m on its stretch, the head ~300 m to its north) and 14.08 (surface fire in dry pine heath, flames 1–2 m, its
      // 680 m line with pressure enough); the "lipsuu paikoin" (13.48) and "kärki menee ohitsemme" (13.51) reports are recorded, step 2.
      // The key is unchanged.
      keyAtomIds: [trafficId(1, /^EK12, kärki, eteläsivusta: olemme olleet täällä.*kärki noin \d+ m meistä pohjoiseen/), trafficId(3, /^EK12, kärki, eteläsivusta: pintapaloa kuivaa männikkökangasta, liekit 1–2 m\. Letkulinja \d+ m, paine riittää/)], rule: "cited",
      basis: "integrates EK12's two pushed reports: the head some 300 m north of its stretch, running past it to the north-east (13.20), and its own stretch a surface fire in dry pine heath, flames 1–2 m, the 680 m line with pressure enough (14.08): the flank is held low while the head runs on past it; recorded: 'saamme reunaa kiinni, mutta se lipsuu paikoin' (13.48) and 'kärki menee ohitsemme koilliseen' (13.51); EK13 refilled EK12's basin at 13.54 (recorded)",
    }),
    choice({
      slug: "area_40", level: "L3", goal: "containment", keySteps: [3, 4], promptFi: `Kuinka suuri koko palanut ala on ${inMinutesFi(minutesAhead(2, 4))}?`,
      options: [["lt20", "Alle 20 hehtaaria"], ["m20_35", "20–35 hehtaaria"], ["m35_50", "35–50 hehtaaria"], ["gt50", "Yli 50 hehtaaria"]], key: V2_AREA.id,
      keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [1, 2],
      basis: `REPORT-keyed (D4; \`31\` rule (1)): the area at the end of step 4 (14.40) through the reported fire the maps of V1 and V2 draw (steps 1, 2), ${figures(V2_AREA, "ha")}; the map now ~13.7 ha and DR3's recorded 14.15 survey 18.3 ha (the lures, under 20)`,
    }),
    // SPEC/30 §5.1 (19 Oct 2026): two more L3 items in each phase-A freeze (2×L1, 2×L2, 4×L3). DRAFT, domain review (SPEC/30 §8).
    choice({
      // A consequence the envelope does not draw: the fire's type when the head meets the spruce DR1 reported ahead. `31` F08: the horizon.
      slug: "spruce_behaviour", level: "L3", goal: "containment", keySteps: [3, 6], promptFi: `Miten palo todennäköisesti käyttäytyy ${withinMinutesFi(minutesAhead(2, 6))}, kun kärki saavuttaa Kuusimäen kuusikon?`,
      options: [
        ["crown", "Nousee latvoihin ja heittää kipinöitä eteen"], ["slows", "Hidastuu, koska kuusikon pohja on kosteaa"],
        ["same", "Jatkuu matalana pintapalona samaa vauhtia"], ["stops", "Pysähtyy kuusikon reunaan, tiheikkö ei syty"],
      ], key: "crown",
      keyAtomIds: [], rule: "cited", basisKind: "knowledge",
      basis: "SPEC/30 §5.1 (DRAFT): CYCLE_STORY 5 (14:40) 'Kärki Kuusimäen kuusikon reunalla', 6 (15:00) 'Latvapalo alkanut ... kipinöintiä havaittu 200-400 m eteenpäin'; DR1 and DR3 at 15:05: flames over the crowns; the CA's achieved head rate ~38 m/min at step 6 (~10 m/min at step 3). No record to step 3 names a crown fire (freeze-bank.spec.ts)",
    }),
    choice({
      // A route at risk: the R1/R2 junction, where the water-shuttle road R2 meets R1 east of the fire.
      slug: "junction_hour", level: "L3", goal: "resources", keySteps: [3, 5], promptFi: `Kuinka kaukana palon reuna on teiden R1 ja R2 risteyksestä ${inMinutesFi(minutesAhead(2, 5))}?`,
      options: JUNCTION_BANDS, key: V2_JUNCTION.id,
      keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [1, 2],
      basis: `SPEC/30 §5.1 (DRAFT); REPORT-keyed (D4; \`31\` rule (1)): the reported fire's distance to the R1/R2 junction at the end of step 5 (15.00) through the maps of V1 and V2 (steps 1, 2), ${figures(V2_JUNCTION, "m", f0)}; the map now ~950 m (the lure, 700–1000 m)`,
    }),
    point({
      // `31` F03: an hour on (15.00, the end of step 5; was 14.40), so the key lies ≥ 2 × the tolerance from the head drawn now (it was 352 m).
      slug: "head_later", level: "L3", goal: "containment", keySteps: [3, 5], promptFi: headLaterFi(2, 5), point: truthHeadAtEndOf(5),
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", basis: "the CA truth head at the end of step 5 (15:00); no projectionPoint: 15.00 is beyond V2's projection (its isochrones end at 40 minutes from 13.40)",
    }),
  ],
  4: [
    choice({
      slug: "ek12_where", level: "L1", goal: "safety", promptFi: "Missä EK12 on nyt?",
      options: [["head_s", "Kärjen eteläsivustalla"], ["spruce", "Kuusimäen kuusikon reunassa"], ["black", "Tiellä R1 palaneella alueella"], ["water", "Täyttämässä säiliötä Haukilammella"]],
      key: distanceM(siteStep(6).units["EK12"]!, F["R1_BLACK"]!) < 200 ? "black" : "head_s",
      keyAtomIds: [RADIO.ek12Withdraws], rule: "computed", basis: "EK12's step-6 position, on R1 in the burned area, the safety zone (withdrawn after the crown-fire near miss; review fixes (ah): was the R1/R2 junction, ~1 km out in unburned forest)",
    }),
    choice({
      slug: "fastest_spread", level: "L2", goal: "containment", promptFi: "Missä palo leviää nyt nopeimmin?",
      options: [["L1", "Pohjoisreunalla (lohko L1)"], ["L2", "Koillisessa (lohko L2)"], ["L3", "Eteläreunalla (lohko L3)"], ["L4", "Syttymäkohdan takana (lohko L4)"]], key: "L2",
      keyAtomIds: ["atom.demo.6.0", trafficId(6, /^DR3 lämpökuva, Kuusimäki/), trafficId(6, /^DR3 mittaus: Kuusimäen/)], rule: "cited",
      basis: "DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts)",
    }),
    choice({
      // `31` F10: replaces work_danger (EK12's crown-fire report recalled); comprehension of the two withdrawals for the head.
      slug: "head_unattended", level: "L2", goal: "containment", promptFi: "Mitä EK11:n ja EK12:n vetäytyminen tielle R1 merkitsee kärjelle nyt?",
      options: [
        ["free", "Kärkeä ei sammuteta, se etenee vapaasti"], ["others", "EK14 ja VPK sammuttavat kärkeä niiden tilalla"],
        ["stops", "Kärki pysähtyy tiehen R1 palaneella alueella"], ["calm", "Kärki on rauhoittunut, ja työ jatkuu sivustoilla"],
      ], key: "free",
      keyAtomIds: [RADIO.ek11Withdraws, RADIO.ek12Withdraws, trafficId(6, /^EK11, tie R1, palanut alue: .*Odotamme tiellä, kunnes kärki rauhoittuu/)], rule: "cited",
      basis: "integrates the two pushed withdrawals to R1 in the black (radio 6.0, 6.1: the crown fire, the near miss) and EK11's pushed 15.02 'we wait on the road until the head calms': no crew works the head during the crown run (EK14 holds the north edge, VPK the origin, KY21 the south flank with 4 % water)",
    }),
    // `31` F01 (RC): replaces growth_next, keyed on a report series V4's map never drew (step 6), whose report band (~9.5 ha) and the CA's
    // crown run (~23.5 ha) could not share a band under any band set. A consequence of the crown run with a delivered basis instead.
    choice({
      slug: "return_danger", level: "L3", goal: "safety", keySteps: [6, 7], promptFi: `Mikä vaarantaa kärjen sivustoille palaavat miehistöt todennäköisimmin ${withinMinutesFi(minutesAhead(4, 7))}?`,
      options: [
        ["spots", "Pistepalot, jotka syttyvät niiden taakse"], ["water", "Veden loppuminen, kun vesiajo ei ehdi"],
        ["head_back", "Kärki, joka kääntyy takaisin tielle R1"], ["fatigue", "Uupumus, kun työvuoro on venynyt pitkäksi"],
      ], key: "spots",
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: ["atom.demo.6.0"],
      basis: "`31` F01 (DRAFT, RC; domain review): spotting 200–400 m ahead is on record (story 6.0, pushed); when the crown fire drops at Koivuoja (15.20) EK11 returns to the line and spot fire PP1 starts behind it beside its route to the vehicle, so it pulls its men out (step 7: DR1 15.28, EK11 15.30, pushed in V5). No record to step 6 names a spot fire behind a crew",
    }),
    // SPEC/30 §5.1 (19 Oct 2026). DRAFT, domain review. Koivuoja and Korpioja are map names; no record names either before step 7.
    choice({
      // A consequence the envelope does not draw: where the crown run leaves the spruce (the broadleaf strip along the brook).
      slug: "crown_drops", level: "L3", goal: "containment", keySteps: [6, 7], promptFi: `Missä kärjen latvapalo todennäköisesti laskeutuu takaisin pintapaloksi ${withinMinutesFi(minutesAhead(4, 7))}?`,
      options: [
        ["birch", "Koivuojan varren lehtimetsässä"], ["wind", "Kuusikossa, kun tuuli heikkenee"],
        ["river", "Kotkanjoen rannassa"], ["late", "Ei laskeudu ennen tuulen kääntymistä"],
      ], key: "birch",
      keyAtomIds: [], rule: "cited", basisKind: "knowledge",
      basis: "SPEC/30 §5.1 (DRAFT): CYCLE_STORY 7 (15:20) 'Latvapalo laskeutunut Koivuojan koivikkoon, pintapalo jatkuu'; the CA head is at BIRCH (the birch–aspen strip along Koivuoja) at the end of step 6; the wind turns only at step 8 (165°). Koivuoja is a map name, on record from step 7",
    }),
    choice({
      // A barrier that fails: the brook between the head and the north, crossed by spotting during the crown run. `31` F15: two per polarity.
      slug: "korpioja_spot", level: "L3", goal: "containment", keySteps: [6, 7], promptFi: `Pysäyttääkö Korpioja palon kärjen etenemisen ${withinMinutesFi(minutesAhead(4, 7))}?`,
      options: [
        ["jumps", "Ei, kipinät sytyttävät paloja ojan yli"], ["around", "Ei, kärki kiertää ojan latvan kautta"],
        ["stops", "Kyllä, kärki pysähtyy ojan rantaan"], ["wind", "Kyllä, kun tuuli kääntyy ennen ojaa"],
      ], key: "jumps",
      keyAtomIds: [], rule: "cited", basisKind: "knowledge",
      basis: "SPEC/30 §5.1 (DRAFT): EK12's step-7 radio 'Kipinät lensivät Korpiojan yli, uusi palo toisella puolella' (pushed in V5); the CA crown run passes Korpioja's line during step 6 with a detached spot beyond it. Korpioja is a map name, on record from step 7",
    }),
    point({
      // 2 Oct 2026: 15:20 (the end of the crown run, V4's own horizon), was 15:40 — with the 30 m/min run and the
      // 15:20 spot fires the 15:40 head lies ~450 m beyond the freeze map's frame (fire + 1.1 km). RESEARCHER CHECK.
      slug: "head_later", level: "L3", goal: "containment", keySteps: [6, 6], promptFi: headLaterFi(4, 6), point: truthHeadAtEndOf(6), projectionPoint: projectionHeadAtEndOf(4, 6),
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", basis: "the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view)",
    }),
  ],
  5: [
    point({
      slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_FI, point: headNow(7),
      keyAtomIds: [], rule: "computed", basis: "the observed head step 7 draws (observedHead.anchor)",
    }),
    choice({
      // `31` F10, F25: replaces spot_cause (the crossing mechanism, EK12's record recalled, and stated by V4 korpioja_spot's key);
      // comprehension of the crossing for containment. SPEC/33 stage 9 (20 Oct 2026, the rebuilt map; DRAFT, panel and native review):
      // the forest-road crossing at Kuusimäki is gone, so the item relates the one crossing (Korpioja) to where the crews are; it states
      // nothing about Koivuoja, which `road_jump` asks about.
      slug: "lines_breached", level: "L2", goal: "containment", promptFi: "Mitä Korpiojan ylitys merkitsee palon rajaamiselle nyt?",
      options: [
        ["no_barrier", "Korpiojan takana palaa uusi palo, jota kukaan ei sammuta"], ["put_out", "Ylityskohta on jo sammutettu, ja Korpioja rajaa palon"],
        ["ek11", "EK11 pitää ylityskohdan Koivuojan linjaltaan käsin"], ["dies", "Uusi palo sammuu itsestään ojan kosteaan rantaan"],
      ], key: "no_barrier",
      keyAtomIds: [RADIO.sparksKorpioja, trafficId(7, /^EK11, Koivuoja: kärki menee ohitsemme koilliseen/)], rule: "cited",
      basis: "integrates the pushed step-7 crossing (radio 7.1: a new fire on the far side of Korpioja, no crew near, nothing done) with where the crews are (EK11 at Koivuoja, pushed 15.25; EK12 and EK14 on R1 and the north edge): the fire beyond Korpioja burns with nobody on it, and the brook no longer bounds the fire",
    }),
    choice({
      // `31` F10: replaces units_enough (EK11's request for more units recalled); two EK11 reports related to keeping up with the head.
      slug: "hose_short", level: "L2", goal: "resources", promptFi: "Mikä rajoittaa EK11:n työtä Koivuojan linjalla nyt eniten?",
      options: [
        ["hose", "Letkua on liian vähän kärjen perässä pysymiseen"], ["water", "Vesi loppuu, koska vesiajo ei ehdi linjalle"],
        ["tired", "Miehistö on uupunut ja tarvitsee heti vaihdon"], ["burnt", "Kipinät ovat polttaneet letkulinjan poikki"],
      ], key: "hose",
      keyAtomIds: [trafficId(7, /^EK11, Koivuoja: kärki menee ohitsemme koilliseen/), trafficId(7, /^EK11, Koivuoja: linjaa jo 600 m, varaletkua alle 200 m/)], rule: "cited",
      basis: "integrates EK11's pushed step-7 reports: the head runs past it to the north-east (15.25) and its 600 m line has under 200 m of hose in reserve, more hose asked for (15.35): the line cannot follow the head; EK11's tank is at 63 % (asked-only, 15.25) and the water shuttle runs, so water is not the limit",
    }),
    choice({
      // SPEC/30 §5.1 (DRAFT, domain review). `31` F07: before wind_shift, and the stem no longer names the forecast turn (it told everyone of
      // the recorded-only forecast, evt.wx.03, and pre-exposed a source-memory fact); the key is the crew's safety when the wind backs.
      slug: "ek14_shelter", level: "L3", goal: "safety", keySteps: [7, 8], promptFi: `Mitä pohjoisreunalla työskentelevän EK14:n on todennäköisesti tehtävä ${withinMinutesFi(minutesAhead(5, 8))}?`,
      options: [
        ["shelter", "Siirryttävä turvaan palaneelle alueelle"], ["hold", "Jatkettava työtä samalla linjalla"],
        ["head", "Siirryttävä Koivuojalle kärjen avuksi"], ["refill", "Lähdettävä täyttämään säiliötä Haukilammelle"],
      ], key: "shelter",
      keyAtomIds: ["evt.wx.03"], rule: "cited", basisKind: "record", basisAtomIds: ["evt.wx.03"],
      basis: "SPEC/30 §5.1 (DRAFT): the forecast (evt.wx.03, recorded 15.03: SW → S → SE at 15.30–16.00); EK14's step-8 radio (pushed in V6): it withdraws to R1 in the middle of the burned area, the safety zone, because the turned wind leaves the north flank downwind. No record to step 7 says EK14 withdraws",
    }),
    choice({
      slug: "wind_shift", level: "L3", goal: "containment", keySteps: [7, 9], promptFi: `Mikä palon reuna aktivoituu ${withinMinutesFi(minutesAhead(5, 9))}, jos tuuli alkaa puhaltaa etelästä?`,
      options: [["north", "Pohjoisreuna"], ["south", "Eteläreuna"], ["west", "Syttymäkohdan puoleinen länsiosa"], ["none", "Ei mikään, vain kärki etenee"]], key: "north",
      keyAtomIds: ["evt.wx.03", "evt.wx.02"], rule: "cited", basisKind: "record", basisAtomIds: ["evt.wx.03", "evt.wx.02"],
      basis: "the forecast (evt.wx.03, V4: SW -> S at 15.30-16.00; evt.wx.02 the front) and CA step 9 (wind from 140°): the new growth outside the head is in L1, north; CYCLE_STORY 9 'pohjoisreuna aktivoitunut'",
    }),
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces rate_next. The area NOW is on record (the map, DR3's 15:35 survey); the hour's growth is the projection.
    choice({
      slug: "area_hour", level: "L3", goal: "containment", keySteps: [7, 9], promptFi: `Kuinka suuri koko palanut ala on ${inMinutesFi(minutesAhead(5, 9))}?`,
      options: [["lt90", "Alle 90 hehtaaria"], ["m90_140", "90–140 hehtaaria"], ["m140_190", "140–190 hehtaaria"], ["gt190", "Yli 190 hehtaaria"]], key: V5_AREA.id,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: [V5_SURVEY.area.id], basisSteps: [7],
      basis: `REPORT-keyed (D4; \`31\` rule (1)): the pushed 15.35 survey (DR3: ${V5_SURVEY.area.value} ha, ${V5_SURVEY.added.value} ha new in 20 minutes; the map draws step 7) carried on to the end of step 9 (16.20), ${figures(V5_AREA, "ha")}; ~77 ha now`,
    }),
    // SPEC/30 §5.1. A line that fails: a brook that stopped the surface fire is crossed by embers. `31` F15: two per polarity.
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map; DRAFT, panel and native review): was "Pitääkö Kuusimäen metsäautotie palon muualla …"
    // (a second ember crossing of that road at 15:40); the rebuilt map has no forest road there, and the line that fails next is Koivuoja:
    // the surface fire stopped at it at 15.00–15.20 (radio 7.2, pushed: the lure), and embers cross it at 15.20–15.40 (radio 8, pushed
    // in V6). The slug is kept (a shared id).
    choice({
      slug: "road_jump", level: "L3", goal: "containment", keySteps: [7, 8], promptFi: `Pysäyttääkö Koivuoja palon etenemisen ${withinMinutesFi(minutesAhead(5, 8))}?`,
      options: [
        ["again", "Ei, kipinät lentävät ojan yli ja sytyttävät uuden palon"], ["creep", "Ei, palo ryömii ojan yli matalana pintapalona"],
        ["once", "Kyllä, kosteat rannat pysäyttävät palon ojaan"], ["crews", "Kyllä, EK11:n linja ojan varressa pitää palon"],
      ], key: "again",
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: [RADIO.koivuojaStop, RADIO.sparksKorpioja],
      basis: "SPEC/30 §5.1 (DRAFT; SPEC/33 stage 9): the step-8 radio (pushed in V6) 'Kipinät lensivät Koivuojan yli, uusi palo toisella puolella. EK11 joutui vetäytymään' (15.20–15.40); delivered by the freeze: the surface fire stopped at Koivuoja at 15.00–15.20 (radio 7.2, pushed: the lure) and embers crossed Korpioja in the crown run (radio 7.1, pushed)",
    }),
  ],
  7: [
    choice({
      // Fix pass 3 (7 Oct 2026): a choice item: KY21's radio says it is moving to the north edge now, while the step-10 map symbol still
      // shows it on the south edge by design (UNIT_PLAN stale: [10]). `31` F24: the south-edge option is gone (it cued H10's sector).
      slug: "ky21_where", level: "L1", goal: "safety", promptFi: "Missä KY21 on nyt?",
      options: [
        ["north", "Siirtymässä pohjoisreunalle (lohko L1)"], ["cp", "Johtopaikalla odottamassa uutta tehtävää"],
        ["head", "Kärjessä Koivuojan linjalla"], ["w1", "Täyttämässä säiliötä Haukilammella"],
      ],
      key: "north",
      keyAtomIds: [RADIO.ky21North], rule: "cited", basis: "KY21's step-10 radio (pushed before the freeze): moving to the north edge (L1) now; UNIT_PLAN edge:L1B from step 10 (its step-10 map symbol is the stale south-edge one)",
    }),
    choice({
      // Fix pass 2 (7 Oct 2026, P1-1/2): the key does not state the smoulder-and-flare-up mechanism (H10). `31` F06: the distractor that
      // the records supported ("the fire picks up on a new edge as the wind turns") is replaced by a clearly false state.
      slug: "lull_meaning", level: "L2", goal: "containment", promptFi: "Mitä tuulen heikkeneminen merkitsee palon hallinnalle nyt?",
      options: [
        ["not_out", "Reunat rauhoittuvat hetkeksi, palo ei ole ohi"], ["out", "Palo hidastuu, ja linjoja voidaan harventaa"],
        ["release", "Osa lisäyksiköistä voidaan kotiuttaa illaksi"], ["stopped", "Palo on pysähtynyt, ja reunat ovat jo kylmiä"],
      ], key: "not_out",
      keyAtomIds: ["atom.demo.10.0", trafficId(10, /^EK11, Koivuoja: pieni liekki sammalessa/)] /* safety re-check (ah): the drawn wording changed (was 'hehkuvaa kariketta ja pientä liekkiä'), same report */, rule: "cited",
      basis: "EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: small flames in the moss, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12)",
    }),
    choice({
      // `31` F10: replaces why_north (KY21's 'Karhujärven mökit uhattuna' recalled); three moves integrated for the north edge's crew.
      slug: "north_help", level: "L2", goal: "resources", promptFi: "Mitä KY21:n ja VPK:n siirto merkitsee pohjoisreunalla työskentelevälle EK14:lle?",
      options: [
        ["help", "EK14 saa pohjoisreunalle lisää miehistöä"], ["alone", "EK14 jää edelleen yksin pohjoisreunalle"],
        ["head", "EK14 vapautuu kärkeen Koivuojalle"], ["road", "EK14:n linja siirretään tielle R1"],
      ], key: "help",
      keyAtomIds: [RADIO.ky21North, RADIO.vpkNorth, RADIO.ek14North], rule: "cited",
      basis: "integrates KY21's and VPK's pushed moves to the north edge (radio 10.3, 10.4) with EK14's pushed move along it towards Karhujärvi (radio 10.1): the north edge, held by EK14 alone since 13.41, gets two more crews",
    }),
    choice({
      slug: "rekindle_sector", level: "L3", goal: "containment", keySteps: [10, 12], promptFi: `Missä lohkossa uudelleensyttymisen riski on suurin ${withinMinutesFi(minutesAhead(7, 12))}?`,
      options: [["L1", "L1 Pohjoinen"], ["L2", "L2 Koillinen"], ["L3", "L3 Etelä"], ["L4", "L4 Länsi"]], key: firstDetachedFrontAfter(9)!.sector!, // fix pass 4: from the freeze's now (step 10 on)
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", family: "verification",
      basis: "the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key; `31` (a): a verification item (only VPK's recorded objection, ranked low for broad questions, warns of it)",
    }),
    choice({
      // `31` F15, F26: two options per polarity, each with its own reason (two near-duplicate yes options and "already" are gone).
      slug: "cabins_reach", level: "L3", goal: "values", keySteps: [10, 12], promptFi: `Saavuttaako palo Mökkirannan mökit ${withinMinutesFi(minutesAhead(7, 12))}?`,
      options: [
        ["no", "Ei, matkaa on liikaa nykyisellä nopeudella"], ["sprinklers", "Ei, mökit on jo suojattu sadettimilla"],
        ["wind", "Kyllä, kaakkoistuuli painaa palon sinne"], ["sparks", "Kyllä, kipinät kantautuvat mökeille asti"],
      ], key: cabinsReachKey(),
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth",
      basis: `CA truth distance to CABINS at the ends of steps 10–12 (the hour from the freeze's now, 16.20): ~${f0(Math.min(...[10, 11, 12].map((st) => distanceToTruthM(st, F["CABINS"]!))))} m throughout; the north edge runs north-west at ~5.3 m/min (DR3 16.25, pushed), ~320 m an hour; no sprinklers stand at the cabins`,
    }),
    // SPEC/30 §5.1 (19 Oct 2026). DRAFT, domain review. Neither item names the old south edge, the south-east or the north edge's state.
    choice({
      // A value at risk being reached (or not): the command post, ~800 m west of the fire. `31` F15: two options per polarity.
      slug: "cp_safe", level: "L3", goal: "safety", keySteps: [10, 12], promptFi: `Joutuuko johtopaikka siirtymään palon tai savun takia ${withinMinutesFi(minutesAhead(7, 12))}?`,
      options: [
        ["stays", "Ei, palo ja savu pysyvät siitä kaukana"], ["moved", "Ei, johtopaikka on jo siirretty kauemmas"],
        ["road", "Kyllä, palo etenee tietä R1 pitkin sinne"], ["smoke", "Kyllä, savu peittää sen tuulen kääntyessä"],
      ], key: cpSafeKey(),
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth",
      basis: `SPEC/30 §5.1 (DRAFT): CA truth distance to CP at the ends of steps 10–12: ~${f0(Math.min(...[10, 11, 12].map((st) => distanceToTruthM(st, F["CP"]!))))} m and more (computed, cpSafeKey); the wind turns S, then WNW (evt.wx.04), away from the CP; EK11 at the CP at 16:4x (pushed in V8): 'ei paloa näköetäisyydellä, savua koilliseen'; the CP has never moved`,
    }),
    choice({
      // A formation needing relief. `31` F19: keyed on pushed records (time on scene), and asked as who asks next (VPK's request is pushed in V8).
      slug: "relief_next", level: "L3", goal: "safety", keySteps: [10, 11], promptFi: `Kenen miehistö pyytää EK11:n jälkeen seuraavana vuoronvaihtoa tai korvaavaa yksikköä ${withinMinutesFi(minutesAhead(7, 11))}?`,
      options: [["VPK", "VPK:n miehistö"], ["EK12", "EK12:n miehistö"], ["EK14", "EK14:n miehistö"], ["KY21", "KY21:n miehistö"]], key: RELIEF.key,
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: [...RELIEF.ids, RADIO.ek14Arrives, RADIO.ky21Arrives, trafficId(10, /^EK11, Koivuoja: miehistö ollut kentällä \d+,\d h\. Pyydämme vuoronvaihtoa/)],
      basis: `SPEC/30 §5.1 (DRAFT; \`31\` F19): time on scene at 16.20 from pushed records only (VPK and EK12 'olemme olleet täällä' at 13.2x, EK14's and KY21's arrival radios): ${Object.entries(RELIEF.hours).map(([u, h]) => `${u} ${h.toFixed(1)} h`).join(", ")}; EK11 asks for relief at 4.5 h (16.26, pushed); VPK asks for a replacement unit at 16.53 (pushed in V8, 'linjalla 4,6 h ilman lepoa')`,
    }),
  ],
};

/** Every view's bank items (the infrastructure item and F7 are added by `demo-probes.ts`). */
export const FREEZE_BANK: Readonly<Record<number, readonly ItemDef[]>> = { ...PHASE_A_BANK, ...PHASE_B_BANK };
