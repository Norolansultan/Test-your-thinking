/**
 * The production server (docs/DEPLOYMENT.md): one process serving the built app, /api/thinker and
 * /api/session-log; CORS limited to the server's own origin and ALLOWED_ORIGINS; no path outside the
 * app directory; configuration from the environment only.
 */

import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppServer, originAllowed } from "../../server/production/server.js";
import { resolveInside } from "../../server/production/static.js";
import { ConfigError, loadConfig, recruitmentGateFrom } from "../../server/production/config.js";
import { SessionLogStore } from "../../server/session-log/store.js";
import { isStudyLink } from "../../server/production/recruitment-gate.js";

let root: string;
let server: Server;
let base: string;
const thinkerCalls: unknown[] = [];
const openCalls: unknown[] = [];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "prod-server-"));
  const app = join(root, "ui");
  await mkdir(join(app, "assets"), { recursive: true });
  await writeFile(join(app, "index.html"), "<!doctype html><title>app</title>");
  await writeFile(join(app, "assets", "index-abc123.js"), "console.log(1)");
  await mkdir(join(app, "maps", "topo"), { recursive: true });
  await writeFile(join(app, "maps", "topo", "0_0.webp"), "img");
  await writeFile(join(root, "secret.txt"), "do not serve");
  server = createAppServer({
    staticDir: app, allowedOrigins: ["https://study.example.org"],
    sessionLog: new SessionLogStore({ dir: join(root, "sessions") }),
    thinker: async (body) => { thinkerCalls.push(body); return { status: 200, body: { ok: true } }; },
    thinkerOpen: async (body) => { openCalls.push(body); return { status: 200, body: { open: true } }; },
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(root, { recursive: true, force: true });
});

type RawResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

/** A raw request (fetch normalises `..` away and forbids setting Origin in some runtimes). */
function raw(path: string, method = "GET", headers: Record<string, string> = {}, body?: string): Promise<RawResponse> {
  return rawAt(base, path, method, headers, body);
}

function rawAt(at: string, path: string, method = "GET", headers: Record<string, string> = {}, body?: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(`${at}${path}`, { method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

describe("static app", () => {
  it("serves index.html at / and for any extensionless path (the single-page app), revalidated", async () => {
    for (const p of ["/", "/?tuotanto&koodi=ABC", "/start"]) {
      const res = await raw(p);
      expect(res.status).toBe(200);
      expect(res.body).toContain("<title>app</title>");
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  it("serves hashed assets as immutable, and 404s a missing file", async () => {
    const js = await raw("/assets/index-abc123.js");
    expect(js.status).toBe(200);
    expect(js.headers["content-type"]).toContain("text/javascript");
    expect(js.headers["cache-control"]).toContain("immutable");
    expect((await raw("/assets/missing.js")).status).toBe(404);
  });

  it("caches the map images for a day, so the map mounted again during the run does not revalidate them (I3)", async () => {
    const img = await raw("/maps/topo/0_0.webp");
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/webp");
    expect(img.headers["cache-control"]).toBe("public, max-age=86400");
    expect((await raw("/index.html")).headers["cache-control"]).toBe("no-cache");
  });

  it("never serves a file outside the app directory", async () => {
    for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2F..%2Fsecret.txt", "/..%5csecret.txt"]) {
      const res = await raw(p);
      expect(res.body).not.toContain("do not serve");
    }
    expect(resolveInside("/srv/app", "/../x")).toBeNull();
    expect(resolveInside("/srv/app", "/a/%00")).toBeNull();
    expect(resolveInside("/srv/app", "/a/b.js")).toBe(join("/srv/app", "a", "b.js")); // the platform's separator
  });

  it("refuses other methods on the app", async () => {
    expect((await raw("/", "POST")).status).toBe(405);
  });
});

describe("API routing and CORS", () => {
  it("routes /api/thinker-open to the Open Thinker (8 Oct 2026), with room for its history (64 KiB)", async () => {
    const res = await raw("/api/thinker-open", "POST", { "content-type": "application/json" }, JSON.stringify({ q: "x".repeat(40_000) }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ open: true });
    expect(openCalls).toHaveLength(1);
    expect((await raw("/api/thinker-open", "POST", {}, JSON.stringify({ q: "x".repeat(70_000) }))).status).toBe(413);
    expect((await raw("/api/thinker-open", "OPTIONS")).status).toBe(204);
  });

  it("routes /api/thinker to the Thinker handler (POST, JSON, size-limited)", async () => {
    const res = await raw("/api/thinker", "POST", { "content-type": "application/json" }, JSON.stringify({ q: 1 }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    expect(thinkerCalls.at(-1)).toEqual({ q: 1 });
    expect((await raw("/api/thinker", "POST", {}, "{not json")).status).toBe(400);
    expect((await raw("/api/thinker", "POST", {}, JSON.stringify({ q: "x".repeat(20_000) }))).status).toBe(413);
    expect((await raw("/api/thinker", "GET")).status).toBe(405);
  });

  it("routes /api/session-log/* to the upload endpoint, and 404s other /api paths", async () => {
    expect((await raw("/api/session-log/abc/chunks/0?total=1", "PUT", {}, "x")).status).toBe(400); // short id
    expect((await raw("/api/other")).status).toBe(404);
  });

  it("allows no Origin, the server's own origin and ALLOWED_ORIGINS; refuses others with 403", async () => {
    const host = new URL(base).host;
    expect((await raw("/api/thinker", "POST", { origin: `http://${host}` }, "{}")).status).toBe(200);
    const listed = await raw("/api/thinker", "POST", { origin: "https://study.example.org" }, "{}");
    expect(listed.status).toBe(200);
    expect(listed.headers["access-control-allow-origin"]).toBe("https://study.example.org");
    expect((await raw("/api/thinker", "POST", { origin: "https://evil.example" }, "{}")).status).toBe(403);
    expect((await raw("/api/session-log/abcdefgh1/complete", "POST", { origin: "http://localhost:5173" }, "{}")).status).toBe(403);
    const pre = await raw("/api/session-log/abcdefgh1/chunks/0", "OPTIONS", { origin: "https://study.example.org" });
    expect(pre.status).toBe(204);
    expect(pre.headers["access-control-allow-headers"]).toContain("x-chunk-sha256");
    expect(originAllowed("not a url", "h", [])).toBe(false);
  });

  it("without a Thinker (THINKER=off) /api/thinker is 404 — its preflight too, so the study's preflight check does not pass a Thinker cell", async () => {
    const s = createAppServer({});
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/thinker`;
    expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(404);
    expect((await fetch(url, { method: "OPTIONS" })).status).toBe(404);
    await new Promise<void>((r) => s.close(() => r()));
  });

  it("answers a preflight only for a served route", async () => {
    expect((await raw("/api/thinker", "OPTIONS", { origin: "https://study.example.org" })).status).toBe(204);
    expect((await raw("/api/other", "OPTIONS", { origin: "https://study.example.org" })).status).toBe(404);
  });
});

describe("configuration from the environment", () => {
  it("defaults: port 8080 on 127.0.0.1, same origin only, logs/sessions, dist/ui, Thinker on", () => {
    const c = loadConfig({});
    expect(c).toMatchObject({ port: 8080, host: "127.0.0.1", allowedOrigins: [], thinker: "on", thinkerMode: "study" });
    expect(loadConfig({ THINKER_MODE: "demo" }).thinkerMode).toBe("demo");
    expect(() => loadConfig({ THINKER_MODE: "studdy" })).toThrow(ConfigError);
    expect(c.sessionLogDir.endsWith(join("logs", "sessions"))).toBe(true);
    expect(c.staticDir.endsWith(join("dist", "ui"))).toBe(true);
  });

  it("reads PORT, HOST, ALLOWED_ORIGINS, SESSION_LOG_DIR, STATIC_DIR, THINKER", () => {
    const c = loadConfig({ PORT: "9000", HOST: "0.0.0.0", ALLOWED_ORIGINS: "https://a.example, https://b.example:8443", SESSION_LOG_DIR: "/data/sessions", STATIC_DIR: "/srv/ui", THINKER: "off" });
    expect(c).toEqual({ port: 9000, host: "0.0.0.0", allowedOrigins: ["https://a.example", "https://b.example:8443"], sessionLogDir: "/data/sessions", staticDir: "/srv/ui", thinker: "off", thinkerMode: "study", adminToken: null, autoAssign: null, recruitmentGate: false });
  });

  it("reads RECRUITMENT_GATE: 1 on; unset, empty or 0 off", () => {
    expect(loadConfig({ RECRUITMENT_GATE: "1" }).recruitmentGate).toBe(true);
    expect(loadConfig({ RECRUITMENT_GATE: " 1 " }).recruitmentGate).toBe(true);
    for (const v of [undefined, "", "0"]) expect(loadConfig({ RECRUITMENT_GATE: v }).recruitmentGate).toBe(false);
    expect(recruitmentGateFrom("1")).toBe(true);
    expect(() => recruitmentGateFrom("on")).toThrow(ConfigError);
  });

  it.each([{ PORT: "0" }, { PORT: "http" }, { ALLOWED_ORIGINS: "https://a.example/path" }, { ALLOWED_ORIGINS: "*" }, { THINKER: "maybe" }, { RECRUITMENT_GATE: "yes" }, { RECRUITMENT_GATE: "true" }])("refuses %j", (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it("never reads the API key: it stays in the environment for the SDK", () => {
    expect(JSON.stringify(loadConfig({ GEMINI_API_KEY: "sk-secret" }))).not.toContain("sk-secret");
  });

  it("passes THINKER_MODE (study by default) to the proxy, so a study server without the English index does not start", () => {
    const main = readFileSync("server/production/main.ts", "utf8");
    expect(main).toMatch(/createThinkerDeps\(\{[^}]*mode: config\.thinkerMode/);
    expect(main).toMatch(/englishNotice/);
  });

  it("passes RECRUITMENT_GATE to the server and says at start whether it is on", () => {
    const main = readFileSync("server/production/main.ts", "utf8");
    expect(main).toMatch(/recruitmentGate: config\.recruitmentGate/);
    expect(main).toMatch(/recruitment gate ON/);
  });
});

// `31` P-12 (first SPEC/29 (ay) rule 2): while recruitment runs only study links reach the app; the demonstration's
// start page (its condition buttons and its professional/public version switch) is not served.
describe("the recruitment gate (RECRUITMENT_GATE=1)", () => {
  let gateRoot: string;
  let gated: Server;
  let open: Server;
  let gatedBase: string;
  let openBase: string;
  const STUDY_JS = "/assets/index-abc123.js";

  beforeAll(async () => {
    gateRoot = await mkdtemp(join(tmpdir(), "prod-gate-"));
    await mkdir(join(gateRoot, "assets"), { recursive: true });
    await mkdir(join(gateRoot, "maps", "topo"), { recursive: true });
    await writeFile(join(gateRoot, "index.html"), "<!doctype html><title>app</title>");
    await writeFile(join(gateRoot, STUDY_JS), 'const p="tuotanto";');
    await writeFile(join(gateRoot, "maps", "topo", "0_0.webp"), "img");
    const thinker = async () => ({ status: 200, body: { ok: true } });
    gated = createAppServer({ staticDir: gateRoot, recruitmentGate: true, thinker });
    open = createAppServer({ staticDir: gateRoot, thinker });
    await new Promise<void>((r) => gated.listen(0, "127.0.0.1", r));
    await new Promise<void>((r) => open.listen(0, "127.0.0.1", r));
    gatedBase = `http://127.0.0.1:${(gated.address() as AddressInfo).port}`;
    openBase = `http://127.0.0.1:${(open.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => gated.close(() => r()));
    await new Promise<void>((r) => open.close(() => r()));
    await rm(gateRoot, { recursive: true, force: true });
  });

  it("serves the app's page to a study link, as before", async () => {
    for (const p of ["/?tuotanto", "/?tuotanto&koodi=ABC123", "/?koodi=ABC123&tuotanto", "/?pilotti&tuotanto&solu=k4", "/index.html?tuotanto", "/start?tuotanto", "/?tuotanto=1"]) {
      const res = await rawAt(gatedBase, p);
      expect(res.status, p).toBe(200);
      expect(res.body).toContain("<title>app</title>");
      expect(res.headers["cache-control"]).toBe("no-cache");
    }
  });

  it("gives every other page request — the demonstration's start page — a neutral 404 page, uncached", async () => {
    for (const p of ["/", "/index.html", "/start", "/?solu=k4", "/?pilotti", "/?koodi=ABC123", "/?tuotantoX", "/?lang=fi"]) {
      const res = await rawAt(gatedBase, p);
      expect(res.status, p).toBe(404);
      expect(res.body).not.toContain("<title>app</title>");
      expect(res.body).toContain("not available");
      expect(res.body).not.toMatch(/demo|game|peli/i);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    }
    expect((await rawAt(gatedBase, "/", "HEAD")).status).toBe(404);
  });

  it("leaves the study's assets, the map and the API as they are", async () => {
    const js = await rawAt(gatedBase, STUDY_JS);
    expect(js.status).toBe(200);
    expect(js.headers["cache-control"]).toContain("immutable");
    expect((await rawAt(gatedBase, "/maps/topo/0_0.webp")).status).toBe(200);
    expect((await rawAt(gatedBase, "/api/thinker", "POST", {}, "{}")).status).toBe(200);
  });

  it("is off by default: the same build serves the demonstration", async () => {
    for (const p of ["/", "/?solu=k4", "/?tuotanto"]) expect((await rawAt(openBase, p)).status, p).toBe(200);
  });

  it("reads a study link as the start page does (STUDY_PARAM, any value)", () => {
    expect(isStudyLink("/?tuotanto")).toBe(true);
    expect(isStudyLink("/x?a=1&tuotanto=")).toBe(true);
    expect(isStudyLink("/")).toBe(false);
    expect(isStudyLink("/?tuotanto_x=1")).toBe(false);
    expect(isStudyLink("/tuotanto")).toBe(false);
  });
});
