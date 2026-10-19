/**
 * The consult notification (SPEC/30 §4; `session/consult-notice.ts`): a small non-modal notice beside the tool button —
 * "New reports since your last plan" — with one button that opens the group's tool (Haku, or the Thinker) and a close
 * button. It carries no content and names no record, so it is identical in fit and no-fit views. Both shells show this
 * same component: the classic right panel under its tool buttons, the TAK shell beside its toolbar. The texts come in as
 * a prop (no hook), so the component is a plain function of its props.
 */

import type { JSX } from "preact";
import type { ConsultPromptView } from "../../../session/consult-notice.js";
import type { UiText } from "../../../i18n/ui.js";

const AMBER = "#f4a261";

export function ConsultNotice({ prompt, text, onOpen, onDismiss, style }: {
  readonly prompt: ConsultPromptView;
  readonly text: UiText["consult"];
  /** The open button: the orchestrator logs `consult_prompt_opened`, then the shell opens the tool. */
  readonly onOpen: () => void;
  readonly onDismiss: () => void;
  /** Where the shell places it. */
  readonly style?: JSX.CSSProperties;
}) {
  return (
    <div role="status" data-testid="consult-notice" data-tool={prompt.tool}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#2b2620", border: `1px solid ${AMBER}`, borderLeft: `4px solid ${AMBER}`, borderRadius: 6, color: "#f6efe7", fontSize: 12.5, boxShadow: "0 4px 14px rgba(0,0,0,0.35)", ...style }}>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>{text.notice}</span>
      <button type="button" data-testid="consult-open" onClick={onOpen}
        style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${AMBER}`, background: AMBER, color: "#1c1b19", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>
        {prompt.tool === "haku" ? text.openHaku : text.openThinker}
      </button>
      <button type="button" data-testid="consult-dismiss" onClick={onDismiss} aria-label={text.close} title={text.close}
        style={{ width: 28, height: 28, border: "none", borderRadius: 5, background: "transparent", color: "#f6efe7", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
    </div>
  );
}
