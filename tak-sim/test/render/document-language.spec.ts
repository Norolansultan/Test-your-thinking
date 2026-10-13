/**
 * The page's language and title follow the session language (final review, 6 Oct 2026). `index.html`
 * is static: an English study session ran under `<html lang="fi">` with the tab titled "Maastopalo —
 * esikatselu", and a study link's start-page messages defaulted to Finnish. Checked at the source,
 * as the other UI specs (the components use hooks and MapLibre).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";

const src = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");

describe("the document's language and title", () => {
  it("are set from the session language on the start page, in the session and on the resume screens", () => {
    expect(src("i18n.ts")).toMatch(/document\.documentElement\.lang = lang;\s*document\.title = UI_TEXT\[lang\]\.pageTitle;/);
    expect(src("App.tsx")).toMatch(/useDocumentLanguage\(lang\)/);
    expect(src("components/SessionView.tsx")).toMatch(/useDocumentLanguage\(language\)/);
    expect(src("SessionLauncher.tsx").match(/useDocumentLanguage\(lang\)/g)).toHaveLength(2); // the resume offer and the pending upload
  });

  it("have a title in both languages, and the static page starts in English (the study's language)", () => {
    expect(UI_TEXT.en.pageTitle).toBe("Wildfire");
    expect(UI_TEXT.fi.pageTitle).toBe("Maastopalo");
    const html = src("index.html");
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>Wildfire<\/title>/);
  });

  it("a study link without a stored choice opens in English, so its start-page messages are English", () => {
    const app = src("App.tsx");
    expect(app).toMatch(/has\(STUDY_PARAM\) \? "en" : DEFAULT_LANG/);
    expect(UI_TEXT.en.cellMissing).toMatch(/participant code/);
  });
});
