/**
 * SPEC/30 §5.4 (19 Oct 2026): the interaction records the render layer emits for the first time — `pointer_track`,
 * `query_focus` / `query_first_keystroke` / `query_edit`, `probe_option_hovered`, `probe_answer_changed` and
 * `frame_stats`. Raw events only (SPEC/07 §1): nothing derived, no correctness, no typed text (SPEC/07 §3; `query_edit`
 * carries a count). Each record is stamped by the session as every other one is (`tVirtual`, `tWallOffsetMs`), so
 * the screen reads no clock to time them.
 *
 * They reach the log through the session's `logMapUse`, the render layer's one channel for its own raw records
 * (SPEC/07 revision (al)). Its type lists the map's kinds; this adapter is the one place that widens it. The
 * integrator may add `InteractionKind` to `MapUseEvent` in `app/session/orchestrator.ts` (the cast below then
 * becomes a no-op); nothing else changes.
 */

import type { MapUseEvent, SessionOrchestrator } from "../../session/orchestrator.js";
import type { TelemetryEvent } from "../../telemetry/record-kinds.js";

export type InteractionKind =
  | "pointer_track" | "query_focus" | "query_first_keystroke" | "query_edit" | "probe_option_hovered" | "probe_answer_changed" | "frame_stats";
export type InteractionEvent = Extract<TelemetryEvent, { readonly kind: InteractionKind }>;
/** Appends one record; resolves once it is durable (I5), rejects when the log refused it. */
export type InteractionLog = (event: InteractionEvent) => Promise<unknown>;

/** The session's log for the interaction records (`logMapUse`, which appends any record and resolves to its seq). */
export function interactionLog(orchestrator: Pick<SessionOrchestrator, "logMapUse">): InteractionLog {
  return (event) => orchestrator.logMapUse(event as unknown as MapUseEvent);
}

/** Fire and forget, for a record the screen does not wait on (a hover, a pointer sample): a refused write is not retried. */
export function quietly(log: InteractionLog): (event: InteractionEvent) => void {
  return (event) => { void log(event).catch(() => undefined); };
}
