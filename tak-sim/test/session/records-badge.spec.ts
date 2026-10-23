/**
 * The "New records" badge on the Haku button (difficulty audit, 23 Oct 2026; `proposal.md` (a.4), the number-free default): set at
 * every view's start and step boundary unless Haku is open, cleared when Haku is opened; content-free (a flag, no count), the same in
 * both groups, and never logged (its state follows from `cycle_start`, `step_boundary_reached` and `tab_selected`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SessionOrchestrator, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { completeView } from "./session-run.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const scenario = buildDemoScenario();

function start(condition: "directed" | "substitutive") {
  const o = new SessionOrchestrator(scenario, condition, { previewOverride: { minViewSeconds: 5 }, realClockMs: () => Date.now() });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((s) => (box.snap = s));
  return { o, snap: () => box.snap! };
}

describe("the 'New records' badge (difficulty audit (a.4))", () => {
  for (const condition of ["directed", "substitutive"] as const) {
    it(`${condition}: on at a view's start, cleared by opening Haku (not by another tool), on again at the step boundary and the next view`, async () => {
      vi.setSystemTime(0);
      const { o, snap } = start(condition);
      await o.start();
      expect(snap()).toMatchObject({ currentCycle: 0, recordsBadge: true });
      if (condition === "substitutive") { await o.logTabSelected("open_thinker"); expect(snap().recordsBadge).toBe(true); }
      await o.logTabSelected("haku");
      expect(snap().recordsBadge).toBe(false);
      await o.logTabSelected("none");
      expect(snap().recordsBadge).toBe(false); // closing Haku does not bring it back
      await completeView(o, snap); // VP, the training
      expect(snap()).toMatchObject({ currentCycle: 1, recordsBadge: true });
      await completeView(o, snap); // V1
      expect(snap()).toMatchObject({ currentCycle: 2, recordsBadge: true }); // V2, a merged view
      await o.logTabSelected("haku");
      expect(snap().recordsBadge).toBe(false);
      await o.logTabSelected("none");
      while (!(await o.logRecords()).some((r) => r.kind === "step_boundary_reached")) await vi.advanceTimersByTimeAsync(250);
      expect(snap().recordsBadge).toBe(true);
    });
  }

  it("is not set while Haku is open (at the step boundary or the next view's start), and writes no record of its own", async () => {
    vi.setSystemTime(0);
    const { o, snap } = start("directed");
    await o.start();
    await completeView(o, snap);
    await completeView(o, snap); // to V2
    await o.logTabSelected("haku");
    while (!(await o.logRecords()).some((r) => r.kind === "step_boundary_reached")) await vi.advanceTimersByTimeAsync(250);
    expect(snap().recordsBadge).toBe(false);
    expect((await o.logRecords()).some((r) => /badge/.test(r.kind))).toBe(false);
  });

  it("is content-free on screen: one fixed text per language, no number, on the Haku button of both layouts", () => {
    expect(UI_TEXT.fi.recordsBadge).toBe("Uusia kirjauksia");
    expect(UI_TEXT.en.recordsBadge).toBe("New records");
    for (const f of ["app/render/ui/tak/TakToolbar.tsx", "app/render/ui/components/RightPanel.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("t.recordsBadge");
      expect(src, f).toMatch(/recordsBadge/);
    }
  });
});
