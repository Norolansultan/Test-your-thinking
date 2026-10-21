/**
 * The sector plan (SPEC/16 revision (s), researcher decision 2 Oct 2026; the outlook withdrawn,
 * revision (x), 6 Oct 2026). It starts empty in every view: nothing preselected, no ready-made
 * option, so every answer is the participant's own. The plan's submission confirms the period. The plan's main effort carries a
 * posture (4 Oct 2026), required and never preselected, so confirm stays disabled until it is chosen.
 *
 * The draft (6 Oct 2026, review): held by `SessionBody`, which stays mounted for the whole view, not by
 * this panel — a freeze or V13's probe unmounts the panel, and the draft comes back exactly as it was.
 * It is tied to its view (`heldPlanDraft`), so every view starts empty; "Muuta kohdennusta" reopens it
 * with the plan last recorded (`draftFromPlan`).
 */

import type { SessionOrchestrator, SessionSnapshot, ViewIndex } from "../../../session/orchestrator.js";
import {
  DEPARTURE_NOTE_FROM_VIEW, DEPARTURE_REASONS, MAIN_EFFORT_POSTURES, PLAN_DRONE_TASK_IDS, SECONDARY_TASK_IDS,
  type DepartureReason, type MainEffortPosture, type PlanDroneTaskId, type SecondaryTaskId, type SectorPlan,
} from "../../../scenario/plan-types.js";
import type { UiText } from "../../../i18n/ui.js";
import { useLang } from "../i18n.js";
import { unitCallSign } from "../../../i18n/place-names.js";
import { Choice, hint, label, Panel, PrimaryButton } from "./PanelParts.js";
import { useHoverDwell } from "./hover-dwell.js";
import { Glossed } from "../explain/Glossed.js";

const row = { display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" } as const;
/** The plan's rows: the label in a narrow left column, the choices on one line beside it. */
const grid = { display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 12, rowGap: 4, alignItems: "center" } as const;
const rowLabel = { ...label, margin: 0, fontSize: 10.5 } as const;
const sep = { opacity: 0.5, fontSize: 12, margin: "0 2px" } as const;

/** The plan as the form holds it. A sector `undefined`: not chosen yet; `null`: none (no secondary, the drones carry on). */
export interface PlanDraft {
  readonly mainEffort: string | null;
  readonly posture: MainEffortPosture | null; // 4 Oct 2026: required, never preselected
  readonly secondarySector: string | null | undefined;
  readonly secondaryTask: SecondaryTaskId | null;
  readonly droneSector: string | null | undefined;
  readonly droneTask: PlanDroneTaskId | null;
  /** The departure note (D5, from V8): optional, so the draft is complete without it; its main reason optional too (revision (ai)), null: none chosen. */
  readonly departureNoted: boolean;
  readonly departureReason: DepartureReason | null;
}

export const EMPTY_PLAN_DRAFT: PlanDraft = { mainEffort: null, posture: null, secondarySector: undefined, secondaryTask: null, droneSector: undefined, droneTask: null, departureNoted: false, departureReason: null };

/** A draft held for a view (`SessionBody`'s state). */
export interface HeldPlanDraft {
  readonly view: ViewIndex | null;
  readonly draft: PlanDraft;
}

/** The draft for `view`: the one held, if it was made in this view; else empty (a new view starts empty). */
export function heldPlanDraft(held: HeldPlanDraft, view: ViewIndex): PlanDraft {
  return held.view === view ? held.draft : EMPTY_PLAN_DRAFT;
}

/** A recorded plan back in the form (the revision's prefill); none: empty. */
export function draftFromPlan(plan: SectorPlan | null): PlanDraft {
  if (!plan) return EMPTY_PLAN_DRAFT;
  return {
    mainEffort: plan.mainEffort, posture: plan.posture,
    secondarySector: plan.secondary ? plan.secondary.sectorId : null, secondaryTask: plan.secondary?.taskId ?? null,
    droneSector: plan.drones ? plan.drones.sectorId : null, droneTask: plan.drones?.taskId ?? null,
    departureNoted: plan.departureNoted === true, departureReason: plan.departureReason ?? null,
  };
}

/** The plan the draft makes, or null while it is incomplete (confirm stays disabled). `offerDeparture`: the departure note is offered in this view (V8 on); before that the plan carries no such field. */
/** The plan panel's "On scene" line, the units as the session language names them (VPK is VOL1 in English, revision (ae)). */
export function onSceneLine(t: Pick<UiText, "onSceneList">, allocation: { readonly crews: readonly string[]; readonly droneTeams: readonly string[] }, lang: "fi" | "en"): string {
  return t.onSceneList(allocation.crews.map((c) => unitCallSign(lang, c)).join(", "), allocation.droneTeams.map((d) => unitCallSign(lang, d)).join(", "));
}

export function planFromDraft(d: PlanDraft, hasDrones: boolean, offerDeparture = false): SectorPlan | null {
  const secondaryDone = d.secondarySector === null || (typeof d.secondarySector === "string" && d.secondaryTask !== null);
  const dronesDone = !hasDrones || d.droneSector === null || (typeof d.droneSector === "string" && d.droneTask !== null);
  const complete = d.mainEffort !== null && d.posture !== null && secondaryDone && dronesDone;
  if (!complete || d.mainEffort === null || d.posture === null) return null;
  return {
    mainEffort: d.mainEffort,
    posture: d.posture,
    secondary: typeof d.secondarySector === "string" && d.secondaryTask ? { sectorId: d.secondarySector, taskId: d.secondaryTask } : null,
    drones: hasDrones && typeof d.droneSector === "string" && d.droneTask ? { sectorId: d.droneSector, taskId: d.droneTask } : null,
    ...(offerDeparture ? { departureNoted: d.departureNoted, ...(d.departureNoted && d.departureReason !== null ? { departureReason: d.departureReason } : {}) } : {}),
  };
}

/** One line for the recorded plan (6 Oct 2026), from the form's own texts: main effort (posture) · secondary · drones. */
export function planSummary(
  plan: SectorPlan, sectors: readonly { readonly id: string; readonly labelFi: string }[], hasDrones: boolean,
  t: Pick<UiText, "postures" | "secondaryTasks" | "droneTasks" | "noSecondary" | "dronesCarryOn">, tr: (fi: string) => string,
): string {
  const sector = (id: string) => { const s = sectors.find((x) => x.id === id); return s ? tr(s.labelFi) : id; };
  const parts = [
    `${sector(plan.mainEffort)} (${t.postures[plan.posture]})`,
    plan.secondary ? `${sector(plan.secondary.sectorId)} → ${t.secondaryTasks[plan.secondary.taskId]}` : t.noSecondary,
    ...(hasDrones ? [plan.drones ? `${sector(plan.drones.sectorId)} → ${t.droneTasks[plan.drones.taskId]}` : t.dronesCarryOn] : []),
  ];
  return parts.join(" · ");
}

/** The plan's option rows, as `decision_option_hovered` names them (SPEC/30 §5.4). */
export type DecisionOptionRow = "main_effort" | "posture" | "secondary" | "secondary_task" | "drones" | "drone_task" | "departure_reason";
/** An option's id in `decision_option_hovered`: `<row>:<value>` — the sector or task id, `secondary:none`, `drones:carry_on`. */
export function decisionOptionId(row: DecisionOptionRow, value: string): string {
  return `${row}:${value}`;
}

export function PlanPanel({ snapshot, orchestrator, draft, onDraft }: {
  readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator;
  /** The draft, held outside the panel (`SessionBody`), so an interruption does not lose it. */
  readonly draft: PlanDraft; readonly onDraft: (draft: PlanDraft) => void;
}) {
  const { t, tr, lang } = useLang();
  const { sectors, crews, droneTeams } = snapshot.allocation;
  const { mainEffort, posture, secondarySector, secondaryTask, droneSector, droneTask, departureNoted, departureReason } = draft;
  const set = (patch: Partial<PlanDraft>) => onDraft({ ...draft, ...patch });
  // SPEC/30 §5.4: an option the pointer rests on for the dwell (`hover-dwell.ts`) is logged, once per entry.
  const dwell = useHoverDwell((optionId) => void orchestrator.logPanelUse({ kind: "decision_option_hovered", detail: { optionId } }).catch(() => undefined));
  const hover = (row: DecisionOptionRow, value: string) => dwell(decisionOptionId(row, value));
  const hasDrones = droneTeams.length > 0;
  const offerDeparture = snapshot.currentCycle >= DEPARTURE_NOTE_FROM_VIEW;
  const plan = planFromDraft(draft, hasDrones, offerDeparture);
  const complete = plan !== null;
  const submit = () => {
    if (!plan) return;
    orchestrator.submitAllocation(plan).catch((e: unknown) => console.error(e));
  };
  // Compact (6 Oct 2026): the hint, the units on scene and Confirm share the head line; each part of the plan is one
  // row, its label on the left — the panel takes about half the height it did, and the map gets the rest.
  return (
    <Panel compact>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, opacity: 0.85 }}><Glossed text={t.allocationHint} surface="plan" /></span>
        <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.55, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{onSceneLine(t, snapshot.allocation, lang)}</span>
        <PrimaryButton disabled={!complete} onClick={submit}>{t.confirmAllocation}</PrimaryButton>
      </div>
      {snapshot.revisingAllocation && <p style={{ ...hint, fontSize: 12, margin: "0 0 4px" }}>{t.revisionHint}</p>}

      <div style={grid}>
        <div style={rowLabel}><Glossed text={t.mainEffortLabel} surface="plan" /></div>
        <div style={row}>
          {sectors.map((s) => <Choice compact key={s.id} hover={hover("main_effort", s.id)} selected={mainEffort === s.id} onClick={() => set({ mainEffort: s.id, ...(secondarySector === s.id ? { secondarySector: undefined } : {}) })}><Glossed text={tr(s.labelFi)} surface="plan" /></Choice>)}
        </div>

        <div style={rowLabel}><Glossed text={t.postureLabel} surface="plan" /></div>
        <div style={row}>
          {MAIN_EFFORT_POSTURES.map((p) => <Choice compact key={p} hover={hover("posture", p)} selected={posture === p} onClick={() => set({ posture: p })}><Glossed text={t.postures[p]} surface="plan" /></Choice>)}
        </div>

        <div style={rowLabel}><Glossed text={t.secondaryLabel} surface="plan" /></div>
        <div style={row}>
          <Choice compact hover={hover("secondary", "none")} selected={secondarySector === null} onClick={() => set({ secondarySector: null })}><Glossed text={t.noSecondary} surface="plan" /></Choice>
          {sectors.filter((s) => s.id !== mainEffort).map((s) => <Choice compact key={s.id} hover={hover("secondary", s.id)} selected={secondarySector === s.id} onClick={() => set({ secondarySector: s.id })}><Glossed text={tr(s.labelFi)} surface="plan" /></Choice>)}
          {typeof secondarySector === "string" && (
            <>
              <span style={sep}>→</span>
              {SECONDARY_TASK_IDS.map((id) => <Choice compact key={id} hover={hover("secondary_task", id)} selected={secondaryTask === id} onClick={() => set({ secondaryTask: id })}><Glossed text={t.secondaryTasks[id]} surface="plan" /></Choice>)}
            </>
          )}
        </div>

        {hasDrones && (
          <>
            <div style={rowLabel}><Glossed text={t.dronesLabel} surface="plan" /></div>
            <div style={row}>
              <Choice compact hover={hover("drones", "carry_on")} selected={droneSector === null} onClick={() => set({ droneSector: null })}><Glossed text={t.dronesCarryOn} surface="plan" /></Choice>
              {sectors.map((s) => <Choice compact key={s.id} hover={hover("drones", s.id)} selected={droneSector === s.id} onClick={() => set({ droneSector: s.id })}><Glossed text={tr(s.labelFi)} surface="plan" /></Choice>)}
              {typeof droneSector === "string" && (
                <>
                  <span style={sep}>→</span>
                  {PLAN_DRONE_TASK_IDS.map((id) => <Choice compact key={id} hover={hover("drone_task", id)} selected={droneTask === id} onClick={() => set({ droneTask: id })}><Glossed text={t.droneTasks[id]} surface="plan" /></Choice>)}
                </>
              )}
            </div>
          </>
        )}

        {offerDeparture && (
          <>
            <div style={rowLabel}><Glossed text={t.departureLabel} surface="plan" /></div>
            <div style={row}>
              <input type="checkbox" checked={departureNoted} aria-label={t.departureLabel} onChange={(e) => set({ departureNoted: e.currentTarget.checked })} />
            </div>
            {departureNoted && (
              <>
                <div style={rowLabel}><Glossed text={t.departureReasonLabel} surface="plan" /></div>
                <div style={row} role="radiogroup" aria-label={t.departureReasonLabel}>
                  {DEPARTURE_REASONS.map((r) => (
                    <Choice compact key={r} hover={hover("departure_reason", r)} selected={departureReason === r} onClick={() => set({ departureReason: departureReason === r ? null : r })}><Glossed text={t.departureReasons[r]} surface="plan" /></Choice>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
