/**
 * Nothing of the training involves the 20 kV line (SPEC/08 (bp) §bp.2, `15` (bp) §bp.7; it is H9's subject): every coordinate the
 * training holds — keys, marks, the feedback's rings, lines and routes, the fire's edge and core, units, road-code labels and the
 * records' places — lies ≥ 400 m from the contract's `POWER_LINE` (measured through the TM35 projection, independently of the build's
 * pixels); the lock meets no contract feature but `MAANTIE_N` and `POWER_LINE`; the build cuts the roads at the band.
 */

import { describe, expect, it } from "vitest";
import contract from "../../content/site/contract.json" with { type: "json" };
import corpus from "../../content/training/corpus.json" with { type: "json" };
import key from "../../content/training/key.json" with { type: "json" };
import type { LatLon } from "../../app/engine/primitives.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";
import { AREA, buildSite, readTopoFeatures } from "../../tools/review/training-site.js";
import { contractCheck, readContract } from "../../tools/review/training-contract.js";

const line = (contract.features.find((f) => f.id === "POWER_LINE")!.geometry as { coordinates: number[][] }).coordinates;

/** Site metres (from the point of origin, ETRS-TM35FIN 519 000 E, 6 746 000 N) of a WGS84 point, and its distance from the line. */
function lineM(p: LatLon): number {
  const t = wgs84ToTm35(p), x = t.eastM - 519_000, y = t.northM - 6_746_000;
  const [a, b] = [line[0]!, line[1]!];
  const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, u = Math.max(0, Math.min(1, ((x - a[0]!) * dx + (y - a[1]!) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0]! - u * dx, y - a[1]! - u * dy);
}

function everyCoordinate(): { readonly where: string; readonly at: LatLon }[] {
  const out: { where: string; at: LatLon }[] = [];
  const add = (where: string, ps: readonly LatLon[]) => ps.forEach((at, i) => out.push({ where: `${where}[${i}]`, at }));
  for (const it of TRAINING.items) {
    if ("point" in it.key) add(`${it.id}.key`, [it.key.point]);
    add(`${it.id}.marks`, it.marks.map((m) => m.at));
    add(`${it.id}.ring`, it.feedback.ring ?? []);
    add(`${it.id}.line`, it.feedback.line ?? []);
    (it.feedback.routes ?? []).forEach((r, i) => add(`${it.id}.route${i}`, r));
    if (it.memory) add(`${it.id}.memory`, [it.memory.at]);
  }
  add("roadLabels", TRAINING.roadLabels.map((l) => l.at));
  const s = TRAINING.scenes.incident;
  s.perimeter.forEach((r, i) => add(`incident.perimeter${i}`, r));
  s.fire.burnt_area.geometry.forEach((g, i) => g.forEach((r, j) => add(`incident.burnt${i}.${j}`, r)));
  s.fire.burning_zone.forEach((g, i) => g.forEach((r, j) => add(`incident.zone${i}.${j}`, r)));
  s.fire.perimeter_current.forEach((e, i) => add(`incident.edge${i}`, e.line));
  add("incident.units", Object.values(s.unitPositions));
  add("records", corpus.records.map((r) => r.at));
  return out;
}

describe("no power-line involvement (SPEC/08 (bp) §bp.2)", () => {
  it("every coordinate the training holds lies ≥ 400 m from the contract's 20 kV line", () => {
    const all = everyCoordinate();
    expect(all.length).toBeGreaterThan(200);
    const near = all.map((c) => ({ ...c, m: lineM(c.at) })).filter((c) => c.m < 400);
    expect(near).toEqual([]);
    expect(Math.min(...all.map((c) => lineM(c.at)))).toBeGreaterThan(600);
  });

  it("the lock meets no contract feature but MAANTIE_N and POWER_LINE; the next nearest is about 4.8 km from the square", () => {
    const c = readContract("."), lockPx = AREA.lockMarginM / 4;
    const square = { x0: AREA.x0, y0: AREA.y0, x1: AREA.x0 + AREA.size, y1: AREA.y0 + AREA.size };
    expect(contractCheck(c, { x0: square.x0 - lockPx, y0: square.y0 - lockPx, x1: square.x1 + lockPx, y1: square.y1 + lockPx }).met).toEqual(["MAANTIE_N", "POWER_LINE"]);
    const sq = contractCheck(c, square);
    expect(sq.met).toEqual(["MAANTIE_N", "POWER_LINE"]);
    expect(sq.nearestOther.id).toBe("KOTKANJOKI");
    expect(sq.nearestOther.metres).toBeGreaterThan(4500);
    expect(key.contract.lockMeets).toEqual(["MAANTIE_N", "POWER_LINE"]);
  });

  it("the build cuts every drivable road at the band: R5 its west run (1.2 km), R6 (2.1 km) joining it, R7's north run (1.3 km) unjoined", () => {
    const s = buildSite(readTopoFeatures("."), readContract("."));
    for (const pc of s.pieces) for (const p of pc.pts) expect(s.clear(p), pc.id).toBe(true);
    expect(s.uncut.some((pc) => pc.pts.some((p) => !s.clear(p)))).toBe(true);
    const km = (code: "R5" | "R6" | "R7") => Math.round(s.road(code).pts.reduce((sum, p, i, a) => (i === 0 ? 0 : sum + Math.hypot(p.x - a[i - 1]!.x, p.y - a[i - 1]!.y)), 0) * 4 / 100) / 10;
    expect([km("R5"), km("R6"), km("R7")]).toEqual([1.2, 2.1, 1.3]);
    const r5 = s.road("R5").pts, r7 = s.road("R7").pts;
    const gap = Math.min(...[r7[0]!, r7.at(-1)!].map((e) => Math.min(...r5.map((q) => Math.hypot(e.x - q.x, e.y - q.y))))) * 4;
    expect(gap).toBeGreaterThan(400);
    expect(key.band.roads.map((r) => r.code)).toEqual(["R5", "R6", "R7"]);
  });
});
