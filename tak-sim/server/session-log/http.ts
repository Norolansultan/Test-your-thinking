/**
 * `/api/session-log/...` routing (protocol: `app/telemetry/session-log-protocol.ts`). Pure over the
 * request's method, path, headers and body, so `server/production/server.ts` mounts it and the
 * tests call it directly or over HTTP.
 */

import type { IncomingMessage } from "node:http";
import { MAX_CHUNK_BYTES, SESSION_LOG_ENDPOINT } from "../../app/telemetry/session-log-protocol.js";
import type { SessionLogStore, StoreResult } from "./store.js";

export class BodyTooLargeError extends Error {}

/** Reads a request body, refusing more than `max` bytes (stops reading at the limit). */
export async function readBodyLimited(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new BodyTooLargeError();
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

const CHUNK_ROUTE = new RegExp(`^${SESSION_LOG_ENDPOINT}/([^/]+)/chunks/(\\d{1,6})$`);
const COMPLETE_ROUTE = new RegExp(`^${SESSION_LOG_ENDPOINT}/([^/]+)/complete$`);
const PARTIAL_ROUTE = new RegExp(`^${SESSION_LOG_ENDPOINT}/([^/]+)/partial$`);

export function isSessionLogPath(path: string): boolean {
  return path === SESSION_LOG_ENDPOINT || path.startsWith(`${SESSION_LOG_ENDPOINT}/`);
}

type Result = StoreResult | { readonly status: 404 | 405; readonly body: { readonly error: string } };

/** Handles one session-log request. `url` is the request's path with its query string. */
export async function handleSessionLogRequest(store: SessionLogStore, method: string, url: string, headers: IncomingMessage["headers"], readBody: (max: number) => Promise<Buffer>): Promise<Result> {
  const [path = "", query = ""] = url.split("?", 2);
  const chunk = CHUNK_ROUTE.exec(path);
  if (chunk) {
    if (method !== "PUT") return { status: 405, body: { error: "method not allowed" } };
    const total = Number(new URLSearchParams(query).get("total"));
    const declared = headers["x-chunk-sha256"];
    let body: Buffer;
    try { body = await readBody(MAX_CHUNK_BYTES); } catch (e) {
      if (e instanceof BodyTooLargeError) return { status: 413, body: { error: "chunk too large" } };
      throw e;
    }
    return store.putChunk(decodeURIComponent(chunk[1]!), Number(chunk[2]), total, body, typeof declared === "string" ? declared : undefined);
  }
  const partial = PARTIAL_ROUTE.exec(path);
  if (partial) {
    if (method !== "PUT") return { status: 405, body: { error: "method not allowed" } };
    const params = new URLSearchParams(query);
    const declared = headers["x-chunk-sha256"];
    let body: Buffer;
    try { body = await readBody(MAX_CHUNK_BYTES); } catch (e) {
      if (e instanceof BodyTooLargeError) return { status: 413, body: { error: "chunk too large" } };
      throw e;
    }
    // An absent `from` is NaN, refused by the store like any other non-count.
    return store.putPartial(decodeURIComponent(partial[1]!), Number(params.get("from") ?? Number.NaN), params.get("at") ?? "", body, typeof declared === "string" ? declared : undefined);
  }
  const complete = COMPLETE_ROUTE.exec(path);
  if (complete) {
    if (method !== "POST") return { status: 405, body: { error: "method not allowed" } };
    let parsed: unknown;
    try { parsed = JSON.parse((await readBody(4096)).toString("utf8")); } catch (e) {
      return e instanceof BodyTooLargeError ? { status: 413, body: { error: "body too large" } } : { status: 400, body: { error: "invalid JSON" } };
    }
    return store.complete(decodeURIComponent(complete[1]!), parsed);
  }
  return { status: 404, body: { error: "not found" } };
}
