/**
 * SPEC/36: `POST /api/results-contact` and its store (`server/production/results-contact.ts`): validated (session id, address
 * shape and length, language), one JSON line per contact in its own directory (0600), rate-limited per client address, CORS as the
 * other routes, 404 without a store, and never written to stdout or stderr; the configuration keeps the directory apart from the
 * session logs; the browser's sender (`app/session/results-contact.ts`) against the real route and without one.
 */

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppServer } from "../../server/production/server.js";
import { ResultsContactStore, RESULTS_CONTACT_FILE } from "../../server/production/results-contact.js";
import { ConfigError, loadConfig } from "../../server/production/config.js";
import { checkResultsContactRequest, isValidEmail, MAX_EMAIL_LENGTH, RESULTS_CONTACT_ENDPOINT, sendResultsContact, type FetchLike } from "../../app/session/results-contact.js";

const SESSION = "s-results-0001";
const EMAIL = "participant.one@example.org";

let root: string;
let server: Server;
let bare: Server;
let base: string;
let bareBase: string;
let store: ResultsContactStore;

async function listen(s: Server): Promise<string> {
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "results-contact-"));
  store = new ResultsContactStore({ dir: join(root, "contacts"), ratePerHour: 3, now: () => new Date("2026-11-01T10:00:00Z") });
  server = createAppServer({ allowedOrigins: ["https://study.example.org"], resultsContact: store });
  bare = createAppServer({});
  base = await listen(server);
  bareBase = await listen(bare);
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await new Promise<void>((r) => bare.close(() => r()));
  await rm(root, { recursive: true, force: true });
});

function post(at: string, body: string, headers: Record<string, string> = {}, method = "POST"): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(`${at}${RESULTS_CONTACT_ENDPOINT}`, { method, headers: { "content-type": "application/json", ...headers } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (o: unknown) => JSON.stringify(o);

describe("the address check (shared by the screen and the server)", () => {
  it("accepts ordinary addresses and refuses malformed or overlong ones", () => {
    for (const ok of [EMAIL, "a@b.fi", "first+tag@sub.domain.example.com"]) expect(isValidEmail(ok), ok).toBe(true);
    for (const bad of ["", "plain", "a@b", "a b@c.fi", "a@@b.fi", ".a@b.fi", "a..b@c.fi", "a@b.c", "<a@b.fi>", `${"a".repeat(65)}@b.fi`, `a@${"b".repeat(250)}.fi`]) expect(isValidEmail(bad), bad).toBe(false);
    expect(isValidEmail(`a@${"b".repeat(MAX_EMAIL_LENGTH)}.fi`)).toBe(false);
    expect(checkResultsContactRequest({ sessionId: SESSION, email: `  ${EMAIL} `, lang: "fi" })).toEqual({ ok: true, request: { sessionId: SESSION, email: EMAIL, lang: "fi" } });
    expect(checkResultsContactRequest({ sessionId: "../x", email: EMAIL, lang: "fi" })).toMatchObject({ ok: false });
    expect(checkResultsContactRequest({ sessionId: SESSION, email: EMAIL, lang: "sv" })).toMatchObject({ ok: false });
    expect(checkResultsContactRequest([SESSION])).toMatchObject({ ok: false });
  });
});

describe("POST /api/results-contact", () => {
  it("stores one JSON line per contact in its own directory, readable by the owner only; never prints the address", async () => {
    const log = vi.spyOn(console, "log"), error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn");
    const res = await post(base, json({ sessionId: SESSION, email: EMAIL, lang: "en" }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "stored" });
    const file = join(root, "contacts", RESULTS_CONTACT_FILE);
    const lines = (await readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l) as unknown);
    expect(lines).toEqual([{ sessionId: SESSION, email: EMAIL, lang: "en", receivedAtIso: "2026-11-01T10:00:00.000Z" }]);
    if (process.platform !== "win32") {
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      expect((await stat(join(root, "contacts"))).mode & 0o777).toBe(0o700);
    }
    for (const spy of [log, error, warn]) expect(JSON.stringify(spy.mock.calls)).not.toContain(EMAIL);
    log.mockRestore(); error.mockRestore(); warn.mockRestore();
  });

  it("refuses a malformed body (400), a large one (413), another method (405); answers a preflight; a foreign origin gets 403", async () => {
    expect((await post(base, json({ sessionId: SESSION, email: "nope", lang: "en" }))).status).toBe(400);
    expect((await post(base, json({ sessionId: "bad id", email: EMAIL, lang: "en" }))).status).toBe(400);
    expect((await post(base, json({ sessionId: SESSION, email: EMAIL }))).status).toBe(400);
    expect((await post(base, "{not json")).status).toBe(400);
    expect((await post(base, json({ sessionId: SESSION, email: EMAIL, lang: "en", pad: "x".repeat(2000) }))).status).toBe(413);
    expect((await post(base, "", {}, "GET")).status).toBe(405);
    expect((await post(base, "", { origin: "https://study.example.org" }, "OPTIONS")).status).toBe(204);
    expect((await post(base, json({ sessionId: SESSION, email: EMAIL, lang: "en" }), { origin: "https://evil.example" })).status).toBe(403);
    const cors = await post(base, json({ sessionId: "s-results-0002", email: EMAIL, lang: "fi" }), { origin: "https://study.example.org" });
    expect(cors.status).toBe(200);
    expect(cors.headers["access-control-allow-origin"]).toBe("https://study.example.org");
  });

  it("rate-limits new contacts per client address (429 with retry-after)", async () => {
    const limited = new ResultsContactStore({ dir: join(root, "limited"), ratePerHour: 2, now: () => new Date("2026-11-01T10:00:00Z") });
    const body = { sessionId: SESSION, email: EMAIL, lang: "fi" };
    expect((await limited.submit(body, "10.0.0.1")).status).toBe(200);
    expect((await limited.submit(body, "10.0.0.1")).status).toBe(200);
    const third = await limited.submit(body, "10.0.0.1");
    expect(third).toMatchObject({ status: 429, headers: { "retry-after": "3600" } });
    expect((await limited.submit(body, "10.0.0.2")).status).toBe(200); // another address
    expect((await limited.submit({ ...body, email: "x" }, "10.0.0.3")).status).toBe(400); // a refused body costs nothing
  });

  it("answers 404 on a server without a contact store", async () => {
    expect((await post(bareBase, json({ sessionId: SESSION, email: EMAIL, lang: "en" }))).status).toBe(404);
    expect((await post(bareBase, "", {}, "OPTIONS")).status).toBe(404);
  });
});

describe("the browser's sender", () => {
  const nodeFetch: FetchLike = (url, init) => fetch(`${base}${url}`, init as RequestInit);
  it("stored by the server; unavailable without a route or a network; invalid input sends nothing", async () => {
    expect(await sendResultsContact({ sessionId: "s-results-0003", email: EMAIL, lang: "en" }, nodeFetch)).toBe("stored");
    expect(await sendResultsContact({ sessionId: SESSION, email: EMAIL, lang: "en" }, (url, init) => fetch(`${bareBase}${url}`, init as RequestInit))).toBe("unavailable");
    expect(await sendResultsContact({ sessionId: SESSION, email: EMAIL, lang: "en" }, () => Promise.reject(new TypeError("offline")))).toBe("unavailable");
    const spy = vi.fn<FetchLike>();
    expect(await sendResultsContact({ sessionId: SESSION, email: "nope", lang: "en" }, spy)).toBe("invalid");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("configuration (RESULTS_CONTACT_DIR)", () => {
  it("defaults to logs/results-contacts, apart from the session logs; `off` turns the route off; inside the session logs is refused", () => {
    const c = loadConfig({});
    expect(c.resultsContactDir!.endsWith(join("logs", "results-contacts"))).toBe(true);
    expect(c.resultsContactDir!.startsWith(c.sessionLogDir)).toBe(false);
    expect(loadConfig({ RESULTS_CONTACT_DIR: "off" }).resultsContactDir).toBeNull();
    expect(loadConfig({ RESULTS_CONTACT_DIR: "/private/contacts", SESSION_LOG_DIR: "/data/sessions" }).resultsContactDir).toBe("/private/contacts");
    expect(() => loadConfig({ RESULTS_CONTACT_DIR: "/data/sessions/contacts", SESSION_LOG_DIR: "/data/sessions" })).toThrow(ConfigError);
    expect(() => loadConfig({ RESULTS_CONTACT_DIR: "/data/sessions", SESSION_LOG_DIR: "/data/sessions" })).toThrow(ConfigError);
    expect(() => loadConfig({ RESULTS_CONTACT_DIR: "/data", SESSION_LOG_DIR: "/data/sessions" })).toThrow(ConfigError);
  });
});
