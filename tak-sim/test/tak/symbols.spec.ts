/**
 * SPEC/28 §4 (type mapping) and §5 (GeoChat rooms): `app/tak/symbols.ts` and `app/tak/geochat.ts`.
 */

import { describe, expect, it } from "vitest";
import { ALL_CHAT_ROOMS_LABEL, CHAT_ROOM_LABEL, CHAT_ROOMS, chatRoomOf } from "../../app/tak/geochat.js";
import {
  COT_TYPE_BY_KIND, COT_TYPE_CHAT, COT_TYPE_DRAWING, COT_TYPE_SPOT, cotTypeOf, SELF_COT_TYPE, SELF_SIDC, SELF_UID, sidcOf, sidcOfCotType, takKindOf,
} from "../../app/tak/symbols.js";
import { UNIT_ROSTER } from "../../app/render/ui/unit-roster.js";
import { sortedKeys } from "../../app/engine/deterministic-object.js";

describe("CoT type and 2525C SIDC per object (SPEC/28 §4 table)", () => {
  const TABLE: readonly (readonly [string, string, string])[] = [
    ["EK11", "a-f-G-E-V", "SFGPEV---------"],
    ["KY21", "a-f-G-E-V", "SFGPEV---------"],
    ["VPK", "a-f-G-E-V", "SFGPEV---------"],
    ["OUT1", "a-f-G-E-V", "SFGPEV---------"],
    ["EK13", "a-f-G-E-V", "SFGPEV---------"], // the water shuttle: remarks say shuttle
    ["UGV1", "a-f-G-E-X", "SFGPEX---------"],
    ["DR1", "a-f-A-M-H-Q", "SFAPMHQ--------"],
    ["DR2", "a-f-A-M-H-Q", "SFAPMHQ--------"],
    ["VD1", "a-f-A-M-H-Q", "SFAPMHQ--------"],
    ["DR3", "a-f-A-M-F-Q", "SFAPMFQ--------"],
    ["HELI1", "a-f-A-C-H", "SFAPCH---------"],
    ["SPOT", "a-f-A-C-F", "SFAPCF---------"],
  ];

  it.each(TABLE)("%s → %s / %s", (id, type, sidc) => {
    expect(cotTypeOf(id)).toBe(type);
    expect(sidcOf(id)).toBe(sidc);
    expect(sidcOfCotType(type)).toBe(sidc);
  });

  it("the participant is the command post: a-f-G-U-C, drawn as a headquarters SFGPU-----A----", () => {
    expect(SELF_COT_TYPE).toBe("a-f-G-U-C");
    expect(SELF_SIDC).toBe("SFGPU-----A----");
    expect(SELF_UID).toBe("TAKSIM-SELF");
  });

  it("every roster platform has a kind and a 15-character SIDC; an unknown id is a ground vehicle", () => {
    for (const id of sortedKeys(UNIT_ROSTER)) {
      expect(COT_TYPE_BY_KIND[takKindOf(id)]).toBe(cotTypeOf(id));
      expect(sidcOf(id)).toMatch(/^S[A-Z][A-Z]P[A-Z-]{11}$/);
    }
    expect(takKindOf("EK99")).toBe("ground_vehicle");
  });

  it("drawings, spot markers and chat are not atoms (no SIDC); other affiliations map by letter", () => {
    expect(COT_TYPE_DRAWING).toBe("u-d-f");
    expect(COT_TYPE_SPOT).toBe("b-m-p-s-m");
    expect(COT_TYPE_CHAT).toBe("b-t-f");
    for (const t of [COT_TYPE_DRAWING, COT_TYPE_SPOT, COT_TYPE_CHAT, "a-f"]) expect(sidcOfCotType(t)).toBeNull();
    expect(sidcOfCotType("a-h-G")).toBe("SHGP-----------");
    expect(sidcOfCotType("a-x-G-U")).toBe("SUGPU----------");
  });
});

describe("chatRoomOf (SPEC/28 §5: rooms by source, not by sector)", () => {
  it.each([
    ["EK11", "ground"], ["EK16", "ground"], ["KY23", "ground"], ["OUT2", "ground"], ["VPK", "ground"], ["UGV1", "ground"],
    ["DR1", "air"], ["DR3", "air"], ["VD1", "air"], ["SPOT", "air"], ["HELI1", "air"], ["DRONERYHMÄ", "air"],
    ["P2", "command"], ["P3", "command"], ["TILANNEKUVA", "command"], ["HÄTÄKESKUS", "command"], ["JÄLKIVARTIO", "command"],
    ["SAA", "support"], ["POLIISI", "support"], ["JOHTOPAIKKA", "support"], ["register", "support"], ["", "support"],
  ] as const)("%s → %s", (source, room) => {
    expect(chatRoomOf(source)).toBe(room);
  });

  it("ignores case and surrounding space", () => {
    expect(chatRoomOf(" ek11 ")).toBe("ground");
    expect(chatRoomOf("dr2")).toBe("air");
    expect(chatRoomOf("häTäkeskus")).toBe("command");
  });

  it("lists four rooms in pane order, each labelled in both languages", () => {
    expect(CHAT_ROOMS).toEqual(["ground", "air", "command", "support"]);
    for (const room of CHAT_ROOMS) {
      expect(CHAT_ROOM_LABEL[room].fi).not.toBe("");
      expect(CHAT_ROOM_LABEL[room].en).not.toBe("");
    }
    expect(ALL_CHAT_ROOMS_LABEL.en).toBe("All Chat Rooms");
  });
});
