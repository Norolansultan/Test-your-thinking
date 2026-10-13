/**
 * SPEC/28 §6: `npm run tak:replay` — streams the scenario's timed CoT to a TAK Server or a TAK client,
 * so a real ATAK / WinTAK / iTAK can follow the incident. For demonstrations, reviewers and the domain
 * experts only: it is offline tooling, never part of a study run, and nothing under `app/` may import
 * it or `node:net` / `node:dgram` (I3; `test/tak/import-boundary.spec.ts`).
 *
 *   npm run tak:replay -- [--proto tcp|udp] [--host H] [--port P] [--speed N] [--dry-run]
 *                         [--view V07] [--limit N] [--rebase-to 2026-10-13T12:00:00Z] [--ttl N]
 *
 * - `--proto tcp` (default): one TCP connection to a TAK Server's plain CoT input, 127.0.0.1:8087 by
 *   default; events are written one per line.
 * - `--proto udp`: one datagram per event; default the TAK SA multicast group 239.2.3.1:6969
 *   (multicast TTL `--ttl`, default 1, i.e. the local network only).
 * - `--speed N`: N virtual seconds per real second (default 1). Events sharing a time go together.
 * - `--dry-run`: prints each event (its pacing offset and XML) instead of sending; nothing is opened.
 * - `--rebase-to ISO`: shifts every time so the first event is at ISO and compresses the timeline by
 *   the speed, so a client's own clock sees each object go stale when it should. Without it the
 *   events carry the incident's own times (26 July 2030), which clients show as never stale.
 * - `--view V07` / `--limit N`: only that view's events / only the first N events.
 *
 * Pacing uses relative timers only (no wall-clock reads), so the schedule is the scenario's.
 */

import { createSocket, type Socket as UdpSocket } from "node:dgram";
import { createConnection, type Socket as TcpSocket } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCot, type CotEvent } from "../../app/tak/cot.js";
import { isoOfUtcMs, utcMsOfIso, virtualOfIso } from "../../app/tak/time.js";
import { compileScenarioCot } from "./export.js";

export const DEFAULT_TCP = { host: "127.0.0.1", port: 8087 } as const;
export const SA_MULTICAST = { host: "239.2.3.1", port: 6969 } as const;

export interface ReplayOptions {
  readonly proto: "tcp" | "udp";
  readonly host: string;
  readonly port: number;
  readonly speed: number;
  readonly dryRun: boolean;
  readonly view: string | null;
  readonly limit: number | null;
  readonly rebaseTo: string | null;
  readonly ttl: number;
}

export class ReplayUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayUsageError";
  }
}

export function parseReplayArgs(argv: readonly string[]): ReplayOptions {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) throw new ReplayUsageError(`unexpected argument ${arg}`);
    const [key, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    if (key === "dry-run") {
      flags.set(key, true);
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined) throw new ReplayUsageError(`--${key} needs a value`);
    flags.set(key, value);
  }
  const known = new Set(["proto", "host", "port", "speed", "dry-run", "view", "limit", "rebase-to", "ttl"]);
  for (const key of flags.keys()) if (!known.has(key)) throw new ReplayUsageError(`unknown option --${key}`);
  const str = (k: string): string | undefined => {
    const v = flags.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const proto = str("proto") ?? "tcp";
  if (proto !== "tcp" && proto !== "udp") throw new ReplayUsageError(`--proto must be tcp or udp, not ${proto}`);
  const defaults = proto === "tcp" ? DEFAULT_TCP : SA_MULTICAST;
  const positive = (k: string, fallback: number, integer: boolean): number => {
    const raw = str(k);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) throw new ReplayUsageError(`--${k} must be a positive ${integer ? "integer" : "number"}, not ${raw}`);
    return n;
  };
  const rebaseTo = str("rebase-to") ?? null;
  if (rebaseTo !== null) utcMsOfIso(rebaseTo); // validates
  const limit = str("limit") === undefined ? null : positive("limit", 1, true);
  return {
    proto,
    host: str("host") ?? defaults.host,
    port: positive("port", defaults.port, true),
    speed: positive("speed", 1, false),
    dryRun: flags.get("dry-run") === true,
    view: str("view") ?? null,
    limit,
    rebaseTo,
    ttl: positive("ttl", 1, true),
  };
}

/** Moves an event's times onto a new timeline: `base + (t − origin) / speed`. */
export function rebaseEvent(event: CotEvent, originIso: string, baseIso: string, speed: number): CotEvent {
  const origin = utcMsOfIso(originIso);
  const base = utcMsOfIso(baseIso);
  const map = (iso: string) => isoOfUtcMs(base + Math.round((utcMsOfIso(iso) - origin) / speed));
  const remarks = event.detail.remarks;
  return {
    ...event,
    time: map(event.time),
    start: map(event.start),
    stale: map(event.stale),
    detail: { ...event.detail, ...(remarks ? { remarks: { ...remarks, ...(remarks.time !== undefined ? { time: map(remarks.time) } : {}) } } : {}) },
  };
}

/** The events to send, in order, each with its offset in real seconds from the first. */
export function replaySchedule(events: readonly CotEvent[], options: Pick<ReplayOptions, "speed" | "view" | "limit" | "rebaseTo">): { readonly atSeconds: number; readonly event: CotEvent }[] {
  let chosen = options.view === null ? [...events] : events.filter((e) => e.detail.taksim.view === options.view);
  if (options.limit !== null) chosen = chosen.slice(0, options.limit);
  const first = chosen[0];
  if (!first) return [];
  const t0 = virtualOfIso(first.time);
  return chosen.map((e) => ({
    atSeconds: (virtualOfIso(e.time) - t0) / options.speed,
    event: options.rebaseTo === null ? e : rebaseEvent(e, first.time, options.rebaseTo, options.speed),
  }));
}

interface Sender {
  send(xml: string): Promise<void>;
  close(): Promise<void>;
}

function tcpSender(host: string, port: number): Promise<Sender> {
  return new Promise((resolveSender, reject) => {
    const socket: TcpSocket = createConnection({ host, port });
    socket.once("error", reject);
    socket.once("connect", () => {
      socket.off("error", reject);
      resolveSender({
        send: (xml) => new Promise((ok, fail) => socket.write(`${xml}\n`, (err) => (err ? fail(err) : ok()))),
        close: () => new Promise((ok) => socket.end(() => ok())),
      });
    });
  });
}

function udpSender(host: string, port: number, ttl: number): Promise<Sender> {
  return new Promise((resolveSender, reject) => {
    const socket: UdpSocket = createSocket({ type: "udp4", reuseAddr: true });
    socket.once("error", reject);
    socket.bind(0, () => {
      const first = Number(host.split(".")[0]);
      if (first >= 224 && first <= 239) socket.setMulticastTTL(ttl);
      socket.off("error", reject);
      resolveSender({
        send: (xml) => new Promise((ok, fail) => socket.send(Buffer.from(xml, "utf8"), port, host, (err) => (err ? fail(err) : ok()))),
        close: () => new Promise((ok) => socket.close(() => ok())),
      });
    });
  });
}

function dryRunSender(log: (line: string) => void): Sender {
  return { send: async (xml) => log(xml), close: async () => undefined };
}

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Streams the schedule; returns the number of events sent. */
export async function replay(options: ReplayOptions, events: readonly CotEvent[] = compileScenarioCot(), log: (line: string) => void = (l) => console.log(l)): Promise<number> {
  const schedule = replaySchedule(events, options);
  const sender = options.dryRun ? dryRunSender(log) : options.proto === "tcp" ? await tcpSender(options.host, options.port) : await udpSender(options.host, options.port, options.ttl);
  const target = options.dryRun ? "dry run" : `${options.proto}://${options.host}:${options.port}`;
  log(`tak:replay: ${schedule.length} events to ${target} at ${options.speed}× (${(schedule[schedule.length - 1]?.atSeconds ?? 0).toFixed(1)} s)`);
  let previous = 0;
  try {
    for (const { atSeconds, event } of schedule) {
      if (atSeconds > previous) await sleep((atSeconds - previous) * 1000);
      previous = atSeconds;
      const xml = serializeCot(event);
      await sender.send(options.dryRun ? `+${atSeconds.toFixed(3)}s ${xml}` : xml);
    }
  } finally {
    await sender.close();
  }
  log(`tak:replay: done, ${schedule.length} events`);
  return schedule.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await replay(parseReplayArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
