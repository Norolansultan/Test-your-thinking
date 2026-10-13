/**
 * SPEC/28 §6: `npm run tak:export` — two runs are byte-identical (I1), the view files hold the whole
 * session, the timed stream is ordered, and the data package is a structurally valid STORE zip whose
 * manifest lists its contents. The zip is read back here by an independent parser (and Node's own CRC-32).
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 as zlibCrc32 } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { parseCot, parseCotEvents, serializeCot, serializeCotEvents } from "../../app/tak/cot.js";
import { virtualOfIso } from "../../app/tak/time.js";
import { crc32, dosDateTime, FIXED_DOS_TIME, MANIFEST_ENTRY, missionPackageManifest, nameBasedUuid, writeStoredZip } from "../../tools/tak/datapackage.js";
import { DATA_PACKAGE_FILE, exportTak, STREAM_FILE, type TakExport } from "../../tools/tak/export.js";

interface ParsedEntry {
  readonly name: string;
  readonly data: Buffer;
  readonly crc: number;
  readonly time: number;
  readonly date: number;
}

/** An independent reader: the end record, the central directory, each local header, and a CRC check per entry. */
function readZip(zip: Buffer): ParsedEntry[] {
  const endAt = zip.length - 22;
  expect(zip.readUInt32LE(endAt)).toBe(0x06054b50);
  expect(zip.readUInt16LE(endAt + 20)).toBe(0); // no comment, so the end record is the last 22 bytes
  const count = zip.readUInt16LE(endAt + 10);
  expect(zip.readUInt16LE(endAt + 8)).toBe(count);
  const cdSize = zip.readUInt32LE(endAt + 12);
  const cdOffset = zip.readUInt32LE(endAt + 16);
  expect(cdOffset + cdSize).toBe(endAt);
  const out: ParsedEntry[] = [];
  let p = cdOffset;
  let expectedLocal = 0;
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const method = zip.readUInt16LE(p + 10);
    const time = zip.readUInt16LE(p + 12);
    const date = zip.readUInt16LE(p + 14);
    const crc = zip.readUInt32LE(p + 16);
    const csize = zip.readUInt32LE(p + 20);
    const usize = zip.readUInt32LE(p + 24);
    const nlen = zip.readUInt16LE(p + 28);
    const xlen = zip.readUInt16LE(p + 30);
    const clen = zip.readUInt16LE(p + 32);
    const localAt = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nlen).toString("utf8");
    expect(method).toBe(0);
    expect(csize).toBe(usize);
    expect(localAt).toBe(expectedLocal); // local records are contiguous, in directory order
    // The local header agrees with the central one.
    expect(zip.readUInt32LE(localAt)).toBe(0x04034b50);
    expect(zip.readUInt16LE(localAt + 8)).toBe(0);
    expect(zip.readUInt16LE(localAt + 10)).toBe(time);
    expect(zip.readUInt16LE(localAt + 12)).toBe(date);
    expect(zip.readUInt32LE(localAt + 14)).toBe(crc);
    expect(zip.readUInt32LE(localAt + 18)).toBe(csize);
    expect(zip.readUInt32LE(localAt + 22)).toBe(usize);
    const lnlen = zip.readUInt16LE(localAt + 26);
    const lxlen = zip.readUInt16LE(localAt + 28);
    expect(zip.subarray(localAt + 30, localAt + 30 + lnlen).toString("utf8")).toBe(name);
    const dataAt = localAt + 30 + lnlen + lxlen;
    const data = zip.subarray(dataAt, dataAt + csize);
    expect(zlibCrc32(data)).toBe(crc);
    expectedLocal = dataAt + csize;
    out.push({ name, data, crc, time, date });
    p += 46 + nlen + xlen + clen;
  }
  expect(expectedLocal).toBe(cdOffset);
  expect(p).toBe(endAt);
  return out;
}

const dirs: string[] = [];
let first: TakExport;
let second: TakExport;

beforeAll(() => {
  const scenario = buildDemoScenario();
  for (let i = 0; i < 2; i++) dirs.push(mkdtempSync(join(tmpdir(), "tak-export-")));
  first = exportTak(dirs[0]!, scenario);
  second = exportTak(dirs[1]!, buildDemoScenario());
});

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const VIEW_FILES = Array.from({ length: 15 }, (_, i) => `V${String(i).padStart(2, "0")}.cot.xml`);

describe("tak:export (SPEC/28 §6)", () => {
  it("writes the fifteen view files, the timed stream and the data package", () => {
    expect(first.files).toEqual([...VIEW_FILES, STREAM_FILE, DATA_PACKAGE_FILE]);
    expect(readdirSync(dirs[0]!).sort()).toEqual([...first.files].sort());
    expect(first.events).toBeGreaterThan(500);
  });

  it("two exports into two directories are byte-identical, file by file", () => {
    expect(second.files).toEqual(first.files);
    for (const f of first.files) {
      const a = readFileSync(join(dirs[0]!, f));
      const b = readFileSync(join(dirs[1]!, f));
      expect(a.equals(b), f).toBe(true);
    }
    expect(second.packageUid).toBe(first.packageUid);
  });

  it("each view file is a sorted <events> document that round-trips; together they hold every event once", () => {
    let total = 0;
    for (const f of VIEW_FILES) {
      const text = readFileSync(join(dirs[0]!, f), "utf8");
      const events = parseCotEvents(text);
      expect(events.length, f).toBeGreaterThan(10);
      expect(events.every((e) => `${e.detail.taksim.view}.cot.xml` === f)).toBe(true);
      expect(serializeCotEvents(events)).toBe(text);
      total += events.length;
    }
    expect(total).toBe(first.events);
  });

  it("the timed stream has one event per line, in (time, uid) order, with the virtual time of each", () => {
    const lines = readFileSync(join(dirs[0]!, STREAM_FILE), "utf8").split("\n");
    expect(lines.pop()).toBe("");
    expect(lines).toHaveLength(first.events);
    let previous = -Infinity;
    for (const line of lines) {
      const row = JSON.parse(line) as { t: number; view: string; uid: string; xml: string };
      expect(Object.keys(row)).toEqual(["t", "view", "uid", "xml"]);
      const e = parseCot(row.xml);
      expect(serializeCot(e)).toBe(row.xml);
      expect(row.t).toBe(virtualOfIso(e.time));
      expect(row.uid).toBe(e.uid);
      expect(row.view).toBe(e.detail.taksim.view);
      expect(row.t).toBeGreaterThanOrEqual(previous);
      previous = row.t;
    }
    expect(JSON.parse(lines[0]!).t).toBe(-4800); // the practice view, 12:00
  });

  it("the data package is a valid STORE zip: manifest first, then the view files, fixed timestamp, CRCs match", () => {
    const zip = readFileSync(join(dirs[0]!, DATA_PACKAGE_FILE));
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual([MANIFEST_ENTRY, ...VIEW_FILES]);
    for (const e of entries) {
      expect(e.time).toBe(FIXED_DOS_TIME.time);
      expect(e.date).toBe(FIXED_DOS_TIME.date);
    }
    for (const f of VIEW_FILES) expect(entries.find((e) => e.name === f)!.data.equals(readFileSync(join(dirs[0]!, f)))).toBe(true);
    const manifest = entries[0]!.data.toString("utf8");
    expect(manifest).toBe(missionPackageManifest({ uid: first.packageUid, name: "tak-sim demo-scenario 0.1.0-demo", entries: VIEW_FILES }));
    expect(manifest).toMatch(/^<MissionPackageManifest version="2">\n  <Configuration>\n    <Parameter name="uid" value="[0-9a-f-]{36}"\/>\n    <Parameter name="name" value="tak-sim demo-scenario 0\.1\.0-demo"\/>/);
    for (const f of VIEW_FILES) expect(manifest).toContain(`<Content ignore="false" zipEntry="${f}"/>`);
    expect(first.packageUid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("the zip writer and its parts", () => {
  it("CRC-32 matches Node's on known and random-looking data", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    const bytes = Uint8Array.from({ length: 4096 }, (_, i) => (i * 2654435761) >>> 24);
    expect(crc32(bytes)).toBe(zlibCrc32(bytes));
  });

  it("the fixed DOS timestamp is 26 July 2030 13:20:00", () => {
    expect(FIXED_DOS_TIME).toEqual({ date: (50 << 9) | (7 << 5) | 26, time: (13 << 11) | (20 << 5) });
    expect(() => dosDateTime(1979, 1, 1, 0, 0, 0)).toThrow(RangeError);
  });

  it("writes an empty and a small archive deterministically, and refuses duplicate or unsafe names", () => {
    expect(readZip(Buffer.from(writeStoredZip([])))).toEqual([]);
    const entries = [{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "dir/b.bin", data: Uint8Array.from([0, 255, 1]) }];
    const a = Buffer.from(writeStoredZip(entries));
    expect(a.equals(Buffer.from(writeStoredZip(entries)))).toBe(true);
    expect(readZip(a).map((e) => [e.name, [...e.data]])).toEqual([["a.txt", [104, 101, 108, 108, 111]], ["dir/b.bin", [0, 255, 1]]]);
    expect(() => writeStoredZip([entries[0]!, entries[0]!])).toThrow(RangeError);
    for (const name of ["/abs", "a\\b", "", "ä.txt"]) expect(() => writeStoredZip([{ name, data: new Uint8Array(1) }])).toThrow(RangeError);
  });

  it("name-based UUIDs are RFC 4122 version 5 (the RFC's own example) and stable", () => {
    expect(nameBasedUuid("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(nameBasedUuid("x")).toBe(nameBasedUuid("x"));
    expect(nameBasedUuid("x")).not.toBe(nameBasedUuid("y"));
  });
});
