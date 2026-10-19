/**
 * H13's act-based coding (SPEC/31 §3.1, coa F1(c); RC, 19 Oct 2026) and the key's routes to soundness (§3.2, `soundVia`), analysis
 * only: pure functions over a plan and a key passed in (TRUTH: `app/scenario/demo-directive.ts`, which nothing under app/ imports —
 * `test/boundary/directive-keys-boundary.spec.ts`); never called at runtime, never stored (SPEC/07 §1).
 *
 * - **The keyed front** of a view is the deciding front its key names: the sectors of its `soundSecondary` route and of a
 *   sector-limited `direct_attack` (`soundSectors.direct_attack`). V9–V10: the new front; V14: the flare-up. A key that names none
 *   (the fit views V11–V13, V8, phase A) has no keyed front, and the act coding equals the label coding there.
 * - **Attending** (§3.1): a plan attends the keyed front when its main effort is a direct attack on one of the front's sectors, or its
 *   secondary task on one of them is direct attack, mop-up or hold-line (`ATTENDING_SECONDARY_TASKS`) — whatever the label: a hose crew
 *   on a spreading rekindle is a direct attack in Finnish usage. Every sector the front touches counts here, its boundary sectors
 *   included; the cell's primary coding still reads the core sectors only (`boundarySectors`), as the label coding does.
 * - **The act coding** reads an attending secondary task as the key's secondary direct attack (`secondaryAsAct`): so the plan is against
 *   the directive (its act is "no direct attack on the edge" broken), and sound through the key's secondary route when its main effort is
 *   where the route allows. The label coding (`cell`, the build's since 7 Oct 2026) is the pre-registered sensitivity. If the panel rates
 *   mop-up or hold-line on the deciding front unsound (probe plans V9-f, V10-f, V14-d), the label coding stays primary (§3.1).
 * - **`soundRoutes`**: which routes a key accepts (main effort, secondary), for the review packet's per-view `soundVia` (§3.2: V14 is
 *   sound only through the secondary route once its `sound` is emptied, WP-1).
 * - **`secondaryAttacks`** (coa F6): the plans whose secondary task is a direct attack, per view, with their cell — so V13's secondary
 *   attacks on the north-edge holdover (coded D) can be reported apart from V14's on the flare-up.
 */

/** The secondary tasks that attend a keyed front by their act (§3.1): every one the plan offers. */
export const ATTENDING_SECONDARY_TASKS: readonly string[] = ["task.direct-attack", "task.mopup", "task.hold-line"];
/** The main-effort posture that attends a front as the main effort. */
export const DIRECT_ATTACK_POSTURE = "direct_attack";

/** What the act coding reads of a key (a subset of `DirectiveKeyLike`). */
export interface ActKeyLike {
  readonly sound: readonly string[] | null;
  readonly againstSecondaryTaskId?: string;
  readonly soundSectors?: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly soundSecondary?: { readonly taskId: string; readonly sectors: readonly string[]; readonly mainEffortSectors: readonly string[]; readonly mainEffortPostures: readonly string[] };
}

export interface PlanSecondary { readonly sectorId: string; readonly taskId: string }

/** The keyed front's sectors (its `soundSecondary` sectors and a sector-limited direct attack's), in id order; empty: none named. */
export function keyedFrontSectors(key: ActKeyLike): string[] {
  const ids = new Set([...(key.soundSecondary?.sectors ?? []), ...(key.soundSectors?.[DIRECT_ATTACK_POSTURE] ?? [])]);
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface Attendance {
  /** The plan attends the keyed front; null where the key names no front. */
  readonly attended: boolean | null;
  /** How: a main-effort direct attack on the front, or a secondary task on it; null when not attending. */
  readonly attendedVia: "main_effort" | "secondary" | null;
}

export function attendance(posture: string, mainEffort: string, secondary: PlanSecondary | null, key: ActKeyLike): Attendance {
  const front = keyedFrontSectors(key);
  if (front.length === 0) return { attended: null, attendedVia: null };
  if (posture === DIRECT_ATTACK_POSTURE && front.includes(mainEffort)) return { attended: true, attendedVia: "main_effort" };
  if (secondary !== null && ATTENDING_SECONDARY_TASKS.includes(secondary.taskId) && front.includes(secondary.sectorId)) return { attended: true, attendedVia: "secondary" };
  return { attended: false, attendedVia: null };
}

/**
 * The secondary task as the act coding reads it: on the keyed front, any attending task is the key's secondary direct attack
 * (`soundSecondary.taskId`, else `againstSecondaryTaskId`); anything else is unchanged (the same object).
 */
export function secondaryAsAct(secondary: PlanSecondary | null, key: ActKeyLike): PlanSecondary | null {
  const attackId = key.soundSecondary?.taskId ?? key.againstSecondaryTaskId;
  if (secondary === null || attackId === undefined || secondary.taskId === attackId) return secondary;
  const front = keyedFrontSectors(key);
  return ATTENDING_SECONDARY_TASKS.includes(secondary.taskId) && front.includes(secondary.sectorId) ? { sectorId: secondary.sectorId, taskId: attackId } : secondary;
}

export type SoundRoute = "main_effort" | "secondary";

export interface SoundRoutes {
  /** The routes through which a plan can be sound under the key, in order; empty where soundness is not coded. */
  readonly routes: readonly SoundRoute[];
  /** The keyed front's sectors (`keyedFrontSectors`); empty in a view without one. */
  readonly keyedFront: readonly string[];
  /** One line for the review packet: "main_effort (direct_attack in L3) | secondary (task.direct-attack in L3; main …)". */
  readonly text: string;
}

/** The routes a key accepts (§3.2's `soundVia`), for the review packet: V14 lists the secondary route alone once its `sound` is empty. */
export function soundRoutes(key: ActKeyLike | null): SoundRoutes {
  if (key === null || key.sound === null) return { routes: [], keyedFront: [], text: "not coded" };
  const routes: SoundRoute[] = [];
  const parts: string[] = [];
  if (key.sound.length > 0) {
    routes.push("main_effort");
    parts.push(`main_effort (${key.sound.map((p) => `${p}${key.soundSectors?.[p] ? ` in ${key.soundSectors[p]!.join("/")}` : " anywhere"}`).join("; ")})`);
  }
  const alt = key.soundSecondary;
  if (alt) {
    routes.push("secondary");
    parts.push(`secondary (${alt.taskId} in ${alt.sectors.join("/")}, the main effort ${alt.mainEffortPostures.join("/")} in ${alt.mainEffortSectors.join("/")})`);
  }
  const keyedFront = keyedFrontSectors(key);
  const act = keyedFront.length > 0 ? `; act coding: any of ${ATTENDING_SECONDARY_TASKS.join("/")} on ${keyedFront.join("/")} is the secondary direct attack` : "";
  return { routes, keyedFront, text: `${parts.length > 0 ? parts.join(" | ") : "none"}${act}` };
}

/** One plan with a secondary direct attack (coa F6). */
export interface SecondaryAttack {
  readonly view: number;
  readonly sectorId: string;
  /** The label coding's cell and the act coding's (equal outside V9, V10, V14). */
  readonly cell: string | null;
  readonly cellByAct: string | null;
}

/** The plans in force at the views' ends whose secondary task is a direct attack, in view order (V13's are reported apart, coa F6). */
export function secondaryAttacks(
  adherence: readonly { readonly view: number; readonly atViewEnd: { readonly secondary: PlanSecondary | null; readonly cell: string | null; readonly cellByAct: string | null } | null }[],
  views?: readonly number[],
): SecondaryAttack[] {
  return adherence.flatMap((a) => {
    const s = a.atViewEnd?.secondary;
    if (!s || s.taskId !== "task.direct-attack" || (views && !views.includes(a.view))) return [];
    return [{ view: a.view, sectorId: s.sectorId, cell: a.atViewEnd!.cell, cellByAct: a.atViewEnd!.cellByAct }];
  });
}
