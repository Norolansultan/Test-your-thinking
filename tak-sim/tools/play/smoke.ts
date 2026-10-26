/**
 * `npx tsx tools/play/smoke.ts [outDir]` — the play harness's smoke run (`tools/play/`): a scripted dumb policy plays a whole
 * session to its end in both audiences (expert in Finnish, public in English) — it waits, answers every item's first option (a
 * map item: the map's middle; the training incident's items likewise, its memory unit waited out, revision (bp)) with confidence 50, asks Haku one
 * question in each period (from V8 by the Haku chip, B1), records the same plan in every period and keeps it at the review, answers
 * the questionnaires' player items and the hinge's fatigue item (B2) — through the same commands the CLI runs (`runCommand`), in one
 * live session; then it writes the run
 * (`actions.json`) and replays it from disk (`replayRun`) to check that the replay reaches the same end (the same virtual time and
 * the same log). Prints each audience's command count, virtual length, runtime, and how many views showed the consult notice and
 * how many chip questions were asked. No PNGs (the CLI draws those). Revision (bp), 26 Oct 2026: it plays the training incident through
 * (its cards, items, feedback and S5) and checks that its pages print in the session language; the training needs work package B's
 * orchestrator (`training-host.ts`), so before the merge the smoke stops with that refusal.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { questionPhase } from "../../app/render/ui/explain/primer-flow.js";
import { isMapItem } from "../../app/session/freeze-answers.js";
import { SOURCE_SECTION } from "../../app/session/questionnaire.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { playerQuestItems, scalePoints } from "./screen-pages.js";
import { lookText } from "./screen.js";
import { PlaySession, type ActionRecord, type PlayConfig } from "./session.js";
import { runCommand } from "./commands.js";
import { replayRun, RUN_FORMAT, type RunFile } from "./run.js";
import { FREEZE_MAP_MARGIN_PX, freezeFrame } from "./freeze-grid.js";
import { LIVE_MAP_PX } from "./map-data.js";
import { inTraining, trainingHostOf, trainingItemOf, trainingLockBox, trainingViewOf, TRAINING_GRID_MARGIN_PX } from "./training-host.js";

/** The dumb policy's next command for the screen on show. */
export function dumbPolicy(session: PlaySession, asked: Set<number>): [string, ...string[]] {
  const s: SessionSnapshot = session.snap();
  if (s.tour !== null) return ["continue"];
  if (inTraining(s)) return trainingPolicy(session);
  switch (s.step) {
    case "primer": {
      const phase = questionPhase(session.primer!);
      if (phase === "explain") return ["primer-retry"];
      if (phase === "answered") return ["primer-next"];
      const attempts = session.primer!.progress[session.primer!.page]!.attempts;
      return ["primer-answer", String(Math.min(attempts + 1, PRIMER_CONTENT[session.config.lang].pages[session.primer!.page]!.question.options.length))];
    }
    case "briefing": case "training": case "debrief": case "profile": return ["continue"];
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
 * Revision (bp), 26 Oct 2026: the training incident played as the dumb policy plays everything — each card and feedback left, the memory
 * unit waited out, each item's first option or the middle of its map (the live map's grid, or the blank map's), confidence 50 where
 * asked, one Search question on the first S3 card, and S5 left.
 */
function trainingPolicy(session: PlaySession): [string, ...string[]] {
  const view = trainingViewOf(session.snap())!;
  if (view.phase === "study") return ["wait", String(Math.max(1, trainingHostOf(session.o).trainingStudySecondsLeft()))];
  if (view.phase !== "question") return view.phase === "ended" ? ["wait", "1"] : ["continue"];
  // One Search question on the first S3 card (the training's own records answer it), as the smoke asks Haku once a period.
  if (view.tools.haku && session.trainingUi.haku.length === 0) return ["haku", session.config.lang === "fi" ? "Mitä DR8 ilmoitti klo 10.05?" : "What did DR8 report at 10.05?"];
  const spec = session.trainingContent.spec;
  const item = trainingItemOf(view, spec);
  const conf = item && item.mode !== "live" ? ["50"] : [];
  if (item?.answer !== "point") return ["training-answer", "a", ...conf];
  if (item.mode === "freeze") {
    const f = freezeFrame(trainingLockBox(spec));
    return ["training-answer", `${Math.round(FREEZE_MAP_MARGIN_PX + f.widthPx / 2)},${Math.round(FREEZE_MAP_MARGIN_PX + f.heightPx / 2)}`, ...conf];
  }
  return ["training-answer", `${TRAINING_GRID_MARGIN_PX + LIVE_MAP_PX.width / 2},${TRAINING_GRID_MARGIN_PX + LIVE_MAP_PX.height / 2}`, ...conf];
}

/**
 * The training screens print in the session language: the practice tour's records step (revision (bl), (bp): listed with its title and
 * text) and the training incident's pages (revision (bp): the intro's title and the feedback's lines, `TRAINING_TEXT`). A read of the
 * screen, as `look` makes it: nothing is recorded and no session state changes (only which log rows `look` has shown).
 */
function checkTrainingScreen(session: PlaySession, dir: string): "tour" | "training" | null {
  const s = session.snap(), lang = session.config.lang;
  if (s.tour === "practice") {
    const step = UI_TEXT[lang].tour.steps.hakuRecords;
    if (!lookText(session, dir, 0, false).text.includes(`${step.title}\n${step.body}`)) throw new Error(`smoke: the practice tour does not list the records step in ${lang}`);
    return "tour";
  }
  const view = trainingViewOf(s);
  if (view?.phase === "intro" || view?.phase === "feedback") {
    const text = lookText(session, dir, 0, false).text;
    const texts = session.trainingContent.texts[lang];
    const want = view.phase === "intro" ? texts.intro.title : texts.item(view.itemId!).stem;
    if (!text.includes(want)) throw new Error(`smoke: the training's ${view.phase} does not print in ${lang}`);
    return "training";
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
  if (screensChecked.size !== 2) throw new Error(`smoke: the tour and the training incident were not both checked (${[...screensChecked].join(", ")})`);
  if (!records.some((r) => r.kind === "training_completed")) throw new Error("smoke: the training incident was not played through");
  return `${config.audience}/${config.lang}:${actions.length} commands, ${records.length} log records, virtual ${Math.round(session.clock.now() / 1000)} s, session_completed ${records.some((r) => r.kind === "session_completed")}; played in ${ms(t0, t1)} ms, replayed from disk in ${ms(t1, t2)} ms; consult notice in ${consult.length} views (${consult.join(" ")}), ${chips} chip questions; printed in ${config.lang}: the tour's records step and the training incident's pages`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = resolve(process.argv[2] ?? join("tools", "play", ".smoke"));
  rmSync(out, { recursive: true, force: true });
  for (const config of [{ audience: "expert", lang: "fi", waitStopsOnMessages: true, questionnairesPlayed: true }, { audience: "public", lang: "en", waitStopsOnMessages: true, questionnairesPlayed: true }] as const) {
    process.stdout.write(`${await smoke(config, join(out, `${config.audience}-${config.lang}`))}\n`);
  }
}
