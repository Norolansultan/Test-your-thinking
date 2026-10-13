/**
 * The AI literacy questionnaire (researcher request, 9 Oct 2026; SPEC/15 and SPEC/09 revision (ac),
 * amended: SNAIL, `ai-literacy-items.ts`), the first task after consent, before the preflight. Split
 * out of `orchestrator.ts` like `spam-delivery.ts`: the orchestrator owns the step, this owns the
 * questionnaire.
 *
 * - Four items per screen, in one fixed order; each item is rated 1–7 by a click, logged at once
 *   (`ai_literacy_answered`; a changed rating is logged again and the last counts). "Next" needs
 *   every item on the screen rated; no going back. Self-report: nothing is right or wrong.
 * - A 5-minute cap (`AI_LITERACY_TIME_LIMIT_MS`) from the screen's appearance, on the ordinary
 *   timers (so `vi` fake timers drive it in tests); the screen shows the countdown (`secondsLeft`).
 * - Three endings, logged as `ai_literacy_submitted.endReason`: `completed` ("Next" on the last
 *   screen), `timeout` (the cap), `skipped` (the participant's "Skip the test", available on every
 *   screen, before any rating too). Every rating given so far is kept, including those on the screen
 *   the cap or the skip interrupts; every unrated item is missing (null).
 * - Nothing here computes a score (SPEC/07 §3); the analysis computes the TU/CA/PA subscale means
 *   over the rated items (`app/telemetry/ai-literacy-score.ts`).
 * - Resume: the questionnaire reopens on the first screen with an item not yet rated; the ratings
 *   already logged are kept and shown; the clock gets the limit less the active time already logged
 *   (the sum of `timeOnItemMs`; time after the last rating before the interruption is not charged).
 *   A questionnaire that had ended is not shown again.
 *
 * Every operation runs in order on one queue, so the cap firing while a rating is being written
 * cannot end the questionnaire twice, and a rating arriving after the end is refused.
 */

import type { Lang } from "../i18n/lang.js";
import type { LogRecord } from "../telemetry/log.js";
import type { AiLiteracyAnsweredDetail, AiLiteracyEndReason, TelemetryEvent } from "../telemetry/record-kinds.js";
import {
  AI_LITERACY_INSTRUMENT_ID, AI_LITERACY_ITEMS, AI_LITERACY_ITEMS_PENDING, AI_LITERACY_ITEMS_PER_PAGE, AI_LITERACY_PAGES, AI_LITERACY_SCALE,
  AI_LITERACY_TIME_LIMIT_MS, AI_LITERACY_VERSION,
} from "./ai-literacy-items.js";

/** An item as the screen shows it: the completion of "I can…" in the session language. */
export interface AiLiteracyItemView {
  readonly id: string;
  /** 1-based. */
  readonly position: number;
  readonly text: string;
}

/** The questionnaire on screen (step `ai_literacy`). */
export interface AiLiteracyView {
  /** 0-based screen, and how many there are. */
  readonly page: number;
  readonly pageCount: number;
  readonly items: readonly AiLiteracyItemView[];
  /** This screen's ratings so far (null: not rated). */
  readonly ratings: Readonly<Record<string, number | null>>;
  readonly scale: { readonly min: number; readonly max: number };
  readonly itemCount: number;
  readonly answeredCount: number;
  readonly timeLimitMs: number;
  /** The items are a placeholder (`AI_LITERACY_ITEMS_PENDING`). */
  readonly itemsPending: boolean;
}

const itemById = new Map(AI_LITERACY_ITEMS.map((i) => [i.id, i]));
const pageOf = (itemId: string) => Math.floor(AI_LITERACY_ITEMS.findIndex((i) => i.id === itemId) / AI_LITERACY_ITEMS_PER_PAGE);

/** Validates a rating: an integer on the scale. */
export function checkAiLiteracyRating(itemId: string, rating: unknown): number {
  if (!itemById.has(itemId)) throw new RangeError(`ai literacy: "${itemId}" is not an item`);
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < AI_LITERACY_SCALE.min || rating > AI_LITERACY_SCALE.max) {
    throw new RangeError(`ai literacy: ${String(rating)} is not a rating of ${itemId}`);
  }
  return rating;
}

/** The ratings already logged (the last per item), for a resume and for the analysis. */
export function keptAiLiteracyAnswers(records: readonly LogRecord[]): Map<string, number> {
  const kept = new Map<string, number>();
  for (const r of records) {
    if (r.kind !== "ai_literacy_answered") continue;
    const d = r.detail as AiLiteracyAnsweredDetail;
    if (itemById.has(d.itemId)) kept.set(d.itemId, d.response);
  }
  return kept;
}

/** The active time already logged (the sum of `timeOnItemMs`), charged against the cap on a resume. */
export function aiLiteracySpentMs(records: readonly LogRecord[]): number {
  return records.reduce((sum, r) => sum + (r.kind === "ai_literacy_answered" ? (r.detail as AiLiteracyAnsweredDetail).timeOnItemMs : 0), 0);
}

/** Whether the questionnaire has ended in this log (any reason): a resume does not show it again. */
export function aiLiteracyEnded(records: readonly LogRecord[]): boolean {
  return records.some((r) => r.kind === "ai_literacy_submitted");
}

export interface AiLiteracyHost {
  event(event: TelemetryEvent): Promise<unknown>;
  notify(): void;
  realMs(): number;
  /** The questionnaire has ended and its end record is durable: the session moves on (to the preflight). */
  ended(): Promise<void>;
}

export class AiLiteracyTest {
  private ratings = new Map<string, number>();
  private state: "idle" | "running" | "ended" = "idle";
  private page = 0;
  private startedMs = 0;
  private deadlineMs = 0;
  private lastEventMs = 0; // the screen's appearance or its last rating
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly host: AiLiteracyHost, private readonly lang: Lang) {}

  /** Shows the questionnaire: logs `ai_literacy_started` and starts the cap (`kept`, `spentMs`: from before a resume). */
  start(kept: ReadonlyMap<string, number> = new Map(), spentMs = 0, resumed = false): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "idle") throw new Error("ai literacy: already started");
      this.ratings = new Map(kept);
      const remainingMs = Math.max(0, AI_LITERACY_TIME_LIMIT_MS - spentMs);
      const firstOpen = AI_LITERACY_PAGES.findIndex((p) => p.some((i) => !kept.has(i.id)));
      this.page = firstOpen === -1 ? AI_LITERACY_PAGES.length - 1 : firstOpen;
      this.state = "running";
      this.startedMs = this.lastEventMs = this.host.realMs();
      this.deadlineMs = this.startedMs + remainingMs;
      await this.host.event({ kind: "ai_literacy_started", detail: {
        instrumentId: AI_LITERACY_INSTRUMENT_ID, version: AI_LITERACY_VERSION, itemIds: AI_LITERACY_ITEMS.map((i) => i.id),
        timeLimitMs: AI_LITERACY_TIME_LIMIT_MS, itemsPerPage: AI_LITERACY_ITEMS_PER_PAGE, firstPage: this.page, remainingMs, resumed,
        keptItemIds: AI_LITERACY_ITEMS.filter((i) => kept.has(i.id)).map((i) => i.id), itemsPending: AI_LITERACY_ITEMS_PENDING,
      } });
      if (firstOpen === -1) return this.finish("completed"); // every item kept: only the end was lost
      if (remainingMs === 0) return this.finish("timeout");
      this.lastEventMs = this.host.realMs();
      this.timer = setTimeout(() => void this.enqueue(() => this.finish("timeout")).catch(() => undefined), remainingMs);
    });
  }

  view(): AiLiteracyView | null {
    if (this.state !== "running") return null;
    const items = AI_LITERACY_PAGES[this.page]!;
    return {
      page: this.page, pageCount: AI_LITERACY_PAGES.length,
      items: items.map((i) => ({ id: i.id, position: AI_LITERACY_ITEMS.indexOf(i) + 1, text: this.lang === "en" ? i.en : i.fi })),
      ratings: Object.fromEntries(items.map((i) => [i.id, this.ratings.get(i.id) ?? null])),
      scale: { min: AI_LITERACY_SCALE.min, max: AI_LITERACY_SCALE.max },
      itemCount: AI_LITERACY_ITEMS.length, answeredCount: this.ratings.size, timeLimitMs: AI_LITERACY_TIME_LIMIT_MS, itemsPending: AI_LITERACY_ITEMS_PENDING,
    };
  }

  /** Whole seconds left on the cap (the countdown), 0 once ended. */
  secondsLeft(): number { return this.state === "running" ? Math.max(0, Math.ceil((this.deadlineMs - this.host.realMs()) / 1000)) : 0; }

  /** An item on the current screen rated (again): logged at once. */
  answer(itemId: string, rating: unknown): Promise<void> {
    let checked: number;
    try { checked = checkAiLiteracyRating(itemId, rating); } catch (e) { return Promise.reject(e); }
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("ai literacy: the questionnaire has ended");
      if (pageOf(itemId) !== this.page) throw new Error(`ai literacy: ${itemId} is not on the screen`);
      const now = this.host.realMs();
      const timeOnItemMs = Math.max(0, Math.round(now - this.lastEventMs));
      this.lastEventMs = now;
      this.ratings.set(itemId, checked);
      const item = itemById.get(itemId)!;
      await this.host.event({ kind: "ai_literacy_answered", detail: { itemId, sourceItemId: item.variable, position: AI_LITERACY_ITEMS.indexOf(item) + 1, page: this.page, response: checked, timeOnItemMs } });
      this.host.notify();
    });
  }

  /** "Next": every item on the screen rated; the last screen ends the questionnaire (`completed`). */
  next(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("ai literacy: the questionnaire has ended");
      const open = AI_LITERACY_PAGES[this.page]!.filter((i) => !this.ratings.has(i.id));
      if (open.length > 0) throw new Error(`ai literacy: ${open.map((i) => i.id).join(", ")} not rated`);
      if (this.page === AI_LITERACY_PAGES.length - 1) return this.finish("completed");
      this.page += 1;
      this.lastEventMs = this.host.realMs();
      this.host.notify();
    });
  }

  /** "Skip the test": the ratings given so far are submitted, the rest missing. */
  skip(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== "running") throw new Error("ai literacy: the questionnaire has ended");
      await this.finish("skipped");
    });
  }

  /** Clears the cap's timer (the session is torn down). */
  dispose(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }

  private async finish(endReason: AiLiteracyEndReason): Promise<void> {
    if (this.state !== "running") return;
    this.state = "ended";
    this.dispose();
    const responses = AI_LITERACY_ITEMS.map((i) => ({ itemId: i.id, response: this.ratings.get(i.id) ?? null }));
    await this.host.event({ kind: "ai_literacy_submitted", detail: {
      endReason, version: AI_LITERACY_VERSION, responses, itemCount: AI_LITERACY_ITEMS.length,
      answeredCount: responses.filter((r) => r.response !== null).length, missingItemIds: responses.filter((r) => r.response === null).map((r) => r.itemId),
      durationMs: Math.max(0, Math.round(this.host.realMs() - this.startedMs)), timeLimitMs: AI_LITERACY_TIME_LIMIT_MS,
    } });
    await this.host.ended();
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
