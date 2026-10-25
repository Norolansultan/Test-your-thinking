/**
 * Interface strings, one dictionary per language with the same keys (the `UiText` type makes a
 * missing English string a type error). Edit the wording here; nothing else needs to change.
 * DRAFT English (native and domain review pending).
 */

import type { Lang } from "./lang.js";
import type { DepartureReason, MainEffortPosture, PlanDroneTaskId, SecondaryTaskId } from "../scenario/plan-types.js";
import {
  HAKU_CHAT_EN, HAKU_CHAT_FI, PRACTICE_THINKER_EN, PRACTICE_THINKER_EXAMPLE_EN, PRACTICE_THINKER_EXAMPLE_FI, PRACTICE_THINKER_FI, PROJECTION_CAVEAT_EN, PROJECTION_CAVEAT_FI,
  SECONDARY_TASK_DEFINITIONS_EN, SECONDARY_TASK_DEFINITIONS_FI, SECTORS_EN, SECTORS_FI, TOOLS_THINKER_AGAIN_EN, TOOLS_THINKER_AGAIN_FI, TOOLS_THINKER_INTENT_AGAIN_EN, TOOLS_THINKER_INTENT_AGAIN_FI, TOUR_SETTING_EN, TOUR_SETTING_FI,
  TOOLS_HAKU_EN, TOOLS_HAKU_FI, TOUR_HAKU_ASK_EN, TOUR_HAKU_ASK_FI, TOUR_LOG_EN, TOUR_LOG_FI,
} from "../scenario/briefing.js";
import type { TourStepId } from "../render/ui/tour.js";
import type { TakOverlayLayer, TakPaneId } from "../telemetry/record-kinds.js";
import { ALL_CHAT_ROOMS_LABEL, CHAT_ROOM_LABEL, type ChatRoom } from "../tak/geochat.js";
import { HAKU_SUGGESTED_QUESTION, SUGGESTED_QUESTION } from "../session/consult-notice.js";

/**
 * The TAK shell's interface (SPEC/28 §5, 13 Oct 2026): the toolbar, the side panes, the info card and the coordinate
 * readout. DRAFT (native and domain review pending). The GeoChat room names are `app/tak/geochat.ts`'s, shared with the
 * CoT export, so the screen and the export name a room alike.
 */
export interface TakText {
  /** The toolbar's short labels (under each icon) and the panes' titles. */
  readonly toolbar: Readonly<Record<TakPaneId, string>>;
  readonly paneTitle: Readonly<Record<TakPaneId, string>>;
  readonly toolbarAria: string;
  readonly closePane: string;
  /** The info card (top-left): the participant's own call sign and role ("self"), the clock's label. */
  readonly selfCallsign: string;
  readonly selfRole: string;
  readonly scenarioTime: string;
  /** The coordinate readout (bottom-left). */
  readonly cursorHint: string;
  readonly mgrs: string;
  readonly scale: string;
  readonly overlays: {
    readonly intro: string;
    readonly layers: Readonly<Record<TakOverlayLayer, string>>;
    /** What each toggle does, one line under it. */
    readonly notes: Readonly<Record<TakOverlayLayer, string>>;
    readonly lockedTitle: string;
    readonly layersTitle: string;
    readonly projection: string;
    readonly currentPerimeter: string;
    readonly lockedNote: string;
    readonly unavailable: string;
    readonly on: string;
    readonly off: string;
  };
  readonly contacts: {
    readonly self: string; readonly ground: string; readonly air: string;
    readonly task: string; readonly water: string; readonly lastReport: string;
    readonly centreHint: string; readonly none: string;
  };
  readonly geochat: {
    readonly rooms: Readonly<Record<"all" | ChatRoom, string>>;
    readonly empty: string;
    readonly readOnly: string;
    readonly unread: (n: number) => string;
  };
  readonly video: {
    readonly none: string; readonly footprint: string; readonly noFootprint: string;
    readonly synthetic: string; readonly enlarge: string; readonly back: string; readonly live: string;
  };
  readonly rb: {
    readonly hintFirst: string; readonly hintSecond: string; readonly range: string; readonly bearing: string; readonly backBearing: string;
    readonly clear: string; readonly from: string; readonly to: string; readonly again: string; readonly keeps: string;
  };
  /** The participant's own plan marks on the map: the main effort, the secondary sector, the drones. */
  readonly plan: { readonly main: string; readonly secondary: string; readonly drones: string };
}

const TAK_FI: TakText = {
  toolbar: { overlays: "Tasot", contacts: "Kontaktit", geochat: "GeoChat", video: "Video", range_bearing: "Mittaa", haku: "Haku", thinker: "Thinker", indexed_search: "Indeksi" },
  paneTitle: { overlays: "Tasonhallinta", contacts: "Kontaktit", geochat: "GeoChat", video: "Video (droonit)", range_bearing: "Etäisyys ja suunta", haku: "Haku", thinker: "Thinker", indexed_search: "Indeksihaku" },
  toolbarAria: "Työkalut",
  closePane: "Sulje paneeli",
  selfCallsign: "PTJ",
  selfRole: "Pelastustoiminnan johtaja · johtopaikka",
  scenarioTime: "Tilanneaika",
  cursorHint: "Vie osoitin kartalle",
  mgrs: "MGRS",
  scale: "Mittakaava",
  overlays: {
    intro: "Valitse, mitä kartalla näytetään. Valinta pätee, kunnes muutat sitä.",
    layers: { labels: "Tunnukset symbolien alla", footprints: "Anturien kuvausalueet", past_perimeters: "Aiemmat palorajat", rate_marks: "Leviämisnopeusmerkit", plan_marks: "Oman suunnitelman merkinnät" },
    notes: {
      labels: "Yksiköiden tunnukset näkyvät, kun karttaa on lähennetty.",
      footprints: "Päällä: kaikkien ilmassa olevien droonien kuvausalueet. Pois: vain osoitetun ilma-aluksen.",
      past_perimeters: "Aiemmin ilmoitetut palorajat ja niiden kellonajat.",
      rate_marks: "Leviämisnopeudet ovat ilmoituksissa, eivät kartalla.",
      plan_marks: "Tässä jaksossa kirjaamasi suunnitelman lohkot katkoviivalla.",
    },
    lockedTitle: "Aina näkyvissä",
    layersTitle: "Valittavat tasot",
    projection: "Ennuste",
    currentPerimeter: "Nykyinen paloraja",
    lockedNote: "Näitä ei voi piilottaa.",
    unavailable: "Ei käytössä tässä tutkimuksessa.",
    on: "Päällä",
    off: "Pois",
  },
  contacts: {
    self: "Oma", ground: "Maayksiköt", air: "Ilma-alukset",
    task: "Tehtävä", water: "Vesi", lastReport: "Viimeisin viesti",
    centreHint: "Valitse kontakti keskittääksesi kartan siihen.", none: "Ei yksiköitä kartalla.",
  },
  geochat: {
    rooms: { all: ALL_CHAT_ROOMS_LABEL.fi, ground: CHAT_ROOM_LABEL.ground.fi, air: CHAT_ROOM_LABEL.air.fi, command: CHAT_ROOM_LABEL.command.fi, support: CHAT_ROOM_LABEL.support.fi },
    empty: "Ei viestejä tässä huoneessa.",
    readOnly: "Vain luku: et voi lähettää viestejä yksiköille.",
    unread: (n) => `${n} uutta viestiä`,
  },
  video: {
    none: "Ei droonia ilmassa.", footprint: "Kuvausala", noFootprint: "Ei lämpökameran kuvausalaa",
    synthetic: "Lämpökuva muodostetaan kartan tiedoista (ilmoitettu paloraja kuvausalan sisällä).", enlarge: "Suurenna", back: "Kaikki kuvat", live: "LÄMPÖ",
  },
  rb: {
    hintFirst: "Napauta kartalta alkupiste.", hintSecond: "Napauta kartalta loppupiste.",
    range: "Etäisyys", bearing: "Suunta (tosi)", backBearing: "Paluusuunta", clear: "Tyhjennä", from: "Alku", to: "Loppu",
    again: "Napauta uutta alkupistettä mitataksesi uudelleen.", keeps: "Viiva jää kartalle, kunnes tyhjennät sen.",
  },
  plan: { main: "Pääpaino", secondary: "Toissijainen", drones: "Droonit" },
};

const TAK_EN: TakText = {
  toolbar: { overlays: "Overlays", contacts: "Contacts", geochat: "GeoChat", video: "Video", range_bearing: "R&B", haku: "Search", thinker: "Thinker", indexed_search: "Index" },
  paneTitle: { overlays: "Overlay Manager", contacts: "Contacts", geochat: "GeoChat", video: "Video (drones)", range_bearing: "Range & Bearing", haku: "Search", thinker: "Thinker", indexed_search: "Indexed search" },
  toolbarAria: "Tools",
  closePane: "Close the pane",
  selfCallsign: "IC",
  selfRole: "Incident commander · command post",
  scenarioTime: "Scenario time",
  cursorHint: "Move the pointer over the map",
  mgrs: "MGRS",
  scale: "Scale",
  overlays: {
    intro: "Choose what the map shows. A choice holds until you change it.",
    layers: { labels: "Call signs under symbols", footprints: "Sensor footprints", past_perimeters: "Earlier perimeters", rate_marks: "Spread-rate marks", plan_marks: "My plan marks" },
    notes: {
      labels: "Unit call signs show when the map is zoomed in.",
      footprints: "On: every airborne drone's footprint. Off: only the aircraft under the pointer.",
      past_perimeters: "Earlier reported perimeters and their times.",
      rate_marks: "Spread rates are in the reports, not on the map.",
      plan_marks: "The sectors of the plan you recorded in this period, dashed.",
    },
    lockedTitle: "Always shown",
    layersTitle: "Layers you can switch",
    projection: "Projection",
    currentPerimeter: "Current perimeter",
    lockedNote: "These cannot be hidden.",
    unavailable: "Not used in this study.",
    on: "On",
    off: "Off",
  },
  contacts: {
    self: "Self", ground: "Ground units", air: "Aircraft",
    task: "Task", water: "Water", lastReport: "Last message",
    centreHint: "Select a contact to centre the map on it.", none: "No units on the map.",
  },
  geochat: {
    rooms: { all: ALL_CHAT_ROOMS_LABEL.en, ground: CHAT_ROOM_LABEL.ground.en, air: CHAT_ROOM_LABEL.air.en, command: CHAT_ROOM_LABEL.command.en, support: CHAT_ROOM_LABEL.support.en },
    empty: "No messages in this room.",
    readOnly: "Read only: you cannot send messages to units.",
    unread: (n) => `${n} new message${n === 1 ? "" : "s"}`,
  },
  video: {
    none: "No drone in the air.", footprint: "Footprint", noFootprint: "No thermal camera footprint",
    synthetic: "The thermal picture is drawn from the map's data (the reported fire edge inside the footprint).", enlarge: "Enlarge", back: "All feeds", live: "THERMAL",
  },
  rb: {
    hintFirst: "Tap the start point on the map.", hintSecond: "Tap the end point on the map.",
    range: "Range", bearing: "Bearing (true)", backBearing: "Back bearing", clear: "Clear", from: "From", to: "To",
    again: "Tap a new start point to measure again.", keeps: "The line stays on the map until you clear it.",
  },
  plan: { main: "Main effort", secondary: "Secondary", drones: "Drones" },
};

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
  /**
   * The freeze's "now" (`31` F13, 19 Oct 2026; play-test D1, 24 Oct 2026, option (a)): the span of the period's latest reports, "14.00–14.20"
   * (`freezeNowClock`), and "now" defined as the situation they give (was the clock on screen, "this moment", which the L1/L2 keys' later
   * stamped records contradicted). DRAFT, native check.
   */
  readonly freezeNow: (span: string) => string;
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
  /**
   * Difficulty audit (23 Oct 2026, `proposal.md` (a.4), the number-free default): the badge on the Haku button at each view's start and
   * step boundary until Haku is opened. Content-free: no count, the same text in every view and both groups. Finnish DRAFT.
   */
  readonly recordsBadge: string;
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
    /** SPEC/30 §5.2: "Question 1 of 2" in a delivery with a second item. */
    readonly itemOf: (index: number, count: number) => string;
    /** The item's answer window left, on the card (24 Oct 2026; the window stays 60 s). DRAFT (native review). */
    readonly timeLeft: (seconds: number) => string;
  };
  /**
   * SPEC/30 (19 Oct 2026): the consult notification (both groups, V1–V14; it carries no content), its two buttons, the guide's
   * suggested-question chip (its text is exactly the question submitted, `SUGGESTED_QUESTION`) and the plan-confidence item.
   * `hakuChip` (revision (bf), 24 Oct 2026): the Haku group's chip, exactly `HAKU_SUGGESTED_QUESTION`; both chips share `chipLabel`.
   * Finnish DRAFT (native check, SPEC/30 §8).
   */
  readonly consult: { readonly notice: string; readonly openHaku: string; readonly openThinker: string; readonly close: string; readonly chip: string; readonly hakuChip: string; readonly chipLabel: string };
  readonly planConfidence: { readonly prompt: string; readonly note: string };
  /**
   * SPEC/32 §3 (20 Oct 2026): the plan review at commitment (phase B, both groups; `PlanReviewPanel`). The guide group also sees
   * the premise lines under `premisesLabel` (the lines themselves are the server's fixed template). DRAFT (native and domain review).
   */
  readonly planReview: {
    readonly title: string; readonly note: string; readonly planLabel: string; readonly keep: string; readonly revise: string;
    readonly premisesLabel: string; readonly citedLabel: string; readonly openRecord: string; readonly loading: string; readonly notInLog: string;
  };
  /**
   * The manipulation check on the hinge screen (brief D3): the directive's acknowledgement and the note under the question.
   * `fatigueOptional` (SPEC/15 (bf), 24 Oct 2026): the line under the hinge's optional fatigue item (its question is the questionnaire's).
   */
  readonly hingeCheck: { readonly read: string; readonly note: string; readonly fatigueOptional: string };
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
  /** The TAK shell (SPEC/28 §5). */
  readonly tak: TakText;
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
  secondaryTasks: { "task.direct-attack": "Suora hyökkäys palon reunaan", "task.hold-line": "Linjan pito tiellä tai vesistöllä", "task.mopup": "Jälkisammutus ja varmistus" }, // 6 Oct 2026: direct attack the posture's term; `31` coa F8: which line (DRAFT, native check)
  dronesLabel: "Drooniryhmien tehtävä",
  dronesCarryOn: "Ei uutta tehtävää",
  droneTasks: { "task.thermal-survey": "Lämpökuvaus", "task.perimeter-map": "Palon rajan kartoitus", "task.watch": "Lohkon tähystys" },
  onSceneList: (c, d) => `Paikalla: miehistöt ${c}${d ? `; drooniryhmät ${d}` : ""}.`,
  departureLabel: "Poikkean johdon linjauksesta",
  departureReasonLabel: "Pääasiallinen syy",
  departureReasons: {
    crew_safety: "Miehistön turvallisuus", protect_people_property: "Ihmisten tai rakennusten suojaaminen",
    new_fire_info: "Uusi tieto palosta", directive_unfit: "Linjaus ei sovi nykytilanteeseen",
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
      // B7 (SPEC/28 (bi), 25 Oct 2026): the map draws the edge as mapped at the period's start (SPEC/26 §2); the log can be newer. DRAFT, native check.
      fire: { title: "Palo kartalla", body: "Kartalla näkyy palon reuna sellaisena kuin se oli kartoitettu jakson alussa, sekä palanut alue. Viestilokin ilmoitukset voivat olla tätä uudempia. Aiemmat rajaukset näkyvät ohuempina viivoina." },
      projection: { title: "Leviämisennuste", body: "Värivyöhykkeet näyttävät, mihin ennuste arvioi palon leviävän: lähin vyöhyke 0–10 minuutissa, uloimmat myöhemmin. " + PROJECTION_CAVEAT_FI },
      legend: { title: "Selite", body: "Selite kertoo karttamerkinnät: palon reunat, palaneen alueen, pistepalot, droonien lämpöhavainnot ja ennusteen vyöhykkeet." },
      wind: { title: "Tuuli", body: "Tuulen suunta ja keskinopeus säähavaintoasemalta." },
      // Revision (al), 10 Oct 2026 (wording by `map-overlay`; the "Lohko" button is now "2 km"); play-test, 24 Oct 2026: "Palo" is now "7 km".
      zoom: { title: "Kartan mittakaava", body: "Alue, 7 km ja 2 km vaihtavat kartan mittakaavaa; voit myös lähentää hiiren rullalla tai kosketuslevyllä. Lähennä karttaa nähdäksesi palon ja yksiköt tarkemmin." },
      // Difficulty audit (23 Oct 2026, `proposal-map.md` d5): the measure tool, which no step named. DRAFT.
      measure: { title: "Mittaa", body: "Mittaa-työkalulla näet etäisyyden ja suunnan: valitse oikean reunan työkaluista Mittaa ja napauta kartalta kahta kohtaa. Viiva jää kartalle, kunnes tyhjennät sen. Myös kartan mittakaavajana kertoo matkan." },
      // Revision (al): the four sectors by their terrain (`briefing.ts` SECTORS_FI, wording by `map-tiles`).
      sectors: { title: "Lohkot", body: SECTORS_FI.join("\n") },
      units: { title: "Yksiköt", body: "Yksiköiden merkit näyttävät niiden viimeksi ilmoitetun sijainnin ja työn. Droonien kohdalla näkyy myös kuvausalue." },
      // Difficulty audit (23 Oct 2026, `proposal.md` (a.2)): the log is only part of the traffic (was "… ilmoitukset tulevat viestilokiin …").
      log: { title: "Viestiloki: vain osa liikenteestä", body: TOUR_LOG_FI },
      haku: { title: "Haku", body: `Avaa Haku tästä. ${TOUR_HAKU_ASK_FI} ${HAKU_CHAT_FI}` },
      // Revision (bl), 25 Oct 2026 (researcher; DRAFT, native check): what the records hold and how to ask for them. It shows where the
      // information is and how to ask, never that one must; its examples are the practice view's own (Haukilampi W1, DR1 12.05, the forecast).
      hakuRecords: { title: "Mitä kirjauksista löytyy", body: "Viestilokin lisäksi johtopaikan kirjauksissa on ilmoituksia, joita sinulle ei lähetetä automaattisesti: droonien kartoitukset lukuineen, sääennusteet, yksiköiden vesi- ja polttoainetilanne kysyttäessä, tieilmoitukset sekä muiden viranomaisten viestit. Kysy Haulta kuin kysyisit johtokeskukselta radiolla: aiheen mukaan („Mikä on viimeisin sääennuste?”), paikan mukaan („Voivatko säiliöautot täyttää Haukilammelta?”) tai lähteen ja kellonajan mukaan („Mitä DR1 ilmoitti klo 12.05?”). Kun yksikkö kertoo radiossa, että tiedot on kirjattu, yksityiskohdat löytyvät kirjauksista." },
      // Play-test D11 (24 Oct 2026): what is addressed to command is context; the plan sets the main effort, posture, secondary task, drones. DRAFT.
      decision: { title: "Päätös", body: "Hetken kuluttua tähän avautuu päätösosio: kirjaat kohdennuksesi lohkoittain, myös painopisteen toimintatavan. Kohdennuksen vahvistaminen päättää jakson. Voit vielä muuttaa sitä, kunnes jakso päättyy. Johdolle osoitetut viestit, kuten pyynnöt ja ehdotukset, ovat taustatietoa: yksiköt toimivat pysyvien ohjeiden ja oman harkintansa mukaan, ja suunnitelmasi määrää painopisteen ja sen toimintatavan, toissijaisen tehtävän ja droonien tehtävän.\n" + SECONDARY_TASK_DEFINITIONS_FI.join("\n") },
      freeze: { title: "Muistikatko", body: "Välillä kuva piilotetaan ja saat kysymyksiä tilanteesta. Vastaa muistin varassa (joskus napauttamalla kohtaa tyhjältä kartalta), ja arvioi varmuutesi. Kello on pysähdyksissä katkon ajan, ja jatkat siitä, mihin jäit." },
      // Play-test finding 3 (24 Oct 2026): the ready prompt waits; each question, once shown, has its 60 s window, shown on the card. DRAFT.
      spam: { title: "Tilannekysymys", body: "Joskus kartan alle tulee kehote \"Valmis vastaamaan?\". Kehote odottaa sinua: voit pienentää sen, eikä se katoa. Jos et ole painanut Valmis jakson loppuun mennessä, kysymys tulee esiin ennen kuin jakso päättyy. Kun painat Valmis, näet kysymyksen ja sen neljä vaihtoehtoa, ja kuhunkin kysymykseen on aikaa 60 sekuntia; jäljellä oleva aika näkyy kysymyskortissa. Vastatessasi voit käyttää karttaa, viestilokia ja hakutyökaluja, ja kello käy. Valinta on lopullinen; sen jälkeen arvioit varmuutesi. Harjoituksessa saat kokeilla yhtä." },
      ready: { title: "Valmis", body: "Harjoitus alkaa, kun painat Aloita. Kokeile rauhassa karttaa, viestilokia ja hakua." },
      toolsHaku: { title: "Haku", body: TOOLS_HAKU_FI }, // difficulty audit (a.2): with the rule's reminder
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
  freezeNow: (span) => `Jakson viimeisimmät tiedot kattavat klo ${span}. Kysymysten ”nyt” on tilanne niiden mukaan.`,
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
  recordsBadge: "Uusia kirjauksia",
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
  // Play-test D8 (24 Oct 2026): the full words, since "E 165°" read as east (E = etelä, south). DRAFT.
  compass: ["pohjoinen", "koillinen", "itä", "kaakko", "etelä", "lounas", "länsi", "luode"],
  windAria: (c, d, ms) => `Tuuli ${c}, ${d} astetta, ${ms} metriä sekunnissa`,
  zoom: { alue: "Alue", palo: "7 km", lohko: "2 km" }, // revision (al): "Lohko" named no sector; 24 Oct 2026: "Palo" did not frame the fire. The ids stay
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
    itemOf: (i, n) => `Kysymys ${i}/${n}`,
    timeLeft: (s) => `Vastausaikaa ${s} s`,
  },
  consult: {
    notice: "Uusia ilmoituksia edellisen suunnitelmasi jälkeen", openHaku: "Avaa Haku", openThinker: "Avaa Thinker", close: "Sulje ilmoitus",
    chip: SUGGESTED_QUESTION.fi, hakuChip: HAKU_SUGGESTED_QUESTION.fi, chipLabel: "Ehdotettu kysymys",
  },
  planConfidence: { prompt: "Kuinka varma olet, että suunnitelmasi sopii tilanteeseen?", note: "Jakso on päättynyt. Valitse varmuutesi ja vahvista." },
  // DRAFT (SPEC/32 §3, 20 Oct 2026): native and domain review.
  planReview: {
    title: "Tarkista kohdennus ennen kuin se on lopullinen", note: "Jakson aika on pysähdyksissä tarkistuksen ajan.", planLabel: "Kirjattu kohdennus:",
    keep: "Vahvista kohdennus", revise: "Muuta kohdennusta", premisesLabel: "Thinker — linjauksen oletukset", citedLabel: "Viitatut ilmoitukset:",
    openRecord: "Näytä viestilokissa", loading: "Ladataan…", notInLog: "Ilmoitus ei ole viestilokissa; se näkyy tässä.",
  },
  hingeCheck: { read: "Olen lukenut linjauksen", note: "Vastaa kysymykseen, niin voit jatkaa.", fatigueOptional: "Vapaaehtoinen: voit jatkaa vastaamatta." },
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
  tak: TAK_FI,
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
  // R12 (25 Oct 2026, SPEC/35 (bi)): the two "line" choices said apart — a new line ahead of the fire (the posture) against an existing
  // line held (the secondary task); the Finnish labels unchanged. Glossary: defensive_line, hold_line.
  postures: { direct_attack: "Direct attack on the fire's edge", barrier_line: "Defensive line ahead of the fire, on a road or water", protect_values: "Protecting settlements" },
  secondaryLabel: "Secondary sector",
  noSecondary: "No secondary sector",
  secondaryTasks: { "task.direct-attack": "Direct attack on the fire's edge", "task.hold-line": "Hold an existing line on a road or water", "task.mopup": "Mop-up and securing" },
  dronesLabel: "Drone teams' task",
  dronesCarryOn: "No new task",
  droneTasks: { "task.thermal-survey": "Thermal imaging", "task.perimeter-map": "Mapping the fire edge", "task.watch": "Watching the sector" },
  onSceneList: (c, d) => `On scene: crews ${c}${d ? `; drone teams ${d}` : ""}.`,
  departureLabel: "I am departing from the command directive",
  departureReasonLabel: "Main reason",
  departureReasons: {
    crew_safety: "Crew safety", protect_people_property: "Protecting people or buildings",
    new_fire_info: "New information about the fire", directive_unfit: "The directive does not fit the current situation",
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
      // B7 (SPEC/28 (bi), 25 Oct 2026): was "the fire's latest mapped edge", untrue after a merged view's step boundary.
      fire: { title: "The fire on the map", body: "The map shows the fire's edge as mapped at the start of the period, and the burnt area. Reports in the message log can be newer. Earlier perimeters are shown as thinner lines." },
      projection: { title: "Spread projection", body: "The coloured bands show where the projection expects the fire to spread: the nearest band within 0–10 minutes, the outer ones later. " + PROJECTION_CAVEAT_EN },
      legend: { title: "Legend", body: "The legend explains the map symbols: the fire edges, the burnt area, spot fires, the drones' heat detections and the projection's bands." },
      wind: { title: "Wind", body: "The wind direction and mean speed from the weather station." },
      zoom: { title: "Map scale", body: "Area, 7 km and 2 km change the map's scale; you can also zoom with the mouse wheel or touchpad. Zoom in to see the fire and the units in detail." },
      measure: { title: "Measure (R&B)", body: "The R&B tool gives a distance and a bearing: choose R&B among the tools on the right edge and tap two points on the map. The line stays on the map until you clear it. The map's scale bar tells distances too." },
      sectors: { title: "Sectors", body: SECTORS_EN.join("\n") },
      units: { title: "Units", body: "The unit symbols show each unit's last reported position and work. For the drones, their imaging area is shown too." },
      log: { title: "Message log: only part of the traffic", body: TOUR_LOG_EN },
      haku: { title: "Search", body: `Open Search here. ${TOUR_HAKU_ASK_EN} ${HAKU_CHAT_EN}` },
      // Revision (bl), 25 Oct 2026 (researcher): the researcher's text, with the tool named as the English screen names it ("Search", not
      // "Haku": the tab, the step before and the consent say Search; `HAKU_CHAT_EN`, review M2).
      hakuRecords: { title: "What the records hold", body: "Besides the message log, the command post's records hold reports you are not sent automatically: drone surveys and their figures, weather forecasts, units' water and fuel status when asked, road reports, and messages from other authorities. Ask Search as you would ask the command centre by radio — by topic (“What is the latest weather forecast?”), by place (“Can tankers fill up at Pike Pond?”) or by source and time (“What did DR1 report at 12.05?”). When a unit says on the radio that data has been filed, the details are in the records." },
      decision: { title: "Decision", body: "In a moment the decision section opens here: you record your allocation by sector, including the main effort posture. Confirming the allocation ends the period. You can still change it until the period ends. Messages addressed to command, such as requests and proposals, are context: the units act on standing orders and their own judgement, and your plan sets the main effort and its posture, the secondary task and the drones' task.\n" + SECONDARY_TASK_DEFINITIONS_EN.join("\n") },
      freeze: { title: "Memory check", body: "Now and then the picture is hidden and you get questions about the situation. Answer from memory (sometimes by tapping a point on a blank map), and rate your confidence. The clock stands still during the check, and you continue where you left off." },
      spam: { title: "Situation question", body: "Now and then a prompt \"Ready to answer?\" appears below the map. The prompt waits for you: you can minimise it, and it does not go away. If you have not pressed Ready by the end of the period, the question appears before the period ends. Once you press Ready, you see the question and its four options, and each question has 60 seconds; the time left shows on the question card. While you answer, the map, the message log and the search tools stay available, and the clock keeps running. Your choice is final; then you rate your confidence. You will try one in the practice." },
      ready: { title: "Ready", body: "The practice starts when you press Start. Try out the map, the message log and the search at your own pace." },
      toolsHaku: { title: "Search", body: TOOLS_HAKU_EN },
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
  freezeNow: (span) => `The period's latest reports cover ${span}. In the questions, “now” is the situation they give.`,
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
  recordsBadge: "New records",
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
  zoom: { alue: "Area", palo: "7 km", lohko: "2 km" }, // revision (al): "Sector" named no sector; 24 Oct 2026: "Fire" did not frame the fire. The ids stay
  conditionIntent: "Search + guided Thinker",
  startAssigned: "Start",
  cellMissing: "The study link has no participant code (?koodi=…). Ask the researcher for the right link.",
  spam: {
    readyPrompt: "Ready to answer?", ready: "Ready", collapse: "Minimise", waiting: "A question is waiting – open", title: "Situation question",
    note: "The map, the message log and the search tools stay available. The clock is running.",
    forcedTitle: "The period's time is up – answer this question first.",
    forcedNote: "The clock is paused. The message log and the search tools stay available. The period ends once you have answered.",
    confidencePrompt: "How sure are you of your answer?", toolsLocked: "Off during the question.",
    itemOf: (i, n) => `Question ${i} of ${n}`,
    timeLeft: (s) => `Time to answer ${s} s`,
  },
  consult: {
    notice: "New reports since your last plan", openHaku: "Open Search", openThinker: "Open Thinker", close: "Close the notice",
    chip: SUGGESTED_QUESTION.en, hakuChip: HAKU_SUGGESTED_QUESTION.en, chipLabel: "Suggested question",
  },
  planConfidence: { prompt: "How confident are you that your plan fits the situation?", note: "The period has ended. Choose your confidence and confirm." },
  // DRAFT (SPEC/32 §3, 20 Oct 2026): native and domain review.
  planReview: {
    title: "Review the plan before it becomes final", note: "The period's time is stopped while you review.", planLabel: "Plan recorded:",
    keep: "Confirm the plan", revise: "Change the plan", premisesLabel: "Thinker — the directive's premises", citedLabel: "Records cited:",
    openRecord: "Show in the message log", loading: "Loading…", notInLog: "This record is not in the message log; it is shown here.",
  },
  hingeCheck: { read: "I have read the directive", note: "Answer the question to continue.", fatigueOptional: "Optional: you can continue without answering." },
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
  tak: TAK_EN,
};

export const UI_TEXT: Readonly<Record<Lang, UiText>> = { fi: FI, en: EN };
