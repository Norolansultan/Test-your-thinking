/**
 * Every margin of SPEC/08 (bp) §bp.4 holds on the built keys (`content/training/key.json`, recomputed by `build.spec.ts`), and the
 * points the app holds agree with them on the ground (great-circle metres).
 */

import { describe, expect, it } from "vitest";
import key from "../../content/training/key.json" with { type: "json" };
import { TRAINING } from "../../app/session/training/spec-data.js";
import { haversineMetres } from "../../app/telemetry/freeze-measures.js";
import { buildSite, readTopoFeatures } from "../../tools/review/training-site.js";
import { readContract } from "../../tools/review/training-contract.js";
import { basemapPx } from "../../app/render/ui/basemap-px.js";

type Fig = Record<string, unknown>;
const k = (id: string) => (key.items as Record<string, Fig>)[id]!;
const n = (id: string, f: string) => k(id)[f] as number;
const item = (id: string) => TRAINING.items.find((it) => it.id === id)!;
const site = buildSite(readTopoFeatures("."), readContract("."));

describe("the training's margins (SPEC/08 (bp) §bp.4)", () => {
  it("1. s1.place — the R5/R6 junction: the nearest other junction ≥ 400 m, ≥ 240 m inside the lock, ≥ 400 m from the line", () => {
    expect(n("training.s1.place", "nearestOtherJunctionM")).toBeGreaterThanOrEqual(400);
    expect(n("training.s1.place", "insideLockM")).toBeGreaterThanOrEqual(240);
    expect(n("training.s1.place", "lineM")).toBeGreaterThanOrEqual(400);
  });

  it("2. s1.measure — A at 300 m (else 600 m) ± 4 % from a named road; the next road ≥ 1.5 × as far; the foot clear of ends and junctions; A on land", () => {
    const f = k("training.s1.measure"), m = f.metres as number;
    expect(["R5", "R6", "R7"]).toContain(f.road);
    expect(f.key).toBe(`m${m < 450 ? 300 : 600}`);
    const opt = Number(String(f.key).slice(1));
    expect(Math.abs(m - opt)).toBeLessThanOrEqual(0.04 * opt);
    expect(f.nextRoadM as number).toBeGreaterThanOrEqual(1.5 * m);
    expect(f.footFromEndsM as number).toBeGreaterThanOrEqual(160);
    expect(f.footFromJunctionM as number).toBeGreaterThanOrEqual(80);
    expect(f.lineM as number).toBeGreaterThanOrEqual(400);
    for (const o of [150, 300, 600, 1200]) if (o !== opt) expect(Math.abs(o - m) / m).toBeGreaterThanOrEqual(0.4);
    const a = basemapPx(item("training.s1.measure").marks[0]!.at);
    expect(site.forest(a, 1)).toBe(true);
    expect(item("training.s1.measure").feedback.numbers).toMatchObject({ m, road: f.road });
  });

  it("3. s1.slope — B ≥ 5 m up across two contour lines or more, rising; C level within 1 m; ≥ 90° apart; 240 m each; ≥ 400 m from the line", () => {
    const f = k("training.s1.slope"), levels = f.contourLevelsAB as number[];
    expect(f.riseBm as number).toBeGreaterThanOrEqual(5);
    expect(levels.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThan(levels[i - 1]!);
    expect(f.levelCmaxDevM as number).toBeLessThanOrEqual(1);
    expect(f.apartDeg as number).toBeGreaterThanOrEqual(90);
    expect(f.metresEach).toBe(240);
    expect(f.lineM as number).toBeGreaterThanOrEqual(400);
    for (const m of item("training.s1.slope").marks) expect(site.forest(basemapPx(m.at), 1), m.label).toBe(true);
  });

  it("4. s1.water — fill point 1 ≤ 0.5 × the straight distance to 2, no road or track within 100 m of it; 2 by road ≤ 3 km; ★ ≥ 160 m from water", () => {
    const f = k("training.s1.water");
    expect(f.key).toBe("fill_2");
    expect(f.straight1M as number).toBeLessThanOrEqual(0.5 * (f.straight2M as number));
    expect(f.ratio as number).toBeLessThanOrEqual(0.5);
    expect(f.fill1RoadClearM as number).toBeGreaterThanOrEqual(100);
    expect(f.roadM as number).toBeLessThanOrEqual(3000);
    expect(f.fill2GapM as number).toBeLessThanOrEqual(48);
    expect(f.starToWaterM as number).toBeGreaterThanOrEqual(160);
    expect(f.lineM as number).toBeGreaterThanOrEqual(400);
    const it = item("training.s1.water"), [star, one, two] = it.marks;
    expect([star!.label, one!.label, two!.label]).toEqual(["★", "1", "2"]);
    expect(Math.abs(haversineMetres(star!.at, one!.at) - (f.straight1M as number))).toBeLessThan(5);
    expect(it.feedback.ring).toEqual([two!.at]);
    expect(it.feedback.routes![0]![0]).toEqual(star!.at);
    expect(it.feedback.routes![0]!.at(-1)).toEqual(two!.at);
  });

  it("5. s2.now — the drawn head 120 m short of R5, crossed at ≥ 50°; the edge ≥ 100 m from R5 on one side, ≥ 24 m from water; NE preferred", () => {
    const f = k("training.s2.now");
    expect(f.drawnHeadToRoadM).toBe(120);
    expect(f.drawnHeadToRoadM as number).toBeGreaterThanOrEqual(100);
    expect(f.roadCrossingDeg as number).toBeGreaterThanOrEqual(50);
    expect(f.polygonToRoadM as number).toBeGreaterThanOrEqual(100);
    expect(f.fireToWaterM as number).toBeGreaterThanOrEqual(24);
    expect(f.lineM as number).toBeGreaterThanOrEqual(400);
    expect(["ne", "n", "e", "nw", "se"]).toContain(f.direction);
    expect(f.areaHa as number).toBeGreaterThan(0.4);
    expect(f.areaHa as number).toBeLessThan(1.1);
    expect(item("training.s2.now").key).toEqual({ optionId: "at_road" });
  });

  it("6. s2.project — 300 m on from the head at R5 (10.12 + 30 min × 10 m/min); over land ≥ 60 m from water; ≥ 140 m inside the lock; the lure ≥ 100 m off", () => {
    const f = k("training.s2.project"), it = item("training.s2.project");
    expect(f.metres).toBe(300);
    expect(f.keyToWaterM as number).toBeGreaterThanOrEqual(60);
    expect(f.keyInsideLockM as number).toBeGreaterThanOrEqual(140);
    expect(f.lureOffM as number).toBeGreaterThanOrEqual(100);
    const head = it.marks.find((m) => m.kind === "head")!;
    expect(head.label).toBe("10.12");
    expect(Math.abs(haversineMetres(head.at, (it.key as { point: { lat: number; lon: number } }).point) - 300)).toBeLessThan(3);
    expect(it.feedback.numbers).toMatchObject({ m: 300, from: "10.12", to: "10.42", rate: 10, minutes: 30 });
  });

  it("7.–9. S3's keys are read from the records: the survey's 1.1 ha (recorded), R6 blocked (the newer pushed report), EK51's crew of four (recorded)", () => {
    expect(k("training.s3.records1")).toMatchObject({ key: "ha11", keyRecord: "trn.r06", keyHa: 1.1, lureLogHa: 0.4, lureOlderHa: 0.2 });
    expect(k("training.s3.older")).toMatchObject({ key: "blocked", newest: "trn.r09", olderRecord: "trn.r02", blockedFromJunctionM: 300 });
    expect(k("training.s3.records2")).toMatchObject({ key: "four", keyRecord: "trn.r07", crew: 4, lureOnLine: 2 });
    for (const id of ["training.s3.records1", "training.s3.records2"]) expect(item(id).options.map((o) => o.id)).toContain(id.endsWith("1") ? "ha04" : "two");
    expect(item("training.s3.older").lesson).toEqual({ questionId: "trn.q.r6_passable", recordIds: ["trn.r02", "trn.r09"] });
  });

  it("10. s4.memory — EK53 on a road ≥ 160 m from its ends and every junction, 80–320 m from water, ≥ 400 m from every other item's point and the line", () => {
    const f = k("training.s4.memory");
    expect(f.fromEndsM as number).toBeGreaterThanOrEqual(160);
    expect(f.fromJunctionM as number).toBeGreaterThanOrEqual(160);
    expect(f.toWaterM as number).toBeGreaterThanOrEqual(80);
    expect(f.toWaterM as number).toBeLessThanOrEqual(320);
    expect(f.toOtherItemsM as number).toBeGreaterThanOrEqual(400);
    expect(f.lineM as number).toBeGreaterThanOrEqual(400);
    const mem = item("training.s4.memory").memory!;
    const others = TRAINING.items.filter((it) => it.id !== "training.s4.memory").flatMap((it) => [...it.marks.map((m) => m.at), ...("point" in it.key ? [it.key.point] : [])]);
    for (const p of others) expect(haversineMetres(mem.at, p)).toBeGreaterThanOrEqual(395);
  });

  it("11.–13. S4: DR8 reported the head at R5; the fire lay wholly on one side of R5, ≥ 100 m from it; the survey's 10 m/min", () => {
    expect(k("training.s4.log")).toMatchObject({ key: "dr8", record: "trn.r08", callers: ["DR8", "EK51", "EK52"] });
    expect(k("training.s4.map")).toMatchObject({ wholeOneSide: true });
    expect(n("training.s4.map", "polygonToRoadM")).toBeGreaterThanOrEqual(100);
    expect(k("training.s4.map").key).toBe(k("training.s2.now").side === "s" ? "south" : "north");
    expect(k("training.s4.records")).toMatchObject({ key: "mpm10", metresPerMin: 10 });
    expect(item("training.s4.records").options.map((o) => o.id)).toEqual(["mpm4", "mpm10", "mpm20", "mpm40"]);
  });
});
