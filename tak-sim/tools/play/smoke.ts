/**
 * `npx tsx tools/play/smoke.ts [outDir]` — the play harness's smoke run (`tools/play/`): a scripted dumb policy plays a whole
 * session to its end in both audiences (expert in Finnish, public in English) — it waits, answers every item's first option (a
 * map item: the map's middle; the map training's tasks likewise, its memory task's unit waited out) with confidence 50, asks Haku one
 * question in each period (from V8 by the Haku chip, B1), records the same plan in every period and keeps it at the review, answers
 * the questionnaires' player items and the hinge's fatigue item (B2) — through the same commands the CLI runs (`runCommand`), in one
 * live session; then it writes the run
 * (`actions.json`) and replays it from disk (`replayRun`) to check that the replay reaches the same end (the same virtual time and
 * the same log). Prints each audience's command count, virtual length, runtime, and how many views showed the consult notice and
 * how many chip questions were asked. No PNGs (the CLI draws those).
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { questionPhase } from "../../app/render/ui/explain/primer-flow.js";
import { isMapItem } from "../../app/session/freeze-answers.js";
import { MAP_TRAINING } from "../../app/session/map-training.js";
import { isPointTask } from "../../app/session/map-training-spec.js";
import { SOURCE_SECTION } from "../../app/session/questionnaire.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { searchLessonLines } from "../../app/session/practice-feedback.js";
import { playerQuestItems, scalePoints } from "./screen-pages.js";
import { lookText } from "./screen.js";
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
    case "map_pretest": { // the map training: the unit waited out, each task's first option or the extract's centre, its feedback left
      const v = s.mapPretest!;
      if (v.phase === "study") return ["wait", String(Math.max(1, session.o.mapPretestStudySecondsLeft()))];
      if (v.phase === "feedback") return ["continue"];
      const task = MAP_TRAINING.tasks.find((t) => t.id === v.taskId)!;
      return isPointTask(task) ? ["pretest-answer", `${MAP_TRAINING.crop.size / 2},${MAP_TRAINING.crop.size / 2}`] : ["pretest-answer", "a"];
    }
    case "briefing": case "training": case "practice_feedback": case "debrief": case "profile": return ["continue"];
    case "hinge_pause": return s.hingeCheck?.phase === "item" ? ["hinge-answer", "a"] : s.hingeFatigue?.value === null ? ["hinge-fatigue", "4"] : ["continue"];
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
    case "questionnaire": { // B2: every item the player answers; a source item "records", another choice its first option, a scale or a number its middle
      const item = playerQuestItems(s.questionnaire!).find((i) => !session.quest.has(i.id));
      if (!item) return ["quest-submit"];
      const value = item.kind === "choice" ? (item.section === SOURCE_SECTION ? "records" : item.options[0]!)
        : item.kind === "scale" ? String(scalePoints(item)[Math.floor(scalePoints(item).length / 2)]) : item.kind === "number" ? String(Math.round((item.min + item.max) / 2)) : "";
      return ["quest-answer", item.id, value];
    }
    default: break;
  }
  if (s.spam?.phase === "ready") return ["spam-ready"];
  if (s.spam?.phase === "item") return ["spam-answer", "a", "50"];
  if (s.spam?.phase === "confidence") return ["spam-answer", "50"];
  if (s.consultPrompt) return ["consult", "dismiss"];
  if (s.step === "allocation" && !s.decisionHeld) {
    if (!asked.has(s.currentCycle)) { asked.add(s.currentCycle); return s.hakuChip ? ["chip"] : ["haku", "Mikä on tilanne?"]; } // B1: the chip from V8
    const drones = s.allocation.droneTeams.length > 0 ? ["drones=carry_on"] : [];
    const d = session.planDraft();
    if (d.mainEffort === null) return ["plan", "main=L2", "posture=direct_attack", "secondary=none", ...drones];
    return ["confirm"];
  }
  return ["wait", "10"];
}

/**
 * Revision (bl), 25 Oct 2026: the two training screens print the additions in the session language — the practice tour's records step
 * (listed with its title and text) and the practice feedback's search lesson with the participant's own answer (the policy answered the
 * item). A read of the screen, as `look` makes it: nothing is recorded and no session state changes (only which log rows `look` has shown).
 */
function checkTrainingScreen(session: PlaySession, dir: string): "tour" | "feedback" | null {
  const s = session.snap(), lang = session.config.lang;
  if (s.tour === "practice") {
    const step = UI_TEXT[lang].tour.steps.hakuRecords;
    if (!lookText(session, dir, 0, false).text.includes(`${step.title}\n${step.body}`)) throw new Error(`smoke: the practice tour does not list the records step in ${lang}`);
    return "tour";
  }
  if (s.step === "practice_feedback") {
    const lesson = s.practiceFeedback?.items.find((i) => i.lesson !== null)?.lesson;
    const lines = lesson ? searchLessonLines(lang, lesson) : null;
    const text = lookText(session, dir, 0, false).text;
    if (!lines || lines.yours === null || !text.includes(lines.lesson) || !text.includes(lines.yours)) throw new Error(`smoke: the practice feedback does not print the search lesson and the answer in ${lang}`);
    return "feedback";
  }
  return null;
}

async function smoke(config: PlayConfig, dir: string): Promise<string> {
  const t0 = process.hrtime.bigint(); // the tool's own runtime, printed only; never read by the session
  const session = await PlaySession.create(config);
  const actions: ActionRecord[] = [];
  const asked = new Set<number>();
  const screensChecked = new Set<string>();
  try {
    for (let guard = 0; session.snap().step !== "complete"; guard++) {
      if (guard > 2000) throw new Error(`smoke: no end (at ${session.snap().step})`);
      const checked = checkTrainingScreen(session, dir);
      if (checked) screensChecked.add(checked);
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
  const consult = records.filter((r) => r.kind === "consult_prompt_shown").map((r) => `V${(r.detail as { cycle: number }).cycle}`);
  const chips = records.filter((r) => r.kind === "ai_chat_query_submitted" && (r.detail as { viaChip?: boolean }).viaChip === true).length;
  if (screensChecked.size !== 2) throw new Error(`smoke: the tour and the practice feedback were not both checked (${[...screensChecked].join(", ")})`);
  return `${config.audience}/${config.lang}:${actions.length} commands, ${records.length} log records, virtual ${Math.round(session.clock.now() / 1000)} s, session_completed ${records.some((r) => r.kind === "session_completed")}; played in ${ms(t0, t1)} ms, replayed from disk in ${ms(t1, t2)} ms; consult notice in ${consult.length} views (${consult.join(" ")}), ${chips} chip questions; printed in ${config.lang}: the tour's records step, the feedback's search lesson and answer`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = resolve(process.argv[2] ?? join("tools", "play", ".smoke"));
  rmSync(out, { recursive: true, force: true });
  for (const config of [{ audience: "expert", lang: "fi", waitStopsOnMessages: true, questionnairesPlayed: true }, { audience: "public", lang: "en", waitStopsOnMessages: true, questionnairesPlayed: true }] as const) {
    process.stdout.write(`${await smoke(config, join(out, `${config.audience}-${config.lang}`))}\n`);
  }
}
