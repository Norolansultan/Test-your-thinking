/**
 * The researcher's data download (`server/production/admin.ts`, `admin-data.ts`; docs/DEPLOYMENT.md
 * §6): off (404) without ADMIN_TOKEN, a token on every route compared in constant time, no path
 * outside the log directories, the listing (complete vs partial), single downloads, the tar archive
 * with the Thinker logs, an escaped page, and the local export CLI.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { request, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppServer } from "../../server/production/server.js";
import { ConfigError, loadConfig } from "../../server/production/config.js";
import { escapeHtml, tokenMatches } from "../../server/production/admin.js";
import { tarHeader, THINKER_LOG_DIR, type SessionRow } from "../../server/production/admin-data.js";
import { SessionLogStore } from "../../server/session-log/store.js";
import { LOG_DIR } from "../../server/thinker/deps.js";
import { exportToDirectory, exportToTar } from "../../tools/deploy/export-sessions.js";
import { linesText, sessionFileLines } from "../../app/telemetry/session-file.js";
import { uploadSession } from "../../app/telemetry/session-upload.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";

const TOKEN = "t0ken-for-the-tests-0123456789abcdef";
const COMPLETE_ID = "c0c0c0c0c0c0c0c0";
const PARTIAL_ID = "p1p1p1p1p1p1p1p1";
const THINKER_ONLY_ID = "a2a2a2a2a2a2a2a2";
const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

let root: string;
let dirs: { sessionLogDir: string; thinkerLogDir: string };
let on: Server;
let off: Server;
let base: string;
let offBase: string;

const header = (sessionId: string, participantCode: string): LogHeader => ({
  formatVersion: "0.9.4", sessionId, participantCode, condition: "directed", scenarioId: "s", scenarioVersion: "1", seed: "1",
  bundleHash: "sha256:x", appVersion: "0.1.0", startedAtIso: "2026-10-09T10:00:00.000Z", userAgent: "ua", viewport: { w: 1, h: 1, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
});
const records = (n: number): LogRecord[] => Array.from({ length: n }, (_, i) => ({ seq: asSeq(i), tVirtual: asVirtualTime(i), tWallOffsetMs: i, kind: i === 0 ? "session_started" : "bubble_available", detail: { i } }));

async function listen(server: Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "admin-"));
  dirs = { sessionLogDir: join(root, "sessions"), thinkerLogDir: join(root, "thinker") };
  await mkdir(dirs.thinkerLogDir, { recursive: true });
  await writeFile(join(root, "secret.txt"), "do not serve");
  const app = join(root, "ui");
  await mkdir(app, { recursive: true });
  await writeFile(join(app, "index.html"), "<!doctype html><title>app</title>");
  const store = new SessionLogStore({ dir: dirs.sessionLogDir, nowIso: () => "2026-10-09T12:00:00.000Z" });
  on = createAppServer({ staticDir: app, sessionLog: store, admin: { token: TOKEN, dirs, now: () => new Date("2026-10-09T12:34:00Z") } });
  off = createAppServer({ staticDir: app, sessionLog: store });
  base = await listen(on);
  offBase = await listen(off);
  // A finished session (uploaded over HTTP), an abandoned one (two checkpoints; its participant code is hostile HTML), a Thinker-only one.
  await uploadSession({ engineState: "COMPLETE", header: header(COMPLETE_ID, "EDQWGU"), records: records(5) }, { http: { baseUrl: base } });
  const partial = sessionFileLines(header(PARTIAL_ID, "<script>alert(1)</script>"), records(3));
  for (const [from, to, label] of [[0, 2, "training"], [2, 4, "freeze_v2"]] as const) {
    const b = Buffer.from(linesText(partial.slice(from, to)));
    expect((await store.putPartial(PARTIAL_ID, from, label, b, sha(b))).status).toBe(200);
  }
  await writeFile(join(dirs.thinkerLogDir, `${COMPLETE_ID}.jsonl`), '{"q":"where is the fire"}\n');
  await writeFile(join(dirs.thinkerLogDir, `${THINKER_ONLY_ID}.jsonl`), '{"q":"hello"}\n');
  await writeFile(join(dirs.thinkerLogDir, "not a session.jsonl"), "ignored\n");
});
afterAll(async () => {
  await Promise.all([on, off].map((s) => new Promise<void>((r) => s.close(() => r()))));
  await rm(root, { recursive: true, force: true });
});

/** A raw request: no URL normalisation, any header, the body as bytes. */
function raw(at: string, path: string, headers: Record<string, string> = {}, method = "GET"): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request(`${at}${path}`, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}
const auth = { authorization: `Bearer ${TOKEN}` };

/** Reads a ustar archive: names and contents, checking each header's checksum. */
function untar(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let at = 0;
  while (at + 512 <= buf.length) {
    const h = buf.subarray(at, at + 512);
    if (h.every((b) => b === 0)) break;
    const name = h.subarray(0, 100).toString("ascii").replace(/\0.*$/s, "");
    const size = parseInt(h.subarray(124, 136).toString("ascii").replace(/\0.*$/s, ""), 8);
    const declared = parseInt(h.subarray(148, 156).toString("ascii").replace(/[\0 ].*$/s, ""), 8);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i]!;
    expect(sum).toBe(declared);
    expect(h.subarray(257, 263).toString("ascii")).toBe("ustar\0");
    files.set(name, buf.subarray(at + 512, at + 512 + size).toString("utf8"));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  expect(buf.length % 512).toBe(0);
  return files;
}

describe("disabled without ADMIN_TOKEN", () => {
  it("answers 404 on every admin route, with or without a token, and /admin is not the app's page", async () => {
    for (const p of ["/admin", `/admin?token=${TOKEN}`, "/api/admin/sessions", "/api/admin/export.tar", `/api/admin/sessions/${COMPLETE_ID}/log`]) {
      const res = await raw(offBase, p, auth);
      expect(res.status, p).toBe(404);
      expect(res.body.toString()).not.toContain("<title>app</title>");
    }
  });

  it("config: unset is off; a short or spaced token is refused rather than guessable", () => {
    expect(loadConfig({}).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: "  " }).adminToken).toBeNull();
    expect(loadConfig({ ADMIN_TOKEN: TOKEN }).adminToken).toBe(TOKEN);
    expect(() => loadConfig({ ADMIN_TOKEN: "short" })).toThrow(ConfigError);
    expect(() => loadConfig({ ADMIN_TOKEN: "has a space in it 0123456789" })).toThrow(ConfigError);
  });
});

describe("the token", () => {
  it("is required on every route: none or a wrong one is 401 and lists nothing", async () => {
    for (const p of ["/api/admin/sessions", "/api/admin/export.tar", `/api/admin/sessions/${COMPLETE_ID}/log`, "/api/admin/nonexistent"]) {
      for (const headers of [{}, { authorization: "Bearer wrong" }, { authorization: `Bearer ${TOKEN}x` }, { authorization: `Basic ${TOKEN}` }]) {
        const res = await raw(base, p, headers);
        expect(res.status, `${p} ${JSON.stringify(headers)}`).toBe(401);
        expect(res.body.toString()).not.toContain(COMPLETE_ID);
      }
    }
    expect((await raw(base, `/api/admin/sessions?token=${TOKEN.slice(0, -1)}`)).status).toBe(401);
    expect((await raw(base, "/admin")).status).toBe(401);
  });

  it("is accepted as a Bearer header or a ?token= query; other methods are 405", async () => {
    expect((await raw(base, "/api/admin/sessions", auth)).status).toBe(200);
    expect((await raw(base, `/api/admin/sessions?token=${TOKEN}`)).status).toBe(200);
    expect((await raw(base, "/api/admin/sessions", auth, "POST")).status).toBe(405);
  });

  it("is compared over equal-length digests (no length or prefix shortcut)", () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    for (const wrong of ["", TOKEN.slice(0, 5), `${TOKEN}0`, TOKEN.toUpperCase(), null, undefined]) expect(tokenMatches(wrong, TOKEN)).toBe(false);
    expect(tokenMatches("", "")).toBe(false);
  });
});

describe("paths", () => {
  it("never leave the log directories: traversal and malformed ids are refused", async () => {
    for (const p of [
      "/api/admin/sessions/..%2F..%2Fsecret/log", "/api/admin/sessions/%2e%2e%2f%2e%2e%2fsecret/log", "/api/admin/sessions/../../secret.txt/log",
      "/api/admin/sessions/..\\..\\secret/log", `/api/admin/sessions/${COMPLETE_ID}.partial/log`, "/api/admin/sessions/short/log",
      `/api/admin/sessions/${COMPLETE_ID}/../../../secret.txt`, `/api/admin/sessions/${COMPLETE_ID}/log/extra`,
    ]) {
      const res = await raw(base, p, auth);
      expect([400, 404], p).toContain(res.status);
      expect(res.body.toString()).not.toContain("do not serve");
    }
  });
});

describe("the listing", () => {
  it("shows complete vs partial, the participant code, records, the last checkpoint and the Thinker logs", async () => {
    const res = await raw(base, "/api/admin/sessions", auth);
    expect(res.headers["cache-control"]).toBe("no-store");
    const rows = (JSON.parse(res.body.toString()) as { sessions: SessionRow[] }).sessions;
    const byId = new Map(rows.map((r) => [r.sessionId, r]));
    expect([...byId.keys()].sort()).toEqual([THINKER_ONLY_ID, COMPLETE_ID, PARTIAL_ID].sort()); // "not a session" is ignored
    expect(byId.get(COMPLETE_ID)).toMatchObject({ participantCode: "EDQWGU", cell: "reasoning_intent", status: "complete", uploadComplete: true, records: 5, lastCheckpoint: null });
    expect(byId.get(COMPLETE_ID)!.thinkerLogBytes).toBeGreaterThan(0);
    expect(byId.get(PARTIAL_ID)).toMatchObject({ status: "partial", uploadComplete: false, records: 3, lastCheckpoint: "freeze_v2", thinkerLogBytes: null });
    expect(byId.get(THINKER_ONLY_ID)).toMatchObject({ status: "thinker_only", participantCode: null, records: null });
    for (const r of rows) expect(r.lastWriteIso).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("the page lists them, escapes what browsers wrote, runs no script and links the downloads", async () => {
    const res = await raw(base, `/admin?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    const html = res.body.toString();
    expect(html).not.toContain("<script>");
    expect(html).toContain(escapeHtml("<script>alert(1)</script>"));
    expect(html).toContain(`/api/admin/sessions/${PARTIAL_ID}/log?token=${TOKEN}`);
    expect(html).toContain(`/api/admin/export.tar?token=${TOKEN}`);
  });
});

describe("downloads", () => {
  it("one session: the finished file, else the checkpoint (named and flagged partial); its Thinker log", async () => {
    const complete = await raw(base, `/api/admin/sessions/${COMPLETE_ID}/log`, auth);
    expect(complete.status).toBe(200);
    expect(complete.headers["x-session-file"]).toBe("complete");
    expect(complete.headers["content-disposition"]).toBe(`attachment; filename="session-${COMPLETE_ID}.jsonl"`);
    expect(complete.body.toString()).toBe(await readFile(join(dirs.sessionLogDir, `${COMPLETE_ID}.jsonl`), "utf8"));
    expect(complete.body.toString().trimEnd().split("\n").pop()).toContain('"manifest"');
    const partial = await raw(base, `/api/admin/sessions/${PARTIAL_ID}/log`, auth);
    expect(partial.headers["x-session-file"]).toBe("partial");
    expect(partial.headers["content-disposition"]).toContain(`session-${PARTIAL_ID}.partial.jsonl`);
    expect(partial.body.toString()).toBe(linesText(sessionFileLines(header(PARTIAL_ID, "<script>alert(1)</script>"), records(3))));
    const thinker = await raw(base, `/api/admin/sessions/${COMPLETE_ID}/thinker`, auth);
    expect(thinker.body.toString()).toBe('{"q":"where is the fire"}\n');
    expect((await raw(base, `/api/admin/sessions/${PARTIAL_ID}/thinker`, auth)).status).toBe(404);
    expect((await raw(base, `/api/admin/sessions/${THINKER_ONLY_ID}/log`, auth)).status).toBe(404);
  });

  it("everything as one tar: index.json, every session file and checkpoint, the Thinker logs", async () => {
    const res = await raw(base, "/api/admin/export.tar", auth);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/x-tar");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="fire-sim-sessions-20261009-1234.tar"');
    const files = untar(res.body);
    expect([...files.keys()].sort()).toEqual([
      "index.json",
      `sessions/${COMPLETE_ID}.jsonl`, `sessions/${PARTIAL_ID}.partial.json`, `sessions/${PARTIAL_ID}.partial.jsonl`,
      `thinker/${THINKER_ONLY_ID}.jsonl`, `thinker/${COMPLETE_ID}.jsonl`,
    ].sort());
    expect(files.get(`sessions/${COMPLETE_ID}.jsonl`)).toBe(await readFile(join(dirs.sessionLogDir, `${COMPLETE_ID}.jsonl`), "utf8"));
    expect((JSON.parse(files.get("index.json")!) as SessionRow[]).map((r) => r.status).sort()).toEqual(["complete", "partial", "thinker_only"]);
    const one = untar((await raw(base, `/api/admin/sessions/${PARTIAL_ID}/archive.tar`, auth)).body);
    expect([...one.keys()].sort()).toEqual([`sessions/${PARTIAL_ID}.partial.json`, `sessions/${PARTIAL_ID}.partial.jsonl`]);
  });

  it("the tar header is plain ustar and refuses names it cannot hold", () => {
    const h = tarHeader("sessions/x.jsonl", 10, 0);
    expect(h.length).toBe(512);
    expect(() => tarHeader("x".repeat(101), 1, 0)).toThrow();
    expect(() => tarHeader("sessions/ä.jsonl", 1, 0)).toThrow();
  });
});

describe("the local export (npm run sessions:export)", () => {
  it("copies the same files into a directory, or writes the same archive", async () => {
    const out = join(root, "export");
    expect(await exportToDirectory(dirs, out)).toBe(6);
    expect(await readFile(join(out, "sessions", `${PARTIAL_ID}.partial.jsonl`), "utf8")).toBe(await readFile(join(dirs.sessionLogDir, `${PARTIAL_ID}.partial.jsonl`), "utf8"));
    expect(await readFile(join(out, "thinker", `${COMPLETE_ID}.jsonl`), "utf8")).toBe('{"q":"where is the fire"}\n');
    const tar = join(root, "out", "all.tar");
    await exportToTar(dirs, tar);
    expect([...untar(await readFile(tar)).keys()]).toContain(`sessions/${COMPLETE_ID}.jsonl`);
  });

  it("reads the Thinker logs where the proxy writes them", () => {
    expect(THINKER_LOG_DIR).toBe(LOG_DIR);
  });
});
