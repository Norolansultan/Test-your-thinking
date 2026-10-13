import type { Lang } from "../../i18n/lang.js";
import { useEffect, useRef, useState } from "preact/hooks";
import { SessionOrchestrator, type SessionResume, type SessionSnapshot } from "../../session/orchestrator.js";
import { trackAttention } from "../../session/attention.js";
import type { Cell, ScenarioContract } from "../../scenario/types.js";
import type { PreviewOverride, SessionAssignment } from "../../session/preview.js";
import type { HeaderAnnotations } from "../../session/header.js";
import type { LogSink } from "../../telemetry/log.js";
import type { SessionStatus } from "../../telemetry/session-registry.js";

/**
 * How the browser session stores its log (SPEC/05 §9; `SessionLauncher.tsx`): the durable sink, the
 * header's annotations, a resume, the registry's status update, and whether this is a demonstration
 * (the export is then always offered). Absent: the in-memory sink and fixed annotations.
 */
export interface SessionPersistence {
  readonly sink: LogSink;
  readonly annotations?: HeaderAnnotations;
  readonly resume?: SessionResume;
  readonly setStatus?: (status: SessionStatus) => Promise<void>;
  readonly demo: boolean;
}

/** The intro video before the practice view (`app/render/ui/public/video/`). */
export const INTRO_VIDEO_SRC = "/video/intro.mp4";

export function useSession(scenario: ScenarioContract, condition: "directed" | "substitutive", previewOverride: PreviewOverride | null, language: Lang = "fi", showProbeLevels = true, guidedTour = false, cell?: Cell,
  start: { readonly participantCode?: string; readonly assignment?: SessionAssignment; readonly studyShell?: boolean; readonly allowPreflightOverride?: boolean; readonly allowViewSkip?: boolean } = {}, persistence?: SessionPersistence) {
  const orchestratorRef = useRef<SessionOrchestrator | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  if (!orchestratorRef.current) {
    orchestratorRef.current = new SessionOrchestrator(scenario, condition, {
      // The AI literacy test after consent runs in every session the study shell runs (revision (ac)): every cell, study and demonstration.
      // So does the intro video before the practice view (10 Oct 2026).
      previewOverride, language, showProbeLevels, guidedTour, visibleProbes: true, aiLiteracyTest: true, introVideo: INTRO_VIDEO_SRC, ...(cell ? { cell } : {}), ...start,
      ...(persistence ? { sink: persistence.sink } : {}),
      ...(persistence?.annotations ? { annotations: persistence.annotations } : {}),
      ...(persistence?.resume ? { resume: persistence.resume } : {}),
    });
  }

  useEffect(() => {
    const orchestrator = orchestratorRef.current!;
    const unsubscribe = orchestrator.subscribe(setSnapshot);
    void orchestrator.start();
    // Blur, focus and idle records for the exclusion rules (SPEC/09 §6), removed on unmount.
    // Idle time is not counted while the participant waits on the session (`attention.ts`, P1-8).
    const detachAttention = trackAttention(window, document, (kind, detail) => void orchestrator.logAttention(kind, detail), {
      onWaitingChange: (listener) => orchestrator.subscribe((s) => listener(s.waitingOnSession, s.readingGraceMs)),
    });
    return () => { detachAttention(); unsubscribe(); };
  }, []);

  return { snapshot, orchestrator: orchestratorRef.current };
}
