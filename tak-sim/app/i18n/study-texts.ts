/**
 * The study shell's participant-facing texts (work package I, 5 Oct 2026): the consent screen, the
 * preflight's refusal screen, the pre- and post-session questionnaires and the debrief. One dictionary per language with the same keys (`StudyText`).
 *
 * EVERYTHING HERE IS DRAFT. The consent text is a PLACEHOLDER for the ethics board (SPEC/09 §9): it
 * lists what the board's text must cover and is marked as such on screen. The questionnaire's items
 * follow SPEC/09 §2, §6.1 and SPEC/27 §4.1; the workload items are the six NASA-TLX subscales (raw
 * TLX), whose Finnish wording must be replaced by a validated translation before pilot 1. The AI
 * literacy questionnaire's screen texts are here; its items (SNAIL, verbatim English, a DRAFT
 * unvalidated Finnish rendering) are in `app/session/ai-literacy-items.ts` (revision (ac), 9 Oct 2026). The debrief
 * follows SPEC/09 §5.1 with revisions (o), (p), (t) and (u). Native, domain and ethics review pending;
 * `npm run review:export` writes every string here for the reviewers.
 *
 * The English glossary of Finnish terms (researcher decision R2, 5 Oct 2026) is gone (revision (ae),
 * 9 Oct 2026): an English session names places, sources and the volunteer brigade in English
 * (`app/i18n/place-names.ts`, `sourceName` in `text.ts`), and the roster's hover card gives each unit
 * call sign's type, so nothing on an English screen needs it.
 */

import type { Lang } from "./lang.js";
import type { Cell } from "../scenario/types.js";
import type { PreflightFailure } from "../session/preflight.js";

/** Which consent text was shown (logged in `consent_decided`). Change it whenever the text changes. */
export const CONSENT_TEXT_ID = "consent.placeholder.v0";

export interface ItemText {
  readonly prompt: string;
  /** Option labels by option id (choice and multi items; a `pick_from` item uses its source's). */
  readonly options?: Readonly<Record<string, string>>;
  /** Scale anchors (scale items). */
  readonly low?: string;
  readonly high?: string;
}


export interface StudyText {
  readonly consent: {
    readonly title: string;
    /** Shown above the text until the ethics board's text replaces it. */
    readonly placeholderBanner: string;
    readonly paragraphs: readonly string[];
    readonly consentCheckbox: string;
    readonly attestCheckbox: string;
    readonly accept: string;
    readonly decline: string;
    readonly declinedTitle: string;
    readonly declinedBody: string;
  };
  readonly preflight: {
    readonly title: string;
    readonly checking: string;
    readonly refusedTitle: string;
    readonly refusedIntro: string;
    readonly hardNote: string;
    readonly softNote: string;
    readonly failures: Readonly<Record<PreflightFailure, { readonly title: string; readonly fix: string }>>;
    readonly recheck: string;
    readonly overrideDemo: string;
  };
  /** The AI literacy questionnaire's screen (SNAIL, revision (ac)); the items' own text is in `ai-literacy-items.ts`. */
  readonly aiLiteracy: {
    readonly title: string;
    readonly intro: string;
    /** The items' shared stem ("I can…"); each item completes it. */
    readonly stem: string;
    /** "Page" in "Page 3 / 8". */
    readonly pageLabel: string;
    readonly timeLeft: string;
    /** The scale's anchors at 1 and 7 (SNAIL: "strongly disagree" … "strongly agree"). */
    readonly low: string;
    readonly high: string;
    readonly next: string;
    readonly skip: string;
    readonly skipConfirm: string;
    readonly skipYes: string;
    readonly skipCancel: string;
    /** Outside the study only, while the items are a placeholder (`AI_LITERACY_ITEMS_PENDING`). */
    readonly pendingBanner: string;
    /** Outside the study only, in Finnish: the rendering is an unvalidated draft. Empty in English. */
    readonly draftTranslationBanner: string;
  };
  readonly questionnaire: {
    readonly preTitle: string;
    readonly preIntro: string;
    readonly postTitle: string;
    readonly postIntro: string;
    readonly sections: Readonly<Record<string, string>>;
    readonly submit: string;
    readonly optionalNote: string;
    readonly items: Readonly<Record<string, ItemText>>;
  };
  readonly debrief: {
    readonly title: string;
    readonly paragraphs: (cell: Cell) => readonly string[];
    readonly finish: string;
  };
}

// ---------------------------------------------------------------------------------------------------
// Shared values
// ---------------------------------------------------------------------------------------------------

/** The projection's accuracy in the fourteen views (SPEC/03 §6.2, `CANONICAL_FLAG_SEQUENCE`): 7 hold, 7 do not. Checked by test. */
export const DEBRIEF_PROJECTION_HELD = 7;
export const DEBRIEF_VIEW_COUNT = 14;

const yesNoUnsureFi = { yes: "Kyllä", no: "Ei", unsure: "En osaa sanoa" };
const yesNoUnsureEn = { yes: "Yes", no: "No", unsure: "Not sure" };

// ---------------------------------------------------------------------------------------------------
// Finnish
// ---------------------------------------------------------------------------------------------------

const FI: StudyText = {
  consent: {
    title: "Suostumus tutkimukseen osallistumiseen",
    placeholderBanner: "PAIKKAMERKKI — eettinen toimikunta hyväksyy lopullisen tekstin. Tämä teksti ei ole hyväksytty suostumusteksti.",
    paragraphs: [
      "Tämä on väitöstutkimus siitä, miten maastopalon johtajat arvioivat tilannekuvaa ja koneen tuottamia leviämisennusteita. Istunto kestää noin tunnin, ja se tehdään yhdellä kertaa omalla tietokoneellasi.",
      "Mitä tallennetaan: vastauksesi, kohdennuksesi, hakusi ja niiden ajoitus sekä selaimen ja näytön tiedot. Työkaluille (Haku ja, jos istunnossasi on, Thinker) kirjoittamasi kysymykset lähetetään tutkimuksen palvelimen kautta ulkoiselle tekoälypalvelulle (Google Gemini), jonka kielimalli tuottaa vastaukset. Älä kirjoita kysymyksiin henkilötietoja.",
      "[Eettinen toimikunta: rekisterinpitäjä, tietojen säilytyspaikka (EU), säilytys- ja poistoaika, pseudonyymi osallistujakoodi, osallistumisen vapaaehtoisuus, oikeus keskeyttää ja perua tietojen käyttö, yhteystiedot.]",
      "Osallistuminen tai suoriutuminen ei vaikuta työsi arviointiin. [Isäntäorganisaation kirjallinen vakuutus.]",
    ],
    consentCheckbox: "Olen lukenut tiedot ja suostun osallistumaan tutkimukseen.",
    attestCheckbox: "Teen istunnon yhdellä kertaa keskeyttämättä, en käytä ulkopuolisia lähteitä tai kysy kollegoilta, enkä kerro skenaarion sisällöstä kenellekään, joka saattaa myös osallistua.",
    accept: "Suostun ja jatkan",
    decline: "En suostu",
    declinedTitle: "Kiitos",
    declinedBody: "Et antanut suostumusta, joten istunto päättyi. Sinusta ei tallennettu tutkimusaineistoa. Voit sulkea tämän ikkunan.",
  },
  preflight: {
    title: "Laitteen tarkistus",
    checking: "Tarkistetaan selain ja yhteys…",
    refusedTitle: "Istuntoa ei voi aloittaa tällä laitteella tai näillä asetuksilla",
    refusedIntro: "Tarkistus löysi seuraavat esteet:",
    hardNote: "Avaa tutkimuslinkki uudelleen laitteella ja selaimella, joka täyttää vaatimukset.",
    softNote: "Korjaa asia ja tarkista uudelleen.",
    failures: {
      not_desktop: { title: "Laite ei ole pöytä- tai kannettava tietokone", fix: "Istunto toimii vain tietokoneella hiiren tai kosketuslevyn kanssa, ei puhelimella tai tabletilla." },
      no_indexeddb: { title: "Selain ei salli paikallista tallennusta (IndexedDB)", fix: "Älä käytä yksityistä tai incognito-ikkunaa, ja salli sivuston tietojen tallennus. Käytä ajantasaista Chrome-, Edge-, Firefox- tai Safari-selainta." },
      no_webgl2: { title: "Selain ei tue karttanäkymää (WebGL2)", fix: "Käytä ajantasaista Chrome-, Edge-, Firefox- tai Safari-selainta ja salli laitteistokiihdytys selaimen asetuksista." },
      proxy_unreachable: { title: "Yhteys tutkimuksen palvelimeen ei toimi", fix: "Tarkista verkkoyhteys (työpaikan palomuuri tai VPN voi estää yhteyden) ja tarkista uudelleen." },
    },
    recheck: "Tarkista uudelleen",
    overrideDemo: "Jatka silti (vain esittely)",
  },
  // DRAFT: the AI literacy screen texts await native review; the items' Finnish is in `ai-literacy-items.ts` (DRAFT, unvalidated).
  aiLiteracy: {
    title: "Tekoälyosaaminen",
    intro: "31 väitettä omasta tekoälyosaamisestasi. Arvioi kukin asteikolla 1–7 sen mukaan, kuinka hyvin väite kuvaa sinua; oikeita tai vääriä vastauksia ei ole. Aikaa on 5 minuuttia. Edelliselle sivulle ei voi palata. Voit myös ohittaa kyselyn.",
    stem: "Osaan…",
    pageLabel: "Sivu",
    timeLeft: "Aikaa jäljellä",
    low: "1 — täysin eri mieltä",
    high: "7 — täysin samaa mieltä",
    next: "Seuraava",
    skip: "Ohita testi",
    skipConfirm: "Ohitetaanko kysely? Jo antamasi arviot tallentuvat, ja arvioimattomat väitteet jäävät tyhjiksi.",
    skipYes: "Kyllä, ohita",
    skipCancel: "Jatka kyselyä",
    pendingBanner: "PAIKKAMERKKI — väitteet eivät ole julkaistun kyselyn väitteitä.",
    draftTranslationBanner: "LUONNOS — väitteiden suomennos on validoimaton (vain esittely).",
  },
  questionnaire: {
    preTitle: "Ennen aloitusta",
    preIntro: "Yksi kysymys ennen tilannekuvausta.",
    postTitle: "Kysely istunnon jälkeen",
    postIntro: "Vastaa kysymyksiin istunnon perusteella. Kysely kestää noin 15 minuuttia.",
    sections: { recall: "Muistatko", workload: "Kuormitus", session: "Istunto", background: "Taustatiedot" },
    submit: "Lähetä vastaukset",
    optionalNote: "Voit jättää kysymyksen vastaamatta.",
    items: {
      "fatigue.start": { prompt: "Kuinka väsynyt olet juuri nyt?", low: "1 — en lainkaan", high: "7 — erittäin" },
      "retention.hinge": { prompt: "Mikä oli istunnon lopussa voimassa oleva toimintalinja?" },
      "ai.directive_relation": { prompt: "Liittyikö Thinkerin kanssa käymäsi keskustelu päivystävän palopäällikön (P2) antamaan linjaukseen?", options: { yes: "Kyllä", no: "Ei", dont_know: "En tiedä" } },
      "directive.fit": { prompt: "Sopiko päivystävän palopäällikön linjaus tilanteeseen sen kehittyessä?", options: { fitted: "Sopi koko ajan", not_at_times: "Ei sopinut ajoittain", not_mostly: "Ei sopinut suurimman osan ajasta", dont_know: "En osaa sanoa" } },
      "tlx.mental": { prompt: "Henkinen vaativuus: kuinka henkisesti vaativa tehtävä oli?", low: "Hyvin vähäinen", high: "Hyvin suuri" },
      "tlx.physical": { prompt: "Fyysinen vaativuus: kuinka fyysisesti vaativa tehtävä oli?", low: "Hyvin vähäinen", high: "Hyvin suuri" },
      "tlx.temporal": { prompt: "Aikapaine: kuinka kiireiseltä tehtävän tahti tuntui?", low: "Hyvin vähäinen", high: "Hyvin suuri" },
      "tlx.performance": { prompt: "Suoriutuminen: kuinka hyvin onnistuit siinä, mitä sinun pyydettiin tekemään?", low: "Täydellisesti", high: "Epäonnistuin" },
      "tlx.effort": { prompt: "Ponnistelu: kuinka paljon jouduit ponnistelemaan suoriutuaksesi?", low: "Hyvin vähän", high: "Hyvin paljon" },
      "tlx.frustration": { prompt: "Turhautuminen: kuinka epävarma, ärtynyt tai stressaantunut olit?", low: "Hyvin vähän", high: "Hyvin paljon" },
      "fatigue.end": { prompt: "Kuinka väsynyt olet juuri nyt?", low: "1 — en lainkaan", high: "7 — erittäin" },
      "picture.quality": { prompt: "Kuinka täydellinen ja oikea tilannekuvasi oli istunnon aikana?", low: "1 — hyvin puutteellinen", high: "7 — täydellinen" },
      "picture.trust": { prompt: "Kuinka paljon luotit yksiköiden ilmoituksiin ja tallentuneisiin tietoihin?", low: "1 — en lainkaan", high: "7 — täysin" },
      "tools.trust": { prompt: "Kuinka paljon luotit tietoon, jonka sait Haku-työkalulla (haku ja Haun chat)?", low: "1 — en lainkaan", high: "7 — täysin" },
      "attention.check": { prompt: "Jotta näemme, että luet kysymykset huolellisesti, valitse tähän väittämään vastaukseksi \"Eri mieltä\" (2).", low: "1 — täysin eri mieltä", high: "7 — täysin samaa mieltä" },
      "thinker.trust": { prompt: "Kuinka paljon luotit Thinkerin vastauksiin?", low: "1 — en lainkaan", high: "7 — täysin" },
      "last.possibilities": { prompt: "Viimeisimmässä kohdennuksessasi: kuinka monta eri vaihtoehtoa palon kehittymiselle harkitsit?", options: { "1": "1", "2": "2", "3": "3", "4": "4", "5plus": "5 tai enemmän" } },
      "last.basis": {
        prompt: "Mihin perustit viimeisimmän kohdennuksesi? Valitse kaikki, jotka pitävät paikkansa.",
        options: {
          projection: "Kartan leviämisennuste", unit_reports: "Miehistöjen ja yksiköiden radioilmoitukset", drone_sensor: "Droonien ja sensorien tiedot",
          situation_log: "Viestiloki", search: "Haku", thinker: "Thinker", directive: "Johdon linjaus", experience: "Oma koulutukseni ja kokemukseni", other: "Muu",
        },
      },
      "last.basis.main": { prompt: "Mikä näistä oli tärkein?" },
      "disagreement.recall": { prompt: "Muistatko olleesi jossain vaiheessa eri mieltä leviämisennusteen kanssa?", options: yesNoUnsureFi },
      "disagreement.action": {
        prompt: "Mitä teit asialle? Valitse kaikki, jotka pitävät paikkansa.",
        options: {
          checked_reports: "Tarkistin ilmoitukset tai viestilokin", asked_search: "Kysyin Hausta", asked_thinker: "Kysyin Thinkeriltä",
          placed_on_own_estimate: "Sijoitin suunnitelmani sinne, minne odotin palon menevän, en sinne, minne ennuste sen näytti",
          safety_margin: "Muutin suunnitelmaa jättääkseni turvamarginaalin", went_with_projection: "Toimin silti ennusteen mukaan", nothing: "En mitään erityistä",
        },
      },
      "felt.wrong": { prompt: "Tuntuiko jokin tilannekuvassa väärältä?", options: yesNoUnsureFi },
      "prior.knowledge": { prompt: "Tiesitkö ennen tätä istuntoa jotain tämän harjoituksen sisällöstä (esimerkiksi aiemmin osallistuneelta)?", options: yesNoUnsureFi },
      "role.rank": { prompt: "Nykyinen tehtäväsi", options: { crew: "Pelastaja / miehistö", crew_commander: "Yksikönjohtaja", platoon_commander: "Pelastusjoukkueen johtaja / palomestari (P3)", duty_chief: "Päivystävä palopäällikkö (P2) tai ylempi", student: "Opiskelija", other: "Muu" } },
      "years.service": { prompt: "Palvelusvuodet pelastustoimessa (0–50)" },
      "incidents.commanded": { prompt: "Kuinka monta maastopalotehtävää olet johtanut?", options: { none: "Ei yhtään", "1_5": "1–5", "6_20": "6–20", "21_50": "21–50", over_50: "Yli 50" } },
      "sim.exposure": { prompt: "Kuinka monessa johtamisen simulaatio- tai karttaharjoituksessa olet ollut?", options: { none: "Ei yhdessäkään", "1_2": "1–2", "3_10": "3–10", over_10: "Yli 10" } },
      "region.familiarity": { prompt: "Kuinka hyvin tunnet Kaakkois-Suomen alueen, jolle skenaario sijoittuu?", low: "1 — en lainkaan", high: "7 — erittäin hyvin" },
      "service.country": { prompt: "Missä maassa palvelet?", options: { finland: "Suomessa", other: "Muussa maassa" } },
      "terms.familiarity": { prompt: "Kuinka tuttuja suomalaisen pelastustoimen yksikkötunnukset ja termit (esim. P2, EK11, VPK) ovat sinulle?", low: "1 — eivät lainkaan", high: "7 — täysin" },
    },
  },
  debrief: {
    title: "Mitä istunnossa tapahtui",
    paragraphs: (cell) => [
      "Kiitos osallistumisesta. Tutkimus selvittää, miten maastopalon johtajat tarkistavat koneen tuottamia leviämisennusteita ja tilannekuvaa ja miten tekoälyavustaja vaikuttaa siihen. Osallistujat jaettiin satunnaisesti: osa käytti vain Hakua, osa Hakua ja tekoälyavustajaa (Thinker). Hakun vastaukset tuotti kielimalli kaikilla, kuten istunnon alussa kerrottiin.",
      `Tilanne oli käsikirjoitettu etukäteen, jotta jokainen osallistuja näki saman. Leviämisennuste piti paikkansa ${DEBRIEF_PROJECTION_HELD} jaksossa ${DEBRIEF_VIEW_COUNT}:stä; muissa se oli osittain tai perustavanlaatuisesti väärä. Ennusteen virheet oli rakennettu tarkoituksella, eivätkä ne kerro arvostelukyvystäsi.`,
      "Tallenteisiin oli tarkoituksella istutettu yksi väärä kirjaus: tilannepäiväkirjaan merkittiin iltapäivällä, että 110 kV voimajohto on jännitteetön ja asia vahvistettu. Johto oli koko ajan jännitteinen; verkkoyhtiön oma kirjaus kertoi, että poiskytkentää oli vain pyydetty. Virheellä tutkittiin, huomataanko ristiriita ja tarkistetaanko tieto muista lähteistä." +
        (cell === "radio" ? "" : " Thinker luki samoja tallenteita, myös tämän kirjauksen, ja saattoi välittää sen eteenpäin; sille ei kerrottu, mitkä kirjaukset olivat vääriä."),
      "Istunnon puolivälin tienoilla, tuulen heiketessä, miehistöt ilmoittivat syttymäkohdan eteläpuolen hallinnassa olevaksi, ja ne siirrettiin pohjoissivustalle. VPK:n johtaja huomautti radiossa, että syttymäkohta voi vielä kyteä ja se pitäisi tarkistaa lämpökameralla; huomautus sivuutettiin, ja palo syttyi myöhemmin uudelleen juuri siellä. Huomautus, siirtokäsky ja uudelleensyttyminen olivat käsikirjoitettuja: et olisi voinut muuttaa niitä.",
      "Tauon jälkeen päivystävä palopäällikkö (P2) antoi linjauksen. Sen jälkeiset jaksot oli kirjoitettu niin, että linjaus ei sopinut niihin kaikkiin: joissakin suora hyökkäys saattoi olla perusteltu valinta. Linjauksesta poikkeaminen siellä, missä se ei sopinut tilanteeseen, saattoi olla oikea päätös. Mikään vastaus ei ollut väärä vain siksi, että se poikkesi linjauksesta.",
      "Saat kirjallisen selvityksen 48 tunnin kuluessa. [PAIKKAMERKKI, eettinen toimikunta: miten voit perua tietojesi käytön nyt, kun tiedät, mitä tutkimus selvitti, ja keneen otat yhteyttä.]",
      "Pyydämme, ettet kerro istunnon kulusta tai näistä tiedoista kollegoillesi ennen kuin tutkimus on päättynyt: muut saattavat vielä osallistua.",
    ],
    finish: "Päätä istunto",
  },
};

// ---------------------------------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------------------------------

const EN: StudyText = {
  consent: {
    title: "Consent to take part in the study",
    placeholderBanner: "PLACEHOLDER — the final text is approved by the ethics board. This is not an approved consent text.",
    paragraphs: [
      "This is a doctoral study of how wildfire commanders assess the situation and machine-generated spread projections. The session takes about an hour and is done in one sitting on your own computer.",
      "What is recorded: your answers, allocations and searches and their timing, and details of your browser and screen. The questions you type to the tools (Search and, if your session includes it, Thinker) are sent through the study's server to an external AI service (Google Gemini), whose language model produces the answers. Do not type personal information into your questions.",
      "[Ethics board: data controller, where the data are held (EU), retention and deletion, the pseudonymous participant code, that taking part is voluntary, the right to stop and to withdraw your data, contact details.]",
      "Taking part, and how you do, does not affect any assessment of your work. [Written assurance from the host organisation.]",
    ],
    consentCheckbox: "I have read the information and I agree to take part in the study.",
    attestCheckbox: "I will complete the session in one sitting without interruption, I will not use outside sources or ask colleagues, and I will not discuss the scenario with anyone who may also take part.",
    accept: "I agree — continue",
    decline: "I do not agree",
    declinedTitle: "Thank you",
    declinedBody: "You did not give consent, so the session has ended. No study data about you were recorded. You can close this window.",
  },
  preflight: {
    title: "Checking your computer",
    checking: "Checking the browser and the connection…",
    refusedTitle: "The session cannot start on this device or with these settings",
    refusedIntro: "The check found the following:",
    hardNote: "Open the study link again on a device and browser that meet the requirements.",
    softNote: "Fix this and check again.",
    failures: {
      not_desktop: { title: "This is not a desktop or laptop computer", fix: "The session works only on a computer with a mouse or touchpad, not on a phone or tablet." },
      no_indexeddb: { title: "The browser does not allow local storage (IndexedDB)", fix: "Do not use a private or incognito window, and allow the site to store data. Use a current Chrome, Edge, Firefox or Safari." },
      no_webgl2: { title: "The browser cannot show the map (WebGL2)", fix: "Use a current Chrome, Edge, Firefox or Safari and turn on hardware acceleration in the browser's settings." },
      proxy_unreachable: { title: "The study's server cannot be reached", fix: "Check your network connection (a workplace firewall or VPN can block it) and check again." },
    },
    recheck: "Check again",
    overrideDemo: "Continue anyway (demonstration only)",
  },
  aiLiteracy: {
    title: "AI literacy",
    intro: "31 statements about your own AI literacy. Rate each from 1 to 7 by how well it describes you; there are no right or wrong answers. You have 5 minutes. You cannot go back to a previous page. You may also skip the questionnaire.",
    stem: "I can…",
    pageLabel: "Page",
    timeLeft: "Time left",
    low: "1 — strongly disagree",
    high: "7 — strongly agree",
    next: "Next",
    skip: "Skip the test",
    skipConfirm: "Skip the test? The ratings you have given are kept, and the statements not rated stay blank.",
    skipYes: "Yes, skip",
    skipCancel: "Continue",
    pendingBanner: "PLACEHOLDER — these are not the published items.",
    draftTranslationBanner: "",
  },
  questionnaire: {
    preTitle: "Before you start",
    preIntro: "One question before the situation briefing.",
    postTitle: "Questionnaire after the session",
    postIntro: "Answer from your experience of the session. The questionnaire takes about 15 minutes.",
    sections: { recall: "Recall", workload: "Workload", session: "The session", background: "About you" },
    submit: "Submit answers",
    optionalNote: "You may leave a question unanswered.",
    items: {
      "fatigue.start": { prompt: "How tired do you feel right now?", low: "1 — not at all", high: "7 — extremely" },
      "retention.hinge": { prompt: "What was the line of action in force at the end of the session?" },
      "ai.directive_relation": { prompt: "Did your discussion with Thinker relate to the directive given by the duty fire chief (P2)?", options: { yes: "Yes", no: "No", dont_know: "Don't know" } },
      "directive.fit": { prompt: "Did the duty fire chief's directive fit the situation as it developed?", options: { fitted: "It fitted throughout", not_at_times: "It did not fit at times", not_mostly: "It did not fit most of the time", dont_know: "Don't know" } },
      "tlx.mental": { prompt: "Mental demand: how mentally demanding was the task?", low: "Very low", high: "Very high" },
      "tlx.physical": { prompt: "Physical demand: how physically demanding was the task?", low: "Very low", high: "Very high" },
      "tlx.temporal": { prompt: "Temporal demand: how hurried or rushed was the pace of the task?", low: "Very low", high: "Very high" },
      "tlx.performance": { prompt: "Performance: how successful were you in doing what you were asked to do?", low: "Perfect", high: "Failure" },
      "tlx.effort": { prompt: "Effort: how hard did you have to work to reach your level of performance?", low: "Very low", high: "Very high" },
      "tlx.frustration": { prompt: "Frustration: how insecure, discouraged, irritated, stressed or annoyed were you?", low: "Very low", high: "Very high" },
      "fatigue.end": { prompt: "How tired do you feel right now?", low: "1 — not at all", high: "7 — extremely" },
      "picture.quality": { prompt: "How complete and accurate was your picture of the situation during the session?", low: "1 — very incomplete", high: "7 — complete" },
      "picture.trust": { prompt: "How far did you trust the units' reports and the recorded information?", low: "1 — not at all", high: "7 — fully" },
      "tools.trust": { prompt: "How far did you trust the information you got from the Search tool: its search and its chat?", low: "1 — not at all", high: "7 — fully" },
      "attention.check": { prompt: "To show you are reading carefully, choose \"Disagree\" (2) for this statement.", low: "1 — strongly disagree", high: "7 — strongly agree" },
      "thinker.trust": { prompt: "How far did you trust Thinker's answers?", low: "1 — not at all", high: "7 — fully" },
      "last.possibilities": { prompt: "In your last allocation: how many different possibilities for the fire's development did you consider?", options: { "1": "1", "2": "2", "3": "3", "4": "4", "5plus": "5 or more" } },
      "last.basis": {
        prompt: "What did you base your last allocation on? Choose all that apply.",
        options: {
          projection: "The spread projection on the map", unit_reports: "Crew and unit radio reports", drone_sensor: "Drone and sensor information",
          situation_log: "The message log", search: "Search", thinker: "Thinker", directive: "The command directive", experience: "My training and experience", other: "Other",
        },
      },
      "last.basis.main": { prompt: "Which one mattered most?" },
      "disagreement.recall": { prompt: "Do you remember disagreeing with the spread projection at any point?", options: yesNoUnsureEn },
      "disagreement.action": {
        prompt: "What did you do about it? Choose all that apply.",
        options: {
          checked_reports: "Checked the reports or the log", asked_search: "Asked Search", asked_thinker: "Asked Thinker",
          placed_on_own_estimate: "Placed my plan where I expected the fire, rather than where the projection showed it",
          safety_margin: "Adjusted the plan to leave a safety margin", went_with_projection: "Went with the projection anyway", nothing: "Nothing in particular",
        },
      },
      "felt.wrong": { prompt: "Did anything in the picture of the situation feel wrong?", options: yesNoUnsureEn },
      "prior.knowledge": { prompt: "Before this session, did you know anything about the content of this exercise (for example from someone who took part earlier)?", options: yesNoUnsureEn },
      "role.rank": { prompt: "Your current role", options: { crew: "Firefighter / crew member", crew_commander: "Crew commander", platoon_commander: "Platoon commander / fire master", duty_chief: "Duty fire chief (P2 level) or above", student: "Student", other: "Other" } },
      "years.service": { prompt: "Years of service in the fire and rescue services (0–50)" },
      "incidents.commanded": { prompt: "How many wildfire incidents have you commanded?", options: { none: "None", "1_5": "1–5", "6_20": "6–20", "21_50": "21–50", over_50: "More than 50" } },
      "sim.exposure": { prompt: "How many command simulations or map exercises have you taken part in?", options: { none: "None", "1_2": "1–2", "3_10": "3–10", over_10: "More than 10" } },
      "region.familiarity": { prompt: "How well do you know the area of south-east Finland where the scenario is set?", low: "1 — not at all", high: "7 — very well" },
      "service.country": { prompt: "In which country do you serve?", options: { finland: "Finland", other: "Another country" } },
      "terms.familiarity": { prompt: "How familiar are Finnish rescue-service call signs and terms (such as P2, EK11) to you?", low: "1 — not at all", high: "7 — fully" },
    },
  },
  debrief: {
    title: "What happened in the session",
    paragraphs: (cell) => [
      "Thank you for taking part. The study looks at how wildfire commanders check machine-generated spread projections and the picture of the situation, and how an AI assistant affects that. Participants were assigned at random: some used Search only, others Search and an AI assistant (Thinker). Search's answers were produced by a language model for everyone, as stated at the start of the session.",
      `The situation was scripted in advance so that every participant saw the same thing. The spread projection held in ${DEBRIEF_PROJECTION_HELD} of the ${DEBRIEF_VIEW_COUNT} periods; in the others it was partly or fundamentally wrong. Its errors were built in on purpose and say nothing about your judgement.`,
      "One false record was planted on purpose: in the afternoon, the situation log recorded the 110 kV power line as de-energised and confirmed. The line was live throughout; the grid operator's own record said that de-energising had only been requested. The error was there to see whether the conflict is noticed and the information checked against other sources." +
        (cell === "radio" ? "" : " Thinker read the same records, this one included, and could pass it on; it was not told which records were wrong."),
      "Around the middle of the session, as the wind eased, crews reported the south side of the point of origin in hand and were moved to the north flank. The volunteer fire brigade's crew leader (VOL1) said on the radio that the origin could still be smouldering and should be checked with a thermal camera; this was overruled, and the fire later flared up there. The objection, the order to move and the flare-up were scripted: nothing you did could have changed them.",
      "After the break, the duty fire chief (P2) gave a directive. The periods after it were written so that the directive did not fit all of them: in some, a direct attack could be the sound choice. Departing from the directive where it did not fit the situation could be the right decision. No answer was wrong just because it departed from the directive.",
      "You will receive a written debrief within 48 hours. [PLACEHOLDER, ethics board: how you can withdraw your data now that you know what the study looked at, and whom to contact.]",
      "Please do not describe the session or this information to colleagues until the study has ended: others may still take part.",
    ],
    finish: "End the session",
  },
};

export const STUDY_TEXT: Readonly<Record<Lang, StudyText>> = { fi: FI, en: EN };

/** The debrief text's id for a cell (logged in `debrief_shown`). */
export function debriefTextId(cell: Cell): string {
  return `debrief.${cell}`;
}
