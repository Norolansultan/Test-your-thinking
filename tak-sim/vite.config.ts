import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath, type Plugin } from "vite";
import preact from "@preact/preset-vite";

// maplibre-gl 6 starts its worker from `new URL("./maplibre-gl-worker.mjs", import.meta.url)`, i.e. next
// to the bundle's own script in dist/ui/assets/. `vite build` does not copy that file (nor the
// maplibre-gl-shared.mjs it imports), so in the production build the worker 404s and every GeoJSON
// layer (the fire, the projection, crew links) stays empty while the raster basemap and the DOM
// markers still show (found 9 Oct 2026 on the hosted pilot). Emit both, unhashed, beside the bundle.
function maplibreWorker(): Plugin {
  const dist = dirname(createRequire(import.meta.url).resolve("maplibre-gl/dist/maplibre-gl.mjs"));
  return {
    name: "maplibre-worker",
    apply: "build",
    generateBundle() {
      for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
        this.emitFile({ type: "asset", fileName: `assets/${file}`, source: readFileSync(join(dist, file)) });
      }
    },
  };
}

// SPEC/28 §8: EXCON, the researcher-only exercise-control page (`app/excon/`, it SHOWS TRUTH). It is a
// separate page the dev server serves at /excon.html (`npm run excon`) and that no build ever contains:
//  - `exconDevPage` is `apply: "serve"`, so `vite build` / `npm run build:prod` never see the page (it is
//    deliberately NOT a rollup input — a rollup input would put its chunks into dist/ui, which the
//    production server serves);
//  - `exconBuildGuard` fails any build whose output contains a module from app/excon/ or a file named
//    excon (e.g. if participant code ever imported it), and `tools/deploy/build.ts` re-checks dist/ui;
//  - `server/production/static.ts` refuses /excon paths even if a file got there.
// test/excon/isolation.spec.ts checks all of it, plus that nothing outside app/excon/ imports app/excon/.
const EXCON_DIR = fileURLToPath(new URL("./app/excon/", import.meta.url));
const EXCON_PAGE_PATHS = ["/excon.html", "/excon"] as const;

function exconDevPage(): Plugin {
  return {
    name: "excon-dev-page",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!(EXCON_PAGE_PATHS as readonly string[]).includes(path)) return next();
        // The page lives in app/excon/ (outside the participant root); its entry is served through /@fs/.
        const entry = `/@fs/${normalizePath(join(EXCON_DIR, "main.tsx")).replace(/^\/+/, "")}`;
        const raw = readFileSync(join(EXCON_DIR, "excon.html"), "utf8").replace('src="./main.tsx"', `src="${entry}"`);
        server.transformIndexHtml("/excon.html", raw).then((html) => {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(html);
        }, next);
      });
      server.httpServer?.once("listening", () => setTimeout(() => {
        for (const url of server.resolvedUrls?.local ?? []) server.config.logger.info(`  \u279c  EXCON (researcher only, shows truth): ${url}excon.html`);
      }, 0));
    },
  };
}

function exconBuildGuard(): Plugin {
  return {
    name: "excon-build-guard",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const [fileName, out] of Object.entries(bundle)) {
        const ids = out.type === "chunk" ? out.moduleIds : [];
        if (/excon/i.test(fileName) || ids.some((id) => normalizePath(id).includes("/app/excon/"))) {
          this.error(`EXCON (researcher-only, shows truth, SPEC/28 §8) must never be in a build: ${fileName}`);
        }
      }
    },
  };
}

// Dev/preview build only — SPEC/05 §8 requires the real instrument's asset
// bundle (tiles, fonts, scenario content) to be resolved offline before a
// session starts (invariant I3: "no network during a run"). This config
// has no such bundle to point at yet (tools/bundle/ is not built), so the
// dev server is a visual preview, not the compliant instrument — see
// app/render/ui/README.md.
export default defineConfig({
  root: "app/render/ui",
  plugins: [preact(), maplibreWorker(), exconDevPage(), exconBuildGuard()],
  server: {
    host: true,
    port: 5173,
    // localtunnel (`npx localtunnel --port 5173`) serves the dev preview from a fresh *.loca.lt
    // subdomain each run; the leading dot allows them all.
    allowedHosts: [".loca.lt"],
    // SPEC/14 revision (q): Thinker's proxy (`npm run thinker:server`). The browser only ever calls
    // its own origin; the API key stays in the proxy.
    proxy: {
      "/api/thinker": { target: `http://127.0.0.1:${process.env.THINKER_PORT ?? 8787}` },
      "/api/thinker-open": { target: `http://127.0.0.1:${process.env.THINKER_PORT ?? 8787}` },
      // SPEC/32 §3: the plan review's premise lookup (already under the "/api/thinker" prefix; named for clarity).
      "/api/thinker/premise-review": { target: `http://127.0.0.1:${process.env.THINKER_PORT ?? 8787}` },
      // SPEC/05 §9: the post-run session-log upload (`npm run session-log:server`).
      "/api/session-log": { target: `http://127.0.0.1:${process.env.SESSION_LOG_PORT ?? 8788}` },
    },
  },
  // The build stamp in the header's `appVersion` (`app/session/annotations.ts`): the commit, set by
  // `npm run build:prod` (`tools/deploy/build.ts`); empty in development.
  define: {
    __APP_BUILD__: JSON.stringify(process.env.APP_BUILD ?? ""),
  },
  build: {
    outDir: "../../../dist/ui",
    emptyOutDir: true,
  },
  // maplibre-gl spawns its GeoJSON-tiling work in a Web Worker via a
  // `new URL(...)`-relative import; Vite's dependency pre-bundling
  // (esbuild) breaks that URL, so the worker script 404s silently and
  // every geometry layer (fire perimeter, envelope, units, ...) stores
  // its data but never renders a single pixel of it. Excluding the
  // package from pre-bundling keeps it in its own natural ESM form, where
  // the worker URL resolves correctly.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
    // The EXCON page (outside the participant root, so not scanned) draws 2525 symbols with milsymbol;
    // pre-bundled up front so opening /excon.html does not trigger a re-optimise-and-reload.
    include: ["milsymbol"],
  },
});
