/**
 * SPEC/35 §3 item 2, §9 P2: `Glossed` — the text unchanged for experts, the marks in a public session, the same marking in
 * both groups — and every participant-visible text surface wrapped with its surface. Checked through the pure parts
 * (`glossedSegments`, `tipPosition`) and at the source, as the other UI specs do (hooks cannot be rendered in this setup).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { glossedSegments } from "../../app/render/ui/explain/glossary.js";
import { tipPosition } from "../../app/render/ui/explain/Glossed.js";

const code = (f: string) => readFileSync(`app/render/ui/${f}`, "utf8");

const TEXTS = {
  fi: ["EK12, kärki, eteläsivusta: letkulinja 700 m, vettä 25 %.", "Mitä 20 kV:n sähkölinjan tila merkitsee sammutustyölle linjan lähellä?", "Ei osumia."],
  en: ["EK12, head, south flank: hose line 700 m, water 25 %.", "What does the state of the 20 kV power line mean for firefighting near the line?", "Nothing."],
} as const;

describe("Glossed (SPEC/35 §3 item 2)", () => {
  it("draws the text as it always was in an expert session: no segments, one text node", () => {
    for (const lang of ["fi", "en"] as const) for (const t of TEXTS[lang]) expect(glossedSegments("expert", lang, t)).toBeNull();
    const g = code("explain/Glossed.tsx");
    expect(g).toMatch(/const segments = glossedSegments\(audience, lang, text\);\n\s*if \(segments === null\) return <>\{text\}<\/>;/);
  });

  it("marks terms in a public session", () => {
    const segs = glossedSegments("public", "fi", TEXTS.fi[0])!;
    expect(segs.filter((s) => s.kind === "term").map((s) => s.text)).toEqual(["EK12", "kärki", "eteläsivusta", "letkulinja"]);
    expect(glossedSegments("public", "en", TEXTS.en[1])!.filter((s) => s.kind === "term").map((s) => s.text)).toEqual(["20 kV power line"]);
  });

  it("marks the same in both groups: the marking reads only the audience, the language and the text — never the cell or the condition", () => {
    for (const lang of ["fi", "en"] as const) for (const t of TEXTS[lang]) expect(glossedSegments("public", lang, t)).toEqual(glossedSegments("public", lang, t));
    for (const f of ["explain/Glossed.tsx", "explain/glossary.ts"]) expect(code(f)).not.toMatch(/condition|substitutive|directed|aiPresent|cell\b|snapshot/);
  });

  it("is keyboard accessible, reports each opening with its surface, and never blocks an answer", () => {
    const g = code("explain/Glossed.tsx");
    expect(g).toMatch(/role="button" tabIndex=\{0\}/);
    expect(g).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
    expect(g).toMatch(/e\.key === "Escape"/);
    expect(g).toMatch(/onGlossaryOpened\(termId, surface\);/);
    expect(g).toMatch(/pointerEvents: "none"/); // the tooltip takes no click
    expect(g).toMatch(/e\.preventDefault\(\); \/\/ a tap opens the definition only/);
    expect(g).not.toMatch(/Date\.now|performance\.now|Math\.random/);
  });

  it("puts the tooltip above its term when there is room, else below, always inside the window", () => {
    expect(tipPosition({ left: 100, top: 400, bottom: 418 }, 1280, 800)).toEqual({ left: 100, top: 394, width: 300, above: true });
    expect(tipPosition({ left: 100, top: 40, bottom: 58 }, 1280, 800)).toEqual({ left: 100, top: 64, width: 300, above: false });
    expect(tipPosition({ left: 1200, top: 400, bottom: 418 }, 1280, 800).left).toBe(1280 - 300 - 8);
    const phone = tipPosition({ left: 5, top: 300, bottom: 318 }, 300, 640);
    expect(phone.width).toBe(284);
    expect(phone.left).toBe(8);
  });
});

describe("every participant-visible text surface is wrapped, with its surface", () => {
  const cases: [string, RegExp[]][] = [
    ["components/RightPanel.tsx", [
      /<Glossed text=\{rec\(entry\.id, entry\.text\)\} surface="message_log" \/>/,
      /<Glossed text=\{displayAnswerText\(turn\.answer\.answerFi\)\} surface="search" \/>/,
      /<Glossed text=\{displayAnswerText\(turn\.answer\.wouldChangeIfFi\)\} surface="search" \/>/,
      /<Glossed text=\{displayAnswerText\(turn\.answer\)\} surface="guide" \/>/,
      /<HelpCard \/>/,
    ]],
    ["components/Drawers.tsx", [/surface="search" \/>/]],
    ["components/FreezeScreen.tsx", [/<Glossed text=\{tr\(item\.promptFi\)\} surface="freeze" \/>/, /<Glossed text=\{tr\(opt\.labelFi\)\} surface="freeze" \/>/]],
    ["components/SpamCard.tsx", [/<Glossed text=\{tr\(spam\.promptFi\)\} surface="spam" \/>/, /<Glossed text=\{tr\(o\.fi\)\} surface="spam" \/>/]],
    ["components/DecisionPanels.tsx", [/<Glossed text=\{t\.postures\[p\]\} surface="plan" \/>/, /<Glossed text=\{t\.secondaryTasks\[id\]\} surface="plan" \/>/, /<Glossed text=\{t\.droneTasks\[id\]\} surface="plan" \/>/]],
    ["components/JudgementPanel.tsx", [/<Glossed text=\{tr\(snapshot\.hingeDirective\)\} surface="plan" \/>/, /<Glossed text=\{tr\(check\.promptFi\)\} surface="plan" \/>/]],
    ["components/PlanReviewPanel.tsx", [/<Glossed text=\{line\} surface="review" \/>/, /surface="review" \/>/, /<GlossSurfaceContext\.Provider value="record"><MessageLogRow entry=\{opened\} \/><\/GlossSurfaceContext\.Provider>/]],
    ["components/OpenAnswerView.tsx", [/<Glossed text=\{displayAnswerText\(f\.text\)\} surface="guide" \/>/, /<Glossed text=\{displayAnswerText\(o\.option\)\} surface="guide" \/>/, /<Glossed text=\{displayAnswerText\(answer\.inference\)\} surface="guide" \/>/]],
    ["components/Legend.tsx", [/<Glossed text=\{label\} surface=\{surface\} \/>/]],
    ["tak/TakToolbar.tsx", [/<HelpCard variant="toolbar" \/>/]],
  ];
  it.each(cases)("%s", (file, patterns) => {
    const src = code(file);
    for (const p of patterns) expect(src).toMatch(p);
  });

  it("the opened record reports as a record: the surface context overrides the row's own", () => {
    expect(code("explain/Glossed.tsx")).toMatch(/const surface = useContext\(GlossSurfaceContext\) \?\? own;/);
  });

  it("the persistent directive banner keeps its literal wording in both shells (it is glossed where it is first shown, at the hinge)", () => {
    expect(code("components/RightPanel.tsx")).toMatch(/>\{tr\(snapshot\.directiveInForce\)\}<\/div>/);
    expect(code("tak/TakMapChrome.tsx")).toMatch(/\{tr\(directive\)\}/);
  });

  it("the GeoChat pane and the log under a search tool show the classic row (so they are wrapped with it)", () => {
    expect(code("tak/GeoChatPane.tsx")).toMatch(/<MessageLogRow key=\{index\} entry=\{entry\} wrapSource \/>/);
  });

  it("no wrapped text is rewritten: Glossed gets the text exactly as the component showed it before", () => {
    for (const file of ["components/RightPanel.tsx", "components/FreezeScreen.tsx", "components/SpamCard.tsx", "components/OpenAnswerView.tsx"]) {
      for (const m of code(file).matchAll(/<Glossed text=\{([^}]*(?:\}[^}]*)?)\} surface/g)) expect(m[1], file).not.toMatch(/replace\(|toUpperCase|slice\(/);
    }
  });
});
