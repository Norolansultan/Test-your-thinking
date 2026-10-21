/**
 * Synthetic session logs for the commander-profile tests (SPEC/35 §4): a small builder that numbers records gaplessly and keeps a
 * wall clock, plus freeze answers built from freeze content with a chosen share right and the confidence per answer.
 */

import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";
import type { LatLon } from "../../app/engine/primitives.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import type { FreezeContentLike } from "../../app/telemetry/freeze-measures.js";
import type { FreezeItemAnsweredDetail, TelemetryEvent } from "../../app/telemetry/record-kinds.js";
import type { Cell } from "../../app/scenario/types.js";

export function header(cell: Cell): LogHeader {
  return {
    formatVersion: "0.13.0", sessionId: "profile", participantCode: "p", condition: cell === "radio" ? "directed" : "substitutive", scenarioId: "s",
    scenarioVersion: "0", seed: "1", bundleHash: "b", appVersion: "0", startedAtIso: "2026-01-01T00:00:00.000Z", userAgent: "vitest",
    viewport: { w: 390, h: 844, dpr: 3 }, cell, echelon: "command",
  };
}

export class LogBuilder {
  readonly records: LogRecord[] = [];
  private wallMs = 0;

  /** Appends `event` `afterMs` real ms after the previous record. */
  add(event: TelemetryEvent, afterMs = 1_000): this {
    this.wallMs += afterMs;
    this.records.push({ seq: asSeq(this.records.length), tVirtual: asVirtualTime(0), tWallOffsetMs: this.wallMs, kind: event.kind, detail: event.detail });
    return this;
  }
}

export const sessionStarted = (cell: Cell): TelemetryEvent => ({ kind: "session_started", detail: header(cell) });
export const start = (cycle: number): TelemetryEvent =>
  ({ kind: "cycle_start", detail: { cycle: cycle as never, phase: cycle === 0 ? "practice" : cycle <= 7 ? "A" : "B", clockLabel: "x" } });
export const plan = (posture = "barrier_line"): TelemetryEvent =>
  ({ kind: "allocation_submitted", detail: { plan: { mainEffort: "L3", posture, secondary: null, drones: null } as never, rationaleAsked: false, rationaleFi: null } });
export const revisePlan = (cycle: number): TelemetryEvent =>
  ({ kind: "allocation_revised", detail: { cycle: cycle as never, revision: 1, plan: { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null } as never } });
export const hakuChat = (view: number): TelemetryEvent =>
  ({ kind: "ai_chat_query_submitted", detail: { queryId: `h${view}`, text: "q", view, virtualTimeS: 0, phase: "exploration", tool: "haku" } });
export const guideQuestion = (view: number, tool: "open_thinker" | undefined = "open_thinker"): TelemetryEvent =>
  ({ kind: "ai_chat_query_submitted", detail: { queryId: `g${view}`, text: "q", view, virtualTimeS: 0, phase: "exploration", ...(tool ? { tool } : {}) } });
export const navQuery = (): TelemetryEvent =>
  ({ kind: "nav_query_submitted", detail: { queryId: "n", category: "palo", sourceId: null, window: "latest", resultAtomIds: [], phase: "exploration" } });
export const reviewShown = (cycle: number, atomIds: readonly string[] = []): TelemetryEvent => ({
  kind: "plan_review_shown",
  detail: {
    cycle: cycle as never, atViewSeconds: 90, trigger: "minimum_reached", premiseLines: atomIds.length ? ["line"] : null, tableSha256: null,
    premiseStatuses: atomIds.length ? [{ premiseId: "P1", status: "contradicted", atomIds }] : null,
  },
});
export const recordOpened = (cycle: number, atomId: string): TelemetryEvent => ({ kind: "plan_review_record_opened", detail: { cycle: cycle as never, atomId } });
export const reviewClosed = (cycle: number, choice: "keep" | "revise"): TelemetryEvent => ({ kind: "plan_review_closed", detail: { cycle: cycle as never, choice, dwellMs: 3_000 } });
export const viewEnded = (cycle: number): TelemetryEvent => ({ kind: "view_ended", detail: { cycle: cycle as never, viewSeconds: 120, endedBy: "participant_confirm" } });
export const freezeSubmitted = (cycle: number, responses: readonly FreezeItemAnsweredDetail[]): TelemetryEvent =>
  ({ kind: "freeze_submitted", detail: { cycle: cycle as never, responses } });

const FAR: LatLon = { lat: 0, lon: 0 };

/**
 * Answers to every item of `freeze`: item i (in order across all freezes passed, `offset`) is answered right when `right(i)`, with
 * confidence `confidence(i, right)`. A choice item takes its keyed option or another; a map item taps the key point or a far point.
 */
export function answersFor(
  freeze: FreezeContentLike, right: (i: number) => boolean, confidence: (i: number, right: boolean) => number, offset = 0,
): FreezeItemAnsweredDetail[] {
  return freeze.items.map((item, k) => {
    const i = offset + k, ok = right(i), c = confidence(i, ok);
    if (item.kind === "map_point") return { itemId: item.id, optionId: "map_point", confidence: c, point: ok ? item.mapKey!.point : FAR };
    const option = item.options.find((o) => o.correct === ok)!;
    return { itemId: item.id, optionId: option.id, confidence: c };
  });
}

/** A synthetic freeze of `n` two-option choice items (`a` keyed) for view `cycle`. */
export function syntheticFreeze(cycle: number, n: number): FreezeContentLike {
  return {
    cycle,
    items: Array.from({ length: n }, (_, k) => ({
      id: `s${cycle}.${k}`, level: "L2" as const, promptFi: "x", kind: "choice" as const,
      options: [{ id: "a", labelFi: "a", correct: true }, { id: "b", labelFi: "b", correct: false }],
    })),
  };
}

/** A log answering `freezes` (one view each, a plan per view) with the given right/confidence rules. */
export function freezeLog(freezes: readonly FreezeContentLike[], right: (i: number) => boolean, confidence: (i: number, right: boolean) => number, cell: Cell = "radio"): LogRecord[] {
  const b = new LogBuilder().add(sessionStarted(cell));
  let offset = 0;
  for (const f of freezes) {
    b.add(start(f.cycle)).add(plan()).add(freezeSubmitted(f.cycle, answersFor(f, right, confidence, offset)));
    offset += f.items.length;
  }
  return b.records;
}
