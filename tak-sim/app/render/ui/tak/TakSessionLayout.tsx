/**
 * The TAK shell's session layout (SPEC/28 §5, after ATAK / WinTAK): the map fills the screen — the info card top-left,
 * the coordinates and scale bottom-left — with a vertical toolbar at the right edge and one side pane at a time (about
 * 380 px) between them, never over the map's centre. The decision strip (the plan, the SPAM and visible-probe cards)
 * stays under the map exactly as in the classic layout; the status strip, the guided tour, the freeze's blanking and the
 * window-size cover stay with `SessionView`.
 *
 * GeoChat is open at the start, so the message log is on screen from the first moment as in the classic layout (the
 * toolbar counts what arrives while it is closed); Haku, the Thinker and the index search open with the log under them. From
 * V8 the command directive is a full-width strip above the map (inside the blanked area, so a freeze hides it). Every tool
 * interaction is logged through `logMapUse` with a `tak_*` kind (SPEC/28 §5); opening and closing Haku or the Thinker also
 * logs `tab_selected`, as the classic right panel does, so tool use reads alike in both shells. Each mount opens GeoChat
 * with the overlay state in its record, and the pane open at an unmount is closed then (SPEC/07 revision (av)). Reads the
 * snapshot's renderable data only (I4); no clock, no randomness (I1).
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot, MapUseEvent } from "../../../session/orchestrator.js";
import type { GeoExtent } from "../../../engine/primitives.js";
import type { TakOverlayLayer, TakPaneDetail, TakPaneId } from "../../../telemetry/record-kinds.js";
import { MapView, type TakMapHandle, type TakMapOptions } from "../components/MapView.js";
import { JudgementPanel } from "../components/JudgementPanel.js";
import { SpamCard } from "../components/SpamCard.js";
import { VisibleProbeCard } from "../components/VisibleProbeCard.js";
import { ConsultNotice } from "../components/ConsultNotice.js";
import type { PlanDraft } from "../components/DecisionPanels.js";
import { OVERLAY } from "../map-overlay.js";
import { TOUR_OPEN_TOOL_EVENT } from "../tour.js";
import { useLang } from "../i18n.js";
import { TERMINAL_STATES } from "../../../engine/freeze-machine.js";
import {
  consultNoticeTop, consultPaneOf, DEFAULT_OVERLAYS, DEFAULT_PANE, mountPaneRecord, paneShowsLog, SEARCH_PANES, tabToolOf, takContacts, takToolbarPanes, toggleOverlay, unmountRecords, videoFeeds,
  type GeoChatRoomId, type TakContact, type TakOverlayState,
} from "./shell.js";
import { clearRangeBearing, setRangeBearing, TAK_MAP_CSS } from "./tak-map.js";
import { roundedMeasurement } from "./RangeBearing.js";
import { symbolSvg } from "./tak-symbols.js";
import { sidcOf } from "../../../tak/symbols.js";
import { TakToolbar } from "./TakToolbar.js";
import { TakSidePane } from "./TakSidePane.js";
import { GeoChatPane } from "./GeoChatPane.js";
import { ContactsPane } from "./ContactsPane.js";
import { OverlayManagerPane } from "./OverlayManagerPane.js";
import { VideoPane } from "./VideoPane.js";
import { RangeBearingPane, type RbState } from "./RangeBearingPane.js";
import { HakuPane, IndexSearchPane, ThinkerPane } from "./SearchPanes.js";
import { TakCoordReadout, TakDirectiveStrip, TakInfoCard } from "./TakMapChrome.js";
import { TAK } from "./theme.js";

/**
 * What the shell keeps for the whole session, across its remounts (the training screen after the practice view unmounts
 * the layout): the overlay choices and the GeoChat room. Keyed by the session's orchestrator, so a new session starts afresh.
 */
const kept = new WeakMap<SessionOrchestrator, { overlays: TakOverlayState; room: GeoChatRoomId }>();

export function TakSessionLayout({ snapshot, orchestrator, extent, condition, frozen, indexedSearch, planDraft, onPlanDraft }: {
  readonly snapshot: SessionSnapshot;
  readonly orchestrator: SessionOrchestrator;
  readonly extent: GeoExtent;
  readonly condition: "directed" | "substitutive";
  /** A blanked freeze is open: the layout stays mounted but is invisible and unreachable (SPEC/08 §4). */
  readonly frozen: boolean;
  readonly indexedSearch: boolean;
  readonly planDraft: PlanDraft;
  readonly onPlanDraft: (draft: PlanDraft) => void;
}) {
  const { t, lang } = useLang();
  const view = snapshot.currentCycle;
  const viewRef = useRef(view);
  viewRef.current = view;
  const log = (event: MapUseEvent) => { void orchestrator.logMapUse(event).catch(() => undefined); };

  const memory = kept.get(orchestrator) ?? { overlays: DEFAULT_OVERLAYS, room: "all" as GeoChatRoomId };
  const [overlays, setOverlays] = useState<TakOverlayState>(memory.overlays);
  const [room, setRoom] = useState<GeoChatRoomId>(memory.room);
  useEffect(() => { kept.set(orchestrator, { overlays, room }); }, [overlays, room]);

  const panes = takToolbarPanes(condition, { indexedSearch });
  const [pane, setPane] = useState<TakPaneId | null>(DEFAULT_PANE);
  const narrow = useNarrowTak();
  const paneRef = useRef(pane);
  paneRef.current = pane;

  /** Opens `next` (or closes the open pane when `next` is it, or null); logs the closing, the opening and the search tab. */
  const choosePane = (next: TakPaneId | null, cause: TakPaneDetail["cause"]) => {
    const prev = paneRef.current;
    const target = next === prev ? null : next;
    if (prev === target) return;
    if (prev !== null) log({ kind: "tak_pane_closed", detail: { pane: prev, view: viewRef.current, cause: target === null ? cause : "replaced" } });
    if (target !== null) log({ kind: "tak_pane_opened", detail: { pane: target, view: viewRef.current, cause } });
    if (target === "geochat") log({ kind: "tak_chat_room_viewed", detail: { room, view: viewRef.current } });
    // The classic right panel's tab record: a search tool opened, or a search tool closed (`none`).
    const tool = target !== null && SEARCH_PANES.has(target) ? tabToolOf(target) : prev !== null && SEARCH_PANES.has(prev) ? "none" : null;
    if (tool) void orchestrator.logTabSelected(tool).catch(() => undefined);
    paneRef.current = target;
    setPane(target);
  };
  // GeoChat open from the start (the classic layout's always-visible log), logged once per mount with the overlay state then
  // (`mountPaneRecord`: always, so the map's layers can be rebuilt from the log). On unmount (the training screen, the
  // session's end) the open pane is closed, with the search tool's `none` tab record — never after the session is finished,
  // and never fatal: the screen is going away.
  useEffect(() => {
    log({ kind: "tak_pane_opened", detail: mountPaneRecord(viewRef.current, overlays) });
    return () => {
      try {
        const records = unmountRecords(paneRef.current, viewRef.current, TERMINAL_STATES.has(orchestrator.engineState));
        if (!records) return;
        log({ kind: "tak_pane_closed", detail: records.closed });
        if (records.tab) void orchestrator.logTabSelected(records.tab).catch(() => undefined);
      } catch { /* the session is gone: nothing to log */ }
    };
  }, []);
  // Revision (am): the practice tour's Thinker step opens the Thinker pane (logged like a click on it).
  useEffect(() => {
    const open = (e: Event) => { if ((e as CustomEvent).detail === "ai" && panes.includes("thinker") && paneRef.current !== "thinker") choosePane("thinker", "tour"); };
    window.addEventListener(TOUR_OPEN_TOOL_EVENT, open);
    return () => window.removeEventListener(TOUR_OPEN_TOOL_EVENT, open);
  });

  // SPEC/30 §4: the consult notification's button opens its tool's pane once `consult_prompt_opened` is durable (left open if it is).
  const openConsult = () => void orchestrator.openConsultPrompt().then((consulted) => {
    const target = consultPaneOf(consulted);
    if (panes.includes(target) && paneRef.current !== target) choosePane(target, "toolbar");
  }, () => undefined);

  // GeoChat's unread count: what arrived while no open pane showed the log (GeoChat, or a search tool over it).
  const [seen, setSeen] = useState(snapshot.radioLog.length);
  useEffect(() => { if (paneShowsLog(pane)) setSeen(snapshot.radioLog.length); }, [pane, snapshot.radioLog.length]);
  const unread = Math.max(0, snapshot.radioLog.length - seen);

  // The live map, once loaded (MapView hands it over).
  const [handle, setHandle] = useState<TakMapHandle | null>(null);
  const tak: TakMapOptions = useMemo(() => ({
    overlays,
    onMap: setHandle,
    planLabels: t.tak.plan,
    legendSymbols: { unit: symbolSvg(sidcOf("EK11"), 24), air: symbolSvg(sidcOf("DR1"), 24) },
  }), [overlays, lang]);

  const onToggle = (layer: TakOverlayLayer) => {
    const next = toggleOverlay(overlays, layer);
    if (!next) return; // the projection, the current perimeter and rate marks have no switch
    setOverlays(next);
    log({ kind: "tak_overlay_toggled", detail: { layer, on: next[layer], view } });
  };

  // Contacts: choosing one centres the map on it — the participant's own move, after the record that says why.
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const contacts = takContacts(snapshot.renderTree.cycleInfo, snapshot.radioLog, lang, { at: OVERLAY.commandPost, callsign: t.tak.selfCallsign, role: t.tak.selfRole });
  const onContact = (c: TakContact) => {
    setSelectedContact(c.uid);
    log({ kind: "tak_contact_selected", detail: { uid: c.uid, view } });
    if (handle) { handle.markParticipantMove(); handle.map.jumpTo({ center: [c.at.lon, c.at.lat] }); }
  };

  // Range & Bearing: while its pane is open, the map's taps set the two points; the line stays until cleared.
  const [rb, setRb] = useState<RbState>({ from: null, to: null });
  const rbArmed = pane === "range_bearing";
  useEffect(() => {
    if (!handle || !rbArmed) return undefined;
    const map = handle.map;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      const p = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      setRb((cur) => (!cur.from || cur.to ? { from: p, to: null } : { from: cur.from, to: p }));
    };
    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", onClick); map.getCanvas().style.cursor = ""; };
  }, [handle, rbArmed]);
  const rbLogged = useRef<RbState | null>(null);
  useEffect(() => {
    if (!handle) return;
    if (rb.from) setRangeBearing(handle.map, rb.from, rb.to, lang); else clearRangeBearing(handle.map);
    if (rb.from && rb.to && rbLogged.current !== rb) {
      rbLogged.current = rb; // one record per measurement, whatever else re-runs this
      const m = roundedMeasurement(rb.from, rb.to);
      log({ kind: "tak_rb_measured", detail: { ...m, view: viewRef.current } });
    }
  }, [handle, rb, lang]);

  // Video: each tile is logged when it is first on screen in an open pane, and when it is enlarged.
  const feeds = videoFeeds(snapshot.renderTree.cycleInfo);
  const [videoSelected, setVideoSelected] = useState<string | null>(null);
  const feedsShown = useRef(new Set<string>());
  const feedKey = feeds.map((f) => f.platformId).join(",");
  useEffect(() => {
    if (pane !== "video") { feedsShown.current.clear(); return; }
    for (const f of feeds) {
      const key = `${view}|${f.platformId}`;
      if (feedsShown.current.has(key)) continue;
      feedsShown.current.add(key);
      log({ kind: "tak_video_viewed", detail: { platformId: f.platformId, view, cause: "pane" } });
    }
  }, [pane, feedKey, view]);
  const onVideo = (id: string | null) => {
    setVideoSelected(id);
    if (id) log({ kind: "tak_video_viewed", detail: { platformId: id, view, cause: "select" } });
  };

  const onRoom = (r: GeoChatRoomId) => {
    setRoom(r);
    log({ kind: "tak_chat_room_viewed", detail: { room: r, view } });
  };

  const body = (p: TakPaneId) => {
    switch (p) {
      case "overlays": return <OverlayManagerPane state={overlays} onToggle={onToggle} />;
      case "contacts": return <ContactsPane contacts={contacts} onSelect={onContact} selected={selectedContact} />;
      case "geochat": return <GeoChatPane log={snapshot.radioLog} room={room} onRoom={onRoom} />;
      case "video": return <VideoPane feeds={feeds} cycle={snapshot.renderTree.cycleInfo} selected={videoSelected} onSelect={onVideo} />;
      case "range_bearing": return <RangeBearingPane rb={rb} onClear={() => setRb({ from: null, to: null })} />;
      case "haku": return <HakuPane snapshot={snapshot} orchestrator={orchestrator} />;
      case "thinker": return <ThinkerPane snapshot={snapshot} orchestrator={orchestrator} />;
      case "indexed_search": return <IndexSearchPane snapshot={snapshot} orchestrator={orchestrator} />;
    }
  };

  return (
    <div inert={frozen} aria-hidden={frozen} data-testid="tak-shell"
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative", visibility: frozen ? "hidden" : "visible", background: TAK.panel }}>
      <style>{TAK_MAP_CSS}</style>
      {/* From V8 (null before): the directive, full width between the status strip and the map — never over the map. */}
      {snapshot.directiveInForce !== null && <TakDirectiveStrip directive={snapshot.directiveInForce} />}
      <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, position: "relative" }}>
        {/* The map column: the map, then the decision strip under it, as in the classic layout (SessionView). */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <MapView snapshot={snapshot} extent={extent} onMapUse={(e) => orchestrator.logMapUse(e)} tak={tak}>
              <TakInfoCard clockLabel={snapshot.clockLabel} wind={snapshot.renderTree.cycleInfo?.wind} />
              <TakCoordReadout map={handle?.map ?? null} />
            </MapView>
            {snapshot.visibleProbe && (
              <VisibleProbeCard probe={snapshot.visibleProbe} orchestrator={orchestrator} />
            )}
            {snapshot.spam && <SpamCard spam={snapshot.spam} orchestrator={orchestrator} />}
            <div inert={snapshot.decisionHeld} aria-hidden={snapshot.decisionHeld} style={{ display: snapshot.visibleProbe ? "none" : "flex", flexDirection: "column", flexShrink: 0, opacity: snapshot.decisionHeld ? 0.45 : 1 }}>
              <JudgementPanel snapshot={snapshot} orchestrator={orchestrator} planDraft={planDraft} onPlanDraft={onPlanDraft} />
            </div>
          </div>
        </div>
        {pane !== null && (
          <TakSidePane key={pane} testId={`tak-pane-${pane}`} title={t.tak.paneTitle[pane]} onClose={() => choosePane(null, "close_button")} overlay={narrow}>
            {body(pane)}
          </TakSidePane>
        )}
        <TakToolbar panes={panes} open={pane} onSelect={(p) => choosePane(p, "toolbar")} searchLocked={snapshot.toolsLocked} unread={unread} logTarget={!paneShowsLog(pane)} />
        {/* SPEC/30 §4: the consult notification beside its tool's toolbar button; non-modal (over a side pane, never over the map's centre). */}
        {snapshot.consultPrompt && (
          <ConsultNotice prompt={snapshot.consultPrompt} text={t.consult} onOpen={openConsult} onDismiss={() => void orchestrator.dismissConsultPrompt().catch(() => undefined)}
            style={{ position: "absolute", right: TAK.toolbarWidth + 8, top: consultNoticeTop(panes, snapshot.consultPrompt.tool, TAK.toolButtonHeight), zIndex: 23, width: "min(340px, calc(100% - 120px))", boxSizing: "border-box" }} />
        )}
      </div>
    </div>
  );
}

/**
 * Below this window width (a phone, the web demo in a side panel) a side pane would leave the map almost no width
 * (pane ≥ 300 px + toolbar 76 px), so the open pane lies over the map instead; closing it shows the map again (14 Oct 2026).
 */
export const TAK_OVERLAY_BELOW_PX = 760;

function useNarrowTak(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < TAK_OVERLAY_BELOW_PX);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < TAK_OVERLAY_BELOW_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}
