/**
 * The plan-confidence item (SPEC/30 §5.4; `session/plan-confidence.ts`): after a main view has ended, in the decision
 * strip under the view's map — "How confident are you that your plan fits the situation?" on the study's one scale
 * (25/50/75/100, the shared `ConfidenceRow`: nothing preselected, a choice confirmed with its button). The item shows
 * once `plan_confidence_presented` is durable (`snapshot.planConfidence`); until then the strip only says the period has
 * ended. Identical in every cell; it names no tool and carries no key.
 */

import { useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";
import { ConfidenceRow, hint, Panel } from "./PanelParts.js";

export function PlanConfidencePanel({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { t } = useLang();
  const [value, setValue] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const item = snapshot.planConfidence;
  const confirm = () => {
    if (value === null || sending) return;
    setSending(true);
    void orchestrator.submitPlanConfidence(value).catch(() => setSending(false));
  };
  return (
    <Panel>
      <p style={hint}>{t.planConfidence.note}</p>
      {item && (
        <div data-testid="plan-confidence" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.planConfidence.prompt}</p>
          <ConfidenceRow value={value} onChange={setValue} onConfirm={confirm} disabled={sending} />
        </div>
      )}
    </Panel>
  );
}
