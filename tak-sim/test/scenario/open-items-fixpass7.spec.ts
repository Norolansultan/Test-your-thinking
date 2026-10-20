/**
 * Fix pass 7 (9 Oct 2026, revision (ad)): the researcher's open items of SPEC/11 §7.18 closed — the projection-direction key, V10's
 * two-hour L3, the units' tasks in V11–V14, KY21's V14 report, EK11's handover, L2 and L4 secured in different steps, the briefing on
 * water drops and hose lays, and the tool notes identical but for the tool's name.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { PROJECTION_DIRECTION_KEYS, SECOND_REKINDLE, NEW_FRONT } from "../../app/scenario/demo-directive.js";
import { R2_LINE, projectedLineDistanceAt } from "../../app/scenario/freeze-keys.js";
import { V14_R2, V14_R2_PROJECTION } from "../../app/scenario/freeze-bank-b.js";
import { AUTONOMOUS_ASSETS_EN, AUTONOMOUS_ASSETS_FI, SETTING_TEXT_EN, SETTING_TEXT_FI } from "../../app/scenario/briefing.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { SCENARIO_18_FORCING } from "../../tools/fire-ca/scenario-18.js";
import { projectionChoiceReliance } from "../../app/telemetry/freeze-measures.js";
import { projectionDirectionReading } from "../../app/telemetry/projection-direction.js";
import type { CycleIndex } from "../../app/engine/primitives.js";
import type { LogRecord } from "../../app/telemetry/log.js";
import authoredEn from "../../content/i18n/authored.en.json" with { type: "json" };

const scenario = buildDemoScenario();
const rec = (seq: number, kind: string, detail: unknown): LogRecord => ({ seq, tVirtual: 0, tWallOffsetMs: seq, kind, detail } as unknown as LogRecord);

describe("the projection-direction key (SPEC/16 revision (x), built in revision (ad))", () => {
  it("keys every breach view; V6, V9 and V14 discriminate, the others share a sector or have no direction", () => {
    const breach = SITE_SCENARIO.views.filter((v) => !v.practice && v.derivedFlag !== "holds").map((v) => v.index);
    expect(PROJECTION_DIRECTION_KEYS.map((k) => k.view)).toEqual(breach);
    expect(PROJECTION_DIRECTION_KEYS.filter((k) => k.discriminates).map((k) => k.view)).toEqual([6, 9, 14]);
    expect(PROJECTION_DIRECTION_KEYS.find((k) => k.view === 9)!.reported).toEqual([NEW_FRONT.sector]);
    expect(PROJECTION_DIRECTION_KEYS.find((k) => k.view === 14)!).toMatchObject({ projected: ["L3"], reported: [SECOND_REKINDLE.sector] });
  });

  it("reads the final plan: a main effort in the projected sector, in the reported one, or neither", () => {
    const plan = (view: number, mainEffort: string, seq: number) => [rec(seq, "cycle_start", { cycle: view }),
      rec(seq + 1, "allocation_submitted", { cycle: view, plan: { mainEffort, posture: "barrier_line", secondary: null, drones: null } })];
    const records = [...plan(9, "L2", 1), ...plan(14, SECOND_REKINDLE.sector, 3), ...plan(6, "L4", 5)];
    const out = projectionDirectionReading(records, PROJECTION_DIRECTION_KEYS);
    expect(out.map((r) => [r.view, r.reading])).toEqual([[6, "neither"], [9, "projection"], [14, "reported"]]);
  });

  it("V14 se_front_r2 (revision (aj)): the projection's 40-minute isochrone lies in the report-keyed band, so the item has no projection option until it is re-designed", () => {
    // Revision (aj), 9 Oct 2026: with the rekindle grown out of the old edge the map's front is ~557 m from R2 at 19:40 and barely
    // closing (report-keyed ~546 m); the projection reaches ~568 m. Edges 150/450/650 keep both ≥ 40 m from an edge, in one band.
    const projected = projectedLineDistanceAt(14, 20, R2_LINE);
    // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): the map's fire is ~487 m from R2 (its nearest point, the old fire by the R1/R2
    // junction) and the projection the same; edges 150/400/650 (were 150/450/650) keep it ≥ 40 m from an edge.
    expect(projected).toBeGreaterThan(400 + 40);
    expect(projected).toBeLessThan(650 - 40);
    expect(V14_R2.id).toBe("m400_650");
    expect(V14_R2_PROJECTION).toBeNull();
    const item = scenario.freezes.find((f) => f.cycle === 14)!.items.find((it) => it.id === "freeze.14.se_front_r2")!;
    expect(item.projectionOptionId).toBeUndefined();
    const answer = (optionId: string, seq: number) => rec(seq, "freeze_submitted", { cycle: 14, responses: [{ itemId: item.id, optionId, confidence: 50 }] });
    const reads = [...projectionChoiceReliance([answer("m400_650", 1)], scenario.freezes), ...projectionChoiceReliance([answer("gt650", 2)], scenario.freezes)];
    expect(reads.map((r) => r.reading)).not.toContain("projection");
  });
});

describe("the open register's scenario items", () => {
  it("L2 (the head) and L4 (the rear) are secured in different steps; every step secures at most one non-adjacent arc", () => {
    const stepOf = (note: RegExp) => SCENARIO_18_FORCING.find((f) => (f.events ?? []).some((e) => e.kind === "control_sector" && note.test(e.note ?? "")))!.id;
    expect(stepOf(/^L2/)).toBe("10");
    expect(stepOf(/^L4/)).toBe("11");
    expect(stepOf(/^L1/)).toBe("11"); // L1 and L4 adjoin: one arc, 260°–20°
    expect(SITE_SCENARIO.flagMatches).toBe(14);
  });

  it("EK11 hands command over to the participant (no 'command assumed'), in Finnish and English", () => {
    const text = CYCLE_STORY[1 as CycleIndex].bubbles[0]!.text;
    expect(text).toMatch(/^Johtovastuu siirretty teille\./);
    expect(text).not.toMatch(/otettu/);
    expect((authoredEn as Record<string, string>)["atom.demo.1.0"]).toMatch(/^Command handed over to you\./);
  });

  it("KY21's pushed V14 report agrees with the crossing (the head crossed the forest road), in both languages", () => {
    // Revision (aj): KY21 also pushes the burnout it proposed at 19:2x being called off at 19:5x (the front stayed ~560 m from R2), so the line report is picked by its words.
    const r = SITE_SCENARIO.traffic.filter((t) => t.actor === "KY21" && t.cycle === 20 && t.tier === "T1_pushed" && /ylitti metsäautotien/.test(t.content));
    expect(r).toHaveLength(1);
    expect(r[0]!.content).toMatch(/kärki ylitti metsäautotien/);
    expect(r[0]!.content).not.toMatch(/ei omaa reunaa, palo \d+ m/);
    expect(SITE_SCENARIO.english?.[r[0]!.id]).toMatch(/the head crossed the forest road/);
  });

  it("every unit on scene in V11–V14 has a task; no crew is 'waiting for a task', and the road crews hold road lines", () => {
    for (let step = 14; step <= 20; step++) {
      const s = SITE_SCENARIO.steps.find((x) => x.index === step)!;
      for (const [unit, work] of Object.entries(s.unitWork)) {
        expect(work.task, `${unit} at step ${step}`).toBeTruthy();
        if (work.task === "staging") expect(unit, `step ${step}`).toBe("EK13"); // the shuttle on stand-by, worded so on the card
      }
      for (const u of ["EK11", "EK12", "KY21", "EK16"]) if (s.unitWork[u] && step >= 15) expect(s.unitWork[u]!.task, `${u} at ${step}`).toBe("road_line");
    }
  });

  it("the briefing says water drops and hose lays are not plan tasks, the same in both groups", () => {
    expect(SETTING_TEXT_FI).toContain(AUTONOMOUS_ASSETS_FI);
    expect(SETTING_TEXT_EN).toContain(AUTONOMOUS_ASSETS_EN);
    expect(AUTONOMOUS_ASSETS_FI).toMatch(/vesipudotukset eivät ole suunnitelman erillisiä tehtäviä/);
    expect(AUTONOMOUS_ASSETS_EN).toMatch(/not separate tasks in your plan/);
  });

  it("the tools' empty-chat notes are identical but for the tool's name, the line that answers can be wrong included", () => {
    for (const lang of ["fi", "en"] as const) {
      const t = UI_TEXT[lang];
      expect(t.noQuestions(t.haku).replace(t.haku, "X")).toBe(t.noQuestions("Thinker").replace("Thinker", "X"));
      expect(t.noQuestions(t.haku)).toMatch(lang === "fi" ? /voi olla väärä/ : /can be wrong/);
      expect(t.noQuestions(t.haku)).not.toMatch(/Thinker/);
    }
  });
});
