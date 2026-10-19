/**
 * SPEC/30 on the screen (19 Oct 2026): the consult notification (a plain component, rendered here by calling it), the
 * guide's suggested-question chip above the Thinker's input, the plan-confidence item in the decision strip, the
 * SPAM card's item count, and the §5.4 interaction emitters (`decision_option_hovered` in the plan panel,
 * `probe_option_hovered` / `probe_answer_changed` in the SPAM card) — the hook-using components checked at the source,
 * as `spam-card-ui.spec.ts` does. Both languages carry the new texts; the English carries no Finnish word.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { VNode } from "preact";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { ConsultNotice } from "../../app/render/ui/components/ConsultNotice.js";
import { decisionOptionId } from "../../app/render/ui/components/DecisionPanels.js";

const src = (f: string) => readFileSync(`app/render/ui/components/${f}`, "utf8");

/** Every element with a `data-testid` in a rendered vnode tree, with its props (function components called). */
function byTestId(node: unknown, out = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) { for (const n of node) byTestId(n, out); return out; }
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === "function") return byTestId((v.type as (p: unknown) => unknown)(v.props), out);
  const id = v.props?.["data-testid"];
  if (typeof id === "string") out.set(id, v.props);
  return byTestId(v.props?.children, out);
}
const textOf = (node: unknown): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object") return textOf((node as VNode<{ children?: unknown }>).props?.children);
  return "";
};

describe("the consult notification on the screen (SPEC/30 §4)", () => {
  it("one button opening the group's tool and a close button; the notice's text and nothing else", () => {
    for (const lang of ["en", "fi"] as const) {
      for (const tool of ["haku", "thinker"] as const) {
        const onOpen = vi.fn(), onDismiss = vi.fn();
        const tree = ConsultNotice({ prompt: { tool }, text: UI_TEXT[lang].consult, onOpen, onDismiss });
        const ids = byTestId(tree);
        expect([...ids.keys()].sort()).toEqual(["consult-dismiss", "consult-notice", "consult-open"]);
        expect(ids.get("consult-notice")).toMatchObject({ role: "status", "data-tool": tool }); // non-modal: a status, no dialog
        expect(textOf(ids.get("consult-open")!.children)).toBe(tool === "haku" ? UI_TEXT[lang].consult.openHaku : UI_TEXT[lang].consult.openThinker);
        expect(ids.get("consult-dismiss")).toMatchObject({ "aria-label": UI_TEXT[lang].consult.close });
        (ids.get("consult-open")!.onClick as () => void)();
        (ids.get("consult-dismiss")!.onClick as () => void)();
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(textOf(tree)).toContain(UI_TEXT[lang].consult.notice);
      }
    }
    expect(UI_TEXT.en.consult.notice).toBe("New reports since your last plan");
    expect(UI_TEXT.fi.consult.notice).toBe("Uusia ilmoituksia edellisen suunnitelmasi jälkeen"); // DRAFT, native check (SPEC/30 §8)
    expect(src("ConsultNotice.tsx")).not.toMatch(/useLang|useState|useEffect/); // a plain function of its props
  });

  it("the classic shell shows it under the tool buttons; its button opens the tool after consult_prompt_opened is durable", () => {
    const panel = src("RightPanel.tsx");
    expect(panel).toMatch(/snapshot\.consultPrompt && \(\s*<ConsultNotice prompt=\{snapshot\.consultPrompt\} text=\{t\.consult\}/);
    expect(panel).toMatch(/orchestrator\.openConsultPrompt\(\)\.then\(\(consulted\) => \{/);
    expect(panel).toMatch(/consulted === "haku" \? "haku" : "ai"/);
    expect(panel).toMatch(/if \(toolRef\.current !== next\) select\(next\)/); // left open when it already is (no toggle)
    expect(panel).toMatch(/orchestrator\.dismissConsultPrompt\(\)/);
  });
});

describe("the suggested-question chip (SPEC/30 §4)", () => {
  it("sits above the Thinker's input, only when the snapshot offers it, and submits through askSuggestedQuestion", () => {
    const panel = src("RightPanel.tsx");
    const chat = panel.slice(panel.indexOf("export function OpenAiChat"), panel.indexOf("function MessageLog"));
    expect(chat).toMatch(/snapshot\.suggestedQuestion && \(/);
    expect(chat).toMatch(/data-testid="thinker-chip"/);
    expect(chat).toMatch(/q\.askVia\(\(\) => orchestrator\.askSuggestedQuestion\(\)\)/);
    expect(chat).toMatch(/\{t\.consult\.chip\}/);
    expect(chat.indexOf("thinker-chip")).toBeLessThan(chat.indexOf("<QuestionInput"));
    const haku = panel.slice(panel.indexOf("export function HakuChat"), panel.indexOf("export function OpenAiChat"));
    expect(haku).not.toMatch(/suggestedQuestion|thinker-chip/); // not in Haku
  });
});

describe("the plan-confidence item (SPEC/30 §5.4)", () => {
  it("is the decision strip's plan_confidence step: the question and the one scale with its confirm, once its record is durable", () => {
    const judgement = src("JudgementPanel.tsx");
    expect(judgement).toMatch(/case "plan_confidence":\s*\/\/[^\n]*\n\s*return <PlanConfidencePanel key=\{snapshot\.currentCycle\}/);
    const item = src("PlanConfidencePanel.tsx");
    expect(item).toMatch(/const item = snapshot\.planConfidence;/);
    expect(item).toMatch(/\{item && \(/);
    expect(item).toMatch(/<ConfidenceRow value=\{value\} onChange=\{setValue\} onConfirm=\{confirm\}/);
    expect(item).toMatch(/orchestrator\.submitPlanConfidence\(value\)/);
    expect(item).toMatch(/t\.planConfidence\.prompt/);
    expect(item).not.toMatch(/correct|invariant|truth/i);
    expect(UI_TEXT.en.planConfidence.prompt).toBe("How confident are you that your plan fits the situation?");
    expect(UI_TEXT.fi.planConfidence.prompt).toBe("Kuinka varma olet, että suunnitelmasi sopii tilanteeseen?"); // DRAFT
  });
});

describe("the §5.4 interaction emitters", () => {
  it("the plan panel: every option logs decision_option_hovered through the dwell, `<row>:<value>`", () => {
    const panel = src("DecisionPanels.tsx");
    const plan = panel.slice(panel.indexOf("export function PlanPanel"));
    expect(plan).toMatch(/useHoverDwell\(\(optionId\) => void orchestrator\.logPanelUse\(\{ kind: "decision_option_hovered", detail: \{ optionId \} \}\)/);
    const choices = plan.match(/<Choice\b[^>]*>/g) ?? [];
    expect(choices.length).toBeGreaterThanOrEqual(9);
    for (const c of choices) expect(c, c).toMatch(/hover=\{hover\("(main_effort|posture|secondary|secondary_task|drones|drone_task|departure_reason)", /);
    expect(decisionOptionId("main_effort", "L2")).toBe("main_effort:L2");
    expect(decisionOptionId("drones", "carry_on")).toBe("drones:carry_on");
    expect(src("PanelParts.tsx")).toMatch(/onPointerEnter: hover\.onPointerEnter, onPointerLeave: hover\.onPointerLeave/);
  });

  it("the SPAM card: probe_option_hovered on the item's options, probe_answer_changed logged before the answer", () => {
    const card = src("SpamCard.tsx");
    expect(card).toMatch(/useHoverDwell\(\(optionId\) => quiet\(orchestrator\.logPanelUse\(\{ kind: "probe_option_hovered", detail: \{ probeId: spam\.probeId, optionId \} \}\)\)\)/);
    expect(card).toMatch(/\{\.\.\.\(spam\.phase === "item" \? hover\(o\.id\) : \{\}\)\}/);
    const choose = card.slice(card.indexOf("const choose"), card.indexOf("if (spam.phase === \"ready\")"));
    expect(choose.indexOf("probe_answer_changed")).toBeGreaterThan(-1);
    expect(choose.indexOf("probe_answer_changed")).toBeLessThan(choose.indexOf("orchestrator.answerSpam(to)"));
    expect(card).toMatch(/onClick=\{\(\) => choose\(spam\.probeId, spam\.chosen, o\.id\)\}/);
    // Hooks before any early return.
    expect(card.indexOf("useHoverDwell")).toBeLessThan(card.indexOf("if (spam.phase === \"ready\")"));
  });

  it("the SPAM card shows the item's place in a two-item delivery (SPEC/30 §5.2)", () => {
    expect(src("SpamCard.tsx")).toMatch(/spam\.itemCount > 1 && <span data-testid="spam-item-of"> · \{t\.spam\.itemOf\(spam\.itemIndex, spam\.itemCount\)\}<\/span>/);
    expect(UI_TEXT.en.spam.itemOf(2, 2)).toBe("Question 2 of 2");
    expect(UI_TEXT.fi.spam.itemOf(1, 2)).toBe("Kysymys 1/2");
  });
});
