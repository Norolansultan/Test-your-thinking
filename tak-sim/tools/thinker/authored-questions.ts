/**
 * Authored Thinker questions for the retrieval tests and the live check (SPEC/14 revision (q),
 * "Tests"). The bog questions are SPEC/26 §5's; the power-line questions are the designed events'
 * own example queries (`designed-events.ts`) plus one natural question. Their query vectors are
 * frozen by `npm run thinker:index` into `content/thinker/authored-queries.json`, so the tests run
 * the real vector half with no model and no network.
 */

export const AUTHORED_QUESTIONS = {
  /** SPEC/26 §5: the broad bog question of V7–V8. */
  broadBog: ["onko lohko 3 hallinnassa?"], // the rekindle arc's broad question (2 Oct 2026: the origin, not the bog)
  /** SPEC/26 §5: the narrow bog questions. */
  narrowBog: ["VPK syttymäkohta", "kyteekö syttymäkohta"],
  /** The power-line questions (F7, SPEC/02 revision (o) §5). */
  powerLine: ["20 kV linja", "sähkölinja", "onko 20 kV linja jännitteetön?"], // SPEC/33 (bc): the line is 20 kV (was "110 kV linja", "voimajohto", "onko 110 kV linja jännitteetön?")
  /** SPEC/14 revision (q): code tokens. */
  codes: ["EK11", "L3"],
} as const;

export const ALL_AUTHORED_QUESTIONS: readonly string[] = [
  ...AUTHORED_QUESTIONS.broadBog,
  ...AUTHORED_QUESTIONS.narrowBog,
  ...AUTHORED_QUESTIONS.powerLine,
  ...AUTHORED_QUESTIONS.codes,
];

/**
 * The same questions in English (SPEC/14 revision (v), 5 Oct 2026): faithful translations of the
 * Finnish ones above, item for item, using the English UI's terms (lohko → sector, syttymäkohta →
 * point of origin; codes untranslated; revision (ae), 9 Oct 2026: VPK is VOL1, as the English
 * records call it). Written before any English retrieval was run and
 * not tuned to it. DRAFT, for native and domain review. Their query vectors are frozen by
 * `npm run thinker:index` into `content/thinker/authored-queries.en.json`.
 */
export const AUTHORED_QUESTIONS_EN = {
  broadBog: ["is sector 3 under control?"],
  narrowBog: ["VOL1 point of origin", "is the point of origin smouldering"],
  powerLine: ["20 kV line", "power line", "is the 20 kV line de-energised?"], // SPEC/33 (bc): was "110 kV line", "is the 110 kV line de-energised?"
  codes: ["EK11", "L3"],
} as const satisfies { readonly [K in keyof typeof AUTHORED_QUESTIONS]: readonly string[] };

export const ALL_AUTHORED_QUESTIONS_EN: readonly string[] = [
  ...AUTHORED_QUESTIONS_EN.broadBog,
  ...AUTHORED_QUESTIONS_EN.narrowBog,
  ...AUTHORED_QUESTIONS_EN.powerLine,
  ...AUTHORED_QUESTIONS_EN.codes,
];

/** The authored questions of a retrieval language, by group. */
export function authoredQuestionsOf(lang: "fi" | "en"): { readonly [K in keyof typeof AUTHORED_QUESTIONS]: readonly string[] } {
  return lang === "en" ? AUTHORED_QUESTIONS_EN : AUTHORED_QUESTIONS;
}

/** The authored questions of a retrieval language, flattened. */
export function allAuthoredQuestionsOf(lang: "fi" | "en"): readonly string[] {
  return lang === "en" ? ALL_AUTHORED_QUESTIONS_EN : ALL_AUTHORED_QUESTIONS;
}

/**
 * The report-only planted-item probe's questions (`probe-planted.ts`), in both languages, item for
 * item. The English are faithful translations, written before any English run.
 */
export const PLANTED_PROBES: readonly {
  readonly view: number;
  readonly target: "objection" | "planted";
  readonly fi: string;
  readonly en: string;
}[] = [
  // 2 Oct 2026: the rekindle is at the origin's south edge (was the bog, Rahkasuo).
  { view: 7, target: "objection", fi: "onko lohko 3 hallinnassa?", en: "is sector 3 under control?" },
  { view: 7, target: "objection", fi: "Onko syttymäkohdan reuna varmasti sammunut?", en: "Is the edge at the point of origin definitely out?" },
  { view: 7, target: "objection", fi: "Mitä VPK on sanonut syttymäkohdasta?", en: "What has VOL1 said about the point of origin?" },
  { view: 6, target: "planted", fi: "Onko 20 kV linja jännitteetön?", en: "Is the 20 kV line de-energised?" },
  { view: 7, target: "planted", fi: "Voiko helikopteri pudottaa vettä sähkölinjan lähellä?", en: "Can the helicopter drop water near the power line?" },
  { view: 12, target: "planted", fi: "Mikä on sähkölinjan tilanne?", en: "What is the status of the power line?" },
];
