/**
 * SPEC/28 §2–§4: the CoT compiler over the real session — every view (VP = V00 and V1–V14), both steps
 * of a merged view — driven headlessly through the render tree (`tools/tak/export.ts` sessionCotInputs).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { serializeCotEvents, type CotEvent } from "../../app/tak/cot.js";
import { compileSessionCot, compileViewCot, DEFAULT_SELF_POSITION, DuplicateCotEventError, geoChatUid, platformUid, recordTextOf, SELF_CALLSIGN, senderUid, viewLabel, type ViewCotInput } from "../../app/tak/compile.js";
import { chatRoomOf } from "../../app/tak/geochat.js";
import { COT_TYPE_CHAT, COT_TYPE_DRAWING, COT_TYPE_SPOT, cotTypeOf, SELF_UID } from "../../app/tak/symbols.js";
import { isoOfVirtual, virtualOfIso } from "../../app/tak/time.js";
import { compileScenarioCot, sessionCotInputs } from "../../tools/tak/export.js";
import overlay from "../../app/render/ui/map-overlay.json" with { type: "json" };

let scenario: ScenarioContract;
let inputs: ViewCotInput[];
let events: CotEvent[];
const VIEWS = Array.from({ length: 15 }, (_, i) => viewLabel(i));
const of = (view: string, kind?: string) => events.filter((e) => e.detail.taksim.view === view && (kind === undefined || e.detail.taksim.kind === kind));

beforeAll(() => {
  scenario = buildDemoScenario();
  inputs = sessionCotInputs(scenario);
  events = compileSessionCot(inputs);
});

describe("the session walk", () => {
  it("covers the practice view and V1–V14, a merged view as two steps (SPEC/26 §2–§3)", () => {
    const steps = inputs.map((i) => `${viewLabel(i.cycle.index)}.${i.cycle.stepShown}`);
    const merged = [scenario.practice.cycle, ...scenario.cycles].filter((c) => c.steps === 2).map((c) => viewLabel(c.index));
    expect(merged).toEqual(["V02", "V04", "V06", "V11", "V12", "V14"]);
    expect(steps).toEqual(VIEWS.flatMap((v) => (merged.includes(v) ? [`${v}.1`, `${v}.2`] : [`${v}.1`])));
    expect(new Set(events.map((e) => e.detail.taksim.view))).toEqual(new Set(VIEWS));
  });

  it("delivers every pushed report exactly once, as GeoChat, at its scheduled delivery time", () => {
    const chats = events.filter((e) => e.detail.taksim.kind === "chat");
    const pushed = [scenario.practice.cycle, ...scenario.cycles].flatMap((c) => c.pushedAtomIds.map((id, k) => ({ id, at: c.startsAtVirtual + c.deliveryOffsetsSeconds[k]!, view: viewLabel(c.index) })));
    const duty = scenario.dutyOfficerMessages.length;
    expect(chats).toHaveLength(pushed.length + duty);
    for (const p of pushed) {
      const atom = scenario.atoms.find((a) => a.id === p.id)!;
      const chat = chats.find((c) => c.detail.chat?.messageId === p.id)!;
      expect(chat, p.id).toBeDefined();
      expect(chat.time).toBe(isoOfVirtual(p.at));
      expect(chat.detail.taksim.view).toBe(p.view);
      expect(chat.uid).toBe(`GeoChat.${senderUid(atom.provenance.sourceId)}.${chatRoomOf(atom.provenance.sourceId)}.${p.id}`);
      expect(chat.detail.chat!.chatroom).toBe(chatRoomOf(atom.provenance.sourceId));
      expect(chat.detail.remarks!.text).toBe(recordTextOf(atom.record));
    }
  });

  it("the duty officer's intent (V1) and directive (V8) are command-room messages from P2", () => {
    const p2 = events.filter((e) => e.detail.taksim.kind === "chat" && e.detail.taksim.source === "P2" && !scenario.atoms.some((a) => a.id === e.detail.chat!.messageId));
    expect(p2.map((e) => e.detail.taksim.view)).toEqual(["V01", "V08"]);
    expect(p2.every((e) => e.detail.chat!.chatroom === "command" && e.uid.startsWith("GeoChat.TAKSIM-SRC-P2.command."))).toBe(true);
    expect(p2[1]!.detail.remarks!.text).toBe(scenario.hinge.intentStatement);
    expect(p2[1]!.detail.chat!.messageId).toBe(scenario.hinge.guidanceMessageId);
  });

  it("compiles twice to byte-identical XML", () => {
    expect(serializeCotEvents(compileScenarioCot())).toBe(serializeCotEvents(events));
  });

  it("is sorted by (time, uid) with no (time, uid) twice; a duplicate is refused", () => {
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1]!;
      const b = events[i]!;
      expect(a.time < b.time || (a.time === b.time && a.uid < b.uid), `${a.uid} ${b.uid}`).toBe(true);
    }
    expect(() => compileSessionCot([inputs[3]!, inputs[3]!])).toThrow(DuplicateCotEventError);
  });
});

describe("one view step's events (SPEC/28 §3–§4)", () => {
  it("every view step has the self marker at the command post, every unit and every aircraft on its map", () => {
    for (const input of inputs) {
      const view = viewLabel(input.cycle.index);
      const stepStart = input.cycle.startsAtVirtual + (input.cycle.stepShown - 1) * 1200;
      const at = (e: CotEvent) => e.time === isoOfVirtual(stepStart);
      const self = of(view, "self").filter(at);
      expect(self).toHaveLength(1);
      expect(self[0]!.uid).toBe(SELF_UID);
      expect(self[0]!.point).toMatchObject({ lat: overlay.commandPost.lat, lon: overlay.commandPost.lon });
      expect(self[0]!.detail.contact!.callsign).toBe(SELF_CALLSIGN);
      expect(of(view, "unit").filter(at).map((e) => e.detail.contact!.callsign).sort()).toEqual(Object.keys(input.cycle.unitPositions).sort());
      expect(of(view, "aircraft").filter(at).map((e) => e.detail.contact!.callsign).sort()).toEqual(input.cycle.aircraft.map((a) => a.platformId).sort());
      for (const e of [...of(view, "unit"), ...of(view, "aircraft")].filter(at)) {
        expect(e.uid).toBe(platformUid(e.detail.contact!.callsign));
        expect(e.type).toBe(cotTypeOf(e.detail.contact!.callsign));
        expect(e.how).toBe("m-g");
        expect(e.stale).toBe(isoOfVirtual(stepStart + 1200));
      }
    }
    expect(DEFAULT_SELF_POSITION).toEqual(overlay.commandPost);
  });

  it("units carry the roster and their task; drones their battery, track and camera", () => {
    const ek11 = of("V01", "unit").find((e) => e.uid === "TAKSIM-UNIT-EK11")!;
    expect(ek11.type).toBe("a-f-G-E-V");
    expect(ek11.detail.remarks!.text).toBe("Pelastusyksikkö + säiliö · miehistö 1+5 · Tehtävä: Sammutus letkulinjalla · letku 240 m · vesi 64 %"); // SPEC/33 stage 7–9: 240 m on the rebuilt map (was 260)
    const dr1 = of("V01", "aircraft").find((e) => e.uid === "TAKSIM-AIR-DR1")!;
    expect(dr1.type).toBe("a-f-A-M-H-Q");
    expect(dr1.detail.status).toEqual({ battery: 51 }); // SPEC/18 §8.2: DR1 is up at the handover on a pack at 51 %
    expect(dr1.detail.track!.course).toBeGreaterThanOrEqual(0);
    expect(dr1.detail.track!.course).toBeLessThan(360);
    expect(dr1.detail.sensor).toBeDefined();
    const spot = of("V01", "aircraft").find((e) => e.uid === "TAKSIM-AIR-SPOT")!;
    expect(spot.type).toBe("a-f-A-C-F");
    expect(spot.detail.status).toBeUndefined(); // no battery on the spotter aircraft
    expect(spot.detail.sensor).toBeUndefined(); // no footprint
  });

  it("the reported perimeter, detached fronts and earlier perimeters are u-d-f drawings of the view", () => {
    for (const input of inputs) {
      const view = viewLabel(input.cycle.index);
      const stepStart = isoOfVirtual(input.cycle.startsAtVirtual + (input.cycle.stepShown - 1) * 1200);
      const perim = of(view, "perimeter").filter((e) => e.time === stepStart);
      expect(perim.map((e) => e.uid)).toEqual([`TAKSIM-SHAPE-PERIM-${view}`]);
      expect(perim[0]!.type).toBe(COT_TYPE_DRAWING);
      expect(perim[0]!.how).toBe("h-e");
      expect(perim[0]!.detail.vertices).toHaveLength(input.cycle.perimeter[0]!.length);
      expect(perim[0]!.detail.style).toBeDefined();
      expect(of(view, "front").filter((e) => e.time === stepStart)).toHaveLength(input.cycle.detachedFronts.length);
      expect(of(view, "past_perimeter").filter((e) => e.time === stepStart)).toHaveLength(input.cycle.fire.perimeters_past.reduce((n, p) => n + p.geometry.length, 0));
    }
  });

  it("the projection is u-d-f with how m-p, stale at its validity horizon, labelled as on the map", () => {
    for (const input of inputs) {
      const view = viewLabel(input.cycle.index);
      const env = input.envelope!;
      const proj = of(view, "projection").filter((e) => e.detail.taksim.step === input.cycle.stepShown);
      expect(proj).toHaveLength(1 + env.detachedParts.length);
      for (const p of proj) {
        expect(p.type).toBe(COT_TYPE_DRAWING);
        expect(p.how).toBe("m-p");
        expect(p.stale).toBe(isoOfVirtual(env.horizonVirtual));
        expect(p.detail.contact!.callsign).toBe(env.horizonLabel);
        expect(p.detail.taksim.source).toBe(env.attribution);
      }
      expect(virtualOfIso(proj[0]!.stale)).toBe(input.cycle.startsAtVirtual + input.cycle.steps * 1200); // the end of the view's last step
    }
  });

  it("sensor footprints only for platforms with one (a grounded drone leaves a gap), rate marks as spot markers", () => {
    for (const input of inputs) {
      const view = viewLabel(input.cycle.index);
      const step = input.cycle.stepShown;
      const feet = of(view, "footprint").filter((e) => e.detail.taksim.step === step);
      expect(feet.map((e) => e.detail.taksim.source).sort()).toEqual(input.cycle.sensorFootprints.filter((f) => f.geometry).map((f) => f.platformId).sort());
      const rates = of(view, "rate").filter((e) => e.detail.taksim.step === step);
      expect(rates.map((e) => e.uid).sort()).toEqual(input.cycle.rateMarks.map((m) => `TAKSIM-RATE-${m.id}`).sort());
      for (const r of rates) {
        expect(r.type).toBe(COT_TYPE_SPOT);
        expect(r.detail.remarks!.text).toMatch(/m\/min/);
      }
    }
  });

  it("chat events carry the GeoChat structure and the sender's room", () => {
    const chat = events.find((e) => e.type === COT_TYPE_CHAT && e.detail.taksim.source === "DR2")!;
    expect(chat.how).toBe("h-e");
    expect(chat.detail.chat).toMatchObject({ parent: "RootContactGroup", groupOwner: false, chatroom: "air", id: "air", senderCallsign: "DR2", chatgrp: { uid0: "TAKSIM-AIR-DR2", uid1: SELF_UID, id: "air" } });
    expect(chat.detail.linkRef).toEqual({ uid: "TAKSIM-AIR-DR2", type: "a-f-A-M-H-Q", relation: "p-p" });
    expect(chat.detail.remarks).toMatchObject({ source: "TAKSIM.TAKSIM-AIR-DR2", to: "air", time: chat.time });
    expect(geoChatUid("HÄTÄKESKUS", "x")).toBe("GeoChat.TAKSIM-SRC-HÄTÄKESKUS.command.x");
  });

  it("a bare render-tree bubble is timed by its provenance; English roster remarks on request", () => {
    const input = inputs.find((i) => i.cycle.index === 3)!;
    const bubble = (input.bubbles[0] as { atom: import("../../app/boundary/render-boundary.js").RenderableAtom }).atom;
    const out = compileViewCot({ ...input, bubbles: [bubble], chatLines: [], lang: "en" });
    const chat = out.find((e) => e.type === COT_TYPE_CHAT)!;
    expect(chat.time).toBe(isoOfVirtual(bubble.provenance.deliveredAt ?? bubble.provenance.observedAt));
    expect(out.find((e) => e.uid === "TAKSIM-UNIT-EK11")!.detail.remarks!.text).toMatch(/^Rescue unit \+ tanker · crew 1\+5 · Task: /);
    expect(out.find((e) => e.uid === SELF_UID)!.detail.remarks!.text).toMatch(/^Incident commander \(you\), command post · wind from \d+°/);
  });
});
