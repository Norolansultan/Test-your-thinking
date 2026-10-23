/**
 * The play harness's virtual clock (`tools/play/`): the session's timers and its real-time reading on one simulated millisecond
 * count, so a headless session runs exactly as the browser's would, only as fast as the machine allows and the same on every
 * replay. The same idea as the specs' fake timers (`vi.useFakeTimers` with `realClockMs: () => Date.now()`), without vitest:
 *
 * - `install` swaps the global `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` for a queue on virtual time (the
 *   orchestrator's view cues, the freeze cap, SPAM's answer window, the Thinker latency floor, the pretest and AI-literacy caps all
 *   use them); `uninstall` puts the originals back. `setImmediate` is left real: it is how the queue lets promise chains settle.
 * - `now` is the session's `realClockMs` (`SessionOptions.realClockMs`), so every `tWallOffsetMs` is virtual too.
 * - `advance(ms)` fires every timer due up to `now + ms` in time order (ties in the order they were set), letting the promise
 *   chains each one starts settle before the next, as vitest's `advanceTimersByTimeAsync` does.
 *
 * Deterministic (I1): no wall clock is read; the queue's order is (due time, insertion order).
 */

interface Timer {
  readonly id: number;
  at: number;
  readonly seq: number;
  readonly fn: (...args: unknown[]) => void;
  readonly args: readonly unknown[];
  readonly everyMs: number | null;
}

type TimerFn = (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => unknown;

const realImmediate = globalThis.setImmediate;
/** Lets every promise chain started so far settle (microtasks drain before the next macrotask). */
export async function settle(turns = 2): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise<void>((resolve) => realImmediate(resolve));
}

export class VirtualClock {
  private nowMs = 0;
  private seq = 0;
  private nextId = 1;
  private timers: Timer[] = [];
  private saved: { setTimeout: unknown; clearTimeout: unknown; setInterval: unknown; clearInterval: unknown } | null = null;

  /** Virtual milliseconds since the clock was made: the session's real clock. */
  readonly now = (): number => this.nowMs;

  /** Replaces the global timer functions with this clock's queue (once; `uninstall` restores them). */
  install(): this {
    if (this.saved) return this;
    const g = globalThis as unknown as Record<string, unknown>;
    this.saved = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, setInterval: g.setInterval, clearInterval: g.clearInterval };
    const add = (everyMs: number | null): TimerFn => (fn, ms = 0, ...args) => {
      const delay = Math.max(0, Number.isFinite(ms) ? ms : 0);
      const timer: Timer = { id: this.nextId++, at: this.nowMs + delay, seq: this.seq++, fn, args, everyMs: everyMs === null ? null : Math.max(1, delay) };
      this.timers.push(timer);
      return timer.id;
    };
    const clear = (id: unknown) => { this.timers = this.timers.filter((t) => t.id !== Number(id)); };
    g.setTimeout = add(null);
    g.setInterval = (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => add(0)(fn, ms, ...args);
    g.clearTimeout = clear;
    g.clearInterval = clear;
    return this;
  }

  uninstall(): void {
    if (!this.saved) return;
    const g = globalThis as unknown as Record<string, unknown>;
    g.setTimeout = this.saved.setTimeout; g.clearTimeout = this.saved.clearTimeout;
    g.setInterval = this.saved.setInterval; g.clearInterval = this.saved.clearInterval;
    this.saved = null;
  }

  /** The timers still waiting (for the harness's sanity checks). */
  pending(): number { return this.timers.length; }

  /**
   * Advances virtual time by `ms`, firing every timer due on the way, in order. `stop` is asked after each timer (and before the
   * first): when it says so, time stops at that timer's moment and the rest of `ms` is not spent. Returns the milliseconds spent.
   */
  async advance(ms: number, stop: () => boolean = () => false): Promise<number> {
    const start = this.nowMs;
    const target = this.nowMs + Math.max(0, ms);
    await settle();
    for (;;) {
      if (stop()) return this.nowMs - start;
      const next = this.nextDue(target);
      if (!next) break;
      this.nowMs = next.at;
      if (next.everyMs === null) this.timers = this.timers.filter((t) => t !== next);
      else next.at += next.everyMs;
      next.fn(...next.args);
      await settle();
    }
    this.nowMs = target;
    await settle();
    return this.nowMs - start;
  }

  /** Runs whatever is due now (zero-delay timers) without moving time. */
  async flush(): Promise<void> { await this.advance(0); }

  private nextDue(target: number): Timer | null {
    let best: Timer | null = null;
    for (const t of this.timers) {
      if (t.at > target) continue;
      if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
    }
    return best;
  }
}
