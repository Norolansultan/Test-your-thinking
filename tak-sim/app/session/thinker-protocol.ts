/**
 * The Thinker proxy's wire protocol (SPEC/14 revision (q), SPEC/05 revision (q)), shared by the
 * browser (`queries.ts`, `thinker-transport.ts`) and the server (`server/thinker/`). The browser
 * sends the question, the view, the virtual time and the cell — never records, never the strategy
 * text; the server recomputes the time-gated candidates.
 *
 * Haku / Open Thinker redesign (researcher, 8 Oct 2026): `/api/thinker` is the Haku tab's structured
 * chat for EVERY cell (radio included) and every view, the practice view included, always with the
 * standard prompt: no strategy-guided variant, no `linjaus` (both kept in the types for old logs).
 * `/api/thinker-open` is the Open Thinker: the AI condition's (Thinker cells') free chat with
 * history, main views — and since revision (am), 10 Oct 2026, the practice view (the Thinker practice:
 * no order block in either cell, no verdict coded). {@link validateThinkerRequest} takes the endpoint.
 */

import type { RenderableAtom } from "../boundary/render-boundary.js";
import type { Cell } from "../scenario/types.js";
import { HINGE_AFTER_VIEW, MAIN_VIEW_COUNT, PRACTICE_VIEW_INDEX } from "../scenario/views.js";
import { NAV_RESPONSE_DELAY_MS } from "../retrieval/navigation.js";
import { buildTemplateAnswer } from "./template-answer.js";
import type { OpenStructuredView } from "./open-answer.js";

export const THINKER_ENDPOINT = "/api/thinker";
export const THINKER_OPEN_ENDPOINT = "/api/thinker-open";
export const THINKER_MAX_QUESTION_CHARS = 500;
/** The Open Thinker's history (F2): at most this many turns, alternating, the participant's first. */
export const OPEN_THINKER_MAX_HISTORY = 10;
/** A model turn in the history is at most this long (F2); the browser cuts longer answers to it. */
export const OPEN_THINKER_MAX_MODEL_TURN_CHARS = 4000;
/**
 * The `modelId` (and the proxy log's `modelVersion`) of an answer from the published demonstration's page-side bridge
 * (`tools/demo-bridge/`): Claude answered in the page, on the viewer's own account, not the study's proxy. Never study data:
 * the browser refuses such an answer in the study (`?tuotanto`, `thinker-transport.ts`), and the study proxy's model pin is unchanged.
 */
export const DEMO_BRIDGE_MODEL_ID = "claude-demo-bridge";
/** A request body's byte limit: Haku's chat (question only) and the Open Thinker (with its history, F2's caps in UTF-8). */
export const THINKER_MAX_BODY_BYTES = 16 * 1024;
export const OPEN_THINKER_MAX_BODY_BYTES = 64 * 1024;
/** SPEC/14 revision (q) step 5, SPEC/25 §4: an answer is never shown sooner (the Haku delay). */
export const THINKER_LATENCY_FLOOR_MS = NAV_RESPONSE_DELAY_MS;
/** SPEC/14 revision (q) step 6: the model call's timeout, on the server. */
export const THINKER_MODEL_TIMEOUT_MS = 20_000;
/**
 * The browser's own timeout: the server's 20 s plus a margin for retrieval and transport, so a
 * server-side timeout arrives as the server's fallback rather than racing the browser's.
 */
export const THINKER_CLIENT_TIMEOUT_MS = 25_000;

/**
 * The fifth field's status (phase B round 2, D2): the model's assessment of whether the situation the
 * retrieved records describe fits the directive in force — `sopii` / `ei_sovi` / `ei_liity` — or
 * `ei_arvioitu` when no model answered (the deterministic fallback). It is never a recommendation.
 */
export type LinjausModelStatus = "sopii" | "ei_sovi" | "ei_liity";
export type LinjausStatus = LinjausModelStatus | "ei_arvioitu";
export const LINJAUS_MODEL_STATUSES: readonly LinjausModelStatus[] = ["sopii", "ei_sovi", "ei_liity"];
export const LINJAUS_STATUSES: readonly LinjausStatus[] = [...LINJAUS_MODEL_STATUSES, "ei_arvioitu"];

export interface ThinkerLinjaus {
  readonly tila: LinjausStatus;
  /** One sentence: which recorded fact (source, time) makes the situation fit or not fit; "—" in the fallback. */
  readonly perustelu: string;
}

/**
 * The four-part template of SPEC/14 revision (g): Vastaus · Perusteet · Varmuus · Mikä muuttaisi tätä.
 * The strategy-guided variant (cell `reasoning_intent`, V8–V14) adds the fifth field `linjaus`.
 */
export interface ThinkerAnswer {
  readonly vastaus: string;
  readonly perusteet: string;
  readonly varmuus: string;
  readonly muuttaisi: string;
  readonly linjaus?: ThinkerLinjaus;
}

/** Which chat a request is for: Haku's structured chat (`/api/thinker`) or the Open Thinker (`/api/thinker-open`). */
export type ThinkerTool = "haku" | "open_thinker";

/** The two Thinker cells (SPEC/02 revisions (f)/(j); phase B round 2, D1): the Open Thinker's cells. */
export type ThinkerCell = Extract<Cell, "reasoning_once" | "reasoning_intent">;
export const THINKER_CELLS: readonly ThinkerCell[] = ["reasoning_once", "reasoning_intent"];

/** Which system prompt answered: the four-part one, or the strategy-guided one with `linjaus`. */
export type ThinkerPromptVariant = "standard" | "intent";

/** The first view of phase B: the directive is in force from here (the hinge is after V7). */
export const STRATEGY_FROM_VIEW = HINGE_AFTER_VIEW + 1;

/**
 * D2 (phase B round 2), WITHDRAWN 8 Oct 2026: the strategy-guided prompt ran for the `reasoning_intent`
 * cell from V8 on. Kept to read old logs and the frozen prompt; no request is answered with it now.
 */
export function thinkerPromptVariant(cell: ThinkerCell, view: number): ThinkerPromptVariant {
  return cell === "reasoning_intent" && view >= STRATEGY_FROM_VIEW ? "intent" : "standard";
}

/** The deterministic fifth field when no model answered (D2): `ei_arvioitu`. */
export const LINJAUS_NOT_ASSESSED: ThinkerLinjaus = { tila: "ei_arvioitu", perustelu: "—" };

export interface ThinkerRequest {
  readonly sessionId: string;
  /** The session's condition; it must agree with the cell (`radio` is `directed`). */
  readonly condition: "directed" | "substitutive";
  /** 0 = the practice view (Haku chat only), 1–14 the main views. */
  readonly view: number;
  readonly virtualTimeS: number;
  readonly question: string;
  /** The participant's cell: any for Haku's chat, a Thinker cell for the Open Thinker. Checked against the allocation table. */
  readonly cell: Cell;
  /** The session language (`app/i18n/lang.ts`); absent means Finnish. The answer comes in this language. */
  readonly language?: "fi" | "en";
  /**
   * The allocation table's participant code, sent when the cell came from the table (SPEC/27 §2.2,
   * 5 Oct 2026). The server then checks `cell` against the table's row for the code and refuses a
   * mismatch, so an edited client cannot receive the other Thinker cell's treatment under a table code.
   */
  readonly participantCode?: string;
  /** The Open Thinker's history (F2: at most 10 alternating turns, the participant's first); never on `/api/thinker`. */
  readonly history?: readonly OpenThinkerTurnWire[];
  /**
   * Revision (al), 10 Oct 2026: the browser's id of the question (`ai_chat_query_submitted.queryId`,
   * "ai.3" / "ai_open.4"), logged on the server too, so the two logs join on it. Optional (older clients).
   */
  readonly queryId?: string;
}

export interface OpenThinkerTurnWire {
  readonly role: "user" | "model";
  readonly text: string;
}

export type ThinkerFallbackReason =
  | "no_api_key"
  | "refusal"
  | "truncated"
  | "invalid_output"
  | "timeout"
  | "rate_limited"
  | "auth_error"
  | "connection_error"
  | "api_error"
  | "client_timeout"
  | "network_error";

/** How retrieval ran (SPEC/14 revisions (q) and (v)). */
export type ThinkerRetrievalMode = "hybrid" | "lexical_only" | "hybrid_fi_fallback";

export interface RetrievedId {
  readonly id: string;
  readonly score: number;
}

export interface ThinkerResponse {
  readonly answer: ThinkerAnswer;
  readonly retrieved: readonly RetrievedId[];
  readonly modelId: string;
  readonly promptHash: string;
  readonly latencyMs: number;
  readonly fallback: boolean;
  readonly fallbackReason: ThinkerFallbackReason | null;
  /**
   * "hybrid", or "lexical_only" when no query vector could be computed (the browser's local
   * fallback). "hybrid_fi_fallback" (demonstration only, SPEC/14 revision (v)): an English question
   * retrieved with the whole Finnish treatment because the English index is not built.
   */
  readonly retrievalMode: ThinkerRetrievalMode;
  /** The language retrieval ran in (passages, tokeniser, index); absent from an older proxy: Finnish. */
  readonly retrievalLanguage?: "fi" | "en";
  /** The refusal category from `stop_details`, when `fallbackReason` is "refusal". */
  readonly refusalCategory?: string | null;
  /** Which prompt answered (or would have, for a fallback): `intent` answers carry `answer.linjaus`. */
  readonly promptVariant: ThinkerPromptVariant;
  /**
   * SPEC/31 §3.6 (format 0.11.0, parity P-2): the ids of the records the proxy put in the model's context without a search — the Open
   * Thinker's digest of the step's latest records (always empty on Haku's chat, which has none) and both chats' best matches among the
   * current step's records (`recent`). The browser logs them on `ai_chat_answer_received` so exposure is computed from its own log; the
   * proxy's log already has them (`digest`, `recent`) and is unchanged. Absent from an older proxy and from the browser's local fallback.
   */
  readonly digestAtomIds?: readonly string[];
  readonly recentAtomIds?: readonly string[];
}

export interface OpenThinkerResponse extends Omit<ThinkerResponse, "answer"> {
  /** The display text: since revision (aq) the proxy's deterministic rendering of `structured` (`renderOpenAnswer`); history and the browser's log keep this text. */
  readonly answer: string;
  /**
   * Revision (aq), 11 Oct 2026: the structured answer the text was rendered from (kind, facts, premises,
   * options with verdicts, inference, questions, and the time of each tag cited). Absent from an older
   * proxy and from a fallback; the browser then draws `answer`.
   */
  readonly structured?: OpenStructuredView | null;
  /**
   * D6 (8 Oct 2026): the Open Thinker's fit verdict on the directive, extracted from the text by {@link aiVerdictOf}; absent from an older proxy.
   * Revision (al): kept for back-compatibility only — the earliest phrase decides, so it is not the analysis value; use `verdicts`.
   */
  readonly verdict?: AiVerdict | null;
  /**
   * Revision (al), 10 Oct 2026: the verdict of each option; null where no verdict is coded (phase A, withdrawal/evacuation, a lookup, a fallback).
   * Revision (aq): read from the options' `verdict` fields (`verdictsOfOptions`; `line` is the option's index, a justified departure is `departs` here and exact in the proxy's log);
   * {@link aiVerdictsOf} (regex over the text) is kept for logs written before (aq).
   */
  readonly verdicts?: readonly OptionVerdict[] | null;
}

/** Revision (al): one line of an Open Thinker answer that states a verdict, and the verdict it ends on. */
export interface OptionVerdict {
  /** The line's index in the answer (0-based, blank lines counted). */
  readonly line: number;
  readonly verdict: AiVerdict;
  /** The line's first 120 characters, for reading the log. */
  readonly text: string;
}

/** The Open Thinker's verdict on a plan option against the directive (D1, D6): in line, departs, or "the directive does not cover it". */
export type AiVerdict = "in_line" | "departs" | "not_covered";

const VERDICT_PATTERNS: Readonly<Record<"fi" | "en", Readonly<Record<AiVerdict, RegExp>>>> = {
  en: {
    not_covered: /\b(?:does not|doesn['’]t|do not)(?: \w+)? (?:cover|address|apply)\b|\bnot covered\b|\bnot (?:a|one of the) plan options?\b|\boutside (?:the )?(?:plan|directive)\b/i,
    departs: /\bdeparts?\b|\bdeparting from\b|\bdeparture\b|\bdeviat\w*|\bnot (?:in line|aligned|consistent)\b|\bdiffers? from\b|\bruns? counter\b/i,
    in_line: /(?<!not )\bin line\b|(?<!not )\bconsistent with\b|(?<!not )\baligne?[ds] with\b|\bfits? (?:the )?directive\b|\bfollows? the directive\b/i,
  },
  fi: {
    not_covered: /linjaus ei (?:koske|kata|ota kantaa)|ei ole suunnitelman vaihtoehto|ei kuulu suunnitelman|\bei katettu\b/i,
    departs: /poikkea\w*|poikkeam\w*|ei ole linjassa|ei ole linjauksen mukai\w*|eroaa linjauksesta/i,
    in_line: /(?<!ei ole )\blinjassa\b|(?<!ei ole )linjauksen mukai\w*|sopii linjaukseen/i,
  },
};

/** Questions about withdrawing crews or evacuating residents: the Open Thinker gives no verdict on them. */
const SAFETY_QUESTION: Readonly<Record<"fi" | "en", RegExp>> = {
  en: /\b(?:withdraw\w*|evacuat\w*|retreat\w*|pull(?:ing)? back)\b/i,
  fi: /vetäyty\w*|vetäyd\w*|vetää\w* pois|evakuoi\w*|evakuoitava\w*/i,
};

/**
 * D6 (8 Oct 2026): the verdict of an Open Thinker answer, extracted deterministically (no model
 * call): the earliest verdict phrase in the text decides; no phrase, or a withdrawal/evacuation question (when `question` is given), gives null.
 */
export function aiVerdictOf(answerText: string, lang: "fi" | "en", question?: string): AiVerdict | null {
  if (question !== undefined && SAFETY_QUESTION[lang].test(question)) return null; // the hard stop: no verdict on withdrawal or evacuation
  let best: { verdict: AiVerdict; at: number } | null = null;
  for (const verdict of ["not_covered", "departs", "in_line"] as const) {
    const m = VERDICT_PATTERNS[lang][verdict].exec(answerText);
    if (m && (best === null || m.index < best.at)) best = { verdict, at: m.index };
  }
  return best ? best.verdict : null;
}

/** Revision (ao): the Open Thinker's premise check line (rule 5), in either language, with or without a list marker. */
const PREMISE_LINE = /^\s*(?:[-*•]\s*)?(?:premises?|premise check|lähtöoletukset)\s*:/i;

/**
 * Revision (al), 10 Oct 2026 (logging only; the analysis value that replaces {@link aiVerdictOf}): the
 * verdict of each option line. The prompt asks for one option per line with the verdict last ("departs
 * from the method, if [record] holds"), so each line that carries a verdict phrase is coded by its
 * LAST phrase; lines without one are skipped. A withdrawal or evacuation question (when `question` is
 * given) gives null. Deterministic, the same patterns as `aiVerdictOf`; a screen, not a judgement.
 * Revision (ao): the premise check line ("Premises:" / "Lähtöoletukset:", rule 5) is not an option line
 * and is skipped; its "a departure … can be justified" is not a verdict on an option.
 */
export function aiVerdictsOf(answerText: string, lang: "fi" | "en", question?: string): OptionVerdict[] | null {
  if (question !== undefined && SAFETY_QUESTION[lang].test(question)) return null;
  const out: OptionVerdict[] = [];
  answerText.split(/\r?\n/).forEach((line, index) => {
    if (PREMISE_LINE.test(line)) return;
    let last: { verdict: AiVerdict; at: number } | null = null;
    for (const verdict of ["not_covered", "departs", "in_line"] as const) {
      for (const m of line.matchAll(new RegExp(VERDICT_PATTERNS[lang][verdict].source, "gi"))) {
        if (last === null || m.index > last.at) last = { verdict, at: m.index };
      }
    }
    if (last) out.push({ line: index, verdict: last.verdict, text: line.trim().slice(0, 120) });
  });
  return out;
}

/**
 * The deterministic template answer over retrieved records, in the wire shape (SPEC/14 revision (q)
 * step 6). For the strategy-guided variant it carries `linjaus` `ei_arvioitu` (D2).
 */
export function templateThinkerAnswer(records: readonly RenderableAtom[], lang: "fi" | "en" = "fi", variant: ThinkerPromptVariant = "standard"): ThinkerAnswer {
  const t = buildTemplateAnswer(records, lang);
  const four = { vastaus: t.answerFi, perusteet: t.basisFi, varmuus: t.certaintyFi, muuttaisi: t.wouldChangeIfFi };
  return variant === "intent" ? { ...four, linjaus: LINJAUS_NOT_ASSESSED } : four;
}

const SESSION_ID = /^[A-Za-z0-9._-]{1,64}$/;

export type ValidationResult = { readonly ok: true; readonly request: ThinkerRequest } | { readonly ok: false; readonly error: string };

const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];

/** The history's problem (F2), or null: an array of at most 10 turns, alternating, the participant's first, each within its cap. */
function historyError(history: unknown): string | null {
  if (!Array.isArray(history)) return "invalid history";
  if (history.length > OPEN_THINKER_MAX_HISTORY) return `history longer than ${OPEN_THINKER_MAX_HISTORY} turns`;
  for (const [i, h] of history.entries()) {
    if (typeof h !== "object" || h === null) return "invalid history item";
    const { role, text } = h as Record<string, unknown>;
    if (role !== (i % 2 === 0 ? "user" : "model")) return "history roles must alternate, the participant's first";
    if (typeof text !== "string") return "invalid history text";
    const cap = role === "user" ? THINKER_MAX_QUESTION_CHARS : OPEN_THINKER_MAX_MODEL_TURN_CHARS;
    if (text.length > cap) return `history turn longer than ${cap} characters`;
  }
  return null;
}

/**
 * Validates a request body at the proxy boundary, for its endpoint (`tool`). Haku's chat: any cell,
 * any view including the practice view (0), no history. The Open Thinker: a Thinker cell in the AI
 * condition, any view (revision (am): the practice view 0 too, for the Thinker practice), and a history
 * within F2's limits. Both: the condition agrees with the cell,
 * the question is 1-500 characters, and the session id is restricted to a safe charset (it names the
 * log file). The cell is required: a request without one must not silently receive another's treatment.
 */
export function validateThinkerRequest(body: unknown, tool: ThinkerTool = "haku"): ValidationResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.sessionId !== "string" || !SESSION_ID.test(b.sessionId)) return { ok: false, error: "invalid sessionId" };
  if (b.condition !== "directed" && b.condition !== "substitutive") return { ok: false, error: "invalid condition" };
  if (tool === "open_thinker" && b.condition !== "substitutive") return { ok: false, error: "the Open Thinker is available only in the AI condition" };
  if (typeof b.view !== "number" || !Number.isInteger(b.view) || b.view < PRACTICE_VIEW_INDEX || b.view > MAIN_VIEW_COUNT) return { ok: false, error: "invalid view" };
  if (typeof b.virtualTimeS !== "number" || !Number.isFinite(b.virtualTimeS)) return { ok: false, error: "invalid virtualTimeS" };
  if (typeof b.question !== "string" || b.question.trim().length === 0) return { ok: false, error: "empty question" };
  if (b.language !== undefined && b.language !== "fi" && b.language !== "en") return { ok: false, error: "invalid language" };
  const cells: readonly Cell[] = tool === "haku" ? CELLS : THINKER_CELLS;
  if (!cells.includes(b.cell as Cell)) return { ok: false, error: "invalid cell" };
  if ((b.cell === "radio") !== (b.condition === "directed")) return { ok: false, error: "cell does not match the condition" };
  if (b.participantCode !== undefined && (typeof b.participantCode !== "string" || !SESSION_ID.test(b.participantCode))) return { ok: false, error: "invalid participantCode" };
  if (b.queryId !== undefined && (typeof b.queryId !== "string" || !SESSION_ID.test(b.queryId))) return { ok: false, error: "invalid queryId" };
  if (b.question.length > THINKER_MAX_QUESTION_CHARS) return { ok: false, error: `question longer than ${THINKER_MAX_QUESTION_CHARS} characters` };
  if (b.history !== undefined) {
    if (tool === "haku") return { ok: false, error: "Haku's chat takes no history" };
    const problem = historyError(b.history);
    if (problem) return { ok: false, error: problem };
  }
  return {
    ok: true,
    request: {
      sessionId: b.sessionId, condition: b.condition, view: b.view, virtualTimeS: b.virtualTimeS, question: b.question, cell: b.cell as Cell,
      ...(b.language !== undefined ? { language: b.language as "fi" | "en" } : {}),
      ...(b.participantCode !== undefined ? { participantCode: b.participantCode as string } : {}),
      ...(b.queryId !== undefined ? { queryId: b.queryId as string } : {}),
      ...(b.history !== undefined ? { history: (b.history as OpenThinkerTurnWire[]).map(({ role, text }) => ({ role, text })) } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// SPEC/32 §3 (20 Oct 2026): the plan review's premise lookup (the guide cell only, no model call)
// ---------------------------------------------------------------------------

/** The guide group's premise lines at the plan review (`server/thinker/premise-review.ts`). */
export const PREMISE_REVIEW_ENDPOINT = "/api/thinker/premise-review";
/** The browser's timeout for the lookup (SPEC/32 §3): a table lookup, so a few seconds; on a timeout the neutral review shows. */
export const PREMISE_REVIEW_CLIENT_TIMEOUT_MS = 4_000;
/** The only cell the lookup answers: the guide group (SPEC/32 §3). */
export const PREMISE_REVIEW_CELL: ThinkerCell = "reasoning_intent";

export interface PremiseReviewRequest {
  readonly sessionId: string;
  /** Must be {@link PREMISE_REVIEW_CELL}; any other cell is refused (HTTP 400). */
  readonly cell: Cell;
  /** A phase-B view, V8–V14 (the directive in force). */
  readonly view: number;
  /** The session's virtual time when the review opened; the server time-gates and reads the records clock at it. */
  readonly virtualTimeS: number;
  readonly language?: "fi" | "en";
  /** The allocation table's code, for a table-assigned session (SPEC/27 §2.2): the cell is checked against the table. */
  readonly participantCode?: string;
}

/** One premise's status as the lookup returns it (the premise-evidence table's at the records clock). */
export interface PremiseReviewStatus {
  readonly premiseId: string;
  readonly status: "contradicted" | "not_contradicted";
  readonly atomIds: readonly string[];
}

export interface PremiseReviewResponse {
  /** The fixed template's lines (`premiseLines`), in the request's language. */
  readonly lines: readonly string[];
  readonly statuses: readonly PremiseReviewStatus[];
  /** The premise-evidence table's sha256 (the manifest's `premiseEvidence.sha256`). */
  readonly tableSha256: string;
}

export type PremiseReviewValidation = { readonly ok: true; readonly request: PremiseReviewRequest } | { readonly ok: false; readonly error: string };

/** Validates a premise-review body at the proxy boundary: the guide cell only, a phase-B view, a finite virtual time. */
export function validatePremiseReviewRequest(body: unknown): PremiseReviewValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.sessionId !== "string" || !SESSION_ID.test(b.sessionId)) return { ok: false, error: "invalid sessionId" };
  if (b.cell !== PREMISE_REVIEW_CELL) return { ok: false, error: `the premise review is for the ${PREMISE_REVIEW_CELL} cell only` };
  if (typeof b.view !== "number" || !Number.isInteger(b.view) || b.view < STRATEGY_FROM_VIEW || b.view > MAIN_VIEW_COUNT) return { ok: false, error: "invalid view (V8–V14 only)" };
  if (typeof b.virtualTimeS !== "number" || !Number.isFinite(b.virtualTimeS)) return { ok: false, error: "invalid virtualTimeS" };
  if (b.language !== undefined && b.language !== "fi" && b.language !== "en") return { ok: false, error: "invalid language" };
  if (b.participantCode !== undefined && (typeof b.participantCode !== "string" || !SESSION_ID.test(b.participantCode))) return { ok: false, error: "invalid participantCode" };
  return {
    ok: true,
    request: {
      sessionId: b.sessionId, cell: PREMISE_REVIEW_CELL, view: b.view, virtualTimeS: b.virtualTimeS,
      ...(b.language !== undefined ? { language: b.language as "fi" | "en" } : {}),
      ...(b.participantCode !== undefined ? { participantCode: b.participantCode as string } : {}),
    },
  };
}

/** The browser's check of a lookup's reply: lines are strings, statuses {premiseId, status, atomIds}, the table's hash a hex string. Null: well formed. */
export function premiseReviewResponseProblem(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "not an object";
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.lines) || !b.lines.every((l) => typeof l === "string")) return "lines is not an array of strings";
  if (!Array.isArray(b.statuses)) return "statuses is not an array";
  for (const s of b.statuses as unknown[]) {
    if (typeof s !== "object" || s === null) return "a status is not an object";
    const { premiseId, status, atomIds } = s as Record<string, unknown>;
    if (typeof premiseId !== "string" || (status !== "contradicted" && status !== "not_contradicted")) return "a status lacks premiseId or status";
    if (!Array.isArray(atomIds) || !atomIds.every((a) => typeof a === "string")) return "a status's atomIds is not an array of ids";
  }
  if (typeof b.tableSha256 !== "string" || !/^[0-9a-f]{64}$/.test(b.tableSha256)) return "tableSha256 is not a sha256";
  return null;
}
