/**
 * The TAK shell's toolbar (SPEC/28 §5, after ATAK): a vertical strip at the right edge, one large button per tool — icon
 * and label — that opens its side pane (one at a time; pressing the open tool's button closes it). Haku and the Thinker
 * are disabled while a visible probe locks the search tools; GeoChat shows how many messages arrived while it was closed.
 */

import type { JSX } from "preact";
import type { TakPaneId } from "../../../telemetry/record-kinds.js";
import { useLang } from "../i18n.js";
import { SEARCH_PANES, toolbarButtonName } from "./shell.js";
import { TAK } from "./theme.js";
import { HelpCard } from "../explain/HelpCard.js";

const icon = (body: JSX.Element) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{body}</svg>
);

/** Line icons in `currentColor` (inline: no request during a run, I3). */
export const TAK_PANE_ICON: Readonly<Record<TakPaneId, JSX.Element>> = {
  // Stacked layers.
  overlays: icon(<><path d="M12 3 2.5 8 12 13l9.5-5z" /><path d="m2.5 12.5 9.5 5 9.5-5" /><path d="m2.5 16.5 9.5 5 9.5-5" /></>),
  // A person with a list.
  contacts: icon(<><circle cx="8" cy="8" r="3.2" /><path d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><path d="M15 7h6.5M15 11h6.5M17 15h4.5" /></>),
  // A speech bubble with a location pin.
  geochat: icon(<><path d="M4 4.5h16v11H11l-4.5 4v-4H4z" /><path d="M12 7.2a2.2 2.2 0 0 1 2.2 2.2c0 1.6-2.2 3.6-2.2 3.6s-2.2-2-2.2-3.6A2.2 2.2 0 0 1 12 7.2z" /></>),
  // A camera.
  video: icon(<><rect x="2.5" y="6" width="13" height="12" rx="1.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5" /><circle cx="9" cy="12" r="2.4" /></>),
  // A ruler between two points.
  range_bearing: icon(<><circle cx="4.5" cy="19.5" r="2" /><circle cx="19.5" cy="4.5" r="2" /><path d="M6 18 18 6" stroke-dasharray="2.5 2" /><path d="M14.5 4.5h-3M19.5 9.5v3" /></>),
  // A magnifier.
  haku: icon(<><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 6 6" /></>),
  // A thought bubble.
  thinker: icon(<><path d="M7 15.5c-2.5 0-4.5-1.8-4.5-4.2S4.5 7 7 7c.6-2.3 2.7-4 5.2-4 2.7 0 4.9 1.9 5.3 4.4 2.2.3 4 2 4 4.2 0 2.3-2 3.9-4.4 3.9z" /><circle cx="6" cy="19" r="1.3" /><circle cx="3.5" cy="21.5" r=".8" /></>),
  // An index card.
  indexed_search: icon(<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7 9h10M7 12.5h10M7 16h6" /></>),
};

/** The toolbar's `data-tour` targets: the guided tour points at Haku and the Thinker here (`tour.ts`). */
const TOUR_TARGET: Partial<Record<TakPaneId, string>> = { haku: "haku", thinker: "thinker", indexed_search: "indexed-search" };

export function TakToolbar({ panes, open, onSelect, searchLocked, unread, logTarget }: {
  readonly panes: readonly TakPaneId[];
  readonly open: TakPaneId | null;
  readonly onSelect: (pane: TakPaneId) => void;
  /** A visible probe is open: Haku and the Thinker (and the index search) are off. */
  readonly searchLocked: boolean;
  /** Messages that arrived while GeoChat was closed. */
  readonly unread: number;
  /** The GeoChat button carries the tour's "log" target while its pane is closed. */
  readonly logTarget: boolean;
}) {
  const { t } = useLang();
  return (
    <nav aria-label={t.tak.toolbarAria} data-testid="tak-toolbar"
      style={{ width: TAK.toolbarWidth, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2, padding: "6px 4px", background: TAK.panel, borderLeft: `1px solid ${TAK.panelBorder}`, overflowY: "auto", boxSizing: "border-box" }}>
      {panes.map((p) => {
        const active = open === p;
        const disabled = searchLocked && SEARCH_PANES.has(p);
        const tour = p === "geochat" && logTarget ? "log" : TOUR_TARGET[p];
        const badge = p === "geochat" && unread > 0 && !active;
        return (
          <button key={p} type="button" data-testid={`tak-tool-${p}`} {...(tour ? { "data-tour": tour } : {})} disabled={disabled} aria-pressed={active}
            aria-label={toolbarButtonName(t.tak.toolbar[p], t.tak.paneTitle[p], badge ? t.tak.geochat.unread(unread) : null)}
            onClick={() => onSelect(p)} title={t.tak.paneTitle[p]}
            style={{
              position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              minHeight: TAK.toolButtonHeight, padding: "6px 2px", border: "none", borderRadius: TAK.radius, cursor: disabled ? "not-allowed" : "pointer",
              background: active ? TAK.accentDim : "transparent", color: active ? "#ffffff" : disabled ? "#56636c" : TAK.text,
              boxShadow: active ? `inset 3px 0 0 ${TAK.accent}` : "none", fontSize: 11, fontWeight: 600, lineHeight: 1.1, textAlign: "center",
            }}>
            {TAK_PANE_ICON[p]}
            <span style={{ maxWidth: TAK.toolbarWidth - 10, overflowWrap: "anywhere" }}>{t.tak.toolbar[p]}</span>
            {badge && (
              <span data-testid="tak-unread" aria-hidden="true"
                style={{ position: "absolute", top: 4, right: 8, minWidth: 18, height: 18, padding: "0 4px", boxSizing: "border-box", borderRadius: 9, background: TAK.warn, color: "#1c1b19", fontSize: 11, fontWeight: 700, lineHeight: "18px" }}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        );
      })}
      {/* SPEC/35 §3: the help card at the toolbar's foot, public sessions only (renders nothing for experts). */}
      <HelpCard variant="toolbar" />
    </nav>
  );
}
