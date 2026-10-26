/**
 * One Thinker request, end to end (SPEC/14 revision (q) pipeline): validate, time-gate (recomputed
 * here from the view and virtual time — records from the client are never trusted), retrieve,
 * generate or fall back, log one JSON line, respond. Transport-free, so tests call it directly.
 *
 * Haku / Open Thinker redesign (researcher, 8 Oct 2026): `/api/thinker` is Haku's structured chat
 * for every cell (radio included) and every view including the practice view, always with the
 * standard prompt — the strategy-guided variant (D2, `linjaus`) is withdrawn, its prompt kept frozen
 * for old logs. `/api/thinker-open` is the Open Thinker (AI condition, main views): its own frozen
 * prompt (`prompt-open.*.md`, F3), plain text, the conversation's history (F2), temperature 0.
 * Retrieval is the same for both. Revision (am), 10 Oct 2026: the Open Thinker answers the practice view
 * (VP) too, for the Thinker practice — in both Thinker cells with the `reasoning_once` prompt and no
 * order block, no verdict coded, its log line marked `practice: true`.
 *
 * Language (SPEC/14 revision (v)): the request's language picks the retrieval language — passages,
 * tokeniser and vector index ({@link retrievalRoute}). Without the English index an English request
 * is refused (HTTP 503) unless the deps allow the declared demonstration fallback to the whole
 * Finnish treatment, which the response and the log name (`hybrid_fi_fallback`). Never mixed.
 *
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp)): a Haku request with `corpus: "training"` (view 0) is the training incident's. It is answered
 * by the same path — prompt, answer checks, model call and fallbacks — over the training's own records only (`deps.training`), gated
 * by the training's one step and told the training's "now" (10.18), LEXICALLY ONLY (no vector, even with the indexes loaded: they cover
 * the session's passages only). The session's records are never candidates there, and the training's never in the session. The log
 * line carries `corpus` ("main" on every other line; "training" with `practice` false and `view` 0).
 */

import { toRenderable } from "../../app/boundary/render-boundary.js";
import { hybridRetrieve, roundVector, type Embedder, type RetrievalLang, type VectorIndex } from "../../app/retrieval/hybrid.js";
import { reachableAtoms, stepAtVirtualTime } from "../../app/retrieval/time-gate.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import {
  STRATEGY_FROM_VIEW, templateThinkerAnswer, validateThinkerRequest, type OpenThinkerResponse, type ThinkerCell, type ThinkerPromptVariant, type ThinkerRequest,
  type ThinkerResponse, type ThinkerRetrievalMode, type ThinkerTool,
} from "../../app/session/thinker-protocol.js";
import { tr } from "../../app/i18n/text.js";
import { citationIssuesOfStructured, directiveQuoted, historyTurnForModel, imperativeWordsIn, provenanceHashes } from "./answer-checks.js";
import { limitOpenAnswer, openAnswerSchemaFor } from "./open-answer.js";
import { loadDirectivePremises, type DirectivePremises } from "./directive-premises.js";
import { loadPremiseEvidence, premiseBlockStatuses, premiseCheck, premiseCheckShown, recordLookupOf, type PremiseEvidence } from "./premise-check.js";
import { guardModelVersion } from "./model-version.js";
import { renderOpenAnswer, verdictsOfOptions, wordCount } from "../../app/session/open-answer.js";
import { clockAt } from "../../app/session/template-answer.js";
import type { RetrievedRecord } from "../../app/retrieval/hybrid.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { assignmentOf, type AssignmentTable } from "../../app/session/assignment.js";
import { ALLOCATION_TABLE } from "../../app/session/preview.js";
import { rosterForView } from "../../app/scenario/allocation.js";
import { indexFileOf, sha256Hex, THINKER_MODEL_ID, type SystemPrompt } from "./config.js";
import type { ThinkerModelClient } from "./model-client.js";
import { ageReferenceOf, buildUserContent, callThinkerModel, callOpenThinkerModel, clockLineOf, latestDigest, openPlanContext, openSystemInstruction, receivedUpToOf, recentMatches, taggedAtoms } from "./model.js";

/**
 * Revision (bp): the training incident's corpus as the proxy holds it: its records (`trn.` ids, built from `content/training/` by
 * `app/session/training/corpus.ts`), its one world-state step (−9) and its "now" (−10 920 s, 10.18).
 */
export interface TrainingCorpus {
  readonly atoms: readonly InfoAtom[];
  readonly step: number;
  readonly nowS: number;
}

export interface ThinkerDeps {
  readonly scenario: ScenarioContract;
  /**
   * Revision (bp): the training's corpus (`createThinkerDeps` loads and checks it at startup). Absent or null: a training request is
   * refused (HTTP 503), never answered over the session's records.
   */
  readonly training?: TrainingCorpus | null;
  /** Null runs the lexical half alone (only with the server's explicit `--lexical-only`). The Finnish index. */
  readonly vector: { readonly embedder: Embedder; readonly index: VectorIndex } | null;
  /**
   * The English index (`content/thinker/index.en.json`, SPEC/14 revision (v)), with the same
   * embedder. Absent or null: not built. Ignored when `vector` is null (lexical-only).
   */
  readonly vectorEn?: { readonly embedder: Embedder; readonly index: VectorIndex } | null;
  /**
   * What an English request gets when `vectorEn` is absent and `vector` is not: `"refuse"` (the
   * default; HTTP 503) or `"fi_index"` — the demonstration fallback to the whole Finnish treatment,
   * logged as `retrievalMode: "hybrid_fi_fallback"`. A study-mode proxy never starts in that state.
   */
  readonly englishWithoutIndex?: "refuse" | "fi_index";
  readonly prompt: SystemPrompt;
  /** The English session's prompt (`prompt.en.md`); absent, an English request is answered with the Finnish prompt. */
  readonly promptEn?: SystemPrompt;
  /**
   * The strategy-guided prompt (`prompt.intent.fi.md`, D2). Absent, a request that needs it is an
   * error (HTTP 500): the other cell's treatment is never given silently.
   */
  readonly promptIntent?: SystemPrompt;
  /** Its English version (`prompt.intent.en.md`); absent, an English request uses the Finnish one. */
  readonly promptIntentEn?: SystemPrompt;
  /** The Open Thinker's prompt (`prompt-open.fi.md`, F3). Absent, an Open Thinker request is an error (HTTP 500). */
  readonly promptOpen?: SystemPrompt;
  /** Its English version (`prompt-open.en.md`); absent, an English request uses the Finnish one. */
  readonly promptOpenEn?: SystemPrompt;
  /**
   * Revision (al): the `reasoning_once` cell's Open Thinker prompt (`prompt-open.once.fi.md`; no order
   * block). Absent, a `reasoning_once` request is an error (HTTP 500): the other cell's prompt is never given silently.
   */
  readonly promptOpenOnce?: SystemPrompt;
  /** Its English version (`prompt-open.once.en.md`); absent, an English request uses the Finnish one. */
  readonly promptOpenOnceEn?: SystemPrompt;
  /**
   * Revision (ar), 11 Oct 2026: the directive's authored, frozen premises. Absent: read from `content/thinker/directive-premises.json`
   * (the real server checks the file against the manifest at startup, `createThinkerDeps`).
   */
  readonly directivePremises?: DirectivePremises;
  /**
   * SPEC/30 §3 (19 Oct 2026): the premise-evidence table (DRAFT, panel to confirm). Absent: read from `content/thinker/premise-evidence.json`
   * (the real server checks it against the manifest, the premises and the scenario at startup, `createThinkerDeps`).
   */
  readonly premiseEvidence?: PremiseEvidence;
  /** SPEC/30 §10: the pinned model build (`THINKER_EXPECTED_MODEL_VERSION`); unset or null: no pin. */
  readonly expectedModelVersion?: string | null;
  /** SPEC/30 §10: each session's first answer's model build, for `modelVersionChanged` (absent: kept per deps object). */
  readonly sessionModelVersions?: Map<string, string>;
  /** Null when GEMINI_API_KEY is unset: every answer is the template, `no_api_key`. The SDK client (`model-client.ts`). */
  readonly client: ThinkerModelClient | null;
  /** Appends one JSON line to the session's log. */
  readonly appendLog: (sessionId: string, line: Readonly<Record<string, unknown>>) => Promise<void>;
  /** A monotonic millisecond clock, for the latency. */
  readonly nowMs: () => number;
  /** Wall-clock ISO time for the log line. */
  readonly nowIso: () => string;
}

type Refused = { readonly status: 400 | 503; readonly body: { readonly error: string } };

export type ThinkerHandlerResult = { readonly status: 200; readonly body: ThinkerResponse } | Refused;

export type OpenThinkerHandlerResult = { readonly status: 200; readonly body: OpenThinkerResponse } | Refused;

/** How one request retrieves: the language, the index (null: lexical half alone) and the logged mode. */
export type RetrievalRoute =
  | {
      readonly ok: true;
      readonly lang: RetrievalLang;
      readonly vector: { readonly embedder: Embedder; readonly index: VectorIndex } | null;
      readonly mode: ThinkerRetrievalMode;
      /** The index file used, or null for lexical-only. */
      readonly indexFile: string | null;
    }
  | { readonly ok: false; readonly error: string };

/**
 * SPEC/14 revision (v): picks the retrieval of a request's language. Finnish is unchanged. English
 * uses the English index when loaded; on a lexical-only proxy the English lexical half alone;
 * without the English index, the declared demonstration fallback or a refusal. Passages, tokeniser
 * and index are always of one language.
 */
export function retrievalRoute(deps: ThinkerDeps, lang: "fi" | "en"): RetrievalRoute {
  if (lang === "fi" || deps.vector === null) {
    return { ok: true, lang, vector: deps.vector, mode: deps.vector ? "hybrid" : "lexical_only", indexFile: deps.vector ? indexFileOf(lang) : null };
  }
  if (deps.vectorEn) return { ok: true, lang: "en", vector: deps.vectorEn, mode: "hybrid", indexFile: indexFileOf("en") };
  if (deps.englishWithoutIndex === "fi_index") return { ok: true, lang: "fi", vector: deps.vector, mode: "hybrid_fi_fallback", indexFile: indexFileOf("fi") };
  return { ok: false, error: `English retrieval is not available: ${indexFileOf("en")} is not loaded (run \`npm run thinker:index\`)` };
}

/**
 * SPEC/27 §2.2 (5 Oct 2026): a request that carries a participant code must carry that code's cell
 * from the allocation table; an unknown code or another cell is refused (HTTP 400), never answered
 * with either cell's prompt. A request without a code (demonstration, pilot) is served by its cell.
 */
export function allocationError(req: { readonly cell: string; readonly participantCode?: string }, table: AssignmentTable = ALLOCATION_TABLE): string | null {
  if (req.participantCode === undefined) return null;
  const row = assignmentOf(table, req.participantCode);
  if (!row) return "unknown participantCode";
  return row.cell === req.cell ? null : "cell does not match the allocation table";
}

/** The versioned prompt of a language and variant (its hash is what the response and log carry). */
export function promptFor(deps: ThinkerDeps, lang: "fi" | "en", variant: ThinkerPromptVariant): SystemPrompt {
  if (variant === "standard") return lang === "en" && deps.promptEn ? deps.promptEn : deps.prompt;
  const fi = deps.promptIntent;
  if (!fi) throw new Error("the strategy-guided prompt (prompt.intent.fi.md) is not loaded");
  return lang === "en" && deps.promptIntentEn ? deps.promptIntentEn : fi;
}

/**
 * The Open Thinker's versioned prompt of a language and cell (its hash is what the response and log
 * carry). Revision (al): one prompt per Thinker cell — `prompt-open.*` for `reasoning_intent`,
 * `prompt-open.once.*` for `reasoning_once`.
 */
export function openPromptFor(deps: ThinkerDeps, lang: "fi" | "en", cell: ThinkerCell = "reasoning_intent"): SystemPrompt {
  if (cell === "reasoning_once") {
    if (!deps.promptOpenOnce) throw new Error("the reasoning_once Open Thinker prompt (prompt-open.once.fi.md) is not loaded");
    return lang === "en" && deps.promptOpenOnceEn ? deps.promptOpenOnceEn : deps.promptOpenOnce;
  }
  if (!deps.promptOpen) throw new Error("the Open Thinker prompt (prompt-open.fi.md) is not loaded");
  return lang === "en" && deps.promptOpenEn ? deps.promptOpenEn : deps.promptOpen;
}

/** A request validated for its endpoint, time-gated and retrieved over: what both chats share. */
interface Prepared {
  readonly req: ThinkerRequest;
  readonly step: number;
  readonly lang: "fi" | "en";
  readonly route: Extract<RetrievalRoute, { ok: true }>;
  readonly records: readonly RetrievedRecord[];
  /** The time-gated atoms the retrieval ranked over (the clock line and the digest read them). */
  readonly gated: readonly InfoAtom[];
  /** Revision (ah): the question's best matches among the current step's records, beyond `records` (`recentMatches`). */
  readonly recent: readonly InfoAtom[];
  /**
   * The virtual time the model is told is "now": the request's, except in the practice view, whose
   * browser clock reads 0 while the view starts earlier (revision (ah), review H1: Haku said "now 13:20"
   * while the screen showed 12:00). The view's start, as the gate already uses there.
   */
  readonly clockS: number;
  /** Revision (am): the request is from the practice view (VP). */
  readonly practice: boolean;
  /** Revision (bp): which corpus answered: the session's ("main") or the training incident's. */
  readonly corpus: "main" | "training";
  /** The time record ages are counted to (revision (an): the step's end; the training: its "now"). */
  readonly ageRefS: number;
}

/**
 * Revision (bp): a training request, prepared over the training's records only — gated by its one step, lexical only (`vector` null,
 * `retrievalMode` "lexical_only", no index), told the training's "now". The session's `scenario.atoms` are never read here.
 */
function prepareTraining(deps: ThinkerDeps, req: ThinkerRequest): Prepared | Refused {
  const training = deps.training;
  if (!training) return { status: 503, body: { error: "the training corpus is not loaded" } };
  const lang = req.language ?? "fi";
  const route = { ok: true, lang, vector: null, mode: "lexical_only", indexFile: null } as const;
  const gated = reachableAtoms(training.atoms, training.step);
  const records = hybridRetrieve(req.question, gated, null, undefined, lang);
  const recent = recentMatches(req.question, gated, training.step, records, null, lang);
  return { req, step: training.step, lang, route, gated, records, recent, clockS: training.nowS, practice: false, corpus: "training", ageRefS: training.nowS };
}

async function prepare(deps: ThinkerDeps, body: unknown, tool: ThinkerTool): Promise<Prepared | Refused> {
  const valid = validateThinkerRequest(body, tool);
  if (!valid.ok) return { status: 400, body: { error: valid.error } };
  const req = valid.request;
  const refused = allocationError(req);
  if (refused) return { status: 400, body: { error: refused } };
  if (req.corpus === "training") return prepareTraining(deps, req);
  // D1 (8 Oct 2026): Haku's chat answers in the practice view too, gated by its own step. The practice
  // view has one step, and the browser's clock reads 0 there while the view starts at a negative
  // virtual time (round 6, 8 Oct 2026: every practice-view question was refused as "outside the
  // view"), so it is gated by that step whatever clock the request carries.
  const practice = req.view === deps.scenario.practice.cycle.index;
  const view = practice ? deps.scenario.practice.cycle : deps.scenario.cycles.find((c) => c.index === req.view);
  const step = view ? (practice ? stepAtVirtualTime(view, view.startsAtVirtual) : stepAtVirtualTime(view, req.virtualTimeS)) : null;
  if (step === null) return { status: 400, body: { error: "virtualTimeS is outside the view" } };

  const lang = req.language ?? "fi";
  const route = retrievalRoute(deps, lang);
  if (!route.ok) return { status: 503, body: { error: route.error } };
  const candidates = reachableAtoms(deps.scenario.atoms, step);
  const vector = route.vector
    ? { queryVector: roundVector(await route.vector.embedder.embed(req.question, "query")), index: route.vector.index }
    : null;
  const records = hybridRetrieve(req.question, candidates, vector, undefined, route.lang);
  const recent = recentMatches(req.question, candidates, step, records, vector, route.lang);
  return { req, step, lang, route, gated: candidates, records, recent, clockS: practice ? view!.startsAtVirtual : req.virtualTimeS, practice, corpus: "main", ageRefS: ageReferenceOf(step) };
}

/**
 * The response without the format-0.11.0 context ids (SPEC/31 §3.6): the proxy's log line stays as it was — it carries the same ids
 * already, as `digest` (the Open Thinker) and `recent` (both chats).
 */
function withoutContextIds<R extends { readonly digestAtomIds?: readonly string[]; readonly recentAtomIds?: readonly string[] }>(response: R): Omit<R, "digestAtomIds" | "recentAtomIds"> {
  const { digestAtomIds: _digest, recentAtomIds: _recent, ...rest } = response;
  return rest;
}

/** The log line's fields both chats share. */
function logBase(p: Prepared, system: string, tool: ThinkerTool) {
  const { req } = p;
  return {
    tool,
    sessionId: req.sessionId,
    // Revision (al): the browser's question id, so the server line joins `ai_chat_*` in the session log.
    queryId: req.queryId ?? null,
    condition: req.condition,
    cell: req.cell,
    ...(req.participantCode !== undefined ? { participantCode: req.participantCode } : {}),
    // The hash of the system text actually sent.
    systemPromptHash: sha256Hex(system),
    view: req.view,
    // Revision (am): the practice view's lines say so (view 0 already does; analysis drops them like every practice record).
    practice: p.practice,
    // Revision (bp): the corpus that answered; a training line joins `training_haku_*` by `queryId`.
    corpus: p.corpus,
    virtualTimeS: req.virtualTimeS,
    step: p.step,
    question: req.question,
    language: p.lang,
    embedderId: p.route.vector?.embedder.id ?? null,
    // SPEC/14 revision (v): which index answered (null: lexical half alone).
    retrievalIndex: p.route.indexFile,
    // Revision (ah): the current step's best matches the model also saw (tagged after `retrieved`), and the clock it was told.
    recent: p.recent.map((a) => a.id),
    clockVirtualS: p.clockS,
    // Revision (an): the time the record ages in the model input are counted to.
    ageRefVirtualS: p.ageRefS,
  };
}

/** Haku's structured chat (`/api/thinker`): every cell, every view, the standard prompt (D1, 8 Oct 2026). */
export async function handleThinkerRequest(deps: ThinkerDeps, body: unknown): Promise<ThinkerHandlerResult> {
  const started = deps.nowMs();
  const p = await prepare(deps, body, "haku");
  if ("status" in p) return p;
  const variant: ThinkerPromptVariant = "standard";
  const prompt = promptFor(deps, p.lang, variant);
  const system = prompt.text;
  const clockLine = clockLineOf(p.lang, p.clockS, receivedUpToOf(p.gated, p.clockS));
  // SPEC/30 §10: an answer from a build other than the pinned one is a model error (the template answer, as for any model error).
  const guarded = guardModelVersion(deps, p.req.sessionId, await callThinkerModel(deps.client, system, buildUserContent(p.req.question, p.records, p.lang, undefined, { clockLine, recent: p.recent, ageRefS: p.ageRefS }), variant));
  const outcome = guarded.outcome;
  // B6 (SPEC/14 revision (bi)): the template counts record ages to the same reference as the model's record lines.
  const answer = outcome.ok ? outcome.answer : templateThinkerAnswer(p.records.map((r) => toRenderable(r.atom)), p.lang, variant, p.ageRefS);
  const response: ThinkerResponse = {
    answer,
    retrieved: p.records.map((r) => ({ id: r.atom.id, score: r.score })),
    modelId: THINKER_MODEL_ID,
    promptHash: prompt.sha256,
    latencyMs: Math.round(deps.nowMs() - started),
    fallback: !outcome.ok,
    fallbackReason: outcome.ok ? null : outcome.reason,
    retrievalMode: p.route.mode,
    retrievalLanguage: p.route.lang,
    ...(!outcome.ok && outcome.reason === "refusal" ? { refusalCategory: outcome.refusalCategory ?? null } : {}),
    promptVariant: variant,
    // SPEC/31 §3.6 (format 0.11.0): what reached the model without a search, for the browser's log; Haku's chat has no digest.
    digestAtomIds: [],
    recentAtomIds: p.recent.map((a) => a.id),
  };
  await deps.appendLog(p.req.sessionId, {
    loggedAt: deps.nowIso(),
    ...logBase(p, system, "haku"),
    ...withoutContextIds(response),
    ...guarded.log,
    ...(outcome.ok ? { usage: outcome.usage } : {}),
    ...(outcome.attempts !== undefined ? { attempts: outcome.attempts } : {}),
    ...(!outcome.ok && outcome.detail ? { errorDetail: outcome.detail } : {}),
  });
  return { status: 200, body: response };
}

/**
 * The Open Thinker (`/api/thinker-open`): its cell's frozen prompt (F3; revision (al): one per Thinker
 * cell) as the system instruction — in `reasoning_intent` with the view's order block at its end (the
 * command directive verbatim from V8, P2's opening intent before; `openSystemInstruction`), in
 * `reasoning_once` alone — the history (F2, validated; its record tags rewritten, revision (al)),
 * plain text at temperature 0. Every question carries the plan context derived here
 * (`openPlanContext`). Revision (aq), 11 Oct 2026: the model answers in structured JSON (`open-answer.ts`:
 * limited here, rendered to the display text, verdicts read from its fields); invalid JSON is asked for once more.
 * A model failure answers with an empty text flagged as fallback: the browser shows "unavailable".
 */
export async function handleOpenThinkerRequest(deps: ThinkerDeps, body: unknown): Promise<OpenThinkerHandlerResult> {
  const started = deps.nowMs();
  const p = await prepare(deps, body, "open_thinker");
  if ("status" in p) return p;
  // `prepare` validated the cell as a Thinker cell for this endpoint.
  const cell = p.req.cell as ThinkerCell;
  // Revision (am): the Thinker practice (VP) is the same in both Thinker cells — the reasoning_once prompt, no
  // order block (the practice has no order; the reasoning_intent prompt would announce a block that is not there).
  const promptCell: ThinkerCell = p.practice ? "reasoning_once" : cell;
  const prompt = openPromptFor(deps, p.lang, promptCell);
  // Revision (al): the order block only in the reasoning_intent cell (`openSystemInstruction`), never in VP (`intentBlockOf`).
  // Revision (ar): the authored premises go to the model and the display only with the directive in force (reasoning_intent from V8, never VP).
  const directiveInForce = promptCell === "reasoning_intent" && p.req.view >= STRATEGY_FROM_VIEW;
  // SPEC/30 §3 (19 Oct 2026): with the directive in force, the premise statuses are the premise-evidence table's at the records clock (the
  // latest observation among the time-gated records), never the model's: stated to the model after the directive, shown in the fixed template.
  const evidence = directiveInForce ? (deps.premiseEvidence ?? loadPremiseEvidence()) : undefined;
  const recordsClockS = receivedUpToOf(p.gated, p.clockS);
  const checkItems = evidence ? premiseCheck(evidence, p.req.view, recordsClockS) : null;
  // No table entry for the view (impossible with a valid table): no premises, no premise line and no verdict, rather than the model's rating.
  const premises = checkItems ? (deps.directivePremises ?? loadDirectivePremises()) : undefined;
  const lookup = checkItems ? recordLookupOf(deps.scenario.atoms) : null;
  const shownCheck = evidence && checkItems && premises && lookup ? premiseCheckShown(evidence, checkItems, premises, lookup, p.lang) : undefined;
  const system = openSystemInstruction(prompt.text, deps.scenario, p.req.view, p.lang, promptCell,
    checkItems && premises && lookup ? { authored: premises, check: premiseBlockStatuses(checkItems, lookup, p.lang) } : undefined);
  const planContext = openPlanContext(deps.scenario, p.req.view, p.clockS, p.lang, recordsClockS);
  const digest = latestDigest(p.gated, p.records, new Set(rosterForView(deps.scenario.allocationSpace, p.req.view).map((a) => a.id)));
  // Revision (an): every record line carries its age, counted to the end of the question's step (`ageReferenceOf`).
  const extras = { digest, recent: p.recent, ageRefS: ageReferenceOf(p.step) };
  const userContent = buildUserContent(p.req.question, p.records, p.lang, planContext, extras);
  // Revision (al): the history's record tags are rewritten ("(earlier answer)"); tags are renumbered per request.
  const history = p.req.history?.map((h) => historyTurnForModel(h, p.lang));
  // SPEC/30 §10: an answer from a build other than the pinned one is a model error (the participant sees "unavailable").
  const guarded = guardModelVersion(deps, p.req.sessionId, await callOpenThinkerModel(deps.client, system.text, userContent, history, openAnswerSchemaFor(promptCell)));
  const outcome = guarded.outcome;
  // Revision (aq), 11 Oct 2026: the model's structured answer is limited (kinds, item counts, field lengths, 150 words, no verdicts
  // without a directive in force) and rendered to the display text here; verdicts are read from its fields, not from the text.
  // Verdicts and premises only in reasoning_intent from V8 on, never in the practice view (`promptCell` is once there).
  // SPEC/30 §3: the premise line only in an options answer, from the server's check (`limitOpenAnswer` drops it for every other kind).
  const tagged = taggedAtoms(p.records, extras);
  const limited = outcome.ok
    ? limitOpenAnswer(outcome.answer, { directiveInForce, taggedCount: tagged.length, tagTimes: tagged.map((a) => clockAt(a.provenance.observedAt)), premises, premiseCheck: shownCheck }, p.lang)
    : null;
  const shownPremises = limited?.answer.premiseCheck;
  // Researcher decision (commander M1, 8 Oct 2026): a model failure is never answered with a record excerpt or free text; the browser shows the explicit "unavailable" state.
  const answer = limited ? renderOpenAnswer(limited.answer, limited.tagTimes, p.lang) : "";
  const verdicts = limited ? verdictsOfOptions(limited.answer) : null;
  const citations = outcome.ok ? citationIssuesOfStructured(outcome.answer, tagged.length) : null;
  const response: OpenThinkerResponse = {
    answer,
    structured: limited ? { ...limited.answer, tagTimes: limited.tagTimes } : null,
    retrieved: p.records.map((r) => ({ id: r.atom.id, score: r.score })),
    modelId: THINKER_MODEL_ID,
    promptHash: prompt.sha256,
    latencyMs: Math.round(deps.nowMs() - started),
    fallback: !outcome.ok,
    fallbackReason: outcome.ok ? null : outcome.reason,
    retrievalMode: p.route.mode,
    retrievalLanguage: p.route.lang,
    ...(!outcome.ok && outcome.reason === "refusal" ? { refusalCategory: outcome.refusalCategory ?? null } : {}),
    promptVariant: "standard",
    // Revision (ah), review H2: no directive is in force before STRATEGY_FROM_VIEW, so no verdict is coded there.
    // Back-compatibility only (revision (al)): the first coded option's verdict; `verdicts` is the analysis value.
    // Revision (aq): both come from the options' `verdict` fields (`verdictsOfOptions`), null where none is coded.
    verdict: verdicts ? verdicts[0]!.verdict : null,
    verdicts,
    // SPEC/31 §3.6 (format 0.11.0): the digest and the recent matches the model had without a search, for the browser's log.
    digestAtomIds: digest.map((a) => a.id),
    recentAtomIds: p.recent.map((a) => a.id),
  };
  await deps.appendLog(p.req.sessionId, {
    loggedAt: deps.nowIso(),
    // `systemPromptHash` (in logBase) is the hash of the system text actually sent: the frozen prompt plus the order block (reasoning_intent).
    ...logBase(p, system.text, "open_thinker"),
    intentBlock: system.block?.kind ?? null,
    digest: digest.map((a) => a.id),
    historyTurns: p.req.history?.length ?? 0,
    // Revision (al), logging only: provenance hashes, the directive-quote screen, the citation post-check.
    ...provenanceHashes(p.req.history, userContent),
    directiveQuoted: directiveQuoted(p.req.question, [deps.scenario.hinge.intentStatement, tr("en", deps.scenario.hinge.intentStatement)]),
    // Revision (aq): the tags of the answer as the model returned it, checked against the tagged records (the proxy writes each citation's time itself).
    citationIssues: citations ? citations.issues : null,
    ...(citations ? { uncitedItems: citations.uncited, imperativeWords: imperativeWordsIn(answer, p.lang), words: wordCount(answer) } : {}),
    ...withoutContextIds(response),
    // Revision (aq): the exact verdict fields (a justified departure is `departure_justifiable` here, `departs` in the browser's three-valued log), and the model's JSON as returned.
    // Revision (ar): the frozen premises' hash. SPEC/30 §3: the premise-evidence table's version and hash and the records clock it was read
    // at (directive in force), the statuses and deciding atom ids shown (an options answer only), and whether a premise flag was shown.
    ...(premises ? { premisesSha256: premises.sha256 } : {}),
    ...(evidence ? { premiseEvidenceVersion: evidence.version, premiseEvidenceSha256: evidence.sha256, premiseRecordsClockS: recordsClockS } : {}),
    ...(shownPremises ? { premiseStatuses: shownPremises.items } : {}),
    premiseFlagShown: shownPremises?.flagShown ?? false,
    ...guarded.log,
    ...(limited && outcome.ok ? { verdictFields: limited.answer.options.map((o) => o.verdict), kind: limited.answer.kind, rawJson: outcome.rawJson.slice(0, 8000) } : {}),
    ...(outcome.ok ? { usage: outcome.usage } : {}),
    ...(outcome.attempts !== undefined ? { attempts: outcome.attempts } : {}),
    ...(outcome.ok && outcome.parseRetries ? { parseRetries: outcome.parseRetries } : {}),
    // `truncated`: the proxy shortened the model's answer to its limits (what it changed is in `trimmed`); before (aq) it meant a cut-off by the output cap.
    ...(limited && limited.trimmed.length > 0 ? { truncated: true, trimmed: limited.trimmed } : {}),
    ...(!outcome.ok && outcome.detail ? { errorDetail: outcome.detail } : {}),
  });
  return { status: 200, body: response };
}
