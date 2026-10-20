/**
 * The recruitment gate (SPEC/29 revision (ay) rule 2, `31` P-12; docs/DEPLOYMENT.md §2.1). While recruitment
 * runs, `RECRUITMENT_GATE=1` keeps the web demonstration and game mode out of reach, so a professional cannot
 * meet the study's terrain and story before a session:
 *
 *   - the app's page is served only to a study link (`?tuotanto`, `STUDY_PARAM`, the same test the start page
 *     makes): `/`, `/index.html`, any extensionless path and any other page without it get a neutral 404 page,
 *     never the demonstration's start page (its condition buttons and its game button);
 *   - no file that carries the game chunk's marker (`app/game/ui/marker.ts`) is served, whatever the build
 *     (a gated build, `npm run build:prod` with RECRUITMENT_GATE=1, does not contain it at all).
 *
 * The study's own requests are untouched: its page under `?tuotanto`, its assets, the map and every /api route.
 */

import { GAME_CHUNK_MARKER } from "../../app/game/ui/marker.js";
import { STUDY_PARAM } from "../../app/session/preview.js";
import type { StaticFile } from "./static.js";

/** Whether a request URL (path and query) is a study link: the query names `tuotanto` (any value, as the start page reads it). */
export function isStudyLink(url: string): boolean {
  const q = url.indexOf("?");
  if (q < 0) return false;
  try { return new URLSearchParams(url.slice(q + 1)).has(STUDY_PARAM); } catch { return false; }
}

/** Whether a static response is a page (the single-page app or another HTML file). */
export function isPage(file: StaticFile): boolean {
  return file.status === 200 && (file.headers["content-type"] ?? "").startsWith("text/html");
}

/** Text files the game's code could be in (the map images and other binaries are not searched). */
const CODE_TYPES = /^(text\/javascript|text\/css|text\/html|application\/json)/;

/** Whether a served file is (or holds) the game's code. */
export function isGameCode(file: StaticFile): boolean {
  if (file.status !== 200 || file.body === null || !CODE_TYPES.test(file.headers["content-type"] ?? "")) return false;
  return file.body.includes(GAME_CHUNK_MARKER);
}

/** The neutral page a gated request gets: no app, no mention of a demonstration or a game. */
export const GATE_PAGE: StaticFile = {
  status: 404,
  headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  body: Buffer.from(
    '<!doctype html><html lang="fi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + "<title>Ei saatavilla — Not available</title>"
    + '<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;line-height:1.5">'
    + "<p>Tämä sivu ei ole käytettävissä. Jos sait tutkimuslinkin, avaa se täsmälleen sellaisena kuin sen sait.</p>"
    + '<p lang="en">This page is not available. If you were given a study link, open it exactly as you received it.</p>'
    + "</body></html>",
  ),
};

/**
 * The response the gate allows for a static request: `file` itself, or the gate page instead of a page that is
 * not a study link, or a plain 404 instead of the game's code.
 */
export function gateStatic(url: string, file: StaticFile): StaticFile {
  if (isPage(file) && !isStudyLink(url)) return GATE_PAGE;
  if (isGameCode(file)) return { status: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: Buffer.from("not found") };
  return file;
}

/**
 * Phase-4 review (SPEC/31 (az)): a gated server refuses to START with a build that still holds the game. The request filter above
 * refuses only the chunk carrying the marker; the game's other chunks (world, scenarios) would stay fetchable by their hashed names
 * from an ungated build. So the gate fails closed: build with RECRUITMENT_GATE=1 (`npm run build:prod`, `tools/deploy/game-gate.ts`).
 * Returns the reason not to start, or null.
 */
export function gateStartupError(recruitmentGate: boolean, gameFilesInBuild: readonly string[]): string | null {
  if (!recruitmentGate || gameFilesInBuild.length === 0) return null;
  return `RECRUITMENT_GATE=1 but the build still holds the game (${gameFilesInBuild.join(", ")}): rebuild with RECRUITMENT_GATE=1 npm run build:prod (docs/DEPLOYMENT.md §2.1)`;
}
