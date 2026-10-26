/**
 * The training's corpus (SPEC/08 (bp) §bp.6, `14` (bp) §bp.3): twelve records `trn.r01`–`trn.r12` at step −9, sources EK51, EK52
 * and DR8 only, five pushed and seven recorded, built by the session's own `trafficAtom`, each with its English; the ids are disjoint
 * from the scenario's (its atoms, the Thinker's vector indexes, the scored items' key records); the message log's rows; the wording the
 * build reads from the geometry.
 */

import { describe, expect, it } from "vitest";
import corpus from "../../content/training/corpus.json" with { type: "json" };
import key from "../../content/training/key.json" with { type: "json" };
import indexFi from "../../content/thinker/index.json" with { type: "json" };
import indexEn from "../../content/thinker/index.en.json" with { type: "json" };
import { recordEn } from "../../app/i18n/text.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { TRAINING_ATOMS, TRAINING_NOW_S, TRAINING_QUESTIONS, TRAINING_STEP, TRAINING_VIEW, trainingClockS, trainingLogRows } from "../../app/session/training/corpus.js";
import { recordText } from "../../app/session/template-answer.js";

const ids = TRAINING_ATOMS.map((a) => a.id);

describe("the training's corpus (SPEC/08 (bp) §bp.6)", () => {
  it("twelve records trn.r01–trn.r12 at step −9, from EK51, EK52 and DR8 only; five pushed, seven recorded (T2 filed, T3 when asked)", () => {
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => `trn.r${String(i + 1).padStart(2, "0")}`));
    expect(new Set(TRAINING_ATOMS.map((a) => a.cycle))).toEqual(new Set([TRAINING_STEP]));
    expect(TRAINING_STEP).toBe(-9);
    expect(new Set(TRAINING_ATOMS.map((a) => a.provenance.sourceId))).toEqual(new Set(["EK51", "EK52", "DR8"]));
    expect(TRAINING_ATOMS.filter((a) => a.tier === "T1_pushed").map((a) => a.id)).toEqual(["trn.r03", "trn.r05", "trn.r08", "trn.r09", "trn.r11"]);
    expect(TRAINING_ATOMS.filter((a) => a.tier === "T3_person").map((a) => a.id)).toEqual(["trn.r07", "trn.r10"]);
    expect(TRAINING_ATOMS.filter((a) => a.tier === "T2_system")).toHaveLength(5);
  });

  it("the clocks run 09.41–10.17, before the training's 'now' (10.18, −10 920 s); the view starts at 10.00 (−12 000 s)", () => {
    const at = TRAINING_ATOMS.map((a) => a.provenance.observedAt);
    expect(Math.min(...at)).toBe(trainingClockS("09.41"));
    expect(Math.max(...at)).toBe(trainingClockS("10.17"));
    expect(Math.max(...at)).toBeLessThan(TRAINING_NOW_S);
    expect(TRAINING_NOW_S).toBe(trainingClockS("10.18"));
    expect(TRAINING_VIEW).toEqual({ startsAtVirtual: trainingClockS("10.00"), steps: 1 });
  });

  it("every record has its English, looked up by id like every record's, and the Finnish of the built corpus", () => {
    for (const a of TRAINING_ATOMS) {
      const row = corpus.records.find((r) => r.id === a.id)!;
      expect(recordText(a.record)).toBe(row.fi);
      expect(recordEn(a.id), a.id).toBeTruthy();
      expect(recordEn(a.id)).not.toMatch(/[äöå]|Kaitaj/);
    }
  });

  it("the ids are disjoint from the scenario's records, its vector indexes and its scored items' key records", () => {
    const scenario = buildDemoScenario();
    const scenarioIds = new Set(scenario.atoms.map((a) => a.id));
    expect(ids.filter((id) => scenarioIds.has(id))).toEqual([]);
    expect([...scenarioIds].filter((id) => id.startsWith("trn."))).toEqual([]);
    const indexIds = (f: unknown) => JSON.stringify(f).match(/"trn\.[^"]*"/g) ?? [];
    expect(indexIds(indexFi)).toEqual([]);
    expect(indexIds(indexEn)).toEqual([]);
    const keyAtoms = scenario.freezes.flatMap((f) => f.items.flatMap((it) => (it as { keyAtomIds?: readonly string[] }).keyAtomIds ?? []));
    expect(keyAtoms.filter((id) => id.startsWith("trn."))).toEqual([]);
  });

  it("the message log shows the pushed records by clock: S2's scene those to 10.12, S3's all five", () => {
    expect(trainingLogRows("10.12").map((r) => r.id)).toEqual(["trn.r03", "trn.r05", "trn.r08"]);
    expect(trainingLogRows("10:18").map((r) => r.id)).toEqual(["trn.r03", "trn.r05", "trn.r08", "trn.r09", "trn.r11"]);
    expect(trainingLogRows("10.18").map((r) => [r.clockLabel, r.from])).toEqual([["09:58", "EK51"], ["10:04", "EK51"], ["10:12", "DR8"], ["10:14", "EK52"], ["10:17", "EK51"]]);
  });

  it("the wording read from the geometry: the fire's side of R5, its spread, the lake's side, the tail's edge, R6 from the junction", () => {
    const w = key.wording;
    const r = (id: string) => corpus.records.find((x) => x.id === id)!.fi;
    expect(r("trn.r03")).toContain(`tien R5 ${{ s: "etelä", n: "pohjois" }[w.roadSide as "s" | "n"]}puolella`);
    expect(r("trn.r06")).toContain(`kärki etenee ${{ ne: "koilliseen", n: "pohjoiseen", e: "itään", nw: "luoteeseen", se: "kaakkoon" }[w.spread as "ne"]}`);
    expect(w.roadSide).toBe(key.items["training.s2.now"].side);
    expect(w.spread).toBe(key.items["training.s2.now"].direction);
    expect(r("trn.r02")).toContain(`risteyksestä ${{ n: "pohjoiseen" }[w.r6Dir as "n"]}`);
    expect(Object.values(key.wording.marginsDeg).every((m) => m >= 15)).toBe(true);
    for (const rec of corpus.records) expect(rec.fi, rec.id).not.toMatch(/[{}]/);
  });

  it("the pre-recorded questions name records of this corpus only", () => {
    for (const q of Object.values(TRAINING_QUESTIONS)) for (const id of q.recordIds) expect(ids).toContain(id);
  });
});
