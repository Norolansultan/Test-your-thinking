/**
 * Messages into views — SPEC/26 §6 ("Traffic corpus: kept, with real timestamps").
 *
 * Every message keeps its step (`cycle`) and its real time (`sim_time_s`). It belongs to the view
 * that contains its step; in a merged view the second step's messages arrive in the second half of
 * the view (offset + 1200 s). Prologue steps W1–W4 are history: in the database, never pushed.
 *
 * Push thinning. A merged view would carry two steps of pushed traffic, so the ROUTINE pushed items
 * of its FIRST step are recorded, not pushed — traffic-corpus T1 items become T2 (still in Haku and
 * Thinker). What counts as routine:
 *   - every generated traffic-corpus item (`traffic.ts`: size-ups, status, sensor lines — none of
 *     them load-bearing; the load-bearing items are authored T4 atoms, never pushed, never demoted);
 *   - a first-step radio MOVE whose reason is a tank refill (`water`): logistics, not a change of
 *     the fire picture. Other moves explain the map the view opens on, and crossings, stops and
 *     holds report the fire itself, so they stay pushed.
 * The second step's items are never demoted: they are news during the view.
 */

import type { SiteRadio } from "../../app/scenario/site-scenario.js";
import { LOAD_BEARING_T4_IDS, type InteractionEvent } from "../../app/scenario/types.js";
import { MAIN_VIEWS, STEP_SECONDS, viewOfStep } from "../../app/scenario/views.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import type { CycleIndex } from "../../app/engine/primitives.js";
import type { MoveReason } from "./deployment.js";

/** A radio message as built per step, before it is placed in its view. */
export interface StepRadio extends Omit<SiteRadio, "view" | "pushed"> {
  readonly reason?: MoveReason;
  /** The message in English (`traffic-english.ts`); moved to the bundle's `english` map on export. */
  readonly textEn?: string;
  /** Recorded, never pushed (revision (aj): the LCES statements crews make for the validator, not news for the participant). */
  readonly recorded?: true;
}

const LOAD_BEARING = new Set<string>(LOAD_BEARING_T4_IDS);
/**
 * Generated records that stay pushed whatever the cap (revision (ak), 10 Oct 2026): DR2's 19:05 thermal on the south-east
 * front is the V13 directive's basis and a cited pair of the contradiction backup (`demo-directive.ts`, `demo-probes.ts`);
 * KY21's 19:00 withdrawal (its move message) would otherwise push it under the cap.
 */
const LOAD_BEARING_PATTERNS: readonly RegExp[] = [/^DR2 lämpökuva, kaakkoisrintama klo 19\.05: /];
const loadBearing = (e: InteractionEvent): boolean => LOAD_BEARING.has(e.id) || (e.cycle === 18 && LOAD_BEARING_PATTERNS.some((re) => re.test(e.content)));

/** Whether an item of step `step` is in the first step of a merged view (the thinned half). */
function inMergedFirstStep(step: number): boolean {
  const v = viewOfStep(step);
  return v !== null && v.steps.length === 2 && v.steps[0] === step;
}

function offsetIntoView(step: number): number {
  const v = viewOfStep(step);
  return v === null ? 0 : (step - v.steps[0]!) * STEP_SECONDS;
}

export function radioIntoViews(radio: readonly StepRadio[]): (SiteRadio & { readonly textEn?: string })[] {
  return radio.map(({ reason, recorded, ...r }) => {
    const v = viewOfStep(r.cycle);
    if (v === null) throw new Error(`radio at step ${r.cycle} is outside every view`);
    const routine = r.kind === "move" && reason === "water";
    return { ...r, view: v.index, atOffsetS: r.atOffsetS + offsetIntoView(r.cycle), pushed: !recorded && !(routine && inMergedFirstStep(r.cycle)) };
  });
}

/** Traffic with its view set and the merged views' first-step T1 items recorded as T2. */
export function trafficIntoViews(traffic: readonly InteractionEvent[]): InteractionEvent[] {
  return traffic.map((e) => {
    const view = viewOfStep(e.cycle);
    const history = view === null;
    const demote = e.tier === "T1_pushed" && !LOAD_BEARING.has(e.id) && (history || inMergedFirstStep(e.cycle));
    return { ...e, session_view: view?.index ?? null, ...(demote ? { tier: "T2_system" as const } : {}) };
  });
}

/** Pushed items per view: traffic T1 plus pushed radio (the authored story items are the contract's). */
export function pushedCountByView(traffic: readonly InteractionEvent[], radio: readonly SiteRadio[]): Map<number, number> {
  const counts = new Map<number, number>();
  const add = (v: number | null) => { if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1); };
  for (const e of traffic) if (e.tier === "T1_pushed") add(e.session_view);
  for (const r of radio) if (r.pushed) add(r.view);
  return counts;
}

/**
 * Most items a main view pushes in all (story beats + radio + traffic). SPEC/26 §6 caps a view at
 * 20; the corpus revision of 1 Oct 2026 adds requests, water and drone reports, so the generator
 * keeps a margin of two below the cap.
 */
export const PUSH_CAP_PER_VIEW = 18;
/** Which generated pushed items are recorded first when a view is over the cap: routine status and feeds before warnings and size-ups. */
const DEMOTE_ORDER: readonly InteractionEvent["event_type"][] = ["status", "water_drop", "detection", "observation", "report", "request", "coordination", "weather", "task_update", "warning", "size_up"];

/** Story beats a view pushes (`demo-story.ts`: every beat not marked `recorded`). */
function storyPushed(view: number): number {
  return MAIN_VIEWS.find((v) => v.index === view)?.steps.reduce((s, st) => s + (CYCLE_STORY[st as CycleIndex]?.bubbles.filter((b) => !b.recorded).length ?? 0), 0) ?? 0;
}

/**
 * Keeps every main view at or under `PUSH_CAP_PER_VIEW` pushed items: the generated traffic's T1
 * items over the cap become T2 (recorded, still in Haku and Thinker), lowest rank first, the latest
 * of a rank first. Radio and story beats are never demoted here.
 */
export function capPushed<R extends SiteRadio>(traffic: readonly InteractionEvent[], radio: readonly R[]): { traffic: InteractionEvent[]; radio: R[] } {
  const counts = pushedCountByView(traffic, radio);
  const demote = new Set<string>();
  for (const v of MAIN_VIEWS) {
    let over = (counts.get(v.index) ?? 0) + storyPushed(v.index) - PUSH_CAP_PER_VIEW;
    if (over <= 0) continue;
    const pool = traffic
      .filter((e) => e.session_view === v.index && e.tier === "T1_pushed" && !loadBearing(e))
      .map((e) => {
        const rank = DEMOTE_ORDER.indexOf(e.event_type);
        if (rank < 0) throw new Error(`capPushed: event type ${e.event_type} (${e.id}) is not in DEMOTE_ORDER`);
        return { e, rank };
      })
      .sort((a, b) => a.rank - b.rank || b.e.sim_time_s - a.e.sim_time_s || (a.e.id < b.e.id ? -1 : 1));
    for (const { e } of pool) { if (over <= 0) break; demote.add(e.id); over -= 1; }
    if (over > 0) throw new Error(`capPushed: view ${v.index} stays ${over} over the push cap after demoting all generated traffic`);
  }
  return { traffic: traffic.map((e) => (demote.has(e.id) ? { ...e, tier: "T2_system" as const } : e)), radio: [...radio] };
}
