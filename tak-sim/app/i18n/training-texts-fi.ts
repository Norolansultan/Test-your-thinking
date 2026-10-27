/**
 * The training incident's Finnish texts (SPEC/08 (bp) §bp.5). DRAFT: every text here waits for the native check (`08` (bp) §bp.10).
 * The figures in them (distances, the direction, the side of R5, the road the measuring task names) are read from the build's
 * content (`figure`), and the records and questions the lessons quote from the training's corpus (`quoteRecord`, `question`).
 * Descriptive, never directive: no text tells the participant to search, before the memory checks or before answering, and none
 * ties a score to searching (`test/training/texts.spec.ts`).
 */

import { TRAINING } from "../session/training/spec-data.js";
import { decimal, figure, km, question, quoteRecord, sentence, type TrainingWords } from "./training-texts-shared.js";

const TO: Readonly<Record<string, string>> = { n: "pohjoiseen", ne: "koilliseen", e: "itään", se: "kaakkoon", s: "etelään", sw: "lounaaseen", w: "länteen", nw: "luoteeseen" };
const SIDE: Readonly<Record<string, string>> = { n: "Tien pohjoispuolella", s: "Tien eteläpuolella" };
const minutes = Math.round(TRAINING.capMs / 60_000);
const r6To = () => TO[String(figure("training.s3.older", "r6Dir"))]!;
const quote = (id: string) => { const r = quoteRecord("fi", id); return `${r.source} ${r.clock}: ”${r.text}”`; };
const lesson = (qid: string) => `”${question("fi", qid)}”`;
const at = (id: string) => { const r = quoteRecord("fi", id); return `${r.source}, ${r.clock}`; };

export const TRAINING_WORDS_FI: TrainingWords = {
  lang: "fi",
  intro: {
    title: "Harjoitus: pieni maastopalo Kaitajärvellä",
    body: [
      "Tämä on erillinen harjoituspalo kartan koillisnurkassa. Siinä ei ole mitään tulevasta istunnosta.",
      "Käytät samoja työkaluja kuin istunnossa: karttaa, viestilokia ja Hakua. Jokaisen tehtävän jälkeen näet, mistä tieto oli löydettävissä ja mikä vastaus oli oikea.",
      `Harjoitusta ei pisteytetä. Aikaa on enintään ${minutes} minuuttia.`,
    ],
    start: "Aloita harjoitus",
  },
  sections: {
    s1: { title: "Kartta", body: ["Teet kolme tai neljä lyhyttä tehtävää kartalla. Tiekoodit R5, R6 ja R7 kuuluvat vain tähän harjoitukseen."], go: "Jatka" },
    s2: { title: "Viestiloki on karttaa uudempi", body: ["Kartta näyttää palon sellaisena kuin se kartoitettiin jakson alussa, klo 10.00. Viestilokissa on tuoreempia ilmoituksia."], go: "Jatka" },
    s3: { title: "Kirjaukset ja haku", body: ["Tässä osassa Haku ja viestiloki ovat käytössäsi. Haku vastaa tässä vain tämän harjoituksen kirjauksista."], go: "Jatka" },
    s4: { title: "Muistikatkon harjoitus", body: ["Kuva piilotetaan ja vastaat muistin varassa: kartta, viestiloki ja Haku eivät ole käytössä. Arvioit varmuutesi jokaisen vastauksen jälkeen. Vastauksen jälkeen näet, mistä tieto oli löydettävissä."], go: "Jatka" },
    s5: { title: "Työkalut", body: [], go: "Valmis" },
  },
  stems: {
    "training.s1.place": "Raportit ja Haku käyttävät paikannimiä ja tiekoodeja. Merkitse kartalle teiden R5 ja R6 risteys.",
    "training.s1.measure": `Kuinka kaukana A on tiestä ${figure("training.s1.measure", "road")}? Voit mitata oikean reunan Mittaa-työkalulla tai kartan mittakaavajanalla.`,
    "training.s1.slope": "Tuulta ei ole. Palo palaa pisteessä A. Pisteestä A pisteeseen B maa nousee (ruskeat korkeuskäyrät), pisteestä A pisteeseen C maa on tasaista. Kumpaan suuntaan palo etenee nopeammin?",
    "training.s1.water": "Pumppu on kohdassa ★, ja säiliöauto tuo sille vettä ajamalla tietä pitkin. Kartalla näkyvät tiet ovat ainoat yhteydet. Kumpaa täyttöpaikkaa auton pitää käyttää?",
    "training.s2.now": "Kartta näyttää palon reunan sellaisena kuin se kartoitettiin klo 10.00. Viestilokissa on uudempia ilmoituksia. Missä kärki on nyt?",
    "training.s2.project": `Klo 10.12 palon kärki on tiellä R5 ja etenee ${TO[String(figure("training.s2.project", "dir"))]}, nopeus noin 10 m/min. Merkitse kartalle, missä kärki on klo 10.42.`,
    "training.s3.records1": "Mikä on palavan alan koko DR8:n viimeisimmän kuvauksen mukaan?",
    "training.s3.older": "Mikä on tien R6 tila säiliöauton kannalta viimeisimpien tietojen mukaan?",
    "training.s3.records2": "Kuinka monta henkilöä EK51:n miehistössä on?",
    "training.s4.memory": "Merkitse kartalle, missä EK53 oli.",
    "training.s4.log": "Kuka ilmoitti, että palon kärki on tiellä R5?",
    "training.s4.map": "Kummalla puolella tietä R5 palo oli kartalla, joka kartoitettiin klo 10.00?",
    "training.s4.records": "Kuinka nopeasti DR8:n kuvauksen mukaan palon kärki eteni?",
  },
  options: {
    "training.s1.measure": { m150: "noin 150 m", m300: "noin 300 m", m600: "noin 600 m", m1200: "noin 1 200 m" },
    "training.s1.slope": { towards_b: "Nopeammin kohti B:tä", towards_c: "Nopeammin kohti C:tä", equal: "Yhtä nopeasti molempiin" },
    "training.s1.water": { fill_1: "Täyttöpaikkaa 1", fill_2: "Täyttöpaikkaa 2", either: "Ei ole eroa" },
    "training.s2.now": { map_edge: "Siinä, mihin kartta sen piirtää", at_road: "Tiellä R5, kuten ilmoitus kertoo", cannot_tell: "Sitä ei voi tietää" },
    "training.s3.records1": { ha02: "noin 0,2 ha", ha04: "noin 0,4 ha", ha11: "noin 1,1 ha", ha25: "noin 2,5 ha" },
    "training.s3.older": {
      passable: `Ajettavissa risteyksestä ${r6To()} ilman esteitä`, blocked: `Tukossa noin 300 m risteyksestä ${r6To()}`,
      cut_by_fire: "Suljettu palon vuoksi", light_only: "Kunnossa, mutta vain kevyille ajoneuvoille",
    },
    "training.s3.records2": { two: "kaksi", three: "kolme", four: "neljä", six: "kuusi" },
    "training.s4.log": { ek51: "EK51", ek52: "EK52", dr8: "DR8", nobody: "Ei kukaan" },
    "training.s4.map": { north: SIDE.n!, south: SIDE.s!, both: "Tien molemmin puolin", none: "Kartalla ei näkynyt paloa" },
    "training.s4.records": { mpm4: "noin 4 m/min", mpm10: "noin 10 m/min", mpm20: "noin 20 m/min", mpm40: "noin 40 m/min" },
  },
  source: (c) => `Lähde: ${{ log: "viestiloki", map: "kartta", records: "kirjaukset", reasoning: "päättely viimeisimmästä ilmoituksesta ja etenemisnopeudesta" }[c]}.`,
  chose: (label) => `Vastauksesi: ${label}.`,
  markedAway: (m) => `Merkkisi oli ${Math.round(m)} m päässä oikeasta kohdasta.`,
  noMark: "Et merkinnyt paikkaa.",
  timedOut: "Aika loppui ennen vastausta.",
  noAnswer: "Et vastannut.",
  feedback: {
    "training.s1.place": () => ({
      answer: "Teiden R5 ja R6 risteys on vihreässä renkaassa.",
      explain: ["Kartan nimet ja koodit – tiekoodit, järvien ja ojien nimet – sekä selite auttavat löytämään paikat, joihin ilmoitukset ja Haku viittaavat."],
    }),
    "training.s1.measure": ({ item }) => ({
      answer: `Lyhin matka pisteestä A tiehen ${item.feedback.numbers.road} on noin ${item.feedback.numbers.m} m (keltainen viiva).`,
      explain: ["Mittaat sen valitsemalla oikean reunan työkaluista Mittaa ja napauttamalla kartalta kahta kohtaa. Myös mittakaavajana kertoo matkan."],
    }),
    "training.s1.slope": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [`Tuulettomana palo etenee nopeammin ylämäkeen, koska liekit kallistuvat rinteeseen ja kuivattavat ja lämmittävät edessä olevaa polttoainetta. Ruskeat korkeuskäyrät näyttävät rinteet: mitä tiheämmässä ne ovat, sitä jyrkempi rinne. Pisteestä A pisteeseen B maa nousee noin ${item.feedback.numbers.m} m.`],
    }),
    "training.s1.water": ({ keyLabel, item }) => {
      const n = item.feedback.numbers;
      return {
        answer: sentence(keyLabel),
        explain: [`Täyttöpaikka ${n.other} on linnuntietä lähempänä (${km("fi", Number(n.a))} km), mutta sinne ei johda tietä, eikä säiliöauto pääse sinne. Täyttöpaikalle ${n.key} on ajomatkaa tietä pitkin ${km("fi", Number(n.b))} km. Säiliöautot kuljettavat vettä teitä pitkin: ratkaisevaa on, että tie yltää veteen ja kuinka pitkä ajomatka on.`],
      };
    },
    "training.s2.now": ({ item }) => ({
      answer: `Tiellä ${item.feedback.numbers.road}.`,
      explain: [`Kartta näyttää reunan jakson alun mukaan (${item.feedback.numbers.mapped}); viestilokin uudempi ilmoitus kertoo, missä kärki on nyt (${item.feedback.numbers.from}, ${item.feedback.numbers.report}). Muistikatkoissa ”nyt” tarkoittaa viimeisimpien ilmoitusten mukaista tilannetta.`],
    }),
    "training.s2.project": ({ item }) => {
      const n = item.feedback.numbers;
      return {
        answer: `Noin ${n.m} m tiestä R5 ${TO[String(n.dir)]}: ${n.from}–${n.to} on ${n.minutes} minuuttia, ja ${n.minutes} min × ${n.rate} m/min = ${Number(n.minutes) * Number(n.rate)} m.`,
        explain: ["Projektiokysymyksessä kellonaika lasketaan viimeisimmästä ilmoituksesta, ei kartan reunasta."],
      };
    },
    "training.s3.records1": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        "Tieto oli kirjauksissa, ei viestilokissa. Viestiloki näyttää vain osan liikenteestä: droonien kartoitukset, yksiköiden tilatiedot ja muu kirjattu tieto ovat kirjauksissa, ja ne löytyvät Haulla.",
        `Haun kysymys kuten ${lesson(item.lesson!.questionId)} olisi näyttänyt tämän: ${quote(item.lesson!.recordIds[0]!)}`,
        `Viestilokin ${decimal("fi", Number(item.feedback.numbers.lureHa))} ha (${at(String(item.feedback.numbers.lureRecord))}) oli aiempi arvio.`,
      ],
    }),
    "training.s3.older": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        `Haun kysymys ${lesson(item.lesson!.questionId)} näyttäisi ensin vanhemman kirjauksen: ${quote(item.lesson!.recordIds[0]!)}`,
        `Viestilokissa on uudempi ilmoitus: ${quote(item.lesson!.recordIds[1]!)}`,
        "Uudempi ilmoitus kertoo tilanteen nyt; kirjaus voi olla vanhempi kuin viestiloki.",
      ],
    }),
    "training.s3.records2": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        "Yksiköiden tila kirjataan, kun sitä kysytään.",
        `Haun kysymys kuten ${lesson(item.lesson!.questionId)} olisi näyttänyt tämän: ${quote(item.lesson!.recordIds[0]!)}`,
        `Viestilokin ”kaksi miestä linjalla” (${at(String(item.feedback.numbers.lureRecord))}) kertoi vain linjalla olevat.`,
      ],
    }),
    "training.s4.memory": ({ item }) => ({
      answer: `${item.memory!.unit} oli tässä.`,
      explain: ["Muistikatkon kartta ei näytä paloa, yksiköitä eikä tiekoodeja, joten paikan voi kiinnittää muistissa tiehen, veteen ja nimiin: millä tiellä, minkä järven tai ojan vieressä."],
    }),
    "training.s4.log": ({ keyLabel, item }) => ({
      answer: `${keyLabel}, klo ${quoteRecord("fi", String(item.feedback.numbers.record)).clock}.`,
      explain: ["Lähettäjä ja kellonaika ovat rivin alussa."],
    }),
    "training.s4.map": ({ keyLabel }) => ({
      answer: sentence(keyLabel),
      explain: ["Kartta näyttää palon kartoitushetken mukaan; viestilokin uudemmat ilmoitukset voivat kertoa enemmän."],
    }),
    "training.s4.records": ({ keyLabel, item }) => ({
      answer: sentence(keyLabel),
      explain: [
        `Tieto oli kirjauksissa (${at(item.lesson!.recordIds[0]!)}), ja se näkyi myös aiemman tehtävän palautteessa.`,
        `Haun kysymys kuten ${lesson(item.lesson!.questionId)} löytää sen.`,
      ],
    }),
  },
  ui: {
    progress: "Tehtävä {n}/{of}",
    timeLeft: "Harjoituksen aikaa jäljellä {t}",
    answer: "Vastaa",
    markHint: "Merkitse paikka napauttamalla karttaa.",
    marked: "Merkintä tehty",
    chooseFirst: "Valitse vastaus.",
    memoryExposure: "Muista, missä yksikkö EK53 on.",
    studyLeft: "Kartta piilotetaan {s} s kuluttua.",
    freezeNote: "Vastaa muistin varassa. Harjoituksen aika kuluu.",
    yourAnswer: "Vastauksesi",
    noAnswer: "Ei vastausta: aika loppui.",
    next: "Seuraava",
    done: "Valmis",
    capEnded: "Harjoituksen aika päättyi. Jäljellä olevat tehtävät jäävät väliin.",
    question: "Kysymys",
    recorded: "Nauhoitettu",
    demoWait: "Painike on käytössä {s} s kuluttua.",
  },
};
