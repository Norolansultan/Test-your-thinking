/**
 * Interface strings, one dictionary per language with the same keys (the `UiText` type makes a
 * missing English string a type error). Edit the wording here; nothing else needs to change.
 * DRAFT English (native and domain review pending).
 */

import type { Lang } from "./lang.js";
import type { DepartureReason, MainEffortPosture, PlanDroneTaskId, SecondaryTaskId } from "../scenario/plan-types.js";
import {
  HAKU_CHAT_EN, HAKU_CHAT_FI, PRACTICE_THINKER_EN, PRACTICE_THINKER_EXAMPLE_EN, PRACTICE_THINKER_EXAMPLE_FI, PRACTICE_THINKER_FI, PROJECTION_CAVEAT_EN, PROJECTION_CAVEAT_FI,
  SECTORS_EN, SECTORS_FI, TOOLS_THINKER_AGAIN_EN, TOOLS_THINKER_AGAIN_FI, TOOLS_THINKER_INTENT_AGAIN_EN, TOOLS_THINKER_INTENT_AGAIN_FI, TOUR_SETTING_EN, TOUR_SETTING_FI,
} from "../scenario/briefing.js";
import type { TourStepId } from "../render/ui/tour.js";

export interface UiText {
  /** The browser tab's title (`document.title`), set with the page's `lang` from the session language. */
  readonly pageTitle: string;
  readonly startTitle: string;
  readonly startNote: string;
  readonly languageLabel: string;
  readonly conditionDirected: string;
  readonly conditionSubstitutive: string;
  readonly loading: string;
  readonly briefingTitle: string;
  readonly startPractice: string;
  /** The intro video before the practice view (10 Oct 2026): play (when the browser blocks autoplay), the hint, the failure, the demonstration's skip. */
  readonly introVideo: { readonly play: string; readonly watchFirst: string; readonly failed: string; readonly skip: string };
  readonly startTask: string;
  readonly clock: string;
  readonly step: string;
  readonly phase: { readonly exploration: string; readonly freeze: string; readonly decision: string };
  readonly onScene: string;
  readonly newItems: string;
  readonly condition: string;
  readonly logRecords: string;
  readonly preview: string;
  readonly practiceLabel: string;
  readonly viewLabel: (index: number, total: number) => string;
  readonly practiceNotScored: string;
  readonly explorationHint: (ai: boolean) => string;
  readonly confidence: string;
  readonly confirm: string;
  readonly continue: string;
  /** Demonstration only (6 Oct 2026): skip the rest of the view, or of the freeze. */
  readonly skipView: string;
  readonly skipFreeze: string;
  /** The sector plan (2 Oct 2026). */
  readonly allocationHint: string;
  readonly mainEffortLabel: string;
  /** The main effort's posture (4 Oct 2026, required; nothing preselected). DRAFT (native and domain review pending). */
  readonly postureLabel: string;
  readonly postures: Readonly<Record<MainEffortPosture, string>>;
  readonly secondaryLabel: string;
  readonly noSecondary: string;
  readonly secondaryTasks: Readonly<Record<SecondaryTaskId, string>>;
  readonly dronesLabel: string;
  readonly dronesCarryOn: string;
  readonly droneTasks: Readonly<Record<PlanDroneTaskId, string>>;
  readonly onSceneList: (crews: string, droneTeams: string) => string;
  /** The departure note (fix pass 6, D5; from V8, both conditions): the checkbox and, since revision (ai), its optional main reason (one choice, nothing preselected). */
  readonly departureLabel: string;
  readonly departureReasonLabel: string;
  readonly departureReasons: Readonly<Record<DepartureReason, string>>;
  readonly confirmAllocation: string;
  readonly periodConfirmedWait: string;
  readonly revisionHint: string;
  readonly periodEndsIn: (s: number) => string;
  readonly reviseAllocation: string;
  /** The waiting panel's summary of the recorded plan (6 Oct 2026, review): its lead-in. */
  readonly planRecorded: string;
  /** Shown in the next view when the previous one hit the cap before its plan was confirmed (6 Oct 2026, review). */
  readonly timeUpNoPlan: string;
  /** The guided tour (SPEC/15 r.11, `app/render/ui/tour.ts`). DRAFT (native and domain review pending). */
  readonly tour: {
    readonly steps: Readonly<Record<TourStepId, { readonly title: string; readonly body: string }>>;
    readonly next: string;
    readonly back: string;
    readonly startPractice: string;
    readonly startView: string;
    readonly skip: string;
    readonly progress: (step: number, of: number) => string;
    /** Revision (am): the Thinker practice step's controls (`GuidedTour`): the example question, its button, the wait, and why "Next" waits. */
    readonly practiceThinker: { readonly example: string; readonly send: string; readonly answering: string; readonly askFirst: string };
  };
  readonly hinge: string;
  /** Above the directive on the hinge pause screen (4 Oct 2026): who it is from. */
  readonly hingeDirectiveFrom: string;
  readonly done: string;
  readonly freezeTitle: string;
  readonly freezeNote: string;
  readonly freezeSubmit: string;
  /** A map item (SPEC/15 r.12): the blank map's hint, the note once a point is marked, and the answered count by the submit. */
  readonly freezeMapHint: string;
  readonly freezeMapMarked: string;
  /** Over a map until its basemap tiles are drawn (9 Oct 2026: the image tiles showed black for seconds). */
  readonly mapLoading: string;
  readonly freezeProgress: (answered: number, of: number) => string;
  /** One item at a time (2 Oct 2026): the button to the next item, and that there is no going back. */
  readonly freezeNext: string;
  readonly freezeNoReturn: string;
  readonly noResults: string;
  readonly what: string;
  readonly who: string;
  readonly when: string;
  readonly all: string;
  readonly search: string;
  readonly searchText: string;
  readonly freeTextPlaceholder: string;
  readonly searching: string;
  readonly haku: string;
  /** Demonstration only (11 Oct 2026): the original index-based search tab. */
  readonly indexedSearch: string;
  readonly closeTool: string;
  /**
   * A tool's empty chat (fix pass 7, 9 Oct 2026, researcher's open item on the note's scope): one sentence for every tool, identical but
   * for the tool's name, including that the answer can be wrong (was "Thinker answers only when asked" in the Haku tab too, Haku group included).
   */
  readonly noQuestions: (tool: string) => string;
  readonly answer: string;
  readonly basis: string;
  readonly certainty: string;
  readonly wouldChange: string;
  readonly askPlaceholder: string;
  /** The Open Thinker's input (F1, 8 Oct 2026). */
  readonly openThinkerPlaceholder: string;
  readonly ask: string;
  readonly messageLog: string;
  readonly noMessages: string;
  readonly wind: string;
  readonly compass: readonly string[];
  readonly windAria: (compass: string, deg: number, ms: number) => string;
  readonly zoom: { readonly alue: string; readonly palo: string; readonly lohko: string };
  /** Phase B round 2, D1: the demonstration's third cell, the assigned start, and a study link without an assignment. */
  readonly conditionIntent: string;
  readonly startAssigned: string;
  readonly cellMissing: string;
  /**
   * SPAM (round 2, 4 Oct 2026; revision (ag), 9 Oct 2026): the ready prompt and its button, its collapse
   * button and the collapsed pill, the item's title and note, the forced item's title and note, the
   * confidence question, and the locked tools' note (a visible probe's; a SPAM item no longer locks them).
   * Identical in all cells; no tool is named. DRAFT (native review) for the (ag) additions.
   */
  readonly spam: {
    readonly readyPrompt: string; readonly ready: string; readonly collapse: string; readonly waiting: string; readonly title: string; readonly note: string;
    readonly forcedTitle: string; readonly forcedNote: string; readonly confidencePrompt: string; readonly toolsLocked: string;
  };
  /** The manipulation check on the hinge screen (brief D3): the directive's acknowledgement and the note under the question. */
  readonly hingeCheck: { readonly read: string; readonly note: string };
  /** D1 (8 Oct 2026): the label of the persistent command-directive line at the top of the right panel, from V8 on; identical in every cell. */
  readonly directiveBanner: string;
  /** M1 (8 Oct 2026): the Open Thinker's answer when the model did not answer; shown as an unavailable state, never a record excerpt. */
  readonly thinkerUnavailable: string;
  /**
   * Revision (ah), 9 Oct 2026 (review M6): a chat question that was not sent — too long, or the tool
   * busy or locked. Shown under the input; the typed text is kept.
   */
  readonly questionTooLong: (max: number, n: number) => string;
  readonly questionNotSent: string;
  /**
   * The visible probe Type U (5 Oct 2026, agent H; `VisibleProbeCard`; Types E and F withdrawn 6 Oct 2026). DRAFT, for native review.
   * No word names a tool, a conflict or the projection's reliability (SPEC/08 §3.5's non-leading rule).
   */
  readonly visibleProbe: {
    readonly title: { readonly U: string };
    /** V13's area item (revision (ai)): the yes/no. */
    readonly yes: string;
    readonly no: string;
    readonly submit: string;
    readonly note: string;
  };
  /**
   * The session's storage, upload and resume (SPEC/05 §9; 5 Oct 2026): the end screen's upload and
   * export, the resume offer on load, and the refusal when the browser cannot store the session.
   * DRAFT wording for the native reviewer.
   */
  readonly sessionData: {
    readonly preparing: string;
    readonly storageUnavailable: string;
    readonly uploading: string;
    readonly uploaded: string;
    readonly uploadFailed: string;
    readonly retryUpload: string;
    readonly download: string;
    readonly demoDownloadNote: string;
    readonly resumeTitle: string;
    readonly resumeBody: (startedAt: string) => string;
    readonly resumeNote: string;
    readonly resumeContinue: string;
    readonly resumeDiscard: string;
    /** Revision (ah): the confirmation step before an unfinished session is abandoned for a new one. */
    readonly resumeDiscardConfirm: string;
    readonly resumeDiscardYes: string;
    readonly resumeDiscardBack: string;
    readonly pendingUploadTitle: string;
    readonly pendingUploadBody: string;
    readonly startNew: string;
  };
}

const FI: UiText = {
  pageTitle: "Maastopalo",
  startTitle: "Maastopalon johtamisharjoitus",
  startNote: "Synteettinen esimerkkiskenaario (ei aitoa, ei tarkistettua sisältöä). Valitse kieli ja ehto aloittaaksesi.",
  languageLabel: "Kieli",
  conditionDirected: "Haku",
  conditionSubstitutive: "Haku + Thinker",
  loading: "Ladataan istuntoa…",
  briefingTitle: "Tilanne",
  startPractice: "Aloita harjoitus",
  introVideo: { play: "Toista video", watchFirst: "Katso video loppuun, niin pääset aloittamaan harjoituksen.", failed: "Videota ei voitu toistaa. Voit aloittaa harjoituksen.", skip: "Ohita video" },
  startTask: "Aloita tehtävä",
  clock: "klo",
  step: "vaihe",
  phase: { exploration: "tutustuminen", freeze: "muistikatko", decision: "päätös" },
  onScene: "kohteessa",
  newItems: "uutta",
  condition: "ehto",
  logRecords: "lokitietueita",
  preview: "esikatselu: jakson vähimmäispituus",
  practiceLabel: "Harjoitus",
  viewLabel: (i, n) => `Jakso ${i} / ${n}`,
  practiceNotScored: "Harjoitus — ei pisteytetä. ",
  explorationHint: (ai) => `Rakenna tilannekuvasi. ${ai ? "Kartta, Haku ja Thinker" : "Kartta ja Haku"} ovat käytössä.`,
  confidence: "Varmuus",
  confirm: "Vahvista",
  continue: "Jatka",
  skipView: "Ohita jakso ▸",
  skipFreeze: "Ohita muistikatko ▸",
  allocationHint: "Kirjaa kohdennuksesi lohkoittain. Vahvistus päättää jakson.",
  mainEffortLabel: "Miehistöjen painopiste",
  postureLabel: "Painopisteen toimintatapa",
  postures: { direct_attack: "Suora hyökkäys palon reunaan", barrier_line: "Puolustuslinja tien tai vesistön varaan", protect_values: "Asutuksen suojaus" }, // review round 2 (4 Oct 2026, DEFAULT): one term each, no lexical pull
  secondaryLabel: "Toissijainen lohko",
  noSecondary: "Ei toissijaista lohkoa",
  secondaryTasks: { "task.direct-attack": "Suora hyökkäys palon reunaan", "task.hold-line": "Linjan pito", "task.mopup": "Jälkisammutus ja varmistus" }, // 6 Oct 2026: direct attack the posture's term
  dronesLabel: "Drooniryhmien tehtävä",
  dronesCarryOn: "Ei uutta tehtävää",
  droneTasks: { "task.thermal-survey": "Lämpökuvaus", "task.perimeter-map": "Palon rajan kartoitus", "task.watch": "Lohkon tähystys" },
  onSceneList: (c, d) => `Paikalla: miehistöt ${c}${d ? `; drooniryhmät ${d}` : ""}.`,
  departureLabel: "Poikkean johdon linjauksesta",
  departureReasonLabel: "Pääasiallinen syy",
  departureReasons: {
    crew_safety: "Miehistön turvallisuus", protect_people_property: "Ihmisten tai rakennusten suojaaminen",
    new_fire_info: "Uusi tieto palosta (leviäminen, uusi pesäke)", directive_unfit: "Linjaus ei sovi nykytilanteeseen",
    resources: "Voimavarat eivät riitä linjauksen mukaiseen toimintaan", other: "Muu",
  },
  confirmAllocation: "Vahvista kohdennus",
  periodConfirmedWait: "Jakso vahvistettu. Voit vielä muuttaa kohdennusta, kunnes jakso päättyy.",
  periodEndsIn: (s) => `Aikaa jäljellä ${s} s`,
  revisionHint: "Muutos tallentuu vain, jos vahvistat sen ennen kuin jakso päättyy; muuten aiempi kohdennus jää voimaan.",
  reviseAllocation: "Muuta kohdennusta",
  planRecorded: "Kohdennus kirjattu:",
  timeUpNoPlan: "Aika päättyi ennen vahvistusta – edellistä kohdennusta ei kirjattu.",
  tour: {
    steps: {
      // Revision (ae): the briefing page is gone; its role, recorded-run, autonomous-asset and period sentences open the tour (`briefing.ts`).
      welcome: { title: "Tutustu näkymään", body: TOUR_SETTING_FI + " Käydään läpi, mistä löydät tiedot ja miten vastaat. Harjoitusta ei pisteytetä, eikä sen aika kulu tämän esittelyn aikana." },
      status: { title: "Tilarivi", body: "Ylärivillä näet tilanteen kellonajan, jakson ja yksiköt. Kussakin jaksossa on aikaa enintään kaksi ja puoli minuuttia; viimeiset 20 sekuntia lasketaan tässä." },
      fire: { title: "Palo kartalla", body: "Kartalla näkyy palon viimeisin kartoitettu reuna ja palanut alue. Aiemmat rajaukset näkyvät ohuempina viivoina." },
      projection: { title: "Leviämisennuste", body: "Värivyöhykkeet näyttävät, mihin ennuste arvioi palon leviävän: lähin vyöhyke 0–10 minuutissa, uloimmat myöhemmin. " + PROJECTION_CAVEAT_FI },
      legend: { title: "Selite", body: "Selite kertoo karttamerkinnät: palon reunat, palaneen alueen, pistepalot, droonien lämpöhavainnot ja ennusteen vyöhykkeet." },
      wind: { title: "Tuuli", body: "Tuulen suunta ja keskinopeus säähavaintoasemalta." },
      // Revision (al), 10 Oct 2026 (wording by `map-overlay`; the "Lohko" button is now "2 km").
      zoom: { title: "Kartan mittakaava", body: "Alue, Palo ja 2 km vaihtavat kartan mittakaavaa; voit myös lähentää hiiren rullalla tai kosketuslevyllä. Lähennä karttaa nähdäksesi palon ja yksiköt tarkemmin." },
      // Revision (al): the four sectors by their terrain (`briefing.ts` SECTORS_FI, wording by `map-tiles`).
      sectors: { title: "Lohkot", body: SECTORS_FI.join("\n") },
      units: { title: "Yksiköt", body: "Yksiköiden merkit näyttävät niiden viimeksi ilmoitetun sijainnin ja työn. Droonien kohdalla näkyy myös kuvausalue." },
      log: { title: "Viestiloki", body: "Yksiköiden ja muiden toimijoiden ilmoitukset tulevat viestilokiin lähettäjän ja kellonajan kanssa." },
      haku: { title: "Haku", body: `Avaa Haku tästä. ${HAKU_CHAT_FI}` },
      decision: { title: "Päätös", body: "Hetken kuluttua tähän avautuu päätösosio: kirjaat kohdennuksesi lohkoittain, myös painopisteen toimintatavan. Kohdennuksen vahvistaminen päättää jakson. Voit vielä muuttaa sitä, kunnes jakso päättyy." },
      freeze: { title: "Muistikatko", body: "Välillä kuva piilotetaan ja saat kysymyksiä tilanteesta. Vastaa muistin varassa (joskus napauttamalla kohtaa tyhjältä kartalta), ja arvioi varmuutesi. Kello on pysähdyksissä katkon ajan, ja jatkat siitä, mihin jäit." },
      spam: { title: "Tilannekysymys", body: "Joskus kartan alle tulee kysymys \"Valmis vastaamaan?\". Paina Valmis, kun ehdit; vasta silloin näet kysymyksen ja sen neljä vaihtoehtoa. Kysymys odottaa sinua: voit pienentää sen, eikä se katoa. Jos et ole vastannut jakson loppuun mennessä, kysymys tulee esiin ennen kuin jakso päättyy. Vastatessasi voit käyttää karttaa, viestilokia ja hakutyökaluja, ja kello käy. Valinta on lopullinen; sen jälkeen arvioit varmuutesi. Harjoituksessa saat kokeilla yhtä." },
      ready: { title: "Valmis", body: "Harjoitus alkaa, kun painat Aloita. Kokeile rauhassa karttaa, viestilokia ja hakua." },
      toolsHaku: { title: "Haku", body: "Haku on käytössäsi koko istunnon ajan, myös päätösvaiheessa." },
      // Revision (am): the AI group's practice step (both Thinker cells), and V1's short Thinker reminders after it.
      practiceThinker: { title: "Thinker", body: PRACTICE_THINKER_FI },
      toolsThinker: { title: "Thinker", body: TOOLS_THINKER_AGAIN_FI },
      toolsThinkerIntent: { title: "Thinker", body: TOOLS_THINKER_INTENT_AGAIN_FI }, // revision (al): the reasoning_intent cell
    },
    next: "Seuraava",
    back: "Edellinen",
    startPractice: "Aloita harjoitus",
    startView: "Aloita",
    skip: "Ohita esittely",
    progress: (i, n) => `${i} / ${n}`,
    practiceThinker: { example: PRACTICE_THINKER_EXAMPLE_FI, send: "Lähetä esimerkkikysymys", answering: "Thinker vastaa…", askFirst: "Kysy Thinkeriltä ensin yksi kysymys." },
  },
  hinge: "Puoliväli — 7/14 jaksoa suoritettu. Lyhyt tauko.",
  hingeDirectiveFrom: "Päivystävä palopäällikkö (P2), klo 16.40",
  // DRAFT (SPEC/27 §2.2, contamination between participants; 5 Oct 2026).
  done: "Istunto valmis — kaikki 14 jaksoa suoritettu. Älä kerro istunnon kulusta kollegoillesi ennen kuin tutkimus on päättynyt.",
  freezeTitle: "MUISTIKATKO — kuva piilotettu",
  freezeNote: "Vastaa muistin varassa. Kello on pysähtynyt.",
  freezeSubmit: "LÄHETÄ JA JATKA",
  freezeMapHint: "Napauta kartalta kohta. Voit siirtää merkkiä napauttamalla uudelleen.",
  freezeMapMarked: "Kohta merkitty. Napauta uudelleen siirtääksesi.",
  mapLoading: "Ladataan karttaa…",
  freezeProgress: (n, of) => `Kysymys ${n}/${of}`,
  freezeNext: "SEURAAVA",
  freezeNoReturn: "Edelliseen kysymykseen ei voi palata.",
  noResults: "Ei osumia.",
  what: "MITÄ",
  who: "KUKA",
  when: "MILLOIN",
  all: "Kaikki",
  search: "Hae",
  searchText: "Hae tekstillä",
  freeTextPlaceholder: "Vapaa haku…",
  searching: "Haetaan…",
  haku: "Haku",
  indexedSearch: "Indeksihaku",
  closeTool: "Sulje työkalu",
  noQuestions: (tool) => `Ei kysymyksiä vielä. ${tool} vastaa vain kysyttäessä, ja vastaus voi olla väärä tai puutteellinen.`,
  answer: "VASTAUS",
  basis: "PERUSTEET",
  certainty: "VARMUUS",
  wouldChange: "MIKÄ MUUTTAISI",
  askPlaceholder: "Kysy Haulta…", // the Haku tab's chat, both groups (8 Oct 2026): no "Thinker" in it
  openThinkerPlaceholder: "Pohdi tilannetta Thinkerin kanssa…",
  ask: "Kysy",
  messageLog: "VIESTILOKI",
  noMessages: "Ei viestejä vielä.",
  wind: "Tuuli",
  compass: ["P", "KO", "I", "KA", "E", "LOU", "L", "LU"],
  windAria: (c, d, ms) => `Tuuli ${c}, ${d} astetta, ${ms} metriä sekunnissa`,
  zoom: { alue: "Alue", palo: "Palo", lohko: "2 km" }, // revision (al): "Lohko" named no sector; the id stays
  conditionIntent: "Haku + ohjattu Thinker",
  startAssigned: "Aloita",
  cellMissing: "Tutkimusistunnon linkistä puuttuu osallistujakoodi (?koodi=…). Pyydä tutkijalta oikea linkki.",
  // DRAFT (round 2): for native review.
  spam: {
    readyPrompt: "Valmis vastaamaan?", ready: "Valmis", collapse: "Pienennä", waiting: "Kysymys odottaa – avaa", title: "Tilannekysymys",
    note: "Kartta, viestiloki ja hakutyökalut ovat käytössä. Kello käy.",
    forcedTitle: "Jakson aika on päättynyt – vastaa ensin tähän kysymykseen.",
    forcedNote: "Kello on pysäytetty. Viestiloki ja hakutyökalut ovat käytössä. Jakso päättyy, kun olet vastannut.",
    confidencePrompt: "Kuinka varma olet vastauksestasi?", toolsLocked: "Pois käytöstä kysymyksen ajan.",
  },
  hingeCheck: { read: "Olen lukenut linjauksen", note: "Vastaa kysymykseen, niin voit jatkaa." },
  // DRAFT (8 Oct 2026): native review.
  directiveBanner: "Johdon linjaus",
  thinkerUnavailable: "Thinker ei ole nyt käytettävissä — kysy uudelleen tai käytä Hakua.",
  // DRAFT (9 Oct 2026, revision (ah)): native review.
  questionTooLong: (max, n) => `Kysymys on liian pitkä (${n}/${max} merkkiä). Lyhennä sitä ja kysy uudelleen.`,
  questionNotSent: "Kysymystä ei lähetetty. Yritä hetken päästä uudelleen.",
  // DRAFT (5 Oct 2026, agent H): native review.
  visibleProbe: {
    title: { U: "Kysymys" },
    yes: "Kyllä",
    no: "Ei",
    submit: "Vahvista vastaus",
    note: "Kello on pysähtynyt vastauksen ajaksi. Kartta on näkyvissä; hakutyökalut ovat pois käytöstä.",
  },
  sessionData: {
    preparing: "Valmistellaan istuntoa…",
    storageUnavailable: "Selain ei salli istunnon tallentamista tälle koneelle (esimerkiksi yksityinen ikkuna tai estetty tallennustila). Avaa linkki tavallisessa selainikkunassa.",
    uploading: "Lähetetään istunnon tietoja…",
    uploaded: "Istunnon tiedot on vastaanotettu. Kiitos! Voit sulkea ikkunan.",
    uploadFailed: "Istunnon tietojen lähetys ei onnistunut. Tiedot ovat tallessa tällä koneella. Yritä uudelleen, tai lataa tiedosto ja lähetä se tutkijalle.",
    retryUpload: "Yritä lähetystä uudelleen",
    download: "Lataa istunnon tiedosto",
    demoDownloadNote: "Esittelyistunto: istunnon tiedoston voi ladata tältä koneelta.",
    resumeTitle: "Keskeytynyt istunto",
    resumeBody: (startedAt) => `Tällä koneella on kesken jäänyt istunto (aloitettu ${startedAt}).`,
    resumeNote: "Jatkettaessa keskeytynyt jakso aloitetaan alusta. Jo annetut vastaukset säilyvät.",
    resumeContinue: "Jatka istuntoa",
    resumeDiscard: "Aloita uusi istunto",
    resumeDiscardConfirm: "Tämä päättää keskeneräisen istunnon. Aloitetaanko uusi?",
    resumeDiscardYes: "Kyllä, aloita uusi istunto",
    resumeDiscardBack: "Takaisin",
    pendingUploadTitle: "Lähettämätön istunto",
    pendingUploadBody: "Tällä koneella on valmis istunto, jonka tietoja ei ole vielä lähetetty.",
    startNew: "Siirry aloitussivulle",
  },
};

const EN: UiText = {
  pageTitle: "Wildfire",
  startTitle: "Wildfire incident command exercise",
  startNote: "Synthetic example scenario (not real, content not reviewed). Choose a language and a condition to start.",
  languageLabel: "Language",
  conditionDirected: "Search",
  conditionSubstitutive: "Search + Thinker",
  loading: "Loading the session…",
  briefingTitle: "Situation",
  startPractice: "Start the practice",
  introVideo: { play: "Play the video", watchFirst: "Watch the video to the end to start the practice.", failed: "The video could not be played. You can start the practice.", skip: "Skip the video" },
  startTask: "Start the task",
  clock: "Time",
  step: "phase",
  phase: { exploration: "exploration", freeze: "memory check", decision: "decision" },
  onScene: "on scene",
  newItems: "new",
  condition: "condition",
  logRecords: "log records",
  preview: "preview: minimum view length",
  practiceLabel: "Practice",
  viewLabel: (i, n) => `Period ${i} / ${n}`,
  practiceNotScored: "Practice — not scored. ",
  explorationHint: (ai) => `Build your picture of the situation. ${ai ? "The map, Search and Thinker" : "The map and Search"} are available.`,
  confidence: "Confidence",
  confirm: "Confirm",
  continue: "Continue",
  skipView: "Skip period ▸",
  skipFreeze: "Skip memory check ▸",
  allocationHint: "Record your allocation by sector. Confirming it ends the period.",
  mainEffortLabel: "Crews' main effort",
  postureLabel: "Main effort posture",
  postures: { direct_attack: "Direct attack on the fire's edge", barrier_line: "Defensive line on a road or water", protect_values: "Protecting settlements" },
  secondaryLabel: "Secondary sector",
  noSecondary: "No secondary sector",
  secondaryTasks: { "task.direct-attack": "Direct attack on the fire's edge", "task.hold-line": "Holding the line", "task.mopup": "Mop-up and securing" },
  dronesLabel: "Drone teams' task",
  dronesCarryOn: "No new task",
  droneTasks: { "task.thermal-survey": "Thermal imaging", "task.perimeter-map": "Mapping the fire edge", "task.watch": "Watching the sector" },
  onSceneList: (c, d) => `On scene: crews ${c}${d ? `; drone teams ${d}` : ""}.`,
  departureLabel: "I am departing from the command directive",
  departureReasonLabel: "Main reason",
  departureReasons: {
    crew_safety: "Crew safety", protect_people_property: "Protecting people or buildings",
    new_fire_info: "New information about the fire (spread, new spot fire)", directive_unfit: "The directive does not fit the current situation",
    resources: "Not enough resources to carry out the directive", other: "Other",
  },
  confirmAllocation: "Confirm the allocation",
  periodConfirmedWait: "Period confirmed. You can still change the allocation until the period ends.",
  periodEndsIn: (s) => `Time left ${s} s`,
  revisionHint: "The change is saved only if you confirm it before the period ends; otherwise your earlier allocation stands.",
  reviseAllocation: "Change allocation",
  planRecorded: "Allocation recorded:",
  timeUpNoPlan: "Time ran out before you confirmed – the previous allocation was not recorded.",
  tour: {
    steps: {
      welcome: { title: "Get to know the screen", body: TOUR_SETTING_EN + " Let's go through where you find the information and how you answer. The practice is not scored, and its time does not run during this introduction." },
      status: { title: "Status bar", body: "The top bar shows the situation's time, the period and the units. Each period has at most two and a half minutes; the last 20 seconds are counted down here." },
      fire: { title: "The fire on the map", body: "The map shows the fire's latest mapped edge and the burnt area. Earlier perimeters are shown as thinner lines." },
      projection: { title: "Spread projection", body: "The coloured bands show where the projection expects the fire to spread: the nearest band within 0–10 minutes, the outer ones later. " + PROJECTION_CAVEAT_EN },
      legend: { title: "Legend", body: "The legend explains the map symbols: the fire edges, the burnt area, spot fires, the drones' heat detections and the projection's bands." },
      wind: { title: "Wind", body: "The wind direction and mean speed from the weather station." },
      zoom: { title: "Map scale", body: "Area, Fire and 2 km change the map's scale; you can also zoom with the mouse wheel or touchpad. Zoom in to see the fire and the units in detail." },
      sectors: { title: "Sectors", body: SECTORS_EN.join("\n") },
      units: { title: "Units", body: "The unit symbols show each unit's last reported position and work. For the drones, their imaging area is shown too." },
      log: { title: "Message log", body: "Reports from the units and other actors arrive in the message log with their sender and time." },
      haku: { title: "Search", body: `Open Search here. ${HAKU_CHAT_EN}` },
      decision: { title: "Decision", body: "In a moment the decision section opens here: you record your allocation by sector, including the main effort posture. Confirming the allocation ends the period. You can still change it until the period ends." },
      freeze: { title: "Memory check", body: "Now and then the picture is hidden and you get questions about the situation. Answer from memory (sometimes by tapping a point on a blank map), and rate your confidence. The clock stands still during the check, and you continue where you left off." },
      spam: { title: "Situation question", body: "Now and then a prompt \"Ready to answer?\" appears below the map. Press Ready when you can; only then do you see the question and its four options. The question waits for you: you can minimise it, and it does not go away. If you have not answered by the end of the period, it appears before the period ends. While you answer, the map, the message log and the search tools stay available, and the clock keeps running. Your choice is final; then you rate your confidence. You will try one in the practice." },
      ready: { title: "Ready", body: "The practice starts when you press Start. Try out the map, the message log and the search at your own pace." },
      toolsHaku: { title: "Search", body: "Search is available to you throughout the session, also in the decision phase." },
      practiceThinker: { title: "Thinker", body: PRACTICE_THINKER_EN },
      toolsThinker: { title: "Thinker", body: TOOLS_THINKER_AGAIN_EN },
      toolsThinkerIntent: { title: "Thinker", body: TOOLS_THINKER_INTENT_AGAIN_EN }, // revision (al): the reasoning_intent cell
    },
    next: "Next",
    back: "Back",
    startPractice: "Start the practice",
    startView: "Start",
    skip: "Skip the introduction",
    progress: (i, n) => `${i} / ${n}`,
    practiceThinker: { example: PRACTICE_THINKER_EXAMPLE_EN, send: "Send the example question", answering: "Thinker is answering…", askFirst: "Ask Thinker one question first." },
  },
  hinge: "Halfway — 7/14 periods done. A short break.",
  hingeDirectiveFrom: "Duty fire chief (P2), 16:40",
  done: "Session complete — all 14 periods done. Please do not describe the session to colleagues until the study has ended.",
  freezeTitle: "MEMORY CHECK — picture hidden",
  freezeNote: "Answer from memory. The clock has stopped.",
  freezeSubmit: "SUBMIT AND CONTINUE",
  freezeMapHint: "Tap a point on the map. You can move the marker by tapping again.",
  freezeMapMarked: "Point marked. Tap again to move it.",
  mapLoading: "Loading the map…",
  freezeProgress: (n, of) => `Question ${n}/${of}`,
  freezeNext: "NEXT",
  freezeNoReturn: "You cannot go back to a previous question.",
  noResults: "No results.",
  what: "WHAT",
  who: "WHO",
  when: "WHEN",
  all: "All",
  search: "Search",
  searchText: "Search by text",
  freeTextPlaceholder: "Free search…",
  searching: "Searching…",
  haku: "Search",
  indexedSearch: "Indexed search",
  closeTool: "Close the tool",
  noQuestions: (tool) => `No questions yet. ${tool} answers only when asked, and its answer can be wrong or incomplete.`,
  answer: "ANSWER",
  basis: "BASIS",
  certainty: "CERTAINTY",
  wouldChange: "WHAT WOULD CHANGE IT",
  askPlaceholder: "Ask Search…",
  openThinkerPlaceholder: "Think the situation through with Thinker…",
  ask: "Ask",
  messageLog: "MESSAGE LOG",
  noMessages: "No messages yet.",
  wind: "Wind",
  compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  windAria: (c, d, ms) => `Wind ${c}, ${d} degrees, ${ms} metres per second`,
  zoom: { alue: "Area", palo: "Fire", lohko: "2 km" }, // revision (al): "Sector" named no sector; the id stays
  conditionIntent: "Search + guided Thinker",
  startAssigned: "Start",
  cellMissing: "The study link has no participant code (?koodi=…). Ask the researcher for the right link.",
  spam: {
    readyPrompt: "Ready to answer?", ready: "Ready", collapse: "Minimise", waiting: "A question is waiting – open", title: "Situation question",
    note: "The map, the message log and the search tools stay available. The clock is running.",
    forcedTitle: "The period's time is up – answer this question first.",
    forcedNote: "The clock is paused. The message log and the search tools stay available. The period ends once you have answered.",
    confidencePrompt: "How sure are you of your answer?", toolsLocked: "Off during the question.",
  },
  hingeCheck: { read: "I have read the directive", note: "Answer the question to continue." },
  directiveBanner: "Command directive",
  thinkerUnavailable: "Thinker is unavailable right now — ask again or use Search.",
  questionTooLong: (max, n) => `The question is too long (${n}/${max} characters). Please shorten it and ask again.`,
  questionNotSent: "The question was not sent. Please try again in a moment.",
  visibleProbe: {
    title: { U: "A question" },
    yes: "Yes",
    no: "No",
    submit: "Confirm answer",
    note: "The clock is stopped while you answer. The map stays visible; the search tools are off.",
  },
  sessionData: {
    preparing: "Preparing the session…",
    storageUnavailable: "This browser does not allow the session to be saved on this computer (for example a private window or blocked site storage). Please open the link in a normal browser window.",
    uploading: "Sending the session data…",
    uploaded: "The session data has been received. Thank you! You can close this window.",
    uploadFailed: "The session data could not be sent. It is safe on this computer. Please try again, or download the file and send it to the researcher.",
    retryUpload: "Try sending again",
    download: "Download the session file",
    demoDownloadNote: "Demonstration session: the session file can be downloaded from this computer.",
    resumeTitle: "Interrupted session",
    resumeBody: (startedAt) => `There is an unfinished session on this computer (started ${startedAt}).`,
    resumeNote: "If you continue, the interrupted period starts again from its beginning. Answers already given are kept.",
    resumeContinue: "Continue the session",
    resumeDiscard: "Start a new session",
    resumeDiscardConfirm: "This ends the unfinished session. Start a new one?",
    resumeDiscardYes: "Yes, start a new session",
    resumeDiscardBack: "Back",
    pendingUploadTitle: "Session not sent",
    pendingUploadBody: "There is a finished session on this computer whose data has not been sent yet.",
    startNew: "Go to the start page",
  },
};

export const UI_TEXT: Readonly<Record<Lang, UiText>> = { fi: FI, en: EN };
