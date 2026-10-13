/**
 * What an English screen shows of the units (review of revision (ae), B1 and S3): the status bar, the plan
 * panel's on-scene line, the markers' labels and hover cards, and the roster name every unit as the English
 * session does (VPK is VOL1) and carry no Finnish code (VPK, AVL, PP1, US1) and no Finnish place name.
 *
 * Hooks cannot be rendered in this test setup (no DOM), so each part's display text comes from the same pure
 * function the component renders (`statusStripUnits`, `onSceneLine`, `markerLabel`, `cardLines`), run over
 * every view's real allocation and every view's real unit positions, tasks and aircraft; and the components'
 * sources are checked to render those functions and no raw id.
 */

import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { allocationViewOf } from "../../app/session/allocation.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { finnishNamesIn } from "../../app/i18n/place-names.js";
import { statusStripUnits } from "../../app/render/ui/components/StatusStrip.js";
import { onSceneLine } from "../../app/render/ui/components/DecisionPanels.js";
import { cardLines, markerLabel, setMarkerLang, unitMarkerData } from "../../app/render/ui/unit-markers.js";
import { UNIT_ROSTER_EN } from "../../app/render/ui/unit-roster.js";

const scenario = buildDemoScenario();
const views = [scenario.practice.cycle, ...scenario.cycles];
/** A Finnish-shaped place name (a capitalised compound ending in a Finnish place word). */
const FINNISH_PLACE = /(?<![\p{L}])[A-ZÄÖ][a-zäö-]*(?:järvi|järven|lampi|joki|oja|puro|suo|kangas|mäki|harju|kylä|ranta|laakso)(?![\p{L}])/u;

function englishScreenTexts(): string[] {
  const out: string[] = [];
  for (let v = 0; v <= scenario.cycles.length; v++) {
    const allocation = allocationViewOf(scenario.allocationSpace, v);
    out.push(...statusStripUnits({ allocation }, "en"), onSceneLine(UI_TEXT.en, allocation, "en"));
  }
  setMarkerLang("en");
  for (const c of views) {
    const frames = [c, ...(c.stepBoundary ? [c.stepBoundary] : [])];
    for (const f of frames) for (const d of unitMarkerData(f.unitPositions, f.unitWork, f.aircraft)) out.push(markerLabel(d), ...cardLines(d));
  }
  for (const r of Object.values(UNIT_ROSTER_EN)) out.push(r.type, r.crew ?? "", r.from ?? "", r.detail ?? "");
  return out;
}

describe("an English screen's units", () => {
  afterAll(() => setMarkerLang("fi"));
  const texts = englishScreenTexts();

  it("covers the units of every view, the volunteer brigade among them", () => {
    expect(texts.length).toBeGreaterThan(100);
    expect(texts.join("\n")).toMatch(/\bVOL1\b/);
  });

  it("show no Finnish code and no Finnish place name", () => {
    const bad = texts.flatMap((t) => [...finnishNamesIn(t), ...(FINNISH_PLACE.exec(t.replaceAll("Kymenlaakso", "")) ?? [])].map((n) => `${n} in "${t}"`));
    expect(bad).toEqual([]);
  });

  it("the Finnish screen keeps the Finnish ids", () => {
    const allocation = allocationViewOf(scenario.allocationSpace, 0);
    expect(statusStripUnits({ allocation }, "fi")).toContain("VPK");
    expect(onSceneLine(UI_TEXT.fi, allocation, "fi")).toContain("VPK");
    setMarkerLang("fi");
    expect(markerLabel({ id: "VPK" })).toBe("VPK");
    setMarkerLang("en");
    expect(markerLabel({ id: "VPK" })).toBe("VOL1");
  });
});

describe("the components render the display functions, not raw ids (source)", () => {
  const src = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");
  it("StatusStrip, the plan panel and the markers", () => {
    const strip = src("components/StatusStrip.tsx");
    expect(strip).toMatch(/const units = statusStripUnits\(snapshot, lang\);/);
    expect(strip).not.toMatch(/snapshot\.allocation\.crews\]/);
    expect(src("components/DecisionPanels.tsx")).toMatch(/\{onSceneLine\(t, snapshot\.allocation, lang\)\}/);
    const markers = src("unit-markers.ts");
    expect(markers).toMatch(/label\.textContent = markerLabel\(d\);/);
    expect(markers).not.toMatch(/textContent = d\.id/);
  });
});
