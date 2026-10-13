/**
 * GeoChat (SPEC/28 §5): the message log as chat rooms — "All Chat Rooms" first, then the rooms by source
 * (`app/tak/geochat.ts`). A room only groups: each message is the classic log's own row (`MessageLogRow`, the right
 * panel's), keeping its wording, time and source, in the log's order. There is no input: nobody can message a unit
 * (SPEC/02 revision (j)). Choosing a room is logged (`tak_chat_room_viewed`).
 */

import type { RadioLogEntry } from "../../../session/snapshot.js";
import { MessageLogRow } from "../components/RightPanel.js";
import { useLang } from "../i18n.js";
import { geoChatRooms, type GeoChatRoomId } from "./shell.js";
import { paneScroll } from "./TakSidePane.js";
import { TAK } from "./theme.js";

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
            <button key={r.room} type="button" role="tab" aria-selected={active} data-testid={`tak-room-${r.room}`} onClick={() => onRoom(r.room)}
              style={{
                minHeight: 34, padding: "4px 10px", borderRadius: 17, cursor: "pointer", fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? TAK.accent : TAK.panelBorder}`, background: active ? TAK.accentDim : TAK.row, color: active ? "#ffffff" : TAK.text,
              }}>
              {t.tak.geochat.rooms[r.room]} <span style={{ opacity: 0.75, fontFamily: TAK.mono }}>{r.entries.length}</span>
            </button>
          );
        })}
      </div>
      <div style={paneScroll}>
        {shown.entries.length === 0 && <div style={{ opacity: 0.5, fontSize: 12.5 }}>{log.length === 0 ? t.noMessages : t.tak.geochat.empty}</div>}
        {shown.entries.map(({ entry, index }) => <MessageLogRow key={index} entry={entry} />)}
      </div>
      <div style={{ padding: "8px 12px", fontSize: 11.5, color: TAK.textDim, borderTop: `1px solid ${TAK.panelBorder}`, flexShrink: 0 }}>{t.tak.geochat.readOnly}</div>
    </div>
  );
}
