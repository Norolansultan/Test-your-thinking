/**
 * The guided tour (SPEC/15 r.11): its content (both languages, both groups) and its effect on the
 * session — the view's time waits for it, and it is logged.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_TEXT as UI } from "../../app/i18n/ui.js";
import { PROJECTION_CAVEAT_EN, PROJECTION_CAVEAT_FI } from "../../app/scenario/briefing.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { PRACTICE_THINKER_STEP, PRACTICE_TOUR, practiceTour, TOUR_TARGET_NAMES, toolsTour, tourSteps } from "../../app/render/ui/tour.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { allocateAndConfirm, runOutView } from "../session/view-flow.js";

const AI_WORDS = /\b(AI|tekoäly|Thinker|agentti|analyysiagentti|LLM)\b/i;
const COMPONENTS = "app/render/ui/components";

describe("the tour's content", () => {
  it("has a title and a text for every step in both languages", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const step of [...practiceTour("substitutive"), ...toolsTour("substitutive"), ...toolsTour("substitutive", "reasoning_intent")]) {
        expect(UI[lang].tour.steps[step.id].title, `${lang} ${step.id}`).not.toBe("");
        expect(UI[lang].tour.steps[step.id].body, `${lang} ${step.id}`).not.toBe("");
      }
    }
  });

  it("the practice tour is the same for both groups and names no AI tool (VP is Haku only, SPEC/26 D3)", () => {
    for (const lang of ["fi", "en"] as const) {
      for (const step of PRACTICE_TOUR) expect(`${UI[lang].tour.steps[step.id].title} ${UI[lang].tour.steps[step.id].body}`, step.id).not.toMatch(AI_WORDS);
    }
  });

  it("explains the projection with the briefing's own caveat, and makes no claim about reliability", () => {
    expect(UI.fi.tour.steps.projection.body).toContain(PROJECTION_CAVEAT_FI);
    expect(UI.en.tour.steps.projection.body).toContain(PROJECTION_CAVEAT_EN);
    for (const step of PRACTICE_TOUR) expect(UI.fi.tour.steps[step.id].body).not.toMatch(/luotettav|virheetön|tarkka/i);
  });

  it("explains the situation question (SPAM): the ready prompt in its own words, that it waits and comes before the period ends, that the search tools stay usable, and that VP has one to try (revision (ag))", () => {
    const ids = PRACTICE_TOUR.map((s) => s.id);
    expect(ids.indexOf("spam")).toBe(ids.indexOf("freeze") + 1);
    expect(ids.at(-1)).toBe("ready");
    expect(UI.fi.tour.steps.spam.body).toContain(UI.fi.spam.readyPrompt);
    expect(UI.en.tour.steps.spam.body).toContain(UI.en.spam.readyPrompt);
    expect(UI.fi.tour.steps.spam.body).toContain(UI.fi.spam.ready);
    expect(UI.en.tour.steps.spam.body).toContain(UI.en.spam.ready);
    // Revision (ag): the prompt waits (it can be minimised), it comes before the period ends, and the tools stay usable.
    expect(UI.fi.tour.steps.spam.body).toMatch(/Kysymys odottaa sinua/);
    expect(UI.en.tour.steps.spam.body).toMatch(/The question waits for you/);
    expect(UI.fi.tour.steps.spam.body).toMatch(/ennen kuin jakso päättyy/);
    expect(UI.en.tour.steps.spam.body).toMatch(/before the period ends/);
    expect(UI.fi.tour.steps.spam.body).toMatch(/voit käyttää karttaa, viestilokia ja hakutyökaluja/);
    expect(UI.en.tour.steps.spam.body).toMatch(/search tools stay available/);
    for (const lang of ["fi", "en"] as const) expect(UI[lang].tour.steps.spam.body).not.toMatch(/pois käytöstä|are off/);
    expect(UI.en.tour.steps.spam.body).toMatch(/practice/);
    // Revision (am): the practice tour's common steps are the same for both groups; the AI group adds only the Thinker practice.
    expect(tourSteps("practice", "directed")).toEqual(tourSteps("practice", "substitutive").filter((s) => s.id !== "practiceThinker"));
  });

  it("revision (am): the Thinker practice is in the practice tour of both Thinker cells (the same step), right after Haku, and never in the radio cell", () => {
    expect(tourSteps("practice", "directed", "radio").map((s) => s.id)).not.toContain("practiceThinker");
    expect(tourSteps("practice", "directed", "radio")).toEqual(PRACTICE_TOUR);
    for (const cell of ["reasoning_once", "reasoning_intent"] as const) {
      const steps = tourSteps("practice", "substitutive", cell);
      expect(steps.filter((s) => s.id === "practiceThinker")).toEqual([PRACTICE_THINKER_STEP]);
      const ids = steps.map((s) => s.id);
      expect(ids.indexOf("practiceThinker")).toBe(ids.indexOf("haku") + 1);
      expect(steps.length).toBe(PRACTICE_TOUR.length + 1);
    }
    expect(tourSteps("practice", "substitutive", "reasoning_once")).toEqual(tourSteps("practice", "substitutive", "reasoning_intent"));
    expect(PRACTICE_THINKER_STEP).toMatchObject({ interactive: "thinkerPractice", target: '[data-tour="thinker-chat"]' });
    expect(practiceTour("directed")).toBe(PRACTICE_TOUR);
    // The practice step's text names Thinker; the radio cell's tour still names no AI tool (checked above over PRACTICE_TOUR).
    for (const lang of ["fi", "en"] as const) expect(UI[lang].tour.steps.practiceThinker.body).toMatch(/Thinker/);
  });

  it("revision (am): the tour component opens the Thinker tab, offers the example, waits for one answer, and lets typing in the chat through", () => {
    const tour = readFileSync(join(COMPONENTS, "GuidedTour.tsx"), "utf8");
    expect(tour).toContain("TOUR_OPEN_TOOL_EVENT");
    expect(tour).toContain("askOpenThinker(t.tour.practiceThinker.example)");
    expect(tour).toMatch(/waiting = practising && snapshot\.openThinkerHistory\.length === 0/);
    expect(tour).toMatch(/HTMLInputElement/);
    const panel = readFileSync(join(COMPONENTS, "RightPanel.tsx"), "utf8");
    expect(panel).toContain("TOUR_OPEN_TOOL_EVENT");
    expect(panel).toContain('data-tour="thinker-chat"');
  });

  it("the tool reminder points at Haku in both groups and at Thinker only in the AI group", () => {
    expect(toolsTour("directed").map((s) => s.id)).toEqual(["toolsHaku"]);
    expect(toolsTour("substitutive").map((s) => s.id)).toEqual(["toolsHaku", "toolsThinker"]);
    // Revision (al): the Thinker step says what that cell's Thinker holds.
    expect(toolsTour("substitutive", "reasoning_once").map((s) => s.id)).toEqual(["toolsHaku", "toolsThinker"]);
    expect(toolsTour("substitutive", "reasoning_intent").map((s) => s.id)).toEqual(["toolsHaku", "toolsThinkerIntent"]);
    expect(toolsTour("directed", "radio").map((s) => s.id)).toEqual(["toolsHaku"]);
  });

  it("every data-tour target the steps point at is marked in a component", () => {
    const source = readdirSync(COMPONENTS).filter((f) => f.endsWith(".tsx")).map((f) => readFileSync(join(COMPONENTS, f), "utf8")).join("\n");
    for (const name of TOUR_TARGET_NAMES) expect(source, name).toContain(`data-tour="${name}"`);
    for (const step of [...practiceTour("substitutive"), ...toolsTour("substitutive")]) {
      const name = step.target?.match(/data-tour="([^"]+)"/)?.[1];
      if (name) expect(TOUR_TARGET_NAMES as readonly string[]).toContain(name);
    }
  });
});

describe("the tour in the session", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const scenario = buildDemoScenario();

  async function start(guidedTour: boolean, condition: "directed" | "substitutive" = "directed") {
    const o = new SessionOrchestrator(scenario, condition, { guidedTour });
    const box: { snap: SessionSnapshot | null } = { snap: null };
    o.subscribe((s) => (box.snap = s));
    await o.start();
    return { o, snap: () => box.snap! };
  }

  it("VP waits for the tour: no view time runs, then it starts from zero; the tour is logged", async () => {
    const { o, snap } = await start(true);
    expect(snap()).toMatchObject({ tour: "practice", step: "exploration" });
    await vi.advanceTimersByTimeAsync(300_000); // well past the panel, the freeze and the cap
    expect(snap()).toMatchObject({ tour: "practice", step: "exploration", secondsLeft: null });
    await o.completeTour(PRACTICE_TOUR.length);
    expect(snap().tour).toBeNull();
    await expect(o.completeTour(13)).rejects.toThrow(/no tour/);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(snap().step).toBe("exploration");
    await vi.advanceTimersByTimeAsync(1);
    expect(snap().step).toBe("allocation");
    const records = await o.logRecords();
    expect(records.find((r) => r.kind === "tour_completed")!.detail).toEqual({ cycle: 0, tour: "practice", stepsSeen: PRACTICE_TOUR.length, dwellMs: 300_000 });
    expect((records.find((r) => r.kind === "session_started")!.detail as { guidedTour?: boolean }).guidedTour).toBe(true);
  });

  it("V1 opens with the tool reminder, also held; later views have none", async () => {
    const { o, snap } = await start(true, "substitutive");
    await o.completeTour(PRACTICE_TOUR.length);
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    await o.completeTraining();
    expect(snap()).toMatchObject({ currentCycle: 1, tour: "tools" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snap().step).toBe("exploration");
    await o.completeTour(2);
    await runOutView(o, snap);
    await allocateAndConfirm(o, snap);
    expect(snap()).toMatchObject({ currentCycle: 2, tour: null });
  });

  it("without the option there is no tour (the default, as in the other session tests)", async () => {
    const { snap } = await start(false);
    expect(snap().tour).toBeNull();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(snap().step).toBe("allocation");
  });
});
