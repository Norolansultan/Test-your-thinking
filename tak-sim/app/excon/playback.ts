/**
 * EXCON (SPEC/28 §8) — playback state: play/pause, speed and position on the timeline.
 *
 * No clock is read here. The page's animation loop (`ExconApp.tsx`) passes in the timestamp that
 * `requestAnimationFrame` hands its callback, and {@link advance} turns the real milliseconds between two
 * frames into timeline seconds. So the module is a pure function of its inputs (and stays clean under the
 * determinism lint), and the picture at a given position never depends on how fast the machine is: only how
 * quickly the playhead moves does.
 */

export const SPEEDS = [1, 10, 60] as const;
export type Speed = (typeof SPEEDS)[number];

/** Longest real gap one frame may advance by; a backgrounded tab resumes instead of leaping ahead. */
export const MAX_FRAME_GAP_MS = 250;

export interface Playback {
  readonly positionS: number;
  readonly playing: boolean;
  readonly speed: Speed;
  /** The previous frame's timestamp, null until the first frame after play or a seek. */
  readonly lastFrameMs: number | null;
}

export const INITIAL_PLAYBACK: Playback = { positionS: 0, playing: false, speed: 60, lastFrameMs: null };

/** One animation frame at `frameMs` (the rAF timestamp). At the end of the timeline playback stops there. */
export function advance(p: Playback, frameMs: number, lengthS: number): Playback {
  if (!p.playing) return p.lastFrameMs === null ? p : { ...p, lastFrameMs: null };
  if (p.lastFrameMs === null) return { ...p, lastFrameMs: frameMs };
  const dtMs = Math.min(Math.max(frameMs - p.lastFrameMs, 0), MAX_FRAME_GAP_MS);
  const positionS = Math.min(p.positionS + (dtMs / 1000) * p.speed, lengthS);
  return { ...p, positionS, lastFrameMs: frameMs, playing: positionS < lengthS };
}

export function play(p: Playback, lengthS: number): Playback {
  // Play at the end starts again from the beginning.
  return { ...p, playing: true, lastFrameMs: null, positionS: p.positionS >= lengthS ? 0 : p.positionS };
}

export function pause(p: Playback): Playback {
  return { ...p, playing: false, lastFrameMs: null };
}

export function setSpeed(p: Playback, speed: Speed): Playback {
  return { ...p, speed };
}

export function seek(p: Playback, positionS: number, lengthS: number): Playback {
  return { ...p, positionS: Math.min(Math.max(positionS, 0), lengthS), lastFrameMs: null };
}
