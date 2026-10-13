/**
 * The Open Thinker's structured answer (SPEC/14 revision (aq), 11 Oct 2026): the shape the model fills
 * (Gemini structured output), the deterministic text it is rendered to, and the verdicts read from its
 * fields. Pure, shared by the proxy (`server/thinker/open-answer.ts` validates, trims and renders) and
 * the browser (`OpenAnswerView.tsx` draws the structure; old turns and resumed sessions have text only).
 *
 * The verdict was coded by regex over the answer text until revision (ap); it is now a field of each
 * option, so a phrase such as "protecting settlements" can no longer be read as "departs".
 */

import type { AiVerdict, OptionVerdict } from "./thinker-protocol.js";

/** What the question is: a factual lookup, a withdrawal/evacuation question (rule 8), or anything else (rules 4 and 5). */
export const OPEN_ANSWER_KINDS = ["lookup", "options", "safety"] as const;
export type OpenAnswerKind = (typeof OPEN_ANSWER_KINDS)[number];

/** An option's relation to the directive in force (reasoning_intent from V8 on; null otherwise). */
export const OPEN_OPTION_VERDICTS = ["fits", "departs", "departure_justifiable", "not_covered"] as const;
export type OpenOptionVerdict = (typeof OPEN_OPTION_VERDICTS)[number];

/** What the newest records say of one premise of the directive. */
export const OPEN_PREMISE_STATUSES = ["supported", "contradicted", "not_addressed"] as const;
export type OpenPremiseStatus = (typeof OPEN_PREMISE_STATUSES)[number];

export interface OpenFact {
  readonly text: string;
  /** The record tags cited ("T3"); empty only for a statement that rests on no record (the fixed sentence about P2's orders). */
  readonly tags: readonly string[];
}

export interface OpenPremise {
  /** The authored premise's id (P1...): the model rates by id; the proxy sets `premise` (revision (ar), 11 Oct 2026). */
  readonly id: string;
  /** The authored text in the session language (empty until the proxy has set it; never the model's words). */
  readonly premise: string;
  readonly status: OpenPremiseStatus;
  readonly tags: readonly string[];
  /** True when the proxy filled this premise as `not_addressed` because the model returned no rating for its id (logged; revision (ar)). */
  readonly filled?: boolean;
}

export interface OpenOption {
  readonly option: string;
  readonly tradeoffs: string;
  readonly verdict: OpenOptionVerdict | null;
  readonly tags: readonly string[];
}

/** The newest fire situation the directive does not foresee (scan before the premises; logged, not rendered). */
export interface OpenUnforeseen {
  readonly text: string;
  readonly tags: readonly string[];
}

/** The answer as the model fills it (after validation), and as the proxy returns it (after trimming). */
export interface OpenStructuredAnswer {
  readonly kind: OpenAnswerKind;
  readonly facts: readonly OpenFact[];
  /** The model's scan of the newest records for a situation the directive does not foresee, or null; only with a directive in force. */
  readonly unforeseen?: OpenUnforeseen | null;
  readonly premises: readonly OpenPremise[];
  readonly options: readonly OpenOption[];
  readonly inference: string | null;
  readonly questionsForYou: readonly string[];
}

/** The structured answer with the clock time of each tag it cites (the browser shows the time, not the tag). */
export interface OpenStructuredView extends OpenStructuredAnswer {
  readonly tagTimes: Readonly<Record<string, string>>;
}

/** The whole rendered answer stays within this many words (rule: "hard limit 150 words"). */
export const OPEN_ANSWER_MAX_WORDS = 150;

export const OPEN_ANSWER_HEADINGS = {
  en: { premises: "Premises:", options: "Options:", inference: "My inference:", questions: "Questions for you:" },
  fi: { premises: "Lähtöoletukset:", options: "Vaihtoehdot:", inference: "Oma päätelmäni:", questions: "Kysymyksiä sinulle:" },
} as const;

export const OPEN_PREMISE_STATUS_TEXT: Readonly<Record<"fi" | "en", Readonly<Record<OpenPremiseStatus, string>>>> = {
  en: { supported: "supported", contradicted: "contradicted", not_addressed: "not addressed" },
  fi: { supported: "tuettu", contradicted: "ristiriidassa", not_addressed: "ei käsitelty" },
};

export const OPEN_VERDICT_TEXT: Readonly<Record<"fi" | "en", Readonly<Record<OpenOptionVerdict, string>>>> = {
  en: {
    fits: "in line with the directive",
    departs: "departs from the directive",
    departure_justifiable: "departs from the directive; a departure can be justified",
    not_covered: "the directive does not cover it",
  },
  fi: {
    fits: "linjassa linjauksen kanssa",
    departs: "poikkeaa linjauksesta",
    departure_justifiable: "poikkeaa linjauksesta; poikkeama voi olla perusteltu",
    not_covered: "linjaus ei koske tätä",
  },
};

/** "[T3, 15.40]" for the tags of one item; a tag with no known time is "[T3]" (the browser strips the tags and keeps the time). */
export function citationOf(tags: readonly string[], tagTimes: Readonly<Record<string, string>>): string {
  const known = [...new Set(tags)].filter((t) => tagTimes[t] !== undefined);
  if (known.length === 0) return "";
  const times = [...new Set(known.map((t) => tagTimes[t]!))];
  return ` [${known.join(", ")}, ${times.join(", ")}]`;
}

/**
 * The display text of a structured answer, deterministic (the same input gives the same text). A lookup
 * is its facts alone; options and safety add the sections they have. The rendered text is what the
 * browser keeps as the turn, sends back as history and logs as the answer.
 */
export function renderOpenAnswer(a: OpenStructuredAnswer, tagTimes: Readonly<Record<string, string>>, lang: "fi" | "en"): string {
  const h = OPEN_ANSWER_HEADINGS[lang];
  const lines: string[] = [];
  for (const f of a.facts) lines.push(`${f.text}${citationOf(f.tags, tagTimes)}`);
  if (a.premises.length > 0) {
    lines.push(h.premises);
    for (const p of a.premises) lines.push(`- ${p.premise} (${OPEN_PREMISE_STATUS_TEXT[lang][p.status]})${citationOf(p.tags, tagTimes)}`);
  }
  if (a.options.length > 0) {
    lines.push(h.options);
    a.options.forEach((o, i) => {
      const verdict = o.verdict ? `; ${OPEN_VERDICT_TEXT[lang][o.verdict]}` : "";
      lines.push(`${i + 1}. ${o.option}${o.tradeoffs ? `: ${o.tradeoffs}` : ""}${verdict}${citationOf(o.tags, tagTimes)}`);
    });
  }
  if (a.inference) lines.push(`${h.inference} ${a.inference}`);
  if (a.questionsForYou.length > 0) {
    lines.push(h.questions);
    for (const q of a.questionsForYou) lines.push(`- ${q}`);
  }
  return lines.join("\n");
}

/** The wire `AiVerdict` of an option verdict: the browser log keeps its three-valued domain (the justified departure is a departure there; the server log has the exact value). */
export function aiVerdictOfField(v: OpenOptionVerdict): AiVerdict {
  return v === "fits" ? "in_line" : v === "not_covered" ? "not_covered" : "departs";
}

/**
 * The verdicts of the options, read from their `verdict` fields (not from the text). `line` is the
 * option's index (0-based) among the options. Null where the answer codes none (a lookup, a safety answer,
 * no directive in force, every verdict null); the text-based {@link aiVerdictsOf} stays for old logs.
 */
export function verdictsOfOptions(a: OpenStructuredAnswer): OptionVerdict[] | null {
  if (a.kind !== "options") return null;
  const coded = a.options.flatMap((o, index) => (o.verdict === null ? [] : [{ line: index, verdict: aiVerdictOfField(o.verdict), text: `${o.option}`.slice(0, 120) }]));
  return coded.length > 0 ? coded : null;
}

/** Words of a text, as a person counts them (whitespace-separated). */
export function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}
