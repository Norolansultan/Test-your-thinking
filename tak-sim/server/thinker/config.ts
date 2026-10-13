/**
 * Thinker's fixed treatment (SPEC/14 revision (q)): the pinned model, its settings, the versioned
 * system prompt and the file locations. The build step (`npm run thinker:index`) writes these into
 * `content/thinker/manifest.json`; the server refuses to start if the prompt no longer matches it.
 *
 * "temperature 0" (SPEC/14 revision (q)) is sent as `temperature: 0` (`model.ts`). Even so the
 * wording can vary between calls; it is logged in full.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const repoPath = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

// 8 Oct 2026 live test: gemini-3.8-flash answered 2 of 12 calls (Google 503 "high demand", 20 s timeouts,
// MAX_TOKENS cut-offs: it spends the output budget on thinking even with thinkingBudget 0); the researcher chose to
// switch model. gemini-2.5-flash/-pro return 404 to new keys; a probe of the callable Flash models picked
// gemini-3.5-flash (3/3 calls, ~1.4 s, honours the thinking budget).
export const THINKER_MODEL_ID = "gemini-3.5-flash";
export const THINKER_MAX_TOKENS = 2000;
/**
 * The Open Thinker's output cap. Revision (ah), 9 Oct 2026: the answer may be up to 150 words (researcher);
 * Finnish runs about 2.5–3 tokens a word and the [T#, hh.mm] citations add more, so 320 (D2, ~110 words)
 * cut every Finnish answer in the 9 Oct review (finishReason MAX_TOKENS, 4/4). 1024 holds 150 Finnish
 * words with citations and a margin for overshoot; the prompt asks for no more than 150 words.
 */
export const THINKER_OPEN_MAX_TOKENS = 1536;
/**
 * Revision (aq), 11 Oct 2026: the Open Thinker answers in JSON (structured output), whose keys and
 * brackets cost tokens the plain text did not; the 150-word limit is enforced by the proxy
 * (`open-answer.ts`), not by this cap. A reply that is not valid JSON (cut off or malformed) is asked for
 * once more, identically, if less than this much of the time has passed; then "unavailable".
 */
export const THINKER_OPEN_PARSE_RETRIES = 1;
export const THINKER_OPEN_PARSE_RETRY_MAX_ELAPSED_MS = 12_000;
/** The model's internal reasoning budget, in tokens. 0 turns thinking off: it counted against the output cap and the 20 s timeout. */
export const THINKER_THINKING_BUDGET = 0;

export const PROMPT_FILE = "server/thinker/prompt.fi.md";
/** The English session's system prompt (same instructions, same answer fields; `app/i18n/lang.ts`). */
export const PROMPT_FILE_EN = "server/thinker/prompt.en.md";
/**
 * The strategy-guided variant (cell `reasoning_intent`, V8–V14; phase B round 2, D2): the same rules
 * plus the fifth field `linjaus`. DRAFT, for native and domain review. The directive itself is not
 * in the file: the server appends it from the scenario (`withDirective`, `model.ts`).
 */
export const PROMPT_FILE_INTENT = "server/thinker/prompt.intent.fi.md";
export const PROMPT_FILE_INTENT_EN = "server/thinker/prompt.intent.en.md";
/**
 * The Open Thinker (researcher, 8 Oct 2026): the AI group's free chat (`/api/thinker-open`), plain
 * text with the conversation's history; may recommend. Frozen like the others (F3): hashed into the
 * manifest (`promptOpen`, `promptOpenEn`), and the server refuses to start on a mismatch.
 */
export const PROMPT_FILE_OPEN = "server/thinker/prompt-open.fi.md";
export const PROMPT_FILE_OPEN_EN = "server/thinker/prompt-open.en.md";
/**
 * Revision (al), 10 Oct 2026 (review panel, clean manipulation): one Open Thinker prompt per cell.
 * `prompt-open.*.md` is the `reasoning_intent` cell's (the order block at its end, rule 5 relates the
 * options to the directive); `prompt-open.once.*.md` is the `reasoning_once` cell's: no order block,
 * rule 5 says the directive is in the banner and the message log (as Search's rule 4). Both frozen and
 * hashed in the manifest (`promptOpen*`, `promptOpenOnce*`).
 */
export const PROMPT_FILE_OPEN_ONCE = "server/thinker/prompt-open.once.fi.md";
export const PROMPT_FILE_OPEN_ONCE_EN = "server/thinker/prompt-open.once.en.md";
/** What the manifest says about the Open Thinker prompts, besides their hashes (`build-index.ts`). */
export const OPEN_PROMPT_NOTE = {
  usedFor: "the Open Thinker of cell reasoning_intent (Thinker tab, main views): free chat with history; the server appends the order block (P2's opening intent before V8, the directive from V8) — revision (al)",
  output: "structured JSON (revision (aq), 11 Oct 2026: kind, facts, premises, options with verdicts, inference, questionsForYou; the server limits it to 150 words and renders the display text); history of at most 10 alternating turns starting with the participant's",
} as const;
/** The `reasoning_once` cell's Open Thinker prompt (revision (al)): the same rules but rule 5, no order block. */
export const OPEN_ONCE_PROMPT_NOTE = {
  usedFor: "the Open Thinker of cell reasoning_once (Thinker tab, main views) and of both Thinker cells in VP (revision (am)): free chat with history; no order block; rule 5 points to the message log (and, once a directive is issued, the banner) and gives a first-person sentence — revisions (al), (an)",
  output: "structured JSON (revision (aq), 11 Oct 2026: as the reasoning_intent cell's but no premises and no verdicts); history of at most 10 alternating turns starting with the participant's",
} as const;
/**
 * Revision (al): a fixed sampling seed sent with every model call (Gemini's `seed`: "best effort to
 * provide the same response for repeated requests"). With temperature 0 it narrows, not removes, the
 * variation between identical requests.
 */
export const THINKER_SEED = 20261010;
/** Revision (al): one identical retry on HTTP 429 / 503 (or RESOURCE_EXHAUSTED / UNAVAILABLE), inside the same timeout. */
export const THINKER_MAX_RETRIES = 1;
/** A retry is not started with less than this left of the call's timeout. */
export const THINKER_RETRY_MIN_REMAINING_MS = 3000;
/** What the manifest says about the strategy-guided prompts, besides their hashes (`build-index.ts`). */
export const INTENT_PROMPT_NOTE = {
  usedFor: "cell reasoning_intent, views V8-V14 (phase B round 2, D2)",
  directive: "appended by the server from the scenario's hinge.intentStatement (English from labels.en.json), not part of the hash",
  status: "DRAFT, for native and domain review",
} as const;
/** The manifest's description of the structured output. */
export const THINKER_OUTPUT_NOTE = "Haku (/api/thinker): structured JSON vastaus, perusteet, varmuus, muuttaisi (a fifth field, linjaus, was withdrawn 8 Oct 2026; old logs may carry it). Open Thinker (/api/thinker-open): structured JSON since revision (aq), 11 Oct 2026 (kind, facts, premises, options, inference, questionsForYou), rendered to text by the proxy; plain text before";
export const MANIFEST_FILE = "content/thinker/manifest.json";
export const INDEX_FILE = "content/thinker/index.json";
export const AUTHORED_QUERIES_FILE = "content/thinker/authored-queries.json";
/**
 * The English retrieval files (SPEC/14 revision (v)): vectors of the English passages, and the
 * English authored questions' query vectors. Built by `npm run thinker:index` (needs the model).
 */
export const INDEX_FILE_EN = "content/thinker/index.en.json";
export const AUTHORED_QUERIES_FILE_EN = "content/thinker/authored-queries.en.json";

/** The index file of a retrieval language. */
export const indexFileOf = (lang: "fi" | "en") => (lang === "en" ? INDEX_FILE_EN : INDEX_FILE);

/**
 * The proxy's mode (SPEC/14 revision (v)). `study`: every treatment the study can request must be
 * the declared one, so a missing or unfrozen English index refuses to start. `demo` (the default):
 * an English question without the English index is answered over the Finnish index and says so
 * (`retrievalMode: "hybrid_fi_fallback"`). Set by `--study` or `THINKER_MODE=study`.
 */
export type ThinkerServerMode = "study" | "demo";

export function serverModeOf(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): ThinkerServerMode {
  return argv.includes("--study") || env["THINKER_MODE"] === "study" ? "study" : "demo";
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Line endings are normalised to LF before hashing, so a CRLF checkout keeps the same hash. */
export function normaliseNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export interface SystemPrompt {
  readonly text: string;
  readonly sha256: string;
}

/** A prompt's kind: the structured Haku chat's (`standard`), the withdrawn strategy-guided one, or the Open Thinker's of `reasoning_intent` (`open`) or `reasoning_once` (`open_once`). */
export type PromptKind = "standard" | "intent" | "open" | "open_once";

/** The prompt file of a language and kind. */
export function promptFileOf(lang: "fi" | "en", variant: PromptKind): string {
  if (variant === "open") return lang === "en" ? PROMPT_FILE_OPEN_EN : PROMPT_FILE_OPEN;
  if (variant === "open_once") return lang === "en" ? PROMPT_FILE_OPEN_ONCE_EN : PROMPT_FILE_OPEN_ONCE;
  if (variant === "intent") return lang === "en" ? PROMPT_FILE_INTENT_EN : PROMPT_FILE_INTENT;
  return lang === "en" ? PROMPT_FILE_EN : PROMPT_FILE;
}

export function loadSystemPrompt(lang: "fi" | "en" = "fi", variant: PromptKind = "standard"): SystemPrompt {
  const text = normaliseNewlines(readFileSync(repoPath(promptFileOf(lang, variant)), "utf8"));
  return { text, sha256: sha256Hex(text) };
}

/** The four-part template as a structured-output schema (SPEC/14 revision (g)). */
export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    vastaus: { type: "string" },
    perusteet: { type: "string" },
    varmuus: { type: "string" },
    muuttaisi: { type: "string" },
  },
  required: ["vastaus", "perusteet", "varmuus", "muuttaisi"],
  additionalProperties: false,
} as const;

/** The strategy-guided variant's schema (D2): the four parts plus `linjaus { tila, perustelu }`. */
export const ANSWER_SCHEMA_INTENT = {
  type: "object",
  properties: {
    ...ANSWER_SCHEMA.properties,
    linjaus: {
      type: "object",
      properties: {
        tila: { type: "string", enum: ["sopii", "ei_sovi", "ei_liity"] },
        perustelu: { type: "string" },
      },
      required: ["tila", "perustelu"],
      additionalProperties: false,
    },
  },
  required: [...ANSWER_SCHEMA.required, "linjaus"],
  additionalProperties: false,
} as const;
