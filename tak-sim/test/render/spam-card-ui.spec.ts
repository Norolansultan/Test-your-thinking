/**
 * The SPAM card (revision (ag), 9 Oct 2026). It uses hooks, so — as `visible-probe-ui.spec.ts` does — it
 * is checked at the source: the "Ready" button is a high-contrast amber fill with dark text, larger, with
 * a glow that `prefers-reduced-motion` turns off; the prompt collapses to a pill that keeps that styling;
 * a forced item is a modal over the map column, which the session view makes the positioning parent;
 * the decision strip is held by `decisionHeld` (not the tools' lock); both languages carry the new texts,
 * which name no tool.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "../../app/i18n/ui.js";

const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");

/** WCAG relative luminance contrast of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the SPAM card", () => {
  const card = src("SpamCard.tsx");

  it("makes Ready unmistakable: an amber fill with dark text (≥ 7:1), larger type, a glow that reduced motion turns off", () => {
    expect(card).toMatch(/const AMBER = "#f4a261"/);
    expect(card).toMatch(/const INK = "#1c1b19"/);
    expect(contrast("#f4a261", "#1c1b19")).toBeGreaterThanOrEqual(7);
    expect(card).toMatch(/background: AMBER, color: INK/);
    expect(card).toMatch(/fontSize: 16, fontWeight: 700/);
    expect(card).toMatch(/@keyframes spam-glow/);
    expect(card).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.spam-attention \{ animation: none; \} \}/);
    expect(card).toMatch(/data-testid="spam-ready-button" className="spam-attention/);
  });

  it("collapses to a pill that keeps the styling and expands on a click; a forced item is a modal over the map column", () => {
    expect(card).toMatch(/data-testid="spam-pill" className="spam-attention"/);
    expect(card).toMatch(/orchestrator\.expandSpam\(\)/);
    expect(card).toMatch(/orchestrator\.collapseSpam\(\)/);
    expect(card).toMatch(/role="dialog" aria-modal="true"/);
    expect(card).toMatch(/position: "absolute", inset: 0/);
    const view = src("SessionView.tsx");
    expect(view).toMatch(/flexDirection: "column", minWidth: 0, position: "relative"/);
    expect(view).toMatch(/inert=\{snapshot\.decisionHeld\}/);
    expect(card).not.toMatch(/correct|invariant|expected|truth/i);
  });

  it("has the new texts in both languages: the pill, the forced item's title and note; no tool is named", () => {
    for (const lang of ["fi", "en"] as const) {
      const s = UI_TEXT[lang].spam;
      const all = [s.collapse, s.waiting, s.note, s.forcedTitle, s.forcedNote].join(" ");
      expect(all.length).toBeGreaterThan(20);
      expect(all).not.toMatch(/thinker|tekoäly|\bAI\b|haku\b/i);
    }
    expect(UI_TEXT.en.spam.note).toMatch(/search tools stay available/);
    expect(UI_TEXT.fi.spam.note).toMatch(/hakutyökalut ovat käytössä/);
    expect(UI_TEXT.en.spam.forcedNote).toMatch(/clock is paused/);
    expect(UI_TEXT.fi.spam.forcedNote).toMatch(/Kello on pysäytetty/);
  });
});
