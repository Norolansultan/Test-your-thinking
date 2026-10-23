/**
 * The map-reading pretest (difficulty audit, 23 Oct 2026; `docs/audits/2026-10-23-difficulty/proposal-map.md` c.2): five or six
 * multiple-choice items on a neutral extract of the basemap (around Kaitajärvi, north-east of the incident and outside it), built and
 * keyed by `tools/review/map-pretest.ts` (`content/pretest/map-pretest.json`; the key is in `map-pretest.key.json`, analysis only).
 * Split out of `orchestrator.ts`, which owns the step (`map_pretest`): after the pre-session item (and the primer in a public session),
 * before the intro video and the practice view, identical in both groups and both audiences (`SessionOptions.mapPretest`).
 *
 * - One item at a time beside the extract, in a fixed order, its options in a fixed order; a choice is final ("Next"), no going back.
 *   No confidence item, no feedback of any kind, and the score is never shown: a covariate for the map-dependent freeze items only
 *   (SPEC/08, SPEC/09), never an exclusion criterion.
 * - A 4-minute cap on the whole pretest from its appearance (`timeLimitMs`), on the ordinary timers; the items not answered by then
 *   are missing.
 * - Records (format 0.15.0): `map_pretest_started`, one `map_pretest_answer {itemId, choiceId, position, rtMs}` per item, and
 *   `map_pretest_completed {endReason, answeredCount, missingItemIds, durationMs}`. Nothing is scored here.
 * - Resume: the pretest reopens on the first unanswered item; the answers logged stand, and the cap is what is left after the active
 *   time already logged (the sum of `rtMs`). A pretest that had ended is not shown again.
 */

import type { Lang } from "../i18n/lang.js";
import type { LogRecord } from "../telemetry/log.js";
import type { MapPretestAnswerDetail, MapPretestEndReason, TelemetryEvent } from "../telemetry/record-kinds.js";
import type { MapPretestSpec } from "../render/ui/pretest-overlay.js";
import pretestSpec from "../../content/pretest/map-pretest.json" with { type: "json" };

export const MAP_PRETEST: MapPretestSpec = pretestSpec as MapPretestSpec;

/** The item on screen, in the session language (no key). */
export interface MapPretestView {
  readonly itemId: string;
  /** 1-based, of `itemCount`. */
  readonly position: number;
  readonly itemCount: number;
  readonly stem: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly timeLimitMs: number;
}

/** The answers already logged, for a resume (an item answered twice keeps its first answer: no going back). */
export function keptPretestAnswers(records: readonly LogRecord[]): Map<string, string> {
  const kept = new Map<string, string>();
  for (const r of records) {
    if (r.kind !== "map_pretest_answer") continue;
    const d = r.detail as MapPretestAnswerDetail;
    if (!kept.has(d.itemId)) kept.set(d.itemId, d.choiceId);
  }
  return kept;
}
/** The active time already logged (the sum of `rtMs`), charged against the cap on a resume. */
export function pretestSpentMs(records: readonly LogRecord[]): number {
  return records.reduce((s, r) => s + (r.kind === "map_pretest_answer" ? (r.detail as MapPretestAnswerDetail).rtMs : 0), 0);
}
/** Whether the pretest has ended in this log: a resume does not show it again. */
export function mapPretestEnded(records: readonly LogRecord[]): boolean {
  return records.some((r) => r.kind === "map_pretest_completed");
}

export interface MapPretestHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  /** The pretest has ended and its end record is durable: the session moves on (to the intro video and the practice view). */
  ended(): Promise<void>;
}

export class MapPretest {
  private answers = new Map<string, string>();
  private state: "idle" | "running" | "ended" = "idle";
  private index = 0;
  private startedMs = 0;
  private shownMs = 0; // the current item's appearance
  private deadlineMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly host: MapPretestHost, private readonly lang: Lang, private readonly spec: MapPretestSpec = MAP_PRETEST) {}

  /** Shows the pretest: logs `map_pretest_started` and starts the cap (`kept`, `spentMs`: from before a resume). */
  start(kept: ReadonlyMap<string, string> = new Map(), spentMs = 0, resumed = false): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "idle") throw new Error("map pretest: already started");
      this.answers = new Map(kept);
      const first = this.spec.items.findIndex((i) => !kept.has(i.id));
      this.index = first === -1 ? this.spec.items.length - 1 : first;
      const remainingMs = Math.max(0, this.spec.timeLimitMs - spentMs);
      this.state = "running";
      this.startedMs = this.shownMs = this.host.realMs();
      this.deadlineMs = this.startedMs + remainingMs;
      await this.host.event({ kind: "map_pretest_started", detail: {
        version: this.spec.version, itemIds: this.spec.items.map((i) => i.id), timeLimitMs: this.spec.timeLimitMs, remainingMs, resumed,
        keptItemIds: this.spec.items.filter((i) => kept.has(i.id)).map((i) => i.id),
      } });
      if (first === -1) return this.finish("completed");
      if (remainingMs === 0) return this.finish("timeout");
      this.shownMs = this.host.realMs();
      this.timer = setTimeout(() => void this.enqueue(() => this.finish("timeout")).catch(() => undefined), remainingMs);
    });
  }

  view(): MapPretestView | null {
    if (this.state !== "running") return null;
    const item = this.spec.items[this.index]!;
    return {
      itemId: item.id, position: this.index + 1, itemCount: this.spec.items.length, timeLimitMs: this.spec.timeLimitMs,
      stem: item.stem[this.lang], options: item.options.map((o) => ({ id: o.id, label: o[this.lang] })),
    };
  }

  /** Whole seconds left on the cap (the countdown), 0 once ended. */
  secondsLeft(): number { return this.state === "running" ? Math.max(0, Math.ceil((this.deadlineMs - this.host.realMs()) / 1000)) : 0; }

  /** The item on screen answered and left ("Next"): logged at once; the last item ends the pretest (`completed`). */
  answer(itemId: string, choiceId: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("map pretest: it has ended");
      const item = this.spec.items[this.index]!;
      if (item.id !== itemId) throw new Error(`map pretest: ${itemId} is not on the screen`);
      if (!item.options.some((o) => o.id === choiceId)) throw new RangeError(`map pretest: "${choiceId}" is not an option of ${itemId}`);
      const now = this.host.realMs();
      this.answers.set(itemId, choiceId);
      await this.host.event({ kind: "map_pretest_answer", detail: { itemId, choiceId, position: this.index + 1, rtMs: Math.max(0, Math.round(now - this.shownMs)) } });
      if (this.index === this.spec.items.length - 1) return this.finish("completed");
      this.index += 1;
      this.shownMs = this.host.realMs();
      this.host.notify();
    });
  }

  /** Clears the cap's timer (the session is torn down). */
  dispose(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }

  private async finish(endReason: MapPretestEndReason): Promise<void> {
    if (this.state !== "running") return;
    this.state = "ended";
    this.dispose();
    const missingItemIds = this.spec.items.filter((i) => !this.answers.has(i.id)).map((i) => i.id);
    await this.host.event({ kind: "map_pretest_completed", detail: {
      endReason, answeredCount: this.spec.items.length - missingItemIds.length, missingItemIds, durationMs: Math.max(0, Math.round(this.host.realMs() - this.startedMs)),
    } });
    await this.host.ended();
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
