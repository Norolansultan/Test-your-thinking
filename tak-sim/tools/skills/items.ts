/**
 * `measures/items.json`: every scored item of the session in the format both `parity_check.py` (wildfire-scenario-pipeline)
 * and `score_freezes.py` (wildfire-sagat-probes) read — the blanked freezes (VP practice, V2, V4, V5, V7, V10, V12, V14),
 * the SPAM items (V3, V6, V8, V11, the second items `.b` of V3 and V6, and the practice item), and the hinge manipulation
 * check. Keys are TRUTH, from the scenario contract: a choice item's correct option id, a SPAM item's and the hinge check's
 * key letter from the invariants (`spam.cycle_<n>[.b]`, `manipulation_check.hinge`), a map item's key point in EPSG:3067
 * with its tolerance (`mapKey.toleranceM`).
 *
 * `cycle` is the step the answer is due at (the skills compare it with when each fact became available): a freeze's
 * "now" is its view's last step (a merged view's freeze falls after the step boundary; V10 and V14's at the view's end);
 * a SPAM item is shown 25 s into its view's first step; the hinge check comes at 16:40, the directive's moment (the start
 * of step 11, after V7). `fact_ids` are the records the key rests on (`keyAtomIds`, `SPAM_KEY_ATOMS`,
 * `SPAM_SECOND_KEY_ATOMS`, the practice SPAM key record); empty where the key is computed from the fire model (L3).
 */

import type { FreezeItem, ScenarioContract } from "../../app/scenario/types.js";
import { tr } from "../../app/i18n/text.js";
import { MAIN_VIEWS, SECOND_SPAM_SUFFIX } from "../../app/scenario/views.js";
import { SPAM_KEY_ATOMS, SPAM_SECOND_KEY_ATOMS } from "../../app/scenario/demo-probes.js";
import { PRACTICE_SPAM_KEY_OPTION, practiceSpamKeyRecordId } from "../../app/scenario/practice-spam.js";
import { cycleOfStep, stepOfVirtual, toEN } from "./geo.js";

export interface ItemOption { readonly id: string; readonly label_fi: string; readonly label_en: string | null }

export interface SkillItem {
  readonly id: string;
  readonly freeze_id: string;
  readonly cycle: number;
  readonly view: string;
  readonly level: "L1" | "L2" | "L3";
  readonly fact_ids: readonly string[];
  readonly type: "choice" | "point";
  readonly correct: string | readonly [number, number];
  readonly tolerance?: { readonly m: number };
  readonly family: string;
  readonly scope: "own" | "team";
  readonly probe: "freeze" | "spam" | "hinge_check";
  readonly practice: boolean;
  readonly goal: string | null;
  readonly prompt_fi: string;
  readonly prompt_en: string | null;
  readonly options: readonly ItemOption[];
  /** Map items whose key asks beyond the view's projection: the projection's head then (analysis only). */
  readonly projection_point?: readonly [number, number];
}

const enOf = (fi: string): string | null => { const en = tr("en", fi); return en === fi ? null : en; };
const LEVEL = { 1: "L1", 2: "L2", 3: "L3" } as const;

function freezeItem(item: FreezeItem, view: string, cycle: number, practice: boolean): SkillItem {
  const base = {
    id: item.id, freeze_id: `freeze.${view}`, cycle, view, level: item.level, fact_ids: [...(item.keyAtomIds ?? [])],
    family: "situation", scope: "own" as const, probe: "freeze" as const, practice, goal: item.goal ?? null,
    prompt_fi: item.promptFi, prompt_en: enOf(item.promptFi),
  };
  if (item.kind === "map_point") {
    if (!item.mapKey) throw new Error(`${item.id}: a map item without mapKey`);
    return {
      ...base, type: "point", correct: toEN(item.mapKey.point), tolerance: { m: item.mapKey.toleranceM }, options: [],
      ...(item.projectionPoint ? { projection_point: toEN(item.projectionPoint) } : {}),
    };
  }
  const key = item.options.find((o) => o.correct);
  if (!key) throw new Error(`${item.id}: no correct option`);
  return { ...base, type: "choice", correct: key.id, options: item.options.map((o) => ({ id: o.id, label_fi: o.labelFi, label_en: enOf(o.labelFi) })) };
}

function invariantKey(s: ScenarioContract, name: string): string {
  const inv = s.invariants.find((i) => i.name === name);
  if (!inv || typeof inv.expected !== "string") throw new Error(`no string key for invariant ${name}`);
  return inv.expected;
}

export function buildItems(s: ScenarioContract): SkillItem[] {
  const items: SkillItem[] = [];
  // Freezes: the practice freeze (cycle 0), then the main freezes in view order.
  for (const it of s.practice.freeze.items) items.push(freezeItem(it, "VP", 0, true));
  for (const f of s.freezes) {
    const view = MAIN_VIEWS.find((v) => v.index === (f.cycle as number));
    if (!view) throw new Error(`freeze for an unknown view ${f.cycle}`);
    const due = cycleOfStep(view.steps[view.steps.length - 1]!);
    for (const it of f.items) items.push(freezeItem(it, view.id, due, false));
  }
  // SPAM: the practice item, then the main and second items in the schedule's order.
  const ps = s.practice.spam;
  if (ps) items.push({
    id: ps.id, freeze_id: "spam.VP", cycle: 0, view: "VP", level: LEVEL[ps.saLevel ?? 1], fact_ids: [practiceSpamKeyRecordId()],
    type: "choice", correct: PRACTICE_SPAM_KEY_OPTION, family: ps.contentKind, scope: "team", probe: "spam", practice: true, goal: null,
    prompt_fi: ps.prompt, prompt_en: enOf(ps.prompt), options: spamOptions(ps.response),
  });
  for (const p of s.probeSchedule.probes.filter((x) => x.type === "S")) {
    const view = MAIN_VIEWS.find((v) => v.index === (p.cycle as number));
    if (!view) throw new Error(`${p.id}: unknown view ${p.cycle}`);
    const second = p.id.endsWith(SECOND_SPAM_SUFFIX);
    const keyAtoms = (second ? SPAM_SECOND_KEY_ATOMS : SPAM_KEY_ATOMS)[view.index] ?? [];
    items.push({
      id: p.id, freeze_id: `spam.${view.id}`, cycle: cycleOfStep(view.steps[0]!), view: view.id, level: LEVEL[p.saLevel ?? 1], fact_ids: [...keyAtoms],
      type: "choice", correct: invariantKey(s, p.invariantName), family: p.contentKind, scope: "team", probe: "spam", practice: false, goal: null,
      prompt_fi: p.prompt, prompt_en: enOf(p.prompt), options: spamOptions(p.response),
    });
  }
  // The hinge check: the directive's moment (P2's message opening V8, at 16:40).
  const hc = s.hinge.manipulationCheck;
  const directive = s.dutyOfficerMessages.find((m) => m.isStrategicGuidance);
  if (hc) {
    items.push({
      id: hc.id, freeze_id: "hinge", cycle: cycleOfStep(stepOfVirtual((directive?.at as number | undefined) ?? 12_000)), view: "hinge", level: "L1",
      fact_ids: [], type: "choice", correct: invariantKey(s, hc.invariantName), family: "intent", scope: "own", probe: "hinge_check", practice: false, goal: null,
      prompt_fi: hc.promptFi, prompt_en: enOf(hc.promptFi), options: hc.options.map((o) => ({ id: o.id, label_fi: o.labelFi, label_en: enOf(o.labelFi) })),
    });
  }
  return items;
}

function spamOptions(response: ScenarioContract["probeSchedule"]["probes"][number]["response"]): ItemOption[] {
  if (response.kind !== "categorical") throw new Error(`a SPAM item with a ${response.kind} response`);
  return response.options.map((o) => ({ id: o.id, label_fi: o.fi, label_en: enOf(o.fi) }));
}

/** The bank's size, counted from the contract independently of `buildItems` (the test holds the two together). */
export function bankSize(s: ScenarioContract): number {
  const freezes = s.practice.freeze.items.length + s.freezes.reduce((n, f) => n + f.items.length, 0);
  const spam = s.probeSchedule.probes.filter((p) => p.type === "S").length + (s.practice.spam ? 1 : 0); // + the practice item
  return freezes + spam + (s.hinge.manipulationCheck ? 1 : 0);
}
