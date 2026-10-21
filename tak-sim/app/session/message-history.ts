/**
 * The message log's rows, split out of `orchestrator.ts` (21 Oct 2026, to keep it from growing): who the duty officer's messages
 * are from, a pushed record's row, and the rows a resume refills (SPEC/05 §9) without logging anything.
 */

import { toRenderable, type RenderableAtom } from "../boundary/render-boundary.js";
import { clockAtVirtual } from "../render/projection-validity.js";
import { PRACTICE_VIEW_INDEX, STEP_SECONDS } from "../scenario/views.js";
import type { InfoAtom, ScenarioContract, ViewSpec } from "../scenario/types.js";
import type { RadioLogEntry } from "./snapshot.js";
import { recordText } from "./template-answer.js";

/**
 * Who the duty officer's messages are from in the message log (4 Oct 2026): P2, the päivystävä
 * palopäällikkö, the participant's superior (was P3, usually the incident commander's own level).
 * DRAFT: the domain reviewer confirms the title.
 */
export const DUTY_OFFICER_ID = "P2";

/**
 * A pushed record's message-log label (systems review F2, 7 Oct 2026): its own traffic time (when it
 * reached the command post, else when it was observed), not the view's or step's start clock, so a
 * record reporting "klo 14.35" is not listed under 14:20. Delivery order is unchanged.
 */
export function recordClockLabel(atom: InfoAtom): string {
  return clockAtVirtual(atom.provenance.deliveredAt ?? atom.provenance.observedAt);
}

/** A record as the bubble history holds it and its row in the message log. */
export function logRowOf(atom: InfoAtom): { readonly renderable: RenderableAtom; readonly row: RadioLogEntry } {
  const renderable = toRenderable(atom);
  return { renderable, row: { id: renderable.id, clockLabel: recordClockLabel(atom), from: renderable.provenance.sourceId, text: recordText(renderable.record) } };
}

/**
 * What the practice view (`upToMainView` ≥ 0) and main views 1..upToMainView delivered, in delivery order: the bubble history and
 * the message log's rows (the duty officer's messages first in their view). Empty for `upToMainView` < 0.
 */
export function deliveredHistory(scenario: ScenarioContract, upToMainView: number): { readonly bubbles: RenderableAtom[]; readonly rows: RadioLogEntry[] } {
  const bubbles: RenderableAtom[] = [];
  const rows: RadioLogEntry[] = [];
  if (upToMainView < 0) return { bubbles, rows };
  const views: ViewSpec[] = [scenario.practice.cycle, ...scenario.cycles.filter((c) => c.index <= upToMainView)];
  for (const spec of views) {
    if (spec.index !== PRACTICE_VIEW_INDEX) {
      for (const { text } of scenario.dutyOfficerMessages.filter((m) => m.cycle === spec.index)) rows.push({ clockLabel: spec.clockLabel, from: DUTY_OFFICER_ID, text });
    }
    const push = (from: number, to: number) => {
      for (const [k, atomId] of spec.pushedAtomIds.entries()) {
        const t = spec.deliveryOffsetsSeconds[k]!;
        if (t < from || t >= to) continue;
        const { renderable, row } = logRowOf(scenario.atoms.find((a) => a.id === atomId)!);
        bubbles.push(renderable);
        rows.push(row);
      }
    };
    push(0, spec.stepBoundary ? STEP_SECONDS : Infinity);
    if (spec.stepBoundary) push(STEP_SECONDS, Infinity);
  }
  return { bubbles, rows };
}
