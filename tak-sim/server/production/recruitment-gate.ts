/**
 * The recruitment gate (`31` P-12, first SPEC/29 (ay) rule 2; docs/DEPLOYMENT.md §2.1). While recruitment
 * runs, `RECRUITMENT_GATE=1` keeps the web demonstration out of reach, so a professional cannot meet the study's
 * terrain and story before a session (the demonstration runs the real scenario):
 *
 *   - the app's page is served only to a study link (`?tuotanto`, `STUDY_PARAM`, the same test the start page
 *     makes): `/`, `/index.html`, any extensionless path and any other page without it get a neutral 404 page,
 *     never the demonstration's start page (its condition buttons and its professional/public version switch).
 *
 * The study's own requests are untouched: its page under `?tuotanto`, its assets, the map and every /api route.
 */

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

/** The neutral page a gated request gets: no app, no mention of a demonstration. */
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

/** The response the gate allows for a static request: `file` itself, or the gate page instead of a page that is not a study link. */
export function gateStatic(url: string, file: StaticFile): StaticFile {
  return isPage(file) && !isStudyLink(url) ? GATE_PAGE : file;
}
