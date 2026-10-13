import type { SessionOrchestrator, SpamView } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";
import { ConfidencePicker, hint, label } from "./PanelParts.js";

/**
 * The SPAM probe (SPEC/15 §5; round 2, 4 Oct 2026, `spam-delivery.ts`; revision (ag), 9 Oct 2026). ONLINE:
 * it sits between the map and the decision strip, so the map, the message log, Haku and the Thinker stay
 * visible and usable, and the clock runs on. First the ready prompt alone ("Valmis vastaamaan?"; the
 * question is not shown yet). Revision (ag): it does not expire; it can be collapsed to a pill that
 * says a question is waiting and expands on a click (both logged); after "Valmis" the question and
 * its four options (the decision strip held, the tools NOT locked); a choice is final, then its
 * confidence on the one scale. FORCED (the view's time ran out before "Valmis"): the item is a modal
 * step over the map and the decision strip, the clock paused; the right column (message log, tools)
 * stays usable. The view carries no key (`SpamView`). Identical in every cell; no tool is named.
 *
 * Visibility (researcher, 9 Oct 2026: the old button was "a little bit disappearing"): the prompt and
 * the pill are a strong amber fill (#f4a261) with dark text (#1c1b19, contrast ≈ 9:1) on the dark
 * theme, the button larger, with a slow glow that `prefers-reduced-motion` turns off.
 */

const AMBER = "#f4a261";
const INK = "#1c1b19";

/** The glow, as a class (inline styles cannot carry keyframes or a media query); reduced motion: none. */
const SPAM_CSS = `
@keyframes spam-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(244,162,97,0.55); } 50% { box-shadow: 0 0 0 8px rgba(244,162,97,0); } }
.spam-attention { animation: spam-glow 1.8s ease-in-out infinite; }
.spam-attention:focus-visible, .spam-ready-button:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .spam-attention { animation: none; } }
`;

const readyButton = {
  padding: "10px 22px", borderRadius: 8, border: `2px solid ${INK}`, background: AMBER, color: INK,
  fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3,
} as const;

export function SpamCard({ spam, orchestrator }: { readonly spam: SpamView; readonly orchestrator: SessionOrchestrator }) {
  const { t, tr } = useLang();
  const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

  if (spam.phase === "ready") {
    if (spam.collapsed) {
      return (
        <div style={{ padding: "6px 16px", background: "#262a30", borderTop: `2px solid ${AMBER}`, flexShrink: 0 }}>
          <style>{SPAM_CSS}</style>
          <button data-testid="spam-pill" className="spam-attention" aria-expanded={false} onClick={() => quiet(orchestrator.expandSpam())}
            style={{ ...readyButton, padding: "6px 16px", fontSize: 14, borderRadius: 999 }}>
            ● {t.spam.waiting}
          </button>
        </div>
      );
    }
    return (
      <div data-testid="spam-ready" role="alert" style={{ padding: "14px 16px", background: "#3a2c1f", borderTop: `3px solid ${AMBER}`, borderBottom: `1px solid ${AMBER}`, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <style>{SPAM_CSS}</style>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#ffe8d2" }}>{t.spam.readyPrompt}</span>
        <button data-testid="spam-ready-button" className="spam-attention spam-ready-button" style={readyButton} onClick={() => quiet(orchestrator.spamReady())}>{t.spam.ready}</button>
        <button data-testid="spam-collapse" aria-expanded={true} onClick={() => quiet(orchestrator.collapseSpam())}
          style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 6, border: `1px solid ${AMBER}`, background: "transparent", color: "#ffe8d2", fontSize: 13, cursor: "pointer" }}>
          {t.spam.collapse}
        </button>
      </div>
    );
  }

  const item = (
    <div data-testid={spam.forced ? "spam-forced" : "spam-item"} style={{ padding: "12px 16px", borderTop: `3px solid ${AMBER}`, background: "#262a30", flexShrink: 0 }}>
      {spam.forced && <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: AMBER }}>{t.spam.forcedTitle}</p>}
      <div style={label}>{t.spam.title}</div>
      <p style={{ margin: "2px 0 8px", fontSize: 14 }}>{tr(spam.promptFi)}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 8 }}>
        {spam.options.map((o) => (
          <button
            key={o.id}
            disabled={spam.phase !== "item"}
            aria-pressed={spam.chosen === o.id}
            onClick={() => quiet(orchestrator.answerSpam(o.id))}
            style={{
              padding: "8px 10px", borderRadius: 6, fontSize: 13, textAlign: "left", color: "#e8eaed",
              cursor: spam.phase === "item" ? "pointer" : "default",
              border: `1px solid ${spam.chosen === o.id ? "#8a9097" : "#3a3f44"}`, background: spam.chosen === o.id ? "#3a3f44" : "#20242a",
            }}
          >
            {tr(o.fi)}
          </button>
        ))}
      </div>
      {spam.phase === "confidence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={hint}>{t.spam.confidencePrompt}</p>
          <ConfidencePicker value={null} onChange={(v) => quiet(orchestrator.submitSpamConfidence(v))} />
        </div>
      )}
      <p style={{ ...hint, margin: "6px 0 0", fontSize: 12 }}>{spam.forced ? t.spam.forcedNote : t.spam.note}</p>
    </div>
  );
  if (!spam.forced) return item;
  // Forced: a modal step over the map column (the map and the decision strip out of reach); the right column stays usable.
  return (
    <div role="dialog" aria-modal="true" aria-label={t.spam.title} style={{ position: "absolute", inset: 0, zIndex: 15, background: "rgba(15,17,20,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "min(640px, 100%)", border: `1px solid ${AMBER}`, borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>{item}</div>
    </div>
  );
}
