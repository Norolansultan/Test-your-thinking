/**
 * The production server's configuration, from the environment only (docs/DEPLOYMENT.md). Nothing
 * secret is ever read from a file in the repository or sent to the browser.
 *
 *   PORT                  listen port (default 8080)
 *   HOST                  listen address (default 127.0.0.1: behind a reverse proxy that terminates HTTPS)
 *   ALLOWED_ORIGINS       comma-separated origins allowed to call /api/* cross-origin, e.g.
 *                         https://study.example.org (same-origin requests are always allowed)
 *   SESSION_LOG_DIR       where finished session files go (default logs/sessions under the app)
 *   STATIC_DIR            the built app (default dist/ui, from `npm run build:prod`)
 *   THINKER               "on" (default), "lexical" (no embedding model; development only) or "off"
 *                         (no /api/thinker: a Haku-only deployment)
 *   THINKER_MODE          "study" (default) or "demo" (SPEC/14 revision (v)): in study mode the proxy
 *                         refuses to start unless every treatment a study session can request is the
 *                         declared one — in particular the built and frozen English index
 *                         (`content/thinker/index.en.json`); "demo" answers English questions over the
 *                         Finnish index when it is absent (logged `hybrid_fi_fallback`), never for a study
 *   ADMIN_TOKEN           enables the researcher's data download (/admin, /api/admin/*; `admin.ts`); at
 *                         least 24 characters; unset = those routes answer 404. Never logged
 *   AUTO_ASSIGN           "1" turns on the shared study link's code issue (POST /api/assign,
 *                         `auto-assign.ts`); unset or "0" = 404, so a local run never consumes a code
 *   ASSIGN_CELLS          PILOT ONLY: comma-separated cells the issue is restricted to (e.g.
 *                         reasoning_intent); breaks the blocked balance between cells; unset for the study
 *   ASSIGN_MAX            the most codes issued in all (default: the allocation table's length)
 *   ASSIGN_RATE_PER_HOUR  new codes per client address per hour (default 20)
 *   GEMINI_API_KEY        the model key, read by the SDK from the environment (never logged); without it
 *                         every Thinker answer is the template fallback
 */

import { isAbsolute, resolve } from "node:path";
import type { Cell } from "../../app/scenario/types.js";
import { REPO_ROOT, type ThinkerServerMode } from "../thinker/config.js";
import { MIN_ADMIN_TOKEN_LENGTH } from "./admin.js";
import { DEFAULT_ASSIGN_RATE_PER_HOUR, type AutoAssignConfig } from "./auto-assign.js";

const CELLS: readonly Cell[] = ["radio", "reasoning_once", "reasoning_intent"];

export interface ProductionConfig {
  readonly port: number;
  readonly host: string;
  readonly allowedOrigins: readonly string[];
  readonly sessionLogDir: string;
  readonly staticDir: string;
  readonly thinker: "on" | "lexical" | "off";
  readonly thinkerMode: ThinkerServerMode;
  /** Null: the data download is off. */
  readonly adminToken: string | null;
  /** Null: /api/assign is off (404). */
  readonly autoAssign: AutoAssignConfig | null;
}

export class ConfigError extends Error {}

const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

export function loadConfig(env: Readonly<Record<string, string | undefined>>): ProductionConfig {
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`PORT must be 1..65535, got "${env.PORT}"`);
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");
  for (const o of allowedOrigins) if (!ORIGIN.test(o)) throw new ConfigError(`ALLOWED_ORIGINS: "${o}" is not an origin (scheme://host[:port], no path)`);
  const thinker = env.THINKER ?? "on";
  if (thinker !== "on" && thinker !== "lexical" && thinker !== "off") throw new ConfigError(`THINKER must be on, lexical or off, got "${thinker}"`);
  // The server that serves participants runs the study's treatment unless told otherwise (final review, 6 Oct 2026).
  const thinkerMode = env.THINKER_MODE ?? "study";
  if (thinkerMode !== "study" && thinkerMode !== "demo") throw new ConfigError(`THINKER_MODE must be study or demo, got "${thinkerMode}"`);
  const adminToken = env.ADMIN_TOKEN?.trim() || null;
  // A short token could be guessed over the tunnel; refuse it rather than serve every participant's data behind it.
  if (adminToken !== null && (adminToken.length < MIN_ADMIN_TOKEN_LENGTH || /\s/.test(adminToken))) throw new ConfigError(`ADMIN_TOKEN must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters with no spaces (unset it to turn the data download off)`);
  const autoAssign = autoAssignConfig(env);
  const dir = (value: string | undefined, fallback: string) => (value ? (isAbsolute(value) ? value : resolve(REPO_ROOT, value)) : resolve(REPO_ROOT, fallback));
  return {
    port, host: env.HOST ?? "127.0.0.1", allowedOrigins,
    sessionLogDir: dir(env.SESSION_LOG_DIR, "logs/sessions"),
    staticDir: dir(env.STATIC_DIR, "dist/ui"),
    thinker, thinkerMode, adminToken, autoAssign,
  };
}

function positiveInt(name: string, raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < 1) throw new ConfigError(`${name} must be a whole number of at least 1, got "${raw}"`);
  return Number(raw);
}

function autoAssignConfig(env: Readonly<Record<string, string | undefined>>): AutoAssignConfig | null {
  const flag = (env.AUTO_ASSIGN ?? "").trim();
  if (flag === "" || flag === "0") return null;
  if (flag !== "1") throw new ConfigError(`AUTO_ASSIGN must be 1 or 0, got "${env.AUTO_ASSIGN}"`);
  const listed = (env.ASSIGN_CELLS ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");
  for (const c of listed) if (!(CELLS as readonly string[]).includes(c)) throw new ConfigError(`ASSIGN_CELLS: "${c}" is not a cell (${CELLS.join(", ")})`);
  return {
    cells: listed.length > 0 ? CELLS.filter((c) => listed.includes(c)) : null,
    maxIssued: positiveInt("ASSIGN_MAX", env.ASSIGN_MAX),
    ratePerHour: positiveInt("ASSIGN_RATE_PER_HOUR", env.ASSIGN_RATE_PER_HOUR) ?? DEFAULT_ASSIGN_RATE_PER_HOUR,
  };
}
