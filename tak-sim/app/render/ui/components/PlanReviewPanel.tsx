/**
 * The plan review at commitment (SPEC/32 §3, 20 Oct 2026; `session/plan-review.ts`): in phase B, in the decision strip under
 * the view's map, at the moment the plan would become final — the view's clock standing still. Both groups see the plan as
 * recorded (`planSummary`, as the "plan recorded" line) and two buttons, "Vahvista kohdennus" (keep: the view ends) and "Muuta
 * kohdennusta" (revise: the plan form opens again, prefilled with the plan recorded, as "Muuta kohdennusta" always has). The
 * guide group also sees the premise lines (the server's fixed template, in the session language; never model text) under
 * "Thinker — linjauksen oletukset", and the records they cite as buttons: one opens the record in the message log (marked and
 * brought into view, `MessageLogRow`) and here, and is logged (`plan_review_record_opened`). Until `plan_review_shown` is
 * durable (and the guide group's lookup has answered) only a loading line shows. It carries no key and no feedback.
 */

import { useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";
import { draftFromPlan, planSummary, type PlanDraft } from "./DecisionPanels.js";
import { hint, label, Panel, PrimaryButton, SecondaryButton } from "./PanelParts.js";
import { MessageLogRow } from "./RightPanel.js";

export function PlanReviewPanel({ snapshot, orchestrator, onPlanDraft }: {
  readonly snapshot: SessionSnapshot;
  readonly orchestrator: SessionOrchestrator;
  /** The plan form's draft (`SessionBody`): "Muuta kohdennusta" reopens it on the plan recorded. */
  readonly onPlanDraft: (draft: PlanDraft) => void;
}) {
  const { t, tr } = useLang();
  const [sending, setSending] = useState(false);
  const review = snapshot.planReview;
  const r = t.planReview;
  if (!review) return <Panel><p data-testid="plan-review-loading" style={hint}>{r.loading}</p></Panel>;

  const act = (run: () => Promise<void>) => {
    if (sending) return;
    setSending(true);
    void run().catch(() => setSending(false));
  };
  const keep = () => act(() => orchestrator.keepPlan());
  const revise = () => act(() => { onPlanDraft(draftFromPlan(snapshot.recordedPlan)); return orchestrator.revisePlan(); });
  const opened = review.citedRecords.find((c) => c.atomId === review.openedAtomId) ?? null;

  return (
    <Panel>
      <div data-testid="plan-review" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.title}</p>
        <p style={{ ...hint, margin: 0 }}>{r.note}</p>
        {snapshot.recordedPlan && (
          <p data-testid="plan-review-plan" style={{ ...hint, opacity: 1, margin: 0 }}>
            {r.planLabel} {planSummary(snapshot.recordedPlan, snapshot.allocation.sectors, snapshot.allocation.droneTeams.length > 0, t, tr)}
          </p>
        )}
        {review.premiseLines !== null && (
          <div data-testid="plan-review-premises" style={{ padding: "8px 10px", borderLeft: "3px solid #8ab4f8", background: "#1b1e22", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={label}>{r.premisesLabel}</div>
            {review.premiseLines.map((line, i) => <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{line}</p>)}
            {review.citedRecords.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>{r.citedLabel}</span>
                {review.citedRecords.map((c) => (
                  <button key={`${c.premiseId}:${c.atomId}`} type="button" data-testid={`plan-review-record-${c.atomId}`} title={r.openRecord} aria-pressed={review.openedAtomId === c.atomId}
                    onClick={() => void orchestrator.openReviewRecord(c.atomId).catch(() => undefined)}
                    style={{ padding: "3px 9px", borderRadius: 12, fontSize: 12, cursor: "pointer", color: "#dbe7fb", border: "1px solid #8ab4f8", background: review.openedAtomId === c.atomId ? "#2b3a50" : "#1f2a38" }}>
                    {c.clockLabel} {c.from}
                  </button>
                ))}
              </div>
            )}
            {opened && (
              <div data-testid="plan-review-opened-record" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <MessageLogRow entry={opened} />
                {!opened.inLog && <span style={{ fontSize: 11.5, opacity: 0.7 }}>{r.notInLog}</span>}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrimaryButton disabled={sending} onClick={keep}>{r.keep}</PrimaryButton>
          <SecondaryButton onClick={revise}>{r.revise}</SecondaryButton>
        </div>
      </div>
    </Panel>
  );
}
