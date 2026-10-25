/**
 * The map training's words (researcher decision 25 Oct 2026; SPEC/08 (bj); the screen `MapTrainingScreen`, the play harness's page):
 * the frame, each task's question, options and feedback. Finnish DRAFT (native check); English DRAFT. The same for both groups and
 * both audiences. Generic: they teach the interface and general map and fire basics on the neutral extract, and name nothing of the
 * scenario — the place, road, unit and clock values come from the training's own content (`content/pretest/map-training.json`:
 * roads R5–R7, EK51, DR8, 14.00–14.42; tested against the scenario's texts). The measure tool's own labels are the TAK shell's
 * (`UI_TEXT[lang].tak`).
 */

import type { Lang } from "./lang.js";
import type { MeasureTask, MemoryTask, NowTask, PlaceTask, ProjectTask, SlopeTask, TrainingTask, WaterTask } from "../session/map-training-spec.js";

export interface MapTrainingText {
  readonly title: string;
  readonly intro: (tasks: number, minutes: number) => string;
  readonly progress: (n: number, of: number) => string;
  readonly timeLeft: (seconds: number) => string;
  readonly answer: string;
  readonly next: string;
  readonly finish: string;
  readonly chooseFirst: string;
  readonly markHint: string;
  readonly marked: string;
  readonly measureHint: string;
  readonly studyLeft: (seconds: number) => string;
  readonly logTitle: string;
  readonly yourAnswer: string;
  readonly rightAnswer: string;
  readonly yourMark: string;
  readonly rightPlace: string;
  readonly off: (metres: number) => string;
  /** The question. */
  readonly prompt: (task: TrainingTask) => string;
  /** A choice task's option label. */
  readonly option: (task: TrainingTask, optionId: string) => string;
  /** The feedback's explanation: the right answer and how it works in the simulation. */
  readonly feedback: (task: TrainingTask) => string;
  /** The log line of the "now" task (its text; the clock and sender are the task's). */
  readonly report: (task: NowTask) => string;
  /** The memory task's question while the unit is shown. */
  readonly study: (task: MemoryTask, seconds: number) => string;
  /** "Kartoitettu 14.00" / "Mapped 14.00": the fire's label on the map. */
  readonly mapped: (clock: string) => string;
}

const fiNum = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)} ${String(n % 1000).padStart(3, "0")}` : String(n));
const enNum = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, "0")}` : String(n));
/** Small counts as words at a sentence's start ("Seitsemän lyhyttä tehtävää", "Seven short tasks"). */
const FI_COUNT: Readonly<Record<number, string>> = { 4: "Neljä", 5: "Viisi", 6: "Kuusi", 7: "Seitsemän", 8: "Kahdeksan" };
const EN_COUNT: Readonly<Record<number, string>> = { 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight" };
const fiKm = (km: number) => km.toFixed(1).replace(".", ",");
const enKm = (km: number) => km.toFixed(1);
const DIR_FI: Readonly<Record<string, string>> = { ne: "koilliseen", n: "pohjoiseen", e: "itään", nw: "luoteeseen", se: "kaakkoon" };
const DIR_EN: Readonly<Record<string, string>> = { ne: "north-east", n: "north", e: "east", nw: "north-west", se: "south-east" };
/** The water task's fill points: the key's number, and the other's. */
const fills = (t: WaterTask) => (t.key === "fill_1" ? { key: 1, other: 2, k: 0, o: 1 } : { key: 2, other: 1, k: 1, o: 0 });

export const MAP_TRAINING_TEXT: Readonly<Record<Lang, MapTrainingText>> = {
  fi: {
    title: "Karttaharjoitus",
    intro: (n, min) => `${FI_COUNT[n] ?? n} lyhyttä tehtävää siitä, miten kartta toimii simulaatiossa. Kartta on eri alueelta kuin tuleva harjoitus, eikä siinä ole mitään tämän tilanteen tietoa. Vastaa kuhunkin tehtävään kerran: sen jälkeen näet oikean vastauksen ja lyhyen selityksen. Mitään ei pisteytetä. Aikaa on yhteensä ${(FI_COUNT[min] ?? String(min)).toLowerCase()} minuuttia.`,
    progress: (n, of) => `Tehtävä ${n} / ${of}`,
    timeLeft: (s) => `Aikaa jäljellä ${Math.floor(s / 60)}.${String(s % 60).padStart(2, "0")}`,
    answer: "Vastaa",
    next: "Seuraava tehtävä",
    finish: "Valmis",
    chooseFirst: "Valitse vastaus.",
    markHint: "Napauta kartalta kohta. Voit siirtää merkkiä napauttamalla uudelleen.",
    marked: "Kohta merkitty. Napauta uudelleen siirtääksesi.",
    measureHint: "Mittaa-työkalu: napauta kartalta alku- ja loppupiste.",
    studyLeft: (s) => `Kartta näkyy vielä ${s} s.`,
    logTitle: "Viestiloki",
    yourAnswer: "Vastauksesi",
    rightAnswer: "Oikea vastaus",
    yourMark: "Merkintäsi",
    rightPlace: "Oikea kohta",
    off: (m) => `Merkintäsi oli ${fiNum(m)} m päässä oikeasta kohdasta.`,
    prompt: (t) => {
      switch (t.kind) {
        case "place": return `Ilmoitukset ja Haku käyttävät paikkojen nimiä. Merkitse kartalle teiden ${t.roads[0]} ja ${t.roads[1]} risteys.`;
        case "measure": return `Kuinka kaukana A on tiestä ${t.road}? Voit mitata Mittaa-työkalulla (kartan yläpuolella) tai mittakaavajanalla.`;
        case "slope": return "Tuulta ei ole. Kohdassa A palaa. A:sta B:hen maa nousee (ruskeat korkeuskäyrät), A:sta C:hen se on tasaista. Leviääkö palo nopeammin kohti B:tä vai kohti C:tä?";
        case "water": return "Tähdellä (★) merkityllä paikalla on pumppu, jolle säiliöauto ajaa vettä. Kummasta täyttöpaikasta, 1 vai 2, auton kannattaa hakea vesi?";
        case "now": return `Kartta näyttää palon reunan sellaisena kuin se kartoitettiin klo ${t.fire.mappedAt}. Sen jälkeen viestilokiin on tullut alla oleva ilmoitus. Missä palon kärki on nyt?`;
        case "project": return `Klo ${t.fromClock} palon kärki on tiellä ${t.road} (punainen piste) ja etenee ${DIR_FI[t.direction]} noin ${t.metresPerMin} m/min. Merkitse, missä kärki on klo ${t.toClock}.`;
        case "memory": return `Tämä on muistikatkon kartta: siinä ei ole paloa, yksiköitä eikä teiden tunnuksia. Merkitse, missä ${t.unit.callsign} oli.`;
      }
    },
    option: (t, id) => {
      switch (t.kind) {
        case "measure": return `Noin ${fiNum((t as MeasureTask).options.find((o) => o.id === id)!.metres)} m`;
        case "slope": return ({ towards_b: "Nopeammin kohti B:tä", towards_c: "Nopeammin kohti C:tä", equal: "Yhtä nopeasti kumpaankin" } as Record<string, string>)[id]!;
        case "water": return ({ fill_1: "Täyttöpaikasta 1", fill_2: "Täyttöpaikasta 2", either: "Ei väliä, kummasta tahansa" } as Record<string, string>)[id]!;
        case "now": return ({ map_edge: "Siellä, mihin kartta sen piirtää", at_road: `Tiellä ${(t as NowTask).road}, kuten ilmoitus kertoo`, cannot_tell: "Sitä ei voi tietää" } as Record<string, string>)[id]!;
        default: return id;
      }
    },
    feedback: (t) => {
      switch (t.kind) {
        case "place": { const p = t as PlaceTask; return `Teiden ${p.roads[0]} ja ${p.roads[1]} risteys on vihreän renkaan kohdalla. Kartan nimet ja tunnukset – teiden tunnukset, järvien ja purojen nimet – sekä kartan selite auttavat löytämään paikat, joita ilmoitukset ja Haku käyttävät.`; }
        case "measure": { const m = t as MeasureTask; return `Lyhin matka A:sta tielle ${m.road} on noin ${fiNum(m.metres)} m (keltainen viiva). Simulaatiossa mittaat Mittaa-työkalulla: valitse oikean reunan työkaluista Mittaa ja napauta kartalta kahta kohtaa. Myös kartan mittakaavajana kertoo matkan.`; }
        case "slope": { const s = t as SlopeTask; return `Nopeammin kohti B:tä. Tuulettomassa säässä palo etenee ylämäkeen nopeammin, koska liekit kallistuvat rinnettä kohti ja kuivattavat ja lämmittävät palamatonta kasvillisuutta edeltä. Ruskeat korkeuskäyrät näyttävät rinteet: mitä tiheämmässä ne ovat, sitä jyrkempi rinne. A:sta B:hen maa nousee noin ${s.riseB.toFixed(0)} m.`; }
        case "water": { const w = t as WaterTask, f = fills(w); return `Täyttöpaikasta ${f.key}. Linnuntietä täyttöpaikka ${f.other} on lähempänä: ${fiKm(w.straightKm[f.o]!)} km, kun täyttöpaikalle ${f.key} on ${fiKm(w.straightKm[f.k]!)} km. Tietä pitkin täyttöpaikalle ${f.other} on kuitenkin ${fiKm(w.roadKm[f.o]!)} km ja täyttöpaikalle ${f.key} vain ${fiKm(w.roadKm[f.k]!)} km. Ratkaisee ajomatka tietä pitkin: simulaatiossa säiliöautot ajavat vettä teitä pitkin.`; }
        case "now": { const n = t as NowTask; return `Tiellä ${n.road}. Kartta näyttää reunan sellaisena kuin se kartoitettiin jakson alussa (klo ${n.fire.mappedAt}); lokin uudemmat ilmoitukset kertovat, missä palo on nyt (klo ${n.report.clock}). Muistikatkoissa ”nyt” tarkoittaa tilannetta uusimpien ilmoitusten mukaan.`; }
        case "project": { const p = t as ProjectTask, m = p.minutes * p.metresPerMin; return `Noin ${fiNum(m)} m ${DIR_FI[p.direction]} tiestä ${p.road}: klo ${p.fromClock}–${p.toClock} on ${p.minutes} minuuttia, ja ${p.minutes} min × ${p.metresPerMin} m/min = ${fiNum(m)} m. Ennustekysymykset nimeävät kellonajan. Laske aika uusimmasta ilmoituksesta, ei kartan piirtämästä reunasta.`; }
        case "memory": { const u = t as MemoryTask; return `${u.unit.callsign} oli tässä. Muistikatkon kartalla ei ole paloa eikä yksiköitä, joten kiinnitä paikat mieleesi teihin, vesistöihin ja nimiin: millä tiellä, minkä järven tai puron kohdalla.`; }
      }
    },
    report: (t) => `Palon kärki on edennyt tielle ${t.road}.`,
    study: (t, s) => `Paina mieleesi, missä yksikkö ${t.unit.callsign} on. Kartta näkyy ${s} sekuntia, sitten kysytään.`,
    mapped: (c) => `Kartoitettu ${c}`,
  },
  en: {
    title: "Map training",
    intro: (n, min) => `${EN_COUNT[n] ?? n} short tasks on how the map works in the simulation. The map is of a different area from the coming practice and holds nothing about this situation. Answer each task once: you then see the right answer and a short explanation. Nothing is scored. You have ${(EN_COUNT[min] ?? String(min)).toLowerCase()} minutes in all.`,
    progress: (n, of) => `Task ${n} of ${of}`,
    timeLeft: (s) => `Time left ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
    answer: "Answer",
    next: "Next task",
    finish: "Done",
    chooseFirst: "Choose an answer.",
    markHint: "Tap a point on the map. You can move the mark by tapping again.",
    marked: "Point marked. Tap again to move it.",
    measureHint: "The R&B tool: tap a start point and an end point on the map.",
    studyLeft: (s) => `The map shows for ${s} s more.`,
    logTitle: "Message log",
    yourAnswer: "Your answer",
    rightAnswer: "The right answer",
    yourMark: "Your mark",
    rightPlace: "The right place",
    off: (m) => `Your mark was ${enNum(m)} m from the right place.`,
    prompt: (t) => {
      switch (t.kind) {
        case "place": return `Reports and Search use place names. Mark the junction of roads ${t.roads[0]} and ${t.roads[1]} on the map.`;
        case "measure": return `How far is A from road ${t.road}? You can measure with the R&B tool (above the map) or with the scale bar.`;
        case "slope": return "There is no wind. A fire is burning at A. From A to B the ground rises (the brown contour lines); from A to C it is level. Will the fire spread faster towards B or towards C?";
        case "water": return "A pump stands at the star (★), and a tanker brings it water. Which fill point should the tanker use, 1 or 2?";
        case "now": return `The map shows the fire's edge as it was mapped at ${t.fire.mappedAt}. Since then, the report below has come into the message log. Where is the head of the fire now?`;
        case "project": return `At ${t.fromClock} the head of the fire is at road ${t.road} (the red dot), moving ${DIR_EN[t.direction]} at about ${t.metresPerMin} m/min. Mark where the head will be at ${t.toClock}.`;
        case "memory": return `This is the memory-check map: it shows no fire, no units and no road codes. Mark where ${t.unit.callsign} was.`;
      }
    },
    option: (t, id) => {
      switch (t.kind) {
        case "measure": return `About ${enNum((t as MeasureTask).options.find((o) => o.id === id)!.metres)} m`;
        case "slope": return ({ towards_b: "Faster towards B", towards_c: "Faster towards C", equal: "Equally fast both ways" } as Record<string, string>)[id]!;
        case "water": return ({ fill_1: "Fill point 1", fill_2: "Fill point 2", either: "It makes no difference" } as Record<string, string>)[id]!;
        case "now": return ({ map_edge: "Where the map draws it", at_road: `At road ${(t as NowTask).road}, as the report says`, cannot_tell: "There is no way to tell" } as Record<string, string>)[id]!;
        default: return id;
      }
    },
    feedback: (t) => {
      switch (t.kind) {
        case "place": { const p = t as PlaceTask; return `The junction of roads ${p.roads[0]} and ${p.roads[1]} is at the green ring. The map's names and codes – road codes, the names of lakes and brooks – and its legend help you find the places that reports and Search name.`; }
        case "measure": { const m = t as MeasureTask; return `The shortest distance from A to road ${m.road} is about ${enNum(m.metres)} m (the yellow line). In the simulation you measure with the R&B tool: choose R&B among the tools on the right edge and tap two points on the map. The map's scale bar tells distances too.`; }
        case "slope": { const s = t as SlopeTask; return `Faster towards B. With no wind a fire spreads faster uphill, because the flames lean towards the slope and dry and heat the unburnt fuel ahead of them. The brown contour lines show slopes: the closer together they are, the steeper the slope. From A to B the ground rises about ${s.riseB.toFixed(0)} m.`; }
        case "water": { const w = t as WaterTask, f = fills(w); return `Fill point ${f.key}. In a straight line fill point ${f.other} is nearer: ${enKm(w.straightKm[f.o]!)} km, against ${enKm(w.straightKm[f.k]!)} km to fill point ${f.key}. By road, though, fill point ${f.other} is ${enKm(w.roadKm[f.o]!)} km away and fill point ${f.key} only ${enKm(w.roadKm[f.k]!)} km. The drive by road is what counts: in the simulation, tankers shuttle water by road.`; }
        case "now": { const n = t as NowTask; return `At road ${n.road}. The map shows the edge as it was mapped at the start of the period (${n.fire.mappedAt}); newer reports in the log tell you where the fire is now (${n.report.clock}). In the memory checks, “now” means the situation the latest reports give.`; }
        case "project": { const p = t as ProjectTask, m = p.minutes * p.metresPerMin; return `About ${enNum(m)} m ${DIR_EN[p.direction]} of road ${p.road}: ${p.fromClock} to ${p.toClock} is ${p.minutes} minutes, and ${p.minutes} min × ${p.metresPerMin} m/min = ${enNum(m)} m. Projection questions name a clock time; count it from the latest report, not from the edge the map draws.`; }
        case "memory": { const u = t as MemoryTask; return `${u.unit.callsign} was here. The memory-check map shows no fire and no units, so anchor places in your memory to roads, water and names: on which road, by which lake or brook.`; }
      }
    },
    report: (t) => `The head of the fire has reached road ${t.road}.`,
    study: (t, s) => `Remember where unit ${t.unit.callsign} is. The map is shown for ${s} seconds; then comes the question.`,
    mapped: (c) => `Mapped ${c}`,
  },
};
