/**
 * SPEC/30 §10 (19 Oct 2026): the model-version guard. The configured model id (`THINKER_MODEL_ID`) is an alias that the API may
 * answer with another build (`14` ar probe); over months of recruitment the treatment would drift.
 *
 * - Pin: with `THINKER_EXPECTED_MODEL_VERSION` set (`expectedModelVersionOf`, `config.ts`), an answer whose `modelVersion` differs
 *   or is missing is a model error: the participant gets the ordinary fallback (Haku's template answer, the Thinker's
 *   "unavailable"), and the log line carries `modelVersionMismatch: {expected, got}`.
 * - Monitor, independently of the pin: per session, an answer whose build differs from the session's first answer's build is
 *   logged `modelVersionChanged: true` (with `firstModelVersion`).
 *
 * Pure apart from the per-session record of first builds, which lives in the deps (`sessionModelVersions`) or, when the deps carry
 * none, in a map kept per deps object.
 */

import type { ModelOutcome, ModelUsage } from "./model.js";

/** What the guard reads from the deps. */
export interface ModelVersionDeps {
  /** The pinned build; unset, null or empty: no pin. */
  readonly expectedModelVersion?: string | null;
  /** Each session's first answer's build, by session id. */
  readonly sessionModelVersions?: Map<string, string>;
}

type Failure = Extract<ModelOutcome, { readonly ok: false }>;

const perDeps = new WeakMap<object, Map<string, string>>();

function buildsOf(deps: ModelVersionDeps): Map<string, string> {
  if (deps.sessionModelVersions) return deps.sessionModelVersions;
  let builds = perDeps.get(deps);
  if (!builds) perDeps.set(deps, (builds = new Map()));
  return builds;
}

/**
 * Applies the pin and the per-session monitor to one model outcome. A failed outcome passes unchanged (no build to check). The
 * returned `log` fields go into the server log line: `modelVersion` (the build that answered, null when the response named none),
 * `modelVersionChanged` and `firstModelVersion`, and on a refusal `modelVersionMismatch` and the refused answer's `refusedUsage`.
 */
export function guardModelVersion<O extends { readonly ok: boolean; readonly usage?: ModelUsage; readonly attempts?: number }>(
  deps: ModelVersionDeps, sessionId: string, outcome: O,
): { readonly outcome: O | Failure; readonly log: Readonly<Record<string, unknown>> } {
  if (!outcome.ok || !outcome.usage) return { outcome, log: {} };
  const got = outcome.usage.modelVersion ?? null;
  const log: Record<string, unknown> = { modelVersion: got };
  if (got !== null) {
    const builds = buildsOf(deps);
    const first = builds.get(sessionId);
    if (first === undefined) builds.set(sessionId, got);
    else if (first !== got) Object.assign(log, { modelVersionChanged: true, firstModelVersion: first });
  }
  const expected = deps.expectedModelVersion ? deps.expectedModelVersion : null;
  if (expected === null || got === expected) return { outcome, log };
  const refused: Failure = {
    ok: false, reason: "api_error", detail: `model version mismatch: expected ${expected}, got ${got ?? "(none)"}`,
    ...(outcome.attempts !== undefined ? { attempts: outcome.attempts } : {}),
  };
  return { outcome: refused, log: { ...log, modelVersionMismatch: { expected, got }, refusedUsage: outcome.usage } };
}
