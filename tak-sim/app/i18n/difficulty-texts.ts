/**
 * The screens the difficulty audit's changes add (23 Oct 2026; `docs/audits/2026-10-23-difficulty/proposal.md` (b.3),
 * `proposal-map.md` c.3): the practice feedback. (The map-reading pretest's frame lived here until 25 Oct 2026; the map training that
 * replaced it has its own module, `map-training-texts.ts`.) The same for both groups except the
 * practice feedback's closing line, which names the tools the group has (as the training texts already do). Finnish DRAFT (native
 * check); English DRAFT. Generic: they name no place, unit, time or event of the scenario — the feedback's records, the head and the
 * measured distance are filled in from the practice view by `practice-feedback.ts`.
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
      intro: "Tämä ei kerro, mikä vastaus oli oikea, eikä harjoitusta pisteytetä. Se näyttää, mistä kunkin kysymyksen tieto oli löydettävissä.",
      question: "Kysymys",
      log: (r) => `Viestilokissa: ${r}.`,
      map: "Kartalla: palon reuna ja sen kärki näkyivät kartalla.",
      records: (r) => `Tämä ei ollut viestilokissa. Se oli kirjauksissa (${r}). Olisit löytänyt sen Hausta. Viestiloki näyttää vain osan liikenteestä.`,
      example: (q) => `Esimerkiksi: ”${q}”`,
      workedOut: "Pääteltävissä viestilokin luvuista ja kartasta.",
      headTitle: "Kärjen merkitseminen",
      head: "Kärki on palon myötätuulen puoleisin reuna. Merkintäsi näkyy sinisenä, kärki punaisena. Tyhjälle kartalle sijoitat sen ympäröivien teiden ja maaston avulla.",
      headNoMark: "Kärki on palon myötätuulen puoleisin reuna; se näkyy punaisena. Et merkinnyt kärkeä. Tyhjälle kartalle sijoitat sen ympäröivien teiden ja maaston avulla.",
      legendMark: "Merkintäsi",
      legendHead: "Kärki",
      measureTitle: "Etäisyyden mittaaminen",
      measure: (km, dir) => `R3:n silta on noin ${km} km palosta ${dir}. Mittaa-työkalu: valitse oikean reunan työkaluista Mittaa ja napauta kartalta kahta kohtaa.`,
      closingHaku: "Tulevissa jaksoissa moni ilmoitus on vain kirjauksissa. Käytä Hakua, kun viestiloki ei kerro tarpeeksi.",
      closingThinker: "Tulevissa jaksoissa moni ilmoitus on vain kirjauksissa. Käytä Hakua – tai Thinkeriä – kun viestiloki ei kerro tarpeeksi.",
      continue: "Jatka",
    },
  },
  en: {
    feedback: {
      title: "The practice questions: where the information was",
      intro: "This does not tell you which answer was right, and the practice is not scored. It shows where each question's information could be found.",
      question: "Question",
      log: (r) => `In the message log: ${r}.`,
      map: "On the map: the fire's edge and its head were drawn on the map.",
      records: (r) => `This was not in the message log. It was in the records (${r}). You could have found it with Search. The message log shows only part of the traffic.`,
      example: (q) => `For example: “${q}”`,
      workedOut: "Worked out from figures in the message log and the map.",
      headTitle: "Marking the head",
      head: "The head is the fire's front furthest downwind. Your mark is shown in blue, the head in red. On the blank map you place it by the roads and terrain around it.",
      headNoMark: "The head is the fire's front furthest downwind; it is shown in red. You placed no mark. On the blank map you place it by the roads and terrain around it.",
      legendMark: "Your mark",
      legendHead: "The head",
      measureTitle: "Measuring a distance",
      measure: (km, dir) => `The R3 bridge is about ${km} km ${dir} of the fire. The R&B tool: choose R&B among the tools on the right edge and tap two points on the map.`,
      closingHaku: "In the periods to come, many reports are only in the records. Use Search when the message log does not tell you enough.",
      closingThinker: "In the periods to come, many reports are only in the records. Use Search, or Thinker, when the message log does not tell you enough.",
      continue: "Continue",
    },
  },
};
