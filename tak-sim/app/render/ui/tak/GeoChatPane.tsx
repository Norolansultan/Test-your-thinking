/**
 * GeoChat (SPEC/28 §5): the message log as chat rooms — "All Chat Rooms" first, then the rooms by source
 * (`app/tak/geochat.ts`). A room only groups: each message is the classic log's own row (`MessageLogRow`, the right
 * panel's), keeping its wording, time and source, in the log's order. There is no input: nobody can message a unit
 * (SPEC/02 revision (j)). Choosing a room is logged (`tak_chat_room_viewed`).
 *
 * `TakMessageLog` is the same log, all rooms, under Haku, the Thinker and the index search (review 13 Oct 2026): as in the
 * classic right column, the pushed reports stay on screen while a tool is in use.
 */

import { useLayoutEffect, useRef } from "preact/hooks";
import type { RadioLogEntry } from "../../../session/snapshot.js";
import { MessageLogRow } from "../components/RightPanel.js";
import { useLang } from "../i18n.js";
import { geoChatRooms, type GeoChatRoomId } from "./shell.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

/** The room panel's id (one GeoChat pane at a time) and each room tab's, for the tabs' ARIA pairing. */
const ROOM_PANEL_ID = "tak-room-panel";
const roomTabId = (room: GeoChatRoomId) => `tak-room-tab-${room}`;

export function GeoChatPane({ log, room, onRoom }: {
  readonly log: readonly RadioLogEntry[];
  readonly room: GeoChatRoomId;
  readonly onRoom: (room: GeoChatRoomId) => void;
}) {
  const { t } = useLang();
  const rooms = geoChatRooms(log);
  const shown = rooms.find((r) => r.room === room) ?? rooms[0]!;
  return (
    <div data-tour="log" data-testid="tak-geochat" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div role="tablist" aria-label={t.tak.paneTitle.geochat} style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 12px", borderBottom: `1px solid ${TAK.panelBorder}`, flexShrink: 0 }}>
        {rooms.map((r) => {
          const active = r.room === shown.room;
          return (
            <button key={r.room} type="button" role="tab" id={roomTabId(r.room)} aria-controls={ROOM_PANEL_ID} aria-selected={active} data-testid={`tak-room-${r.room}`} onClick={() => onRoom(r.room)}
              style={{
                minHeight: 34, padding: "4px 10px", borderRadius: 17, cursor: "pointer", fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? TAK.accent : TAK.panelBorder}`, background: active ? TAK.accentDim : TAK.row, color: active ? "#ffffff" : TAK.text,
              }}>
              {t.tak.geochat.rooms[r.room]} <span style={{ opacity: 0.75, fontFamily: TAK.mono }}>{r.entries.length}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={ROOM_PANEL_ID} aria-labelledby={roomTabId(shown.room)} tabIndex={0} style={paneScroll}>
        {shown.entries.length === 0 && <div style={{ opacity: 0.5, fontSize: 12.5 }}>{log.length === 0 ? t.noMessages : t.tak.geochat.empty}</div>}
        {shown.entries.map(({ entry, index }) => <MessageLogRow key={index} entry={entry} wrapSource />)}
      </div>
      <div style={{ padding: "8px 12px", fontSize: 11.5, color: TAK.textDim, borderTop: `1px solid ${TAK.panelBorder}`, flexShrink: 0 }}>{t.tak.geochat.readOnly}</div>
    </div>
  );
}

/** Within this many px of the end, the log counts as showing the newest message and follows the next one in. */
const AT_END_PX = 24;

/**
 * The whole message log ("All Chat Rooms") under a search tool, read-only: the newest message is in view when it opens,
 * and each new one scrolls in while the participant is at the end; scrolled back, they stay where they are.
 */
export function TakMessageLog({ log }: { readonly log: readonly RadioLogEntry[] }) {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_END_PX;
  };
  return (
    <section data-tour="log" data-testid="tak-log-under-tool" aria-label={`${t.tak.paneTitle.geochat}: ${t.tak.geochat.rooms.all}`}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderTop: `2px solid ${TAK.panelBorder}` }}>
      <h3 style={{ margin: 0, padding: "7px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: TAK.accent, background: TAK.panelRaised, borderBottom: `1px solid ${TAK.panelBorder}`, flexShrink: 0 }}>
        {t.tak.paneTitle.geochat} · {t.tak.geochat.rooms.all} <span style={{ color: TAK.textDim, fontFamily: TAK.mono }}>{log.length}</span>
      </h3>
      <div ref={scrollRef} onScroll={onScroll} tabIndex={0} style={paneScroll}>
        {log.length === 0 && <div style={{ opacity: 0.5, fontSize: 12.5 }}>{t.noMessages}</div>}
        {log.map((entry, index) => <MessageLogRow key={index} entry={entry} wrapSource />)}
      </div>
    </section>
  );
}
