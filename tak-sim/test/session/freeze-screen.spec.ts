/**
 * `31` §3.8, §3.9, F12, F13 (19 Oct 2026): what the screen gets at a freeze. The items reach it through a whitelist (`screenFreezeItem`): no
 * key, key record, key statement, element pattern, lure statement, basis, family, retrieval flag or fire-model band — analysis metadata
 * stays in the scenario. The header states "now", the screen's clock at the freeze (`freezeNowLabel`; V10 17.40, V12 19.00, V14 20.00 at
 * the view's end). An 8-item freeze closes at 240 s, a shorter one at 180 s (`freezeMaxSecondsFor`).
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeNowClock, screenFreezeItem } from "../../app/session/freeze-answers.js";
import { nowStepOf } from "../../app/scenario/freeze-bank-core.js";
import { stepStartMin } from "../../app/scenario/freeze-keys.js";
import { FREEZE_AT_VIEW_END, freezeMaxSecondsFor, MAIN_VIEWS } from "../../app/scenario/views.js";
import { FREEZE_VIEWS } from "../../app/scenario/demo-probes.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { atView, ofKind, scenario, settle } from "./spec30-helpers.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const SCREEN_KEYS = new Set(["id", "level", "promptFi", "kind", "options"]);
/** An analysis-only or TRUTH field as a JSON property name (the snapshot's own `correction` is not one). */
const ANALYSIS_ONLY = /"(?:keyStatements|elementPatterns|lureStatements|basisKind|basisAtomIds|basisSteps|truthOptionId|family|retrievalDependent|keyAtomIds|mapKey|correct|projectionOption)":/;
const clock = (min: number) => `${Math.floor(min / 60)}.${String(min % 60).padStart(2, "0")}`;

describe("the screen's freeze items (`31` §3.9): a whitelist", () => {
  it("keeps only id, level, prompt, kind and the options' ids and labels, for every item of every freeze", () => {
    for (const f of [...scenario.freezes, scenario.practice.freeze]) for (const it of f.items) {
      const s = screenFreezeItem(it);
      for (const k of Object.keys(s)) expect(SCREEN_KEYS.has(k), `${it.id}: ${k}`).toBe(true);
      for (const o of s.options) expect(Object.keys(o).sort(), it.id).toEqual(["id", "labelFi"]);
      expect(JSON.stringify(s), it.id).not.toMatch(ANALYSIS_ONLY);
    }
    // The bank does carry the metadata the whitelist keeps out (else this test would be vacuous).
    const all = scenario.freezes.flatMap((f) => f.items);
    for (const field of ["keyStatements", "elementPatterns", "lureStatements", "basisKind", "basisAtomIds", "family", "retrievalDependent"] as const) {
      expect(all.some((it) => it[field] !== undefined), field).toBe(true);
    }
  });

  it("in the running session: V5's freeze (8 items) reaches the snapshot without any of it", async () => {
    const { o, snap } = await atView(5);
    await vi.advanceTimersByTimeAsync(scenario.cycles.find((c) => c.index === 5)!.freezeAtSeconds! * 1000);
    await settle();
    expect(snap().step).toBe("freeze");
    const items = snap().freeze!.items;
    expect(items).toHaveLength(8);
    expect(JSON.stringify(snap())).not.toMatch(ANALYSIS_ONLY);
    for (const it of items) for (const k of Object.keys(it)) expect(SCREEN_KEYS.has(k), `${it.id}: ${k}`).toBe(true);
    expect(o.freezeNowLabel()).toBe(clock(stepStartMin(nowStepOf(5)))); // F13: the header's "now"
  });
});

describe("the freeze header's now (`31` F13, §3.8)", () => {
  it("is the start of the view's last step, or the view's end for V10, V12 and V14 — the clock the L3 horizons count from", () => {
    const labels = Object.fromEntries([...FREEZE_VIEWS].sort((a, b) => a - b).map((v) => {
      const view = MAIN_VIEWS.find((x) => x.index === v)!;
      const label = freezeNowClock(stepStartMin(view.steps[0]!), view.steps.length, FREEZE_AT_VIEW_END.has(v));
      expect(label, `V${v}`).toBe(clock(stepStartMin(nowStepOf(v))));
      return [v, label];
    }));
    expect(labels).toMatchObject({ 10: "17.40", 12: "19.00", 14: "20.00" });
  });

  it("is stated in both languages, and the screen shows it (source)", () => {
    expect(UI_TEXT.fi.freezeNow("19.00")).toMatch(/19\.00/);
    expect(UI_TEXT.en.freezeNow("19.00")).toMatch(/19\.00/);
    const src = readFileSync(new URL("../../app/render/ui/components/FreezeScreen.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/freezeNowLabel\(\)/);
    expect(src).toMatch(/data-testid="freeze-now"/);
  });
});

describe("the freeze's cap (`31` F12)", () => {
  it("is 240 s for a freeze of 8 items or more, else 180 s", () => {
    expect(freezeMaxSecondsFor(8)).toBe(240);
    expect(freezeMaxSecondsFor(6)).toBe(180);
    expect(freezeMaxSecondsFor(4)).toBe(180);
  });

  it("in the running session: V5's 8-item freeze is still open at 180 s and closes, timed out, at 240 s", async () => {
    const { o, snap } = await atView(5);
    await vi.advanceTimersByTimeAsync(scenario.cycles.find((c) => c.index === 5)!.freezeAtSeconds! * 1000);
    await settle();
    expect(snap().step).toBe("freeze");
    await vi.advanceTimersByTimeAsync(180_000);
    expect(snap().step).toBe("freeze");
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();
    expect(snap().step).not.toBe("freeze");
    expect(ofKind(await o.logRecords(), "freeze_submitted", 5).map((r) => (r.detail as { timedOut?: true }).timedOut)).toEqual([true]);
  });
});
