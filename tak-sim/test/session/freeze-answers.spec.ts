/**
 * The freeze's answers at the boundary (SPEC/15 r.12): map items (a point inside the extent), no
 * source question (withdrawn 2 Oct 2026), and the screen's drafts. Uses a fake practice freeze with a
 * `map_point` item, so it does not depend on the freeze content being rewritten in parallel.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { FreezeItem, ScenarioContract } from "../../app/scenario/types.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { checkFreezeResponses, draftComplete, insideExtent, MAP_POINT_OPTION_ID, responsesFromDrafts, skippedResponses } from "../../app/session/freeze-answers.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { FREEZE_MAX_SECONDS } from "../../app/scenario/views.js";
import type { FreezeSubmittedDetail } from "../../app/telemetry/record-kinds.js";
import { freezeItemScores } from "../../app/telemetry/freeze-measures.js";
import { freezeMissing, MAX_MISSING_SHARE_PER_FREEZE, viewsExcludedFromSa } from "../../app/telemetry/exclusions.js";

const base = buildDemoScenario();
const ext = base.extent;
const centre = { lat: (ext.south + ext.north) / 2, lon: (ext.west + ext.east) / 2 };
const opts = (prefix: string) => ["a", "b", "c", "d"].map((id) => ({ id, labelFi: `${prefix} ${id}`, correct: id === "a" }));

const ITEMS: FreezeItem[] = [
  { id: "t.l1", level: "L1", promptFi: "Missä EK11 on?", options: opts("L1") },
  { id: "t.l2", level: "L2", promptFi: "Mikä uhkaa?", options: opts("L2") },
  { id: "t.map1", level: "L1", kind: "map_point", promptFi: "Napauta EK11:n sijainti.", options: [], mapKey: { point: centre, toleranceM: 300 }, keyAtomIds: ["atom.x"] },
  { id: "t.map3", level: "L3", kind: "map_point", promptFi: "Mihin palo on 30 min päästä edennyt pisimmälle?", options: [], mapKey: { point: centre, toleranceM: 400 } },
];

const scenario: ScenarioContract = { ...base, practice: { ...base.practice, freeze: { ...base.practice.freeze, items: ITEMS } } };

describe("the freeze-answer rules", () => {
  it("a draft is complete with the answer (option or point) and the confidence, at every level", () => {
    expect(draftComplete(ITEMS[0]!, { optionId: "a", confidence: 50 })).toBe(true);
    expect(draftComplete(ITEMS[1]!, { optionId: "a", confidence: 50 })).toBe(true);
    expect(draftComplete(ITEMS[1]!, { optionId: "a" })).toBe(false);
    expect(draftComplete(ITEMS[2]!, { confidence: 50 })).toBe(false);
    expect(draftComplete(ITEMS[2]!, { point: centre, confidence: 50 })).toBe(true);
    expect(draftComplete(ITEMS[3]!, { point: centre, confidence: 50 })).toBe(true);
    expect(draftComplete(ITEMS[3]!, { point: centre })).toBe(false);
  });

  it("builds the responses the screen sends: map items as map_point with the point, no source anywhere", () => {
    const r = responsesFromDrafts(ITEMS, {
      "t.l1": { optionId: "b", confidence: 25 },
      "t.l2": { optionId: "c", confidence: 50 },
      "t.map1": { point: centre, confidence: 75 },
      "t.map3": { point: centre, confidence: 100 },
    });
    expect(r).toEqual([
      { itemId: "t.l1", optionId: "b", confidence: 25 },
      { itemId: "t.l2", optionId: "c", confidence: 50 },
      { itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 75, point: centre },
      { itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, confidence: 100, point: centre },
    ]);
  });

  it("a skipped freeze sends only the items answered in full (demonstration, 6 Oct 2026); a half-answered item is left out", () => {
    const drafts = { "t.l1": { optionId: "b", confidence: 25 }, "t.l2": { optionId: "c" }, "t.map1": { point: centre } };
    expect(skippedResponses(ITEMS, drafts)).toEqual([{ itemId: "t.l1", optionId: "b", confidence: 25 }]);
    expect(checkFreezeResponses(ITEMS, skippedResponses(ITEMS, drafts), ext)).toHaveLength(1);
    expect(skippedResponses(ITEMS, {})).toEqual([]);
  });

  it("refuses a map answer without a point, outside the extent, or with another option id", () => {
    const check = (r: object) => () => checkFreezeResponses(ITEMS, [{ itemId: "t.map1", confidence: 50, ...r } as never], ext);
    expect(check({ optionId: MAP_POINT_OPTION_ID })).toThrow(/inside the scenario extent/);
    expect(check({ optionId: MAP_POINT_OPTION_ID, point: { lat: ext.north + 0.01, lon: centre.lon } })).toThrow(/inside the scenario extent/);
    expect(check({ optionId: MAP_POINT_OPTION_ID, point: { lat: Number.NaN, lon: centre.lon } })).toThrow(/inside/);
    expect(check({ optionId: "a", point: centre })).toThrow(/map_point/);
    expect(check({ optionId: MAP_POINT_OPTION_ID, point: centre })()).toEqual([{ itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 50, point: centre }]);
    expect(insideExtent({ lat: ext.south, lon: ext.west }, ext)).toBe(true);
  });

  it("refuses a choice answer that is not one of its options, an unknown or repeated item, and a confidence off the scale", () => {
    const check = (rs: object[]) => () => checkFreezeResponses(ITEMS, rs as never, ext);
    expect(check([{ itemId: "t.l1", optionId: "e", confidence: 50 }])).toThrow(/no option/);
    expect(check([{ itemId: "t.nope", optionId: "a", confidence: 50 }])).toThrow(/not in this freeze/);
    expect(check([{ itemId: "t.l1", optionId: "a", confidence: 50 }, { itemId: "t.l1", optionId: "b", confidence: 50 }])).toThrow(/twice/);
    expect(check([{ itemId: "t.l1", optionId: "a", confidence: 60 }])).toThrow(/scale/);
  });

  it("asks no source: one sent with an answer is dropped, at any level", () => {
    const check = (r: object) => () => checkFreezeResponses(ITEMS, [{ confidence: 50, ...r } as never], ext);
    expect(check({ itemId: "t.l2", optionId: "a" })()).toEqual([{ itemId: "t.l2", optionId: "a", confidence: 50 }]);
    expect(check({ itemId: "t.l2", optionId: "a", source: "thinker" })()).toEqual([{ itemId: "t.l2", optionId: "a", confidence: 50 }]);
    expect(check({ itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, point: centre, source: "map" })()).toEqual([{ itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, confidence: 50, point: centre }]);
  });
});

describe("the orchestrator's freeze with a map item", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function inFreeze() {
    const o = new SessionOrchestrator(scenario, "directed", {});
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    return { o, snap: () => snap! };
  }

  it("never hands the screen a map item's key or the key atoms (TRUTH)", async () => {
    const { o, snap } = await inFreeze();
    expect(snap().freeze!.items.map((i) => i.id)).toEqual(ITEMS.map((i) => i.id));
    for (const item of snap().freeze!.items) {
      expect(item).not.toHaveProperty("mapKey");
      expect(item).not.toHaveProperty("keyAtomIds");
    }
    expect(snap().freeze!.items[2]!.kind).toBe("map_point");
    expect(o.mapExtent).toEqual(scenario.extent);
  });

  it("logs a valid submission with the point and no source; refuses an invalid one and stays in the freeze", async () => {
    const { o, snap } = await inFreeze();
    await expect(o.submitFreeze([{ itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 50, point: { lat: 0, lon: 0 } }])).rejects.toThrow(/extent/);
    expect(snap().step).toBe("freeze");
    await o.submitFreeze([
      { itemId: "t.l1", optionId: "a", confidence: 50, source: "map" },
      { itemId: "t.l2", optionId: "b", confidence: 75, source: "message_log" },
      { itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 25, point: centre },
      { itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, confidence: 100, point: centre },
    ]);
    expect(snap().step).toBe("allocation");
    const submitted = (await o.logRecords()).filter((r) => r.kind === "freeze_submitted");
    expect(submitted).toHaveLength(1);
    const timed = { answeredAtWallMs: expect.any(Number), msSinceFreezeOpened: expect.any(Number) };
    expect((submitted[0]!.detail as { responses: unknown }).responses).toEqual([
      { itemId: "t.l1", optionId: "a", confidence: 50, ...timed },
      { itemId: "t.l2", optionId: "b", confidence: 75, ...timed },
      { itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 25, point: centre, ...timed },
      { itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, confidence: 100, point: centre, ...timed },
    ]);
  });

  it("logs each item's answer moment: when the screen left it, the last one at the submission (P1-5, 7 Oct 2026)", async () => {
    const o = new SessionOrchestrator(scenario, "directed", { realClockMs: () => Date.now() });
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    const opened = (await o.logRecords()).find((r) => r.kind === "freeze_started")!.tWallOffsetMs;
    await vi.advanceTimersByTimeAsync(4_000); await o.markFreezeItemAnswered("t.l1");
    await vi.advanceTimersByTimeAsync(3_000); await o.markFreezeItemAnswered("t.l2");
    await vi.advanceTimersByTimeAsync(1_000); await o.markFreezeItemAnswered("t.l2"); // a repeat keeps the first moment
    await vi.advanceTimersByTimeAsync(5_000); await o.markFreezeItemAnswered("t.map1");
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(o.markFreezeItemAnswered("no.such.item")).rejects.toThrow(/no item/);
    // Fix pass 3: each moment is durable at once (a reload during the freeze keeps it).
    expect((await o.logRecords()).filter((r) => r.kind === "freeze_item_completed").map((r) => r.detail)).toEqual([
      { cycle: 0, itemId: "t.l1", msSinceFreezeOpened: 4_000 },
      { cycle: 0, itemId: "t.l2", msSinceFreezeOpened: 7_000 },
      { cycle: 0, itemId: "t.map1", msSinceFreezeOpened: 13_000 },
    ]);
    await o.submitFreeze([
      { itemId: "t.l1", optionId: "a", confidence: 50 },
      { itemId: "t.l2", optionId: "b", confidence: 75 },
      { itemId: "t.map1", optionId: MAP_POINT_OPTION_ID, confidence: 25, point: centre },
      { itemId: "t.map3", optionId: MAP_POINT_OPTION_ID, confidence: 100, point: centre },
    ]);
    const { responses } = (await o.logRecords()).find((r) => r.kind === "freeze_submitted")!.detail as { responses: { msSinceFreezeOpened: number; answeredAtWallMs: number }[] };
    expect(responses.map((r) => r.msSinceFreezeOpened)).toEqual([4_000, 7_000, 13_000, 15_000]);
    expect(responses.map((r) => r.answeredAtWallMs - opened)).toEqual([4_000, 7_000, 13_000, 15_000]);
  });
});

describe("the freeze screen's blank map (SPEC/08 §4 PROBING_BLANKED)", () => {
  const src = readFileSync("app/render/ui/components/FreezeMap.tsx", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("draws the basemap only: no fire, projection, units, aircraft or messages", () => {
    for (const forbidden of [/fire-layers/, /unit-markers/, /addFireLayers/, /renderTree/, /envelope/i, /perimeter/, /SessionSnapshot/, /bubble/i, /radioLog/, /Legend/, /WindIndicator/]) {
      expect(code, String(forbidden)).not.toMatch(forbidden);
    }
    expect(code).toMatch(/site-meta\.json/);
  });

  it("may be zoomed in and panned, out no further than the whole study area, within the basemap, and never rotated (revision (ap))", () => {
    for (const handler of ["boxZoom", "dragRotate", "keyboard", "touchZoomRotate"]) expect(code).toMatch(new RegExp(`${handler}: false`));
    expect(code).toMatch(/map\.setMinZoom\(Math\.min\(zoom, outermostZoom\(\)\)\);/);
    expect(code).toMatch(/maxBounds: BASEMAP_BOUNDS/);
  });

  it("has its hint in both languages", () => {
    expect(UI_TEXT.fi.freezeMapHint).toMatch(/Napauta/);
    expect(UI_TEXT.en.freezeMapHint).toMatch(/Tap/);
  });
});

describe("the demonstration's freeze skip (6 Oct 2026)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function inFreeze(allowViewSkip: boolean) {
    const o = new SessionOrchestrator(scenario, "directed", { allowViewSkip });
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    return { o, snap: () => snap! };
  }

  it("accepts the items answered so far and logs the submission as skipped", async () => {
    const { o, snap } = await inFreeze(true);
    const partial = skippedResponses(ITEMS, { "t.l1": { optionId: "a", confidence: 50 }, "t.l2": { optionId: "b" } });
    await o.submitFreeze(partial, { skipped: true });
    expect(snap().step).toBe("allocation");
    const submitted = (await o.logRecords()).filter((r) => r.kind === "freeze_submitted").map((r) => r.detail);
    expect(submitted).toEqual([{ cycle: 0, responses: [{ itemId: "t.l1", optionId: "a", confidence: 50, answeredAtWallMs: expect.any(Number), msSinceFreezeOpened: expect.any(Number) }], skipped: true,
      missing: ["t.l2", "t.map1", "t.map3"] }]); // fix pass 7: the items not answered are logged missing
  });

  it("is refused without the demonstration option, and the freeze stays open; a plain submission carries no skipped flag", async () => {
    const { o, snap } = await inFreeze(false);
    await expect(o.submitFreeze([], { skipped: true })).rejects.toThrow(/demonstrations only/);
    expect(snap().step).toBe("freeze");
    await o.submitFreeze([]);
    const submitted = (await o.logRecords()).filter((r) => r.kind === "freeze_submitted").map((r) => r.detail);
    expect(submitted).toEqual([{ cycle: 0, responses: [], missing: ITEMS.map((it) => it.id) }]); // fix pass 7: missing, not wrong
  });

  it("the screen's skip sends `skippedResponses` with the skipped flag, not the full submission", () => {
    const code = readFileSync("app/render/ui/components/FreezeScreen.tsx", "utf8");
    expect(code).toMatch(/submitFreeze\(skippedResponses\(freeze\.items, drafts\), \{ skipped: true \}\)/);
    expect(code).toMatch(/data-testid="skip-freeze" disabled=\{sent\} onClick=\{skip\}/);
  });

  it("the screen notes an item's answer moment when it leaves the item with \"Seuraava\" (P1-5)", () => {
    const code = readFileSync("app/render/ui/components/FreezeScreen.tsx", "utf8");
    // Fix pass 7: with the confirmed answer, which the freeze's cap keeps.
    expect(code).toMatch(/else \{ void orchestrator\.markFreezeItemAnswered\(item\.id, responsesFromDrafts\(\[item\], drafts\)\[0\]\); setCurrent\(\(c\) => c \+ 1\); \}/);
  });
});

describe("the freeze's cap (fix pass 7, 9 Oct 2026, revision (ad))", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function inFreeze() {
    const o = new SessionOrchestrator(scenario, "directed", {});
    let snap: SessionSnapshot | null = null;
    o.subscribe((s) => (snap = s));
    await o.start();
    await vi.advanceTimersByTimeAsync(scenario.practice.cycle.freezeAtSeconds! * 1000);
    expect(snap!.step).toBe("freeze");
    return { o, snap: () => snap! };
  }

  it("closes the freeze at 180 s with the confirmed answers, logs every other item as missing and the submission as timed out", async () => {
    const { o, snap } = await inFreeze();
    await o.markFreezeItemAnswered("t.l1", { itemId: "t.l1", optionId: "b", confidence: 75 });
    await vi.advanceTimersByTimeAsync(FREEZE_MAX_SECONDS * 1000 - 10);
    expect(snap().step).toBe("freeze");
    await vi.advanceTimersByTimeAsync(10);
    expect(snap().step).not.toBe("freeze");
    const records = await o.logRecords();
    const submitted = records.filter((r) => r.kind === "freeze_submitted").map((r) => r.detail as FreezeSubmittedDetail);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]!.timedOut).toBe(true);
    expect(submitted[0]!.responses.map((r) => [r.itemId, r.optionId])).toEqual([["t.l1", "b"]]);
    expect(submitted[0]!.missing).toEqual(["t.l2", "t.map1", "t.map3"]);
    // Missing is not wrong: only the answered item is scored; 3 of 4 missing excludes the view's SA score (pre-registered, > half).
    expect(freezeItemScores(records, [scenario.practice.freeze!]).map((s) => s.itemId)).toEqual(["t.l1"]);
    expect(freezeMissing(records)).toEqual([{ view: 0, items: 4, missing: ["t.l2", "t.map1", "t.map3"], timedOut: true, excludedFromSa: true }]);
    expect(viewsExcludedFromSa(records)).toEqual([0]);
  });

  it("exactly half missing is kept; a submission before the cap stops it", async () => {
    const { o } = await inFreeze();
    await o.submitFreeze([{ itemId: "t.l1", optionId: "a", confidence: 50 }, { itemId: "t.l2", optionId: "a", confidence: 50 }]);
    await vi.advanceTimersByTimeAsync(FREEZE_MAX_SECONDS * 1000 + 1000);
    const records = await o.logRecords();
    expect(records.filter((r) => r.kind === "freeze_submitted")).toHaveLength(1);
    expect(freezeMissing(records)[0]).toMatchObject({ items: 4, timedOut: false, excludedFromSa: false });
    expect(viewsExcludedFromSa(records)).toEqual([]);
    expect(MAX_MISSING_SHARE_PER_FREEZE).toBe(0.5);
  });
});
