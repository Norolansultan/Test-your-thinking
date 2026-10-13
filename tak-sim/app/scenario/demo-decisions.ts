/**
 * The demo scenario's course-of-action items (SPEC/16) — SYNTHETIC PLACEHOLDER CONTENT (see
 * `content/demo/README.md`), not the authored, reviewed bank SPEC/16 §5 calls for.
 *
 * SPEC/26 §4: every main view has a decision item — SPEC/15 §9's decision-free cycles are
 * withdrawn. The practice view VP has one too (the normal decision phase, practised, not scored).
 */

import type { CycleIndex } from "../engine/primitives.js";
import { BRANCH_TEMPLATES } from "./demo-story.js";
import type { DecisionItem, PracticeView } from "./types.js";
import { MAIN_VIEWS, PRACTICE_VIEW_INDEX } from "./views.js";

/**
 * Researcher decision 1 Oct 2026: the item comes AFTER the allocation and asks the participant to
 * describe the allocation just logged, so its options no longer frame the allocation in advance.
 * The options describe an allocation ("Kohdennus …") with the same meaning and the same codes as
 * before (aligned/against × sound/unsound). The wording is the same in both groups and names no tool.
 */
export const DECISION_PROMPT_FI = "Mikä seuraavista kuvaa parhaiten juuri kirjaamaasi kohdennusta?";

function options(prefix: string): DecisionItem["options"] {
  return [
    { id: `${prefix}.A`, labelFi: "Kohdennus vahvistaa pääsuuntaa ja pitää linjan R1:llä, kuten painopiste edellyttää.", alignment: "aligned", soundness: "sound" },
    { id: `${prefix}.B`, labelFi: "Kohdennus siirtää kaikki yksiköt kylän suojaan riippumatta palon etenemisestä.", alignment: "aligned", soundness: "unsound" },
    { id: `${prefix}.C`, labelFi: "Kohdennus vahvistaa itäsivustaa, vaikka se ei ole nykyinen painopiste.", alignment: "against", soundness: "sound" },
    { id: `${prefix}.D`, labelFi: "Kohdennus vetää yksiköitä pois ilman erityistä perustetta.", alignment: "against", soundness: "unsound" },
  ];
}

export function buildDecisionItems(): DecisionItem[] {
  return MAIN_VIEWS.map((v) => ({
    id: `decision.cycle_${v.index}`,
    cycle: v.index as CycleIndex,
    promptFi: DECISION_PROMPT_FI,
    options: options(`d${v.index}`),
  }));
}

export function buildPracticeDecisionItem(): PracticeView["decisionItem"] {
  return {
    id: "decision.practice",
    cycle: PRACTICE_VIEW_INDEX,
    promptFi: `Harjoitus: ${DECISION_PROMPT_FI.charAt(0).toLowerCase()}${DECISION_PROMPT_FI.slice(1)}`,
    options: options("dP"),
  };
}

/** The practice judgement's candidate developments: the same four templates; the second ("the head keeps its direction, a little faster") is true, as the head accelerates at the block edge (SPEC/26 §3, VP). */
export function buildPracticeBranchStatements(): PracticeView["branchStatements"] {
  return BRANCH_TEMPLATES.map((statementFi, bi) => ({
    branchId: `branch.practice.${bi}`,
    cycle: PRACTICE_VIEW_INDEX,
    statementFi,
    truth: { isActualDevelopment: bi === 1 },
  }));
}
