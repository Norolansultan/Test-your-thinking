/**
 * The search tools in the TAK shell (SPEC/28 §5): Haku, the Thinker (AI cells only) and the demonstration's index search
 * keep their own panes — they are not people, so they are never GeoChat contacts. Each pane shows the classic right
 * panel's own component unchanged (`HakuChat`, `OpenAiChat`, `HakuPanel`): the same questions, answers and logging in
 * both shells. While a visible probe locks the tools the tool is hidden, not unmounted, so a draft survives.
 *
 * Review 13 Oct 2026: each opens with the message log under it — the tool on top (`SEARCH_TOOL_SHARE_PCT` of the pane), the
 * whole log below, newest in view — as the classic right column shows the tools and the log together, so using a tool
 * never hides the pushed reports. While the tools are locked the log takes the pane.
 */

import type { ComponentChildren } from "preact";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { HakuChat, OpenAiChat } from "../components/RightPanel.js";
import { HakuPanel } from "../components/Drawers.js";
import { useLang } from "../i18n.js";
import { TakMessageLog } from "./GeoChatPane.js";
import { SEARCH_TOOL_SHARE_PCT } from "./shell.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

function Locked({ locked, children }: { readonly locked: boolean; readonly children: ComponentChildren }) {
  const { t } = useLang();
  return (
    <>
      {locked && <div data-testid="tools-locked" style={{ padding: "10px 12px", fontSize: 12.5, color: TAK.textDim, borderBottom: `1px solid ${TAK.panelBorder}` }}>{t.spam.toolsLocked}</div>}
      <div inert={locked} style={{ display: locked ? "none" : "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>{children}</div>
    </>
  );
}

/** A search tool over the message log: the tool keeps its share of the height, the log the rest. */
function ToolOverLog({ snapshot, children }: { readonly snapshot: SessionSnapshot; readonly children: ComponentChildren }) {
  const locked = snapshot.toolsLocked;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div data-testid="tak-search-tool" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: locked ? "0 0 auto" : `0 0 ${SEARCH_TOOL_SHARE_PCT}%` }}>
        <Locked locked={locked}>{children}</Locked>
      </div>
      <TakMessageLog log={snapshot.radioLog} />
    </div>
  );
}

export function HakuPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <ToolOverLog snapshot={snapshot}><HakuChat snapshot={snapshot} orchestrator={orchestrator} fill /></ToolOverLog>;
}

export function ThinkerPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <ToolOverLog snapshot={snapshot}><OpenAiChat snapshot={snapshot} orchestrator={orchestrator} fill /></ToolOverLog>;
}

export function IndexSearchPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <ToolOverLog snapshot={snapshot}><div style={paneScroll}><HakuPanel orchestrator={orchestrator} freeText /></div></ToolOverLog>;
}
