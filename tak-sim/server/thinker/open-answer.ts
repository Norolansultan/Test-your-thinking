/**
 * The Open Thinker's structured output at the proxy (SPEC/14 revision (aq), 11 Oct 2026): the Gemini
 * response schema, the validation of what the model returned, and the deterministic limits applied to
 * it (item counts, per-field length, the 150-word total) before it is rendered to the display text
 * (`app/session/open-answer.ts`). Pure: no model, no clock. The limits are enforced here, not asked of
 * the model — the 150-word rule was broken by 117–219-word answers when it was only in the prompt.
 */

import { isImperativeSentence, sentencesOf, withoutImperativeSentences } from "./answer-checks.js";
import { DIRECTIVE_PREMISE_IDS, premiseText, type DirectivePremises } from "./directive-premises.js";
import {
  OPEN_ANSWER_KINDS, OPEN_ANSWER_MAX_WORDS, OPEN_OPTION_VERDICTS, OPEN_PREMISE_STATUSES, renderOpenAnswer, wordCount,
  type OpenAnswerKind, type OpenFact, type OpenOption, type OpenOptionVerdict, type OpenPremise, type OpenPremiseStatus, type OpenStructuredAnswer, type OpenUnforeseen,
} from "../../app/session/open-answer.js";

/**
 * Item caps per array and character caps per field. They are also stated in the schema (maxItems / maxLength) so the
 * model writes to them; sized so a full options answer with a directive is about 140 words, and {@link limitOpenAnswer}
 * then drops whole items (never a half sentence) if the rendered text is still over the word budget.
 */
export const OPEN_LIMITS = {
  facts: 2, lookupFacts: 2, premises: DIRECTIVE_PREMISE_IDS.length, options: 3, questions: 3,
  factChars: 150, optionChars: 32, tradeoffChars: 90, inferenceChars: 100, questionChars: 100, unforeseenChars: 120,
} as const;

const tagsSchema = { type: "array", items: { type: "string" }, maxItems: "3", description: "Tags of the records this item rests on, e.g. T2." } as const;
const text = (max: number, description?: string) => ({ type: "string", maxLength: String(max), ...(description ? { description } : {}) }) as const;

/**
 * The Open Thinker's Gemini response schema. `kind` first: the model decides what the question is before
 * it fills the rest. Verdicts and the inference are nullable. The array caps repeat {@link OPEN_LIMITS}
 * so the model aims below them; the proxy enforces them regardless.
 */
export const OPEN_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...OPEN_ANSWER_KINDS] },
    unforeseen: {
      type: "object", nullable: true,
      description: "Only with a directive in force and kind options. The newest record (not older than 30 min) that shows a fire situation the directive does not foresee and that changes where or how lines can be held (a new or unattended fire, a change in wind or spread, a barrier lost). Null if none. Crew condition and resources do not count.",
      properties: { text: text(OPEN_LIMITS.unforeseenChars), tags: tagsSchema }, required: ["text", "tags"], propertyOrdering: ["text", "tags"],
    },
    premises: {
      type: "array", maxItems: String(OPEN_LIMITS.premises),
      description: "Only with a directive in force and kind options. One entry per authored directive premise (P1, P2, as listed after the directive): rate each by its id; do not add or reword premises.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: [...DIRECTIVE_PREMISE_IDS], description: "The id of the authored premise." },
          status: { type: "string", enum: [...OPEN_PREMISE_STATUSES], description: "supported: a newest record, cited in tags, shows it still holds. contradicted: a newest record, cited in tags, shows the situation the directive did not foresee, so the condition no longer holds. not_addressed: no newest record bears on it (tags empty)." },
          tags: tagsSchema,
        },
        required: ["id", "status", "tags"], propertyOrdering: ["id", "status", "tags"],
      },
    },
    options: {
      type: "array", maxItems: String(OPEN_LIMITS.options),
      items: {
        type: "object",
        properties: {
          option: text(OPEN_LIMITS.optionChars, "A few words naming the option."),
          tradeoffs: text(OPEN_LIMITS.tradeoffChars, "One short sentence: gain, risk, need."),
          verdict: { type: "string", enum: [...OPEN_OPTION_VERDICTS], nullable: true, description: "Null without a directive in force. departure_justifiable only if some premise above is contradicted." },
          tags: tagsSchema,
        },
        required: ["option", "tradeoffs", "verdict", "tags"], propertyOrdering: ["option", "tradeoffs", "verdict", "tags"],
      },
    },
    facts: {
      type: "array", maxItems: String(OPEN_LIMITS.facts),
      items: { type: "object", properties: { text: text(OPEN_LIMITS.factChars, "One short sentence."), tags: tagsSchema }, required: ["text", "tags"], propertyOrdering: ["text", "tags"] },
    },
    inference: { ...text(OPEN_LIMITS.inferenceChars, "One short sentence, or null."), nullable: true },
    questionsForYou: { type: "array", items: text(OPEN_LIMITS.questionChars), maxItems: String(OPEN_LIMITS.questions) },
  },
  required: ["kind", "unforeseen", "premises", "options", "facts", "inference", "questionsForYou"],
  propertyOrdering: ["kind", "unforeseen", "premises", "options", "facts", "inference", "questionsForYou"],
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);

/** A tag as "T3" (also "[T3]", "t3", "3"); null when it is not one. */
export function normaliseTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*\[?\s*T?\s*(\d{1,3})\s*\]?\s*$/i.exec(raw);
  return m ? `T${Number(m[1])}` : null;
}

const INLINE_CITATION = /\s?[[(]([^[\]()]*\bT\d{1,3}\b[^[\]()]*)[\])]/g;

/**
 * The model is told to keep tags out of its sentences. If it writes "[T3, 15:40]" in a text anyway, the
 * bracket is removed and its tags join the item's tags, so the rendered citation is the one
 * the server builds (the time of the tagged record), never the model's own.
 */
function cleanText(text: string, tags: string[]): string {
  return text.replace(INLINE_CITATION, (_whole, inner: string) => {
    for (const m of inner.matchAll(/\bT(\d{1,3})\b/g)) tags.push(`T${Number(m[1])}`);
    return "";
  }).replace(/ +([.,;:])/g, "$1").trim();
}

function tagsOf(raw: unknown): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const t of raw) {
    const n = normaliseTag(t);
    if (n !== null) out.push(n);
  }
  return out;
}

/**
 * Parses and validates the model's JSON. Null when it is not JSON, the kind is unknown, an item is
 * malformed, a lookup or safety answer states nothing, or an options answer gives fewer than two options.
 * Extra fields are ignored; a missing array is empty. Inline [T#] brackets in texts are folded into tags.
 */
export function parseOpenAnswer(text: string): OpenStructuredAnswer | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(json)) return null;
  const kind = json["kind"];
  if (!OPEN_ANSWER_KINDS.includes(kind as OpenAnswerKind)) return null;
  const list = (v: unknown): unknown[] | null => (v === undefined || v === null ? [] : Array.isArray(v) ? v : null);

  const rawFacts = list(json["facts"]), rawPremises = list(json["premises"]), rawOptions = list(json["options"]), rawQuestions = list(json["questionsForYou"]);
  if (!rawFacts || !rawPremises || !rawOptions || !rawQuestions) return null;

  const facts: OpenFact[] = [];
  for (const f of rawFacts) {
    if (!isRecord(f)) return null;
    const tags = tagsOf(f["tags"]);
    const t = str(f["text"]);
    if (!tags || !t) return null;
    facts.push({ text: cleanText(t, tags), tags });
  }
  const premises: OpenPremise[] = [];
  for (const p of rawPremises) {
    if (!isRecord(p)) return null;
    const tags = tagsOf(p["tags"]);
    const id = str(p["id"]) ?? "";
    if (!tags || !OPEN_PREMISE_STATUSES.includes(p["status"] as OpenPremiseStatus)) return null;
    // An unknown or missing id is kept here and dropped by `limitOpenAnswer` (logged); the model's own wording, if any, is ignored.
    premises.push({ id, premise: "", status: p["status"] as OpenPremiseStatus, tags });
  }
  let unforeseen: OpenUnforeseen | null = null;
  const rawUnforeseen = json["unforeseen"];
  if (rawUnforeseen !== undefined && rawUnforeseen !== null) {
    if (!isRecord(rawUnforeseen)) return null;
    const tags = tagsOf(rawUnforeseen["tags"]);
    const t = str(rawUnforeseen["text"]);
    if (!tags) return null;
    if (t) unforeseen = { text: cleanText(t, tags), tags };
  }
  const options: OpenOption[] = [];
  for (const o of rawOptions) {
    if (!isRecord(o)) return null;
    const tags = tagsOf(o["tags"]);
    const name = str(o["option"]);
    const trade = str(o["tradeoffs"]);
    const v = o["verdict"];
    if (!tags || !name || !trade) return null;
    if (v !== null && v !== undefined && !OPEN_OPTION_VERDICTS.includes(v as OpenOptionVerdict)) return null;
    options.push({ option: cleanText(name, tags), tradeoffs: cleanText(trade, tags), verdict: (v ?? null) as OpenOptionVerdict | null, tags });
  }
  const inferenceTags: string[] = [];
  const rawInference = json["inference"];
  if (rawInference !== undefined && rawInference !== null && typeof rawInference !== "string") return null;
  const inferenceText = typeof rawInference === "string" ? str(rawInference) : null;
  const inference = inferenceText ? cleanText(inferenceText, inferenceTags) || null : null;
  const questionsForYou: string[] = [];
  for (const q of rawQuestions) {
    const t = str(q);
    if (!t) return null;
    questionsForYou.push(cleanText(t, []));
  }

  if ((kind === "lookup" || kind === "safety") && facts.length === 0) return null;
  // Researcher, 11 Oct 2026: a lookup is never a bare answer (that would make the Thinker a second Search): it ends in exactly one
  // question that ties the fact to the commander's situation or plan, and that question is no instruction or recommendation. A genuine
  // question may use "should" ("Should the relay move given W2 is 1.2 km away?"); "You should move the relay." or "I recommend…" may not
  // (researcher, 11 Oct 2026, SPEC/14 (as)). Otherwise: schema failure.
  if (kind === "lookup" && (questionsForYou.length === 0 || questionsForYou.some(isImperativeQuestion))) return null;
  if (kind === "options" && options.length < 2) return null;
  return { kind: kind as OpenAnswerKind, facts, unforeseen, premises, options, inference, questionsForYou };
}

/** A lookup's question that is an instruction or a recommendation (in either language: the model may answer in the other one). */
function isImperativeQuestion(q: string): boolean {
  return sentencesOf(q).some((sentence) => isImperativeSentence(sentence, "en") || isImperativeSentence(sentence, "fi"));
}

/** What a request allows: verdicts and premises only with a directive in force (reasoning_intent, V8 on, not the practice view). */
export interface OpenAnswerContext {
  readonly directiveInForce: boolean;
  /** Number of tagged records the model was given (T1…Tn). */
  readonly taggedCount: number;
  /** hh.mm of each tagged record, T1 first. */
  readonly tagTimes: readonly string[];
  /** The authored premises (reasoning_intent with a directive in force); absent: no premises are shown. */
  readonly premises?: DirectivePremises | undefined;
}

export interface LimitedOpenAnswer {
  readonly answer: OpenStructuredAnswer;
  /** Per tag, the clock time of its record (only tags that exist). */
  readonly tagTimes: Readonly<Record<string, string>>;
  /** Why the model's answer was changed, empty when it was not: `kind_*`, `no_directive`, `count_*`, `chars_*`, `words`. */
  readonly trimmed: readonly string[];
}

/** The text cut within `max` characters: at the last sentence end if there is one past the half, else at a word boundary with an ellipsis (the last resort; the schema asks for short fields so it is rare). */
export function cutChars(text: string, max: number): string {
  if (text.length <= max) return text;
  const sentenceEnd = Math.max(...[". ", "! ", "? "].map((e) => text.lastIndexOf(e, max - 1))) + 1;
  if (sentenceEnd > max * 0.5) return text.slice(0, sentenceEnd).trim();
  const head = text.slice(0, max - 1);
  const at = head.lastIndexOf(" ");
  return `${(at > max * 0.5 ? head.slice(0, at) : head).replace(/[\s,;:–—-]+$/, "")}…`;
}

/** The text without its imperative sentences, in either language (the model may answer in the other one). */
function cutImperatives(text: string): { text: string; changed: boolean } {
  const en = withoutImperativeSentences(text, "en");
  const fi = withoutImperativeSentences(en.text, "fi");
  return { text: fi.text, changed: en.changed || fi.changed };
}

/**
 * Revision (as), 11 Oct 2026, options and safety answers: an imperative sentence in a free-text field is cut out of the field, in the
 * model's own words (never rewritten). A field left empty goes with its item: an option only while at least two remain (else only
 * its trade-off text goes), the last fact of a safety answer never (kept, logged `imperative_kept`). Logged as `imperative_removed`.
 * A question to the commander is no imperative, so "Should you …?" stays.
 */
function removeImperatives(d: Draft, note: (why: string) => void): void {
  for (const o of d.options) {
    const cut = cutImperatives(o.tradeoffs);
    if (cut.changed) { o.tradeoffs = cut.text; note("imperative_removed"); }
  }
  for (const o of [...d.options]) {
    if (o.tradeoffs === "" && d.options.length > 2) d.options.splice(d.options.indexOf(o), 1);
  }
  d.facts = d.facts.flatMap((f) => {
    const cut = cutImperatives(f.text);
    if (!cut.changed) return [f];
    if (cut.text !== "") { note("imperative_removed"); return [{ ...f, text: cut.text }]; }
    if (d.kind === "safety" && d.facts.length === 1) { note("imperative_kept"); return [f]; }
    note("imperative_removed");
    return [];
  });
  if (d.inference) {
    const cut = cutImperatives(d.inference);
    if (cut.changed) { d.inference = cut.text || null; note("imperative_removed"); }
  }
  if (d.unforeseen) {
    const cut = cutImperatives(d.unforeseen.text);
    if (cut.changed) { d.unforeseen = cut.text ? { ...d.unforeseen, text: cut.text } : null; note("imperative_removed"); }
  }
  d.questionsForYou = d.questionsForYou.flatMap((q) => {
    const cut = cutImperatives(q);
    if (cut.changed) note("imperative_removed");
    return cut.text === "" ? [] : [cut.text];
  });
}

/** The text cut to its first `words` words, with an ellipsis. */
function cutWords(text: string, words: number): string {
  const parts = text.trim().split(/\s+/);
  return parts.length <= words ? text : `${parts.slice(0, words).join(" ").replace(/[\s,;:–—-]+$/, "")}…`;
}

interface Draft {
  kind: OpenAnswerKind;
  facts: { text: string; tags: string[] }[];
  unforeseen: { text: string; tags: string[] } | null;
  premises: { id: string; premise: string; status: OpenPremiseStatus; tags: string[]; filled?: boolean }[];
  options: { option: string; tradeoffs: string; verdict: OpenOptionVerdict | null; tags: string[] }[];
  inference: string | null;
  questionsForYou: string[];
}

/**
 * Applies the rules the prompt states but the model cannot be trusted to keep, in this order:
 * routing by kind (a lookup or safety answer has no options, premises or verdicts), no directive in force
 * means no premises and no verdicts, item caps, per-field character caps, then the 150-word total (the
 * longest field is shortened until the rendered text fits). Reports what it changed in `trimmed`.
 */
export function limitOpenAnswer(raw: OpenStructuredAnswer, ctx: OpenAnswerContext, lang: "fi" | "en"): LimitedOpenAnswer {
  const trimmed: string[] = [];
  const note = (why: string) => { if (!trimmed.includes(why)) trimmed.push(why); };
  const d: Draft = {
    kind: raw.kind,
    facts: raw.facts.map((f) => ({ ...f, tags: [...f.tags] })),
    unforeseen: raw.unforeseen ? { text: raw.unforeseen.text, tags: [...raw.unforeseen.tags] } : null,
    premises: raw.premises.map((p) => ({ ...p, tags: [...p.tags] })),
    options: raw.options.map((o) => ({ ...o, tags: [...o.tags] })),
    inference: raw.inference,
    questionsForYou: [...raw.questionsForYou],
  };

  if (d.kind !== "options") {
    if (d.options.length > 0 || d.premises.length > 0) note(`kind_${d.kind}`);
    d.options = [];
    d.premises = [];
    d.unforeseen = null;
  }
  if (d.kind === "lookup" && d.questionsForYou.length > 1) { d.questionsForYou = d.questionsForYou.slice(0, 1); note("count_questions"); }
  if (!ctx.directiveInForce || !ctx.premises) {
    if (d.premises.length > 0 || d.options.some((o) => o.verdict !== null)) note("no_directive");
    d.premises = [];
    d.unforeseen = null;
    for (const o of d.options) o.verdict = null;
  }

  if (d.kind !== "lookup") removeImperatives(d, note);

  const cap = <T,>(arr: T[], max: number, name: string): T[] => { if (arr.length > max) note(`count_${name}`); return arr.slice(0, max); };
  d.facts = cap(d.facts, d.kind === "lookup" ? OPEN_LIMITS.lookupFacts : OPEN_LIMITS.facts, "facts");
  d.options = cap(d.options, OPEN_LIMITS.options, "options");
  d.questionsForYou = cap(d.questionsForYou, OPEN_LIMITS.questions, "questions");

  // The model overshoots a schema maxLength by a few characters now and then; the server tolerates a quarter more and lets the word
  // budget decide, so a sentence is not cut for a few characters.
  const chars = (text: string, max: number, name: string): string => { const out = cutChars(text, Math.round(max * 1.25)); if (out !== text) note(`chars_${name}`); return out; };
  for (const f of d.facts) f.text = chars(f.text, OPEN_LIMITS.factChars, "facts");
  for (const o of d.options) { o.option = chars(o.option, OPEN_LIMITS.optionChars, "options"); o.tradeoffs = chars(o.tradeoffs, OPEN_LIMITS.tradeoffChars, "options"); }
  if (d.inference) d.inference = chars(d.inference, OPEN_LIMITS.inferenceChars, "inference");
  d.questionsForYou = d.questionsForYou.map((q) => chars(q, OPEN_LIMITS.questionChars, "questions"));

  // Tags that name no record are dropped from the answer (the log's citation check sees the raw ones).
  const tagTimes: Record<string, string> = {};
  ctx.tagTimes.forEach((time, i) => { tagTimes[`T${i + 1}`] = time; });
  const known = (tags: string[]) => [...new Set(tags)].filter((t) => tagTimes[t] !== undefined);
  for (const f of d.facts) f.tags = known(f.tags);
  for (const p of d.premises) p.tags = known(p.tags);
  for (const o of d.options) o.tags = known(o.tags);

  d.unforeseen = d.unforeseen ? { text: chars(d.unforeseen.text, OPEN_LIMITS.unforeseenChars, "unforeseen"), tags: known(d.unforeseen.tags) } : null;

  // Revision (ar): the premises are the authored ones. Unknown ids are dropped, a repeated id keeps the first, a missing id is
  // "not addressed", the order is the authored one, and the text shown is the authored text in the session language (never the model's).
  if (d.kind === "options" && ctx.directiveInForce && ctx.premises) {
    const seen = new Set<string>();
    const byId = new Map<string, Draft["premises"][number]>();
    for (const p of d.premises) {
      if (!ctx.premises.premises.some((a) => a.id === p.id)) note("premise_unknown_id");
      else if (seen.has(p.id)) note("premise_duplicate_id");
      else { seen.add(p.id); byId.set(p.id, p); }
    }
    d.premises = ctx.premises.premises.map((a) => {
      const rated = byId.get(a.id);
      if (!rated) note("premise_missing_id");
      return { id: a.id, premise: premiseText(a, lang), status: rated ? rated.status : "not_addressed" as OpenPremiseStatus, tags: rated ? rated.tags : [], ...(rated ? {} : { filled: true }) };
    });
  }

  // Consistency of the premise check (SPEC/14 (aq) tuning): a status that claims the newest records bear on a premise needs a record
  // tag; without one the premise is "not addressed". A justified departure is reachable only when some premise is contradicted;
  // otherwise it is a plain departure. Both are logged. Nothing is forced the other way: a contradicted premise does not make a verdict.
  for (const p of d.premises) {
    if (p.status !== "not_addressed" && p.tags.length === 0) { p.status = "not_addressed"; note("premise_no_record"); }
  }
  // Revision (ar): logged only, nothing forced: the model found a situation the directive does not foresee yet rates P1 (the situation is as the directive describes) supported.
  if (d.unforeseen && d.premises.some((p) => p.id === "P1" && p.status === "supported")) note("unforeseen_p1_supported");
  if (d.options.some((o) => o.verdict === "departure_justifiable") && !d.premises.some((p) => p.status === "contradicted")) {
    for (const o of d.options) if (o.verdict === "departure_justifiable") o.verdict = "departs";
    note("justified_without_contradicted_premise");
  }

  // The word budget. First drop what the answer can do without — the optional facts of an options answer, questions beyond the
  // first, the inference — one at a time (last first); only then shorten the longest field by a fifth until the text fits.
  const words = () => wordCount(renderOpenAnswer(d, tagTimes, lang));
  while (words() > OPEN_ANSWER_MAX_WORDS && d.kind === "options" && d.facts.length > 0) { d.facts.pop(); note("words"); }
  while (words() > OPEN_ANSWER_MAX_WORDS && d.questionsForYou.length > 1) { d.questionsForYou.pop(); note("words"); }
  if (words() > OPEN_ANSWER_MAX_WORDS && d.inference) { d.inference = null; note("words"); }
  // Still over: whole items, the third option first, never half a sentence. The authored premises are never dropped or cut (revision (ar)).
  while (words() > OPEN_ANSWER_MAX_WORDS && d.options.length > 2) { d.options.pop(); note("words_item"); }
  for (let guard = 0; guard < 80 && words() > OPEN_ANSWER_MAX_WORDS; guard++) {
    const fields: { len: number; set: (n: number) => void }[] = [
      ...d.facts.map((f) => ({ len: wordCount(f.text), set: (n: number) => { f.text = cutWords(f.text, n); } })),
      ...d.options.map((o) => ({ len: wordCount(o.tradeoffs), set: (n: number) => { o.tradeoffs = cutWords(o.tradeoffs, n); } })),
      ...(d.inference ? [{ len: wordCount(d.inference), set: (n: number) => { d.inference = cutWords(d.inference!, n); } }] : []),
      ...d.questionsForYou.map((q, i) => ({ len: wordCount(q), set: (n: number) => { d.questionsForYou[i] = cutWords(q, n); } })),
    ];
    if (fields.length === 0) break;
    const longest = fields.reduce((a, b) => (b.len > a.len ? b : a));
    if (longest.len <= 4) break;
    longest.set(Math.max(4, Math.floor(longest.len * 0.8)));
    note("words");
  }
  return { answer: d, tagTimes, trimmed };
}
