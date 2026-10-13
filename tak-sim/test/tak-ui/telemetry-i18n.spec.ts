/**
 * SPEC/28 §5: every TAK tool interaction is logged through `logMapUse` with a `tak_*` kind — panes opened and closed,
 * contacts selected, overlays toggled, R&B measurements, chat rooms and video tiles viewed — durably, gapless, as the map's
 * own records are (I5). And every TAK string is in both languages (the study runs in English, Finnish is the original).
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_RECORD_KINDS } from "../../app/telemetry/record-kinds.js";
import { assertGapless } from "../../app/telemetry/log.js";
import type { MapUseEvent } from "../../app/session/orchestrator.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { TAK_PANE_ORDER, TAK_OVERLAY_LAYERS } from "../../app/render/ui/tak/shell.js";
import { runThrough } from "../session/session-run.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const TAK_KINDS = ["tak_pane_opened", "tak_pane_closed", "tak_contact_selected", "tak_overlay_toggled", "tak_rb_measured", "tak_chat_room_viewed", "tak_video_viewed"] as const;
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** One record of each kind, typed as the map-use records `logMapUse` takes (a missing field is a compile error). */
const EVENTS: readonly MapUseEvent[] = [
  { kind: "tak_pane_opened", detail: { pane: "geochat", view: 0, cause: "default" } },
  { kind: "tak_pane_closed", detail: { pane: "geochat", view: 0, cause: "replaced" } },
  { kind: "tak_pane_opened", detail: { pane: "contacts", view: 0, cause: "toolbar" } },
  { kind: "tak_contact_selected", detail: { uid: "TAKSIM-UNIT-EK11", view: 0 } },
  { kind: "tak_overlay_toggled", detail: { layer: "labels", on: false, view: 0 } },
  { kind: "tak_rb_measured", detail: { from: { lat: 60.85, lon: 27.33 }, to: { lat: 60.86, lon: 27.35 }, metres: 1556.7, bearingDeg: 44.28, view: 0 } },
  { kind: "tak_chat_room_viewed", detail: { room: "all", view: 0 } },
  { kind: "tak_video_viewed", detail: { platformId: "DR1", view: 0, cause: "pane" } },
];

describe("the tak_* records", () => {
  it("are declared record kinds", () => {
    for (const k of TAK_KINDS) expect(ALL_RECORD_KINDS).toContain(k);
  });

  it("go through logMapUse into the session log, durably and gapless, each with its seq", async () => {
    const { o } = await runThrough(-1);
    const before = (await o.logRecords()).length;
    const seqs: number[] = [];
    for (const e of EVENTS) seqs.push(await o.logMapUse(e));
    const records = await o.logRecords();
    assertGapless(records);
    const added = records.slice(before);
    expect(added.map((r) => r.kind)).toEqual(EVENTS.map((e) => e.kind));
    expect(added.map((r) => r.seq)).toEqual(seqs);
    added.forEach((r, i) => expect(r.detail).toEqual(EVENTS[i]!.detail));
  });

  it("each kind has an emitter in the shell (source)", () => {
    const t = code("app/render/ui/tak/TakSessionLayout.tsx");
    for (const k of TAK_KINDS) expect(t, k).toContain(`kind: "${k}"`);
    // Opening and closing a search tool also writes the classic right panel's tab record.
    expect(t).toMatch(/void orchestrator\.logTabSelected\(tool\)/);
    // The map component of the shell keeps the classic map's own map-use records.
    expect(t).toMatch(/onMapUse=\{\(e\) => orchestrator\.logMapUse\(e\)\}/);
  });
});

describe("TAK strings in both languages", () => {
  /** Every string (and function result) of a value, with its path. */
  function strings(v: unknown, path = "", out: [string, string][] = []): [string, string][] {
    if (typeof v === "string") out.push([path, v]);
    else if (typeof v === "function") out.push([path, String((v as (n: number) => string)(3))]);
    else if (v && typeof v === "object") for (const k of Object.keys(v).sort()) strings((v as Record<string, unknown>)[k], `${path}.${k}`, out);
    return out;
  }
  const fi = strings(UI_TEXT.fi.tak), en = strings(UI_TEXT.en.tak);

  it("has the same keys in Finnish and English, and every pane and overlay named in both", () => {
    expect(fi.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const lang of ["fi", "en"] as const) {
      for (const p of TAK_PANE_ORDER) { expect(UI_TEXT[lang].tak.toolbar[p]).toBeTruthy(); expect(UI_TEXT[lang].tak.paneTitle[p]).toBeTruthy(); }
      for (const l of TAK_OVERLAY_LAYERS) expect(UI_TEXT[lang].tak.overlays.layers[l]).toBeTruthy();
    }
  });

  it("every string is filled in and English has no Finnish letters", () => {
    for (const [p, s] of [...fi, ...en]) expect(s.trim(), p).not.toBe("");
    for (const [p, s] of en) expect(s, p).not.toMatch(/[äöåÄÖÅ]/);
  });

  it("the toolbar's labels are short enough for its 76 px buttons", () => {
    for (const lang of ["fi", "en"] as const) for (const p of TAK_PANE_ORDER) expect(UI_TEXT[lang].tak.toolbar[p].length, p).toBeLessThanOrEqual(9);
  });

  it("the shell's components take their words from the language layer, not literals", () => {
    for (const f of ["TakToolbar.tsx", "TakSidePane.tsx", "GeoChatPane.tsx", "ContactsPane.tsx", "OverlayManagerPane.tsx", "VideoPane.tsx", "RangeBearingPane.tsx", "TakMapChrome.tsx"]) {
      const src = code(`app/render/ui/tak/${f}`);
      expect(src, f).toMatch(/useLang\(\)/);
      // No English or Finnish words written straight into the markup.
      expect(src.match(/>\s*[A-Za-zÄÖäö][a-zäö]+(\s+[a-zäö]+){1,}\s*</g) ?? [], f).toEqual([]);
    }
  });
});
