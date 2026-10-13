/**
 * SPEC/28 §6: the TAK data package (the "mission package" ATAK, WinTAK and iTAK import): a ZIP holding
 * `MANIFEST/manifest.xml` and the content files.
 *
 * The CoT layout a TAK client imports as map items: one event per entry, `<uid>/<uid>.cot` (the XML
 * declaration and a single `<event>`), each listed in the manifest as
 * `<Content ignore="false" zipEntry="<uid>/<uid>.cot"><Parameter name="uid" value="<uid>"/></Content>`,
 * with the package's own `uid`, `name` and `onReceiveDelete` (false: keep the package after import).
 *
 * A minimal, deterministic ZIP writer: STORE only (no compression), CRC-32, one fixed DOS timestamp
 * (the incident's start, 26 July 2030 13:20), entries in the order given, no extra fields, no
 * comments — so the same files always give the same bytes (I1). Entry names are UTF-8 (general-purpose
 * flag bit 11 set when a name is not plain ASCII: some GeoChat uids hold "Ä"). No dependency.
 */

import { createHash } from "node:crypto";

export interface ZipEntry {
  /** The entry's path inside the archive, `/`-separated, UTF-8. */
  readonly name: string;
  readonly data: Uint8Array;
}

/** A DOS date and time as the ZIP headers store them. */
export interface DosDateTime {
  readonly date: number;
  readonly time: number;
}

/** DOS date/time of a local date and time (2-second resolution). */
export function dosDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number): DosDateTime {
  if (year < 1980 || year > 2107) throw new RangeError(`DOS dates run from 1980 to 2107, not ${year}`);
  return { date: ((year - 1980) << 9) | (month << 5) | day, time: (hour << 11) | (minute << 5) | Math.floor(second / 2) };
}

/** Every entry's timestamp: the incident's virtual start, 26 July 2030 13:20:00 (local). */
export const FIXED_DOS_TIME: DosDateTime = dosDateTime(2030, 7, 26, 13, 20, 0);

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 (IEEE 802.3, the ZIP checksum). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const VERSION = 20; // 2.0, MS-DOS host
/** General-purpose flag bit 11: the entry name is UTF-8 (APPNOTE 4.4.4). */
const FLAG_UTF8 = 0x0800;

/** A relative `/`-separated path with no control characters, backslashes, empty, `.` or `..` segments. */
function validEntryName(name: string): boolean {
  if (name === "" || /[\u0000-\u001f\u007f\\]/.test(name) || name.startsWith("/")) return false;
  return name.split("/").every((seg, i, all) => seg !== "." && seg !== ".." && (seg !== "" || i === all.length - 1));
}

/** A STORE-only ZIP of `entries`, in the order given. Refuses duplicate or unsafe names and anything that would need ZIP64. */
export function writeStoredZip(entries: readonly ZipEntry[], when: DosDateTime = FIXED_DOS_TIME): Uint8Array {
  if (entries.length > 0xffff) throw new RangeError("too many entries for a ZIP without ZIP64");
  const seen = new Set<string>();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    if (!validEntryName(entry.name) || entry.name !== entry.name.trim()) throw new RangeError(`bad ZIP entry name ${JSON.stringify(entry.name)}`);
    if (seen.has(entry.name)) throw new RangeError(`duplicate ZIP entry ${entry.name}`);
    seen.add(entry.name);
    const name = new TextEncoder().encode(entry.name);
    const flags = /^[\x20-\x7e]*$/.test(entry.name) ? 0 : FLAG_UTF8;
    const size = entry.data.length;
    if (size > 0xfffffffe || offset > 0xfffffffe) throw new RangeError("archive too large for a ZIP without ZIP64");
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + name.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, VERSION, true); // version needed to extract
    lv.setUint16(6, flags, true); // flags
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, when.time, true);
    lv.setUint16(12, when.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // extra field length
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, VERSION, true); // version made by
    cv.setUint16(6, VERSION, true); // version needed to extract
    cv.setUint16(8, flags, true); // flags
    cv.setUint16(10, 0, true); // method: stored
    cv.setUint16(12, when.time, true);
    cv.setUint16(14, when.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // local header offset
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, SIG_END, true);
  ev.setUint16(4, 0, true); // this disk
  ev.setUint16(6, 0, true); // disk with the central directory
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true); // comment length

  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** The ZIP entry the manifest lives at. */
export const MANIFEST_ENTRY = "MANIFEST/manifest.xml";

/** The manifest's `Content` for one CoT event: its entry and the event's uid. */
export interface ManifestContent {
  readonly zipEntry: string;
  readonly uid: string;
}

/**
 * `MANIFEST/manifest.xml` in the TAK data-package format (MissionPackageManifest version 2): the
 * package's `uid`, `name` and `onReceiveDelete`, then one `Content` per CoT event with its `uid`
 * parameter, which is what makes a client dispatch the entry as a map item.
 */
export function missionPackageManifest(options: { readonly uid: string; readonly name: string; readonly onReceiveDelete?: boolean; readonly contents: readonly ManifestContent[] }): string {
  return [
    '<MissionPackageManifest version="2">',
    "  <Configuration>",
    `    <Parameter name="uid" value="${escapeAttr(options.uid)}"/>`,
    `    <Parameter name="name" value="${escapeAttr(options.name)}"/>`,
    `    <Parameter name="onReceiveDelete" value="${(options.onReceiveDelete ?? false) ? "true" : "false"}"/>`,
    "  </Configuration>",
    "  <Contents>",
    ...options.contents.flatMap((c) => [
      `    <Content ignore="false" zipEntry="${escapeAttr(c.zipEntry)}">`,
      `      <Parameter name="uid" value="${escapeAttr(c.uid)}"/>`,
      "    </Content>",
    ]),
    "  </Contents>",
    "</MissionPackageManifest>",
    "",
  ].join("\n");
}

/** Where a CoT event goes in a data package: `<uid>/<uid>.cot`. */
export function cotEntryName(uid: string): string {
  if (uid === "" || uid === "." || uid === ".." || /[/\\\u0000-\u001f\u007f]/.test(uid) || uid !== uid.trim()) throw new RangeError(`uid ${JSON.stringify(uid)} cannot name a package entry`);
  return `${uid}/${uid}.cot`;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The RFC 4122 URL namespace, for {@link nameBasedUuid}. */
const URL_NAMESPACE = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

/** A name-based (version 5, SHA-1) UUID: the same name always gives the same id (never a random v4). */
export function nameBasedUuid(name: string, namespace: string = URL_NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** One CoT event for a package: its uid and its stand-alone document (the XML declaration and one `<event>`). */
export interface CotPackageItem {
  readonly uid: string;
  readonly document: string;
}

/**
 * A CoT data package: the manifest first, then one `<uid>/<uid>.cot` entry per event, sorted by entry
 * name (the manifest lists them in the same order). A uid twice is refused. The package uid is derived
 * from the package's name and content (`nameBasedUuid` over their SHA-256), so a changed export is a
 * new package to a TAK client and an unchanged one the same package.
 */
export function buildCotDataPackage(options: { readonly name: string; readonly items: readonly CotPackageItem[]; readonly uid?: string }): { readonly zip: Uint8Array; readonly manifest: string; readonly uid: string; readonly entries: readonly string[] } {
  const encoder = new TextEncoder();
  const files = options.items
    .map((item) => ({ uid: item.uid, name: cotEntryName(item.uid), data: encoder.encode(item.document) }))
    .sort((a, b) => compareStrings(a.name, b.name));
  for (let i = 1; i < files.length; i++) if (files[i]!.uid === files[i - 1]!.uid) throw new RangeError(`uid ${files[i]!.uid} twice in package ${options.name}`);
  const digest = createHash("sha256");
  for (const f of files) digest.update(`${f.name}\n${f.data.length}\n`).update(f.data);
  const uid = options.uid ?? nameBasedUuid(`tak-sim:datapackage:${options.name}:${digest.digest("hex")}`);
  const manifest = missionPackageManifest({ uid, name: options.name, onReceiveDelete: false, contents: files.map((f) => ({ zipEntry: f.name, uid: f.uid })) });
  const zip = writeStoredZip([{ name: MANIFEST_ENTRY, data: encoder.encode(manifest) }, ...files.map((f) => ({ name: f.name, data: f.data }))]);
  return { zip, manifest, uid, entries: files.map((f) => f.name) };
}
