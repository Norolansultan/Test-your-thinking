/**
 * The session log's header (SPEC/07 §2.1). Split out of `orchestrator.ts`.
 *
 * Everything in the header that is not a function of the session's inputs — the session id, the
 * wall-clock start, the browser, the viewport, the build and the bundle hash — is an annotation
 * ({@link HeaderAnnotations}) produced OUTSIDE the run loop and passed in: in the browser by
 * `app/session/annotations.ts` (called by the start page before the session exists), in tests by the
 * harness. Nothing in the run reads them back, so identical inputs with identical annotations give a
 * byte-identical log (I1).
 */

import type { Lang } from "../i18n/lang.js";
import type { Cell, ScenarioContract } from "../scenario/types.js";
import type { LogHeader } from "../telemetry/log.js";
import { TELEMETRY_FORMAT_VERSION } from "../telemetry/record-kinds.js";
import { conditionOfCell, type PreviewOverride } from "./preview.js";

/**
 * The cell a session runs in (phase B round 2, D1): the given one, which must belong to the
 * condition (`radio` ↔ `directed`, a Thinker cell ↔ `substitutive`); without one, the condition's
 * default (`radio`, or `reasoning_once` — the plain Thinker cell).
 */
export function sessionCell(condition: "directed" | "substitutive", cell?: Cell): Cell {
  if (cell === undefined) return condition === "directed" ? "radio" : "reasoning_once";
  if (conditionOfCell(cell) !== condition) throw new Error(`cell ${cell} does not belong to the ${condition} condition`);
  return cell;
}

/** The header's annotations (SPEC/04 §10): recorded, never read by logic. */
export interface HeaderAnnotations {
  /** Pseudonymous, random, generated once per session outside the run loop; names the session's files. */
  readonly sessionId: string;
  /** The wall clock when the session was created (ISO 8601, UTC). */
  readonly startedAtIso: string;
  readonly userAgent: string;
  readonly viewport: LogHeader["viewport"];
  /** `package.json` version, plus `+<commit>` in a production build (`tools/deploy/build.ts`). */
  readonly appVersion: string;
  /** `sha256:<hex>` of the scenario bundle's canonical JSON (`app/telemetry/bundle-hash.ts`). */
  readonly bundleHash: string;
}

/**
 * The fixed annotations of a session created without real ones (tests, tools): the values every log
 * carried before 5 Oct 2026. A browser session always passes real ones (`annotations.ts`).
 */
export const FIXED_ANNOTATIONS: HeaderAnnotations = {
  sessionId: "preview-session", startedAtIso: "1970-01-01T00:00:00.000Z", userAgent: "preview-ui",
  viewport: { w: 1280, h: 800, dpr: 1 }, appVersion: "0.1.0", bundleHash: "preview-bundle",
};

export function sessionHeader(
  scenario: ScenarioContract, condition: "directed" | "substitutive", participantCode: string, language: Lang, previewOverride: PreviewOverride | null,
  showProbeLevels = true, cell?: Cell, assignment?: LogHeader["assignment"], annotations: HeaderAnnotations = FIXED_ANNOTATIONS,
): LogHeader {
  const { sessionId, startedAtIso, userAgent, viewport, appVersion, bundleHash } = annotations;
  return {
    formatVersion: TELEMETRY_FORMAT_VERSION, sessionId, participantCode,
    condition, scenarioId: scenario.id, scenarioVersion: scenario.version, seed: scenario.seed.toString(),
    bundleHash, appVersion, startedAtIso,
    userAgent, viewport: { w: viewport.w, h: viewport.h, dpr: viewport.dpr },
    cell: sessionCell(condition, cell), echelon: "command", language,
    ...(previewOverride ? { previewOverride } : {}),
    probeLevelsShown: showProbeLevels,
    ...(assignment ? { assignment } : {}),
  };
}
