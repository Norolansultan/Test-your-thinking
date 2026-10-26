/**
 * SPEC/35: the public-audience setting as the UI sees it. The session shell provides it (work package P1); the
 * explanation layer (P2: glossary marks, the help card) reads it and reports its use through the callbacks, which
 * the shell writes as records (`glossary_opened`, `help_card_opened`). Expert sessions get the default: no layer.
 */

import { createContext } from "preact";
import { useContext } from "preact/hooks";

export type Audience = "expert" | "public";

/** Where a glossary term was opened (SPEC/35 §3 item 2); `training`: a training-incident text (SPEC/35 (bp)). */
export type GlossarySurface = "message_log" | "record" | "freeze" | "spam" | "plan" | "review" | "search" | "guide" | "help_card" | "training" | "other";

export type HelpCardSection = "glossary" | "roster" | "legend";

export interface AudienceInfo {
  readonly audience: Audience;
  /** A glossary term's definition was shown. */
  readonly onGlossaryOpened: (termId: string, surface: GlossarySurface) => void;
  /** A help-card section was opened. */
  readonly onHelpCardOpened: (section: HelpCardSection) => void;
}

const NOOP = (): void => undefined;

export const EXPERT_AUDIENCE: AudienceInfo = { audience: "expert", onGlossaryOpened: NOOP, onHelpCardOpened: NOOP };

export const AudienceContext = createContext<AudienceInfo>(EXPERT_AUDIENCE);

export function useAudience(): AudienceInfo {
  return useContext(AudienceContext);
}

/** Props of the primer screen (P2 builds it, P1 shows it before the practice view and logs through the callbacks). */
export interface PrimerScreenProps {
  readonly lang: "fi" | "en";
  readonly onPage: (pageId: string, dwellMs: number) => void;
  readonly onCheck: (questionId: string, chosen: number, correct: boolean, attempt: number) => void;
  readonly onDone: () => void;
}

/** Props of the commander-profile screen (P3 builds it, P1 shows it after the questionnaire in public sessions). */
export interface ProfileScreenProps {
  readonly lang: "fi" | "en";
  /** The session's records so far (the log body), read-only. */
  readonly records: readonly unknown[];
  readonly onDone: () => void;
}
