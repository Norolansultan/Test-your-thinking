/**
 * Serves the built app (`dist/ui`) — GET/HEAD only, no directory listing, no path outside the
 * directory. Vite's hashed assets (`/assets/*`) are cached for a year; everything else, the page
 * included, is revalidated, so a redeploy reaches the next participant at once.
 */

import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".pbf": "application/x-protobuf",
  ".pmtiles": "application/octet-stream", ".geojson": "application/geo+json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm", ".map": "application/json; charset=utf-8",
  // The background music (app/session/audio-manager.ts); with nosniff an untyped file may not play.
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};

export interface StaticFile {
  readonly status: 200 | 404;
  readonly headers: Record<string, string>;
  readonly body: Buffer | null;
}

/** Resolves `urlPath` inside `root`, or null when it would leave it (`..`, an encoded slash, a NUL). */
export function resolveInside(root: string, urlPath: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const full = normalize(join(root, decoded));
  const base = normalize(root.endsWith(sep) ? root : root + sep);
  return full === normalize(root) || full.startsWith(base) ? full : null;
}

async function fileAt(path: string): Promise<Buffer | null> {
  try { return (await stat(path)).isFile() ? await readFile(path) : null; } catch { return null; }
}

export async function serveStatic(root: string, urlPath: string): Promise<StaticFile> {
  const path = resolveInside(root, urlPath === "/" ? "/index.html" : urlPath);
  const notFound: StaticFile = { status: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: Buffer.from("not found") };
  if (path === null) return notFound;
  let target = path;
  let body = await fileAt(target);
  // A path without an extension is the single-page app (query parameters carry the configuration).
  if (body === null && extname(urlPath) === "") { target = join(root, "index.html"); body = await fileAt(target); }
  if (body === null) return notFound;
  const immutable = urlPath.startsWith("/assets/");
  return {
    status: 200, body,
    headers: {
      "content-type": TYPES[extname(target).toLowerCase()] ?? "application/octet-stream",
      // The page is revalidated (a redeploy reaches the next participant at once); the map images in `public/` are
      // not hashed but are cached for a day, so the map mounted again at V1 (after the training screen) or after a
      // resume reads them from the HTTP cache instead of revalidating during the run (I3; final review, 6 Oct 2026).
      "cache-control": immutable ? "public, max-age=31536000, immutable" : extname(target).toLowerCase() === ".html" ? "no-cache" : "public, max-age=86400",
    },
  };
}
