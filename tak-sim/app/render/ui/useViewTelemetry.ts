/**
 * The view-level interaction records (SPEC/30 §5.4), mounted once for the session's screen: the pointer track
 * (`pointer-tracker.ts`) and the frame statistics (`frame-stats.ts`). Called in `SessionView`'s body before any early
 * return (hooks run in the same order every render), with the snapshot and the orchestrator `useSession` gives (null
 * before the session starts). Records go through `interactionLog`; nothing here reaches the world or the screen. The
 * last view's frame record is written when the post-session questionnaire (or the end) replaces V14, and never once the
 * engine is finished.
 */

import { useEffect, useRef } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../session/orchestrator.js";
import { browserFrameSource, ViewFrameStats } from "./frame-stats.js";
import { interactionLog, quietly, type InteractionEvent } from "./interaction-log.js";
import { TERMINAL_STATES } from "../../engine/freeze-machine.js";
import { inView, PointerSampler, pointerTrackView, timerSchedule, trackPointer } from "./pointer-tracker.js";

/** The view whose frames are collected now: any view, VP included, its freeze included; null between views. */
export function frameStatsView(snapshot: Pick<SessionSnapshot, "step" | "currentCycle"> | null): number | null {
  return inView(snapshot) ? snapshot!.currentCycle : null;
}

export function useViewTelemetry(snapshot: SessionSnapshot | null, orchestrator: SessionOrchestrator | null): void {
  const trackers = useRef<{ readonly pointer: PointerSampler; readonly frames: ViewFrameStats } | null>(null);
  const pointerView = pointerTrackView(snapshot);
  const frameView = frameStatsView(snapshot);

  useEffect(() => {
    if (!orchestrator || typeof window === "undefined") return undefined;
    const append = quietly(interactionLog(orchestrator));
    // No record may follow `session_completed` (as the TAK shell's unmount records, `tak/shell.ts`): nothing once the engine is finished.
    const log = (event: InteractionEvent) => { if (!TERMINAL_STATES.has(orchestrator.engineState)) append(event); };
    const pointer = new PointerSampler((detail) => log({ kind: "pointer_track", detail }), timerSchedule);
    const frames = new ViewFrameStats((detail) => log({ kind: "frame_stats", detail }), browserFrameSource(window, document));
    const detachPointer = trackPointer(window, pointer);
    trackers.current = { pointer, frames };
    return () => {
      detachPointer();
      pointer.dispose();
      frames.end();
      trackers.current = null;
    };
  }, [orchestrator]);

  useEffect(() => { trackers.current?.pointer.setView(pointerView); }, [pointerView, orchestrator]);
  useEffect(() => { trackers.current?.frames.setView(frameView); }, [frameView, orchestrator]);
}
