/**
 * The demo bridge's outputs and isolation (`tools/demo-bridge/`, DEMONSTRATION ONLY). The real build (`buildDemoBridge`, into a
 * temporary directory): neither `bridge.js` nor `data.json` carries the premise-evidence table, the directive premises or a
 * freeze item (answer key), and the bundle holds none of the forbidden modules; the built script, run as a page would run it,
 * answers exactly as the handler does in Node. The app's builds never reach `tools/demo-bridge`.
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.3–bp.4): `data.json` keeps the training's corpus in a list of its own (no truth, no
 * session record in it, no training record in the session's list); the scan covers both corpora — the training's spec, keys and texts
 * are forbidden modules and no output carries a training item's id; a training request run in the built page answers as in Node.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoBridge, type DemoBridgeBuild } from "../../tools/demo-bridge/build.js";
import { findLeaks, FORBIDDEN_MODULES, leakMarkers, trainingKeyMarkers } from "../../tools/demo-bridge/leaks.js";
import { createBridgeServer } from "../../tools/demo-bridge/serve.js";
import type { BridgeWindow } from "../../tools/demo-bridge/install.js";
import { data, fakeSample, FOUR, HAKU, OPEN, OPTIONS_ANSWER, post, runtime, training, type SampleCall } from "./fixtures.js";
import { TRAINING_NOW_S } from "../../app/session/training/corpus.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BRIDGE_DIR = join(ROOT, "tools", "demo-bridge");
const rel = (f: string) => relative(ROOT, f).split(sep).join("/");

let out: string;
let built: DemoBridgeBuild;
const outputs = () => ({
  "bridge.js": readFileSync(join(out, "bridge.js"), "utf8"), "data.json": readFileSync(join(out, "data.json"), "utf8"), "data.js": readFileSync(join(out, "data.js"), "utf8"),
});

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), "demo-bridge-"));
  built = await buildDemoBridge(out, { training }); // revision (bp): the fixture corpus until the built one is in the tree
}, 180_000);
afterAll(() => { if (out) rmSync(out, { recursive: true, force: true }); });

describe("the bridge's outputs carry no premise data and no freeze keys", () => {
  it("builds bridge.js, data.json and data.js (the same data as a script)", () => {
    expect(built.files.map((f) => f.name)).toEqual(["bridge.js", "data.json", "data.js"]);
    expect(built.totalBytes).toBeLessThan(4 * 1024 * 1024);
  });

  it("the scan finds nothing in either file — and finds each kind of marker when it is there", () => {
    const markers = leakMarkers();
    expect(markers.some((m) => m.what === "premise-evidence table")).toBe(true);
    expect(markers.some((m) => m.what === "directive premise table")).toBe(true);
    expect(markers.filter((m) => m.what === "freeze item (answer key)").length).toBeGreaterThan(20);
    expect(findLeaks(outputs(), markers)).toEqual([]);
    // The detector detects: a planted note, a premise text and a freeze item id are each found.
    for (const what of ["premise-evidence table", "directive premise table", "freeze item (answer key)"]) {
      const m = markers.find((x) => x.what === what && x.text.length > 12)!;
      expect(findLeaks({ "planted.js": `var x = ${JSON.stringify(m.text)};` }, markers).length).toBeGreaterThan(0);
    }
  });

  it("the bundle holds the handler but none of the forbidden modules (premise tables, freeze banks and keys, EXCON, the server's wiring and SDK)", () => {
    expect(built.modules).toContain("server/thinker/handler.ts");
    expect(built.modules).toContain("tools/demo-bridge/bridge.ts");
    expect(built.modules.filter((m) => FORBIDDEN_MODULES.some((re) => re.test(`/${m}`)))).toEqual([]);
  });

  it("data.json's records carry no truth", () => {
    const parsed = JSON.parse(outputs()["data.json"]) as typeof data;
    expect(parsed.scenario.atoms.length).toBe(data.scenario.atoms.length);
    expect(parsed.scenario.atoms.some((a) => "truth" in a || "consequence" in a)).toBe(false);
    expect(Object.keys(parsed.scenario).sort()).toEqual(["allocationSpace", "atoms", "cycles", "dutyOfficerMessages", "hinge", "practice"]);
    expect(Object.keys(parsed.prompts).sort()).toEqual(["prompt", "promptEn", "promptOpen", "promptOpenEn", "promptOpenOnce", "promptOpenOnceEn"]);
  });

  it("revision (bp): data.json keeps the training's corpus in its own list, with no truth; the two lists are disjoint", () => {
    const parsed = JSON.parse(outputs()["data.json"]) as typeof data;
    expect(Object.keys(parsed).sort()).toEqual(["format", "prompts", "scenario", "training", "version"]);
    expect(parsed.version).toBe(2);
    expect(parsed.training.atoms.map((a) => a.id)).toEqual(training.atoms.map((a) => a.id));
    expect(parsed.training.atoms.every((a) => a.id.startsWith("trn."))).toBe(true);
    expect(parsed.training.atoms.some((a) => "truth" in a || "consequence" in a)).toBe(false);
    expect(parsed.training.view).toEqual({ step: -9, nowS: TRAINING_NOW_S });
    expect(parsed.scenario.atoms.some((a) => a.id.startsWith("trn."))).toBe(false);
  });

  it("revision (bp): the scan covers the training — its spec, keys and texts are forbidden modules, and a training item's id is a leak", () => {
    for (const m of ["/content/training/incident.json", "/content/training/key.json", "/app/session/training/spec-data.ts", "/app/i18n/training-texts.ts", "/app/i18n/training-texts.en.ts"]) {
      expect(FORBIDDEN_MODULES.some((re) => re.test(m)), m).toBe(true);
    }
    const markers = trainingKeyMarkers({ items: [{ id: "training.s3.records1" }, { id: "training.s4.memory" }] as never });
    expect(markers.map((m) => m.what)).toEqual(["training item (answer key)", "training item (answer key)"]);
    expect(findLeaks({ "planted.js": 'var k = "training.s3.records1";' }, markers)).toHaveLength(1);
    expect(findLeaks(outputs(), markers)).toEqual([]);
    expect(findLeaks(outputs(), trainingKeyMarkers())).toEqual([]);
  });
});

describe("the built bridge.js, run as a page runs it", () => {
  /** Loads bridge.js into a fresh context with a fake page; returns the page's (wrapped) fetch and what passed through. */
  function page(answer: () => unknown) {
    const { sample, calls } = fakeSample(answer);
    const passed: string[] = [];
    const files = outputs();
    const original = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://demo.example/demo-bridge/data.json") return new Response(files["data.json"], { status: 200 });
      passed.push(url);
      return new Response("not found", { status: 404 });
    };
    const win: BridgeWindow = { fetch: original as typeof fetch, location: { href: "https://demo.example/index.html", search: "" }, claude: runtime(sample) };
    runInNewContext(files["bridge.js"], {
      window: win, location: win.location, document: { currentScript: { src: "https://demo.example/demo-bridge/bridge.js" } }, console,
      URL, URLSearchParams, Request, Response, TextEncoder, DOMException, AbortController, AbortSignal, performance, setTimeout, clearTimeout,
    });
    return { fetch: win.fetch, calls, passed };
  }

  async function inNode(tool: "haku" | "open_thinker", body: unknown, answer: () => unknown): Promise<{ body: Record<string, unknown>; calls: SampleCall[] }> {
    const { sample, calls } = fakeSample(answer);
    const result = await createBridgeServer(sample, data, { nowMs: () => 0, nowIso: () => "" }).serve(tool, body);
    return { body: result.body as Record<string, unknown>, calls };
  }
  const withoutLatency = ({ latencyMs: _l, ...rest }: Record<string, unknown>) => rest;

  it("Haku: the same response and the same sample input as the handler in Node", async () => {
    const p = page(() => FOUR);
    const res = await p.fetch("/api/thinker", post(HAKU));
    expect(res.status).toBe(200);
    const node = await inNode("haku", HAKU, () => FOUR);
    expect(withoutLatency(await res.json())).toEqual(withoutLatency(node.body));
    expect(p.calls.map((c) => [c.input, { ...c.options, signal: undefined }])).toEqual(node.calls.map((c) => [c.input, { ...c.options, signal: undefined }]));
  });

  it("the Open Thinker (guide cell, directive in force, English): the same response and input as in Node", async () => {
    const body = { ...OPEN, language: "en", question: "What options do I have?" };
    const p = page(() => OPTIONS_ANSWER);
    const res = await p.fetch("/api/thinker-open", post(body));
    const node = await inNode("open_thinker", body, () => OPTIONS_ANSWER);
    expect(withoutLatency(await res.json())).toEqual(withoutLatency(node.body));
    expect(p.calls.map((c) => c.input)).toEqual(node.calls.map((c) => c.input));
  });

  it("revision (bp): a training request — the same response and input as the handler in Node, over the training's records only", async () => {
    const body = { ...HAKU, view: 0, virtualTimeS: TRAINING_NOW_S, corpus: "training", question: "Mitä DR8 ilmoitti klo 10.05?", queryId: "trn.1" };
    const p = page(() => FOUR);
    const res = await p.fetch("/api/thinker", post(body));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { retrieved: { id: string }[]; retrievalMode: string; modelId: string };
    const node = await inNode("haku", body, () => FOUR);
    expect(withoutLatency(json as unknown as Record<string, unknown>)).toEqual(withoutLatency(node.body));
    expect(json.retrievalMode).toBe("lexical_only");
    expect(json.retrieved.length).toBeGreaterThan(0);
    expect(json.retrieved.every((r) => r.id.startsWith("trn."))).toBe(true);
    expect(p.calls.map((c) => c.input)).toEqual(node.calls.map((c) => c.input));
  });

  it("OPTIONS answers 204; the premise lookup passes through", async () => {
    const p = page(() => FOUR);
    expect((await p.fetch("/api/thinker", { method: "OPTIONS" })).status).toBe(204);
    expect((await p.fetch("/api/thinker/premise-review", post({}))).status).toBe(404);
    expect(p.passed).toEqual(["/api/thinker/premise-review"]);
    expect(p.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// The app's builds never reach tools/demo-bridge
// ---------------------------------------------------------------------------------------------------------------------------

const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".html"]);
const insideBridge = (f: string) => f === BRIDGE_DIR || f.startsWith(BRIDGE_DIR + sep);

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((e) => {
    if (e === "node_modules" || e === "dist" || e.startsWith(".")) return [];
    const full = join(dir, e);
    return statSync(full).isDirectory() ? filesUnder(full) : CODE_EXT.has(extname(full)) ? [full] : [];
  });
}

function specifiersOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  if (file.endsWith(".html")) return [...src.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => m[1]!);
  return [
    ...[...src.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g)].map((m) => m[1]!),
    ...[...src.matchAll(/(?:^|[\s;])import\s*["']([^"']+)["']/g)].map((m) => m[1]!),
    ...[...src.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!),
  ];
}

function resolveSpecifier(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec.split("?")[0]!);
  return [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (!CODE_EXT.has(extname(f))) continue;
    for (const spec of specifiersOf(f)) { const t = resolveSpecifier(f, spec); if (t && !seen.has(t)) stack.push(t); }
  }
  return seen;
}

describe("the app's builds never reach tools/demo-bridge", () => {
  it("no file under app/ or server/ imports it or names it", () => {
    const offenders = ["app", "server"].flatMap((d) => filesUnder(join(ROOT, d))).flatMap((f) => specifiersOf(f)
      .filter((spec) => /demo-bridge/.test(spec) || insideBridge(resolveSpecifier(f, spec) ?? ""))
      .map((spec) => `${rel(f)} -> ${spec}`));
    expect(offenders).toEqual([]);
  });

  it("the participant page's whole import graph (build, build:web, build:prod) never reaches it", () => {
    const closure = importClosure(join(ROOT, "app", "render", "ui", "index.html"));
    expect(closure.has(join(ROOT, "app", "session", "thinker-transport.ts"))).toBe(true);
    expect(closure.size).toBeGreaterThan(50);
    expect([...closure].filter(insideBridge).map(rel)).toEqual([]);
  });

  it("neither the Vite config nor the app's build scripts mention it; only demo:bridge builds it", () => {
    expect(readFileSync(join(ROOT, "vite.config.ts"), "utf8")).not.toMatch(/demo-bridge/);
    expect(readFileSync(join(ROOT, "tools", "deploy", "build.ts"), "utf8")).not.toMatch(/demo-bridge/);
    const scripts = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;
    expect(Object.entries(scripts).filter(([, cmd]) => /demo-bridge/.test(cmd)).map(([name]) => name)).toEqual(["demo:bridge"]);
  });
});
