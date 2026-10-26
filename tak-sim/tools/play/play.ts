/**
 * `npx tsx tools/play/play.ts <command> --run <dir> [arguments]` (`npm run play -- …`) — the play harness: an LLM "player" plays
 * the TAK wildfire command session turn by turn, as a participant would, without a browser. The REAL session engine runs headless
 * on a virtual clock (`session.ts`), every call replays the run and applies one command (`run.ts`), and prints what the
 * participant's screen shows (`screen.ts`, the live map as a PNG through `map-render.ts`). `score` is the analyst's (`score.ts`):
 * it is the only command that reads the keys, and writes them to `<run>/score.md` and `score.json`, never to the screen.
 *
 * Commands (README.md has the costs and the limitations):
 *   start --audience expert|public --lang fi|en     look [--all]    continue          wait [seconds]
 *   haku "<question>"   chip   haku-history   glossary <term>   help [glossary|roster|legend] [letter]   consult open|dismiss
 *   primer-answer <n>   primer-retry   primer-next   primer-back      training-answer <letter|x,y> [confidence]
 *   freeze-answer <item> <option|x,y> <25|50|75|100>   freeze-submit
 *   spam-ready   spam-collapse   spam-expand   spam-answer <option> <confidence> | spam-answer <confidence>
 *   plan main=… posture=… secondary=… drones=… [departure=… reason=…]   confirm   revise
 *   plan-confidence <v>   review keep|change   probe-answer …   hinge-answer <option>   hinge-fatigue <1-7>
 *   quest-answer <item> <option|number>   quest-submit   score [--force]
 * Flags: --run <dir> (required), --no-map (no PNGs).
 */

import { resolve } from "node:path";
import type { Audience } from "../../app/session/public-session.js";
import type { Lang } from "../../app/i18n/lang.js";
import { PlayError } from "./session.js";
import { playCommand, replayRun, startRun, type PlayResult } from "./run.js";
import { writeScore } from "./score.js";

interface Argv { readonly cmd: string; readonly args: string[]; readonly flags: Map<string, string | true> }

function parse(argv: readonly string[]): Argv {
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  const valued = new Set(["run", "audience", "lang"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      if (valued.has(name)) { flags.set(name, argv[i + 1] ?? ""); i++; } else flags.set(name, true);
    } else args.push(a);
  }
  return { cmd: args.shift() ?? "", args, flags };
}

const PREAMBLE = [
  "» You are the participant: the incident commander (PTJ / IC) of a forest fire, in the Haku group (Haku = Search). The session runs on a",
  "» virtual clock: every command costs the time a participant would spend on it (README.md); `look` is free. Answer from what the",
  "» screens show. Haku's answers here are the template fallback (no AI model). Use `look` after any command to see the whole screen.",
];

async function main(): Promise<number> {
  const { cmd, args, flags } = parse(process.argv.slice(2));
  const run = flags.get("run");
  if (!cmd || typeof run !== "string" || run === "") {
    process.stderr.write("usage: npx tsx tools/play/play.ts <command> --run <dir> [arguments] (see tools/play/README.md)\n");
    return 2;
  }
  const dir = resolve(run);
  const withMap = !flags.has("no-map");
  let result: PlayResult;
  try {
    if (cmd === "start") {
      const audience = flags.get("audience") ?? "expert", lang = flags.get("lang") ?? "fi";
      if ((audience !== "expert" && audience !== "public") || (lang !== "fi" && lang !== "en")) throw new PlayError("start --audience expert|public --lang fi|en");
      result = await startRun(dir, { audience: audience as Audience, lang: lang as Lang, waitStopsOnMessages: true, questionnairesPlayed: true }, { withMap });
      if (result.ok) result = { ...result, text: [...PREAMBLE, "", result.text].join("\n") };
    } else if (cmd === "score") {
      const session = await replayRun(dir);
      session.dispose();
      if (session.snap().step !== "complete" && !flags.has("force")) throw new PlayError("the session is not complete (score --force to score it anyway)");
      const written = await writeScore(dir, session);
      result = { ok: true, text: `Analyst output (contains the answer keys — never show it to the player): ${written.join(", ")}`, images: [] };
    } else {
      // `look --all` (B10): the flag parser takes "--all" as a flag, so it is handed on as the command's argument.
      result = await playCommand(dir, cmd, cmd === "look" && flags.has("all") ? [...args, "--all"] : args, { withMap });
    }
  } catch (e) {
    if (!(e instanceof PlayError)) throw e;
    process.stdout.write(`Refused: ${e.message}\n`);
    return 1;
  }
  process.stdout.write(`${result.text}\n`);
  return result.ok ? 0 : 1;
}

process.exitCode = await main();
