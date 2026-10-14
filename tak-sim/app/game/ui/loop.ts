/**
 * Game mode screen (SPEC/29 §3): the loop driver's arithmetic. No clock is read here: the screen's animation loop passes
 * in the timestamp `requestAnimationFrame` hands its callback (as `app/excon/playback.ts` does), and `frameTicks` turns
 * the real milliseconds since the previous frame into game seconds at the chosen speed, split into at most `maxCalls`
 * calls of `game.tick`. A backgrounded tab resumes instead of leaping ahead (the real gap is clamped), and a slow machine
 * plays slower rather than freezing (game time beyond `maxCalls × maxTickS` in one frame is dropped).
 */

/** Game seconds per real second. 0 = paused. */
export const SPEEDS = [0, 1, 5, 15, 60] as const;
export type Speed = (typeof SPEEDS)[number];

/** Longest real gap one frame may advance by, seconds. */
export const MAX_REAL_DT_S = 0.25;
/** Most `game.tick` calls per animation frame. */
export const MAX_TICK_CALLS = 4;
/** Longest single `game.tick` call, game seconds (the game loop's own step is 10 s). */
export const MAX_TICK_S = 10;

export interface FrameTicks {
  /** The timestamp to pass as `prevMs` next frame. */
  readonly lastMs: number;
  /** Game seconds for each `game.tick` call this frame, in order (empty: nothing to advance). */
  readonly calls: readonly number[];
  /** Game seconds dropped because the frame asked for more than the cap. */
  readonly droppedS: number;
}

/**
 * One animation frame at `frameMs` (the rAF timestamp). `prevMs` is the previous frame's timestamp, or null on the
 * first frame after a start or a resume (that frame only sets the reference). Paused (`speed` 0): no calls.
 */
export function frameTicks(prevMs: number | null, frameMs: number, speed: number, maxCalls = MAX_TICK_CALLS, maxTickS = MAX_TICK_S): FrameTicks {
  if (prevMs === null || !(speed > 0)) return { lastMs: frameMs, calls: [], droppedS: 0 };
  const realS = Math.min(Math.max((frameMs - prevMs) / 1000, 0), MAX_REAL_DT_S);
  const wanted = realS * speed;
  if (!(wanted > 0)) return { lastMs: frameMs, calls: [], droppedS: 0 };
  const cap = Math.max(1, Math.floor(maxCalls)) * maxTickS;
  const total = Math.min(wanted, cap);
  const n = Math.min(Math.max(1, Math.floor(maxCalls)), Math.ceil(total / maxTickS - 1e-9));
  const each = total / n;
  const calls: number[] = [];
  for (let i = 0; i < n; i++) calls.push(each);
  return { lastMs: frameMs, calls, droppedS: wanted - total };
}

/** The speed keys 1–4: 1×, 5×, 15×, 60× (null for any other key). */
export function speedByKey(key: string): Speed | null {
  switch (key) {
    case "1": return 1;
    case "2": return 5;
    case "3": return 15;
    case "4": return 60;
    default: return null;
  }
}

/** Space: pause, or resume at the speed before the pause. */
export function togglePause(speed: Speed, resumeTo: Speed): Speed {
  return speed === 0 ? (resumeTo === 0 ? 1 : resumeTo) : 0;
}
