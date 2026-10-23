/**
 * A play run on disk (`tools/play/`): `<run>/actions.json` (the configuration and every command the player issued, with its
 * virtual-time costs: `ActionRecord`), `<run>/transcript.md` (every command and what it printed, refused ones too, for the
 * analyst) and `<run>/screens/` (the PNGs `look` drew). Each call replays the run into a fresh session (`session.ts`), applies one
 * command, draws its images (after the virtual clock has given the timers back: Playwright needs the real ones) and saves.
 * The CLI (`play.ts`) and the spec (`test/tools/play.spec.ts`) both go through here.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PlayError, PlaySession, type ActionRecord, type PlayConfig } from "./session.js";
import { runCommand } from "./commands.js";
import { renderImages } from "./map-render.js";

export const RUN_FORMAT = "tak-sim-play-run";
export interface RunFile {
  readonly format: typeof RUN_FORMAT;
  readonly version: 1;
  readonly config: PlayConfig;
  readonly actions: ActionRecord[];
}

export interface PlayOptions {
  /** Draw the PNGs (Chromium); off in the spec. */
  readonly withMap: boolean;
}

export interface PlayResult { readonly ok: boolean; readonly text: string; readonly images: readonly string[] }

const actionsPath = (dir: string) => join(dir, "actions.json");

export function readRun(dir: string): RunFile {
  if (!existsSync(actionsPath(dir))) throw new PlayError(`no run in ${dir} (start one: play.ts start --run ${dir} --audience expert|public --lang fi|en)`);
  const run = JSON.parse(readFileSync(actionsPath(dir), "utf8")) as RunFile;
  if (run.format !== RUN_FORMAT || run.version !== 1) throw new PlayError(`${actionsPath(dir)} is not a play run`);
  return run;
}

/** The run replayed into a live session (the caller disposes it). */
export async function replayRun(dir: string, run: RunFile = readRun(dir)): Promise<PlaySession> {
  const session = await PlaySession.create(run.config);
  try {
    for (const record of run.actions) {
      session.begin(record);
      await runCommand(session, record.cmd, record.args, { runDir: dir, withMap: false });
    }
  } catch (e) {
    session.dispose();
    throw e;
  }
  return session;
}

const clockOf = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function transcript(dir: string, n: number, cmd: string, args: readonly string[], atMs: number, text: string, ok: boolean): void {
  const shown = [cmd, ...args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a))].join(" ");
  appendFileSync(join(dir, "transcript.md"), `\n## ${n}. \`${shown}\`${ok ? "" : " — REFUSED"} (virtual ${clockOf(atMs)})\n\n\`\`\`text\n${text}\n\`\`\`\n`);
}

/** A new run in `dir`: the session to its first screen, which is shown (recorded as the run's first `look`). */
export async function startRun(dir: string, config: PlayConfig, options: PlayOptions): Promise<PlayResult> {
  if (existsSync(actionsPath(dir))) throw new PlayError(`${dir} already holds a run (use another --run directory)`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "transcript.md"), `# Play run — audience ${config.audience}, language ${config.lang}\n\nThe Haku group (cell \`radio\`), the study's options; Haku answers are the proxy's template fallback (no model).\n`);
  const run: RunFile = { format: RUN_FORMAT, version: 1, config, actions: [] };
  return apply(dir, run, "look", [], options, "start");
}

/** One command on an existing run. */
export async function playCommand(dir: string, cmd: string, args: readonly string[], options: PlayOptions): Promise<PlayResult> {
  return apply(dir, readRun(dir), cmd, args, options, cmd);
}

async function apply(dir: string, run: RunFile, cmd: string, args: readonly string[], options: PlayOptions, shownAs: string): Promise<PlayResult> {
  const session = await replayRun(dir, run);
  const atMs = session.clock.now();
  let text: string;
  let images: typeof session.images = [];
  try {
    session.begin(null);
    text = await runCommand(session, cmd, args, { runDir: dir, withMap: options.withMap });
    images = session.images;
    run.actions.push({ cmd, args: [...args], atMs, costsMs: session.spent() });
  } catch (e) {
    session.dispose();
    if (!(e instanceof PlayError)) throw e;
    const refused = `Refused: ${e.message}`;
    transcript(dir, run.actions.length + 1, shownAs, shownAs === "start" ? [] : args, atMs, refused, false);
    return { ok: false, text: refused, images: [] };
  }
  session.dispose(); // the real timers back before Playwright runs
  writeFileSync(actionsPath(dir), `${JSON.stringify(run, null, 1)}\n`);
  let written: string[] = [];
  if (options.withMap && images.length > 0) {
    try { written = await renderImages(images, session.scenario.extent, join(dir, ".map-cache")); }
    catch (e) { text += `\n» The map image could not be drawn: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`; }
  }
  transcript(dir, run.actions.length, shownAs, shownAs === "start" ? [] : args, atMs, text, true);
  return { ok: true, text, images: written };
}
