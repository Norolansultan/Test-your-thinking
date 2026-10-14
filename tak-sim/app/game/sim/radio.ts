/**
 * Game mode: the radio log. Messages come in Finnish and English, in the clipped style of fire-ground
 * traffic (SPEC/18 (n), (aa), (ab)). The log stays readable: a unit's routine traffic is held to one
 * message per five game minutes, an important message is not repeated within five minutes, and only
 * an urgent call (MAYDAY, a building on fire) cuts through.
 */

import type { RadioMessage, XY } from "../contracts.js";

export type Room = RadioMessage["room"];
export type Priority = RadioMessage["priority"];

export interface Text { readonly fi: string; readonly en: string }

export interface Say {
  readonly from: string;
  readonly room: Room;
  readonly text: Text;
  readonly priority: Priority;
  /** What kind of message, for repeat suppression ("tank_empty", "too_hot", …). */
  readonly key: string;
  readonly at?: XY;
  /** Scenario and system traffic: never throttled. */
  readonly force?: boolean;
}

/** A unit's routine traffic: at most one message per this many game seconds. */
export const ROUTINE_GAP_S = 300;
/** The same important message from the same sender: not again within this many seconds. */
export const IMPORTANT_REPEAT_S = 300;
/** The same urgent call: not again within this many seconds. */
export const URGENT_REPEAT_S = 60;

export class RadioLog {
  readonly messages: RadioMessage[] = [];
  private readonly lastFrom = new Map<string, number>();
  private readonly lastKey = new Map<string, number>();

  /** Appends the message unless throttled; true when it went out. */
  say(atS: number, m: Say): boolean {
    const keyId = `${m.from}\u0000${m.key}`;
    if (m.force !== true) {
      const lastKey = this.lastKey.get(keyId);
      const lastFrom = this.lastFrom.get(m.from);
      if (m.priority === "urgent") {
        if (lastKey !== undefined && atS - lastKey < URGENT_REPEAT_S) return false;
      } else if (m.priority === "important") {
        if (lastKey !== undefined && atS - lastKey < IMPORTANT_REPEAT_S) return false;
      } else if (lastFrom !== undefined && atS - lastFrom < ROUTINE_GAP_S) {
        return false;
      }
    }
    this.lastKey.set(keyId, atS);
    this.lastFrom.set(m.from, atS);
    const msg: RadioMessage = m.at === undefined
      ? { atS, from: m.from, room: m.room, textFi: m.text.fi, textEn: m.text.en, priority: m.priority }
      : { atS, from: m.from, room: m.room, textFi: m.text.fi, textEn: m.text.en, priority: m.priority, at: m.at };
    this.messages.push(msg);
    return true;
  }

  /** Pushes a ready message (scenario events) unchanged but for its time. */
  push(atS: number, m: RadioMessage): void {
    this.messages.push({ ...m, atS });
    this.lastFrom.set(m.from, atS);
  }
}

/** Prefixes the sender as fire-ground traffic is logged: "EK11: …". */
export function withSender(from: string, t: Text): Text {
  return { fi: `${from}: ${t.fi}`, en: `${from}: ${t.en}` };
}
