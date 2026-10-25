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
 * Revision (bk), 25 Oct 2026 (SPEC/30 (bk)): four phase-A items are made seek-dependent — V2 `south_flank`, V5 `reinforcements` (was
 * `wind_shift`) and V7 `north_help` (re-keyed) in `freeze-bank-seek.ts`, and V5 `hose_short`, whose key record is held for seeking
 * (`tools/fire-ca/view-traffic.ts`).
 */

import { SITE_SCENARIO } from "./site-scenario.js";
import { sortedEntries } from "../engine/deterministic-object.js";
import { choice, HEAD_NOW_LATEST_FI, headLaterFi, horizonFi, point, withinHorizonFi, type ItemDef } from "./freeze-bank-core.js";
import { PHASE_B_BANK } from "./freeze-bank-b.js";
import {
  deliveredAreaAt, deliveredPointDistanceAt, distanceM, distanceToTruthM, firstDetachedFrontAfter, headNow, keyBand, projectionHeadAtEndOf, radioId, siteStep,
  storyId, trafficFigure, trafficId, truthHeadAtEndOf, type KeyBand,
} from "./freeze-keys.js";
import { CYCLE_STORY } from "./demo-story.js";
import { clockOf, R1_ARRIVAL, R1_ARRIVAL_IDS, V5_AREA, V5_AREA_EDGES, V5_AREA_IDS, V5_SURVEY } from "./freeze-readings.js";
import { NORTH_HELP, REINFORCEMENTS, SOUTH_FLANK } from "./freeze-bank-seek.js";

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
  sparksMyllyoja: radioId(7, /^Kipinät lensivät Myllyojan yli/),
  koivuojaStop: radioId(7, /^Palo pysähtyi Koivuojan kohdalle/),
  koivuojaSparks: radioId(8, /^Kipinät lensivät Koivuojan yli/),
  ky21North: radioId(10, /^KY21, lohkon L3 johtaja: .*siirrän .*KY21:n ja VPK:n nyt pohjoisreunalle/), // fix pass 3: the L3 sector leader moves KY21 and VPK (FF11)
  ek14Arrives: radioId(2, /^EK14: saavuimme pohjoisreunalle/),
  ky21Arrives: radioId(3, /^KY21: saavuimme syttymäkohdan eteläreunalle/),
};

const HEAD_NOW_FI = "Merkitse kartalle palon kärki.";

/** Play-test D3 (24 Oct 2026): DR1's pushed 14.27 terrain line (V3), the birch–aspen strip along Koivuoja beyond Kuusimäki's spruce. */
export const BIRCH_STRIP = storyId(4, /^Kärjen edessä alkaa pian Kuusimäen kuusikko, .*Koivuojan varressa on kapea koivikko ja haavikko/);
/**
 * Play-test D7 (24 Oct 2026): P2's pushed 15.05 headline of the 15.00 forecast (V4's second step). The build checks it says what the
 * recorded forecast says (`evt.wx.03`): the turn through the south to the south-east at 15.30–16.00, easing to 4–5 m/s.
 */
export const FORECAST_HEADLINE = storyId(6, /^Sääennusteen päivitys klo 15\.00: /);
{
  const wx = SITE_SCENARIO.traffic.find((t) => t.id === "evt.wx.03");
  const headline = CYCLE_STORY[6]!.bubbles.find((b) => b.text.startsWith("Sääennusteen päivitys klo 15.00: "))!.text;
  for (const fact of ["lounaasta etelän kautta kaakkoon", "15.30–16.00", "4–5 m/s"]) {
    if (!wx?.content.includes(fact) || !headline.includes(fact)) throw new Error(`forecast headline: "${fact}" is not in both the 15.00 forecast (evt.wx.03) and P2's headline`);
  }
}
const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => n.toFixed(0);
/** A report-keyed key's figures for its basis text (F22): the delivered value, its margin, and the truth's value and band. */
const figures = (k: KeyBand, unit: string, fmt = f1) => `~${fmt(k.value)} ${unit}, ${fmt(k.margin)} ${unit} from the nearest band edge; the CA's truth ~${fmt(k.truthValue!)} ${unit}, ${k.truthId === k.id ? "the same band" : `band ${k.truthId}`}`;


/**
 * V2 (now 14.00; REPORT-keyed, D4; `31` rule (1)): the burnt area 40 minutes on (14.40, the end of step 4) through the reported fire the
 * maps of V1 and V2 draw (steps 1 and 2; V2's second step is not drawn). Edges 15/25/35 (`31` §3.5: were 15/22/30, where the CA's ~23 ha
 * fell in another band than the reports' ~18.5 ha). SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): edges 20/35/50 (were 15/25/35, where the
 * reports' ~24.8 ha lay 0.2 ha from the 25 edge); the reports give ~24.8 ha, the truth ~29.7 ha, both in 20–35; the map now (~13.7 ha) and
 * DR3's recorded 14.15 survey (18.3 ha) are the lures, under 20.
 */
export const V2_AREA = keyBand(deliveredAreaAt(1, 2, 4), [20, 35, 50], ["lt20", "m20_35", "m35_50", "gt50"], 2, "V2 area_40", { value: siteStep(4).areaHa, minMargin: 2 });

// V5 `area_hour`'s key (`V5_SURVEY`, `V5_AREA`) and VP `r1_arrival`'s (`R1_ARRIVAL`) are in `freeze-readings.ts` with their guards
// (play-test R4, R8). SPEC/33 stage 9 (20 Oct 2026) had moved V5's edges to 90/140/190 (were 80/110/140); R8 moves 140 to 130.
export { V5_AREA } from "./freeze-readings.js";

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
/** V5 `hose_short`'s basis: EK11's tank when asked at 15.25 (asked-only), read from the record (SPEC/33 gate R, R1). */
const EK11_TANK_V5 = trafficFigure(7, /^EK11 \(kysyttäessä\): Vettä säiliössä noin (\d+) %/);
/** VPK's pushed relief request in V8 (step 11), in either generated wording. */
export const VPK_RELIEF_RE = /^VPK täällä .*(?:ilman lepoa tai ruokataukoa\. Pyydän korvaavaa yksikköä|Pyydämme vuoronvaihtoa tai lepovuoroa)/;
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
  // The relief requests the basis quotes, read from the records (SPEC/33 gate R, R1: the re-seeded step 11 draws VPK's other wording).
  const asked = (step: number, re: RegExp) => {
    const t = SITE_SCENARIO.traffic.find((x) => x.cycle === step && x.tier === "T1_pushed" && re.test(x.content));
    if (!t) throw new Error(`freeze key V7 relief_next: no pushed relief request at step ${step} matches ${re}`);
    return t.timestamp.slice(0, 5).replace(":", ".");
  };
  const ek11At = asked(10, /^EK11, Koivuoja: miehistö ollut kentällä \d+,\d h\. Pyydämme vuoronvaihtoa/);
  const vpkAt = asked(11, VPK_RELIEF_RE);
  return { key: ranked[0]![0], hours, ids: [vpk.id, ek12.id], ek11At, vpkAt };
})();

/**
 * Difficulty audit (23 Oct 2026, `docs/audits/2026-10-23-difficulty/proposal.md` (b.2), option A): the practice item only Haku answers —
 * the 12.00 forecast (`evt.wx.01`, recorded only, T2; no pushed VP record states a forecast, and all four options agree with the map's
 * south-west wind arrow, so the arrow cannot answer it). Practice only: never scored, no scored item or key changes. The key is the
 * record's own wording, checked here against the record (a changed forecast fails the build rather than moving the key).
 *
 * Option B, kept for the panel if A is judged too close to V5's wind items (`ek14_shelter`, `wind_shift`): the forest register,
 * `evt.vp.012` (T2) — stem "Mitä metsävararekisteri kertoo syttymäkohdan ympäristöstä?", key "Kuivaa mäntykangasta, maapohja kantaa
 * koneet", distractors "Kosteaa korpea, koneet uppoavat" · "Nuorta kuusikkoa, maa kivikkoista" · "Ojitettua suota, turve kuivaa". A teaches
 * the record class the scored items most need (every forecast is recorded only); B teaches the rule without touching any scored item's basis.
 */
export const PRACTICE_FORECAST_ATOM = "evt.wx.01";
const PRACTICE_FORECAST_KEY_FI = "Lounaistuulta 4–6 m/s, puuskissa 8–10 m/s";
{
  const wx = SITE_SCENARIO.traffic.find((t) => t.id === PRACTICE_FORECAST_ATOM);
  if (!wx || wx.session_view !== 0 || wx.tier === "T1_pushed" || !/lounaistuulta 4–6 m\/s, puuskissa 8–10 m\/s/.test(wx.content)) {
    throw new Error(`practice forecast item: ${PRACTICE_FORECAST_ATOM} is not VP's recorded forecast stating the key's wind`);
  }
}

export const PRACTICE_BANK: readonly ItemDef[] = [
  point({
    slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_FI, point: headNow(-3),
    keyAtomIds: ["evt.vp.002", "evt.vp.008"], rule: "computed", basis: "the observed head W2 draws (observedHead.anchor)",
  }),
  choice({
    slug: "forecast", level: "L1", goal: "containment", promptFi: "Mitä sääennuste lupaa iltapäivän tuulesta?",
    options: [
      ["sw_gusts", PRACTICE_FORECAST_KEY_FI], ["sw_showers", "Lounaistuulta 4–6 m/s, iltapäivällä sadekuuroja"],
      ["sw_thunder", "Lounaistuuli voimistuu 10–12 m/s:iin, ukkosta"], ["sw_calm", "Lounaistuuli heikkenee tyyneksi iltapäivällä"],
    ], key: "sw_gusts",
    keyAtomIds: [PRACTICE_FORECAST_ATOM], rule: "cited",
    basis: "the Finnish Meteorological Institute's 12.00 local forecast (recorded only, T2, 12.07): south-west 4–6 m/s, gusts 8–10 m/s, dry in the afternoon",
  }),
  choice({
    slug: "first_target", level: "L2", goal: "values", promptFi: "Mihin kohteeseen palo ehtii ensimmäisenä, jos se jatkaa nykyiseen suuntaan?",
    options: [["r1", "Tie R1"], ["cabins", "Mökkiranta"], ["village", "Lahdenkylä"], ["w1", "Haukilampi (W1)"]], key: "r1",
    keyAtomIds: ["evt.vp.002", "evt.vp.003", "evt.vp.011"], rule: "cited",
    basis: "EK11: the head runs north-east towards R1, 340 m away; Mökkiranta 2.1 km north-west, Lahdenkylä 3.0 km south-east",
  }),
  choice({
    // Play-test R4 (researcher 25 Oct 2026; DRAFT, native check): a time of day (was "Kuinka pian …", minutes from now, whose 60-minute edge
    // the readings straddled). The horizon is the answer itself; the three readings and their guard are in `freeze-readings.ts`.
    slug: "r1_arrival", level: "L3", goal: "containment", keySteps: [-3, -3], promptFi: "Mihin aikaan palon kärki saavuttaa tien R1, jos se etenee nykyistä vauhtia?",
    options: [[R1_ARRIVAL_IDS[0], "Ennen klo 12.50"], [R1_ARRIVAL_IDS[1], "Klo 12.50–13.10"], [R1_ARRIVAL_IDS[2], "Klo 13.10–13.40"], [R1_ARRIVAL_IDS[3], "Klo 13.40 jälkeen"]], key: R1_ARRIVAL.key,
    keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [-3],
    basis: `three readings inside 13.10–13.40 (checked at build): EK11's pushed 12.01 'noin ${R1_ARRIVAL.pushedM} m' at 'noin ${R1_ARRIVAL.pushedRate} m/min' ≈ ${clockOf(R1_ARRIVAL.pushed)}; the drawn W2 head (12.00) ~${f0(R1_ARRIVAL.drawnM)} m ÷ its drawn ${R1_ARRIVAL.drawnRate} m/min ≈ ${clockOf(R1_ARRIVAL.drawn)}; the fire model at R1 at ${clockOf(R1_ARRIVAL.truth)} (step 1's fire; 34 m short at 13.00 in the CA run, so it crosses in 13.00–13.20)`,
  }),
];

export const PHASE_A_BANK: Readonly<Record<number, readonly ItemDef[]>> = {
  2: [
    point({
      // Play-test D1 (24 Oct 2026): "viimeisimpien tietojen mukaan" (was "nyt"): the key is EK11's 14.01 move, after the 14.00 clock.
      slug: "ek11_point", level: "L1", goal: "safety", promptFi: "Merkitse kartalle, missä EK11 työskentelee viimeisimpien tietojen mukaan.", point: siteStep(3).units["EK11"]!,
      keyAtomIds: [RADIO.ek11Ridge], rule: "computed", basis: "EK11's step-3 position (UNIT_PLAN: edge:RIDGE, the new ignition on the esker)",
    }),
    choice({
      // `31` F10: replaces nearest_head (EK11 nearest the head, one record recalled); comprehension: EK11's place against the new ignition.
      // Play-test D3 (researcher, 24 Oct 2026; sagat_rules: no item reveals another's answer or unseen information; DRAFT, native and domain
      // review): the stem said there was a new fire on the esker and that EK11 worked there — the premise the 65 s burst gives, and the key
      // of `ek11_point` — so both players answered it from the stem. Re-worded, not moved: map items come last in every freeze (2 Oct
      // 2026), and moving `ek11_point` first would still leave this stem stating the unseen premise. It names the esker (a place on the
      // map) but neither the new fire nor a unit; two options speak of a fire on the esker, two of the esker itself, all false but the key.
      slug: "ek11_between", level: "L2", goal: "safety", promptFi: "Mitä harjun tilanne merkitsee viimeisimpien tietojen mukaan kärjen lähellä työskenteleville miehistöille?",
      options: [
        ["between", "Lähin miehistö voi jäädä kärjen ja harjun uuden palon väliin"], ["head", "Harju hidastaa kärkeä, miehistöt voivat hyökätä sen edestä"],
        ["escape", "Harju antaa miehistöille turvallisen perääntymistien"], ["out", "Harjun palo on sammunut, miehistöt palaavat kärkeen"],
      ], key: "between",
      // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): on the new esker EK11 works the head's right (south-east) flank, so its 14.03 report
      // says "oikealla sivustalla" (was "vasemmalla"); the new ignition is ~100 m ahead of the head (was ~150 m).
      keyAtomIds: [RADIO.ek11Ridge, "atom.demo.3.0", trafficId(3, /^EK11, Kuivakangas: olemme kärjen oikealla sivustalla/)], rule: "cited",
      basis: "integrates EK11's move to the new ignition on the esker (radio 3.0, pushed), the new smoke ~100 m from the head (story 3.0, pushed) and EK11's own place ~50 m from the head on its right flank (14.03, pushed): the crew nearest the head, between the head and a fire ahead of it, can be cut off (EK11's recorded 14.05 radio: it will not go between them). The distractors: the esker's dry pine heath speeds the head (10.8 m/min at 14.00–14.20, DR1), its new fire burns (no escape route there; EK11's is to the burned area), and nothing reports it out",
    }),
    SOUTH_FLANK, // revision (bk): `freeze-bank-seek.ts`
    choice({
      slug: "area_40", level: "L3", goal: "containment", keySteps: [3, 4], promptFi: `Kuinka suuri koko palanut ala on ${horizonFi(2, 4)}?`,
      options: [["lt20", "Alle 20 hehtaaria"], ["m20_35", "20–35 hehtaaria"], ["m35_50", "35–50 hehtaaria"], ["gt50", "Yli 50 hehtaaria"]], key: V2_AREA.id,
      keyAtomIds: [], rule: "computed", basisKind: "map", basisSteps: [1, 2],
      basis: `REPORT-keyed (D4; \`31\` rule (1)): the area at the end of step 4 (14.40) through the reported fire the maps of V1 and V2 draw (steps 1, 2), ${figures(V2_AREA, "ha")}; the map now ~13.7 ha and DR3's recorded 14.15 survey 18.3 ha (the lures, under 20)`,
    }),
    // SPEC/30 §5.1 (19 Oct 2026): two more L3 items in each phase-A freeze (2×L1, 2×L2, 4×L3). DRAFT, domain review (SPEC/30 §8).
    choice({
      // A consequence the envelope does not draw: the fire's type when the head meets the spruce DR1 reported ahead. `31` F08: the horizon.
      slug: "spruce_behaviour", level: "L3", goal: "containment", keySteps: [3, 6], promptFi: `Miten palo todennäköisesti käyttäytyy ${withinHorizonFi(2, 6)}, kun kärki saavuttaa Kuusimäen kuusikon?`,
      options: [
        ["crown", "Nousee latvoihin ja heittää kipinöitä eteen"], ["slows", "Hidastuu, koska kuusikon pohja on kosteaa"],
        ["same", "Jatkuu matalana pintapalona samaa vauhtia"], ["stops", "Pysähtyy kuusikon reunaan, tiheikkö ei syty"],
      ], key: "crown",
      keyAtomIds: [], rule: "cited", basisKind: "knowledge",
      basis: "SPEC/30 §5.1 (DRAFT): CYCLE_STORY 5 (14:40) 'Kärki Kuusimäen kuusikon reunalla', 6 (15:00) 'Latvapalo alkanut ... kipinöintiä havaittu 200-400 m eteenpäin'; DR1 and DR3 at 15:05: flames over the crowns; the CA's achieved head rate ~38 m/min at step 6 (~10 m/min at step 3). No record to step 3 names a crown fire (freeze-bank.spec.ts)",
    }),
    choice({
      // A route at risk: the R1/R2 junction, where the water-shuttle road R2 meets R1 east of the fire.
      slug: "junction_hour", level: "L3", goal: "resources", keySteps: [3, 5], promptFi: `Kuinka kaukana palon reuna on teiden R1 ja R2 risteyksestä ${horizonFi(2, 5)}?`,
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
      // Play-test D1 (24 Oct 2026): "viimeisimpien tietojen mukaan" (was "nyt"): the key is EK12's 15.01 withdrawal, after the 15.00 clock;
      // at 15.00 itself it stood at the spruce edge, which a play-test player chose at confidence 100.
      slug: "ek12_where", level: "L1", goal: "safety", promptFi: "Missä EK12 on viimeisimpien tietojen mukaan?",
      options: [["head_s", "Kärjen eteläsivustalla"], ["spruce", "Kuusimäen kuusikon reunassa"], ["black", "Tiellä R1 palaneella alueella"], ["water", "Täyttämässä säiliötä Haukilammella"]],
      key: distanceM(siteStep(6).units["EK12"]!, F["R1_BLACK"]!) < 200 ? "black" : "head_s",
      keyAtomIds: [RADIO.ek12Withdraws], rule: "computed", basis: "EK12's step-6 position, on R1 in the burned area, the safety zone (withdrawn after the crown-fire near miss; review fixes (ah): was the R1/R2 junction, ~1 km out in unburned forest)",
    }),
    choice({
      slug: "fastest_spread", level: "L2", goal: "containment", promptFi: "Missä palo leviää viimeisimpien tietojen mukaan nopeimmin?", // play-test D1 (was "nyt"): the 15.0x records
      options: [["L1", "Pohjoisreunalla (lohko L1)"], ["L2", "Koillisessa (lohko L2)"], ["L3", "Eteläreunalla (lohko L3)"], ["L4", "Syttymäkohdan takana (lohko L4)"]], key: "L2",
      keyAtomIds: ["atom.demo.6.0", trafficId(6, /^DR3 lämpökuva, Kuusimäki/), trafficId(6, /^DR3 mittaus: Kuusimäen/)], rule: "cited",
      basis: "DR3: the Kuusimäki edge 14.1 m/min, flames over the crowns; the step-5 and step-6 CA growth is in L2 (checked in freeze-bank.spec.ts)",
    }),
    choice({
      // `31` F10: replaces work_danger (EK12's crown-fire report recalled); comprehension of the two withdrawals for the head.
      // Play-test D3 (researcher, 24 Oct 2026; DRAFT, native and domain review): the stem stated the withdrawal (the key's premise, and
      // `ek12_where`'s key), and a play-test player answered from its wording. It asks the state of the attack on the head instead; the
      // options name no withdrawal, and the stale state before the 15.00 burst (EK11 and EK12 on the head's flanks) is a distractor.
      slug: "head_unattended", level: "L2", goal: "containment", promptFi: "Mikä on viimeisimpien tietojen mukaan kärjen sammutuksen tilanne?",
      options: [
        ["free", "Kärkeä ei sammuteta, se etenee vapaasti"], ["flanks", "EK11 ja EK12 hyökkäävät kärkeen sivustoilta"],
        ["others", "EK14 ja VPK sammuttavat kärkeä edestä"], ["calm", "Kärki on rauhoittunut, ja työ jatkuu sivustoilla"],
      ], key: "free",
      keyAtomIds: [RADIO.ek11Withdraws, RADIO.ek12Withdraws, trafficId(6, /^EK11, tie R1, palanut alue: .*Odotamme tiellä, kunnes kärki rauhoittuu/)], rule: "cited",
      basis: "integrates the two pushed withdrawals to R1 in the black (radio 6.0, 6.1: the crown fire, the near miss) and EK11's pushed 15.03 'we wait on the road until the head calms': no crew works the head during the crown run (EK14 holds the north edge, VPK is refilling at W1 and back on the origin at 15.15 — gate R: was on the origin from 15.00 —, KY21 the south flank with 4 % water)",
    }),
    // `31` F01 (RC): replaces growth_next, keyed on a report series V4's map never drew (step 6), whose report band (~9.5 ha) and the CA's
    // crown run (~23.5 ha) could not share a band under any band set. A consequence of the crown run with a delivered basis instead.
    choice({
      slug: "return_danger", level: "L3", goal: "safety", keySteps: [6, 7], promptFi: `Mikä vaarantaa kärjen sivustoille palaavat miehistöt todennäköisimmin ${withinHorizonFi(4, 7)}?`,
      options: [
        ["spots", "Pistepalot, jotka syttyvät niiden taakse"], ["water", "Veden loppuminen, kun vesiajo ei ehdi"],
        ["head_back", "Kärki, joka kääntyy takaisin tielle R1"], ["fatigue", "Uupumus, kun työvuoro on venynyt pitkäksi"],
      ], key: "spots",
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: ["atom.demo.6.0"],
      basis: "`31` F01 (DRAFT, RC; domain review): spotting 200–400 m ahead is on record (story 6.0, pushed); when the crown fire drops at Koivuoja (15.20) EK11 returns to the line and spot fire PP1 starts behind it beside its route to the vehicle, so it pulls its men out (step 7: DR1 15.31, EK11 15.30, pushed in V5). No record to step 6 names a spot fire behind a crew",
    }),
    // SPEC/30 §5.1 (19 Oct 2026). DRAFT, domain review. Myllyoja is a map name, on record from step 7; Koivuoja (the brook and its birch
    // strip) is on record from step 4 since the play-test decisions (DR1 14.27, pushed in V3: D3).
    choice({
      // A consequence the envelope does not draw: where the crown run leaves the spruce (the broadleaf strip along the brook).
      // Play-test D3 (24 Oct 2026): the strip is stated before V4 (`BIRCH_STRIP`), so the key has a basis on a surface; the record gives the
      // fuel, the projection that the crown fire drops in it is the item's (knowledge applied to the record).
      slug: "crown_drops", level: "L3", goal: "containment", keySteps: [6, 7], promptFi: `Missä kärjen latvapalo todennäköisesti laskeutuu takaisin pintapaloksi ${withinHorizonFi(4, 7)}?`,
      options: [
        ["birch", "Koivuojan varren lehtimetsässä"], ["wind", "Kuusikossa, kun tuuli heikkenee"],
        ["river", "Kotkanjoen rannassa"], ["late", "Ei laskeudu ennen tuulen kääntymistä"],
      ], key: "birch",
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: [BIRCH_STRIP],
      basis: "SPEC/30 §5.1 (DRAFT): DR1's pushed 14.27 terrain line (V3; play-test D3): beyond Kuusimäki's spruce a narrow strip of birch and aspen along Koivuoja (no figure; ~200 m on the fuel grids); CYCLE_STORY 7 (15:20) 'Latvapalo laskeutunut Koivuojan koivikkoon, pintapalo jatkuu'; the CA head is at BIRCH (the birch–aspen strip along Koivuoja) at the end of step 6; the wind turns only at step 8 (165°)",
    }),
    choice({
      // A barrier that fails: the brook between the head and the north, crossed by spotting during the crown run. `31` F15: two per polarity.
      // Play-test R5 (25 Oct 2026): the brook is Myllyoja / Mill Brook (was Korpioja / Alder Creek, confusable with Koivuoja / Birch Creek);
      // the slug keeps the old name (a logged id).
      slug: "korpioja_spot", level: "L3", goal: "containment", keySteps: [6, 7], promptFi: `Pysäyttääkö Myllyoja palon kärjen etenemisen ${withinHorizonFi(4, 7)}?`,
      options: [
        ["jumps", "Ei, kipinät sytyttävät paloja ojan yli"], ["around", "Ei, kärki kiertää ojan latvan kautta"],
        ["stops", "Kyllä, kärki pysähtyy ojan rantaan"], ["wind", "Kyllä, kun tuuli kääntyy ennen ojaa"],
      ], key: "jumps",
      keyAtomIds: [], rule: "cited", basisKind: "knowledge",
      basis: "SPEC/30 §5.1 (DRAFT): EK12's step-7 radio 'Kipinät lensivät Myllyojan yli, uusi palo toisella puolella' (pushed in V5); the CA crown run passes Myllyoja's line during step 6 with a detached spot beyond it. Myllyoja is a map name, on record from step 7",
    }),
    point({
      // 2 Oct 2026: 15:20 (the end of the crown run, V4's own horizon), was 15:40 — with the 30 m/min run and the
      // 15:20 spot fires the 15:40 head lies ~450 m beyond the freeze map's frame (fire + 1.1 km). RESEARCHER CHECK.
      // Play-test R2 (researcher 25 Oct 2026; SPEC/09 (bh), panel question `11` §7.27): scored as exploratory, outside H2 and every SA
      // composite, until the expert panel decides: 0/5 play-test runs (378–792 m short, all to the south-west); the key implies ~38 m/min
      // while the pushed rate is 14.1 m/min (DR3 15.05). Its clock, 15.20, is the end of the header's span (the "now" of `08` (bg)).
      slug: "head_later", level: "L3", goal: "containment", keySteps: [6, 6], promptFi: headLaterFi(4, 6), point: truthHeadAtEndOf(6), projectionPoint: projectionHeadAtEndOf(4, 6),
      scoredFor: "exploratory",
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", basis: "the CA truth head at the end of step 6 (15:20, the crown run); projectionPoint: V4's 40-minute isochrone (a breach view); exploratory, outside H2 and the SA composites (play-test R2)",
    }),
  ],
  5: [
    point({
      // Play-test D1 (24 Oct 2026), checked against the header's "now" (the 15.20–15.40 reports): the key stays the head the 15.20 map draws,
      // ~50 m from the Koivuoja point, where the period's latest head reports put it (EK11 15.24 at Koivuoja: "kärki menee ohitsemme
      // koilliseen"; KY21: stopped at Koivuoja 15.00–15.20). The fire model's 15.40 head (`truthHeadAtEndOf(7)`, ~430 m on: the ember crossing
      // of Koivuoja) is first reported in V6, so keying it would ask for unseen information.
      slug: "head_now", level: "L1", goal: "containment", promptFi: HEAD_NOW_LATEST_FI, point: headNow(7),
      keyAtomIds: [], rule: "computed", basis: "the observed head step 7 draws (observedHead.anchor), at Koivuoja as EK11's pushed 15.24 report puts it",
    }),
    choice({
      // `31` F10, F25: replaces spot_cause (the crossing mechanism, EK12's record recalled, and stated by V4 korpioja_spot's key);
      // comprehension of the crossing for containment. SPEC/33 stage 9 (20 Oct 2026, the rebuilt map; DRAFT, panel and native review):
      // the forest-road crossing at Kuusimäki is gone, so the item relates the one crossing (Myllyoja) to where the crews are; it states
      // nothing about Koivuoja, which `road_jump` asks about.
      slug: "lines_breached", level: "L2", goal: "containment", promptFi: "Mitä Myllyojan ylitys merkitsee viimeisimpien tietojen mukaan palon rajaamiselle?", // play-test D1 (was "nyt")
      options: [
        ["no_barrier", "Myllyojan takana palaa uusi palo, jota kukaan ei sammuta"], ["put_out", "Ylityskohta on jo sammutettu, ja Myllyoja rajaa palon"],
        ["ek11", "EK11 pitää ylityskohdan Koivuojan linjaltaan käsin"], ["dies", "Uusi palo sammuu itsestään ojan kosteaan rantaan"],
      ], key: "no_barrier",
      keyAtomIds: [RADIO.sparksMyllyoja, trafficId(7, /^EK11, Koivuoja: kärki menee ohitsemme koilliseen/)], rule: "cited",
      basis: "integrates the pushed step-7 crossing (radio 7.2: a new fire on the far side of Myllyoja, no crew near, nothing done) with where the crews are (EK11 at Koivuoja, pushed 15.24; EK12 and EK14 on R1 and the north edge): the fire beyond Myllyoja burns with nobody on it, and the brook no longer bounds the fire",
    }),
    choice({
      // `31` F10: replaces units_enough (EK11's request for more units recalled); two EK11 reports related to keeping up with the head.
      slug: "hose_short", level: "L2", goal: "resources", promptFi: "Mikä rajoittaa viimeisimpien tietojen mukaan eniten EK11:n työtä Koivuojan linjalla?", // play-test D1 (was "nyt"): the 15.35 report
      options: [
        ["hose", "Letkua on liian vähän kärjen perässä pysymiseen"], ["water", "Vesi loppuu, koska vesiajo ei ehdi linjalle"],
        ["tired", "Miehistö on uupunut ja tarvitsee heti vaihdon"], ["withdrawn", "Miehet on vedetty pistepalon takia pois linjalta"],
      ], key: "hose",
      // Revision (bk), 25 Oct 2026 (SPEC/30 (bk)): seek-dependent. EK11's 15.35 hose request is held for seeking (`view-traffic.ts`
      // HELD_FOR_SEEKING; recorded, T2); pushed stay the 15.24 report and PP1's withdrawal (radio 7.4).
      // Revision (bn), 25 Oct 2026 (review S5; DRAFT, native check): the last PUSHED EK11 state before the freeze is radio 7.4, "Vedämme
      // miehet pois linjalta" (PP1 behind them, 15.30), while the stem asks what limits its work ON the line. The recorded 15.35 request now
      // says that the crew is back on the line ("palasimme linjalle. Linjaa jo 600 m …", `traffic-requests.ts` BACK_ON_LINE), and option
      // `burnt` ("Kipinät ovat polttaneet letkulinjan poikki", stated by no record) is replaced by the pushed state itself, `withdrawn`,
      // false at the freeze: the non-searcher's default is a lure, the searcher reads that the crew returned and is short of hose.
      keyAtomIds: [trafficId(7, /^EK11, Koivuoja: kärki menee ohitsemme koilliseen/), trafficId(7, /^EK11, Koivuoja: palasimme linjalle\. Linjaa jo 600 m, varaletkua alle 200 m/)], rule: "cited",
      basis: `integrates EK11's step-7 reports: the head runs past it to the north-east (15.24, pushed) and, back on the line after its 15.30 withdrawal from PP1 (radio 7.4, pushed: the \`withdrawn\` lure), its 600 m line has under 200 m of hose in reserve, more hose asked for (15.35, recorded since revision (bk)): the line cannot follow the head; EK11's tank is at ${EK11_TANK_V5.value} % (asked-only, 15.25; gate R: read from the record, was 63 % before the road-graph shuttle) and the water shuttle runs, so water is not the limit`,
    }),
    choice({
      // SPEC/30 §5.1 (DRAFT, domain review). `31` F07: before wind_shift, and the stem no longer names the forecast turn (it told everyone of
      // the recorded-only forecast, evt.wx.03, and pre-exposed a source-memory fact); the key is the crew's safety when the wind backs.
      slug: "ek14_shelter", level: "L3", goal: "safety", keySteps: [7, 8], promptFi: `Mitä pohjoisreunalla työskentelevän EK14:n on todennäköisesti tehtävä ${withinHorizonFi(5, 8)}?`,
      options: [
        ["shelter", "Siirryttävä turvaan palaneelle alueelle"], ["hold", "Jatkettava työtä samalla linjalla"],
        ["head", "Siirryttävä Koivuojalle kärjen avuksi"], ["refill", "Lähdettävä täyttämään säiliötä Haukilammelle"],
      ], key: "shelter",
      // Play-test D7 (24 Oct 2026): the forecast's headline is pushed now (P2 15.05, V4's second step), the full forecast still recorded.
      keyAtomIds: ["evt.wx.03", FORECAST_HEADLINE], rule: "cited", basisKind: "record", basisAtomIds: ["evt.wx.03", FORECAST_HEADLINE],
      basis: "SPEC/30 §5.1 (DRAFT): the forecast (evt.wx.03, recorded 15.03: SW → S → SE at 15.30–16.00; its headline pushed by P2 at 15.05 in V4, play-test D7); EK14's step-8 radio (pushed in V6): it withdraws to R1 in the middle of the burned area, the safety zone, because the turned wind leaves the north flank downwind. No record to step 7 says EK14 withdraws",
    }),
    REINFORCEMENTS, // revision (bk): `freeze-bank-seek.ts`
    // Fix pass 5 (8 Oct 2026, researcher decision): replaces rate_next. The area NOW is on record (the map, DR3's 15:35 survey); the hour's growth is the projection.
    choice({
      slug: "area_hour", level: "L3", goal: "containment", keySteps: [7, 9], promptFi: `Kuinka suuri koko palanut ala on ${horizonFi(5, 9)}?`,
      // Play-test R8 (25 Oct 2026): 90–130 / 130–190 (were 90–140 / 140–190); the guard keeps the truth ≥ 10 % of its value from every edge.
      options: [[V5_AREA_IDS[0], "Alle 90 hehtaaria"], [V5_AREA_IDS[1], "90–130 hehtaaria"], [V5_AREA_IDS[2], "130–190 hehtaaria"], [V5_AREA_IDS[3], "Yli 190 hehtaaria"]], key: V5_AREA.id,
      keyAtomIds: [], rule: "computed", basisKind: "record", basisAtomIds: [V5_SURVEY.area.id], basisSteps: [7],
      basis: `REPORT-keyed (D4; \`31\` rule (1)): the pushed 15.35 survey (DR3: ${V5_SURVEY.area.value} ha, ${V5_SURVEY.added.value} ha new in 20 minutes; the map draws step 7) carried on to the end of step 9 (16.20), ${figures(V5_AREA, "ha")}, ${f1(Math.min(...V5_AREA_EDGES.map((e) => Math.abs(V5_AREA.truthValue! - e))))} ha from its nearest edge (≥ 10 % of its value required, play-test R8); ~77 ha now`,
    }),
    // SPEC/30 §5.1. A line that fails: a brook that stopped the surface fire is crossed by embers. `31` F15: two per polarity.
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map; DRAFT, panel and native review): was "Pitääkö Kuusimäen metsäautotie palon muualla …"
    // (a second ember crossing of that road at 15:40); the rebuilt map has no forest road there, and the line that fails next is Koivuoja:
    // the surface fire stopped at it at 15.00–15.20 (radio 7.3 since gate R, pushed: the lure), and embers cross it at 15.20–15.40 (radio 8, pushed
    // in V6). The slug is kept (a shared id).
    choice({
      slug: "road_jump", level: "L3", goal: "containment", keySteps: [7, 8], promptFi: `Pysäyttääkö Koivuoja palon etenemisen ${withinHorizonFi(5, 8)}?`,
      options: [
        ["again", "Ei, kipinät lentävät ojan yli ja sytyttävät uuden palon"], ["creep", "Ei, palo ryömii ojan yli matalana pintapalona"],
        ["once", "Kyllä, kosteat rannat pysäyttävät palon ojaan"], ["crews", "Kyllä, EK11:n linja ojan varressa pitää palon"],
      ], key: "again",
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: [RADIO.koivuojaStop, RADIO.sparksMyllyoja],
      basis: "SPEC/30 §5.1 (DRAFT; SPEC/33 stage 9): the step-8 radio (pushed in V6) 'Kipinät lensivät Koivuojan yli, uusi palo toisella puolella. EK11 joutui vetäytymään' (15.20–15.40); delivered by the freeze: the surface fire stopped at Koivuoja at 15.00–15.20 (radio 7.3, pushed: the lure) and embers crossed Myllyoja in the crown run (radio 7.2, pushed; gate R: VPK's return from W1 is radio 7.1 now)",
    }),
  ],
  7: [
    choice({
      // Fix pass 3 (7 Oct 2026): a choice item: KY21's radio says it is moving to the north edge now, while the step-10 map symbol still
      // shows it on the south edge by design (UNIT_PLAN stale: [10]). `31` F24: the south-edge option is gone (it cued H10's sector).
      slug: "ky21_where", level: "L1", goal: "safety", promptFi: "Missä KY21 on viimeisimpien tietojen mukaan?", // play-test D1 (was "nyt"): its 16.2x radio
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
      slug: "lull_meaning", level: "L2", goal: "containment", promptFi: "Mitä tuulen heikkeneminen merkitsee viimeisimpien tietojen mukaan palon hallinnalle?", // play-test D1 (was "nyt")
      options: [
        ["not_out", "Reunat rauhoittuvat hetkeksi, palo ei ole ohi"], ["out", "Palo hidastuu, ja linjoja voidaan harventaa"],
        ["release", "Osa lisäyksiköistä voidaan kotiuttaa illaksi"], ["stopped", "Palo on pysähtynyt, ja reunat ovat jo kylmiä"],
      ], key: "not_out",
      keyAtomIds: ["atom.demo.10.0", trafficId(10, /^EK11, Koivuoja: pieni liekki sammalessa/)] /* safety re-check (ah): the drawn wording changed (was 'hehkuvaa kariketta ja pientä liekkiä'), same report */, rule: "cited",
      basis: "EK11: the wind easing and turning, smoke decreasing, sector 2 under control and sector 1 nearly (not out); EK11 at Koivuoja: small flames in the moss, still moving; the edges calm, the fire still burns (the CA flares up at the origin at step 12)",
    }),
    NORTH_HELP, // revision (bk): `freeze-bank-seek.ts`
    choice({
      slug: "rekindle_sector", level: "L3", goal: "containment", keySteps: [10, 12], promptFi: `Missä lohkossa uudelleensyttymisen riski on suurin ${withinHorizonFi(7, 12)}?`,
      options: [["L1", "L1 Pohjoinen"], ["L2", "L2 Koillinen"], ["L3", "L3 Etelä"], ["L4", "L4 Länsi"]], key: firstDetachedFrontAfter(9)!.sector!, // fix pass 4: from the freeze's now (step 10 on)
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth", family: "verification",
      basis: "the first CA detached front after step 10: step 12, ~120 m SE of the point of origin (6 Oct 2026: anchored to the burned edge, was ~200 m ESE), L3 (the old south edge flaring up; reported in V9) — the H10 anticipation key; `31` (a): a verification item (only VPK's recorded objection, ranked low for broad questions, warns of it)",
    }),
    choice({
      // `31` F15, F26: two options per polarity, each with its own reason (two near-duplicate yes options and "already" are gone).
      slug: "cabins_reach", level: "L3", goal: "values", keySteps: [10, 12], promptFi: `Saavuttaako palo Mökkirannan mökit ${withinHorizonFi(7, 12)}?`,
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
      slug: "cp_safe", level: "L3", goal: "safety", keySteps: [10, 12], promptFi: `Joutuuko johtopaikka siirtymään palon tai savun takia ${withinHorizonFi(7, 12)}?`,
      options: [
        ["stays", "Ei, palo ja savu pysyvät siitä kaukana"], ["moved", "Ei, johtopaikka on jo siirretty kauemmas"],
        ["road", "Kyllä, palo etenee tietä R1 pitkin sinne"], ["smoke", "Kyllä, savu peittää sen tuulen kääntyessä"],
      ], key: cpSafeKey(),
      keyAtomIds: [], rule: "computed", basisKind: "ca_truth",
      basis: `SPEC/30 §5.1 (DRAFT): CA truth distance to CP at the ends of steps 10–12: ~${f0(Math.min(...[10, 11, 12].map((st) => distanceToTruthM(st, F["CP"]!))))} m and more (computed, cpSafeKey); the wind turns S, then WNW (evt.wx.04), away from the CP; EK11 at the CP at 16:4x (pushed in V8): 'ei paloa näköetäisyydellä, savua koilliseen'; the CP has never moved`,
    }),
    choice({
      // A formation needing relief. `31` F19: keyed on pushed records (time on scene), and asked as who asks next (VPK's request is pushed in V8).
      slug: "relief_next", level: "L3", goal: "safety", keySteps: [10, 11], promptFi: `Kenen miehistö pyytää EK11:n jälkeen seuraavana vuoronvaihtoa tai korvaavaa yksikköä ${withinHorizonFi(7, 11)}?`,
      options: [["VPK", "VPK:n miehistö"], ["EK12", "EK12:n miehistö"], ["EK14", "EK14:n miehistö"], ["KY21", "KY21:n miehistö"]], key: RELIEF.key,
      keyAtomIds: [], rule: "cited", basisKind: "record", basisAtomIds: [...RELIEF.ids, RADIO.ek14Arrives, RADIO.ky21Arrives, trafficId(10, /^EK11, Koivuoja: miehistö ollut kentällä \d+,\d h\. Pyydämme vuoronvaihtoa/)],
      basis: `SPEC/30 §5.1 (DRAFT; \`31\` F19): time on scene at 16.20 from pushed records only (VPK and EK12 'olemme olleet täällä' at 13.2x, EK14's and KY21's arrival radios): ${Object.entries(RELIEF.hours).map(([u, h]) => `${u} ${h.toFixed(1)} h`).join(", ")}; EK11 asks for relief at 4.5 h (${RELIEF.ek11At}, pushed); VPK asks for relief at ${RELIEF.vpkAt} (pushed in V8)`,
    }),
  ],
};

/** Every view's bank items (the infrastructure item and F7 are added by `demo-probes.ts`). */
export const FREEZE_BANK: Readonly<Record<number, readonly ItemDef[]>> = { ...PHASE_A_BANK, ...PHASE_B_BANK };
