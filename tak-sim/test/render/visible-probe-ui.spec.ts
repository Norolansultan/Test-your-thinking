/**
 * The visible-probe card (Type F, U; 5 Oct 2026; Type E withdrawn 6 Oct 2026). It uses hooks, so — as
 * `directive-ui.spec.ts` does — it is checked at the source: where it is mounted, that the map stays and
 * takes no area (Type E's marking is gone), that the decision strip is kept (hidden) under it, that every participant-facing string goes through
 * the language layer, and that both languages carry its interface text with no tool or conflict word.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";

const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");

describe("the visible-probe card", () => {
  it("is mounted under the map, which stays and takes no area; the decision strip is kept hidden under it", () => {
    const view = src("SessionView.tsx");
    expect(view).not.toMatch(/markedArea|areaPoints/);
    expect(view).toMatch(/snapshot\.visibleProbe && \(\s*<VisibleProbeCard/);
    expect(view).toMatch(/display: snapshot\.visibleProbe \? "none" : "flex"/);
    expect(src("MapView.tsx")).not.toMatch(/expectation-area/);
  });

  it("shows the prompt and the options through the language layer and takes no key", () => {
    const card = src("VisibleProbeCard.tsx");
    expect(card).toMatch(/tr\(probe\.promptFi\)/);
    expect(card).toMatch(/tr\(o\.fi\)/);
    expect(card).not.toMatch(/correct|invariant|expected|truth/i);
  });

  it("has its interface text in both languages, without tool or conflict words, English without Finnish", () => {
    for (const lang of ["fi", "en"] as const) {
      const v = UI_TEXT[lang].visibleProbe;
      const all = [v.title.U, v.yes, v.no, v.submit, v.note].join(" ");
      expect(all).not.toMatch(/thinker|tekoäly|\bAI\b|ristiri|inconsisten|conflict/i);
    }
    const en = UI_TEXT.en.visibleProbe;
    expect([en.title.U, en.yes, en.no, en.note, en.submit].join(" ")).not.toMatch(/\b(ja|ei|klo|palo|kartta|kello)\b/i);
  });
});
