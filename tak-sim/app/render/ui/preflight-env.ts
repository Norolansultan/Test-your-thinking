/**
 * Gathers the browser's environment for the preflight (`app/session/preflight.ts` judges it). Runs
 * before the briefing, outside the run loop (I3: the proxy check is the only request, before
 * RUNNING, and only for the Thinker cells).
 */

import type { PreflightEnv } from "../../session/preflight.js";
import { THINKER_ENDPOINT } from "../../session/thinker-protocol.js";

function hasIndexedDb(): boolean {
  try { return typeof indexedDB !== "undefined" && indexedDB !== null && typeof indexedDB.open === "function"; } catch { return false; }
}

function hasWebgl2(): boolean {
  try { return document.createElement("canvas").getContext("webgl2") !== null; } catch { return false; }
}

function pointerKind(): PreflightEnv["pointer"] {
  if (window.matchMedia?.("(pointer: fine)").matches) return "fine";
  if (window.matchMedia?.("(pointer: coarse)").matches) return "coarse";
  return "none";
}

/** The Thinker proxy answers its CORS preflight (`OPTIONS /api/thinker`, HTTP 204) without running a model call. */
export async function proxyReachable(endpoint = THINKER_ENDPOINT, timeoutMs = 8_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // determinism-lint-allow: the preflight's reachability check of the study's own Thinker proxy, before the run (I3), every cell (Haku's chat, 8 Oct 2026)
    const res = await fetch(endpoint, { method: "OPTIONS", signal: controller.signal, cache: "no-store" });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function gatherPreflightEnv(proxyNeeded: boolean): Promise<PreflightEnv> {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    pointer: pointerKind(),
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    indexedDb: hasIndexedDb(),
    webgl2: hasWebgl2(),
    proxy: proxyNeeded ? ((await proxyReachable()) ? "reachable" : "unreachable") : "not_needed",
  };
}
