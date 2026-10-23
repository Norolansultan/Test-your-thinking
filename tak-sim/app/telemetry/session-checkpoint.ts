/**
 * Checkpoint uploads (9 Oct 2026): so a session abandoned midway still reaches the researcher, the
 * browser appends what it has logged so far to `<sessionId>.partial.jsonl` on the server at natural
 * boundaries outside the run (`session-log-protocol.ts`). The upload at `COMPLETE` stays the record
 * of a finished session and supersedes the checkpoints.
 *
 * Invariant I3 (SPEC/00 §3: "zero outbound requests while RUNNING … Telemetry uploads occur only
 * after the run, or from a queue … that is inert while `RUNNING`"), and why a checkpoint keeps it:
 *
 * - A checkpoint starts only on a screen where nothing in the scenario moves ({@link checkpointLabel}):
 *   a freeze, the training after the practice view (engine TUTORIAL), the hinge (HINGE_PAUSE), the
 *   post-session questionnaire and the debrief (DEBRIEF_HANDOFF). A freeze is SPEC/05 §4's FREEZING
 *   — the view's clock halted, scenario input and the channel disabled — which the orchestrator
 *   implements by pausing the view clock rather than moving the engine's state variable (that reads
 *   RUNNING, or WARMUP in the practice view, throughout a view). "RUNNING" in I3 is the live run, in
 *   which the stimulus unfolds; no checkpoint request is ever started in it.
 * - Before every request the boundary is checked again (`atBoundary`): once the participant is back
 *   in the view, no further request starts and the rest waits for the next boundary. A request already
 *   on the wire may finish after the view resumes; nothing waits for it.
 * - It changes nothing the participant sees and nothing in the log: the outcome is never logged and
 *   never gates a screen (I1: identical input gives an identical log whatever the network does; I5:
 *   the browser's log stays the record). It only reads the durable log.
 * - It sends only what is new since the last confirmed checkpoint (the server keeps the line count),
 *   at most `LINES_PER_CHUNK` lines a request: one small request to the study's own origin, like
 *   Thinker's.
 */

import type { EngineState } from "../engine/freeze-machine.js";
import type { JudgementStep } from "../session/snapshot.js";
import type { FetchLike } from "./http-uploader.js";
import type { LogHeader, LogRecord } from "./log.js";
import { CHECKPOINT_LABEL, LINES_PER_CHUNK, MAX_CHUNK_BYTES, sessionPartialPath } from "./session-log-protocol.js";
import { sha256Hex } from "./sha256.js";

/**
 * The checkpoint a screen takes, or null: ai_literacy, freeze_v<n> (freeze_vp in the practice view),
 * training, hinge, questionnaire, results_optin (SPEC/36), profile (SPEC/35, `?profiili=heti`), debrief. The screens outside the views also need the engine's matching state.
 */
export function checkpointLabel(step: JudgementStep, view: number, engineState: EngineState): string | null {
  switch (step) {
    // The preflight right after the AI literacy test (revision (ac), 9 Oct 2026): consent and the
    // test's answers are kept even if the session is abandoned before the training.
    case "preflight": return engineState === "PREFLIGHT" ? "ai_literacy" : null;
    case "freeze": return view === 0 ? "freeze_vp" : `freeze_v${view}`;
    case "training": return engineState === "TUTORIAL" ? "training" : null;
    case "hinge_pause": return engineState === "HINGE_PAUSE" ? "hinge" : null;
    // The pre-session item (before the briefing) precedes any data worth keeping.
    case "questionnaire": return engineState === "DEBRIEF_HANDOFF" ? "questionnaire" : null;
    case "debrief": return engineState === "DEBRIEF_HANDOFF" ? "debrief" : null;
    // SPEC/35 §4: a public session's commander profile, after the questionnaire: its answers are kept if the session ends there.
    case "profile": return engineState === "DEBRIEF_HANDOFF" ? "profile" : null;
    // SPEC/36: the results step after the questionnaire (every session); the questionnaire's answers are kept if the session ends there.
    case "results_optin": return engineState === "DEBRIEF_HANDOFF" ? "results_optin" : null;
    default: return null;
  }
}

export type CheckpointOutcome =
  | { readonly status: "stored"; readonly lines: number }
  | { readonly status: "up_to_date" | "busy" | "already_complete" | "left_boundary" | "failed" };

export interface CheckpointSource {
  readonly header: LogHeader;
  /** The durable log so far (`SessionOrchestrator.logRecords`). */
  readonly records: () => Promise<readonly LogRecord[]>;
  /** Whether the screen is still a checkpoint boundary; read before every request. */
  readonly atBoundary: () => boolean;
}

export interface CheckpointerOptions {
  readonly baseUrl?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
  readonly linesPerRequest?: number;
}

export class SessionCheckpointer {
  /** Lines of the session file the server is known to hold. */
  private confirmed = 0;
  private running = false;
  private finished = false;
  private readonly baseUrl: string;
  private readonly doFetch: FetchLike;
  private readonly timeoutMs: number;
  private readonly linesPerRequest: number;

  constructor(private readonly source: CheckpointSource, options: CheckpointerOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    // determinism-lint-allow: checkpoint upload — started only on a halted screen (`checkpointLabel`, re-checked before every request), never awaited by the run (I3).
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.linesPerRequest = options.linesPerRequest ?? LINES_PER_CHUNK;
  }

  /** Appends the lines logged since the last checkpoint. Never throws; one checkpoint at a time (a second call meanwhile is `busy`). */
  async checkpoint(label: string): Promise<CheckpointOutcome> {
    if (this.finished) return { status: "already_complete" };
    if (this.running) return { status: "busy" };
    if (!CHECKPOINT_LABEL.test(label)) return { status: "failed" };
    this.running = true;
    try { return await this.send(label); } catch { return { status: "failed" }; } finally { this.running = false; }
  }

  private async send(label: string): Promise<CheckpointOutcome> {
    if (!this.source.atBoundary()) return { status: "left_boundary" };
    const records = await this.source.records();
    const total = records.length + 1; // the header line + one line per record
    const lineAt = (i: number) => (i === 0 ? JSON.stringify({ header: this.source.header }) : JSON.stringify(records[i - 1]));
    if (this.confirmed >= total) return { status: "up_to_date" };
    let realigned = 0;
    while (this.confirmed < total) {
      if (!this.source.atBoundary()) return { status: "left_boundary" };
      const end = Math.min(total, this.confirmed + this.linesPerRequest);
      let body = "";
      for (let i = this.confirmed; i < end; i++) body += `${lineAt(i)}\n`;
      if (new TextEncoder().encode(body).length > MAX_CHUNK_BYTES) return { status: "failed" }; // never in practice (a line is < 4 KB)
      const res = await this.put(sessionPartialPath(this.source.header.sessionId, this.confirmed, label), body);
      const reply = (res.json ?? {}) as { status?: unknown; lines?: unknown };
      if (res.ok && reply.status === "already_complete") { this.finished = true; return { status: "already_complete" }; }
      if (res.ok && reply.lines === end) { this.confirmed = end; continue; }
      // 409: the server holds another count (a reload, a lost response): continue from it, if it is one this log has.
      if (res.status === 409 && typeof reply.lines === "number" && Number.isInteger(reply.lines) && reply.lines >= 0 && reply.lines <= total && realigned++ < 2) {
        this.confirmed = reply.lines;
        continue;
      }
      return { status: "failed" };
    }
    return { status: "stored", lines: this.confirmed };
  }

  private async put(path: string, body: string): Promise<{ ok: boolean; status: number; json: unknown }> {
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const res = await this.doFetch(`${this.baseUrl}${path}`, {
        method: "PUT", headers: { "content-type": "application/x-ndjson; charset=utf-8", "x-chunk-sha256": sha256Hex(body) }, body,
        ...(controller ? { signal: controller.signal } : {}),
      });
      return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Wires checkpoints to a session's snapshots (the UI calls this once per study session): a checkpoint
 * when a boundary screen appears, deduplicated while it stays; `atBoundary` follows the latest snapshot.
 * Returns the unsubscribe.
 */
export function attachCheckpoints(session: {
  readonly subscribe: (listener: (s: { readonly step: JudgementStep; readonly currentCycle: number }) => void) => () => void;
  readonly engineState: EngineState;
  readonly logHeader: LogHeader;
  readonly logRecords: () => Promise<readonly LogRecord[]>;
}, options: CheckpointerOptions = {}): () => void {
  let label: string | null = null;
  const checkpointer = new SessionCheckpointer({ header: session.logHeader, records: () => session.logRecords(), atBoundary: () => label !== null }, options);
  return session.subscribe((s) => {
    const next = checkpointLabel(s.step, s.currentCycle, session.engineState);
    if (next !== null && next !== label) { label = next; void checkpointer.checkpoint(next); }
    label = next;
  });
}
