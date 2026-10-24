/**
 * The shared study link's code issue (revision (af), 9 Oct 2026; `server/production/auto-assign.ts`):
 * the next unused code in table order within the language stratum, an optional pilot cell filter,
 * persisted atomically so a restart never reissues a code, the same code for a repeated session id,
 * a cap and a per-address rate limit; the route exists only when the config turns it on. Revision (bf), 24 Oct 2026: the table is
 * stratified (language × profession × leads), so a request names the link's stratum and the code comes from that stratum's sequence.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { request } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOCATION_TABLE } from "../../app/session/preview.js";
import { AutoAssigner, AutoAssignError, clientAddress, ISSUED_CODES_FILE, type AutoAssignOptions, type IssuedCodesFile } from "../../server/production/auto-assign.js";
import { createAppServer } from "../../server/production/server.js";
import { ConfigError, loadConfig } from "../../server/production/config.js";
import { handleAdminRequest, issuedWithStatus } from "../../server/production/admin.js";
import { STRATA, stratumId } from "../../app/telemetry/record-kinds-pilot2.js";

const table = ALLOCATION_TABLE;
/** The stratum the requests below name (the table's first). */
const S = "fire_rescue.lead";
const en = table.rows.filter((r) => r.language === "en" && stratumId(r) === S);
const sid = (n: number) => `session${String(n).padStart(4, "0")}abcdef`;

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "auto-assign-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const open = (o: Partial<AutoAssignOptions> = {}) => AutoAssigner.open({ table, dir, cells: null, maxIssued: null, ratePerHour: 1000, ...o });
const codeOf = (r: { body: unknown }) => (r.body as { code: string }).code;

describe("the code issue", () => {
  it("issues the allocation sequence in order within the chosen language and the link's stratum", async () => {
    const a = await open();
    const got = [];
    for (let i = 0; i < 5; i++) got.push(codeOf(await a.assign({ sessionId: sid(i), language: "en", stratum: S }, "1.1.1.1")));
    expect(got).toEqual(en.slice(0, 5).map((r) => r.code));
    const fi = await a.assign({ sessionId: sid(9), language: "fi", stratum: S }, "1.1.1.1");
    expect(codeOf(fi)).toBe(table.rows.find((r) => r.language === "fi" && stratumId(r) === S)!.code);
    // Another stratum has its own sequence, untouched by the codes issued above.
    const mil = await a.assign({ sessionId: sid(10), language: "en", stratum: "military.nolead" }, "1.1.1.1");
    expect(codeOf(mil)).toBe(table.rows.find((r) => r.language === "en" && stratumId(r) === "military.nolead")!.code);
    expect(a.overview().issued.map((i) => i.stratum)).toEqual([S, S, S, S, S, S, "military.nolead"]);
  });

  it("revision (bf): refuses a request without a stratum or with an unknown one (400); counts what is left per stratum", async () => {
    const a = await open();
    expect((await a.assign({ sessionId: sid(1), language: "en" }, "x")).status).toBe(400);
    const unknown = await a.assign({ sessionId: sid(1), language: "en", stratum: "police.lead" }, "x");
    expect(unknown.status).toBe(400);
    expect((unknown.body as { error: string }).error).toMatch(/stratum required/);
    expect(a.overview().issued).toHaveLength(0);
    await a.assign({ sessionId: sid(2), language: "en", stratum: S }, "x");
    const left = a.overview().remainingByStratum;
    expect(Object.keys(left)).toEqual((["en", "fi"] as const).flatMap((l) => STRATA.map((s) => `${l}.${stratumId(s)}`)));
    expect(left[`en.${S}`]).toBe(en.length - 1);
    expect(left["fi.other.nolead"]).toBe(4);
  });

  it("a pilot cell filter issues only that cell's codes, still in sequence order", async () => {
    const a = await open({ cells: ["reasoning_intent"] });
    const got = [];
    for (let i = 0; i < 6; i++) got.push(codeOf(await a.assign({ sessionId: sid(i), language: "en", stratum: S }, "1.1.1.1")));
    expect(got).toEqual(en.filter((r) => r.cell === "reasoning_intent").slice(0, 6).map((r) => r.code));
    // Plenty for a pilot: 2 per block of 4 in every stratum; 70 in the English strata (SPEC/30 §2 (bf)).
    expect(a.overview().remaining.en).toBe(70 - 6);
    expect(a.overview().cells).toEqual(["reasoning_intent"]);
  });

  it("persists every issue (code, cell, session id, time) and never reissues after a restart", async () => {
    const now = () => new Date("2026-10-09T10:00:00.000Z");
    const a = await open({ now });
    await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x");
    await a.assign({ sessionId: sid(2), language: "en", stratum: S }, "x");
    const file = JSON.parse(await readFile(join(dir, ISSUED_CODES_FILE), "utf8")) as IssuedCodesFile;
    expect(file.tableSha256).toBe(table.rowsSha256);
    expect(file.issued).toEqual([
      { code: en[0]!.code, language: "en", stratum: S, block: en[0]!.block, cell: en[0]!.cell, sessionId: sid(1), issuedAtIso: "2026-10-09T10:00:00.000Z" },
      { code: en[1]!.code, language: "en", stratum: S, block: en[1]!.block, cell: en[1]!.cell, sessionId: sid(2), issuedAtIso: "2026-10-09T10:00:00.000Z" },
    ]);
    const b = await open(); // a restart
    expect(codeOf(await b.assign({ sessionId: sid(3), language: "en", stratum: S }, "x"))).toBe(en[2]!.code);
    expect(codeOf(await b.assign({ sessionId: sid(1), language: "en", stratum: S }, "x"))).toBe(en[0]!.code);
  });

  it("answers a known session id with its own code (a retry is not a second draw)", async () => {
    const a = await open();
    const first = codeOf(await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x"));
    expect(codeOf(await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x"))).toBe(first);
    expect(a.overview().issued).toHaveLength(1);
  });

  it("skips codes already used by manual links (in uploaded session headers)", async () => {
    const a = await open({ usedCodes: async () => [en[0]!.code, en[1]!.code] });
    expect(codeOf(await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x"))).toBe(en[2]!.code);
  });

  it("two simultaneous starts get two different codes", async () => {
    const a = await open();
    const [x, y] = await Promise.all([a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x"), a.assign({ sessionId: sid(2), language: "en", stratum: S }, "x")]);
    expect(codeOf(x)).not.toBe(codeOf(y));
  });

  it("stops at the cap (410) and when the stratum runs out", async () => {
    const a = await open({ maxIssued: 2 });
    await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x");
    await a.assign({ sessionId: sid(2), language: "en", stratum: S }, "x");
    expect((await a.assign({ sessionId: sid(3), language: "en", stratum: S }, "x")).status).toBe(410);
    const b = await AutoAssigner.open({ table, dir: join(dir, "b"), cells: ["radio"], maxIssued: null, ratePerHour: 1000 });
    for (let i = 0; i < 8; i++) expect((await b.assign({ sessionId: sid(i), language: "fi", stratum: S }, "x")).status).toBe(200); // the stratum's 4 Finnish blocks × 2 Haku codes
    expect((await b.assign({ sessionId: sid(99), language: "fi", stratum: S }, "x")).status).toBe(410);
  });

  it("limits new codes per client address per hour (429), not repeats", async () => {
    let t = Date.parse("2026-10-09T10:00:00Z");
    const a = await open({ ratePerHour: 2, now: () => new Date(t) });
    expect((await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "1.1.1.1")).status).toBe(200);
    expect((await a.assign({ sessionId: sid(2), language: "en", stratum: S }, "1.1.1.1")).status).toBe(200);
    const limited = await a.assign({ sessionId: sid(3), language: "en", stratum: S }, "1.1.1.1");
    expect(limited.status).toBe(429);
    expect(limited.headers?.["retry-after"]).toBe("3600");
    expect((await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "1.1.1.1")).status).toBe(200); // a repeat
    expect((await a.assign({ sessionId: sid(4), language: "en", stratum: S }, "2.2.2.2")).status).toBe(200);
    t += 60 * 60 * 1000 + 1;
    expect((await a.assign({ sessionId: sid(3), language: "en", stratum: S }, "1.1.1.1")).status).toBe(200);
  });

  it("refuses a malformed request", async () => {
    const a = await open();
    expect((await a.assign({ sessionId: "../x", language: "en", stratum: S }, "x")).status).toBe(400);
    expect((await a.assign({ sessionId: sid(1), language: "de" }, "x")).status).toBe(400);
    expect((await a.assign(null, "x")).status).toBe(400);
    expect(a.overview().issued).toHaveLength(0);
  });

  it("refuses to start on a file written for another table", async () => {
    await writeFile(join(dir, ISSUED_CODES_FILE), JSON.stringify({ version: 1, tableSha256: "0".repeat(64), issued: [] }));
    await expect(open()).rejects.toBeInstanceOf(AutoAssignError);
  });

  it("takes the client address from the tunnel's or platform's header", () => {
    expect(clientAddress({ "cf-connecting-ip": "9.9.9.9" }, "127.0.0.1")).toBe("9.9.9.9");
    expect(clientAddress({ "x-forwarded-for": "8.8.8.8, 10.0.0.1" }, "127.0.0.1")).toBe("8.8.8.8");
    expect(clientAddress({}, "127.0.0.1")).toBe("127.0.0.1");
  });
});

describe("the route and the config", () => {
  function post(base: string, path: string, body: string, method = "POST"): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = request(`${base}${path}`, { method, headers: { "content-type": "application/json" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode!, body: data }));
      });
      req.on("error", reject);
      req.end(body);
    });
  }
  async function withServer(options: Parameters<typeof createAppServer>[0], fn: (base: string) => Promise<void>) {
    const server = createAppServer(options);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { await new Promise<void>((r) => server.close(() => r())); }
  }

  it("answers 404 when automatic assignment is off", async () => {
    await withServer({}, async (base) => {
      expect((await post(base, "/api/assign", JSON.stringify({ sessionId: sid(1), language: "en", stratum: S }))).status).toBe(404);
      expect((await post(base, "/api/assign", "", "OPTIONS")).status).toBe(404);
    });
  });

  it("issues a code when on; GET is 405, bad JSON 400", async () => {
    const assign = await open();
    await withServer({ assign }, async (base) => {
      const ok = await post(base, "/api/assign", JSON.stringify({ sessionId: sid(1), language: "en", stratum: S }));
      expect(ok.status).toBe(200);
      expect(JSON.parse(ok.body)).toEqual({ code: en[0]!.code }); // the code only, never the cell
      expect((await post(base, "/api/assign", "", "GET")).status).toBe(405);
      expect((await post(base, "/api/assign", "{")).status).toBe(400);
    });
  });

  it("is off unless AUTO_ASSIGN=1; ASSIGN_CELLS, ASSIGN_MAX and the rate are validated", () => {
    expect(loadConfig({}).autoAssign).toBeNull();
    expect(loadConfig({ AUTO_ASSIGN: "0" }).autoAssign).toBeNull();
    expect(loadConfig({ AUTO_ASSIGN: "1" }).autoAssign).toEqual({ cells: null, maxIssued: null, ratePerHour: 20 });
    expect(loadConfig({ AUTO_ASSIGN: "1", ASSIGN_CELLS: "reasoning_intent", ASSIGN_MAX: "10", ASSIGN_RATE_PER_HOUR: "5" }).autoAssign)
      .toEqual({ cells: ["reasoning_intent"], maxIssued: 10, ratePerHour: 5 });
    expect(() => loadConfig({ AUTO_ASSIGN: "yes" })).toThrow(ConfigError);
    expect(() => loadConfig({ AUTO_ASSIGN: "1", ASSIGN_CELLS: "haku" })).toThrow(ConfigError);
    expect(() => loadConfig({ AUTO_ASSIGN: "1", ASSIGN_MAX: "0" })).toThrow(ConfigError);
  });
});

describe("the admin listing", () => {
  it("shows each issued code with its cell and its session's status, and the filter in force", async () => {
    const a = await open({ cells: ["reasoning_intent"] });
    await a.assign({ sessionId: sid(1), language: "en", stratum: S }, "x");
    await a.assign({ sessionId: sid(2), language: "en", stratum: S }, "x");
    const listed = issuedWithStatus(a.overview(), [
      { sessionId: sid(1), participantCode: null, cell: null, status: "complete", uploadComplete: true, records: 10, lastCheckpoint: null, lastWriteIso: null, thinkerLogBytes: null },
    ]);
    expect(listed.issued.map((i) => [i.cell, i.status])).toEqual([["reasoning_intent", "complete"], ["reasoning_intent", "not_started"]]);

    const sessionLogDir = join(dir, "sessions");
    const page = await handleAdminRequest({ token: "t".repeat(30), dirs: { sessionLogDir, thinkerLogDir: join(dir, "thinker") }, assignments: () => a.overview() }, "GET", `/admin?token=${"t".repeat(30)}`, undefined);
    expect(String(page.body)).toContain("Cell filter in force (pilot setting): reasoning_intent");
    expect(String(page.body)).toContain(a.overview().issued[0]!.code);
    const json = await handleAdminRequest({ token: "t".repeat(30), dirs: { sessionLogDir, thinkerLogDir: join(dir, "thinker") } }, "GET", "/api/admin/assignments", `Bearer ${"t".repeat(30)}`);
    expect(json.status).toBe(404); // off without the assigner
  });
});
