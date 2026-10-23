/**
 * Development tips for the personal results report (SPEC/36 §3, 23 Oct 2026): a small rule table that picks 2–4 tips from a session's
 * commander profile (`profile.ts`). Each tip is tied to one condition of the profile; the texts are GENERIC practice advice (how to
 * work, never what this scenario held), fi and en, the Finnish DRAFT (native check). A pure, deterministic fold: the same records
 * give the same tips. Used by the researcher's report generator (`tools/results/`), not shown during the session.
 *
 * The rules, in priority order (improvement before reinforcement; at most one tip per dimension, since each dimension's bands exclude
 * one another):
 *
 *   calibration_over     calibration band "over" (confidence above accuracy by more than 10 points)
 *   calibration_under    calibration band "under"
 *   checking_rarely      checking band "rarely" (looked something up before acting in under a third of the decisions)
 *   ai_facts_only        at least `MIN_AI_QUESTIONS` questions to the chat tools (Haku's chat, the Thinker) in the main views, and fewer
 *                        than a third of them open questions (`isOpenQuestion`): the tools were used mainly for facts
 *   tools_unused         the tool-use fold ran and no search or question was made in the main views
 *   resolution_flat      calibration resolution "about the same" or "higher when wrong" (confidence did not tell right from wrong)
 *   checking_sometimes   checking band "sometimes"
 *   calibration_well     calibration band "well" (reinforce)
 *   checking_often       checking band "often" (reinforce)
 *
 * Fewer than two matched (a short session, too few answers): the general tips `general_scan`, then `general_confidence`, fill up to
 * two. `isOpenQuestion` is a transparent keyword heuristic over the participant's own question text, used for this choice only; it
 * is not a study measure (the questions' coding for the analysis is the coders', SPEC/09).
 */

import type { LogRecord } from "./log.js";
import type { AiChatQuerySubmittedDetail } from "./record-kinds.js";
import type { CommanderProfile } from "./profile.js";

export type TipId =
  | "calibration_over" | "calibration_under" | "checking_rarely" | "ai_facts_only" | "tools_unused" | "resolution_flat"
  | "checking_sometimes" | "calibration_well" | "checking_often" | "general_scan" | "general_confidence";

export const MIN_TIPS = 2;
export const MAX_TIPS = 4;
export const MIN_AI_QUESTIONS = 3;
export const OPEN_SHARE_BELOW = 1 / 3;

export interface AiQuestionFocus {
  /** Questions typed to the chat tools in the main views (V1–V14). */
  readonly asked: number;
  /** Of them, open questions (what if, why, what am I missing, should …). */
  readonly open: number;
}

export interface TipInput {
  readonly profile: CommanderProfile;
  readonly ai: AiQuestionFocus;
}

export interface TipRule {
  readonly id: TipId;
  /** The condition in words (the spec's table and the report's method note). */
  readonly condition: string;
  readonly applies: (input: TipInput) => boolean;
}

const OPEN_EN = /(?<!\p{L})(should|could|would|what if|why|risks?|danger\p{L}*|miss(?:ed|ing|es)?|overlook\p{L}*|wrong|assum\p{L}*|alternatives?|instead|recommend\p{L}*|best|better|worse|likely|expect\p{L}*|predict\p{L}*|happen\p{L}*|chang\p{L}*|safe|unsafe|doubt\p{L}*|sure|certain\p{L}*|confirm\p{L}*|contradict\p{L}*|conflict\p{L}*|disagree\p{L}*|reliab\p{L}*|trust\p{L}*)(?!\p{L})/iu;
const OPEN_FI = /(pitäisi|kannatta|voisi|entä jos|mitä jos|miksi|riski|vaara|puuttu|unohtu|huomio|väärin|oleta|olettam|vaihtoeh|sijaan|suosit|paras|parempi|huonompi|todennäk|odott|ennust|tapahtu|muuttu|turvalli|epäil|varma|vahvist|ristiri|luotet)/i;

/** An open question (judgement, alternatives, what could be missed) rather than a fact look-up; keyword heuristic, fi and en. */
export function isOpenQuestion(text: string): boolean {
  return OPEN_EN.test(text) || OPEN_FI.test(text);
}

/** The questions to the chat tools in the main views and how many were open. */
export function aiQuestionFocus(records: readonly LogRecord[]): AiQuestionFocus {
  let asked = 0, open = 0;
  for (const r of records) {
    if (r.kind !== "ai_chat_query_submitted") continue;
    const d = r.detail as Partial<AiChatQuerySubmittedDetail>;
    if (typeof d.view !== "number" || d.view < 1 || typeof d.text !== "string") continue;
    asked += 1;
    if (isOpenQuestion(d.text)) open += 1;
  }
  return { asked, open };
}

const ok = (status: string): boolean => status === "ok";

export const TIP_RULES: readonly TipRule[] = [
  { id: "calibration_over", condition: "calibration band: more confident than accurate", applies: ({ profile: p }) => ok(p.calibration.status) && p.calibration.band === "over" },
  { id: "calibration_under", condition: "calibration band: less confident than accurate", applies: ({ profile: p }) => ok(p.calibration.status) && p.calibration.band === "under" },
  { id: "checking_rarely", condition: "checked before acting in under a third of the decisions", applies: ({ profile: p }) => ok(p.checking.status) && p.checking.band === "rarely" },
  {
    id: "ai_facts_only", condition: `at least ${MIN_AI_QUESTIONS} chat questions, under a third of them open questions`,
    applies: ({ ai }) => ai.asked >= MIN_AI_QUESTIONS && ai.open / ai.asked < OPEN_SHARE_BELOW,
  },
  {
    id: "tools_unused", condition: "no search and no question in the main views",
    applies: ({ profile: p }) => ok(p.toolUse.status) && p.toolUse.hakuSearches + (p.toolUse.guideQuestions ?? 0) === 0,
  },
  {
    id: "resolution_flat", condition: "confidence about the same, or higher, when wrong as when right",
    applies: ({ profile: p }) => ok(p.calibration.resolution.status) && (p.calibration.resolution.band === "about_same" || p.calibration.resolution.band === "higher_when_wrong"),
  },
  { id: "checking_sometimes", condition: "checked before acting in a third to two thirds of the decisions", applies: ({ profile: p }) => ok(p.checking.status) && p.checking.band === "sometimes" },
  { id: "calibration_well", condition: "calibration band: well calibrated (reinforce)", applies: ({ profile: p }) => ok(p.calibration.status) && p.calibration.band === "well" },
  { id: "checking_often", condition: "checked before acting in two thirds of the decisions or more (reinforce)", applies: ({ profile: p }) => ok(p.checking.status) && p.checking.band === "often" },
];

/** Filled in, in this order, when fewer than {@link MIN_TIPS} rules matched. */
export const GENERAL_TIPS: readonly TipId[] = ["general_scan", "general_confidence"];

/** The tips for a session: 2–4 ids, in priority order. */
export function chooseTips(input: TipInput): TipId[] {
  const chosen = TIP_RULES.filter((rule) => rule.applies(input)).map((rule) => rule.id).slice(0, MAX_TIPS);
  for (const id of GENERAL_TIPS) if (chosen.length < MIN_TIPS) chosen.push(id);
  return chosen;
}

export interface TipText {
  readonly title: string;
  readonly text: string;
}

const EN: Readonly<Record<TipId, TipText>> = {
  calibration_over: { title: "Ask what would change your mind", text: "Before you commit to a judgement, ask yourself: what would I expect to see if I were wrong? Name one such sign and look for it. If you cannot name one, hold your confidence a little lower." },
  calibration_under: { title: "Trust what you have checked", text: "When you have checked the facts, say what you think and why, out loud or in writing. A clear judgement with its reason is more useful to others than a cautious one without." },
  checking_rarely: { title: "Use a two-source rule for key facts", text: "For the facts your decision rests on, look for a second, independent source before you act: a different report, a different observer, a different time. One source can be out of date without anything feeling wrong." },
  ai_facts_only: { title: "Also ask what you might be missing", text: "An assistant is quick at looking things up. Try also asking it the open questions: what could go wrong with this plan, what am I not seeing, what would change the picture. Then check its answer against the sources." },
  tools_unused: { title: "Ask one focused question", text: "Before a key decision, ask one short question about the thing the decision depends on most. A single well-aimed question often costs less time than it saves." },
  resolution_flat: { title: "Notice what your confidence rests on", text: "Before you say how sure you are, name the fact your answer rests on. When you cannot point to one, that is a sign to be less sure; when you can, you may be surer." },
  checking_sometimes: { title: "Make checking a habit, not a reaction", text: "People tend to check when something feels off, and quiet changes slip past. Take a short look at what has changed since your last decision every time, not only when something seems wrong." },
  calibration_well: { title: "Keep saying how sure you are", text: "Your confidence matched your accuracy well. Keep stating it when you report: others can rely on a commander whose confidence means something." },
  checking_often: { title: "Keep checking, within a time limit", text: "You checked before acting in most decisions. Keep it, and give yourself a short time limit for it, so that checking supports the decision rather than delaying it." },
  general_scan: { title: "Scan for change before each decision", text: "Before each decision, spend a moment on what has changed since the last one: new reports, the weather, your units' positions." },
  general_confidence: { title: "Say how sure you are", text: "When you report a judgement, add how sure you are and what it rests on. It helps others weigh it, and it helps you notice when you are guessing." },
};

// DRAFT (SPEC/36 §7): native check.
const FI: Readonly<Record<TipId, TipText>> = {
  calibration_over: { title: "Kysy, mikä muuttaisi käsitystäsi", text: "Ennen kuin sitoudut arvioon, kysy itseltäsi: mitä odottaisin näkeväni, jos olisin väärässä? Nimeä yksi tällainen merkki ja etsi sitä. Jos et keksi yhtään, pidä varmuutesi hieman matalampana." },
  calibration_under: { title: "Luota siihen, minkä olet tarkistanut", text: "Kun olet tarkistanut tiedot, sano mitä ajattelet ja miksi, ääneen tai kirjallisesti. Selkeä arvio perusteineen on muille hyödyllisempi kuin varovainen arvio ilman perusteita." },
  checking_rarely: { title: "Käytä kahden lähteen sääntöä keskeisille tiedoille", text: "Etsi niille tiedoille, joiden varaan päätöksesi rakentuu, toinen riippumaton lähde ennen kuin toimit: eri ilmoitus, eri havainnoija, eri ajankohta. Yksi lähde voi olla vanhentunut ilman, että mikään tuntuu oudolta." },
  ai_facts_only: { title: "Kysy myös, mitä saatat ohittaa", text: "Avustaja löytää tiedot nopeasti. Kokeile kysyä siltä myös avoimia kysymyksiä: mikä tässä suunnitelmassa voisi mennä pieleen, mitä en näe, mikä muuttaisi tilannekuvaa. Tarkista sitten vastaus lähteistä." },
  tools_unused: { title: "Kysy yksi tarkka kysymys", text: "Kysy ennen tärkeää päätöstä yksi lyhyt kysymys siitä, mistä päätös eniten riippuu. Yksi hyvin kohdistettu kysymys vie usein vähemmän aikaa kuin säästää." },
  resolution_flat: { title: "Huomaa, mihin varmuutesi perustuu", text: "Ennen kuin sanot, kuinka varma olet, nimeä tieto, johon vastauksesi perustuu. Jos et pysty osoittamaan sellaista, se on merkki olla vähemmän varma; jos pystyt, voit olla varmempi." },
  checking_sometimes: { title: "Tee tarkistamisesta tapa, ei reaktio", text: "Tarkistamme helposti vasta, kun jokin tuntuu oudolta, ja hiljaiset muutokset jäävät huomaamatta. Katso joka kerta lyhyesti, mikä on muuttunut edellisen päätöksesi jälkeen, ei vain silloin, kun jokin vaikuttaa väärältä." },
  calibration_well: { title: "Kerro jatkossakin, kuinka varma olet", text: "Varmuutesi vastasi osuvuuttasi hyvin. Kerro se jatkossakin raportoidessasi: johtajan varmuuteen voi luottaa, kun se tarkoittaa jotakin." },
  checking_often: { title: "Tarkista jatkossakin, aikarajan puitteissa", text: "Tarkistit tietoja ennen toimintaa useimmissa päätöksissä. Jatka samaan tapaan ja anna itsellesi tarkistamiseen lyhyt aikaraja, jotta tarkistaminen tukee päätöstä eikä viivytä sitä." },
  general_scan: { title: "Katso muutokset ennen jokaista päätöstä", text: "Käytä ennen jokaista päätöstä hetki siihen, mikä on muuttunut edellisen jälkeen: uudet ilmoitukset, sää, yksiköidesi sijainnit." },
  general_confidence: { title: "Kerro, kuinka varma olet", text: "Kun raportoit arvion, kerro myös, kuinka varma olet ja mihin arvio perustuu. Se auttaa muita punnitsemaan sitä ja auttaa sinua huomaamaan, milloin arvaat." },
};

export const TIP_TEXT: Readonly<Record<"fi" | "en", Readonly<Record<TipId, TipText>>>> = { fi: FI, en: EN };
