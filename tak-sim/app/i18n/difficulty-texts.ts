/**
 * The screens the difficulty audit's changes add (23 Oct 2026; `docs/audits/2026-10-23-difficulty/proposal.md` (b.3),
 * `proposal-map.md` c.3): the practice feedback. (The map-reading pretest's frame lived here until 25 Oct 2026; the map training that
 * replaced it has its own module, `map-training-texts.ts`.) The same for both groups except the
 * practice feedback's closing line, which names the tools the group has (as the training texts already do). Finnish DRAFT (native
 * check); English DRAFT. Generic: they name no place, unit, time or event of the scenario — the feedback's records, the head and the
 * measured distance are filled in from the practice view by `practice-feedback.ts`.
 *
 * Revision (bl), 25 Oct 2026 (researcher): for the practice's records item the feedback also shows what a search would have given — the
 * example question, the record (source, clock, text) and, because the practice is unscored, the right answer and the participant's own
 * (`lesson`, `yourAnswer`). The intro no longer says that no answer is given. The English names the tool "Search", as the English screen does.
 */

import type { Lang } from "./lang.js";

export interface DifficultyText {
  readonly feedback: {
    readonly title: string;
    readonly intro: string;
    readonly question: string;
    readonly log: (records: string) => string;
    readonly map: string;
    readonly records: (records: string) => string;
    readonly example: (question: string) => string;
    /** (bl): a records item's search lesson — the question, the record a search would have shown, and the answer it gives. */
    readonly lesson: (question: string, source: string, clock: string, text: string, option: string) => string;
    readonly yourAnswer: (option: string) => string;
    readonly workedOut: string;
    readonly headTitle: string;
    readonly head: string;
    readonly headNoMark: string;
    readonly legendMark: string;
    readonly legendHead: string;
    readonly measureTitle: string;
    readonly measure: (km: number, direction: string) => string;
    readonly closingHaku: string;
    readonly closingThinker: string;
    readonly continue: string;
  };
}

export const DIFFICULTY_TEXT: Readonly<Record<Lang, DifficultyText>> = {
  fi: {
    feedback: {
      title: "Harjoituksen kysymykset: mistä tieto löytyi",
      // (bl): was "Tämä ei kerro, mikä vastaus oli oikea, eikä harjoitusta pisteytetä. Se näyttää, mistä kunkin kysymyksen tieto oli löydettävissä."
      intro: "Harjoitusta ei pisteytetä. Tämä näyttää, mistä kunkin kysymyksen tieto oli löydettävissä. Haulla löytyvän tiedon kohdalla näet myös, mitä haku olisi näyttänyt ja mihin vastaukseen se johtaa.",
      question: "Kysymys",
      log: (r) => `Viestilokissa: ${r}.`,
      map: "Kartalla: palon reuna ja sen kärki näkyivät kartalla.",
      records: (r) => `Tämä ei ollut viestilokissa. Se oli kirjauksissa (${r}). Olisit löytänyt sen Hausta. Viestiloki näyttää vain osan liikenteestä.`,
      example: (q) => `Esimerkiksi: ”${q}”`,
      // (bl, researcher's text; the full stop after the closing quote is left out when the record's text ends with one)
      lesson: (q, src, clock, text, option) => `Haun kysymys kuten „${q}” olisi näyttänyt tämän ilmoituksen: ${src} klo ${clock}: „${text}”${/[.!?]$/.test(text) ? "" : "."} Sen perusteella vastaus on: ${option}.`,
      yourAnswer: (option) => `Vastauksesi: ${option}`,
      workedOut: "Pääteltävissä viestilokin luvuista ja kartasta.",
      headTitle: "Kärjen merkitseminen",
      head: "Kärki on palon myötätuulen puoleisin reuna. Merkintäsi näkyy sinisenä, kärki punaisena. Tyhjälle kartalle sijoitat sen ympäröivien teiden ja maaston avulla.",
      headNoMark: "Kärki on palon myötätuulen puoleisin reuna; se näkyy punaisena. Et merkinnyt kärkeä. Tyhjälle kartalle sijoitat sen ympäröivien teiden ja maaston avulla.",
      legendMark: "Merkintäsi",
      legendHead: "Kärki",
      measureTitle: "Etäisyyden mittaaminen",
      measure: (km, dir) => `R3:n silta on noin ${km} km palosta ${dir}. Mittaa-työkalu: valitse oikean reunan työkaluista Mittaa ja napauta kartalta kahta kohtaa.`,
      // Revision (bn), 25 Oct 2026 (review S7; DRAFT, native check): descriptive, not directive (was "… Käytä Hakua, kun viestiloki ei
      // kerro tarpeeksi." in bold before V1): it says where reports are and what finds them, as the tour's records step does.
      closingHaku: "Tulevissa jaksoissa moni ilmoitus on vain kirjauksissa; ne löytyvät Haulla.",
      closingThinker: "Tulevissa jaksoissa moni ilmoitus on vain kirjauksissa; ne löytyvät Haulla tai Thinkerillä.",
      continue: "Jatka",
    },
  },
  en: {
    feedback: {
      title: "The practice questions: where the information was",
      // (bl): was "This does not tell you which answer was right, and the practice is not scored. It shows where each question's information could be found."
      intro: "The practice is not scored. This shows where each question's information could be found. For information found by searching, it also shows what a search would have given and the answer it leads to.",
      question: "Question",
      log: (r) => `In the message log: ${r}.`,
      map: "On the map: the fire's edge and its head were drawn on the map.",
      records: (r) => `This was not in the message log. It was in the records (${r}). You could have found it with Search. The message log shows only part of the traffic.`,
      example: (q) => `For example: “${q}”`,
      // (bl, researcher's text with the tool named as the English screen names it; the full stop after the closing quote is left out when the record's text ends with one)
      lesson: (q, src, clock, text, option) => `A Search question such as “${q}” would have shown this report: ${src} ${clock}: “${text}”${/[.!?]$/.test(text) ? "" : "."} With it, the answer is: ${option}.`,
      yourAnswer: (option) => `Your answer: ${option}`,
      workedOut: "Worked out from figures in the message log and the map.",
      headTitle: "Marking the head",
      head: "The head is the fire's front furthest downwind. Your mark is shown in blue, the head in red. On the blank map you place it by the roads and terrain around it.",
      headNoMark: "The head is the fire's front furthest downwind; it is shown in red. You placed no mark. On the blank map you place it by the roads and terrain around it.",
      legendMark: "Your mark",
      legendHead: "The head",
      measureTitle: "Measuring a distance",
      measure: (km, dir) => `The R3 bridge is about ${km} km ${dir} of the fire. The R&B tool: choose R&B among the tools on the right edge and tap two points on the map.`,
      // Revision (bn) (review S7): descriptive, not directive (was "… Use Search when the message log does not tell you enough.").
      closingHaku: "In the coming periods many reports are only in the records; Search finds them.",
      closingThinker: "In the coming periods many reports are only in the records; Search or Thinker finds them.",
      continue: "Continue",
    },
  },
};
