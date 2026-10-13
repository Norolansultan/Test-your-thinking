/**
 * SPEC/28 §6: `npm run tak:export` — two runs are byte-identical (I1), the view files hold the whole
 * session, the timed stream is ordered, and each view's data package is a structurally valid STORE zip
 * in the layout TAK clients import as map items: one event per `<uid>/<uid>.cot` entry, each listed in
 * the manifest with its `uid` parameter. The zips are read back here by an independent parser (and
 * Node's own CRC-32).
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 as zlibCrc32 } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { parseCot, parseCotEvents, serializeCot, serializeCotDocument, serializeCotEvents, XML_DECLARATION, type CotEvent } from "../../app/tak/cot.js";
import { virtualOfIso } from "../../app/tak/time.js";
import { buildCotDataPackage, cotEntryName, crc32, dosDateTime, FIXED_DOS_TIME, MANIFEST_ENTRY, missionPackageManifest, nameBasedUuid, writeStoredZip } from "../../tools/tak/datapackage.js";
import { exportTak, LEGACY_DATA_PACKAGE_FILE, PACKAGES_DIR, STREAM_FILE, viewPackageFile, viewPackageName, viewSnapshotEvents, type TakExport } from "../../tools/tak/export.js";

interface ParsedEntry {
  readonly name: string;
  readonly data: Buffer;
  readonly crc: number;
  readonly flags: number;
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
    const flags = zip.readUInt16LE(p + 8);
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
    expect(flags & ~0x0800).toBe(0); // only the UTF-8 name flag may be set ...
    expect(flags === 0x0800).toBe(/[^\x20-\x7e]/.test(name)); // ... and exactly when the name is not plain ASCII
    expect(localAt).toBe(expectedLocal); // local records are contiguous, in directory order
    // The local header agrees with the central one.
    expect(zip.readUInt32LE(localAt)).toBe(0x04034b50);
    expect(zip.readUInt16LE(localAt + 6)).toBe(flags);
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
    out.push({ name, data, crc, flags, time, date });
    p += 46 + nlen + xlen + clen;
  }
  expect(expectedLocal).toBe(cdOffset);
  expect(p).toBe(endAt);
  return out;
}

/** The manifest's Configuration parameters and its Contents (entry, uid parameter), read with plain patterns. */
function readManifest(xml: string): { readonly params: Readonly<Record<string, string>>; readonly contents: readonly { readonly zipEntry: string; readonly uid: string }[] } {
  const config = /<Configuration>([\s\S]*?)<\/Configuration>/.exec(xml)![1]!;
  const params: Record<string, string> = {};
  for (const m of config.matchAll(/<Parameter name="([^"]+)" value="([^"]*)"\/>/g)) params[m[1]!] = m[2]!;
  const contents = [...xml.matchAll(/<Content ignore="false" zipEntry="([^"]+)">\s*<Parameter name="uid" value="([^"]+)"\/>\s*<\/Content>/g)].map((m) => ({ zipEntry: m[1]!, uid: m[2]! }));
  expect((xml.match(/<Content /g) ?? []).length).toBe(contents.length); // every Content has the uid form
  return { params, contents };
}

const dirs: string[] = [];
let first: TakExport;
let second: TakExport;

beforeAll(() => {
  const scenario = buildDemoScenario();
  for (let i = 0; i < 2; i++) dirs.push(mkdtempSync(join(tmpdir(), "tak-export-")));
  writeFileSync(join(dirs[1]!, LEGACY_DATA_PACKAGE_FILE), "stale"); // an earlier export's single package
  first = exportTak(dirs[0]!, scenario);
  second = exportTak(dirs[1]!, buildDemoScenario());
});

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const VIEWS = Array.from({ length: 15 }, (_, i) => `V${String(i).padStart(2, "0")}`);
const VIEW_FILES = VIEWS.map((v) => `${v}.cot.xml`);
const PACKAGE_FILES = VIEWS.map((v) => `${PACKAGES_DIR}/tak-sim-${v}.zip`);

describe("tak:export (SPEC/28 §6)", () => {
  it("writes the fifteen view files, the timed stream and fifteen view packages (and no single legacy package)", () => {
    expect(first.files).toEqual([...VIEW_FILES, STREAM_FILE, ...PACKAGE_FILES]);
    expect(VIEWS.map(viewPackageFile)).toEqual(PACKAGE_FILES);
    expect(readdirSync(dirs[0]!).sort()).toEqual([...VIEW_FILES, STREAM_FILE, PACKAGES_DIR].sort());
    expect(readdirSync(join(dirs[0]!, PACKAGES_DIR)).sort()).toEqual(VIEWS.map((v) => `tak-sim-${v}.zip`));
    expect(existsSync(join(dirs[1]!, LEGACY_DATA_PACKAGE_FILE))).toBe(false);
    expect(first.events).toBeGreaterThan(500);
  });

  it("two exports into two directories are byte-identical, file by file", () => {
    expect(second.files).toEqual(first.files);
    for (const f of first.files) {
      const a = readFileSync(join(dirs[0]!, f));
      const b = readFileSync(join(dirs[1]!, f));
      expect(a.equals(b), f).toBe(true);
    }
    expect(second.packages).toEqual(first.packages);
    expect(new Set(first.packages.map((p) => p.uid)).size).toBe(15);
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
});

describe("the view data packages (TAK import layout)", () => {
  it.each(VIEWS)("%s: a valid STORE zip, manifest first, then one <uid>/<uid>.cot event per entry, sorted", (view) => {
    const zip = readFileSync(join(dirs[0]!, viewPackageFile(view)));
    const entries = readZip(zip);
    expect(entries[0]!.name).toBe(MANIFEST_ENTRY);
    const cot = entries.slice(1);
    const names = cot.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(new Set(names).size).toBe(names.length);
    for (const e of entries) {
      expect(e.time).toBe(FIXED_DOS_TIME.time);
      expect(e.date).toBe(FIXED_DOS_TIME.date);
    }

    // Each entry is a stand-alone single-event document whose uid names the entry.
    const events: CotEvent[] = [];
    for (const e of cot) {
      const text = e.data.toString("utf8");
      expect(text.startsWith(`${XML_DECLARATION}\n<event `)).toBe(true);
      expect(text.match(/<event /g)).toHaveLength(1);
      const event = parseCot(text);
      expect(e.name).toBe(`${event.uid}/${event.uid}.cot`);
      expect(serializeCotDocument(event)).toBe(text);
      expect(event.detail.taksim.view).toBe(view);
      events.push(event);
    }

    // The manifest: the package's uid (UUID v5), name and onReceiveDelete; one Content per entry, in entry order, its uid parameter = the event's uid.
    const manifestText = entries[0]!.data.toString("utf8");
    const manifest = readManifest(manifestText);
    const pkg = first.packages.find((p) => p.view === view)!;
    expect(manifest.params).toEqual({ uid: pkg.uid, name: `TAK-SIM ${view}`, onReceiveDelete: "false" });
    expect(viewPackageName(view)).toBe(`TAK-SIM ${view}`);
    expect(pkg.uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(manifest.contents.map((c) => c.zipEntry)).toEqual(names);
    manifest.contents.forEach((c, i) => expect(c.uid).toBe(events[i]!.uid));
    expect(manifestText).toBe(missionPackageManifest({ uid: pkg.uid, name: `TAK-SIM ${view}`, onReceiveDelete: false, contents: manifest.contents }));
    expect(pkg.events).toBe(events.length);
  });

  it.each(VIEWS)("%s: holds the picture at the view's last step and every GeoChat message of the view", (view) => {
    const all = parseCotEvents(readFileSync(join(dirs[0]!, `${view}.cot.xml`), "utf8"));
    const lastStep = Math.max(...all.filter((e) => e.detail.taksim.kind !== "chat").map((e) => e.detail.taksim.step));
    const expected = all.filter((e) => e.detail.taksim.kind === "chat" || e.detail.taksim.step === lastStep);
    const packed = readZip(readFileSync(join(dirs[0]!, viewPackageFile(view)))).slice(1).map((e) => parseCot(e.data.toString("utf8")));
    const byUid = (a: CotEvent, b: CotEvent) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
    expect([...packed].sort(byUid)).toEqual([...expected].sort(byUid));
    expect([...viewSnapshotEvents(all, view)].sort(byUid)).toEqual([...expected].sort(byUid));
    const kinds = new Set(packed.map((e) => e.detail.taksim.kind));
    for (const k of ["self", "unit", "aircraft", "perimeter", "projection", "chat"]) expect(kinds.has(k as CotEvent["detail"]["taksim"]["kind"]), `${view} ${k}`).toBe(true);
    expect(packed.filter((e) => e.detail.taksim.kind === "chat")).toHaveLength(all.filter((e) => e.detail.taksim.kind === "chat").length);
    if (all.some((e) => e.detail.taksim.step === 2 && e.detail.taksim.kind !== "chat")) {
      expect(lastStep).toBe(2); // a merged view: the second step's map, not the first's
      expect(packed.some((e) => e.detail.taksim.kind !== "chat" && e.detail.taksim.step === 1)).toBe(false);
    }
  });

  it("a non-ASCII uid (a GeoChat sender such as HÄTÄKESKUS) gets a UTF-8 entry name", () => {
    const withUmlaut = first.packages.flatMap((p) => readZip(readFileSync(join(dirs[0]!, p.file))).filter((e) => /[^\x20-\x7e]/.test(e.name)));
    expect(withUmlaut.length).toBeGreaterThan(0);
    expect(withUmlaut.every((e) => e.flags === 0x0800 && e.name.includes("Ä"))).toBe(true);
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
    const entries = [{ name: "a.txt", data: new TextEncoder().encode("hello") }, { name: "dir/b.bin", data: Uint8Array.from([0, 255, 1]) }, { name: "ä/ä.cot", data: new Uint8Array(0) }];
    const a = Buffer.from(writeStoredZip(entries));
    expect(a.equals(Buffer.from(writeStoredZip(entries)))).toBe(true);
    expect(readZip(a).map((e) => [e.name, [...e.data], e.flags])).toEqual([["a.txt", [104, 101, 108, 108, 111], 0], ["dir/b.bin", [0, 255, 1], 0], ["ä/ä.cot", [], 0x0800]]);
    expect(() => writeStoredZip([entries[0]!, entries[0]!])).toThrow(RangeError);
    for (const name of ["/abs", "a\\b", "", "../x", "a/./b", "a//b", " lead", "tab\there"]) expect(() => writeStoredZip([{ name, data: new Uint8Array(1) }]), name).toThrow(RangeError);
  });

  it("packs CoT events one per <uid>/<uid>.cot entry, sorted, and refuses a uid twice or one that cannot name an entry", () => {
    const doc = (uid: string) => `${XML_DECLARATION}\n<event uid="${uid}"/>\n`;
    const pkg = buildCotDataPackage({ name: "TAK-SIM T", items: [{ uid: "b", document: doc("b") }, { uid: "a", document: doc("a") }] });
    expect(pkg.entries).toEqual(["a/a.cot", "b/b.cot"]);
    expect(readZip(Buffer.from(pkg.zip)).map((e) => e.name)).toEqual([MANIFEST_ENTRY, "a/a.cot", "b/b.cot"]);
    expect(buildCotDataPackage({ name: "TAK-SIM T", items: [{ uid: "a", document: doc("a") }, { uid: "b", document: doc("b") }] }).zip).toEqual(pkg.zip); // input order does not matter
    expect(() => buildCotDataPackage({ name: "x", items: [{ uid: "a", document: "1" }, { uid: "a", document: "2" }] })).toThrow(RangeError);
    for (const uid of ["", ".", "..", "a/b", "a\\b"]) expect(() => cotEntryName(uid), uid).toThrow(RangeError);
    expect(cotEntryName("GeoChat.TAKSIM-SRC-HÄTÄKESKUS.command.evt.vp.001")).toBe("GeoChat.TAKSIM-SRC-HÄTÄKESKUS.command.evt.vp.001/GeoChat.TAKSIM-SRC-HÄTÄKESKUS.command.evt.vp.001.cot");
  });

  it("name-based UUIDs are RFC 4122 version 5 (the RFC's own example) and stable", () => {
    expect(nameBasedUuid("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(nameBasedUuid("x")).toBe(nameBasedUuid("x"));
    expect(nameBasedUuid("x")).not.toBe(nameBasedUuid("y"));
  });
});
