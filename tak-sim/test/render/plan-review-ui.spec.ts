/**
 * The plan review on the screen (SPEC/32 §3; `PlanReviewPanel.tsx`): the decision strip's `plan_review` step, both groups —
 * the plan as recorded and the two buttons — and the guide group's premise lines with the records they cite, one of which
 * opens in the message log. Checked at the source, as `plan-draft-ui.spec.ts` and `spec30-ui.spec.ts` do (hooks cannot be
 * rendered in this test setup), plus the texts in both languages.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";

const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");
/** Finnish words that never belong in English text (as `test/i18n/coverage.spec.ts`). */
const FINNISH = /\b(ja|ei|noin|klo|kohdennus|kohdennusta|linjauksen|oletukset|vahvista|muuta|jakso|ilmoitus)\b/i;

describe("the plan review in the decision strip (SPEC/32 §3)", () => {
  it("is the strip's plan_review step, keyed by the view", () => {
    expect(src("JudgementPanel.tsx")).toMatch(/case "plan_review":\s*\/\/[^\n]*\n\s*return <PlanReviewPanel key=\{snapshot\.currentCycle\} snapshot=\{snapshot\} orchestrator=\{orchestrator\} onPlanDraft=\{onPlanDraft\} \/>;/);
  });

  it("shows the plan as recorded and the two buttons once its record is durable; revise reopens the form on the plan recorded", () => {
    const panel = src("PlanReviewPanel.tsx");
    expect(panel).toMatch(/const review = snapshot\.planReview;/);
    expect(panel).toMatch(/if \(!review\) return <Panel><p data-testid="plan-review-loading"/);
    expect(panel).toMatch(/planSummary\(snapshot\.recordedPlan, snapshot\.allocation\.sectors, snapshot\.allocation\.droneTeams\.length > 0, t, tr\)/);
    expect(panel).toMatch(/orchestrator\.keepPlan\(\)/);
    expect(panel).toMatch(/onPlanDraft\(draftFromPlan\(snapshot\.recordedPlan\)\); return orchestrator\.revisePlan\(\);/);
    expect(panel).toMatch(/\{r\.keep\}/);
    expect(panel).toMatch(/\{r\.revise\}/);
    expect(panel).not.toMatch(/correct|invariant|truth|score/i);
  });

  it("the guide group's premise lines only when the review carries them; a cited record opens through the session (logged)", () => {
    const panel = src("PlanReviewPanel.tsx");
    expect(panel).toMatch(/\{review\.premiseLines !== null && \(/);
    expect(panel).toMatch(/\{r\.premisesLabel\}/);
    expect(panel).toMatch(/onClick=\{\(\) => void orchestrator\.openReviewRecord\(c\.atomId\)/);
    expect(panel).toMatch(/<MessageLogRow entry=\{opened\} \/>/);
  });

  it("the opened record is marked in whichever message log is on screen (a context around both shells)", () => {
    expect(src("SessionView.tsx")).toMatch(/<OpenedRecordContext\.Provider value=\{snapshot\.planReview\?\.openedAtomId \?\? null\}>/);
    const rp = src("RightPanel.tsx");
    expect(rp).toMatch(/export const OpenedRecordContext = createContext<string \| null>\(null\);/);
    expect(rp).toMatch(/const opened = useContext\(OpenedRecordContext\);/);
    expect(rp).toMatch(/if \(highlighted\) ref\.current\?\.scrollIntoView\?\.\(\{ block: "nearest" \}\);/);
  });

  it("its texts in both languages (DRAFT); the English carries no Finnish word", () => {
    expect(UI_TEXT.fi.planReview).toMatchObject({ keep: "Vahvista kohdennus", revise: "Muuta kohdennusta", premisesLabel: "Thinker — linjauksen oletukset" });
    expect(UI_TEXT.en.planReview).toMatchObject({ keep: "Confirm the plan", revise: "Change the plan", premisesLabel: "Thinker — the directive's premises" });
    for (const [key, text] of Object.entries(UI_TEXT.en.planReview)) expect(text, key).not.toMatch(FINNISH);
    expect(readFileSync("app/i18n/ui.ts", "utf8")).toMatch(/\/\/ DRAFT \(SPEC\/32 §3, 20 Oct 2026\): native and domain review\.\n  planReview: \{/);
  });
});
