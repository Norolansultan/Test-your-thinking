/**
 * Indexed search (researcher, 11 Oct 2026; SPEC/25 revision (aq)): the original index-based search
 * (KUKA x MITA x MILLOIN + free text, no LLM) as a third right-panel tab, DEMONSTRATION ONLY.
 * It is wired from `?tuotanto` (App.tsx) and never rendered in the study configuration.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { checkNavigationCoverage, NAV_CATEGORIES } from "../../app/retrieval/navigation.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { allocateAndConfirm, runOutView } from "../session/view-flow.js";

const scenario = buildDemoScenario();

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the tab is wired for the demonstration only", () => {
  it("App passes indexedSearch={!study}; the panel renders it only on that prop", () => {
    expect(readFileSync("app/render/ui/App.tsx", "utf8")).toMatch(/indexedSearch=\{!study\}/);
    expect(readFileSync("app/render/ui/SessionLauncher.tsx", "utf8")).toMatch(/indexedSearch=\{demo\}/); // the resume path
    expect(readFileSync("app/render/ui/components/SessionView.tsx", "utf8")).toMatch(/indexedSearch=\{indexedSearch\}/);
    const panel = readFileSync("app/render/ui/components/RightPanel.tsx", "utf8");
    expect(panel).toMatch(/indexedSearch = false/);
    expect(panel).toMatch(/\{indexedSearch && <button .*\{t\.indexedSearch\}<\/button>\}/); // no cell condition: every cell
    expect(panel).toMatch(/indexedSearch && tool === "index" && .*<HakuPanel orchestrator=\{orchestrator\} freeText \/>/);
    expect(panel).toMatch(/"indexed_search"/);
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
