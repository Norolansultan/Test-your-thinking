/**
 * Hover records (SPEC/30 §5.4, 19 Oct 2026: `decision_option_hovered` in the plan panel, `probe_option_hovered` in the
 * SPAM card). An option counts as hovered once the pointer has rested on it for {@link HOVER_DWELL_MS} — a pointer
 * sweeping across the options logs nothing — and once per entry: resting on it logs it once, until the pointer leaves
 * and comes back. Only timers, never a clock reading or a random draw (I1); the records are raw (the analysis derives
 * what it needs, SPEC/07 §1).
 */

import { useEffect, useRef } from "preact/hooks";

/** The minimum dwell before an option counts as hovered (ms). */
export const HOVER_DWELL_MS = 150;

/** The timers a dwell runs on (the browser's by default; tests pass fakes). */
export interface DwellTimers {
  readonly set: (fire: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
}

const BROWSER_TIMERS: DwellTimers = {
  set: (fire, ms) => setTimeout(fire, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface Entry {
  readonly id: string;
  handle: unknown;
}

/** One pointer over one group of options: the option entered, and its dwell timer. */
export class HoverDwell {
  private current: Entry | null = null;

  constructor(private readonly onDwell: (optionId: string) => void, private readonly timers: DwellTimers = BROWSER_TIMERS, private readonly ms: number = HOVER_DWELL_MS) {}

  /** The pointer entered `optionId`: it counts once it has stayed `ms`. */
  enter(optionId: string): void {
    this.leave();
    const entry: Entry = { id: optionId, handle: null };
    entry.handle = this.timers.set(() => {
      if (this.current !== entry) return;
      entry.handle = null;
      this.onDwell(optionId);
    }, this.ms);
    this.current = entry;
  }

  /** The pointer left `optionId` (or any option, without an id): a dwell not yet reached is dropped. */
  leave(optionId?: string): void {
    const entry = this.current;
    if (!entry || (optionId !== undefined && entry.id !== optionId)) return;
    if (entry.handle !== null) this.timers.clear(entry.handle);
    this.current = null;
  }
}

export interface HoverHandlers {
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
}

/** The pointer handlers for each option of one group; `onDwell` gets the option's id once its dwell is reached. */
export function useHoverDwell(onDwell: (optionId: string) => void): (optionId: string) => HoverHandlers {
  const callback = useRef(onDwell);
  callback.current = onDwell;
  const dwell = useRef<HoverDwell | null>(null);
  if (dwell.current === null) dwell.current = new HoverDwell((id) => callback.current(id));
  useEffect(() => () => dwell.current?.leave(), []);
  return (optionId) => ({ onPointerEnter: () => dwell.current!.enter(optionId), onPointerLeave: () => dwell.current!.leave(optionId) });
}
