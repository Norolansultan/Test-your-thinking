/**
 * The search tools in the TAK shell (SPEC/28 §5): Haku, the Thinker (AI cells only) and the demonstration's index search
 * keep their own panes — they are not people, so they are never GeoChat contacts. Each pane shows the classic right
 * panel's own component unchanged (`HakuChat`, `OpenAiChat`, `HakuPanel`): the same questions, answers and logging in
 * both shells. While a visible probe locks the tools the pane is hidden, not unmounted, so a draft survives.
 */

import type { ComponentChildren } from "preact";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { HakuChat, OpenAiChat } from "../components/RightPanel.js";
import { HakuPanel } from "../components/Drawers.js";
import { useLang } from "../i18n.js";
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

export function HakuPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <Locked locked={snapshot.toolsLocked}><HakuChat snapshot={snapshot} orchestrator={orchestrator} fill /></Locked>;
}

export function ThinkerPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <Locked locked={snapshot.toolsLocked}><OpenAiChat snapshot={snapshot} orchestrator={orchestrator} fill /></Locked>;
}

export function IndexSearchPane({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  return <Locked locked={snapshot.toolsLocked}><div style={paneScroll}><HakuPanel orchestrator={orchestrator} freeText /></div></Locked>;
}
