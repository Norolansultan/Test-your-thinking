import type { SessionOrchestrator } from "../../../session/orchestrator.js";
import { introTextsIn } from "../../../scenario/briefing.js";
import type { Cell } from "../../../scenario/types.js";
import { useLang } from "../i18n.js";
import { useAudience } from "../audience-context.js";
import { PUBLIC_TEXT } from "../../../i18n/public-texts.js";

/**
 * The group-specific training text (after the practice view, before V1) — SPEC/15 §2, SPEC/02
 * revision (o) §3. A minimal full-screen page: the text and one button. The text is a draft in
 * `app/scenario/briefing.ts`. Revision (ae), 9 Oct 2026: the briefing's "Situation" page (the setting
 * text and, in English, the glossary) is gone; the orchestrator passes that step at once.
 * Revision (am): the cell is passed on, so the `reasoning_intent` cell reads its own Thinker sentence
 * (`introTextsIn`'s revision (al) branch, which this screen had not been given).
 */
export function IntroScreen({ condition, cell, orchestrator }: {
  readonly condition: "directed" | "substitutive";
  readonly cell?: Cell | undefined;
  readonly orchestrator: SessionOrchestrator;
}) {
  const { lang, t } = useLang();
  const texts = introTextsIn(condition, lang, cell);
  // SPEC/35 §4: a public session's mission card, above the training text; the same in every cell.
  const mission = useAudience().audience === "public" ? PUBLIC_TEXT[lang].mission : null;
  return (
    <div style={{ display: "flex", height: "100%", overflowY: "auto", alignItems: "safe center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
        {mission && (
          <section data-testid="mission-card" style={{ padding: "14px 18px", borderRadius: 8, border: "1px solid #f4a261", background: "#2a2f34", display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{mission.title}</h2>
            {mission.paragraphs.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{p}</p>)}
          </section>
        )}
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{texts.trainingTitle}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{texts.training}</p>
        <button
          onClick={() => void orchestrator.completeTraining()}
          style={{ alignSelf: "flex-end", padding: "10px 20px", borderRadius: 6, border: "1px solid #3a3f44", background: "#2a2f34", color: "#e8eaed", cursor: "pointer", fontSize: 14 }}
        >
          {t.startTask}
        </button>
      </div>
    </div>
  );
}
