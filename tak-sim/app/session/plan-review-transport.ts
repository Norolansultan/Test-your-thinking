/**
 * The plan review's premise lookup (SPEC/32 §3, 20 Oct 2026): the guide group's one request to the study's own proxy at the
 * review (`POST /api/thinker/premise-review`), under the same I3 exception as the Thinker's chats (SPEC/00 revision (q)).
 * A table lookup on the server, no model call. Injected through `ThinkerOptions.premiseReview` (`queries.ts`), so tests
 * mock it as they mock the Thinker's transports; the Haku group never calls it.
 *
 * {@link requestPremiseReview} is what the session calls: it races any transport against the browser's timeout
 * ({@link PREMISE_REVIEW_CLIENT_TIMEOUT_MS}) on the ordinary timers (faked in tests), checks the reply's shape, and turns any
 * failure into a short reason for `plan_review_shown.premiseError` — the neutral review is shown then.
 */

import {
  PREMISE_REVIEW_CLIENT_TIMEOUT_MS, PREMISE_REVIEW_ENDPOINT, premiseReviewResponseProblem, type PremiseReviewRequest, type PremiseReviewResponse,
} from "./thinker-protocol.js";

export type PremiseReviewTransport = (request: PremiseReviewRequest) => Promise<PremiseReviewResponse>;

/** A lookup that did not answer in time, answered an HTTP error, or answered in the wrong shape; `reason` is what the record carries. */
export class PremiseReviewError extends Error {
  constructor(readonly reason: string) {
    super(`premise review lookup failed: ${reason}`);
    this.name = "PremiseReviewError";
  }
}

export function httpPremiseReviewTransport(endpoint = PREMISE_REVIEW_ENDPOINT, timeoutMs = PREMISE_REVIEW_CLIENT_TIMEOUT_MS): PremiseReviewTransport {
  return async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // determinism-lint-allow: SPEC/00 revision (q) I3 exception — the guide group's premise lookup at the plan review (SPEC/32 §3)
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: controller.signal });
      if (!res.ok) throw new PremiseReviewError(`http_${res.status}`);
      return (await res.json()) as PremiseReviewResponse;
    } catch (e) {
      if (controller.signal.aborted) throw new PremiseReviewError("client_timeout");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
}

export type PremiseReviewOutcome = { readonly ok: true; readonly response: PremiseReviewResponse } | { readonly ok: false; readonly error: string };

/** The lookup through `transport`, at most `timeoutMs`; never throws: a failure is `{ ok: false, error }`. */
export async function requestPremiseReview(transport: PremiseReviewTransport, request: PremiseReviewRequest, timeoutMs = PREMISE_REVIEW_CLIENT_TIMEOUT_MS): Promise<PremiseReviewOutcome> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PremiseReviewError("client_timeout")), timeoutMs); });
  try {
    const body: unknown = await Promise.race([transport(request), timeout]);
    const problem = premiseReviewResponseProblem(body);
    if (problem) return { ok: false, error: `invalid_response: ${problem}` };
    return { ok: true, response: body as PremiseReviewResponse };
  } catch (e) {
    return { ok: false, error: e instanceof PremiseReviewError ? e.reason : `network_error${e instanceof Error && e.message ? `: ${e.message.slice(0, 120)}` : ""}` };
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
