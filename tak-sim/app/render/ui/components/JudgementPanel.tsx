import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";
import { draftFromPlan, PlanPanel, planSummary, type PlanDraft } from "./DecisionPanels.js";
import { Choice, hint, label, Panel, PrimaryButton, SecondaryButton } from "./PanelParts.js";
import { PlanConfidencePanel } from "./PlanConfidencePanel.js";
import { PlanReviewPanel } from "./PlanReviewPanel.js";
import { Glossed } from "../explain/Glossed.js";

/**
 * The decision strip's control surface. Follows the view's flow: until the decision panel opens
 * 20 s in, only the exploration hint; then the sector plan (the decision), whose submission confirms
 * the period (SPEC/16 revision (s)). Since revision (x), 6 Oct 2026, the plan is the only response a
 * view asks for: Type J, its follow-ups, the verification step and the outlook are withdrawn.
 * Confirmed before the view's minimum length, the panel waits, shows the plan recorded, and offers
 * "Muuta kohdennusta", which reopens the plan prefilled with it. The SAGAT freeze is a full-screen
 * takeover rendered by `FreezeScreen`, and V13's probe takes the strip (`VisibleProbeCard`): this
 * panel renders nothing meanwhile, so the plan's draft is held by `SessionBody` (`planDraft`), not
 * here, and comes back as it was. The briefing and training are `IntroScreen`.
 */
export function JudgementPanel({
  snapshot,
  orchestrator,
  planDraft,
  onPlanDraft,
}: {
  readonly snapshot: SessionSnapshot;
  readonly orchestrator: SessionOrchestrator;
  /** The plan's draft for this view, held by `SessionBody` across a freeze or probe. */
  readonly planDraft: PlanDraft;
  readonly onPlanDraft: (draft: PlanDraft) => void;
}) {
  const { t, tr } = useLang();

  switch (snapshot.step) {
    case "briefing":
    case "training":
      return null; // full-screen IntroScreen (SessionView)

    case "exploration":
      return (
        <Panel>
          {snapshot.previousViewTimedOutWithoutPlan && <p data-testid="time-up-no-plan" style={{ ...hint, color: "#f4a261", opacity: 1 }}>{t.timeUpNoPlan}</p>}
          <p style={hint}>
            {snapshot.practice ? t.practiceNotScored : ""}{t.explorationHint(snapshot.aiAvailable)}
          </p>
        </Panel>
      );

    case "freeze":
      return null; // full-screen FreezeScreen takes over (SessionView); the plan's draft is held there (`planDraft`)

    case "probe":
      return null; // the visible probe (Type U) takes the strip: `VisibleProbeCard` (SessionView)

    case "plan_confidence":
      // SPEC/30 §5.4: the view has ended; its plan's confidence, the map still above. Keyed by the view, so each view's item starts unset.
      return <PlanConfidencePanel key={snapshot.currentCycle} snapshot={snapshot} orchestrator={orchestrator} />;

    case "plan_review":
      // SPEC/32 §3: phase B, the plan review at commitment (the clock standing still). Keyed by the view, so its state starts afresh.
      return <PlanReviewPanel key={snapshot.currentCycle} snapshot={snapshot} orchestrator={orchestrator} onPlanDraft={onPlanDraft} />;

    case "allocation":
      return <PlanPanel snapshot={snapshot} orchestrator={orchestrator} draft={planDraft} onDraft={onPlanDraft} />;

    case "awaiting_view_end":
      return (
        <Panel>
          <p style={hint}>{t.periodConfirmedWait}</p>
          {snapshot.recordedPlan && (
            <p data-testid="plan-recorded" style={{ ...hint, opacity: 1 }}>
              {t.planRecorded} <Glossed text={planSummary(snapshot.recordedPlan, snapshot.allocation.sectors, snapshot.allocation.droneTeams.length > 0, t, tr)} surface="plan" />
            </p>
          )}
          {/* The revision opens on the plan recorded, not an empty form (6 Oct 2026). */}
          <SecondaryButton onClick={() => { onPlanDraft(draftFromPlan(snapshot.recordedPlan)); void orchestrator.reviseAllocation().catch(() => undefined); }}>{t.reviseAllocation}</SecondaryButton>
        </Panel>
      );

    case "hinge_pause": {
      // The manipulation check (brief D3, round 2): the directive, "Olen lukenut linjauksen", then one
      // forced-choice question without the directive on screen; Continue is enabled once it is answered.
      // The check carries no key (`HingeCheckView`). Both groups alike. Once answered, the directive is
      // shown again (SPEC/27 §4.1).
      const check = snapshot.hingeCheck;
      return (
        <Panel>
          <p style={hint}>{t.hinge}</p>
          {snapshot.hingeDirective !== null && (
            <div data-testid="hinge-directive" style={{ margin: "8px 0 12px", padding: "8px 10px", borderLeft: "3px solid #8ab4f8" }}>
              <div style={label}>{t.hingeDirectiveFrom}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}><Glossed text={tr(snapshot.hingeDirective)} surface="plan" /></p>
            </div>
          )}
          {check?.phase === "directive" && (
            <PrimaryButton onClick={() => void orchestrator.showHingeCheck().catch(() => undefined)}>{t.hingeCheck.read}</PrimaryButton>
          )}
          {check && check.phase !== "directive" && (
            <div data-testid="hinge-check" style={{ margin: "8px 0 12px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}><Glossed text={tr(check.promptFi)} surface="plan" /></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {check.options.map((o) => (
                  <Choice key={o.id} selected={check.chosen === o.id} onClick={() => check.phase === "item" && void orchestrator.answerHingeCheck(o.id).catch(() => undefined)}>
                    <Glossed text={tr(o.labelFi)} surface="plan" />
                  </Choice>
                ))}
              </div>
              {check.phase === "item" && <p style={{ ...hint, margin: "8px 0 0" }}>{t.hingeCheck.note}</p>}
            </div>
          )}
          {(!check || check.phase !== "directive") && (
            <PrimaryButton disabled={check !== null && check.phase !== "answered"} onClick={() => void orchestrator.dismissHinge()}>{t.continue}</PrimaryButton>
          )}
        </Panel>
      );
    }

    case "complete":
      return (
        <Panel>
          <p style={hint}>{t.done}</p>
        </Panel>
      );
  }
}
