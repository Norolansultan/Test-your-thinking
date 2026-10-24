/**
 * Synthetic session files and records for the review tools' specs (`review-fidelity.spec.ts`, `haku-certainty-audit.spec.ts`; 24 Oct
 * 2026): a handful of scenario-like records (step and observation time, certainty, contradictions; the planted record's id) and answer
 * records in the browser log's shape.
 */

import { asVirtualTime } from "../../app/engine/primitives.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { appendTelemetryEvent } from "../../app/telemetry/emit.js";
import { InMemoryLogSink, SessionLog, type LogHeader } from "../../app/telemetry/log.js";
import type { AuditAtom } from "../../app/telemetry/haku-certainty-audit.js";
import type { TelemetryEvent } from "../../app/telemetry/record-kinds.js";

const atom = (id: string, cycle: number, observedAt: number, kind: AuditAtom["provenance"]["certainty"]["kind"], contradicts: string[] = []): AuditAtom =>
  ({ id, cycle, provenance: { observedAt, certainty: { kind }, contradicts } });

/** Step 1 from 0 s, step 2 from 1200 s (`STEP_SECONDS`); 13.20 is virtual 0. */
export const ATOMS: readonly AuditAtom[] = [
  atom("a1", 1, 600, "confirmed"), // 13.30
  atom("a2", 2, 1500, "uncertain", ["a3"]), // 13.45
  atom("a3", 2, 1560, "probable", ["a2"]), // 13.46
  atom("late", 5, 5000, "confirmed"), // reachable from 4800 s only
  atom(DESIGNED_EVENT_IDS.planted, 8, 8500, "confirmed"), // 15.41
];

export function header(sessionId: string, cell: LogHeader["cell"]): LogHeader {
  return {
    formatVersion: "0.16.0", sessionId, participantCode: `P-${sessionId}`, condition: cell === "radio" ? "directed" : "substitutive", scenarioId: "s",
    scenarioVersion: "0", seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest",
    viewport: { w: 1280, h: 800, dpr: 1 }, cell, echelon: "command",
  };
}

export interface AnswerSpec {
  readonly tool?: "haku" | "open_thinker"; readonly view?: number; readonly vt?: number; readonly retrieved?: readonly string[]; readonly recent?: readonly string[];
  readonly vastaus?: string; readonly perusteet?: string; readonly varmuus?: string; readonly fallback?: boolean; readonly fallbackReason?: string | null;
  readonly verdicts?: readonly ("fits" | "departs" | "departure_justifiable" | "not_covered" | null)[]; readonly question?: string;
}

/** An `ai_chat_answer_received` (Haku by default, view 2 at 1300 s). */
export function answer(queryId: string, o: AnswerSpec): TelemetryEvent {
  return {
    kind: "ai_chat_answer_received",
    detail: {
      queryId, text: o.question ?? "q", view: o.view ?? 2, virtualTimeS: o.vt ?? 1300, retrieved: (o.retrieved ?? []).map((id) => ({ id, fusedScore: 1 })), retrievalMode: "hybrid",
      modelId: "m", promptHash: "h", answer: { vastaus: o.vastaus ?? "", perusteet: o.perusteet ?? "", varmuus: o.varmuus ?? "", muuttaisi: "" }, latencyMs: 1,
      fallback: o.fallback ?? false, fallbackReason: o.fallbackReason ?? null, phase: "exploration", promptVariant: "standard", tool: o.tool ?? "haku",
      ...(o.recent ? { recentAtomIds: [...o.recent] } : {}), ...(o.verdicts ? { aiVerdictsExact: [...o.verdicts] } : {}),
    },
  };
}

/** An `ai_chat_query_submitted`, `viaChip` when sent from a chip. */
export function asked(queryId: string, tool: "haku" | "open_thinker", viaChip = false): TelemetryEvent {
  return { kind: "ai_chat_query_submitted", detail: { queryId, text: "q", view: 2, virtualTimeS: 1300, phase: "exploration", tool, ...(viaChip ? { viaChip: true as const } : {}) } };
}

/** A session file (`fire-sim-session-jsonl/1`): the header line, then the records. */
export async function sessionFile(sessionId: string, cell: LogHeader["cell"], events: readonly TelemetryEvent[]): Promise<string> {
  const h = header(sessionId, cell);
  const log = new SessionLog(h, new InMemoryLogSink());
  for (const [i, e] of events.entries()) await appendTelemetryEvent(log, asVirtualTime(0), i, e);
  return [JSON.stringify({ header: h }), ...(await log.readAll()).map((r) => JSON.stringify(r))].join("\n");
}
