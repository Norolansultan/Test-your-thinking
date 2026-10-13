/**
 * SPEC/28 §3: deterministic CoT serialisation (I1) and the strict parser — serialising twice is
 * byte-identical, parse → serialise is the identity, and the parser refuses what the serialiser
 * never writes.
 */

import { describe, expect, it } from "vitest";
import {
  CE_UNKNOWN, CotParseError, escapeXmlAttr, parseCot, parseCotEvents, roundTo, serializeCot, serializeCotDocument, serializeCotEvents, sortCotEvents, XML_DECLARATION, type CotEvent,
} from "../../app/tak/cot.js";
import { compileViewCot } from "../../app/tak/compile.js";
import { sessionCotInputs } from "../../tools/tak/export.js";

const FULL: CotEvent = {
  version: "2.0",
  uid: "TAKSIM-AIR-DR2",
  type: "a-f-A-M-H-Q",
  how: "m-g",
  time: "2030-07-26T11:00:00.000Z",
  start: "2030-07-26T11:00:00.000Z",
  stale: "2030-07-26T11:20:00.000Z",
  point: { lat: 60.8524351, lon: 27.3536962, hae: 0, ce: CE_UNKNOWN, le: CE_UNKNOWN },
  detail: {
    contact: { callsign: "DR2 <\"&'>" },
    group: { name: "Cyan", role: "Team Member" },
    status: { battery: 43 },
    track: { course: 359.9, speed: 1.5 },
    sensor: { fov: 360, azimuth: 250.3, range: 418.3 },
    vertices: [{ lat: 60.1, lon: 27.1 }, { lat: 60.2, lon: 27.2 }, { lat: -0.5, lon: -179.9999999 }, { lat: 60.1, lon: 27.1 }],
    style: { strokeColor: -2742232, strokeWeight: 3, fillColor: 1087776808, labelsOn: true },
    color: -65536,
    chat: {
      parent: "RootContactGroup", groupOwner: false, messageId: "atom.demo.5.0", chatroom: "air", id: "air", senderCallsign: "DR2",
      chatgrp: { uid0: "TAKSIM-AIR-DR2", uid1: "TAKSIM-SELF", id: "air" },
    },
    linkRef: { uid: "TAKSIM-AIR-DR2", type: "a-f-A-M-H-Q", relation: "p-p" },
    remarks: { source: "TAKSIM.TAKSIM-AIR-DR2", to: "air", time: "2030-07-26T11:00:30.000Z", text: "Kärki < 50 m & \"tiheä\" 'alikasvos'\nrivi 2\r\t— ÄÖå ✓" },
    taksim: { view: "V03", step: 1, kind: "aircraft", source: "DR2" },
  },
};

const MINIMAL: CotEvent = {
  version: "2.0", uid: "TAKSIM-SELF", type: "a-f-G-U-C", how: "h-e",
  time: "2030-07-26T10:20:00.000Z", start: "2030-07-26T10:20:00.000Z", stale: "2030-07-26T10:40:00.000Z",
  point: { lat: 0, lon: 0, hae: 0, ce: CE_UNKNOWN, le: CE_UNKNOWN },
  detail: { taksim: { view: "V01", step: 1, kind: "self", source: "JOHTO" } },
};

describe("serializeCot — deterministic, fixed format", () => {
  it("writes attributes and detail elements in a fixed order, 7-decimal coordinates, 1-decimal values", () => {
    const xml = serializeCot(FULL);
    expect(xml.startsWith('<event version="2.0" uid="TAKSIM-AIR-DR2" type="a-f-A-M-H-Q" how="m-g" time="2030-07-26T11:00:00.000Z" start="2030-07-26T11:00:00.000Z" stale="2030-07-26T11:20:00.000Z">')).toBe(true);
    expect(xml).toContain('<point lat="60.8524351" lon="27.3536962" hae="0.0" ce="9999999.0" le="9999999.0"/>');
    expect(xml).toContain('<link point="-0.5000000,-179.9999999"/>');
    expect(xml).toContain('<track course="359.9" speed="1.5"/><sensor fov="360.0" azimuth="250.3" range="418.3"/>');
    expect(xml).toContain('<strokeColor value="-2742232"/><strokeWeight value="3.0"/><fillColor value="1087776808"/><labels_on value="true"/><color argb="-65536"/>');
    const order = ["<contact", "<__group", "<status", "<track", "<sensor", "<link point", "<strokeColor", "<color", "<__chat", "<link uid", "<remarks", "<__taksim"].map((t) => xml.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(xml).not.toMatch(/\n|> </);
  });

  it("escapes markup in attributes and text", () => {
    const xml = serializeCot(FULL);
    expect(xml).toContain('callsign="DR2 &lt;&quot;&amp;&apos;&gt;"');
    expect(xml).toContain("Kärki &lt; 50 m &amp; \"tiheä\" 'alikasvos'&#10;rivi 2&#13;\t— ÄÖå ✓</remarks>");
    expect(escapeXmlAttr("a\nb\tc")).toBe("a&#10;b&#9;c");
    expect(() => serializeCot({ ...MINIMAL, uid: "bad\u0001" })).toThrow(RangeError);
  });

  it("serialising the same events twice is byte-identical, whatever the input order", () => {
    const events = [FULL, MINIMAL, { ...MINIMAL, uid: "TAKSIM-A", time: "2030-07-26T10:20:00.000Z" }];
    const a = serializeCotEvents(events);
    const b = serializeCotEvents([...events].reverse());
    expect(a).toBe(b);
    expect(a.startsWith(`${XML_DECLARATION}\n<events>\n`)).toBe(true);
    expect(a.endsWith("</events>\n")).toBe(true);
    expect(sortCotEvents(events).map((e) => e.uid)).toEqual(["TAKSIM-A", "TAKSIM-SELF", "TAKSIM-AIR-DR2"]); // by time, then uid
  });

  it("never writes −0 or non-finite numbers", () => {
    expect(serializeCot({ ...MINIMAL, point: { ...MINIMAL.point, lat: -0, lon: -0.00000001 } })).toContain('lat="0.0000000" lon="0.0000000"');
    expect(roundTo(-0.00000001, 7)).toBe(0);
    expect(Object.is(roundTo(-0.00000001, 7), -0)).toBe(false);
    expect(() => serializeCot({ ...MINIMAL, point: { ...MINIMAL.point, lat: Number.NaN } })).toThrow(RangeError);
    expect(() => serializeCot({ ...MINIMAL, detail: { ...MINIMAL.detail, status: { battery: 42.5 } } })).toThrow(RangeError);
  });

  it("a compiled view serialises byte-identically twice (two independent compilations)", () => {
    const inputs = sessionCotInputs();
    const v = inputs.find((i) => i.cycle.index === 6 && i.cycle.stepShown === 2)!;
    const a = serializeCotEvents(compileViewCot(v));
    const b = serializeCotEvents(compileViewCot(sessionCotInputs().find((i) => i.cycle.index === 6 && i.cycle.stepShown === 2)!));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(10_000);
  });
});

describe("parseCot — strict round trip", () => {
  it("parse(serialize(e)) equals e, and serialize(parse(xml)) is the identity", () => {
    for (const e of [FULL, MINIMAL]) {
      const xml = serializeCot(e);
      expect(parseCot(xml)).toEqual(e);
      expect(serializeCot(parseCot(xml))).toBe(xml);
      expect(parseCot(serializeCotDocument(e))).toEqual(e);
    }
  });

  it("round-trips whole documents, and every compiled event of a real view", () => {
    const events = compileViewCot(sessionCotInputs().find((i) => i.cycle.index === 13)!);
    const doc = serializeCotEvents(events);
    const parsed = parseCotEvents(doc);
    expect(parsed).toEqual(events); // compiled events are already rounded to the serialisation's precision
    expect(serializeCotEvents(parsed)).toBe(doc);
    expect(parseCotEvents(serializeCot(FULL))).toEqual([FULL]);
  });

  it("refuses what the serialiser never writes", () => {
    const xml = serializeCot(MINIMAL);
    const bad = [
      xml.replace("<detail>", "<detail><!-- c -->"),
      xml.replace("<detail>", "<detail><foo/>"),
      xml.replace('how="h-e"', 'how="h-e" extra="1"'),
      xml.replace('version="2.0"', 'version="1.0"'),
      xml.replace(' how="h-e"', ""),
      xml.replace('kind="self"', 'kind="flag"'),
      xml.replace("</event>", ""),
      `${xml}<event/>`,
      xml.replace('lat="0.0000000"', 'lat="1e3"'),
      xml.replace("<detail>", "<detail>&bogus;"),
      xml.replace("<detail>", "<detail><strokeColor value=\"1\"/>"),
      xml.replace('<point lat="0.0000000"', "<point lat='0.0'"),
    ];
    for (const b of bad) expect(() => parseCot(b), b).toThrow(CotParseError);
  });
});
