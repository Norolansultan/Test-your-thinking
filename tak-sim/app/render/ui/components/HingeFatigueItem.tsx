import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { HINGE_FATIGUE_MAX, HINGE_FATIGUE_MIN } from "../../../session/hinge-check.js";
import { STUDY_TEXT } from "../../../i18n/study-texts.js";
import { useLang } from "../i18n.js";
import { Choice, hint } from "./PanelParts.js";

/**
 * SPEC/15 revision (bf), 24 Oct 2026: the hinge screen's optional fatigue item, the same 1–7 item as the questionnaires' `fatigue.start`
 * and `fatigue.end` — its wording and anchors are theirs (`STUDY_TEXT`), so the three ratings are one measure. One click is logged at
 * once (`rateHingeFatigue`); another click replaces it (the last counts). Continue does not wait for it. Both groups alike.
 */
export function HingeFatigueItem({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang, t } = useLang();
  const item = snapshot.hingeFatigue;
  if (!item) return null;
  const text = STUDY_TEXT[lang].questionnaire.items["fatigue.start"]!;
  const points = Array.from({ length: HINGE_FATIGUE_MAX - HINGE_FATIGUE_MIN + 1 }, (_, i) => HINGE_FATIGUE_MIN + i);
  return (
    <div data-testid="hinge-fatigue" style={{ margin: "8px 0 12px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 14 }}>{text.prompt}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, opacity: 0.7, marginRight: 4 }}>{text.low}</span>
        {points.map((n) => (
          <Choice key={n} compact selected={item.value === n} onClick={() => void orchestrator.rateHingeFatigue(n).catch(() => undefined)}>{n}</Choice>
        ))}
        <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{text.high}</span>
      </div>
      <p style={{ ...hint, margin: "6px 0 0" }}>{t.hingeCheck.fatigueOptional}</p>
    </div>
  );
}
