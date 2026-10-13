/**
 * The proxy's HTTP layer (SPEC/05 revision (q)): `POST /api/thinker` (a JSON body of at most 16 KiB)
 * and `POST /api/thinker-open` (at most 64 KiB: the history, F2), CORS restricted to localhost
 * origins. No framework: `node:http` only.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { OPEN_THINKER_MAX_BODY_BYTES, THINKER_ENDPOINT, THINKER_MAX_BODY_BYTES, THINKER_OPEN_ENDPOINT } from "../../app/session/thinker-protocol.js";
import { handleThinkerRequest, handleOpenThinkerRequest, type ThinkerDeps } from "./handler.js";

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

/** A request without an Origin header (curl, the Vite dev proxy without a browser) is not cross-origin. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || LOCAL_ORIGIN.test(origin);
}

function send(res: ServerResponse, status: number, body: unknown, origin: string | undefined): void {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (origin && LOCAL_ORIGIN.test(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(body === null ? undefined : JSON.stringify(body));
}

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new BodyTooLargeError();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createThinkerServer(deps: ThinkerDeps): Server {
  return createServer((req, res) => {
    void (async () => {
      const origin = req.headers.origin;
      if (!isAllowedOrigin(origin)) return send(res, 403, { error: "origin not allowed" }, undefined);
      const path = (req.url ?? "").split("?")[0];
      if (path !== THINKER_ENDPOINT && path !== THINKER_OPEN_ENDPOINT) return send(res, 404, { error: "not found" }, origin);
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": origin ?? "",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "600",
          vary: "Origin",
        });
        return res.end();
      }
      if (req.method !== "POST") return send(res, 405, { error: "method not allowed" }, origin);
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req, path === THINKER_OPEN_ENDPOINT ? OPEN_THINKER_MAX_BODY_BYTES : THINKER_MAX_BODY_BYTES));
      } catch (e) {
        return send(res, e instanceof BodyTooLargeError ? 413 : 400, { error: e instanceof BodyTooLargeError ? "body too large" : "invalid JSON" }, origin);
      }
      const result = path === THINKER_ENDPOINT ? await handleThinkerRequest(deps, body) : await handleOpenThinkerRequest(deps, body);
      send(res, result.status, result.body, origin);
    })().catch((e: unknown) => {
      console.error("thinker: request failed", e instanceof Error ? e.message : e);
      if (!res.headersSent) send(res, 500, { error: "internal error" }, undefined);
    });
  });
}
