/**
 * The wildfire-skills export (`tools/skills/`, `npm run skills:export`): deterministic bytes, closed references (every
 * item's facts exist), cycles on the skills' axis 0–20, every coordinate in EPSG:3067, and the item count equal to the
 * instrument's bank.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import siteJson from "../../content/site/site.json" with { type: "json" };
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { buildScenarioPackage, PACKAGE_FILES } from "../../tools/skills/package.js";
import { bankSize } from "../../tools/skills/items.js";
import { writeFiles } from "../../tools/skills/export.js";
import { EPSG3067_BOX, inBox, toEN, type EN } from "../../tools/skills/geo.js";
import { segmentOf } from "../../tools/skills/fire-observations.js";

const pkg = buildScenarioPackage("test-version");
const json = <T>(path: string): T => JSON.parse(pkg.files.get(path)!) as T;

interface Fact { id: string; cycle_true_from: number; route: string }
interface Item { id: string; fact_ids: string[]; cycle: number; type: string; correct: unknown; tolerance?: { m: number } }

const facts = json<{ facts: Fact[] }>("ground_truth/facts.json").facts;
const items = json<{ items: Item[] }>("measures/items.json").items;
const radio = json<{ messages: { cycle: number; fact_ids: string[] }[] }>("channels/radio.json").messages;
const packages = json<{ packages: { cycle: number; fact_ids: string[]; group: string }[] }>("channels/ai_packages.json").packages;
const cycles = json<{ cycles: Record<string, unknown>[] }>("ground_truth/cycles.json").cycles;

/** Every [E, N] pair anywhere in a JSON value (arrays of two numbers). */
function pairsIn(v: unknown, out: EN[] = []): EN[] {
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" && v[0] > 1000) out.push([v[0], v[1]]);
    else for (const x of v) pairsIn(x, out);
  } else if (v && typeof v === "object") {
    for (const k in v) pairsIn((v as Record<string, unknown>)[k], out);
  }
  return out;
}

describe("the wildfire-skills scenario package", () => {
  const dir = mkdtempSync(join(tmpdir(), "skills-export-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes exactly the contract's files, byte-identical on a second run", () => {
    expect([...pkg.files.keys()].sort()).toEqual([...PACKAGE_FILES].sort());
    const again = buildScenarioPackage("test-version");
    for (const path of PACKAGE_FILES) expect(again.files.get(path), path).toBe(pkg.files.get(path));
    const a = writeFiles(join(dir, "a"), pkg.files), b = writeFiles(join(dir, "b"), again.files);
    a.forEach((file, i) => expect(readFileSync(file).equals(readFileSync(b[i]!)), file).toBe(true));
  });

  it("carries the version in every file and lists every file in DATA_SOURCES.md", () => {
    for (const path of PACKAGE_FILES) expect(pkg.files.get(path), path).toContain("test-version");
    const md = pkg.files.get("DATA_SOURCES.md")!;
    for (const path of PACKAGE_FILES.filter((p) => p !== "DATA_SOURCES.md")) expect(md).toContain(`\`${path}\``);
  });

  it("has unique fact ids, every atom of the scenario among them, every cycle within 0–20", () => {
    const ids = facts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of pkg.scenario.atoms) expect(ids).toContain(a.id);
    for (const f of facts) expect(f.cycle_true_from, f.id).toBeGreaterThanOrEqual(0);
    for (const f of facts) expect(f.cycle_true_from, f.id).toBeLessThanOrEqual(20);
    for (const m of [...radio, ...packages]) expect(m.cycle >= 0 && m.cycle <= 20).toBe(true);
  });

  it("pushes only known facts, never before they are true, and the tools reach every atom in its own cycle", () => {
    const byId = new Map(facts.map((f) => [f.id, f]));
    for (const m of radio) for (const id of m.fact_ids) {
      expect(byId.get(id), id).toBeDefined();
      expect(m.cycle).toBeGreaterThanOrEqual(byId.get(id)!.cycle_true_from);
      expect(byId.get(id)!.route).toBe("pushed");
    }
    const retrievable = new Map(packages.filter((p) => p.group === "both").flatMap((p) => p.fact_ids.map((id) => [id, p.cycle] as const)));
    for (const a of pkg.scenario.atoms) expect(retrievable.get(a.id), a.id).toBe(byId.get(a.id)!.cycle_true_from);
    expect(packages.filter((p) => p.group === "guide").flatMap((p) => p.fact_ids).length).toBe(retrievable.size);
  });

  it("has as many items as the instrument's bank, unique ids, every fact_id in facts.json", () => {
    expect(items.length).toBe(bankSize(pkg.scenario));
    expect(items.length).toBe(62); // 4 practice + 4×8 + 3×6 freeze items, 6 SPAM + the practice SPAM item, the hinge check
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    const ids = new Set(facts.map((f) => f.id));
    for (const it of items) for (const id of it.fact_ids) expect(ids.has(id), `${it.id} → ${id}`).toBe(true);
    for (const it of items) expect(it.cycle >= 0 && it.cycle <= 20, it.id).toBe(true);
  });

  it("keys every item: a choice by an option id, a map item by an EPSG:3067 point with its tolerance", () => {
    for (const it of items) {
      if (it.type === "point") {
        expect(inBox(it.correct as EN), it.id).toBe(true);
        expect(it.tolerance?.m, it.id).toBeGreaterThan(0);
      } else {
        expect(it.type).toBe("choice");
        expect(typeof it.correct, it.id).toBe("string");
      }
    }
  });

  it("converts through TM35FIN: the ignition point lands on the site's own TM35 ignition (< 1 m)", () => {
    const [e, n] = toEN(SITE_SCENARIO.ignition);
    expect(Math.abs(e - siteJson.ignitionTm35.eastM)).toBeLessThan(1);
    expect(Math.abs(n - siteJson.ignitionTm35.northM)).toBeLessThan(1);
  });

  it("puts every coordinate of every spatial and ground-truth file in the EPSG:3067 box", () => {
    const sources = ["spatial/perimeters_scripted.geojson", "spatial/barriers.geojson", "ground_truth/cycles.json", "measures/items.json"];
    for (const path of sources) {
      const pairs = pairsIn(json<unknown>(path));
      expect(pairs.length, path).toBeGreaterThan(0);
      const out = pairs.filter((p) => !inBox(p));
      expect(out, `${path}: outside E ${EPSG3067_BOX.eMin}–${EPSG3067_BOX.eMax}, N ${EPSG3067_BOX.nMin}–${EPSG3067_BOX.nMax}`).toEqual([]);
    }
    const geo = json<{ crs: { properties: { name: string } } }>("spatial/perimeters_scripted.geojson");
    expect(geo.crs.properties.name).toBe("urn:ogc:def:crs:EPSG::3067");
  });

  it("tags each step's perimeters with its cycle and kind: the truth at the end, the reported at the start", () => {
    const fc = json<{ features: { properties: { cycle: number; kind: string; step: number } }[] }>("spatial/perimeters_scripted.geojson");
    expect(fc.features.length).toBe(SITE_SCENARIO.steps.length * 2);
    for (const s of SITE_SCENARIO.steps) {
      const mine = fc.features.filter((f) => f.properties.step === s.index).map((f) => f.properties.kind).sort();
      expect(mine).toEqual(["reported", "truth"]);
    }
  });

  it("gives every cycle the fields the two checks read, with nulls only where the scenario has no value", () => {
    expect(cycles.map((c) => c.cycle)).toEqual([0, ...Array.from({ length: 20 }, (_, i) => i + 1)]);
    for (const c of cycles) {
      for (const k of ["time", "fire_type", "ros_head_m_min", "fl_head_m", "fl_flank_m", "wind", "head_bearing_deg", "rh_pct", "event", "segments", "barriers", "smouldering_spots", "units", "placements"]) expect(c, `cycle ${c.cycle}: ${k}`).toHaveProperty(k);
      expect((c.segments as { id: string }[]).map((s) => s.id)).toEqual(["head", "left_flank", "right_flank", "rear"]);
      const unitIds = new Set((c.units as { id: string }[]).map((u) => u.id));
      for (const p of c.placements as { unit_id: string; xy: EN }[]) expect(unitIds.has(p.unit_id)).toBe(true);
      // An RH value is a weather-station reading in that step, never interpolated.
      if (c.rh_pct !== null) expect(typeof c.rh_source).toBe("string");
    }
    // The crown run: flames above the treetops have no number, so the type is set and the length is null.
    const crown = cycles.filter((c) => /latvojen yli/.test(String(c.fl_head_phrase)));
    expect(crown.length).toBeGreaterThan(0);
    for (const c of crown) expect([c.fire_type, c.fl_head_m], `cycle ${c.cycle}`).toEqual(["active_crown", null]);
  });

  it("splits segments on the origin–head axis: ahead = head, behind the origin = rear, left and right as seen toward the head", () => {
    const o: EN = [0 + 500_000, 6_700_000], h: EN = [500_000, 6_701_000]; // a head 1 km north of the origin
    expect(segmentOf([500_000, 6_701_500], o, h, 0)).toBe("head");
    expect(segmentOf([500_000, 6_699_000], o, h, 0)).toBe("rear");
    expect(segmentOf([500_400, 6_700_500], o, h, 0)).toBe("right_flank");
    expect(segmentOf([499_600, 6_700_500], o, h, 0)).toBe("left_flank");
  });
});
