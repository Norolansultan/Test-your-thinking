/**
 * SPEC/28 §3: the Cursor-on-Target event model, its deterministic serialisation and a small strict
 * parser for the same format.
 *
 * Clean-room, from the public CoT 2.0 base schema (`event` / `point` / `detail`) and the detail
 * elements TAK clients read (`contact`, `__group`, `status`, `track`, `sensor`, `link`, the shape
 * style elements, `color`, `__chat` + `chatgrp`, `remarks`), plus one custom element, `__taksim`, for
 * the instrument's own bookkeeping (view, step, kind, source).
 *
 * Serialisation is deterministic (I1): attributes in a fixed order, detail elements in a fixed order,
 * coordinates with 7 decimals and every other number with a fixed number of decimals, XML escaping,
 * no whitespace inside an event, and events sorted by (`time`, `uid`). The parser reads exactly what
 * the serialiser writes (and refuses anything else: comments, CDATA, unknown elements or attributes),
 * so `serializeCot(parseCot(xml)) === xml` for every serialised event.
 */

import type { LatLon } from "../engine/primitives.js";

export const COT_VERSION = "2.0";
/** CoT's "unknown" circular / linear error (SPEC/28 §3). */
export const CE_UNKNOWN = 9_999_999;
/** The XML declaration that heads a serialised document. */
export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Decimals of each number family in the serialisation. */
export const COORD_DECIMALS = 7;
export const VALUE_DECIMALS = 1;

export interface CotPoint {
  readonly lat: number;
  readonly lon: number;
  readonly hae: number;
  readonly ce: number;
  readonly le: number;
}

export interface CotContact {
  readonly callsign: string;
}

/** `__group`: the TAK team (a colour name) and role. */
export interface CotGroup {
  readonly name: string;
  readonly role: string;
}

/** `status`: battery percentage (drones). */
export interface CotStatus {
  readonly battery: number;
}

/** `track`: course in degrees true, speed in metres per second. */
export interface CotTrack {
  readonly course: number;
  readonly speed: number;
}

/** `sensor`: a camera's field of view (degrees), azimuth (degrees true) and range (metres). */
export interface CotSensor {
  readonly fov: number;
  readonly azimuth: number;
  readonly range: number;
}

/** A drawing's style: `strokeColor`, `strokeWeight`, `fillColor` (ARGB as signed 32-bit integers, the ATAK convention) and `labels_on`. */
export interface CotShapeStyle {
  readonly strokeColor: number;
  readonly strokeWeight: number;
  readonly fillColor: number;
  readonly labelsOn: boolean;
}

/** `__chat` with its `chatgrp` child (GeoChat). */
export interface CotChat {
  readonly parent: string;
  readonly groupOwner: boolean;
  readonly messageId: string;
  readonly chatroom: string;
  readonly id: string;
  readonly senderCallsign: string;
  readonly chatgrp: { readonly uid0: string; readonly uid1: string; readonly id: string };
}

/** A `link` to another event (the GeoChat sender). */
export interface CotLinkRef {
  readonly uid: string;
  readonly type: string;
  readonly relation: string;
}

export interface CotRemarks {
  readonly source?: string;
  readonly to?: string;
  readonly time?: string;
  readonly text: string;
}

/** The instrument's own bookkeeping element, `__taksim`. */
export type TakSimKind =
  | "self"
  | "unit"
  | "aircraft"
  | "perimeter"
  | "front"
  | "past_perimeter"
  | "projection"
  | "footprint"
  | "rate"
  | "chat";

export const TAKSIM_KINDS: readonly TakSimKind[] = ["self", "unit", "aircraft", "perimeter", "front", "past_perimeter", "projection", "footprint", "rate", "chat"];

export interface TakSimDetail {
  /** `V00` (the practice view) … `V14`. */
  readonly view: string;
  /** The view step, 1 or 2 (SPEC/26 §2). */
  readonly step: number;
  readonly kind: TakSimKind;
  /** Who or what the object comes from: a platform or source id, the projection's attribution, `reported`. */
  readonly source: string;
}

/** The detail elements this simulation emits, in their serialisation order. */
export interface CotDetail {
  readonly contact?: CotContact;
  readonly group?: CotGroup;
  readonly status?: CotStatus;
  readonly track?: CotTrack;
  readonly sensor?: CotSensor;
  /** A drawing's vertices, one `<link point="lat,lon"/>` each; a closed shape repeats its first vertex last. */
  readonly vertices?: readonly LatLon[];
  readonly style?: CotShapeStyle;
  /** `<color argb=…/>` (markers). */
  readonly color?: number;
  readonly chat?: CotChat;
  readonly linkRef?: CotLinkRef;
  readonly remarks?: CotRemarks;
  readonly taksim: TakSimDetail;
}

export interface CotEvent {
  readonly version: typeof COT_VERSION;
  readonly uid: string;
  readonly type: string;
  readonly how: string;
  readonly time: string;
  readonly start: string;
  readonly stale: string;
  readonly point: CotPoint;
  readonly detail: CotDetail;
}

// ---------------------------------------------------------------------------
// numbers
// ---------------------------------------------------------------------------

/** `x` rounded to `decimals` exactly as the serialiser writes it, so a compiled event equals its parse. Never −0. */
export function roundTo(x: number, decimals: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`not a finite number: ${x}`);
  const r = Number(x.toFixed(decimals));
  return r === 0 ? 0 : r;
}

function fixed(x: number, decimals: number): string {
  if (!Number.isFinite(x)) throw new RangeError(`cannot serialise a non-finite number: ${x}`);
  return (x === 0 ? 0 : x).toFixed(decimals).replace(/^-(0\.?0*)$/, "$1");
}

function integer(x: number): string {
  if (!Number.isInteger(x)) throw new RangeError(`expected an integer, got ${x}`);
  return String(x === 0 ? 0 : x);
}

const coord = (x: number) => fixed(x, COORD_DECIMALS);
const value = (x: number) => fixed(x, VALUE_DECIMALS);

// ---------------------------------------------------------------------------
// escaping
// ---------------------------------------------------------------------------

const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;

function checkChars(s: string): void {
  if (FORBIDDEN_CONTROL.test(s)) throw new RangeError(`character not allowed in XML 1.0 in ${JSON.stringify(s)}`);
}

export function escapeXmlText(s: string): string {
  checkChars(s);
  // Line breaks as character references, so every serialised event stays on one line (one event per line in a document and a stream).
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}

export function escapeXmlAttr(s: string): string {
  checkChars(s);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

function element(name: string, attrs: readonly (readonly [string, string | undefined])[], inner?: string): string {
  const a = attrs.filter((p): p is readonly [string, string] => p[1] !== undefined).map(([k, v]) => ` ${k}="${escapeXmlAttr(v)}"`).join("");
  return inner === undefined ? `<${name}${a}/>` : `<${name}${a}>${inner}</${name}>`;
}

// ---------------------------------------------------------------------------
// serialisation
// ---------------------------------------------------------------------------

function serializeDetail(d: CotDetail): string {
  const parts: string[] = [];
  if (d.contact) parts.push(element("contact", [["callsign", d.contact.callsign]]));
  if (d.group) parts.push(element("__group", [["name", d.group.name], ["role", d.group.role]]));
  if (d.status) parts.push(element("status", [["battery", integer(d.status.battery)]]));
  if (d.track) parts.push(element("track", [["course", value(d.track.course)], ["speed", value(d.track.speed)]]));
  if (d.sensor) parts.push(element("sensor", [["fov", value(d.sensor.fov)], ["azimuth", value(d.sensor.azimuth)], ["range", value(d.sensor.range)]]));
  for (const v of d.vertices ?? []) parts.push(element("link", [["point", `${coord(v.lat)},${coord(v.lon)}`]]));
  if (d.style) {
    parts.push(element("strokeColor", [["value", integer(d.style.strokeColor)]]));
    parts.push(element("strokeWeight", [["value", value(d.style.strokeWeight)]]));
    parts.push(element("fillColor", [["value", integer(d.style.fillColor)]]));
    parts.push(element("labels_on", [["value", d.style.labelsOn ? "true" : "false"]]));
  }
  if (d.color !== undefined) parts.push(element("color", [["argb", integer(d.color)]]));
  if (d.chat) {
    const c = d.chat;
    parts.push(
      element(
        "__chat",
        [["parent", c.parent], ["groupOwner", c.groupOwner ? "true" : "false"], ["messageId", c.messageId], ["chatroom", c.chatroom], ["id", c.id], ["senderCallsign", c.senderCallsign]],
        element("chatgrp", [["uid0", c.chatgrp.uid0], ["uid1", c.chatgrp.uid1], ["id", c.chatgrp.id]]),
      ),
    );
  }
  if (d.linkRef) parts.push(element("link", [["uid", d.linkRef.uid], ["type", d.linkRef.type], ["relation", d.linkRef.relation]]));
  if (d.remarks) parts.push(element("remarks", [["source", d.remarks.source], ["to", d.remarks.to], ["time", d.remarks.time]], escapeXmlText(d.remarks.text)));
  const t = d.taksim;
  parts.push(element("__taksim", [["view", t.view], ["step", integer(t.step)], ["kind", t.kind], ["source", t.source]]));
  return parts.join("");
}

/** One event as a single line of XML (no declaration, no trailing newline). */
export function serializeCot(event: CotEvent): string {
  const p = event.point;
  return element(
    "event",
    [["version", event.version], ["uid", event.uid], ["type", event.type], ["how", event.how], ["time", event.time], ["start", event.start], ["stale", event.stale]],
    element("point", [["lat", coord(p.lat)], ["lon", coord(p.lon)], ["hae", value(p.hae)], ["ce", value(p.ce)], ["le", value(p.le)]]) +
      `<detail>${serializeDetail(event.detail)}</detail>`,
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The order of every event list: (`time`, `uid`), then the serialised text so a tie is still total. */
export function compareCotEvents(a: CotEvent, b: CotEvent): number {
  return compareStrings(a.time, b.time) || compareStrings(a.uid, b.uid) || compareStrings(serializeCot(a), serializeCot(b));
}

/** A sorted copy (`compareCotEvents`); never sorts in place. */
export function sortCotEvents(events: readonly CotEvent[]): CotEvent[] {
  return [...events].sort(compareCotEvents);
}

/** A document of events: the declaration, then `<events>` with one event per line, sorted by (`time`, `uid`). */
export function serializeCotEvents(events: readonly CotEvent[]): string {
  const lines = sortCotEvents(events).map(serializeCot);
  return `${XML_DECLARATION}\n<events>\n${lines.map((l) => `${l}\n`).join("")}</events>\n`;
}

/** One event as a stand-alone document (the declaration, the event, a newline): a `.cot` file or one TAK stream message. */
export function serializeCotDocument(event: CotEvent): string {
  return `${XML_DECLARATION}\n${serializeCot(event)}\n`;
}

// ---------------------------------------------------------------------------
// parsing (strict: exactly the format above)
// ---------------------------------------------------------------------------

interface XmlElement {
  readonly name: string;
  readonly attrs: readonly (readonly [string, string])[];
  readonly children: readonly XmlElement[];
  readonly text: string;
}

export class CotParseError extends Error {
  constructor(message: string, readonly offset: number) {
    super(`${message} (at offset ${offset})`);
    this.name = "CotParseError";
  }
}

function decodeEntities(s: string, offset: number): string {
  return s.replace(/&([^;&\s]*);?/g, (match, body: string) => {
    if (!match.endsWith(";")) throw new CotParseError(`unterminated entity ${JSON.stringify(match)}`, offset);
    switch (body) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
    }
    const num = /^#(\d+)$/.exec(body) ?? null;
    const hex = /^#x([0-9a-fA-F]+)$/.exec(body) ?? null;
    const code = num ? Number(num[1]) : hex ? parseInt(hex[1]!, 16) : NaN;
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) throw new CotParseError(`unknown entity ${JSON.stringify(match)}`, offset);
    return String.fromCodePoint(code);
  });
}

class XmlReader {
  private pos = 0;
  constructor(private readonly src: string) {}

  done(): boolean {
    return this.pos >= this.src.length;
  }

  skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) this.pos++;
  }

  /** The optional `<?xml …?>` declaration at the very start. */
  skipDeclaration(): void {
    this.skipWhitespace();
    if (this.src.startsWith("<?xml", this.pos)) {
      const end = this.src.indexOf("?>", this.pos);
      if (end < 0) throw new CotParseError("unterminated XML declaration", this.pos);
      this.pos = end + 2;
    }
  }

  fail(message: string): never {
    throw new CotParseError(message, this.pos);
  }

  private name(): string {
    const m = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(this.src.slice(this.pos, this.pos + 128));
    if (!m) this.fail("expected a name");
    this.pos += m[0].length;
    return m[0];
  }

  element(): XmlElement {
    if (this.src[this.pos] !== "<") this.fail("expected '<'");
    if (this.src.startsWith("<!", this.pos) || this.src.startsWith("<?", this.pos)) this.fail("comments, CDATA, DTDs and processing instructions are not accepted");
    this.pos++;
    const name = this.name();
    const attrs: (readonly [string, string])[] = [];
    for (;;) {
      const before = this.pos;
      this.skipWhitespace();
      const c = this.src[this.pos];
      if (c === "/" && this.src[this.pos + 1] === ">") {
        this.pos += 2;
        return { name, attrs, children: [], text: "" };
      }
      if (c === ">") {
        this.pos++;
        break;
      }
      if (this.pos === before) this.fail(`expected whitespace before an attribute of <${name}>`);
      const key = this.name();
      if (attrs.some(([k]) => k === key)) this.fail(`duplicate attribute ${key} on <${name}>`);
      if (this.src[this.pos] !== "=" || this.src[this.pos + 1] !== '"') this.fail(`expected ="…" after ${key}`);
      this.pos += 2;
      const end = this.src.indexOf('"', this.pos);
      if (end < 0) this.fail(`unterminated attribute ${key}`);
      const raw = this.src.slice(this.pos, end);
      if (raw.includes("<")) this.fail(`'<' in attribute ${key}`);
      attrs.push([key, decodeEntities(raw, this.pos)]);
      this.pos = end + 1;
    }
    const children: XmlElement[] = [];
    let text = "";
    for (;;) {
      const lt = this.src.indexOf("<", this.pos);
      if (lt < 0) this.fail(`unterminated <${name}>`);
      const raw = this.src.slice(this.pos, lt);
      if (raw.includes(">")) this.fail(`stray '>' in <${name}>`);
      text += decodeEntities(raw, this.pos);
      this.pos = lt;
      if (this.src.startsWith("</", this.pos)) {
        this.pos += 2;
        const closing = this.name();
        if (closing !== name) this.fail(`</${closing}> closes <${name}>`);
        if (this.src[this.pos] !== ">") this.fail(`expected '>' after </${closing}`);
        this.pos++;
        break;
      }
      children.push(this.element());
    }
    if (children.length > 0 && text.trim() !== "") this.fail(`<${name}> mixes text and elements`);
    return { name, attrs, children, text: children.length > 0 ? "" : text };
  }
}

function attrsOf(el: XmlElement, required: readonly string[], optional: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of el.attrs) {
    if (!required.includes(k) && !optional.includes(k)) throw new CotParseError(`unexpected attribute ${k} on <${el.name}>`, 0);
    out[k] = v;
  }
  for (const k of required) if (out[k] === undefined) throw new CotParseError(`<${el.name}> is missing ${k}`, 0);
  return out;
}

function num(s: string, what: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new CotParseError(`${what}: not a number: ${JSON.stringify(s)}`, 0);
  const n = Number(s);
  return n === 0 ? 0 : n;
}

function int(s: string, what: string): number {
  if (!/^-?\d+$/.test(s)) throw new CotParseError(`${what}: not an integer: ${JSON.stringify(s)}`, 0);
  const n = Number(s);
  return n === 0 ? 0 : n;
}

function bool(s: string, what: string): boolean {
  if (s === "true") return true;
  if (s === "false") return false;
  throw new CotParseError(`${what}: not a boolean: ${JSON.stringify(s)}`, 0);
}

function noChildren(el: XmlElement): void {
  if (el.children.length > 0 || el.text !== "") throw new CotParseError(`<${el.name}> must be empty`, 0);
}

function isTakSimKind(s: string): s is TakSimKind {
  return (TAKSIM_KINDS as readonly string[]).includes(s);
}

function parseDetail(el: XmlElement): CotDetail {
  noText(el);
  let contact: CotContact | undefined;
  let group: CotGroup | undefined;
  let status: CotStatus | undefined;
  let track: CotTrack | undefined;
  let sensor: CotSensor | undefined;
  const vertices: LatLon[] = [];
  const style: { strokeColor?: number; strokeWeight?: number; fillColor?: number; labelsOn?: boolean } = {};
  let color: number | undefined;
  let chat: CotChat | undefined;
  let linkRef: CotLinkRef | undefined;
  let remarks: CotRemarks | undefined;
  let taksim: TakSimDetail | undefined;
  const once = <T>(current: T | undefined, name: string): void => {
    if (current !== undefined) throw new CotParseError(`more than one <${name}>`, 0);
  };

  for (const c of el.children) {
    switch (c.name) {
      case "contact": {
        once(contact, c.name); noChildren(c);
        contact = { callsign: attrsOf(c, ["callsign"]).callsign! };
        break;
      }
      case "__group": {
        once(group, c.name); noChildren(c);
        const a = attrsOf(c, ["name", "role"]);
        group = { name: a.name!, role: a.role! };
        break;
      }
      case "status": {
        once(status, c.name); noChildren(c);
        status = { battery: int(attrsOf(c, ["battery"]).battery!, "status@battery") };
        break;
      }
      case "track": {
        once(track, c.name); noChildren(c);
        const a = attrsOf(c, ["course", "speed"]);
        track = { course: num(a.course!, "track@course"), speed: num(a.speed!, "track@speed") };
        break;
      }
      case "sensor": {
        once(sensor, c.name); noChildren(c);
        const a = attrsOf(c, ["fov", "azimuth", "range"]);
        sensor = { fov: num(a.fov!, "sensor@fov"), azimuth: num(a.azimuth!, "sensor@azimuth"), range: num(a.range!, "sensor@range") };
        break;
      }
      case "link": {
        noChildren(c);
        if (c.attrs.some(([k]) => k === "point")) {
          const parts = attrsOf(c, ["point"]).point!.split(",");
          if (parts.length !== 2) throw new CotParseError(`link@point must be "lat,lon"`, 0);
          vertices.push({ lat: num(parts[0]!, "link@point lat"), lon: num(parts[1]!, "link@point lon") });
        } else {
          once(linkRef, "link uid");
          const a = attrsOf(c, ["uid", "type", "relation"]);
          linkRef = { uid: a.uid!, type: a.type!, relation: a.relation! };
        }
        break;
      }
      case "strokeColor":
      case "fillColor": {
        noChildren(c);
        const key = c.name === "strokeColor" ? "strokeColor" : "fillColor";
        once(style[key], c.name);
        style[key] = int(attrsOf(c, ["value"]).value!, `${c.name}@value`);
        break;
      }
      case "strokeWeight": {
        noChildren(c); once(style.strokeWeight, c.name);
        style.strokeWeight = num(attrsOf(c, ["value"]).value!, "strokeWeight@value");
        break;
      }
      case "labels_on": {
        noChildren(c); once(style.labelsOn, c.name);
        style.labelsOn = bool(attrsOf(c, ["value"]).value!, "labels_on@value");
        break;
      }
      case "color": {
        noChildren(c); once(color, c.name);
        color = int(attrsOf(c, ["argb"]).argb!, "color@argb");
        break;
      }
      case "__chat": {
        once(chat, c.name);
        const a = attrsOf(c, ["parent", "groupOwner", "messageId", "chatroom", "id", "senderCallsign"]);
        const grp = c.children;
        if (grp.length !== 1 || grp[0]!.name !== "chatgrp") throw new CotParseError("<__chat> must hold exactly one <chatgrp>", 0);
        noChildren(grp[0]!);
        const g = attrsOf(grp[0]!, ["uid0", "uid1", "id"]);
        chat = {
          parent: a.parent!, groupOwner: bool(a.groupOwner!, "__chat@groupOwner"), messageId: a.messageId!, chatroom: a.chatroom!, id: a.id!, senderCallsign: a.senderCallsign!,
          chatgrp: { uid0: g.uid0!, uid1: g.uid1!, id: g.id! },
        };
        break;
      }
      case "remarks": {
        once(remarks, c.name);
        if (c.children.length > 0) throw new CotParseError("<remarks> holds text only", 0);
        const a = attrsOf(c, [], ["source", "to", "time"]);
        remarks = {
          ...(a.source !== undefined ? { source: a.source } : {}),
          ...(a.to !== undefined ? { to: a.to } : {}),
          ...(a.time !== undefined ? { time: a.time } : {}),
          text: c.text,
        };
        break;
      }
      case "__taksim": {
        once(taksim, c.name); noChildren(c);
        const a = attrsOf(c, ["view", "step", "kind", "source"]);
        if (!isTakSimKind(a.kind!)) throw new CotParseError(`__taksim@kind: unknown kind ${JSON.stringify(a.kind)}`, 0);
        taksim = { view: a.view!, step: int(a.step!, "__taksim@step"), kind: a.kind, source: a.source! };
        break;
      }
      default:
        throw new CotParseError(`unexpected detail element <${c.name}>`, 0);
    }
  }
  if (!taksim) throw new CotParseError("<detail> is missing <__taksim>", 0);
  const styleKeys = [style.strokeColor, style.strokeWeight, style.fillColor, style.labelsOn].filter((v) => v !== undefined).length;
  if (styleKeys !== 0 && styleKeys !== 4) throw new CotParseError("a drawing needs all of strokeColor, strokeWeight, fillColor and labels_on", 0);
  return {
    ...(contact ? { contact } : {}),
    ...(group ? { group } : {}),
    ...(status ? { status } : {}),
    ...(track ? { track } : {}),
    ...(sensor ? { sensor } : {}),
    ...(vertices.length > 0 ? { vertices } : {}),
    ...(styleKeys === 4 ? { style: { strokeColor: style.strokeColor!, strokeWeight: style.strokeWeight!, fillColor: style.fillColor!, labelsOn: style.labelsOn! } } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(chat ? { chat } : {}),
    ...(linkRef ? { linkRef } : {}),
    ...(remarks ? { remarks } : {}),
    taksim,
  };
}

function noText(el: XmlElement): void {
  if (el.text.trim() !== "") throw new CotParseError(`<${el.name}> holds stray text`, 0);
}

function eventOf(el: XmlElement): CotEvent {
  if (el.name !== "event") throw new CotParseError(`expected <event>, got <${el.name}>`, 0);
  noText(el);
  const a = attrsOf(el, ["version", "uid", "type", "how", "time", "start", "stale"]);
  if (a.version !== COT_VERSION) throw new CotParseError(`unsupported CoT version ${JSON.stringify(a.version)}`, 0);
  if (el.children.length !== 2 || el.children[0]!.name !== "point" || el.children[1]!.name !== "detail") {
    throw new CotParseError("<event> must hold <point> then <detail>", 0);
  }
  const pointEl = el.children[0]!;
  noChildren(pointEl);
  const p = attrsOf(pointEl, ["lat", "lon", "hae", "ce", "le"]);
  return {
    version: COT_VERSION,
    uid: a.uid!,
    type: a.type!,
    how: a.how!,
    time: a.time!,
    start: a.start!,
    stale: a.stale!,
    point: { lat: num(p.lat!, "point@lat"), lon: num(p.lon!, "point@lon"), hae: num(p.hae!, "point@hae"), ce: num(p.ce!, "point@ce"), le: num(p.le!, "point@le") },
    detail: parseDetail(el.children[1]!),
  };
}

function readRoot(xml: string): XmlElement {
  const r = new XmlReader(xml);
  r.skipDeclaration();
  r.skipWhitespace();
  const root = r.element();
  r.skipWhitespace();
  if (!r.done()) r.fail("trailing content after the root element");
  return root;
}

/** Parses one event (optionally preceded by the XML declaration), as {@link serializeCot} or {@link serializeCotDocument} wrote it. */
export function parseCot(xml: string): CotEvent {
  return eventOf(readRoot(xml));
}

/** Parses an `<events>` document as {@link serializeCotEvents} wrote it (or a single `<event>`), in document order. */
export function parseCotEvents(xml: string): CotEvent[] {
  const root = readRoot(xml);
  if (root.name === "event") return [eventOf(root)];
  if (root.name !== "events") throw new CotParseError(`expected <events>, got <${root.name}>`, 0);
  noText(root);
  if (root.attrs.length > 0) throw new CotParseError("<events> takes no attributes", 0);
  return root.children.map(eventOf);
}
