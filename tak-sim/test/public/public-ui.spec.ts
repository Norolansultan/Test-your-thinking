/**
 * SPEC/35 P1 in the browser: the setting from the start page's URL to the session, `AudienceContext` at the session UI's root with
 * callbacks that write records through the orchestrator, the primer and the profile rendered through their contract props, and
 * the mission card and the chapter titles in public sessions only. The components are checked at the source, as the other UI
 * specs do (no DOM in the test environment).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const UI = "app/render/ui";

describe("the public-audience version in the UI (SPEC/35 P1)", () => {
  it("the start page reads `?yleiso` and `?laajuus=` and hands them to the launcher, which passes them to the session", () => {
    const app = code(`${UI}/App.tsx`);
    expect(app).toContain("sessionSettingFromUrl(search)");
    expect(app).toMatch(/kind: "invalid", message: setting\.invalid/);
    expect(app).toContain(`{...("invalid" in setting ? {} : setting)}`);
    expect(code(`${UI}/SessionLauncher.tsx`)).toMatch(/readonly audience\?: Audience \| undefined; readonly scope\?: SessionScope \| undefined;/);
    const view = code(`${UI}/components/SessionView.tsx`);
    expect(view).toMatch(/studyShell, allowPreflightOverride, allowViewSkip, \.\.\.setting \}/);
  });

  it("provides `AudienceContext` at the session UI's root; its callbacks only write records (`recordAudienceEvent`)", () => {
    const view = code(`${UI}/components/SessionView.tsx`);
    expect(view).toContain("<AudienceContext.Provider value={audience}>");
    for (const screen of ["provide(<StudyShell", "provide(<IntroScreen", "return provide(\n    <OpenedRecordContext.Provider"]) expect(view).toContain(screen);
    const hook = code(`${UI}/useSession.ts`);
    expect(hook).toContain(`if (o.audience !== "public") return EXPERT_AUDIENCE;`);
    expect(hook).toContain(`o.recordAudienceEvent({ kind: "glossary_opened", termId, surface })`);
    expect(hook).toContain(`o.recordAudienceEvent({ kind: "help_card_opened", section })`);
  });

  it("the study shell shows the primer and the profile through their contract props, logging through the orchestrator", () => {
    const shell = code(`${UI}/components/StudyShell.tsx`);
    expect(shell).toMatch(/"debrief", "primer", "profile"\]\)/);
    expect(shell).toContain("orchestrator.primerPage(pageId, dwellMs)");
    expect(shell).toContain("orchestrator.primerCheck(questionId, chosen, correct, attempt)");
    expect(shell).toContain("orchestrator.finishPrimer()");
    expect(shell).toContain("<ProfileScreen lang={lang} records={records} onDone={() => void orchestrator.finishProfile()");
    expect(shell.match(/textOf\(lang, orchestrator\)/g)).toHaveLength(3); // consent, questionnaire, debrief
  });

  it("the mission card and the chapter titles appear in public sessions only", () => {
    expect(code(`${UI}/components/IntroScreen.tsx`)).toContain(`useAudience().audience === "public" ? PUBLIC_TEXT[lang].mission : null`);
    expect(code(`${UI}/components/StatusStrip.tsx`)).toContain(`useAudience().audience === "public" ? chapterLabel(lang, snapshot.currentCycle) : null`);
  });
});
