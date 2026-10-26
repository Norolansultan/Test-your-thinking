/**
 * The training's Haku (SPEC/14 (bp) §bp.2, SPEC/07 (bp)): S3's questions go through the session's own Haku answer path — the
 * `ThinkerTransport` (the study's proxy, or the demonstration's bridge) with `corpus: "training"`, `view` 0 and the training's "now"
 * (`TRAINING_NOW_S`) — and are answered over the training's twelve records only, lexically. On a failed or malformed answer (a timeout, a
 * network failure, a wrong shape, a retrieved id that is not a training record, a retrieval that was not lexical) the local template
 * (`template-answer.ts`) over the lexical retrieval of `TRAINING_ATOMS` at the training's step is shown instead (`answerSource:
 * "template"`). The answer is shown no sooner than the session's 2.5 s floor.
 *
 * Logged as `training_haku_asked` (durable before the pane shows anything of it) and `training_haku_answered`: NEVER `ai_chat_*`, so no
 * seeking, exposure, source-memory or H9/H10 measure can see them. The turns are this module's own (the pane shows them while the
 * step is `training_incident`), restored on a resume from those records; the session's `SessionQueries` is untouched.
 */

import { toRenderable } from "../../boundary/render-boundary.js";
import type { Lang } from "../../i18n/lang.js";
import { hybridRetrieve } from "../../retrieval/hybrid.js";
import { reachableAtoms } from "../../retrieval/time-gate.js";
import type { Cell } from "../../scenario/types.js";
import { STEP_SECONDS } from "../../scenario/views.js";
import type { LogHeader } from "../../telemetry/log.js";
import type { TelemetryEvent } from "../../telemetry/record-kinds.js";
import type { TrainingHakuAnsweredDetail } from "../../telemetry/record-kinds-training.js";
import { conditionOfCell } from "../preview.js";
import type { AiChatTurn } from "../snapshot.js";
import type { TemplateAnswer } from "../template-answer.js";
import { DEMO_BRIDGE_MODEL_ID, templateThinkerAnswer, THINKER_LATENCY_FLOOR_MS, THINKER_MAX_QUESTION_CHARS, type ThinkerFallbackReason, type ThinkerResponse } from "../thinker-protocol.js";
import { assertThinkerResponseShape, httpThinkerTransport, type ThinkerTransport } from "../thinker-transport.js";
import { TRAINING_ATOMS, TRAINING_NOW_S, TRAINING_STEP } from "./corpus.js";
import type { KeptTraining } from "./resume.js";

/** The training's record ids: every id Haku may retrieve in the training (SPEC/14 (bp) §bp.3). */
export const TRAINING_RECORD_PREFIX = "trn.";

export interface TrainingHakuHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  header(): LogHeader;
  language(): Lang;
  cell(): Cell;
  /** The S3 item Haku answers for now and the ms since it appeared; null: Haku is closed. */
  openItem(): { readonly itemId: string; readonly atItemMs: number } | null;
  /** A question on `itemId` is being logged (the item's `hakuBefore`). */
  asked(itemId: string): void;
}

class TrainingAnswerRejected extends Error {}

/** A transport's training answer must be the training's: lexical retrieval over `trn.` records only. */
function assertTrainingResponse(r: ThinkerResponse): void {
  if (r.retrievalMode !== "lexical_only") throw new TrainingAnswerRejected(`the training's answer was retrieved "${r.retrievalMode}", not lexically`);
  const foreign = r.retrieved.find((x) => !x.id.startsWith(TRAINING_RECORD_PREFIX));
  if (foreign) throw new TrainingAnswerRejected(`the training's answer retrieved ${foreign.id}, not a training record`);
}

function fallbackReasonOf(e: unknown): ThinkerFallbackReason {
  if (e instanceof TrainingAnswerRejected) return "invalid_output";
  return e && typeof e === "object" && "name" in e && e.name === "ThinkerTimeoutError" ? "client_timeout" : "network_error";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class TrainingHaku {
  /** The training's Haku turns, in order (the Haku pane shows them during the training). */
  readonly turns: AiChatTurn[] = [];
  private count = 0;
  private pending = 0;
  private readonly transport: ThinkerTransport;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(private readonly host: TrainingHakuHost, thinker: { readonly transport?: ThinkerTransport; readonly wait?: (ms: number) => Promise<void> } = {}) {
    this.transport = thinker.transport ?? httpThinkerTransport();
    this.wait = thinker.wait ?? sleep;
  }

  /** A resume: the turns answered before it, and the question count (`trn.N` continues). */
  restore(kept: KeptTraining): void {
    this.turns.length = 0;
    this.turns.push(...kept.hakuTurns);
    this.count = kept.hakuCount;
  }

  /** A question is waiting for its answer. */
  get waiting(): boolean { return this.pending > 0; }

  /** S3's Haku question: logged, sent with `corpus: "training"`, answered (or the local template), logged, shown. */
  async ask(text: string): Promise<TemplateAnswer> {
    const open = this.host.openItem();
    if (!open) throw new Error("askTrainingHaku: Haku is open in the training's S3 only");
    if (text.length > THINKER_MAX_QUESTION_CHARS) throw new RangeError(`A Haku question is at most ${THINKER_MAX_QUESTION_CHARS} characters`);
    this.count += 1;
    const queryId = `trn.${this.count}`;
    const lang = this.host.language();
    // The item's `hakuBefore` counts this question from the moment its record is queued: the log keeps the call order.
    const asked = this.host.event({ kind: "training_haku_asked", detail: { queryId, itemId: open.itemId, text, charCount: text.length, atItemMs: open.atItemMs } });
    this.host.asked(open.itemId);
    await asked;
    this.pending += 1;
    this.host.notify();
    try {
      const floor = this.wait(THINKER_LATENCY_FLOOR_MS);
      const sentMs = this.host.realMs();
      const header = this.host.header();
      const cell = this.host.cell();
      const code = header.assignment?.source === "table" ? { participantCode: header.participantCode } : {};
      let answered: { readonly response: ThinkerResponse; readonly source: TrainingHakuAnsweredDetail["answerSource"]; readonly local: boolean };
      try {
        const response = await this.transport({
          sessionId: header.sessionId, queryId, view: 0, virtualTimeS: TRAINING_NOW_S, question: text, language: lang,
          cell, condition: conditionOfCell(cell), corpus: "training", ...code,
        });
        assertThinkerResponseShape(response);
        assertTrainingResponse(response);
        // A proxy that could not reach its model answers with its own template (`fallback`): a template answer too.
        answered = { response, source: response.fallback ? "template" : response.modelId === DEMO_BRIDGE_MODEL_ID ? "bridge" : "model", local: false };
      } catch (e) {
        answered = { response: this.localFallback(text, lang, fallbackReasonOf(e)), source: "template", local: true };
      }
      const measuredMs = Math.max(0, Math.round(this.host.realMs() - sentMs));
      await floor;
      const { response, source, local } = answered;
      const { vastaus, perusteet, varmuus, muuttaisi } = response.answer;
      await this.host.event({ kind: "training_haku_answered", detail: {
        queryId, itemId: open.itemId, retrieved: response.retrieved.map((r) => ({ id: r.id, fusedScore: r.score })), retrievalMode: "lexical_only",
        retrievalLanguage: response.retrievalLanguage ?? lang, answerSource: source,
        modelId: local ? null : response.modelId, promptHash: local ? null : response.promptHash, fallback: response.fallback, fallbackReason: response.fallbackReason,
        latencyMs: !local && Number.isFinite(response.latencyMs) ? Math.round(response.latencyMs) : measuredMs,
        answer: { vastaus, perusteet, varmuus, muuttaisi },
      } });
      const answer: TemplateAnswer = { answerFi: vastaus, basisFi: perusteet, certaintyFi: varmuus, wouldChangeIfFi: muuttaisi };
      this.turns.push({ query: text, answer });
      return answer;
    } finally {
      this.pending -= 1;
      this.host.notify();
    }
  }

  /**
   * The local fallback (and the play harness's answer): the template over the lexical retrieval of the training's records at the
   * training's one step, record ages counted to that step's end. No model answered: no model id, no prompt hash.
   */
  private localFallback(text: string, lang: Lang, reason: ThinkerFallbackReason): ThinkerResponse {
    const retrieved = hybridRetrieve(text, reachableAtoms(TRAINING_ATOMS, TRAINING_STEP), null, undefined, lang);
    return {
      answer: templateThinkerAnswer(retrieved.map((r) => toRenderable(r.atom)), lang, "standard", TRAINING_STEP * STEP_SECONDS),
      retrieved: retrieved.map((r) => ({ id: r.atom.id, score: r.score })),
      modelId: "", promptHash: "", latencyMs: NaN, fallback: true, fallbackReason: reason,
      retrievalMode: "lexical_only", retrievalLanguage: lang, promptVariant: "standard",
    };
  }
}
