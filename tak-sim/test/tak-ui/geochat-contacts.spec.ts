/**
 * SPEC/28 §5 GeoChat and Contacts, on a real session's snapshot: the message log grouped into rooms by source ("All Chat
 * Rooms" first) with every message kept as it is — its wording, time and source, in the log's order — and the Contacts
 * list built from the map's renderable units and aircraft, with what the participant has been told of each. No battery
 * level in Contacts or Video (QA 13 Oct 2026): the drones' battery reports are Haku-only records.
 */

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CHAT_ROOMS, chatRoomOf } from "../../app/tak/geochat.js";
import { geoChatRooms, GEOCHAT_ROOM_ORDER, lastReportOf, takContacts, contactUid } from "../../app/render/ui/tak/shell.js";
import { sidcOf, SELF_UID } from "../../app/tak/symbols.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { assertNoTruthKeysPresent } from "../../app/boundary/render-boundary.js";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { runThrough } from "../session/session-run.js";

const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

let snap: SessionSnapshot;
beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const s = await runThrough(5); // VP and V1–V5 completed: V6's log on screen
  snap = s.snap();
}, 60_000);
afterAll(() => vi.useRealTimers());

describe("GeoChat groups the real message log by source", () => {
  it("has a real log to group (sanity: many messages, several sources, every room but possibly one in use)", () => {
    expect(snap.radioLog.length).toBeGreaterThan(40);
    expect(new Set(snap.radioLog.map((e) => e.from)).size).toBeGreaterThan(5);
    const used = new Set(snap.radioLog.map((e) => chatRoomOf(e.from)));
    expect(used.size).toBeGreaterThanOrEqual(3);
  });

  it("lists All Chat Rooms first, then the rooms in `app/tak/geochat.ts`'s order", () => {
    const rooms = geoChatRooms(snap.radioLog);
    expect(rooms.map((r) => r.room)).toEqual(["all", ...CHAT_ROOMS]);
    expect(GEOCHAT_ROOM_ORDER[0]).toBe("all");
  });

  it("All Chat Rooms holds the whole log, the same objects, in the same order", () => {
    const all = geoChatRooms(snap.radioLog)[0]!;
    expect(all.entries.length).toBe(snap.radioLog.length);
    all.entries.forEach((x, i) => { expect(x.index).toBe(i); expect(x.entry).toBe(snap.radioLog[i]); });
  });

  it("every message is in exactly one source room — the room of its source — unchanged, in the log's order", () => {
    const rooms = geoChatRooms(snap.radioLog).slice(1);
    const seen = new Map<number, string>();
    for (const r of rooms) {
      let last = -1;
      for (const { entry, index } of r.entries) {
        expect(seen.has(index), `message ${index} in two rooms`).toBe(false);
        seen.set(index, r.room);
        expect(entry).toBe(snap.radioLog[index]); // wording, time and source: the log's own object
        expect(chatRoomOf(entry.from)).toBe(r.room);
        expect(index).toBeGreaterThan(last);
        last = index;
      }
    }
    expect(seen.size).toBe(snap.radioLog.length);
  });

  it("puts the duty officer in Command, the drones in Air, the rescue units in Ground and the weather in Support", () => {
    expect(chatRoomOf("P2")).toBe("command");
    expect(chatRoomOf("DR1")).toBe("air");
    expect(chatRoomOf("EK11")).toBe("ground");
    expect(chatRoomOf("VPK")).toBe("ground");
    expect(chatRoomOf("SAA")).toBe("support");
    const byRoom = new Map(geoChatRooms(snap.radioLog).map((r) => [r.room, r.entries.map((x) => x.entry.from)]));
    for (const from of byRoom.get("ground") ?? []) expect(from).toMatch(/^(EK\d+|KY\d+|OUT\d+|VPK|UGV\d+)$/);
  });

  it("the pane shows each message through the classic log's own row and has no input (nobody can message a unit)", () => {
    const pane = code("app/render/ui/tak/GeoChatPane.tsx");
    expect(pane).toMatch(/import \{ MessageLogRow \} from "\.\.\/components\/RightPanel\.js";/);
    expect(pane).toMatch(/<MessageLogRow key=\{index\} entry=\{entry\} wrapSource \/>/);
    expect(pane).not.toMatch(/<input|<textarea|contentEditable/);
    expect(code("app/render/ui/components/RightPanel.tsx")).toMatch(/\{snapshot\.radioLog\.map\(\(entry, i\) => <MessageLogRow key=\{i\} entry=\{entry\} \/>\)\}/);
  });

  it("names the rooms with geochat.ts's own labels in both languages", () => {
    expect(UI_TEXT.en.tak.geochat.rooms).toEqual({ all: "All Chat Rooms", ground: "Ground units", air: "Air & drones", command: "Command", support: "Support & weather" });
    expect(UI_TEXT.fi.tak.geochat.rooms.all).toBe("Kaikki keskustelut");
  });

  it("the room tabs control a tab panel labelled by the room shown (ARIA tabs pattern)", () => {
    const pane = code("app/render/ui/tak/GeoChatPane.tsx");
    expect(pane).toMatch(/role="tablist"/);
    expect(pane).toMatch(/role="tab" id=\{roomTabId\(r\.room\)\} aria-controls=\{ROOM_PANEL_ID\} aria-selected=\{active\}/);
    expect(pane).toMatch(/role="tabpanel" id=\{ROOM_PANEL_ID\} aria-labelledby=\{roomTabId\(shown\.room\)\}/);
    expect(readFileSync("app/render/ui/tak/GeoChatPane.tsx", "utf8")).toMatch(/const roomTabId = \(room: GeoChatRoomId\) => `tak-room-tab-\$\{room\}`;/);
  });
});

describe("Contacts from the map's units and aircraft", () => {
  const self = { at: { lat: 60.852466, lon: 27.33127 }, callsign: "IC", role: "Incident commander · command post" };

  it("lists self first, then every ground unit and aircraft on the map, with the CoT uid and 2525 SIDC of SPEC/28 §3–§4", () => {
    const cycle = snap.renderTree.cycleInfo!;
    const list = takContacts(cycle, snap.radioLog, "en", self);
    expect(list[0]).toMatchObject({ uid: SELF_UID, kind: "self", callsign: "IC" });
    const ground = list.filter((c) => c.kind === "ground"), air = list.filter((c) => c.kind === "air");
    expect(ground.map((c) => c.id)).toEqual(Object.keys(cycle.unitPositions).sort());
    expect(air.map((c) => c.id).sort()).toEqual(cycle.aircraft.map((a) => a.platformId).sort());
    for (const c of ground) { expect(c.uid).toBe(contactUid(c.id, false)); expect(c.uid).toMatch(/^TAKSIM-UNIT-/); expect(c.sidc).toBe(sidcOf(c.id)); expect(c.at).toEqual(cycle.unitPositions[c.id]); }
    for (const c of air) { expect(c.uid).toMatch(/^TAKSIM-AIR-/); expect(c.sidc).toBe(sidcOf(c.id)); }
    expect(list.length).toBe(1 + ground.length + air.length);
    assertNoTruthKeysPresent(list);
  });

  it("carries the task and water the map shows, and the time of the last message the participant was told", () => {
    const cycle = snap.renderTree.cycleInfo!;
    const list = takContacts(cycle, snap.radioLog, "en", self);
    for (const c of list.filter((x) => x.kind === "ground")) {
      const w = cycle.unitWork[c.id];
      expect(c.waterPct).toBe(typeof w?.waterPct === "number" ? w.waterPct : null);
      if (w) expect(c.task).toBeTruthy();
      expect(c.lastReport).toBe(lastReportOf(snap.radioLog, c.id));
    }
    const log = [
      { clockLabel: "13:30", from: "DR1", text: "DR1 anturiloki: korkeus 120 m, akku 21 %, viimeisin kuva klo 13.30." },
      { clockLabel: "13:50", from: "DR1", text: "DR1 anturiloki: akku 58 %." },
    ];
    expect(lastReportOf(log, "DR1")).toBe("13:50");
    expect(lastReportOf(log, "DR2")).toBeNull();
  });

  it("shows no battery level: not in a contact, not in Contacts or Video, not in their strings (Haku-only records)", () => {
    // A log that does carry a battery report (as a Haku answer might): the contact still has no battery.
    const log = [...snap.radioLog, { clockLabel: "13:50", from: "DR1", text: "DR1 anturiloki: akku 58 %." }];
    const list = takContacts(snap.renderTree.cycleInfo!, log, "en", self);
    for (const c of list) expect(c).not.toHaveProperty("battery");
    expect(JSON.stringify(list)).not.toMatch(/battery|akku/i);
    for (const f of ["shell.ts", "ContactsPane.tsx", "VideoPane.tsx", "TakSessionLayout.tsx"]) {
      expect(code(`app/render/ui/tak/${f}`), f).not.toMatch(/battery|latestBattery|akku/i);
    }
    for (const lang of ["fi", "en"] as const) {
      expect(UI_TEXT[lang].tak.contacts).not.toHaveProperty("battery");
      expect(UI_TEXT[lang].tak.video).not.toHaveProperty("battery");
    }
    // Video no longer reads the message log at all.
    expect(code("app/render/ui/tak/VideoPane.tsx")).not.toMatch(/RadioLogEntry|\blog\b/);
  });

  it("selecting a contact is logged first, then the map is centred as the participant's own move", () => {
    const t = code("app/render/ui/tak/TakSessionLayout.tsx");
    expect(t).toMatch(/log\(\{ kind: "tak_contact_selected", detail: \{ uid: c\.uid, view \} \}\);\s*if \(handle\) \{ handle\.markParticipantMove\(\); handle\.map\.jumpTo\(\{ center: \[c\.at\.lon, c\.at\.lat\] \}\); \}/);
  });
});
