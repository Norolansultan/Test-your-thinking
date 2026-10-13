/**
 * EXCON (SPEC/28 §8) — the "CoT" tab: the view step's Cursor-on-Target stream, compiled by the TAK pipeline's
 * own compiler (`app/tak/compile.ts` `compileViewCot`, SPEC/28 §2) from the participant's render tree. No
 * second compiler here: this only assembles the compiler's input the way `tools/tak/export.ts`
 * (`sessionCotInputs`) does — the step's map state and projection from {@link participantPicture}, the reports
 * delivered in the step passed through the render boundary (`bubble_delivered` → `toRenderable`), and the
 * duty officer's messages. That module is Node-only (it writes files), so it cannot be imported into a page.
 * Drone battery levels are left out (optional in the compiler's input).
 */

import type { RenderableAtom } from "../boundary/render-boundary.js";
import { applyRenderEvent } from "../render/render-tree.js";
import { compileViewCot, COT_STEP_SECONDS, type CotChatLine, type DeliveredBubble } from "../tak/compile.js";
import { serializeCot, type CotEvent } from "../tak/cot.js";
import { participantPicture, viewSpecOf, type ExconWorld } from "./world.js";

/** Who the duty officer's messages are from (as in `tools/tak/export.ts` and the orchestrator). */
const DUTY_OFFICER_ID = "P2";

export interface CotRow {
  readonly uid: string;
  readonly type: string;
  readonly how: string;
  /** ISO-8601 UTC. */
  readonly time: string;
  readonly kind: string;
  readonly callsign: string | null;
  readonly xml: string;
}

export type CotRowsResult =
  | { readonly status: "ok"; readonly rows: readonly CotRow[] }
  | { readonly status: "unavailable"; readonly reason: string };

/** The compiler's events for one view step (the participant's picture only — never truth). */
export function cotEventsForStep(world: ExconWorld, viewIndex: number, stepShown: 1 | 2): CotEvent[] {
  const { scenario } = world;
  const spec = viewSpecOf(scenario, viewIndex);
  let tree = participantPicture(scenario, viewIndex, stepShown);
  const [from, to] = stepShown === 2 ? [COT_STEP_SECONDS, Infinity] : [0, spec.stepBoundary ? COT_STEP_SECONDS : Infinity];
  const byId = new Map(scenario.atoms.map((a) => [a.id, a] as const));
  const bubbles: DeliveredBubble[] = [];
  spec.pushedAtomIds.forEach((id, k) => {
    const offset = spec.deliveryOffsetsSeconds[k]!;
    const atom = byId.get(id);
    if (!atom || offset < from || offset >= to) return;
    tree = applyRenderEvent(tree, { kind: "bubble_delivered", atom });
    const renderable: RenderableAtom = tree.bubbles[tree.bubbles.length - 1]!;
    bubbles.push({ atom: renderable, deliveredAtVirtual: spec.startsAtVirtual + offset });
  });
  const chatLines: CotChatLine[] = viewIndex === 0 || stepShown === 2 ? [] : scenario.dutyOfficerMessages
    .filter((m) => m.cycle === viewIndex)
    .map((m) => ({ id: m.isStrategicGuidance ? scenario.hinge.guidanceMessageId : `duty.cycle_${viewIndex}`, sourceId: DUTY_OFFICER_ID, atVirtual: m.at, text: m.text }));
  return compileViewCot({ cycle: tree.cycleInfo!, envelope: tree.envelope, bubbles, chatLines, lang: "en" });
}

const cache = new WeakMap<ExconWorld, Map<string, CotRowsResult>>();

/** The view step's CoT as table rows (memoised: the panel re-renders while playback runs). */
export function cotRowsForView(world: ExconWorld, viewIndex: number, stepShown: 1 | 2): CotRowsResult {
  let byStep = cache.get(world);
  if (!byStep) { byStep = new Map(); cache.set(world, byStep); }
  const key = `${viewIndex}:${stepShown}`;
  const hit = byStep.get(key);
  if (hit) return hit;
  const result = compileRows(world, viewIndex, stepShown);
  byStep.set(key, result);
  return result;
}

function compileRows(world: ExconWorld, viewIndex: number, stepShown: 1 | 2): CotRowsResult {
  try {
    const rows = cotEventsForStep(world, viewIndex, stepShown).map((e) => ({
      uid: e.uid, type: e.type, how: e.how, time: e.time, kind: e.detail.taksim.kind, callsign: e.detail.contact?.callsign ?? null, xml: serializeCot(e),
    }));
    return { status: "ok", rows };
  } catch (e) {
    return { status: "unavailable", reason: `the CoT compiler failed on this step: ${e instanceof Error ? e.message : String(e)}` };
  }
}
