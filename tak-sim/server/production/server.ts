/**
 * The production server — one process (docs/DEPLOYMENT.md):
 *
 *   /api/thinker        Haku's chat (`server/thinker/handler.ts`), when configured
 *   /api/thinker-open   the Open Thinker (same handler module, 8 Oct 2026), when configured
 *   /api/session-log/*  the post-run session-log upload and its checkpoints (`server/session-log/`)
 *   /api/assign         the shared study link's next code (`auto-assign.ts`), only when AUTO_ASSIGN=1;
 *                       otherwise 404
 *   /admin, /api/admin/* the researcher's data download (`admin.ts`), only when ADMIN_TOKEN is set;
 *                       otherwise 404 (and /admin is never the app's page)
 *   everything else     the built app (`dist/ui`), GET/HEAD; with RECRUITMENT_GATE=1 the page only under
 *                       `?tuotanto` and never the game's code (`recruitment-gate.ts`, SPEC/29 (ay))
 *
 * CORS: a request without an Origin header, from the server's own origin (the Host header), or from
 * an origin in ALLOWED_ORIGINS is served; any other origin gets 403 on /api/*. HTTPS is terminated
 * by the reverse proxy in front (the server listens on 127.0.0.1 by default). No framework: node:http.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { OPEN_THINKER_MAX_BODY_BYTES, THINKER_ENDPOINT, THINKER_MAX_BODY_BYTES, THINKER_OPEN_ENDPOINT } from "../../app/session/thinker-protocol.js";
import { BodyTooLargeError, handleSessionLogRequest, isSessionLogPath, readBodyLimited } from "../session-log/http.js";
import type { SessionLogStore } from "../session-log/store.js";
import { handleAdminRequest, isAdminPath, type AdminOptions } from "./admin.js";
import { ASSIGN_MAX_BODY_BYTES, ASSIGN_PATH, clientAddress, type AutoAssigner } from "./auto-assign.js";
import { gateStatic } from "./recruitment-gate.js";
import { serveStatic } from "./static.js";

export type ThinkerHandler = (body: unknown) => Promise<{ readonly status: number; readonly body: unknown }>;

export interface AppServerOptions {
  readonly staticDir?: string;
  readonly thinker?: ThinkerHandler;
  /** The Open Thinker (`/api/thinker-open`). */
  readonly thinkerOpen?: ThinkerHandler;
  readonly sessionLog?: SessionLogStore;
  readonly allowedOrigins?: readonly string[];
  /** The data download; absent (ADMIN_TOKEN unset) = its routes answer 404. */
  readonly admin?: AdminOptions;
  /** The shared link's code issue (`auto-assign.ts`); absent (AUTO_ASSIGN unset) = /api/assign answers 404. */
  readonly assign?: AutoAssigner;
  /** RECRUITMENT_GATE=1 (`recruitment-gate.ts`): the app's page only under `?tuotanto`, never the game's code. */
  readonly recruitmentGate?: boolean;
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
};

/** Whether `origin` may call the API: absent, the server's own (by Host), or listed. */
export function originAllowed(origin: string | undefined, host: string | undefined, allowed: readonly string[]): boolean {
  if (origin === undefined) return true;
  if (allowed.includes(origin)) return true;
  try { return host !== undefined && new URL(origin).host === host; } catch { return false; }
}

function sendJson(res: ServerResponse, status: number, body: unknown, cors: Record<string, string>): void {
  res.writeHead(status, { ...SECURITY_HEADERS, ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export function createAppServer(options: AppServerOptions): Server {
  const allowed = options.allowedOrigins ?? [];
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = req.url ?? "/";
      const path = url.split("?")[0] ?? "/";
      const method = req.method ?? "GET";
      const isApi = path === "/api" || path.startsWith("/api/");
      if (isAdminPath(path)) {
        if (!options.admin || method === "OPTIONS") return sendJson(res, 404, { error: "not found" }, {});
        if (!originAllowed(req.headers.origin, req.headers.host, allowed)) return sendJson(res, 403, { error: "origin not allowed" }, {});
        const out = await handleAdminRequest(options.admin, method, url, req.headers.authorization);
        res.writeHead(out.status, { ...SECURITY_HEADERS, ...out.headers });
        if (typeof out.body === "string" || Buffer.isBuffer(out.body)) return res.end(out.body);
        return pipeline(Readable.from(out.body), res); // the archive, file by file
      }
      if (isApi) {
        const origin = req.headers.origin;
        if (!originAllowed(origin, req.headers.host, allowed)) return sendJson(res, 403, { error: "origin not allowed" }, {});
        const cors: Record<string, string> = origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {};
        // A preflight answers 204 only for a route this server serves: the study's preflight check
        // (`preflight-env.ts`) reads a 204 on /api/thinker as "Thinker is there" (final review, 6 Oct 2026).
        const chat = path === THINKER_ENDPOINT ? options.thinker : path === THINKER_OPEN_ENDPOINT ? options.thinkerOpen : undefined;
        const assign = path === ASSIGN_PATH ? options.assign : undefined;
        const routed = chat !== undefined || assign !== undefined || (isSessionLogPath(path) && options.sessionLog !== undefined);
        if (method === "OPTIONS" && !routed) return sendJson(res, 404, { error: "not found" }, cors);
        if (method === "OPTIONS") {
          res.writeHead(204, { ...cors, "access-control-allow-methods": "GET, POST, PUT, OPTIONS", "access-control-allow-headers": "content-type, x-chunk-sha256", "access-control-max-age": "600" });
          return res.end();
        }
        if (chat) {
          if (method !== "POST") return sendJson(res, 405, { error: "method not allowed" }, cors);
          let body: unknown;
          const limit = path === THINKER_OPEN_ENDPOINT ? OPEN_THINKER_MAX_BODY_BYTES : THINKER_MAX_BODY_BYTES;
          try { body = JSON.parse((await readBodyLimited(req, limit)).toString("utf8")); } catch (e) {
            return sendJson(res, e instanceof BodyTooLargeError ? 413 : 400, { error: e instanceof BodyTooLargeError ? "body too large" : "invalid JSON" }, cors);
          }
          const result = await chat(body);
          return sendJson(res, result.status, result.body, cors);
        }
        if (assign) {
          if (method !== "POST") return sendJson(res, 405, { error: "method not allowed" }, cors);
          let body: unknown;
          try { body = JSON.parse((await readBodyLimited(req, ASSIGN_MAX_BODY_BYTES)).toString("utf8")); } catch (e) {
            return sendJson(res, e instanceof BodyTooLargeError ? 413 : 400, { error: e instanceof BodyTooLargeError ? "body too large" : "invalid JSON" }, cors);
          }
          const result = await assign.assign(body, clientAddress(req.headers, req.socket.remoteAddress));
          return sendJson(res, result.status, result.body, { ...cors, ...result.headers });
        }
        if (isSessionLogPath(path) && options.sessionLog) {
          const result = await handleSessionLogRequest(options.sessionLog, method, url, req.headers, (max) => readBodyLimited(req, max));
          return sendJson(res, result.status, result.body, cors);
        }
        return sendJson(res, 404, { error: "not found" }, cors);
      }
      if (!options.staticDir) return sendJson(res, 404, { error: "not found" }, {});
      if (method !== "GET" && method !== "HEAD") return sendJson(res, 405, { error: "method not allowed" }, {});
      const served = await serveStatic(options.staticDir, path);
      const file = options.recruitmentGate ? gateStatic(url, served) : served;
      res.writeHead(file.status, { ...SECURITY_HEADERS, ...file.headers });
      res.end(method === "HEAD" ? undefined : file.body);
    })().catch((e: unknown) => {
      console.error("server: request failed", e instanceof Error ? e.message : e);
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" }, {});
      else res.end();
    });
  });
}
