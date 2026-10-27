/**
 * SPEC/28 §5: the GeoChat rooms the message log is grouped into. A room only groups messages; every
 * message keeps its own wording, time and source. Shared by the CoT compiler (`chatroom` of each
 * `b-t-f` event) and the TAK shell's GeoChat pane, so the export and the screen group alike.
 */

export type ChatRoom = "ground" | "air" | "command" | "support";

/** The rooms in the order the pane lists them, after the virtual "All Chat Rooms". */
export const CHAT_ROOMS: readonly ChatRoom[] = ["ground", "air", "command", "support"];

export const CHAT_ROOM_LABEL: Readonly<Record<ChatRoom, { readonly fi: string; readonly en: string }>> = {
  ground: { fi: "Maayksiköt", en: "Ground units" },
  air: { fi: "Ilma ja droonit", en: "Air & drones" },
  command: { fi: "Johto", en: "Command" },
  support: { fi: "Tuki ja sää", en: "Support & weather" },
};

export const ALL_CHAT_ROOMS_LABEL = { fi: "Kaikki keskustelut", en: "All Chat Rooms" } as const;

/**
 * Sources that are aircraft or drone teams (the scenario's `drone`, `water_drone`, `spotter_aircraft`, `helicopter` actors): every
 * drone call sign DR<n> (review 27 Oct 2026: the training's DR8 was filed under support; the scenario's DR1–DR3 are unchanged) and
 * the named ones.
 */
const AIR = new Set(["VD1", "SPOT", "HELI1", "DRONERYHMÄ"]);
const DRONE = /^DR\d+$/;
/** Command and the duty officers above the participant; JOKE, the rescue department's command centre that acknowledges reports (revision (bn)). */
const COMMAND = new Set(["P2", "P3", "TILANNEKUVA", "HÄTÄKESKUS", "JÄLKIVARTIO", "JOKE"]);
/** Ground units: rescue units (EK*, KY*, OUT*), the volunteer brigade and the robot. */
const GROUND = /^(EK\d+|KY\d+|OUT\d+|VPK|UGV\d+)$/;

/** The room a message from `sourceId` belongs to; anything not a unit, aircraft or command (weather, water supply, agencies) is support. */
export function chatRoomOf(sourceId: string): ChatRoom {
  const id = sourceId.trim().toUpperCase();
  if (DRONE.test(id) || AIR.has(id)) return "air";
  if (COMMAND.has(id)) return "command";
  if (GROUND.test(id)) return "ground";
  return "support";
}
