/**
 * The play harness's images (`tools/play/`): each `ImageRequest` (`map-data.ts`) drawn in headless Chromium through Playwright and
 * written as a PNG. The live map is the app's own `MapView` (`map-page.ts`, bundled with esbuild into `<run>/.map-cache/`), served with the basemap tiles and MapLibre's worker from a local HTTP server on 127.0.0.1, so MapLibre
 * draws it exactly as the browser does (WebGL by SwiftShader). The freeze map, the map training's extract and the practice feedback's
 * head map are SVG over the same tiles. Nothing here touches the session: it only draws what the harness hands it.
 *
 * Playwright is not a dependency of the project: it is imported from `PLAY_PLAYWRIGHT` (default
 * `/opt/node22/lib/node_modules/playwright/index.mjs`) with the browser at `PLAY_CHROMIUM` (default `/opt/pw-browsers/chromium`).
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BASEMAP_TILE_PX, BASEMAP_TILES, basemapPx, tilesFor } from "../../app/render/ui/basemap-px.js";
import { trainingSvg } from "../../app/render/ui/map-training-overlay.js";
import { MAP_TRAINING } from "../../app/session/map-training.js";
import { topoTileUrl } from "../../app/i18n/place-names.js";
import type { GeoExtent } from "../../app/engine/primitives.js";
import { extentOutlinePx, FREEZE_GRID_STEP_PX, FREEZE_MAP_MARGIN_PX, freezeFrame, freezeTiles } from "./freeze-grid.js";
import type { ImageRequest } from "./map-data.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = join(ROOT, "app/render/ui/public");
const MAPLIBRE_DIST = join(ROOT, "node_modules/maplibre-gl/dist");
const PLAYWRIGHT = process.env.PLAY_PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROMIUM = process.env.PLAY_CHROMIUM ?? "/opt/pw-browsers/chromium";

const TYPES: Readonly<Record<string, string>> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };

/** Bundles `map-page.ts` (the app's MapView and its imports) into `cacheDir`: on every call (about 0.3 s), so it is never stale. */
async function mapBundle(cacheDir: string): Promise<string> {
  const out = join(cacheDir, "map-page.js");
  mkdirSync(cacheDir, { recursive: true });
  const esbuild = await import("esbuild");
  await esbuild.build({
    entryPoints: [join(ROOT, "tools/play/map-page.ts")], bundle: true, format: "esm", platform: "browser", target: "es2022",
    jsx: "automatic", jsxImportSource: "preact", outfile: out, logLevel: "error", absWorkingDir: ROOT,
  });
  return out;
}

/** A static server: `pages` by path, the bundle, MapLibre's worker and CSS, and the public assets (the basemap tiles). */
function serve(pages: Map<string, string>, bundle: string | null): Promise<{ server: Server; base: string }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    const page = pages.get(path);
    let file: string | null = null;
    if (page === undefined) {
      if (path === "/map-page.js" && bundle) file = bundle;
      else if (path === "/maplibre-gl-worker.mjs" || path === "/maplibre-gl-shared.mjs" || path === "/maplibre-gl.css") file = join(MAPLIBRE_DIST, path.slice(1));
      else if (path.startsWith("/maps/") && !path.includes("..")) file = join(PUBLIC, path);
    }
    if (page === undefined && (file === null || !existsSync(file))) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": page !== undefined ? TYPES[".html"]! : TYPES[extname(file!)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(page ?? readFileSync(file!));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => {
    const a = server.address();
    ok({ server, base: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}` });
  }));
}

const htmlPage = (head: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">${head}<style>html,body{margin:0;background:#12151a;color:#e8eaed;font-family:-apple-system,'Segoe UI',Roboto,sans-serif}</style></head><body>${body}</body></html>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const tileHref = (row: number, col: number, lang: "fi" | "en") => topoTileUrl(`/maps/topo/${row}_${col}.webp`, lang);

/** The freeze map: the extent's box of the basemap, outside the extent shaded, a labelled pixel grid (PNG pixels). */
export function freezeSvg(extent: Pick<GeoExtent, "south" | "north" | "west" | "east">, lang: "fi" | "en"): { readonly svg: string; readonly width: number; readonly height: number } {
  const f = freezeFrame(extent), m = FREEZE_MAP_MARGIN_PX;
  const W = f.widthPx + 2 * m, H = f.heightPx + 2 * m;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`, `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<defs><clipPath id="map"><rect x="${m}" y="${m}" width="${f.widthPx}" height="${f.heightPx}"/></clipPath></defs><g clip-path="url(#map)">`];
  for (const t of freezeTiles(f, BASEMAP_TILE_PX, BASEMAP_TILES)) out.push(`<image href="${esc(tileHref(t.row, t.col, lang))}" x="${t.x}" y="${t.y}" width="${t.size}" height="${t.size}" preserveAspectRatio="none"/>`);
  const ring = extentOutlinePx(extent, f).map((p) => `${p.x},${p.y}`).join(" ");
  out.push(`<path fill-rule="evenodd" fill="#7a7f86" fill-opacity="0.45" d="M${m},${m}h${f.widthPx}v${f.heightPx}h${-f.widthPx}Z M${ring.split(" ").join(" L")}Z"/>`, "</g>");
  for (let v = m + FREEZE_GRID_STEP_PX - (m % FREEZE_GRID_STEP_PX); v <= m + Math.max(f.widthPx, f.heightPx); v += FREEZE_GRID_STEP_PX) {
    const major = v % (2 * FREEZE_GRID_STEP_PX) === 0;
    const style = `stroke="#1c1b19" stroke-opacity="${major ? 0.55 : 0.25}" stroke-width="${major ? 1 : 0.7}"`;
    if (v <= m + f.widthPx) out.push(`<line x1="${v}" y1="${m}" x2="${v}" y2="${m + f.heightPx}" ${style}/>`, ...(major ? [`<text x="${v}" y="${m - 8}" font-size="12" text-anchor="middle" fill="#1c1b19">${v}</text>`, `<text x="${v}" y="${m + f.heightPx + 18}" font-size="12" text-anchor="middle" fill="#1c1b19">${v}</text>`] : []));
    if (v <= m + f.heightPx) out.push(`<line x1="${m}" y1="${v}" x2="${m + f.widthPx}" y2="${v}" ${style}/>`, ...(major ? [`<text x="${m - 6}" y="${v + 4}" font-size="12" text-anchor="end" fill="#1c1b19">${v}</text>`, `<text x="${m + f.widthPx + 6}" y="${v + 4}" font-size="12" fill="#1c1b19">${v}</text>`] : []));
  }
  out.push(`<rect x="${m}" y="${m}" width="${f.widthPx}" height="${f.heightPx}" fill="none" stroke="#1c1b19" stroke-width="1.2"/>`, `<text x="${m}" y="16" font-size="12" fill="#1c1b19">x →</text>`, `<text x="6" y="${m + 14}" font-size="12" fill="#1c1b19">y ↓</text>`, "</svg>");
  return { svg: out.join(""), width: W, height: H };
}

/** The practice feedback's head map (`PracticeFeedbackScreen`'s `HeadMap`, its geometry and colours). */
function headSvg(r: Extract<ImageRequest, { kind: "head" }>): string {
  const h = basemapPx(r.head.head);
  const mk = r.head.mark ? basemapPx(r.head.mark) : null;
  const spread = mk ? Math.hypot(mk.x - h.x, mk.y - h.y) : 0;
  const half = Math.min(500, Math.max(150, spread * 1.3));
  const x0 = h.x - half, y0 = h.y - half, size = 2 * half, rr = size / 70;
  const ring = r.head.outline.map(basemapPx).map((p) => `${p.x},${p.y}`).join(" ");
  const tiles = tilesFor(x0, y0, x0 + size, y0 + size).map(({ row, col }) => `<image href="${esc(tileHref(row, col, r.lang))}" x="${col * BASEMAP_TILE_PX}" y="${row * BASEMAP_TILE_PX}" width="${BASEMAP_TILE_PX}" height="${BASEMAP_TILE_PX}" preserveAspectRatio="none"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="${x0} ${y0} ${size} ${size}" style="background:#f4f1ea">${tiles}` +
    (ring ? `<polygon points="${ring}" fill="none" stroke="#7a2e1a" stroke-width="${rr / 2.5}"/>` : "") +
    `<circle cx="${h.x}" cy="${h.y}" r="${rr}" fill="#d93025" stroke="#ffffff" stroke-width="${rr / 3}"/>` +
    (mk ? `<circle cx="${mk.x}" cy="${mk.y}" r="${rr}" fill="#1a73e8" stroke="#ffffff" stroke-width="${rr / 3}"/>` : "") + "</svg>";
}

interface PageSpec { readonly html: string; readonly selector: string; readonly width: number; readonly height: number; readonly waitMap: boolean }

function pageOf(r: ImageRequest, extent: Pick<GeoExtent, "south" | "north" | "west" | "east">): PageSpec {
  switch (r.kind) {
    case "live": {
      const data = JSON.stringify(r.data).replace(/</g, "\\u003c");
      return { html: htmlPage(`<link rel="stylesheet" href="/maplibre-gl.css"><script>window.__PLAY_MAP__=${data}</script>`, `<div id="app"></div><script type="module" src="/map-page.js"></script>`), selector: "#play-map-root", width: r.data.widthPx, height: r.data.heightPx, waitMap: true };
    }
    case "freeze": { const f = freezeSvg(extent, r.lang); return { html: htmlPage("", f.svg), selector: "svg", width: f.width, height: f.height, waitMap: false }; }
    case "pretest": { // the map training's task (25 Oct 2026), with the harness's x,y grid
      const task = MAP_TRAINING.tasks.find((t) => t.id === r.taskId)!;
      const svg = trainingSvg(MAP_TRAINING, task, r.phase, topoTileUrl(`/maps/topo/${MAP_TRAINING.crop.tile}.webp`, r.lang), r.lang, r.answer, { grid: true });
      const px = Number(/width="(\d+)"/.exec(svg)![1]);
      return { html: htmlPage("", svg), selector: "svg", width: px, height: px, waitMap: false };
    }
    case "head": return { html: htmlPage("", headSvg(r)), selector: "svg", width: 420, height: 420, waitMap: false };
  }
}

/** Draws every request (one browser for all) and writes its PNG; returns the paths written. */
export async function renderImages(requests: readonly ImageRequest[], extent: Pick<GeoExtent, "south" | "north" | "west" | "east">, cacheDir: string): Promise<string[]> {
  if (requests.length === 0) return [];
  const bundle = requests.some((r) => r.kind === "live") ? await mapBundle(cacheDir) : null;
  const pages = new Map<string, string>();
  const specs = requests.map((r, i) => { const spec = pageOf(r, extent); pages.set(`/page-${i}.html`, spec.html); return spec; });
  const { server, base } = await serve(pages, bundle);
  const pw = (await import(PLAYWRIGHT)) as { chromium: { launch(o: unknown): Promise<PlayBrowser> } };
  const browser = await pw.chromium.launch({ executablePath: CHROMIUM, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const written: string[] = [];
  try {
    for (const [i, r] of requests.entries()) {
      const spec = specs[i]!;
      const page = await browser.newPage({ viewport: { width: spec.width + 40, height: spec.height + 40 }, deviceScaleFactor: 1 });
      try {
        await page.goto(`${base}/page-${i}.html`, { waitUntil: "networkidle" });
        if (spec.waitMap) await page.waitForFunction("window.__playMapDone === true", undefined, { timeout: 30_000 });
        mkdirSync(dirname(r.path), { recursive: true });
        await page.locator(spec.selector).first().screenshot({ path: r.path });
        written.push(r.path);
      } finally { await page.close(); }
    }
  } finally {
    await browser.close();
    server.close();
  }
  return written;
}

interface PlayPage {
  goto(url: string, o: unknown): Promise<unknown>;
  waitForFunction(expr: string, arg: unknown, o: unknown): Promise<unknown>;
  locator(selector: string): { first(): { screenshot(o: { path: string }): Promise<unknown> } };
  close(): Promise<void>;
}
interface PlayBrowser { newPage(o: unknown): Promise<PlayPage>; close(): Promise<void> }
