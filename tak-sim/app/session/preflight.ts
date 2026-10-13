/**
 * The preflight check (SPEC/05 §2.1 support matrix; SPEC/09 §3; work package I, 5 Oct 2026). Pure:
 * the browser's environment is gathered by the render layer (`app/render/ui/preflight-env.ts`) and
 * judged here, so the rules are tested without a browser.
 *
 * Checks: a desktop browser (no phone or tablet), IndexedDB (the session's local log, SPEC/05 §9),
 * WebGL2 (the map), and the proxy's reachability (every cell since 8 Oct 2026: Haku's chat uses it). The window size is not
 * checked (researcher decision, 6 Oct 2026: any window size is accepted); the viewport is still
 * recorded. A failure the participant cannot fix within this page (not a desktop, no IndexedDB, no
 * WebGL2) is `hard`: the session aborts (`preflight_refused`). An unreachable proxy can be fixed in
 * place: the refusal screen stays and re-checks.
 *
 * Order (decided here, researcher to confirm): consent first, then the preflight, so that no
 * environment data are recorded before consent. SPEC/05 §2 has the check before consent.
 *
 * The render benchmark of SPEC/05 §2.1 is not built: `benchmarkScore` is logged as 0 with
 * `benchmark: "not_run"`.
 */

import type { PreflightResultDetail } from "../telemetry/record-kinds.js";

export type PreflightFailure = "not_desktop" | "no_indexeddb" | "no_webgl2" | "proxy_unreachable";

/** In the order the refusal screen lists them. */
export const PREFLIGHT_FAILURES: readonly PreflightFailure[] = ["not_desktop", "no_indexeddb", "no_webgl2", "proxy_unreachable"];
const HARD: ReadonlySet<PreflightFailure> = new Set(["not_desktop", "no_indexeddb", "no_webgl2"]);

export interface PreflightEnv {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** The primary pointer (`(pointer: fine)` / `(pointer: coarse)`). */
  readonly pointer: "fine" | "coarse" | "none";
  readonly viewport: { readonly w: number; readonly h: number; readonly dpr: number };
  readonly indexedDb: boolean;
  readonly webgl2: boolean;
  /** The chat proxy: checked in every cell since 8 Oct 2026 (Haku's chat); `not_needed` only in older logs. */
  readonly proxy: "reachable" | "unreachable" | "not_needed";
}

export interface PreflightOutcome {
  readonly passed: boolean;
  readonly failures: readonly PreflightFailure[];
  /** A failure that cannot be fixed in this page: the session aborts. */
  readonly hard: boolean;
}

const MOBILE_UA = /\b(Mobi|Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile)\b/i;

/** A phone or tablet: a mobile user agent, or a touch device whose primary pointer is not fine (iPadOS reports a desktop UA). */
export function isDesktop(env: Pick<PreflightEnv, "userAgent" | "maxTouchPoints" | "pointer">): boolean {
  if (MOBILE_UA.test(env.userAgent)) return false;
  return !(env.maxTouchPoints > 0 && env.pointer !== "fine");
}

export function evaluatePreflight(env: PreflightEnv): PreflightOutcome {
  const failed = new Set<PreflightFailure>();
  if (!isDesktop(env)) failed.add("not_desktop");
  if (!env.indexedDb) failed.add("no_indexeddb");
  if (!env.webgl2) failed.add("no_webgl2");
  if (env.proxy === "unreachable") failed.add("proxy_unreachable");
  const failures = PREFLIGHT_FAILURES.filter((f) => failed.has(f));
  return { passed: failures.length === 0, failures, hard: failures.some((f) => HARD.has(f)) };
}

/** The `preflight_result` record (SPEC/07 §2.1) for an evaluation; `overridden` only in a demonstration. */
export function preflightRecord(env: PreflightEnv, outcome: PreflightOutcome, overridden = false): PreflightResultDetail {
  return {
    benchmarkScore: 0, benchmark: "not_run",
    viewport: { ...env.viewport },
    refusalReason: outcome.failures[0] ?? null,
    passed: outcome.passed, failures: [...outcome.failures], hard: outcome.hard,
    userAgent: env.userAgent, pointer: env.pointer, maxTouchPoints: env.maxTouchPoints,
    indexedDb: env.indexedDb, webgl2: env.webgl2, proxy: env.proxy,
    ...(overridden ? { overridden: true } : {}),
  };
}
