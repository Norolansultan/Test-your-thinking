/**
 * SPEC/28 §6: `npm run tak:replay` — options, the pacing schedule, the rebase onto a client's clock,
 * the dry run, and a real loopback TCP and UDP delivery (tests may open sockets; `app/` may not).
 */

import { createSocket } from "node:dgram";
import { createServer, type AddressInfo } from "node:net";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCot, parseCotEvents, type CotEvent } from "../../app/tak/cot.js";
import { virtualOfIso } from "../../app/tak/time.js";
import { compileScenarioCot } from "../../tools/tak/export.js";
import { DEFAULT_TCP, parseReplayArgs, rebaseEvent, replay, replaySchedule, ReplayUsageError, SA_MULTICAST } from "../../tools/tak/replay.js";

let events: CotEvent[];
beforeAll(() => {
  events = compileScenarioCot();
});

describe("tak:replay options", () => {
  it("defaults to a TAK Server's TCP input, or the SA multicast for UDP", () => {
    expect(parseReplayArgs([])).toEqual({ proto: "tcp", host: DEFAULT_TCP.host, port: 8087, speed: 1, dryRun: false, view: null, limit: null, rebaseTo: null, ttl: 1 });
    expect(parseReplayArgs(["--proto", "udp"])).toMatchObject({ host: "239.2.3.1", port: 6969 });
    expect(SA_MULTICAST).toEqual({ host: "239.2.3.1", port: 6969 });
    expect(parseReplayArgs(["--dry-run", "--speed=1000", "--view", "V07", "--limit", "5", "--host", "10.0.0.2", "--port", "8089"]))
      .toMatchObject({ dryRun: true, speed: 1000, view: "V07", limit: 5, host: "10.0.0.2", port: 8089 });
  });

  it("refuses bad options", () => {
    for (const bad of [["--proto", "http"], ["--speed", "0"], ["--speed", "fast"], ["--port", "80.5"], ["--bogus", "1"], ["--limit"], ["stray"], ["--rebase-to", "today"]]) {
      expect(() => parseReplayArgs(bad), bad.join(" ")).toThrow();
    }
    expect(() => parseReplayArgs(["--proto", "http"])).toThrow(ReplayUsageError);
  });
});

describe("the schedule", () => {
  it("paces by virtual time over the speed, in stream order", () => {
    const s = replaySchedule(events, { speed: 1000, view: null, limit: null, rebaseTo: null });
    expect(s).toHaveLength(events.length);
    expect(s[0]!.atSeconds).toBe(0);
    expect(s[s.length - 1]!.atSeconds).toBeCloseTo((virtualOfIso(events[events.length - 1]!.time) + 4800) / 1000, 6);
    for (let i = 1; i < s.length; i++) expect(s[i]!.atSeconds).toBeGreaterThanOrEqual(s[i - 1]!.atSeconds);
    const v7 = replaySchedule(events, { speed: 1, view: "V07", limit: 3, rebaseTo: null });
    expect(v7.map((x) => x.event.detail.taksim.view)).toEqual(["V07", "V07", "V07"]);
  });

  it("rebases every time onto a chosen start, compressed by the speed", () => {
    const s = replaySchedule(events, { speed: 60, view: "V08", limit: null, rebaseTo: "2026-10-13T12:00:00.000Z" });
    const first = s[0]!.event;
    expect(first.time).toBe("2026-10-13T12:00:00.000Z");
    const proj = s.find((x) => x.event.detail.taksim.kind === "projection")!.event;
    expect(proj.stale).toBe("2026-10-13T12:00:20.000Z"); // a 20-minute horizon at 60× is 20 s
    const chat = s.find((x) => x.event.detail.chat)!.event;
    expect(chat.detail.remarks!.time).toBe(chat.time);
    const e = events[0]!;
    expect(rebaseEvent(e, e.time, e.time, 1)).toEqual(e);
  });
});

describe("delivery", () => {
  it("--dry-run prints the events it would send, nothing opened", async () => {
    const lines: string[] = [];
    const n = await replay({ ...parseReplayArgs(["--dry-run", "--speed", "1000000", "--limit", "25"]) }, events, (l) => lines.push(l));
    expect(n).toBe(25);
    const sent = lines.filter((l) => l.startsWith("+"));
    expect(sent).toHaveLength(25);
    for (const line of sent) expect(() => parseCot(line.slice(line.indexOf(" ") + 1))).not.toThrow();
  });

  it("streams over TCP to a listening server, one event per line", async () => {
    const received: Buffer[] = [];
    const server = createServer((socket) => socket.on("data", (d) => received.push(d)));
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
    const port = (server.address() as AddressInfo).port;
    const closed = new Promise<void>((ok) => server.on("connection", (s) => s.on("close", () => ok())));
    const n = await replay(parseReplayArgs(["--host", "127.0.0.1", "--port", String(port), "--speed", "1000000", "--view", "V03"]), events, () => undefined);
    await closed;
    await new Promise<void>((ok) => server.close(() => ok()));
    const text = Buffer.concat(received).toString("utf8");
    const got = parseCotEvents(`<events>${text}</events>`);
    expect(got).toHaveLength(n);
    expect(got).toEqual(events.filter((e) => e.detail.taksim.view === "V03"));
  });

  it("rejects cleanly when the server resets the connection mid-stream: no uncaught error, the socket is closed", async () => {
    // Before the fix the only `error` listener was removed after connect: the reset was an uncaught exception and the
    // replay's `finally` (closing the socket) never ran — vitest fails the run on the former, `server.close` hangs on the latter.
    let resets = 0;
    const server = createServer((socket) => {
      socket.on("error", () => undefined);
      socket.once("data", () => { resets += 1; socket.resetAndDestroy(); });
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
    const port = (server.address() as AddressInfo).port;
    const lines: string[] = [];
    try {
      // The whole scenario at 200 000×: about a tenth of a second of paced sends, so the reset lands mid-stream.
      await expect(replay(parseReplayArgs(["--host", "127.0.0.1", "--port", String(port), "--speed", "200000"]), events, (l) => lines.push(l))).rejects.toThrow();
    } finally {
      await new Promise<void>((ok) => server.close(() => ok())); // resolves only once the client's socket is closed too
    }
    expect(resets).toBe(1);
    expect(lines.some((l) => l.includes("done"))).toBe(false);
  });

  it("refuses at once when nothing listens (the connect error still rejects)", async () => {
    const server = createServer();
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
    const port = (server.address() as AddressInfo).port;
    await new Promise<void>((ok) => server.close(() => ok()));
    await expect(replay(parseReplayArgs(["--host", "127.0.0.1", "--port", String(port), "--limit", "1"]), events, () => undefined)).rejects.toThrow(/ECONNREFUSED/);
  });

  it("sends one datagram per event over UDP", async () => {
    const socket = createSocket("udp4");
    const datagrams: string[] = [];
    socket.on("message", (m) => datagrams.push(m.toString("utf8")));
    await new Promise<void>((ok) => socket.bind(0, "127.0.0.1", () => ok()));
    const port = socket.address().port;
    const n = await replay(parseReplayArgs(["--proto", "udp", "--host", "127.0.0.1", "--port", String(port), "--speed", "1000000", "--view", "V01", "--limit", "8"]), events, () => undefined);
    for (let i = 0; i < 50 && datagrams.length < n; i++) await new Promise((ok) => setTimeout(ok, 20));
    socket.close();
    expect(datagrams).toHaveLength(8);
    expect(datagrams.map((d) => parseCot(d).uid)).toEqual(events.filter((e) => e.detail.taksim.view === "V01").slice(0, 8).map((e) => e.uid));
  });
});
