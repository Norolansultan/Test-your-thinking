/**
 * `npx tsx tools/play/smoke.ts [outDir]` — the play harness's smoke run (`tools/play/`): a scripted dumb policy plays a whole
 * session to its end in both audiences (expert in Finnish, public in English) — it waits, answers every item's first option (a
 * map item: the map's middle) with confidence 50, asks Haku one question in each period, records the same plan in every period
 * and keeps it at the review — through the same commands the CLI runs (`runCommand`), in one live session; then it writes the run
 * (`actions.json`) and replays it from disk (`replayRun`) to check that the replay reaches the same end (the same virtual time and
 * the same log). Prints each audience's command count, virtual length and runtime. No PNGs (the CLI draws those).
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { questionPhase } from "../../app/render/ui/explain/primer-flow.js";
import { isMapItem } from "../../app/session/freeze-answers.js";
import { SOURCE_SECTION } from "../../app/session/questionnaire.js";
import { PlaySession, type ActionRecord, type PlayConfig } from "./session.js";
import { runCommand } from "./commands.js";
import { replayRun, RUN_FORMAT, type RunFile } from "./run.js";
import { FREEZE_MAP_MARGIN_PX, freezeFrame } from "./freeze-grid.js";

/** The dumb policy's next command for the screen on show. */
export function dumbPolicy(session: PlaySession, asked: Set<number>): [string, ...string[]] {
  const s: SessionSnapshot = session.snap();
  if (s.tour !== null) return ["continue"];
  switch (s.step) {
    case "primer": {
      const phase = questionPhase(session.primer!);
      if (phase === "explain") return ["primer-retry"];
      if (phase === "answered") return ["primer-next"];
      const attempts = session.primer!.progress[session.primer!.page]!.attempts;
      return ["primer-answer", String(Math.min(attempts + 1, PRIMER_CONTENT[session.config.lang].pages[session.primer!.page]!.question.options.length))];
    }
    case "map_pretest": return ["pretest-answer", s.mapPretest!.itemId, s.mapPretest!.options[0]!.id];
    case "briefing": case "training": case "practice_feedback": case "debrief": case "profile": return ["continue"];
    case "hinge_pause": return s.hingeCheck?.phase === "item" ? ["hinge-answer", "a"] : ["continue"];
    case "freeze": {
      const items = s.freeze!.items;
      const state = session.freezeState();
      const item = items[state.index]!;
      if (state.drafts.has(item.id) && state.index === items.length - 1) return ["freeze-submit"];
      if (!isMapItem(item)) return ["freeze-answer", "a", "50"];
      const f = freezeFrame(session.scenario.extent);
      return ["freeze-answer", `${Math.round(FREEZE_MAP_MARGIN_PX + f.widthPx / 2)},${Math.round(FREEZE_MAP_MARGIN_PX + f.heightPx / 2)}`, "50"];
    }
    case "probe": {
      const p = s.visibleProbe!;
      return p.kind === "area" ? ["probe-answer", "no"] : p.kind === "choice" ? ["probe-answer", "a", ...(p.collectsConfidence ? ["50"] : [])] : ["probe-answer", "50"];
    }
    case "plan_confidence": return s.planConfidence ? ["plan-confidence", "50"] : ["wait", "1"];
    case "plan_review": return s.planReview ? ["review", "keep"] : ["wait", "1"];
    case "questionnaire": {
      const item = s.questionnaire!.items.find((i) => i.section === SOURCE_SECTION && !session.quest.has(i.id));
      return item ? ["quest-answer", item.id, "records"] : ["quest-submit"];
    }
    default: break;
  }
  if (s.spam?.phase === "ready") return ["spam-ready"];
  if (s.spam?.phase === "item") return ["spam-answer", "a", "50"];
  if (s.spam?.phase === "confidence") return ["spam-answer", "50"];
  if (s.consultPrompt) return ["consult", "dismiss"];
  if (s.step === "allocation" && !s.decisionHeld) {
    if (!asked.has(s.currentCycle)) { asked.add(s.currentCycle); return ["haku", "Mikä on tilanne?"]; }
    const drones = s.allocation.droneTeams.length > 0 ? ["drones=carry_on"] : [];
    const d = session.planDraft();
    if (d.mainEffort === null) return ["plan", "main=L2", "posture=direct_attack", "secondary=none", ...drones];
    return ["confirm"];
  }
  return ["wait", "10"];
}

async function smoke(config: PlayConfig, dir: string): Promise<string> {
  const t0 = process.hrtime.bigint(); // the tool's own runtime, printed only; never read by the session
  const session = await PlaySession.create(config);
  const actions: ActionRecord[] = [];
  const asked = new Set<number>();
  try {
    for (let guard = 0; session.snap().step !== "complete"; guard++) {
      if (guard > 2000) throw new Error(`smoke: no end (at ${session.snap().step})`);
      const [cmd, ...args] = dumbPolicy(session, asked);
      const atMs = session.clock.now();
      session.begin(null);
      await runCommand(session, cmd, args, { runDir: dir, withMap: false });
      actions.push({ cmd, args, atMs, costsMs: session.spent() });
    }
  } finally { session.dispose(); }
  const records = await session.o.logRecords();
  const t1 = process.hrtime.bigint();
  const run: RunFile = { format: RUN_FORMAT, version: 1, config, actions };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "actions.json"), `${JSON.stringify(run, null, 1)}\n`);
  const replayed = await replayRun(dir, run);
  replayed.dispose();
  const again = await replayed.o.logRecords();
  const t2 = process.hrtime.bigint();
  if (again.length !== records.length || replayed.clock.now() !== session.clock.now()) throw new Error(`smoke: the replay diverged (${again.length} vs ${records.length} records)`);
  const ms = (a: bigint, b: bigint) => Math.round(Number(b - a) / 1e6);
  return `${config.audience}/${config.lang}: ${actions.length} commands, ${records.length} log records, virtual ${Math.round(session.clock.now() / 1000)} s, session_completed ${records.some((r) => r.kind === "session_completed")}; played in ${ms(t0, t1)} ms, replayed from disk in ${ms(t1, t2)} ms`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = resolve(process.argv[2] ?? join("tools", "play", ".smoke"));
  rmSync(out, { recursive: true, force: true });
  for (const config of [{ audience: "expert", lang: "fi", waitStopsOnMessages: true }, { audience: "public", lang: "en", waitStopsOnMessages: true }] as const) {
    process.stdout.write(`${await smoke(config, join(out, `${config.audience}-${config.lang}`))}\n`);
  }
}
