/**
 * The session's query tools — Haku (search and the SPEC/25 builder) and Thinker (SPEC/14 revision
 * (q)) — split out of `orchestrator.ts`, which owns the view flow and delegates here. There is no
 * way to ask a unit: the participant cannot transmit (SPEC/02 revision (j)); recorded radio traffic
 * stays in the corpus as data.
 *
 * Both reach the same time-gated records (`time-gate.ts`): only atoms of a world-state step already
 * reached (atoms carry their STEP, SPEC/26 §2), so the corpus does not leak the future. Haku stays
 * closed (I6). The chats are the exception (SPEC/00 revision (q)): their questions go to the study's
 * proxy, which retrieves over the same gated records and generates the answer live; if the proxy times
 * out, fails or answers in the wrong shape, the deterministic template over locally computed retrieval
 * is shown and logged as a fallback.
 *
 * Haku / Open Thinker redesign (researcher, 8 Oct 2026): the Haku tab's chat (`askAiChat`, the
 * structured four-part answer) is everyone's — both conditions, every view, the practice view
 * included — with the standard prompt, so it is not a manipulation. The AI condition's own tool is
 * the Open Thinker (`askOpenThinker`; main views, and since revision (am) the practice view, where its
 * turns are logged with `view` 0 like every practice record and cleared from its history when V1
 * starts). Both log `ai_chat_*` with `tool` (D3).
 *
 * Language (SPEC/14 revision (v)): an English session's Haku free text searches the English record
 * text and codes, and its Thinker request and local fallback retrieve over the English passages.
 */

import { toRenderable, type RenderableAtom } from "../boundary/render-boundary.js";
import type { VirtualTime } from "../engine/primitives.js";
import { assertClosedOverCorpus, retrieveClosedIn } from "../retrieval/closure.js";
import { hybridRetrieve } from "../retrieval/hybrid.js";
import { navigate, navigationNow, navigationSources, type NavQuery } from "../retrieval/navigation.js";
import { reachableAtoms } from "../retrieval/time-gate.js";
import type { Cell, ScenarioContract } from "../scenario/types.js";
import { appendTelemetryEvent } from "../telemetry/emit.js";
import type { LogRecord, SessionLog } from "../telemetry/log.js";
import type { AiChatAnswerReceivedDetail } from "../telemetry/record-kinds-interaction.js";
import thinkerManifest from "../../content/thinker/manifest.json" with { type: "json" };
import { conditionOfCell } from "./preview.js";
import { PRACTICE_VIEW_INDEX, STEP_SECONDS } from "../scenario/views.js";
import type { OpenStructuredAnswer } from "./open-answer.js";
import type { AiChatTurn, OpenThinkerTurn, RadioLogEntry } from "./snapshot.js";
import type { TemplateAnswer } from "./template-answer.js";
import {
  OPEN_THINKER_MAX_HISTORY, OPEN_THINKER_MAX_MODEL_TURN_CHARS, STRATEGY_FROM_VIEW, templateThinkerAnswer, THINKER_CLIENT_TIMEOUT_MS, THINKER_LATENCY_FLOOR_MS, THINKER_MAX_QUESTION_CHARS,
  type AiVerdict, type OptionVerdict, type OpenThinkerResponse, type ThinkerCell, type ThinkerFallbackReason, type ThinkerPromptVariant, type ThinkerResponse,
} from "./thinker-protocol.js";
import {
  assertOpenThinkerResponseShape, assertThinkerResponseShape, httpOpenThinkerTransport, httpThinkerTransport, type OpenThinkerTransport, type ThinkerTransport,
} from "./thinker-transport.js";
import { httpPremiseReviewTransport, requestPremiseReview, type PremiseReviewOutcome, type PremiseReviewTransport } from "./plan-review-transport.js";

/** What the query tools read from the running session. */
export interface QueryContext {
  readonly scenario: ScenarioContract;
  readonly log: SessionLog;
  now(): VirtualTime;
  /** Real milliseconds since the session started: every record's `tWallOffsetMs` (SPEC/07 revision (r)). */
  wallMs?(): number;
  /** The current view (0 = practice, 1–14). */
  view(): number;
  /** The world-state step reached so far in the current view. */
  currentStep(): number;
  /** The end of the current view's last step, virtual seconds: the KUKA list's horizon. */
  viewEndVirtual(): number;
  phaseTag(): "exploration" | "decision";
  /** The Open Thinker is offered: the AI condition, every view (revision (am): the practice view too). */
  aiAvailable(): boolean;
  /** The session language: Thinker answers in it (`app/i18n/lang.ts`). */
  language?(): "fi" | "en";
  /** The session's cell; both chats send it (the proxy checks it against the allocation table). Absent: `reasoning_once`. */
  cell?(): Cell;
}

/** Thinker's injectable edges: the proxy call and the latency floor's timer (tests fake both). */
export interface ThinkerOptions {
  readonly transport?: ThinkerTransport;
  readonly openTransport?: OpenThinkerTransport;
  /** SPEC/32 §3: the guide group's premise lookup at the plan review (`plan-review-transport.ts`); the default calls `/api/thinker/premise-review`. */
  readonly premiseReview?: PremiseReviewTransport;
  readonly wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The manifest's hash of the prompt the proxy would have used (language × variant, or the Open Thinker's), for a local fallback's log. */
export function manifestPromptHash(lang: "fi" | "en", variant: ThinkerPromptVariant | "open" | "open_once"): string {
  const m = thinkerManifest as typeof thinkerManifest & {
    promptEn?: { sha256: string }; promptIntent?: { sha256: string }; promptIntentEn?: { sha256: string };
    promptOpen?: { sha256: string }; promptOpenEn?: { sha256: string }; promptOpenOnce?: { sha256: string }; promptOpenOnceEn?: { sha256: string };
  };
  if (variant === "open") return (lang === "en" ? m.promptOpenEn?.sha256 : undefined) ?? m.promptOpen?.sha256 ?? "";
  // Revision (al): the reasoning_once cell's own Open Thinker prompt.
  if (variant === "open_once") return (lang === "en" ? m.promptOpenOnceEn?.sha256 : undefined) ?? m.promptOpenOnce?.sha256 ?? "";
  if (variant === "intent") return (lang === "en" ? m.promptIntentEn?.sha256 : undefined) ?? m.promptIntent?.sha256 ?? m.prompt.sha256;
  return (lang === "en" ? m.promptEn?.sha256 : undefined) ?? m.prompt.sha256;
}

/** The transport's failure as a fallback reason: the browser's timeout, else a network error (a bad shape included). */
function fallbackReasonOf(e: unknown): ThinkerFallbackReason {
  return e && typeof e === "object" && "name" in e && e.name === "ThinkerTimeoutError" ? "client_timeout" : "network_error";
}


export class SessionQueries {
  /** The message log (*Viestiloki*): pushed items only, appended by the orchestrator. */
  readonly radioLog: RadioLogEntry[] = [];
  readonly aiChatHistory: AiChatTurn[] = [];
  readonly openThinkerHistory: OpenThinkerTurn[] = [];
  private navQueryCount = 0;
  private textQueryCount = 0;
  private readonly textQueriesInView = new Map<number, number>();
  private aiQueryCount = 0;
  private hingeHistoryCleared = false;
  /** Revision (am): the Open Thinker's history holds practice-view turns (cleared at the first main view). */
  private practiceTurnsInHistory = false;
  private readonly transport: ThinkerTransport;
  private readonly openTransport: OpenThinkerTransport;
  private readonly premiseTransport: PremiseReviewTransport;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(private readonly ctx: QueryContext, thinker: ThinkerOptions = {}) {
    this.transport = thinker.transport ?? httpThinkerTransport();
    this.openTransport = thinker.openTransport ?? httpOpenThinkerTransport();
    this.premiseTransport = thinker.premiseReview ?? httpPremiseReviewTransport();
    this.wait = thinker.wait ?? sleep;
  }

  private searchableCorpus() {
    return reachableAtoms(this.ctx.scenario.atoms, this.ctx.currentStep());
  }

  /** Haku's free text, in the session language: an English session searches the English text and codes (SPEC/14 revision (v)). */
  searchAtoms(query: string): readonly RenderableAtom[] {
    const corpus = this.searchableCorpus();
    const results = retrieveClosedIn(this.ctx.language?.() ?? "fi")(query, corpus);
    assertClosedOverCorpus(results, corpus);
    return results.map(toRenderable);
  }

  /**
   * Logs a free-text search and what it showed (`query_submitted`), durably, before the results are
   * shown (I5). Free text is the Thinker cells' only (SPEC/14 §139): it was shown but never logged.
   */
  async logTextQuery(query: string, results: readonly RenderableAtom[]): Promise<void> {
    const view = this.ctx.view();
    const index = this.textQueriesInView.get(view) ?? 0;
    this.textQueriesInView.set(view, index + 1);
    this.textQueryCount += 1;
    await appendTelemetryEvent(this.ctx.log, this.ctx.now(), this.ctx.wallMs?.() ?? 0, {
      kind: "query_submitted",
      detail: {
        queryId: `text.${this.textQueryCount}`, text: query, charCount: query.length, reformulationChainIndex: index,
        view, language: this.ctx.language?.() ?? "fi", resultAtomIds: results.map((a) => a.id), phase: this.ctx.phaseTag(),
      },
    });
  }

  /**
   * Haku's chat (SPEC/14 revision (q); D1, 8 Oct 2026): every cell and every view, the practice view
   * included, with the standard prompt. The question is logged, sent to the proxy, and the answer
   * shown no sooner than the 2.5 s floor (step 5). On a client timeout, network failure or a reply of
   * the wrong shape the deterministic template over locally computed, lexical-only retrieval is shown
   * instead (step 6). Both records are logged in full, `tool: "haku"`. `viaChip` (SPEC/30 §4 revision (bf), 24 Oct 2026): the
   * question is the Haku group's suggested-question chip, logged so on its `ai_chat_query_submitted`, as the guide's chip is.
   */
  async askAiChat(query: string, viaChip = false): Promise<TemplateAnswer> {
    if (query.length > THINKER_MAX_QUESTION_CHARS) throw new RangeError(`A Haku question is at most ${THINKER_MAX_QUESTION_CHARS} characters`);
    const asked = await this.logQuestion(query, "haku", viaChip);
    const cell = this.ctx.cell?.() ?? "reasoning_once";
    const floor = this.wait(THINKER_LATENCY_FLOOR_MS);
    let response: ThinkerResponse;
    try {
      response = await this.transport({ ...this.requestBase(asked, query), cell, condition: conditionOfCell(cell) });
      // Checked here too, not only in the HTTP transport, so any transport's bad shape falls back instead of throwing.
      assertThinkerResponseShape(response);
    } catch (e) {
      response = this.localFallback(query, fallbackReasonOf(e));
    }
    await floor;

    const { vastaus, perusteet, varmuus, muuttaisi } = response.answer;
    const answer: TemplateAnswer = { answerFi: vastaus, basisFi: perusteet, certaintyFi: varmuus, wouldChangeIfFi: muuttaisi };
    this.aiChatHistory.push({ query, answer });
    await this.logAnswer(asked, query, response, { vastaus, perusteet, varmuus, muuttaisi }, "haku");
    return answer;
  }

  /**
   * The Open Thinker (researcher, 8 Oct 2026): the AI condition's free chat, main views only, with the
   * conversation's last turns as history (F2: at most 10, the participant's first, a model turn cut to
   * 4000 characters). A reply of the wrong shape, a timeout or a network failure (or the proxy's own
   * fallback) shows the explicit "unavailable" state, never a record excerpt (commander M1, 8 Oct
   * 2026), logged as a fallback with its reason (F1). `tool: "open_thinker"`. `viaChip` (SPEC/30 §4): the
   * question is the guide's suggested-question chip, logged so on its `ai_chat_query_submitted`.
   */
  async askOpenThinker(query: string, viaChip = false): Promise<string> {
    this.startView(this.ctx.view());
    if (!this.ctx.aiAvailable()) throw new Error("The Open Thinker is not available in this view (the AI condition only)");
    if (query.length > THINKER_MAX_QUESTION_CHARS) throw new RangeError(`A Thinker question is at most ${THINKER_MAX_QUESTION_CHARS} characters`);
    const cell = this.thinkerCell();
    const asked = await this.logQuestion(query, "open_thinker", viaChip);
    const floor = this.wait(THINKER_LATENCY_FLOOR_MS);
    let response: OpenThinkerResponse;
    try {
      const history = this.openThinkerHistory
        .filter((t) => !t.unavailable) // an unanswered turn is not part of the conversation the model saw
        .flatMap((t) => [{ role: "user" as const, text: t.query }, { role: "model" as const, text: t.answer.slice(0, OPEN_THINKER_MAX_MODEL_TURN_CHARS) }])
        .slice(-OPEN_THINKER_MAX_HISTORY); // whole turns (an even count), so it starts with the participant's
      response = await this.openTransport({ ...this.requestBase(asked, query), cell, condition: "substitutive", history });
      assertOpenThinkerResponseShape(response);
    } catch (e) {
      // Commander M1 (8 Oct 2026): no record excerpt as an answer; the tab shows "unavailable" (the turn's flag).
      // Revision (am): the practice view is answered with the reasoning_once prompt in both Thinker cells (no order block).
      const practice = asked.view === PRACTICE_VIEW_INDEX;
      response = { ...this.localFallback(query, fallbackReasonOf(e), cell === "reasoning_once" || practice ? "open_once" : "open"), answer: "" };
    }
    await floor;

    this.openThinkerHistory.push({ query, answer: response.answer, unavailable: response.fallback, ...(response.structured && !response.fallback ? { structured: response.structured } : {}) });
    if (asked.view === PRACTICE_VIEW_INDEX) this.practiceTurnsInHistory = true;
    await this.logAnswer(
      asked, query, response, { vastaus: response.answer, perusteet: "", varmuus: "", muuttaisi: "" }, "open_thinker",
      response.fallback ? undefined : (response.verdict ?? null), response.fallback || response.verdicts === undefined ? undefined : response.verdicts,
      response.fallback ? undefined : response.structured ?? undefined,
    );
    return response.answer;
  }

  /**
   * D6/history (8 Oct 2026): the Open Thinker's conversation is cleared at the start of the hinge view
   * (V8), once, so phase-A advice does not carry into phase B. The orchestrator calls this at each
   * view's start; `askOpenThinker` calls it too, so a missed call cannot leave the history in place.
   * Revision (am): likewise the practice view's turns are cleared at the first main view (V1), so the
   * Thinker practice does not carry into the study's conversation.
   */
  startView(view: number): void {
    if (view !== PRACTICE_VIEW_INDEX && this.practiceTurnsInHistory) {
      this.practiceTurnsInHistory = false;
      this.openThinkerHistory.length = 0;
    }
    if (view < STRATEGY_FROM_VIEW || this.hingeHistoryCleared) return;
    this.hingeHistoryCleared = true;
    this.openThinkerHistory.length = 0;
  }

  /**
   * Revision (ah), 9 Oct 2026 (review L3): a resumed session gets both chats back from its log (each
   * `ai_chat_answer_received`), so the Thinker conversation survives a reload as Search's answers do and
   * the model's history continues as it stood. The hinge rule holds: resuming at or after the hinge view
   * keeps only the Open Thinker turns asked from that view on. Nothing is logged.
   */
  restoreChats(records: readonly LogRecord[], resumedView: number): void {
    const answers = records.filter((r) => r.kind === "ai_chat_answer_received").map((r) => r.detail as AiChatAnswerReceivedDetail);
    const afterHinge = resumedView >= STRATEGY_FROM_VIEW;
    for (const d of answers) {
      if (d.tool === "open_thinker") {
        if (afterHinge && d.view < STRATEGY_FROM_VIEW) continue;
        // Revision (am): the practice turns are restored only into the practice view itself.
        if (d.view === PRACTICE_VIEW_INDEX && resumedView !== PRACTICE_VIEW_INDEX) continue;
        this.openThinkerHistory.push({ query: d.text, answer: d.answer.vastaus, unavailable: d.fallback });
        if (d.view === PRACTICE_VIEW_INDEX) this.practiceTurnsInHistory = true;
      } else {
        const a = d.answer;
        this.aiChatHistory.push({ query: d.text, answer: { answerFi: a.vastaus, basisFi: a.perusteet, certaintyFi: a.varmuus, wouldChangeIfFi: a.muuttaisi } });
      }
    }
    if (afterHinge) this.hingeHistoryCleared = true;
  }

  /** Logs the question (`ai_chat_query_submitted`) durably and returns what its answer record repeats. */
  private async logQuestion(query: string, tool: "haku" | "open_thinker", viaChip = false): Promise<{ queryId: string; view: number; virtualTimeS: number; phase: "exploration" | "decision" }> {
    this.aiQueryCount += 1;
    const asked = { queryId: `${tool === "haku" ? "ai" : "ai_open"}.${this.aiQueryCount}`, view: this.ctx.view(), virtualTimeS: this.ctx.now() as number, phase: this.ctx.phaseTag() };
    await appendTelemetryEvent(this.ctx.log, this.ctx.now(), this.ctx.wallMs?.() ?? 0, {
      kind: "ai_chat_query_submitted",
      detail: { queryId: asked.queryId, text: query, view: asked.view, virtualTimeS: asked.virtualTimeS, phase: asked.phase, tool, ...(viaChip ? { viaChip: true as const } : {}) },
    });
    return asked;
  }

  /**
   * SPEC/32 §3 (20 Oct 2026): the plan review's premise lookup — the session, its cell, the view and the virtual time now (the
   * server time-gates at it and reads the records clock, as for the Open Thinker), the language, and a table-assigned session's
   * code. Never throws (`requestPremiseReview`); nothing is logged here (the review's own record carries the outcome).
   */
  premiseReview(): Promise<PremiseReviewOutcome> {
    const header = this.ctx.log.header;
    const code = header.assignment?.source === "table" ? { participantCode: header.participantCode } : {};
    return requestPremiseReview(this.premiseTransport, {
      sessionId: header.sessionId, cell: this.ctx.cell?.() ?? "reasoning_once", view: this.ctx.view(), virtualTimeS: this.ctx.now() as number,
      language: this.ctx.language?.() ?? "fi", ...code,
    });
  }

  /** What both requests carry: the session, the view and its virtual time, the question, the language and (table-assigned) the code. */
  private requestBase(asked: { queryId: string; view: number; virtualTimeS: number }, query: string) {
    const header = this.ctx.log.header;
    // SPEC/27 §2.2: a table-assigned session sends its code, so the server can check the cell against the table.
    const code = header.assignment?.source === "table" ? { participantCode: header.participantCode } : {};
    // Revision (al): the question's id goes to the server too, which logs it (the two logs join on it).
    return { sessionId: header.sessionId, queryId: asked.queryId, view: asked.view, virtualTimeS: asked.virtualTimeS, question: query, language: this.ctx.language?.() ?? "fi", ...code };
  }

  private async logAnswer(
    asked: { queryId: string; view: number; virtualTimeS: number; phase: "exploration" | "decision" },
    query: string,
    response: Omit<ThinkerResponse, "answer">,
    answer: { vastaus: string; perusteet: string; varmuus: string; muuttaisi: string },
    tool: "haku" | "open_thinker",
    aiVerdict?: AiVerdict | null,
    aiVerdicts?: readonly OptionVerdict[] | null,
    structured?: OpenStructuredAnswer,
  ): Promise<void> {
    await appendTelemetryEvent(this.ctx.log, this.ctx.now(), this.ctx.wallMs?.() ?? 0, {
      kind: "ai_chat_answer_received",
      detail: {
        queryId: asked.queryId, text: query, view: asked.view, virtualTimeS: asked.virtualTimeS,
        retrieved: response.retrieved.map((r) => ({ id: r.id, fusedScore: r.score })), retrievalMode: response.retrievalMode,
        // SPEC/14 revision (v): the language retrieval ran in (absent from an older proxy: Finnish).
        retrievalLanguage: response.retrievalLanguage ?? "fi",
        modelId: response.modelId, promptHash: response.promptHash, answer,
        latencyMs: Number.isFinite(response.latencyMs) ? response.latencyMs : null,
        fallback: response.fallback, fallbackReason: response.fallbackReason, phase: asked.phase, // the phase the question was asked in, even if the answer arrives during a freeze
        promptVariant: "standard",
        tool,
        ...(aiVerdict !== undefined ? { aiVerdict } : {}),
        // Revision (al): the per-option verdicts, the analysis value (`aiVerdict` kept for back-compatibility).
        ...(aiVerdicts !== undefined ? { aiVerdicts: aiVerdicts === null ? null : aiVerdicts.map(({ line, verdict }) => ({ line, verdict })) } : {}),
        // Revision (aq): the structured answer's kind, exact verdicts and premise statuses.
        ...(structured ? { aiKind: structured.kind, aiVerdictsExact: structured.options.map((o) => o.verdict), aiPremiseStatuses: structured.premises.map((p) => p.status), aiPremiseIds: structured.premises.map((p) => p.id) } : {}),
        // SPEC/31 §3.6 (format 0.11.0): what the proxy put in the model's context without a search; absent from an older proxy and the local fallback.
        ...(response.digestAtomIds !== undefined ? { digestAtomIds: [...response.digestAtomIds] } : {}),
        ...(response.recentAtomIds !== undefined ? { recentAtomIds: [...response.recentAtomIds] } : {}),
      },
    });
  }

  /** The Open Thinker's cell: only the AI condition reaches it, so `radio` cannot occur. */
  private thinkerCell(): ThinkerCell {
    const cell = this.ctx.cell?.() ?? "reasoning_once";
    if (cell === "radio") throw new Error("The Haku cell has no Open Thinker");
    return cell;
  }

  /**
   * The browser's fallback: no query vector can be computed here, so the lexical half runs alone
   * over the same time-gated candidates. The browser reads no wall clock (I1), so the latency is
   * the timeout for a timeout and unknown (NaN, logged null) for a network failure.
   */
  private localFallback(query: string, reason: ThinkerFallbackReason, prompt: "standard" | "open" | "open_once" = "standard"): ThinkerResponse {
    const lang = this.ctx.language?.() ?? "fi";
    // The session language's lexical half (SPEC/14 revision (v)): English passages and tokeniser in English.
    const retrieved = hybridRetrieve(query, this.searchableCorpus(), null, undefined, lang);
    return {
      // B6 (SPEC/14 revision (bi)): record ages counted to the end of the current step, as the proxy's (`ageReferenceOf`).
      answer: templateThinkerAnswer(retrieved.map((r) => toRenderable(r.atom)), lang, "standard", this.ctx.currentStep() * STEP_SECONDS),
      retrieved: retrieved.map((r) => ({ id: r.atom.id, score: r.score })),
      modelId: thinkerManifest.model.id,
      promptHash: manifestPromptHash(lang, prompt),
      latencyMs: reason === "client_timeout" ? THINKER_CLIENT_TIMEOUT_MS : NaN,
      fallback: true,
      fallbackReason: reason,
      retrievalMode: "lexical_only",
      retrievalLanguage: lang,
      promptVariant: "standard",
    };
  }

  /** The KUKA list: the sources known by the end of the current view (2 Oct 2026; `navigation.ts`). */
  navigationSources(): readonly string[] {
    return navigationSources(this.ctx.scenario.atoms, this.ctx.viewEndVirtual());
  }

  /** SPEC/25 §7: logs one builder slot change; the sequence of these is the search path. */
  async logNavSlot(slot: "category" | "source" | "window", value: string | null): Promise<void> {
    await appendTelemetryEvent(this.ctx.log, this.ctx.now(), this.ctx.wallMs?.() ?? 0, { kind: "nav_slot_changed", detail: { slot, value } });
  }

  /**
   * SPEC/25: answers a KUKA × MITÄ × MILLOIN query from the closed corpus at the current step's
   * scenario time, logs exactly what was shown, and returns render-safe atoms.
   */
  async navigateQuery(query: NavQuery): Promise<readonly RenderableAtom[]> {
    const corpus = this.searchableCorpus();
    const results = navigate(query, corpus, navigationNow(this.ctx.currentStep()));
    assertClosedOverCorpus(results, corpus);
    this.navQueryCount += 1;
    await appendTelemetryEvent(this.ctx.log, this.ctx.now(), this.ctx.wallMs?.() ?? 0, {
      kind: "nav_query_submitted",
      detail: { queryId: `nav.${this.navQueryCount}`, category: query.category, sourceId: query.sourceId, window: query.window, resultAtomIds: results.map((a) => a.id), phase: this.ctx.phaseTag() },
    });
    return results.map(toRenderable);
  }
}
