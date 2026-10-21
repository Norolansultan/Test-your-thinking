/**
 * The public-audience version's texts (SPEC/35 §4–§5, 21 Oct 2026; work package P1): the consent and the debrief for participants
 * from the general population, the background items that replace the firefighter items, the mission card on the training page and
 * the chapter titles on the views' status strip. Everything here is the same in every cell (SPEC/35 §1: the layer never differs
 * between the groups); the debrief differs only by the session's scope (a phase-A session ends at the hinge).
 *
 * EVERYTHING HERE IS DRAFT. The consent is a PLACEHOLDER for the ethics board (SPEC/35 §8 item 1) and is marked as such on screen;
 * the Finnish awaits the native check (§8 item 2); the background items are researcher items. No text assumes a fire-rescue
 * background, and none says what happens in the scenario.
 */

import type { Lang } from "./lang.js";
import { STUDY_TEXT, type ItemText, type StudyText } from "./study-texts.js";
import { CANONICAL_FLAG_SEQUENCE } from "../scenario/types.js";
import { HINGE_AFTER_VIEW, MAIN_VIEW_COUNT } from "../scenario/views.js";

export type PublicScope = "full" | "phaseA";

/** The views a scope runs and how many of them the projection held in (SPEC/03 §6.2, `CANONICAL_FLAG_SEQUENCE`). */
export function projectionHeldIn(scope: PublicScope): { readonly held: number; readonly views: number } {
  const flags = CANONICAL_FLAG_SEQUENCE.slice(0, scope === "phaseA" ? HINGE_AFTER_VIEW : MAIN_VIEW_COUNT);
  return { held: flags.filter((f) => f === "holds").length, views: flags.length };
}

export interface PublicText {
  readonly consentParagraphs: (scope: PublicScope) => readonly string[];
  readonly attestCheckbox: string;
  readonly debriefParagraphs: (scope: PublicScope) => readonly string[];
  readonly items: Readonly<Record<string, ItemText>>;
  /** The mission card (SPEC/35 §4) on the training page before V1. */
  readonly mission: { readonly title: string; readonly paragraphs: readonly string[] };
  /** "Chapter" before the chapter's number on the status strip. */
  readonly chapter: string;
  /** The chapters' titles (`chapterOf`): the time of day only, so a title says nothing of what happens. */
  readonly chapterTitles: readonly [string, string, string, string];
}

/**
 * The chapter a main view belongs to (SPEC/35 §4), by the clock: I 13:20–14:40 (V1–V3), II 14:40–16:40 (V4–V7, to the hinge),
 * III 16:40–18:20 (V8–V11), IV 18:20–20:00 (V12–V14). A phase-A session has chapters I and II. Null for the practice view.
 */
export function chapterOf(view: number): 1 | 2 | 3 | 4 | null {
  if (view < 1 || view > MAIN_VIEW_COUNT) return null;
  return view <= 3 ? 1 : view <= HINGE_AFTER_VIEW ? 2 : view <= 11 ? 3 : 4;
}

/** The chapter label the status strip shows in a public session ("Luku 2 · Iltapäivä"), or null in the practice view. */
export function chapterLabel(lang: Lang, view: number): string | null {
  const n = chapterOf(view);
  return n === null ? null : `${PUBLIC_TEXT[lang].chapter} ${n} · ${PUBLIC_TEXT[lang].chapterTitles[n - 1]}`;
}

const DURATION = { fi: { full: "noin 100 minuuttia", phaseA: "noin tunnin" }, en: { full: "about 100 minutes", phaseA: "about an hour" } } as const;
const FREQUENCY_FI = { never: "En koskaan", rarely: "Harvemmin kuin kerran kuukaudessa", monthly: "Muutaman kerran kuukaudessa", weekly: "Viikoittain", daily: "Päivittäin" };
const FREQUENCY_EN = { never: "Never", rarely: "Less than once a month", monthly: "A few times a month", weekly: "Every week", daily: "Every day" };

// ---------------------------------------------------------------------------------------------------
// Finnish (DRAFT, native check)
// ---------------------------------------------------------------------------------------------------

const FI: PublicText = {
  consentParagraphs: (scope) => [
    `Tämä on väitöstutkimus siitä, miten ihmiset tekevät päätöksiä nopeasti muuttuvassa tilanteessa koneen tuottamien ennusteiden, tekoälyavustajan ja muiden tietolähteiden avulla. Toimit simuloidun maastopalon johtajana. Pelastusalan osaamista ei tarvita: ennen tehtävää lyhyt perehdytys selittää sanat ja näytön. Istunto kestää ${DURATION.fi[scope]}, ja se tehdään yhdellä kertaa omalla tietokoneellasi.`,
    "Mitä tallennetaan: vastauksesi, suunnitelmasi ja hakusi ja niiden ajoitus, avaamasi selitykset sekä selaimen ja näytön tiedot. Työkaluille (Haku ja, jos istunnossasi on, Thinker) kirjoittamasi kysymykset lähetetään tutkimuksen palvelimen kautta ulkoiselle tekoälypalvelulle (Google Gemini), jonka kielimalli tuottaa vastaukset. Älä kirjoita kysymyksiin henkilötietoja.",
    "[Eettinen toimikunta: rekisterinpitäjä, tietojen säilytyspaikka (EU), säilytys- ja poistoaika, pseudonyymi osallistujakoodi, osallistumisen vapaaehtoisuus, oikeus keskeyttää ja perua tietojen käyttö, yhteystiedot.]",
    "Sinulta ei odoteta etukäteistietoja, eikä suoriutumisellasi ole sinulle seurauksia. [Eettinen toimikunta: mahdollinen palkkio osallistumisesta.]",
  ],
  attestCheckbox: "Teen istunnon yhdellä kertaa keskeyttämättä, en käytä ulkopuolisia lähteitä tai pyydä keneltäkään apua, enkä kerro skenaarion sisällöstä kenellekään, joka saattaa myös osallistua.",
  debriefParagraphs: (scope) => {
    const { held, views } = projectionHeldIn(scope);
    return [
      "Kiitos osallistumisesta. Tutkimus selvittää, miten ihmiset tarkistavat koneen tuottamia ennusteita ja saamiaan tietoja ja miten tekoälyavustaja vaikuttaa siihen. Samaa tehtävää tekevät myös maastopalojen johtajat, ja tutkimus vertaa ryhmiä. Osallistujat jaettiin satunnaisesti: osa käytti vain Hakua, osa Hakua ja tekoälyavustajaa (Thinker). Hakun vastaukset tuotti kielimalli kaikilla, kuten istunnon alussa kerrottiin.",
      `Tilanne oli käsikirjoitettu etukäteen, jotta jokainen osallistuja näki saman. Kartan leviämisennuste piti paikkansa ${held} jaksossa ${views}:stä; muissa se oli osittain tai perustavanlaatuisesti väärä. Ennusteen virheet oli rakennettu tarkoituksella, eivätkä ne kerro arvostelukyvystäsi.`,
      "Tallenteisiin oli tarkoituksella istutettu yksi väärä kirjaus: johtopaikan lokiin merkittiin iltapäivällä, että alueen sähkölinja on jännitteetön (virta katkaistu) ja asia vahvistettu. Linja oli koko ajan jännitteinen; sähköyhtiön oma kirjaus kertoi, että virran katkaisua oli vain pyydetty. Virheellä tutkittiin, huomataanko ristiriita ja tarkistetaanko tieto muista lähteistä. Jos käytössäsi oli tekoälyavustaja, se luki samoja tallenteita, myös tämän kirjauksen, ja saattoi välittää sen eteenpäin; sille ei kerrottu, mitkä kirjaukset olivat vääriä.",
      scope === "phaseA"
        ? "Istunnon loppupuolella, tuulen heiketessä, miehistöt ilmoittivat palon syttymäkohdan ympäristön hallinnassa olevaksi, ja ne siirrettiin muualle. VPK:n johtaja huomautti radiossa, että maasto voi siellä vielä kyteä ja se pitäisi tarkistaa lämpökameralla; huomautus sivuutettiin. Skenaariossa palo syttyy myöhemmin uudelleen juuri siellä, istuntosi päättymisen jälkeen. Huomautus ja siirtokäsky olivat käsikirjoitettuja: et olisi voinut muuttaa niitä."
        : "Istunnon puolivälin tienoilla, tuulen heiketessä, miehistöt ilmoittivat palon syttymäkohdan ympäristön hallinnassa olevaksi, ja ne siirrettiin muualle. VPK:n johtaja huomautti radiossa, että maasto voi siellä vielä kyteä ja se pitäisi tarkistaa lämpökameralla; huomautus sivuutettiin, ja palo syttyi myöhemmin uudelleen juuri siellä. Huomautus, siirtokäsky ja uudelleensyttyminen olivat käsikirjoitettuja: et olisi voinut muuttaa niitä.",
      ...(scope === "phaseA" ? [] : ["Tauon jälkeen päivystävä palopäällikkö (P2), johtajan esimies, antoi linjauksen. Sen jälkeiset jaksot oli kirjoitettu niin, että linjaus ei sopinut niihin kaikkiin. Linjauksesta poikkeaminen siellä, missä se ei sopinut tilanteeseen, saattoi olla oikea päätös. Mikään vastaus ei ollut väärä vain siksi, että se poikkesi linjauksesta."]),
      "Saat kirjallisen selvityksen 48 tunnin kuluessa. [PAIKKAMERKKI, eettinen toimikunta: miten voit perua tietojesi käytön nyt, kun tiedät, mitä tutkimus selvitti, ja keneen otat yhteyttä.]",
      "Pyydämme, ettet kerro istunnon kulusta tai näistä tiedoista kenellekään ennen kuin tutkimus on päättynyt: muut saattavat vielä osallistua.",
    ];
  },
  items: {
    "public.age_band": { prompt: "Ikäsi", options: { "18_24": "18–24", "25_34": "25–34", "35_44": "35–44", "45_54": "45–54", "55_64": "55–64", "65_plus": "65 tai yli" } },
    "public.education": { prompt: "Korkein suorittamasi koulutus", options: { basic: "Perusaste", secondary: "Toinen aste (lukio tai ammatillinen)", bachelor: "Alempi korkeakoulututkinto tai AMK", master: "Ylempi korkeakoulututkinto", doctorate: "Tohtorin tutkinto" } },
    "public.management": { prompt: "Kokemuksesi esihenkilönä tai johtajana", options: { none: "Ei kokemusta", team_lead: "Tiimin- tai ryhmänvetäjä", manager: "Esihenkilö tai päällikkö", executive: "Ylin johto" } },
    "public.responder": { prompt: "Onko sinulla taustaa pelastus-, ensihoito- tai poliisitehtävistä tai sotilastehtävistä?", options: { none: "Ei", some: "Jonkin verran (esim. asepalvelus, vapaaehtoistoiminta, koulutus)", professional: "Ammattina" } },
    "public.gaming": { prompt: "Kuinka usein pelaat digitaalisia pelejä?", options: FREQUENCY_FI },
    "public.ai_use": { prompt: "Kuinka usein käytät tekoälyavustajia (esim. ChatGPT, Copilot, Gemini)?", options: FREQUENCY_FI },
  },
  mission: {
    title: "Tehtäväsi",
    paragraphs: [
      "Olet maastopalon johtaja. Miehistöt ja drooniryhmät ovat paikalla, ja tilanne muuttuu koko ajan. Jokaisessa jaksossa luet kartan ja ilmoitukset, käytät halutessasi työkaluja ja kirjaat suunnitelmasi.",
      "Pisteitä ei lasketa eikä tulosta näytetä: kiinnostavaa on, miten sinä luet tilannetta. Tee niin kuin itse parhaaksi näet.",
    ],
  },
  chapter: "Luku",
  chapterTitles: ["Alkuiltapäivä", "Iltapäivä", "Alkuilta", "Ilta"],
};

// ---------------------------------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------------------------------

const EN: PublicText = {
  consentParagraphs: (scope) => [
    `This is a doctoral study of how people make decisions in a fast-changing situation with machine-generated forecasts, an AI assistant and other sources of information. You take the role of the commander at a simulated forest fire. No knowledge of firefighting is needed: before the task, a short introduction explains the words and the screen. The session takes ${DURATION.en[scope]} and is done in one sitting on your own computer.`,
    "What is recorded: your answers, plans and searches and their timing, the explanations you open, and details of your browser and screen. The questions you type to the tools (Search and, if your session includes it, Thinker) are sent through the study's server to an external AI service (Google Gemini), whose language model produces the answers. Do not type personal information into your questions.",
    "[Ethics board: data controller, where the data are held (EU), retention and deletion, the pseudonymous participant code, that taking part is voluntary, the right to stop and to withdraw your data, contact details.]",
    "You are not expected to know anything in advance, and how you do has no consequences for you. [Ethics board: any reward for taking part.]",
  ],
  attestCheckbox: "I will complete the session in one sitting without interruption, I will not use outside sources or ask anyone for help, and I will not discuss the scenario with anyone who may also take part.",
  debriefParagraphs: (scope) => {
    const { held, views } = projectionHeldIn(scope);
    return [
      "Thank you for taking part. The study looks at how people check machine-generated forecasts and the information they are given, and how an AI assistant affects that. Professional wildfire commanders do the same task, and the study compares the groups. Participants were assigned at random: some used Search only, others Search and an AI assistant (Thinker). Search's answers were produced by a language model for everyone, as stated at the start of the session.",
      `The situation was scripted in advance so that every participant saw the same thing. The spread forecast on the map held in ${held} of the ${views} periods; in the others it was partly or fundamentally wrong. Its errors were built in on purpose and say nothing about your judgement.`,
      "One false record was planted on purpose: in the afternoon, the command post's log recorded the power line in the area as switched off (de-energised) and confirmed. The line was live throughout; the power company's own record said that switching it off had only been requested. The error was there to see whether the conflict is noticed and the information checked against other sources. If you had the AI assistant, it read the same records, this one included, and could pass it on; it was not told which records were wrong.",
      scope === "phaseA"
        ? "Towards the end of the session, as the wind eased, crews reported the area around the fire's point of origin under control and were moved elsewhere. The volunteer crew's leader (VOL1) said on the radio that the ground there could still be smouldering and should be checked with a thermal camera; this was overruled. In the scenario the fire flares up there later, after the point where your session ended. The warning and the order to move were scripted: nothing you did could have changed them."
        : "Around the middle of the session, as the wind eased, crews reported the area around the fire's point of origin under control and were moved elsewhere. The volunteer crew's leader (VOL1) said on the radio that the ground there could still be smouldering and should be checked with a thermal camera; this was overruled, and the fire later flared up there. The warning, the order to move and the flare-up were scripted: nothing you did could have changed them.",
      ...(scope === "phaseA" ? [] : ["After the break, the duty fire chief (P2), the commander's superior, gave a directive. The periods after it were written so that the directive did not fit all of them. Departing from the directive where it did not fit the situation could be the right decision. No answer was wrong just because it departed from the directive."]),
      "You will receive a written debrief within 48 hours. [PLACEHOLDER, ethics board: how you can withdraw your data now that you know what the study looked at, and whom to contact.]",
      "Please do not describe the session or this information to anyone until the study has ended: others may still take part.",
    ];
  },
  items: {
    "public.age_band": { prompt: "Your age", options: { "18_24": "18–24", "25_34": "25–34", "35_44": "35–44", "45_54": "45–54", "55_64": "55–64", "65_plus": "65 or over" } },
    "public.education": { prompt: "Your highest completed education", options: { basic: "Basic (comprehensive) school", secondary: "Upper secondary or vocational", bachelor: "Bachelor's degree", master: "Master's degree", doctorate: "Doctorate" } },
    "public.management": { prompt: "Your experience of leading people", options: { none: "None", team_lead: "Team or group leader", manager: "Manager", executive: "Senior executive" } },
    "public.responder": { prompt: "Do you have a background in rescue, emergency care, police or military work?", options: { none: "No", some: "Some (for example military service, volunteering, training)", professional: "As a profession" } },
    "public.gaming": { prompt: "How often do you play digital games?", options: FREQUENCY_EN },
    "public.ai_use": { prompt: "How often do you use AI assistants (for example ChatGPT, Copilot, Gemini)?", options: FREQUENCY_EN },
  },
  mission: {
    title: "Your mission",
    paragraphs: [
      "You are the incident commander at a forest fire. Your crews and drone teams are on the scene, and the situation keeps changing. In each period you read the map and the reports, use the tools if you wish, and record your plan.",
      "There are no points and no score: what matters is how you read the situation. Do as you think best.",
    ],
  },
  chapter: "Chapter",
  chapterTitles: ["Early afternoon", "Afternoon", "Early evening", "Evening"],
};

export const PUBLIC_TEXT: Readonly<Record<Lang, PublicText>> = { fi: FI, en: EN };

/** Who the session is for and how much of it runs, as the texts need them (`SessionOrchestrator.audience`, `scope`). */
export interface TextSetting {
  readonly audience: "expert" | "public";
  readonly scope: PublicScope;
}

/**
 * The study shell's texts for a session: the expert texts as they are, or (public) with the public consent, debrief and background
 * items in place. The public debrief is the same in every cell (its `cell` argument is not read).
 */
export function studyTextFor(lang: Lang, setting: TextSetting): StudyText {
  const base = STUDY_TEXT[lang];
  if (setting.audience !== "public") return base;
  const p = PUBLIC_TEXT[lang];
  return {
    ...base,
    consent: { ...base.consent, paragraphs: p.consentParagraphs(setting.scope), attestCheckbox: p.attestCheckbox },
    questionnaire: { ...base.questionnaire, items: { ...base.questionnaire.items, ...p.items } },
    debrief: { ...base.debrief, paragraphs: () => p.debriefParagraphs(setting.scope) },
  };
}
