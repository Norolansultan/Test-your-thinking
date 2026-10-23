/**
 * DEMONSTRATION ONLY. The page's `fetch`, wrapped: `POST /api/thinker` (Haku's structured chat) and `POST /api/thinker-open`
 * (the Open Thinker), relative or same-origin absolute, are answered in the page by the proxy's handler with Claude
 * (`serve.ts`); `OPTIONS` on either (the preflight's reachability probe) answers 204. EVERYTHING else goes to the original
 * `fetch` unchanged — the plan review's premise lookup (`/api/thinker/premise-review`) included, so the guide group's review
 * shows its neutral fallback (`premiseError`) as it does without a proxy.
 *
 * The runtime is asked for `sample` lazily, on the first such request. No `window.claude`, a `null` capability, a missing
 * or unreadable `data.json`, or the study (`?tuotanto`): nothing is served and every request passes through — the page
 * behaves as the static demonstration does without the bridge.
 */

import { STUDY_PARAM } from "../../app/session/preview.js";
import { OPEN_THINKER_MAX_BODY_BYTES, THINKER_ENDPOINT, THINKER_MAX_BODY_BYTES, THINKER_OPEN_ENDPOINT, type ThinkerTool } from "../../app/session/thinker-protocol.js";
import { parseBridgeData } from "./data.js";
import type { SampleFn } from "./sample-client.js";
import { createBridgeServer, type BridgeClock, type BridgeServer } from "./serve.js";

/** What the bridge needs of the page: its fetch, its address, the runtime (absent outside a Claude viewer). */
export interface BridgeWindow {
  fetch: typeof fetch;
  readonly location: { readonly href: string; readonly search: string };
  readonly claude?: { use(name: string): Promise<unknown> } | undefined;
}

export interface BridgeOptions {
  /** Where `data.json` is (beside `bridge.js`). */
  readonly dataUrl: string;
  readonly clock?: BridgeClock;
}

export type BridgeRoute = { readonly kind: "serve"; readonly tool: ThinkerTool } | { readonly kind: "options" } | null;

/** The path of a request, when it is this page's own (a root-relative path, or an absolute URL on the page's origin); else null. */
export function pathOf(raw: string, href: string): string | null {
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw.split(/[?#]/)[0]!;
  try {
    const base = new URL(href);
    const url = new URL(raw, base);
    return url.origin === base.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

/** Which requests the bridge answers: POST and OPTIONS on the two chat endpoints, nothing else (never the premise lookup). */
export function routeOf(raw: string, method: string, href: string): BridgeRoute {
  const path = pathOf(raw, href);
  if (path !== THINKER_ENDPOINT && path !== THINKER_OPEN_ENDPOINT) return null;
  const m = method.toUpperCase();
  if (m === "OPTIONS") return { kind: "options" };
  if (m === "POST") return { kind: "serve", tool: path === THINKER_ENDPOINT ? "haku" : "open_thinker" };
  return null;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function abortError(): Error {
  return typeof DOMException === "function" ? new DOMException("The operation was aborted.", "AbortError") : Object.assign(new Error("aborted"), { name: "AbortError" });
}

/** Rejects with an AbortError as the native fetch does once `signal` aborts. */
function abortable<T>(work: Promise<T>, signal: AbortSignal | null | undefined): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** The request's method, body text and signal, from either fetch signature. */
async function requestParts(input: RequestInfo | URL, init: RequestInit | undefined) {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const method = init?.method ?? request?.method ?? "GET";
  const signal = init?.signal ?? request?.signal ?? null;
  const body = init?.body !== undefined && init.body !== null ? init.body : request ? await request.clone().text() : null;
  return { method, signal, body };
}

const urlOf = (input: RequestInfo | URL): string => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

/** The wrapped fetch (exported for tests). `original` is the page's own fetch, bound. */
export function bridgedFetch(win: BridgeWindow, original: typeof fetch, options: BridgeOptions): typeof fetch {
  let ready: Promise<BridgeServer | null> | null = null;
  const start = async (): Promise<BridgeServer | null> => {
    if (new URLSearchParams(win.location.search).has(STUDY_PARAM)) return null; // never in the study
    const claude = win.claude;
    if (!claude || typeof claude.use !== "function") return null;
    let sample: unknown;
    try { sample = await claude.use("sample"); } catch { return null; }
    if (typeof sample !== "function") return null;
    try {
      // determinism-lint-allow: the demo bridge reads its own data file, published beside the page (no study run)
      const res = await original(options.dataUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return createBridgeServer(sample as SampleFn, parseBridgeData(await res.json()), options.clock);
    } catch (e) {
      console.warn("demo bridge: data.json could not be read; requests pass through", e instanceof Error ? e.message : e);
      return null;
    }
  };

  return async (input, init) => {
    const route = routeOf(urlOf(input), init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET"), win.location.href);
    if (route === null) return original(input, init);
    const server = await (ready ??= start());
    if (server === null) return original(input, init);
    if (route.kind === "options") {
      return new Response(null, { status: 204, headers: { "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
    }
    const { signal, body } = await requestParts(input, init);
    return abortable((async () => {
      if (typeof body !== "string") return jsonResponse(400, { error: "invalid JSON" });
      const max = route.tool === "haku" ? THINKER_MAX_BODY_BYTES : OPEN_THINKER_MAX_BODY_BYTES;
      if (new TextEncoder().encode(body).length > max) return jsonResponse(413, { error: "body too large" });
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { return jsonResponse(400, { error: "invalid JSON" }); }
      const result = await server.serve(route.tool, parsed);
      return jsonResponse(result.status, result.body);
    })(), signal);
  };
}

/** Installs the bridge on the page (once). */
export function installDemoBridge(win: BridgeWindow & { __takSimDemoBridge?: true }, options: BridgeOptions): void {
  if (win.__takSimDemoBridge) return;
  win.__takSimDemoBridge = true;
  win.fetch = bridgedFetch(win, win.fetch.bind(win), options);
}
