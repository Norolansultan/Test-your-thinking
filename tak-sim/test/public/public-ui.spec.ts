/**
 * SPEC/35 P1 in the browser: the setting from the start page's URL to the session, `AudienceContext` at the session UI's root with
 * callbacks that write records through the orchestrator, the primer and the profile rendered through their contract props, and
 * the mission card and the chapter titles in public sessions only. The components are checked at the source, as the other UI
 * specs do (no DOM in the test environment).
 */

import { readFileSync } from "node:fs";
import type { VNode } from "preact";
import { describe, expect, it } from "vitest";
import { demoAudience, VersionSwitch, VERSION_SWITCH_TEXT } from "../../app/render/ui/VersionSwitch.js";

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
    // Revision (bp): the training incident's step replaces the map training's among the shell's steps (or is drawn by its own screen).
    expect(shell).toMatch(/"debrief", "primer", "profile", "results_optin"(?:, "(?:map_pretest|training_incident)")?\]\)/);
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

/** Every element with a `data-testid`, with its props (function components called). */
function byTestId(node: unknown, out = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) { for (const n of node) byTestId(n, out); return out; }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === "function") return byTestId((v.type as (p: unknown) => unknown)(v.props), out);
  const id = v.props?.["data-testid"];
  if (typeof id === "string") out.set(id, v.props);
  return byTestId(v.props?.children, out);
}

// 21 Oct 2026 (game mode removed): one simulation for everyone; the demonstration start page chooses the version for either group.
describe("the demonstration's version switch (SPEC/35 §2)", () => {
  it("is a segmented choice, professional by default; choosing the public version passes `audience: \"public\"` to the launcher", () => {
    let chosen = false;
    const ids = byTestId(VersionSwitch({ lang: "en", publicVersion: chosen, onChange: (v) => { chosen = v; } }));
    expect(ids.get("public-demo-toggle")?.role).toBe("radiogroup");
    expect(ids.get("version-professional")?.["aria-checked"]).toBe(true);
    expect(ids.get("version-public")?.["aria-checked"]).toBe(false);
    expect(demoAudience(chosen, false)).toEqual({ audience: "expert" });
    (ids.get("version-public")?.onClick as () => void)();
    expect(chosen).toBe(true);
    expect(demoAudience(chosen, false)).toEqual({ audience: "public" });
    const after = byTestId(VersionSwitch({ lang: "fi", publicVersion: chosen, onChange: (v) => { chosen = v; } }));
    expect(after.get("version-public")?.["aria-checked"]).toBe(true);
    (after.get("version-professional")?.onClick as () => void)();
    expect(demoAudience(chosen, false)).toEqual({ audience: "expert" });
  });

  it("never applies to a study link, which chooses the version with `?yleiso` only", () => {
    expect(demoAudience(true, true)).toEqual({});
    expect(demoAudience(false, true)).toEqual({});
  });

  it("names both versions in both languages", () => {
    expect(VERSION_SWITCH_TEXT.fi).toMatchObject({ professional: "Ammattilaisversio", public: "Yleisöversio" });
    expect(VERSION_SWITCH_TEXT.en).toMatchObject({ professional: "Professional version", public: "Public version" });
  });

  it("the start page shows it above the group buttons in a demonstration only, set from `?yleiso`, and has no game mode", () => {
    const app = code(`${UI}/App.tsx`);
    expect(app).toMatch(/\{choice\.kind === "choose" && !inStudy && <VersionSwitch lang=\{lang\} publicVersion=\{publicVersion\} onChange=\{setPublicVersion\} \/>\}\s*\{choice\.kind === "choose" && \(/);
    expect(app).toContain(`useState(() => !("invalid" in setting) && setting.audience === "public")`);
    expect(app).toMatch(/\{\.\.\.\("invalid" in setting \? \{\} : setting\)\} \{\.\.\.demoAudience\(publicVersion, study\)\}/);
    expect(app).not.toMatch(/game|GameApp|Pelitila/i);
  });
});
