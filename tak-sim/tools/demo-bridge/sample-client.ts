/**
 * DEMONSTRATION ONLY. The model client the proxy's handler calls (`server/thinker/model-client.ts`), answered by Claude in the
 * page through the artifact runtime's `sample` capability, on the VIEWER's own Claude account. One request of the handler is
 * ONE `sample.json` call (a response schema: both chats today) or ONE `sample` call (free text): the system instruction, the
 * schema as an explicit "reply with only JSON matching this schema" instruction, and the content, all in `input` — the call is
 * memoryless and has no system prompt of its own. The Open Thinker's history becomes user/assistant turns after a leading
 * instructions turn. Settings the runtime has no equivalent for (temperature, seed, the output cap) are not sent.
 *
 * Failures never retry here: each rejection `{code}` becomes what the handler already maps to its fallback reasons
 * (`model.ts` `errorOutcome`, the finish reasons) — `refused` a refusal, `invalid_json` / `empty_completion` an invalid output,
 * `rate_limited` a rate limit (not one of the 429/503 errors the handler retries once), consent and account codes an auth
 * error, `cancelled` (the handler's own 20 s timer aborts the call) a timeout, anything else an API error.
 */

import { DEMO_BRIDGE_MODEL_ID } from "../../app/session/thinker-protocol.js";
import type { ThinkerModelClient, ThinkerModelParams, ThinkerModelResponse } from "../../server/thinker/model-client.js";

/** The runtime's `sample` capability, as far as the bridge uses it (the artifact runtime's `sample.d.ts`). */
export type SampleInput = string | { readonly role: "user" | "assistant"; readonly content: string }[];
export interface SampleOptions {
  readonly signal?: AbortSignal;
  readonly modelTier?: "default" | "complex" | "quick";
  readonly cache?: boolean;
}
export interface SampleFn {
  (input: SampleInput, options?: SampleOptions): Promise<{ readonly text: string; readonly truncated: boolean }>;
  json(input: SampleInput, options?: SampleOptions): Promise<unknown>;
}
/** The one failure shape the runtime rejects with (a plain object, not an Error). */
export interface SampleError { readonly code: string; readonly message?: string; readonly text?: string }

/** How the bridge calls `sample`: the tier and the cache (Haku: the runtime's default caching; the Open Thinker: `cache: false`). */
export interface SampleCallSettings {
  /** True: the runtime's default five-minute cache; false: always ask (every Open Thinker turn). */
  readonly cache: boolean;
}

const RULE = "\n\n---\n\n";

/** The output-format instruction for a response schema (the proxy's schema dialect: `nullable`, `propertyOrdering`, string limits). */
export function formatInstruction(schema: unknown): string {
  return "Output format: reply with only one JSON object that matches the JSON Schema below. No text before or after it and no Markdown "
    + "code fence. In the schema, `nullable: true` means the value may be null, `propertyOrdering` gives the order of the keys, and "
    + "`maxItems` / `maxLength` are limits to stay within. Every key in `required` must be present.\n"
    + JSON.stringify(schema);
}

const FORMAT_REMINDER = "Reply with only the JSON object described in the output format above.";

type Part = { readonly text?: string | undefined };
type Content = { readonly role?: string | undefined; readonly parts?: readonly Part[] | undefined };

/** The request's turns (the proxy sends a list of contents; a bare string is one user turn). */
function turnsOf(contents: unknown): { readonly role: "user" | "assistant"; readonly content: string }[] {
  const list = (Array.isArray(contents) ? contents : [contents]) as (Content | string)[];
  return list.map((c) => typeof c === "string"
    ? { role: "user" as const, content: c }
    : { role: c.role === "model" ? "assistant" as const : "user" as const, content: (c.parts ?? []).map((p) => p.text ?? "").join("") });
}

/** The `input` of one call: the system instruction, then the content, then the output format; with history, a leading instructions turn. */
export function sampleInputOf(params: ThinkerModelParams): SampleInput {
  const config = params.config ?? {};
  const system = typeof config.systemInstruction === "string" ? config.systemInstruction : "";
  const format = config.responseSchema !== undefined ? formatInstruction(config.responseSchema) : "";
  const turns = turnsOf(params.contents).map((t) => ({ ...t, content: t.content.trim() === "" ? "—" : t.content }));
  if (turns.length <= 1) return [system, turns[0]?.content ?? "", format].filter((x) => x !== "").join(RULE);
  const last = turns[turns.length - 1]!;
  return [
    { role: "user", content: [system, format].filter((x) => x !== "").join(RULE) },
    ...turns.slice(0, -1),
    { ...last, content: format ? `${last.content}${RULE}${FORMAT_REMINDER}` : last.content },
  ];
}

/** The tier: the proxy asks for no thinking (`thinkingBudget` 0) on both chats, which is the runtime's `quick`; otherwise `default`. */
export function modelTierOf(params: ThinkerModelParams): "quick" | "default" {
  return params.config?.thinkingConfig?.thinkingBudget === 0 ? "quick" : "default";
}

const reply = (text: string, finishReason = "STOP"): ThinkerModelResponse => ({
  candidates: [{ finishReason }], text, usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 }, modelVersion: DEMO_BRIDGE_MODEL_ID,
});

class BridgeModelError extends Error {
  constructor(name: string, message: string, readonly status?: number) {
    super(message);
    this.name = name;
  }
}

const ACCOUNT_CODES = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "session_expired"]);
const REQUEST_CODES = new Set(["invalid_request", "prompt_too_large", "transform_error", "queue_overflow", "images_unavailable", "tools_unavailable", "image_rejected"]);

/**
 * A rejection as the handler reads it: a reply it judges (refusal, invalid output) or an error it maps (`errorOutcome`). The
 * statuses are chosen outside 429/503, so the handler's one identical retry never runs on a `sample` failure.
 */
export function outcomeOfSampleError(e: unknown): ThinkerModelResponse {
  const code = typeof e === "object" && e !== null && typeof (e as SampleError).code === "string" ? (e as SampleError).code : "upstream_error";
  const text = typeof e === "object" && e !== null && typeof (e as SampleError).text === "string" ? (e as SampleError).text! : "";
  if (code === "refused") return { candidates: [{ finishReason: "SAFETY" }] };
  if (code === "invalid_json" || code === "empty_completion") return reply(text);
  if (code === "rate_limited") throw new BridgeModelError("RateLimitError", "demo bridge: sample rate limited");
  if (code === "cancelled") throw new BridgeModelError("TimeoutError", "demo bridge: sample call cancelled (timeout)");
  if (ACCOUNT_CODES.has(code)) throw new BridgeModelError("BridgeAccountError", `demo bridge: sample ${code}`, 403);
  if (REQUEST_CODES.has(code)) throw new BridgeModelError("BridgeRequestError", `demo bridge: sample ${code}`, 400);
  throw new BridgeModelError("BridgeUpstreamError", `demo bridge: sample ${code}`, 502);
}

/** The adapter: the handler's `generateContent` as one `sample` call. */
export function sampleModelClient(sample: SampleFn, settings: SampleCallSettings): ThinkerModelClient {
  return {
    models: {
      async generateContent(params) {
        const signal = params.config?.abortSignal;
        const options: SampleOptions = { modelTier: modelTierOf(params), ...(settings.cache ? {} : { cache: false }), ...(signal ? { signal } : {}) };
        const input = sampleInputOf(params);
        try {
          if (params.config?.responseSchema !== undefined) return reply(JSON.stringify(await sample.json(input, options)));
          const { text, truncated } = await sample(input, options);
          return reply(text, truncated ? "MAX_TOKENS" : "STOP");
        } catch (e) {
          return outcomeOfSampleError(e);
        }
      },
    },
  };
}
