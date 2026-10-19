/**
 * `probe_option_hovered` and `probe_answer_changed` (SPEC/30 §5.4): every change before sending with its `from`, the new
 * answer shown only once its record is durable (I5), a refused write retried as a change; hovers on mouse and pen only.
 * The freeze screen and the visible-probe card are checked at the source (hooks: no DOM in these tests), and through a
 * real session that the records reach the log gapless.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { areaAnswer, ProbeAnswerTracker } from "../../app/render/ui/probe-telemetry.js";
import { interactionLog, type InteractionEvent } from "../../app/render/ui/interaction-log.js";
import { assertGapless } from "../../app/telemetry/log.js";
import { runThrough } from "../session/session-run.js";

/** A log whose writes the test resolves or refuses by hand. */
function heldLog() {
  const writes: { event: InteractionEvent; resolve: () => void; reject: () => void }[] = [];
  const log = (event: InteractionEvent) => new Promise<unknown>((resolve, reject) => { writes.push({ event, resolve: () => resolve(undefined), reject: () => reject(new Error("refused")) }); });
  return { log, writes };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("ProbeAnswerTracker", () => {
  it("logs each change with its from, and shows it only once the record is durable", async () => {
    const { log, writes } = heldLog();
    const a = new ProbeAnswerTracker(log);
    const shown: string[] = [];
    a.changed("freeze.4.growth_next", "m5_15", () => shown.push("m5_15"));
    a.changed("freeze.4.growth_next", "lt5", () => shown.push("lt5"));
    expect(writes.map((w) => w.event)).toEqual([
      { kind: "probe_answer_changed", detail: { probeId: "freeze.4.growth_next", from: null, to: "m5_15" } },
      { kind: "probe_answer_changed", detail: { probeId: "freeze.4.growth_next", from: "m5_15", to: "lt5" } },
    ]);
    expect(shown).toEqual([]);
    writes[0]!.resolve(); writes[1]!.resolve();
    await flush();
    expect(shown).toEqual(["m5_15", "lt5"]);
    a.changed("freeze.4.growth_next", "lt5", () => shown.push("same"));
    expect(writes).toHaveLength(2); // choosing the answer already chosen logs nothing
    expect(shown.at(-1)).toBe("same");
  });

  it("leaves the answer as it was when the write is refused, so a retry is logged as the same change", async () => {
    const { log, writes } = heldLog();
    const a = new ProbeAnswerTracker(log);
    const shown: string[] = [];
    a.changed("probe.u.cycle_14", "b", () => shown.push("b"));
    writes[0]!.reject();
    await flush();
    expect(shown).toEqual([]);
    expect(a.current("probe.u.cycle_14")).toBeNull();
    a.changed("probe.u.cycle_14", "b", () => shown.push("b"));
    expect(writes[1]!.event).toEqual({ kind: "probe_answer_changed", detail: { probeId: "probe.u.cycle_14", from: null, to: "b" } });
  });

  it("logs a hover by mouse or pen, never by touch", () => {
    const { log, writes } = heldLog();
    const a = new ProbeAnswerTracker(log);
    a.hovered("freeze.2.fuel_ahead", "spruce", "mouse");
    a.hovered("freeze.2.fuel_ahead", "birch", "touch");
    a.hovered("freeze.2.fuel_ahead", "bog", "pen");
    expect(writes.map((w) => w.event)).toEqual([
      { kind: "probe_option_hovered", detail: { probeId: "freeze.2.fuel_ahead", optionId: "spruce" } },
      { kind: "probe_option_hovered", detail: { probeId: "freeze.2.fuel_ahead", optionId: "bog" } },
    ]);
  });

  it("writes the area item's answer as one value", () => {
    expect(areaAnswer(false, ["north_edge"])).toBe("no");
    expect(areaAnswer(true, [])).toBe("yes");
    expect(areaAnswer(true, ["north_edge", "other"])).toBe("yes:north_edge+other");
  });
});

describe("the screens' wiring (source)", () => {
  const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");

  it("the freeze screen logs a choice item's hovers and changes by the item's id, and shows a change once durable", () => {
    const s = src("FreezeScreen.tsx");
    expect(s).toMatch(/onPointerEnter=\{\(e\) => answers\.current!\.hovered\(item\.id, opt\.id, e\.pointerType\)\}/);
    expect(s).toMatch(/onChange=\{\(\) => answers\.current!\.changed\(item\.id, opt\.id, \(\) => update\(item\.id, \{ optionId: opt\.id \}\)\)\}/);
    expect(s).not.toMatch(/\bcorrect\b|keyStatements|mapKey/);
  });

  it("the visible-probe card logs its options' hovers and every answer form's changes", () => {
    const s = src("VisibleProbeCard.tsx");
    expect(s).toMatch(/onClick=\{\(\) => changed\(o\.id, \(\) => setChoice\(o\.id\)\)\}/);
    expect(s).toMatch(/changed\(areaAnswer\(true, next\), \(\) => setAreas\(next\)\)/);
    expect(s).toMatch(/onChange=\{\(c\) => changed\(String\(c\), \(\) => setConfidence\(c\)\)\}/);
    expect((s.match(/<Hover /g) ?? []).length).toBe(4);
  });
});

describe("through the session's log", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => vi.useRealTimers());

  it("every interaction kind is appended durably and gapless, in order", async () => {
    const { o } = await runThrough(-1);
    const before = (await o.logRecords()).length;
    const log = interactionLog(o);
    const events: InteractionEvent[] = [
      { kind: "pointer_track", detail: { x: 10, y: 20, cycle: 1, viewportPx: [1280, 720] } },
      { kind: "query_focus", detail: { field: "haku_chat", cycle: 1 } },
      { kind: "query_first_keystroke", detail: { field: "haku_chat", cycle: 1 } },
      { kind: "query_edit", detail: { count: 3, field: "haku_chat", cycle: 1 } },
      { kind: "probe_option_hovered", detail: { probeId: "freeze.2.fuel_ahead", optionId: "spruce" } },
      { kind: "probe_answer_changed", detail: { probeId: "freeze.2.fuel_ahead", from: null, to: "spruce" } },
      { kind: "frame_stats", detail: { cycle: 1, medianFrameTimeMs: 16.7, longTaskCount: 0 } },
    ];
    for (const e of events) await log(e);
    const records = await o.logRecords();
    assertGapless(records);
    expect(records.slice(before).map((r) => ({ kind: r.kind, detail: r.detail }))).toEqual(events);
  });
});
