/**
 * Attention records for the exclusion rules (SPEC/09 §6; SPEC/07 §2.1): `window_blur` / `window_focus`
 * when the page loses or regains the participant (the window's blur and focus, and the document
 * hidden or shown, e.g. another tab — one record per change, whichever event comes first), and
 * `idle_start` / `idle_end` after `IDLE_THRESHOLD_MS` of no pointer or keyboard input. Attached by the
 * UI (`useSession.ts`), logged through `SessionOrchestrator.logAttention`; nothing here reaches the
 * world or what the participant sees.
 *
 * Waiting on the session (P1-8, 7 Oct 2026): while a Thinker request is pending or a freeze, a
 * visible probe or a SPAM item is open (`SessionSnapshot.waitingOnSession`), no idle time is counted.
 * An idle period running when such a wait starts ends then (`idle_end` with `endedBy: "wait_started"`),
 * and the 5 s threshold starts again when the wait ends. Chosen over flagging the idle records: a flag
 * on `idle_start` could not say how much of a period overlapped a wait that began or ended inside it,
 * whereas this way every logged idle period is already net of those waits.
 */

import { performanceClock, type RealClockMs } from "./view-clock.js";

/** SPEC/07 §2.1: "Threshold 5 s of no pointer or keyboard input". */
export const IDLE_THRESHOLD_MS = 5_000;

/**
 * Reading time after a Thinker answer (P1-1, 8 Oct 2026): 15 s plus 1 s per 60 characters, at most
 * 60 s, counts as reading, not idle, for Haku's answers and the Open Thinker's alike.
 */
export const READING_BASE_MS = 15_000;
export const READING_MAX_MS = 60_000;
export function readingGraceMsFor(answerChars: number): number {
  return Math.min(READING_MAX_MS, READING_BASE_MS + Math.ceil(Math.max(0, answerChars) / 60) * 1_000);
}

export type AttentionKind = "window_blur" | "window_focus" | "idle_start" | "idle_end";
/** Why an idle period ended without input: a wait on the session started (see the header). */
export interface AttentionDetail { readonly endedBy?: "wait_started" }

/** The pointer and keyboard input that ends an idle period. */
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

type Target = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Starts the listeners and the idle detector; returns the function that removes them (on unmount).
 * The page counts as focused and active when attached. `onWaitingChange` subscribes to whether the
 * participant is waiting on the session (the header); it returns its unsubscribe.
 */
export function trackAttention(
  win: Target,
  doc: Target & { readonly visibilityState: string },
  log: (kind: AttentionKind, detail?: AttentionDetail) => void,
  { idleMs = IDLE_THRESHOLD_MS, now = performanceClock, onWaitingChange }: {
    readonly idleMs?: number; readonly now?: RealClockMs;
    /** Called with whether the participant waits and, when a wait ends, the reading time (ms) that follows it. */
    readonly onWaitingChange?: (listener: (waiting: boolean, readingMs?: number) => void) => () => void;
  } = {},
): () => void {
  let away = false;
  let idle = false;
  let waiting = false;
  let lastInputMs = now();
  let readingUntilMs = 0; // after an answer: no idle period starts before this (P1-1)
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };

  const leave = () => { if (!away) { away = true; log("window_blur"); } };
  const back = () => { if (away) { away = false; log("window_focus"); } };
  const onVisibility = () => (doc.visibilityState === "hidden" ? leave() : back());

  // The timer is set once per idle period and re-checks the last input, rather than restarted on every pointer move.
  const check = () => {
    const leftMs = Math.max(lastInputMs + idleMs, readingUntilMs) - now();
    if (leftMs <= 0) { timer = null; idle = true; log("idle_start"); } else timer = setTimeout(check, leftMs);
  };
  const onInput = () => {
    lastInputMs = now();
    if (idle) { idle = false; log("idle_end"); }
    if (timer === null && !waiting) timer = setTimeout(check, idleMs);
  };
  const setWaiting = (next: boolean, readingMs = 0) => {
    if (next === waiting) return;
    waiting = next;
    if (waiting) {
      clearTimer();
      readingUntilMs = 0;
      if (idle) { idle = false; log("idle_end", { endedBy: "wait_started" }); }
    } else {
      lastInputMs = now();
      readingUntilMs = lastInputMs + readingMs;
      timer = setTimeout(check, idleMs + readingMs);
    }
  };

  win.addEventListener("blur", leave);
  win.addEventListener("focus", back);
  doc.addEventListener("visibilitychange", onVisibility);
  for (const e of ACTIVITY_EVENTS) win.addEventListener(e, onInput, { capture: true, passive: true });
  timer = setTimeout(check, idleMs);
  const unsubscribeWaiting = onWaitingChange?.(setWaiting);

  return () => {
    win.removeEventListener("blur", leave);
    win.removeEventListener("focus", back);
    doc.removeEventListener("visibilitychange", onVisibility);
    for (const e of ACTIVITY_EVENTS) win.removeEventListener(e, onInput, { capture: true });
    unsubscribeWaiting?.();
    clearTimer();
  };
}
