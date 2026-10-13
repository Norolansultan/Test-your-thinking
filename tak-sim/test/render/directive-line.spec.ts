/**
 * The strategy-guided Thinker's directive line (phase B round 2, D2) is withdrawn (Haku / Open
 * Thinker redesign, researcher, 8 Oct 2026): `linjaus` no longer appears anywhere visible. The Haku
 * tab's chat shows the four parts only, the same in every cell; the type stays for old logs.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";

describe("the directive line is withdrawn (8 Oct 2026)", () => {
  it("the chat panel renders no linjaus and has no directive line", () => {
    const code = readFileSync("app/render/ui/components/RightPanel.tsx", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/linjaus|DirectiveLine/);
  });

  it("the interface texts carry no directive-line labels", () => {
    for (const lang of ["fi", "en"] as const) {
      expect(UI_TEXT[lang]).not.toHaveProperty("directiveLine");
      expect(UI_TEXT[lang]).not.toHaveProperty("linjausStatus");
    }
  });

  it("the Haku tab's input names no Thinker, in either language (it is the same in both groups)", () => {
    expect(UI_TEXT.fi.askPlaceholder).not.toMatch(/thinker/i);
    expect(UI_TEXT.en.askPlaceholder).not.toMatch(/thinker/i);
    expect(UI_TEXT.fi.openThinkerPlaceholder).not.toBe(UI_TEXT.en.openThinkerPlaceholder);
  });
});
