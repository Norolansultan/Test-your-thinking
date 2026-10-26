/**
 * S5, the group's tool as a recording (SPEC/30 (bp); fi DRAFT, native check; en DRAFT): the Haku cell (`radio`) sees Haku, the guide
 * cells (`reasoning_intent`, `reasoning_once`) the Thinker. Two examples each, the same questions and the same records behind them
 * (`trn.r10`, `trn.r08`); the first an ordinary answer from one record, the second a limitation case (an incomplete answer: the
 * records hold nothing that answers it). Equal length as the screen shows it (the question, the answer and Haku's labels, words split
 * at spaces): each example within ±10 %, the total within ±5 %, in both languages (`test/training/parity.spec.ts`). The lines after
 * the examples, the limitation's label and the button are the same in every cell. Not live: no request is sent. No claim about the
 * tool beyond what the second example shows.
 */

import type { Cell } from "../scenario/types.js";
import { TRAINING_QUESTIONS } from "../session/training/corpus.js";
import type { Lang } from "./lang.js";
import type { TrainingTexts } from "./training-texts-types.js";
import { UI_TEXT } from "./ui.js";

export type DemoId = "haku" | "guide";
export const demoIdOf = (cell: Cell): DemoId => (cell === "radio" ? "haku" : "guide");
/** The records the recordings quote (and nothing else). */
export const DEMO_RECORD_IDS: readonly string[] = ["trn.r10", "trn.r08"];
const QUESTIONS = ["trn.q.ek52_water", "trn.q.under_control"] as const;

/** Haku's four-part answers (VASTAUS unlabelled, then PERUSTEET, VARMUUS, MIKÄ MUUTTAISI as the Haku pane labels them). */
const HAKU: Readonly<Record<Lang, readonly (readonly [string, string, string, string])[]>> = {
  fi: [
    ["EK52:n säiliö oli klo 10.15 noin 60 % täynnä.", "EK52 klo 10.15, kysyttäessä: ”säiliö noin 60 %, miehistö kolme.”", "Korkea. Tieto on tuore ja tulee suoraan yksiköltä.", "Uusi tilatieto EK52:lta."],
    ["Kirjauksista ei löydy ilmoitusta siitä, onko palo hallinnassa.", "Uusin ilmoitus on DR8:lta klo 10.12: kärki on tiellä R5. Se kertoo palon paikan, ei hallinnasta.", "Matala. Vastaus on vajaa, koska kysymykseen ei ole kirjattua vastausta.", "Ilmoitus palon tilasta tai uudempi ilmoitus."],
  ],
  en: [
    ["EK52's tank was about 60 % full at 10.15.", "EK52 at 10.15, when asked: “tank about 60 %, crew of three.”", "High. The information is recent and comes straight from the unit.", "A new status report from EK52."],
    ["The records hold no report on whether the fire is contained.", "The newest report is DR8's at 10.12: the head is at road R5. That tells where the fire is, not whether it is contained.", "Low. The answer is incomplete, because the records hold no answer.", "A report on the fire's state, or a newer report."],
  ],
};

/** The Thinker's prose answers. */
const GUIDE: Readonly<Record<Lang, readonly string[]>> = {
  fi: [
    "EK52:n säiliö oli klo 10.15 noin 60 % täynnä, kun yksikköä kysyttiin. Lähteenä on EK52:n ilmoitus. Tieto on tuore ja tulee suoraan yksiköltä, joten pidän sitä melko varmana. Sitä muuttaisi vain uusi tilatieto EK52:lta.",
    "Kirjauksissa ei ole ilmoitusta siitä, onko palo hallinnassa, joten en voi vastata siihen. Uusin ilmoitus on DR8:lta klo 10.12: kärki on tiellä R5, eli se kertoo palon paikan, ei hallinnasta. Vastaukseni on vajaa, ja sanon sen. Sen muuttaisi ilmoitus palon tilasta tai uudempi ilmoitus.",
  ],
  en: [
    "EK52's tank was about 60 % full at 10.15, when the unit was asked. It is EK52's own report. The information is recent and comes straight from the unit, so I count it fairly certain. Only a new status report from EK52 would change it.",
    "The records hold no report on whether the fire is contained, so I cannot answer that. The newest report is DR8's at 10.12: the head is at road R5, which tells where the fire is, not whether it is contained. My answer is incomplete, and I say so. A report on the fire's state, or a newer report, would change it.",
  ],
};

/** The same in every cell: the line after each example, the limitation's label and the button. */
const SHARED: Readonly<Record<Lang, { readonly notes: readonly [string, string]; readonly limitation: string; readonly leave: string }>> = {
  fi: {
    notes: ["Ensimmäisessä esimerkissä vastaus löytyi yhdestä kirjauksesta, ja se kertoo lähteen ja kellonajan.", "Toisessa esimerkissä vastaus oli vajaa, koska kirjauksissa ei ollut tietoa kysymykseen."],
    limitation: "Rajoitus: vajaa vastaus",
    leave: "Valmis",
  },
  en: {
    notes: ["In the first example the answer came from one record, and it names its source and time.", "In the second example the answer was incomplete, because the records held nothing on the question."],
    limitation: "A limitation: an incomplete answer",
    leave: "Done",
  },
};

const TOOL: Readonly<Record<Lang, Readonly<Record<DemoId, string>>>> = { fi: { haku: "Haku", guide: "Thinker" }, en: { haku: "Search", guide: "Thinker" } };

/** S5's recording for a cell in a language: heading, intro, the two examples (question, answer lines, the line after). */
export function trainingDemo(lang: Lang, cell: Cell): ReturnType<TrainingTexts["demo"]> {
  const id = demoIdOf(cell), tool = TOOL[lang][id], ui = UI_TEXT[lang];
  const title = lang === "fi" ? `${tool}: nauhoitettu esimerkki` : `${tool}: a recorded example`;
  const intro = lang === "fi" ? `Näet, miten ${tool} vastaa kahteen kysymykseen. Vastaukset on nauhoitettu: tämä ei ole elävä kysely.` : `You see how ${tool} answers two questions. The answers are recorded: this is not a live query.`;
  const examples = QUESTIONS.map((qid, k) => ({
    id: `ex${k + 1}`,
    question: TRAINING_QUESTIONS[qid]![lang],
    answer: id === "haku"
      ? (() => { const [a, b, c, d] = HAKU[lang][k]!; return [a, `${ui.basis} ${b}`, `${ui.certainty} ${c}`, `${ui.wouldChange} ${d}`]; })()
      : [GUIDE[lang][k]!],
    note: SHARED[lang].notes[k]!,
  }));
  return { title, intro, examples };
}

export const trainingDemoLines = (lang: Lang): TrainingTexts["demoLines"] => ({ limitation: SHARED[lang].limitation, leave: SHARED[lang].leave });

/** Words as the screen shows them (split at spaces), for the parity rule. */
export const shownWords = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;
