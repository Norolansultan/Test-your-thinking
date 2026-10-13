/**
 * The browser's header annotations (`header.ts` {@link HeaderAnnotations}), produced once by the
 * start page BEFORE the session (and its run loop) exists. This is the only place in the session
 * path that reads a random source, the wall clock and the browser environment; the run never reads
 * any of them back (I1). The environment is injected so the tests can fix every value.
 */

import { version as PACKAGE_VERSION } from "../../package.json";
import { scenarioBundleHash } from "../telemetry/bundle-hash.js";
import type { HeaderAnnotations } from "./header.js";

/** The build stamp `tools/deploy/build.ts` defines (`+<commit>`); absent in development and tests. */
declare const __APP_BUILD__: string | undefined;

export function appVersion(): string {
  const build = typeof __APP_BUILD__ === "string" && __APP_BUILD__ !== "" ? `+${__APP_BUILD__}` : "";
  return `${PACKAGE_VERSION}${build}`;
}

export interface AnnotationEnvironment {
  /** Fills the array with random bytes (`crypto.getRandomValues`). */
  readonly randomBytes: (bytes: Uint8Array) => void;
  /** The wall clock as an ISO string. */
  readonly nowIso: () => string;
  readonly userAgent: string;
  readonly viewport: { readonly w: number; readonly h: number; readonly dpr: number };
}

/** A fresh session id: 128 random bits as 32 lower-case hex characters (matches `SESSION_ID_PATTERN`). */
export function newSessionId(randomBytes: AnnotationEnvironment["randomBytes"]): string {
  const bytes = new Uint8Array(16);
  randomBytes(bytes);
  let id = "";
  for (const b of bytes) id += b.toString(16).padStart(2, "0");
  return id;
}

/** `sessionId`: one fixed before the session (the shared study link's, `auto-assign.ts`); otherwise a fresh one. */
export function sessionAnnotations(scenario: object, env: AnnotationEnvironment, sessionId?: string): HeaderAnnotations {
  return {
    sessionId: sessionId ?? newSessionId(env.randomBytes),
    startedAtIso: env.nowIso(),
    userAgent: env.userAgent,
    viewport: { w: env.viewport.w, h: env.viewport.h, dpr: env.viewport.dpr },
    appVersion: appVersion(),
    bundleHash: scenarioBundleHash(scenario),
  };
}

/** The real browser environment. Called by the start page only, outside the run loop. */
export function browserEnvironment(): AnnotationEnvironment {
  return {
    // determinism-lint-allow: the session id is generated once on the start page, before the session and its run loop exist; it is only annotated into the header (R5/I1). getRandomValues works outside a secure context, unlike randomUUID.
    randomBytes: (bytes) => { crypto.getRandomValues(bytes); },
    // determinism-lint-allow: the wall-clock start is taken once on the start page, outside the run loop, and is an annotation only (SPEC/04 §10 "startedAtIso").
    nowIso: () => new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
  };
}

/** Wall-clock milliseconds now, for the interval since an interruption (outside the run loop). */
export function wallNowMs(): number {
  // determinism-lint-allow: read once on the start page when a resume is accepted, to compute session_resumed.intervalSinceInterruptionMs (an annotation); never in the run loop.
  return Date.now();
}
