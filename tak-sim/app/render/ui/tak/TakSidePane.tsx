/**
 * The TAK shell's side pane (SPEC/28 §5): one tool at a time, about 380 px, beside the map — never over its centre. A
 * title bar with a large close button, and the tool's body under it (the body scrolls itself).
 */

import type { ComponentChildren } from "preact";
import { useLang } from "../i18n.js";
import { TAK } from "./theme.js";

export function TakSidePane({ title, onClose, children, testId, overlay = false }: {
  readonly title: string;
  /** A narrow window (`TAK_OVERLAY_BELOW_PX`): the pane lies over the map, beside the toolbar, instead of taking width from it. */
  readonly overlay?: boolean;
  readonly onClose: () => void;
  readonly children: ComponentChildren;
  readonly testId: string;
}) {
  const { t } = useLang();
  return (
    <aside data-testid={testId} aria-label={title}
      style={{ ...(overlay ? { position: "absolute" as const, top: 0, bottom: 0, left: 0, right: TAK.toolbarWidth, zIndex: 22 } : { width: TAK.paneWidth, flexShrink: 0 }), display: "flex", flexDirection: "column", minHeight: 0, background: TAK.panel, color: TAK.text, borderLeft: `1px solid ${TAK.panelBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 4px 0 14px", background: TAK.panelRaised, borderBottom: `2px solid ${TAK.accent}`, flexShrink: 0 }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{title}</h2>
        <button type="button" data-testid="tak-pane-close" onClick={onClose} aria-label={t.tak.closePane} title={t.tak.closePane}
          style={{ width: 44, height: 40, border: "none", borderRadius: TAK.radius, background: "transparent", color: TAK.text, fontSize: 22, lineHeight: 1, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
    </aside>
  );
}

/** A pane's scrolling body. */
export const paneScroll = { flex: 1, minHeight: 0, overflowY: "auto" as const, padding: 12, display: "flex", flexDirection: "column" as const, gap: 10 };
