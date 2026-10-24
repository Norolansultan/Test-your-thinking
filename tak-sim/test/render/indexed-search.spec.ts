/**
 * Indexed search (researcher, 11 Oct 2026; SPEC/25 revision (aq)): the original index-based search
 * (KUKA x MITA x MILLOIN + free text, no LLM) as a third right-panel tab, once DEMONSTRATION ONLY.
 * Researcher, 24 Oct 2026 (SPEC/28 §5): shown in NO session, the demonstration included — both launch paths pass
 * `indexedSearch={false}`; the prop, the panes and the engine stay, so a later decision can turn it back on.
 */

import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { takToolbarPanes } from "../../app/render/ui/tak/shell.js";
import { practiceTour, toolsTour, TOUR_TARGET_NAMES } from "../../app/render/ui/tour.js";
import { checkNavigationCoverage, NAV_CATEGORIES } from "../../app/retrieval/navigation.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { allocateAndConfirm, runOutView } from "../session/view-flow.js";

const scenario = buildDemoScenario();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the tab is shown in no session (24 Oct 2026)", () => {
  it("App and the resume path pass indexedSearch={false}; the panel renders it only on that prop", () => {
    for (const f of ["app/render/ui/App.tsx", "app/render/ui/SessionLauncher.tsx"]) { // the new session and the resume path
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/indexedSearch=\{false\}/);
      expect(src, f).not.toMatch(/indexedSearch=\{(?!false\})/);
    }
    expect(readFileSync("app/render/ui/components/SessionView.tsx", "utf8")).toMatch(/indexedSearch = false/);
    expect(readFileSync("app/render/ui/components/SessionView.tsx", "utf8")).toMatch(/indexedSearch=\{indexedSearch\}/);
    const panel = readFileSync("app/render/ui/components/RightPanel.tsx", "utf8");
    expect(panel).toMatch(/indexedSearch = false/);
    expect(panel).toMatch(/\{indexedSearch && <button .*\{t\.indexedSearch\}<\/button>\}/); // no cell condition: every cell
    expect(panel).toMatch(/indexedSearch && tool === "index" && .*<HakuPanel orchestrator=\{orchestrator\} freeText \/>/);
    expect(panel).toMatch(/"indexed_search"/);
  });

  it("leaves no slot or button behind in either layout, no tour step points at it, and the play harness offers nothing for it", () => {
    for (const cond of ["directed", "substitutive"] as const) expect(takToolbarPanes(cond, { indexedSearch: false })).not.toContain("indexed_search");
    // The classic layout renders its button and pane only on the prop (above); the TAK layout takes its panes from takToolbarPanes.
    expect(readFileSync("app/render/ui/tak/TakSessionLayout.tsx", "utf8")).toMatch(/const panes = takToolbarPanes\(condition, \{ indexedSearch \}\);/);
    const steps = [...practiceTour("substitutive"), ...toolsTour("substitutive"), ...toolsTour("substitutive", "reasoning_intent"), ...practiceTour("directed"), ...toolsTour("directed")];
    for (const step of steps) expect(step.target ?? "", step.id).not.toMatch(/indexed/);
    expect(TOUR_TARGET_NAMES as readonly string[]).not.toContain("indexed-search");
    for (const f of readdirSync("tools/play").filter((x) => x.endsWith(".ts"))) expect(readFileSync(`tools/play/${f}`, "utf8"), f).not.toMatch(/indexed_search|indexedSearch|navigateQuery/);
  });

  it("is named in both languages, and the builder's old keys exist", () => {
    expect(UI_TEXT.fi.indexedSearch).toBe("Indeksihaku");
    expect(UI_TEXT.en.indexedSearch).toBe("Indexed search");
    for (const lang of ["fi", "en"] as const) {
      for (const k of ["what", "who", "when", "all", "search", "searchText", "freeTextPlaceholder", "noResults", "clock"] as const) expect(UI_TEXT[lang][k]).toBeTruthy();
    }
  });
});

describe("the engine on the current corpus", () => {
  it("every atom has a known navCategory and the decoy rule holds", () => {
    const valid = new Set<string>(NAV_CATEGORIES.map((c) => c.id));
    expect(scenario.atoms.filter((a) => !valid.has(a.navCategory))).toEqual([]);
    expect(checkNavigationCoverage(scenario.atoms)).toEqual([]);
  });
});

describe.each([["directed", "radio"], ["substitutive", "reasoning_once"], ["substitutive", "reasoning_intent"]] as const)("in the %s condition (%s)", (condition, cell) => {
  it("logs tab_selected indexed_search and a nav query with its results", async () => {
    const o = new SessionOrchestrator(scenario, condition, { cell });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    await o.start();
    await runOutView(o, () => box.snap!);
    await allocateAndConfirm(o, () => box.snap!);
    await o.completeTraining();
    await o.logTabSelected("indexed_search");
    const results = await o.navigateQuery({ category: NAV_CATEGORIES[0]!.id, sourceId: null, window: "whole_incident" });
    const records = await o.logRecords();
    expect(records.some((r) => r.kind === "tab_selected" && (r.detail as { tool: string }).tool === "indexed_search")).toBe(true);
    const q = records.find((r) => r.kind === "nav_query_submitted")!;
    expect((q.detail as { resultAtomIds: string[] }).resultAtomIds).toEqual(results.map((a) => a.id));
  });
});
