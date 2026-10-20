/**
 * The briefing's setting text and the group-specific training texts (SPEC/02 revision (o) §2–§3,
 * SPEC/09 revision (o) §4, SPEC/15 revision (o) §2).
 *
 * - **Setting** — word for word the same in both groups. It states the role (the participant
 *   commands the crews and the drone teams), that the exercise runs as recorded (the participant
 *   records allocations each period; the units do not receive them and act on their pre-agreed tasks
 *   and own plans), and that the spread projection can be wrong (1 Oct 2026, revised after the
 *   1 Oct content review). Revision (x), 6 Oct 2026: the participant records only the allocation —
 *   no outlook and no assessment of the projection is asked — and each period ("jakso", the same word as the status strip, 6 Oct 2026) has at most 2 min 30 s. It makes no claim about the reliability of any AI, does not mention
 *   Thinker, and names no designed event.
 * - **Training** — Haku + LLM: Haku, and Thinker as the command post's analysis agent that reads
 *   the same recorded information as Haku and answers only when asked (pull-only). Haku: Haku
 *   only, at the same length, and never a word about an agent or another configuration. Both carry
 *   the same cross-checking sentence (`CROSS_CHECK_FI`).
 *
 * Session order (SPEC/15 §2, SPEC/05 §4): briefing (setting) → practice view VP → training → V1.
 *
 * DRAFT — every text below awaits native-language and domain (rescue services) review before
 * pilot 1. Change the wording here only; `test/scenario/briefing.spec.ts` guards the invariants.
 */

import type { Cell, ConditionId } from "./types.js";

/**
 * The researcher's caveat on the fire-behaviour model (1 Oct 2026): what the projection rests on,
 * that it can be wrong, and that the participant must judge for themselves. Generic on purpose: it
 * names no designed event and says nothing about any AI tool.
 */
export const PROJECTION_CAVEAT_FI =
  "Leviämisennuste perustuu drooneilla kartoitettuun palon rajaan, tuuliennusteeseen, maasto- ja " +
  "kasvillisuustietoon sekä aiemmista paloista opittuun malliin. Malli ei näe kaikkea, ja ennuste " +
  "voi olla väärä. Käytä sitä yhtenä tietolähteenä ja tee johtopäätökset koko tilannekuvan perusteella.";

/** DRAFT (native and domain review pending). Identical for both groups, SPEC/02 revision (o) §2. */
/**
 * Fix pass 3 (7 Oct 2026): a period sums up its 20-minute step (a merged view two of them), and a
 * report carries its own time (the message log's labels, systems review F2). Both groups.
 */
export const PERIOD_TIME_FI = "Kukin jakso kokoaa yhteen 20 tai 40 minuuttia tilanteen kulkua; viestilokin ilmoituksissa on kunkin oma kellonaika.";
export const PERIOD_TIME_EN = "Each period sums up 20 or 40 minutes of the incident; each report in the message log carries its own time.";

/** D3 (8 Oct 2026): the water drone and the hose robot are autonomous background assets, not tasked by the plan. Both groups. */
/**
 * Fix pass 7 (9 Oct 2026, researcher's open item): water drops and hose lays are never plan options (adding them would change the
 * plan coding); the text says they come with the posture the crews work in or are done autonomously, so nothing implies an order.
 */
export const AUTONOMOUS_ASSETS_FI =
  "Letkulinjojen veto ja vesipudotukset eivät ole suunnitelman erillisiä tehtäviä: miehistöt vetävät letkut valitsemasi toimintatavan mukaan, " +
  "ja vesidrooni (VD1), sammutushelikopteri ja letkunvetorobotti (UGV1) toimivat itsenäisesti oman käyttäjänsä harkinnan mukaan.";
export const AUTONOMOUS_ASSETS_EN =
  "Laying hose lines and dropping water are not separate tasks in your plan: the crews lay their hose as the posture you choose requires, " +
  "and the water drone (VD1), the firefighting helicopter and the hose-laying robot (UGV1) work autonomously at their own operators' judgement.";

/** The role and the recorded run: the setting's first sentences, shown in the practice tour's welcome since revision (ae). */
export const ROLE_TEXT_FI =
  "Tilanne sijoittuu lähitulevaisuuteen. Johdat pelastusyksiköiden miehistöjä ja drooniryhmiä. " +
  "Harjoituksessa tilanne etenee tallenteen mukaisesti: kirjaat jokaisessa jaksossa " +
  "kohdennuksesi lohkoittain (miehistöjen painopiste ja sen toimintatapa sekä drooniryhmien tehtävä), mutta " +
  "yksiköt eivät saa kirjauksiasi, vaan toimivat ennalta sovittujen tehtävien ja omien suunnitelmiensa " +
  "mukaan. ";

/**
 * `31` radio DF-01 (c) (19 Oct 2026; `27` §7.1 kept): the units' answers given when the command post asks (the records marked
 * "kysyttäessä") and their other log entries are in the records, not all in the message log. Both groups, in the setting text and the
 * practice tour's welcome. DRAFT, native check.
 */
export const UNIT_ANSWERS_FI = "Yksiköiden vastaukset johtopaikan kysymyksiin näkyvät kirjauksissa. ";
export const UNIT_ANSWERS_EN = "The units' answers to the command post's questions appear in the records. ";

/**
 * `31` coa F1 (b) (19 Oct 2026): one line per secondary task, the same for everyone, in the practice tour's decision step (`ui.ts`
 * tour.steps.decision): mop-up is for an edge that has stopped spreading, a direct attack for an edge that is spreading. The labels are
 * `ui.ts` `secondaryTasks`. DRAFT, native and domain check.
 */
export const SECONDARY_TASK_DEFINITIONS_FI: readonly string[] = [
  "Suora hyökkäys palon reunaan: leviävän reunan sammutus suoraan.",
  "Linjan pito tiellä tai vesistöllä: valmiin linjan pito tien tai vesistön varassa.",
  "Jälkisammutus ja varmistus: reunan, jonka leviäminen on pysähtynyt, sammutus ja vartiointi.",
];
export const SECONDARY_TASK_DEFINITIONS_EN: readonly string[] = [
  "Direct attack on the fire's edge: putting out a spreading edge directly.",
  "Holding the line on a road or water: holding a prepared line along a road or water.",
  "Mop-up and securing: putting out and watching an edge that has stopped spreading.",
];

/**
 * The setting text. Revision (ae), researcher 9 Oct 2026: the "Situation" page that showed it before the
 * practice view is gone. What it alone said — the role, the recorded run, the autonomous assets and what a
 * period covers — is now the practice tour's welcome (`TOUR_SETTING_*`, `ui.ts` tour.steps.welcome); the
 * two-and-a-half minutes are in the tour's status step and the projection caveat in its projection step.
 * The whole text is kept for the review export and the record (`briefing_advanced` "briefing.setting").
 */
export const SETTING_TEXT_FI =
  ROLE_TEXT_FI + UNIT_ANSWERS_FI + AUTONOMOUS_ASSETS_FI + " Näet yksiköiden sijainnit kartalla ja niiden ilmoitukset viestilokissa. Tehtäväsi on muodostaa " +
  "tilannekuva tallentuneen tiedon perusteella ja kirjata kohdennuksesi. " +
  "Kussakin jaksossa on aikaa enintään kaksi ja puoli minuuttia. " +
  PERIOD_TIME_FI + " " +
  PROJECTION_CAVEAT_FI;

/** What the practice tour's welcome adds (revision (ae)): the setting text's sentences no other screen says. Both groups. */
export const TOUR_SETTING_FI = ROLE_TEXT_FI + UNIT_ANSWERS_FI + AUTONOMOUS_ASSETS_FI + " " + PERIOD_TIME_FI;

/**
 * The same cross-checking sentence in both training texts (researcher decision 1 Oct 2026): an
 * invitation only one group read would bear on F7 and H9. Neither text says what a tool does not do.
 */
export const CROSS_CHECK_FI = "Voit verrata eri lähteiden kirjauksia keskenään.";
/**
 * Haku as it now works (Haku / Open Thinker redesign, researcher, 8 Oct 2026): the Haku tab's chat,
 * the same paragraph in both groups' training (it replaces the KUKA/MITÄ/MILLOIN builder and the
 * free-text sentence of 7 Oct) and in the tour's Haku step. No AI word: it is the Haku group's text too.
 * Its last sentence discloses, identically in both groups, that a language model writes Haku's answers
 * (researcher, 8 Oct 2026); that is the one permitted mention, so "kielimalli" is not an AI word in the tests.
 */
export const HAKU_CHAT_FI =
  // `31` radio TE-05 (19 Oct 2026): "johtopaikan", the rescue services' word (was the military "komentopaikan").
  "Haku on johtopaikan kysymystyökalu: kysy siltä omin sanoin. Haku vastaa vain tähän mennessä " +
  "tulleiden ilmoitusten ja kirjausten perusteella – myöhempää tietoa sillä ei ole – ja mainitsee " +
  "lähteet ja kellonajat. Vastaus on aina samassa muodossa: vastaus, perusteet, varmuus ja mikä " +
  "muuttaisi arviota. Vastaus voi olla väärä tai puutteellinen. Hakun vastaukset tuottaa kielimalli saapuneiden ilmoitusten pohjalta.";

/** The Open Thinker, for the AI group only (8 Oct 2026): a discussion partner that can suggest options. */
export const OPEN_THINKER_FI =
  "Thinker on keskustelukumppani, jonka kanssa voit pohtia tilannetta. Se lukee samoja tähän mennessä " +
  "tulleita tietoja kuin Haku, vastaa vain, kun kysyt siltä, ja voi ehdottaa vaihtoehtoja. Myös " +
  "Thinkerin vastaus voi olla väärä tai puutteellinen.";

/**
 * Revision (al), 10 Oct 2026 (review panel; researcher approved): the `reasoning_intent` cell's Thinker
 * text says truthfully what that Thinker holds besides Haku's information — the text of P2's orders as
 * issued (the opening intent, then the directive once it is issued). The `reasoning_once` cell keeps
 * `OPEN_THINKER_FI`, which is true for it: it reads the same information as Haku and nothing else.
 */
export const OPEN_THINKER_INTENT_FI =
  OPEN_THINKER_FI + " Thinkerillä on lisäksi päivystävän palopäällikön (P2) käskyjen teksti sellaisenaan: " +
  "alkuperäinen toiminta-ajatus ja, kun se annetaan, linjaus.";

/** Revision (am): the `reasoning_intent` cell's own sentence of `OPEN_THINKER_INTENT_FI` (what that Thinker holds besides Haku's information). */
export const THINKER_ORDERS_FI = OPEN_THINKER_INTENT_FI.slice(OPEN_THINKER_FI.length + 1);

/**
 * Revision (am), 10 Oct 2026 (researcher: "In the training there should be the Thinker training if the
 * Thinker exists for the user"): the practice tour's Thinker step, the same in both Thinker cells (the
 * practice view has no order, so neither cell's practice Thinker holds one). What Thinker is for, that
 * it can be wrong and that it decides nothing; then how to try it. DRAFT (native and domain review pending).
 */
export const PRACTICE_THINKER_FI =
  "Thinker on keskustelukumppani, jonka kanssa voit pohtia tilannetta tähän mennessä tulleiden ilmoitusten pohjalta. " +
  "Se voi olla väärässä, eikä se päätä mitään: päätökset teet sinä. " +
  "Lähetä alla oleva esimerkkikysymys napauttamalla sitä tai kirjoita oma kysymyksesi Thinkerin kenttään. Jatka, kun olet saanut vastauksen.";

/** Revision (am): the one pre-filled example question of the Thinker practice (both Thinker cells). */
export const PRACTICE_THINKER_EXAMPLE_FI = "Mitä uusimmat ilmoitukset kertovat palon kärjestä, ja kuinka vanhoja ne ovat?";

/**
 * Revision (am): V1's tool reminder for Thinker, after the practice — short, so what Thinker is for is
 * not repeated; it says the practice conversation does not carry over (the history is cleared at V1).
 */
export const TOOLS_THINKER_AGAIN_FI =
  "Thinker, jota kokeilit harjoituksessa, on käytössäsi koko istunnon ajan, myös päätösvaiheessa. Harjoituksen keskustelu ei jatku: Thinker aloittaa alusta.";

/** Revision (am): the same for the `reasoning_intent` cell, with that cell's sentence on P2's orders. */
export const TOOLS_THINKER_INTENT_AGAIN_FI = TOOLS_THINKER_AGAIN_FI + " " + THINKER_ORDERS_FI;

/** The Thinker text of a Thinker cell (revision (al)); the Haku cell has none. */
export function openThinkerTextFor(cell: Cell, lang: "fi" | "en"): string {
  if (cell === "reasoning_intent") return lang === "fi" ? OPEN_THINKER_INTENT_FI : OPEN_THINKER_INTENT_EN;
  return lang === "fi" ? OPEN_THINKER_FI : OPEN_THINKER_EN;
}

/**
 * Revision (al), 10 Oct 2026 (wording by the map agent `map-tiles`): a neutral description of the four
 * sectors by their terrain, one line each — the wedges from the point of origin (L1 280–20°, L2 20–100°,
 * L3 100–220°, L4 220–280°, 5 km). It names no power line (20 kV since SPEC/33 (bc)), no water point and nothing of the fire's
 * history. Both groups, the practice tour's `sectors` step. DRAFT, for native and domain review.
 */
export const SECTORS_FI: readonly string[] = [
  "L1 Pohjoinen: Tie R1:n pohjoispuoli: kangasmetsää, Haukilampi ja Korpiojan laakso; Karhujärven rannassa Mökkirannan mökit ja niille johtava soratie.",
  "L2 Koillinen: Tie R1 itään R1/R2-risteykseen ja sen pohjoispuoli: Kuivakankaan harju, Kuusimäen kuusikko ja Koivuojan laakso; kauempana idässä Kotkanjoki.",
  "L3 Etelä: Syttymäkohdan eteläpuoli: Honkaharjun matala hiekkaselänne ja sen metsäautotie, Rahkasuo ja tie R2; kauempana kaakossa Lahdenkylä.",
  "L4 Länsi: Syttymäkohdan länsipuoli: kangasmetsää ja Iso-Rahkasuo; lännempänä tie R3 etelään johtopaikalta.",
];

/** DRAFT (native and domain review pending). Haku only; no agent, no other configuration. */
const TRAINING_HAKU_FI =
  HAKU_CHAT_FI + " " + CROSS_CHECK_FI + " Haku on käytössäsi koko istunnon ajan, myös päätösvaiheessa.";

/** DRAFT (native and domain review pending). Haku, word for word as above, then the Open Thinker. */
const TRAINING_HAKU_THINKER_FI =
  HAKU_CHAT_FI + " " + OPEN_THINKER_FI + " " + CROSS_CHECK_FI + " Molemmat ovat käytössäsi koko istunnon ajan, myös päätösvaiheessa.";

export interface IntroTexts {
  /** The briefing's setting text — the same string in both groups. */
  readonly settingFi: string;
  /** The group-specific training text, shown after the practice view. */
  readonly trainingTitleFi: string;
  readonly trainingFi: string;
}

/** What the participant reads before the practice view (setting) and after it (training). */
export function introTextsFor(condition: Extract<ConditionId, "directed" | "substitutive">): IntroTexts {
  return condition === "substitutive"
    ? { settingFi: SETTING_TEXT_FI, trainingTitleFi: "Haku ja Thinker", trainingFi: TRAINING_HAKU_THINKER_FI }
    : { settingFi: SETTING_TEXT_FI, trainingTitleFi: "Haku", trainingFi: TRAINING_HAKU_FI };
}

// --- English (session language "en", researcher decision 1 Oct 2026). DRAFT translation, same
// sentences in the same order as the Finnish; both groups' setting texts are identical here too.

export const PROJECTION_CAVEAT_EN =
  "The spread projection is based on the fire perimeter mapped by drones, the wind forecast, terrain and " +
  "vegetation data, and a model learned from earlier fires. The model does not see everything, and the " +
  "projection can be wrong. Use it as one source of information and draw your conclusions from the whole picture.";

export const ROLE_TEXT_EN =
  "The situation is set in the near future. You command the crews of rescue units and the drone teams. " +
  "In this exercise the situation runs as recorded: in each period you record " +
  "your allocation by sector (the crews' main effort and its posture, and the drone teams' task), but the " +
  "units do not receive your records; they act on their pre-agreed tasks and their own plans. ";

export const SETTING_TEXT_EN =
  ROLE_TEXT_EN + UNIT_ANSWERS_EN + AUTONOMOUS_ASSETS_EN + " You see the " +
  "units' positions on the map and their reports in the message log. Your task is to build a picture of the " +
  "situation from the recorded information and record your allocations. " +
  "Each period has at most two and a half minutes. " +
  PERIOD_TIME_EN + " " +
  PROJECTION_CAVEAT_EN;

export const TOUR_SETTING_EN = ROLE_TEXT_EN + UNIT_ANSWERS_EN + AUTONOMOUS_ASSETS_EN + " " + PERIOD_TIME_EN;

export const CROSS_CHECK_EN = "You can compare the records of different sources with each other.";
export const HAKU_CHAT_EN =
  "Search is the command post's question tool: ask it in your own words. Search answers only from the " +
  "reports and records received so far – it has no later information – and names its sources and " +
  "times. Its answer always has the same form: answer, basis, certainty and what would change it. " +
  "The answer can be wrong or incomplete. Search's answers are produced by a language model from the reports received so far.";

export const OPEN_THINKER_EN =
  "Thinker is a discussion partner for thinking the situation through. It reads the same information " +
  "received so far as Search, answers only when you ask it, and can suggest options. Thinker's answers " +
  "too can be wrong or incomplete.";

/** The `reasoning_intent` cell's Thinker text (revision (al)); see `OPEN_THINKER_INTENT_FI`. */
export const OPEN_THINKER_INTENT_EN =
  OPEN_THINKER_EN + " Thinker also holds the text of the duty fire chief's (P2) orders as issued: " +
  "the opening intent and, once it is issued, the directive.";

/** Revision (am): see `THINKER_ORDERS_FI`. */
export const THINKER_ORDERS_EN = OPEN_THINKER_INTENT_EN.slice(OPEN_THINKER_EN.length + 1);

/** Revision (am): see `PRACTICE_THINKER_FI`. DRAFT translation. */
export const PRACTICE_THINKER_EN =
  "Thinker is a discussion partner for thinking the situation through over the reports received so far. " +
  "It can be wrong, and it decides nothing: the decisions are yours. " +
  "Send the example question below with a click, or type your own question in Thinker's field. Go on once you have an answer.";

export const PRACTICE_THINKER_EXAMPLE_EN = "What do the latest reports say about the head of the fire, and how old are they?";

export const TOOLS_THINKER_AGAIN_EN =
  "Thinker, which you tried in the practice, is available to you throughout the session, also in the decision phase. The practice conversation does not carry over: Thinker starts afresh.";

export const TOOLS_THINKER_INTENT_AGAIN_EN = TOOLS_THINKER_AGAIN_EN + " " + THINKER_ORDERS_EN;

/** The sector descriptions in English (revision (al); English place names as `app/i18n/place-names.ts`). */
export const SECTORS_EN: readonly string[] = [
  "L1 North: North of road R1: heath forest, Pike Pond and the Alder Creek valley; on the shore of Bear Lake, the Lakeside Cottages and the gravel road to them.",
  "L2 North-east: Road R1 east to the R1/R2 junction and the ground north of it: the Dry Heath esker, the spruce stand on Spruce Hill and the Birch Creek valley; further east, Eagle River.",
  "L3 South: South of the point of origin: the low Pine Ridge sand rise and its forest road, Moss Bog and road R2; further south-east, Bay Village.",
  "L4 West: West of the point of origin: heath forest and Great Moss Bog; further west, road R3 running south from the command post.",
];

const TRAINING_HAKU_EN =
  HAKU_CHAT_EN + " " + CROSS_CHECK_EN + " Search is available to you throughout the session, also in the decision phase.";

const TRAINING_HAKU_THINKER_EN =
  HAKU_CHAT_EN + " " + OPEN_THINKER_EN + " " + CROSS_CHECK_EN + " Both are available to you throughout the session, also in the decision phase.";

export interface IntroTextsIn {
  readonly setting: string;
  readonly trainingTitle: string;
  readonly training: string;
}

/**
 * The briefing and training texts in the session language. Revision (al): with `cell`
 * `reasoning_intent` the Thinker sentence is that cell's (`openThinkerTextFor`); otherwise as before.
 */
export function introTextsIn(condition: Extract<ConditionId, "directed" | "substitutive">, lang: "fi" | "en", cell?: Cell): IntroTextsIn {
  const texts = ((): IntroTextsIn => {
    if (lang === "fi") {
      const t = introTextsFor(condition);
      return { setting: t.settingFi, trainingTitle: t.trainingTitleFi, training: t.trainingFi };
    }
    return condition === "substitutive"
      ? { setting: SETTING_TEXT_EN, trainingTitle: "Search and Thinker", training: TRAINING_HAKU_THINKER_EN }
      : { setting: SETTING_TEXT_EN, trainingTitle: "Search", training: TRAINING_HAKU_EN };
  })();
  if (condition !== "substitutive" || cell !== "reasoning_intent") return texts;
  return { ...texts, training: texts.training.replace(openThinkerTextFor("reasoning_once", lang), openThinkerTextFor(cell, lang)) };
}
