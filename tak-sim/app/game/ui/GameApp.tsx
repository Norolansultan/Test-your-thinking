/**
 * Game mode (SPEC/29, SPEC/34): the screen's entry, lazily imported by the demonstration start page
 * (`render/ui/App.tsx`, never under `?tuotanto`). The start page has three tracks (SPEC/34 §2):
 *   - the training course: course → module → its exercise on the task screen → back to the module's checks;
 *   - the decision tasks: the task screen (`tasks/TaskScreen.tsx`);
 *   - free play, as before: scenario select → briefing → the game → debrief.
 * Full-screen, in the start page's language. Progress (modules passed, tasks done and their best grade) is kept by
 * `course/progress.ts`. Nothing here touches the study's session log, telemetry, IndexedDB store or upload (SPEC/29 §2).
 */

import { useEffect, useState } from "preact/hooks";
import type { GameScenario } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { loadProgress, saveProgress, withModulePassed, withTaskResult, type GameProgress } from "../course/progress.js";
import type { CourseModule, DecisionTask, TaskResult } from "../tasks/contracts.js";
import { DECISION_TASKS } from "../tasks/index.js";
import { TaskScreen } from "../tasks/TaskScreen.js";
import { Briefing } from "./Briefing.js";
import { CourseScreen } from "./course/CourseScreen.js";
import type { ModuleStep } from "./course/ModuleScreen.js";
import { Debrief, type GameResult } from "./Debrief.js";
import { gameScenarios, gameWorld } from "./game-source.js";
import { GameScreen } from "./GameScreen.js";
import { GAME_CHUNK_MARKER } from "./marker.js";
import { ScenarioSelect } from "./ScenarioSelect.js";
import { injectGameCss } from "./styles.js";
import { GAME_TEXT } from "./text.js";

type Screen =
  | { readonly kind: "select" }
  | { readonly kind: "briefing"; readonly scenario: GameScenario }
  | { readonly kind: "play"; readonly scenario: GameScenario; readonly seed: number; readonly run: number }
  | { readonly kind: "debrief"; readonly scenario: GameScenario; readonly result: GameResult }
  | { readonly kind: "course"; readonly open: { readonly module: CourseModule; readonly startAt: ModuleStep; readonly run: number } | null }
  | { readonly kind: "exercise"; readonly module: CourseModule; readonly task: DecisionTask; readonly run: number }
  | { readonly kind: "task"; readonly task: DecisionTask; readonly run: number };

/** Seeds: the first game of a scenario uses 1, each replay the next (deterministic, no clock). */
let runCounter = 0;
/** The open exercise has shown its result: "Back" then goes on to the module's check questions. */
let exerciseDone = false;

export function GameApp({ lang, onExit }: { readonly lang: Lang; readonly onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "select" });
  const [progress, setProgress] = useState<GameProgress>(() => loadProgress());
  const t = GAME_TEXT[lang];
  useEffect(() => { injectGameCss(); }, []);
  useEffect(() => {
    const prev = document.title;
    document.title = t.modeTitle;
    return () => { document.title = prev; };
  }, [t]);
  const play = (scenario: GameScenario) => {
    runCounter++;
    setScreen({ kind: "play", scenario, seed: runCounter, run: runCounter });
  };
  const update = (next: GameProgress) => {
    setProgress(next);
    saveProgress(next);
  };
  const openModule = (module: CourseModule | null, startAt: ModuleStep = { kind: "page", index: 0 }) => {
    runCounter++;
    setScreen({ kind: "course", open: module ? { module, startAt, run: runCounter } : null });
  };
  const recordTask = (result: TaskResult) => update(withTaskResult(progress, result.taskId, result.grade, result.allMet));
  return (
    // The marker keeps the recruitment gate able to find this chunk in a build (marker.ts).
    <div class="gm-root" lang={lang} data-testid="game-root" data-build={GAME_CHUNK_MARKER}>
      {screen.kind === "select" && (
        <ScenarioSelect lang={lang} scenarios={gameScenarios()} tasks={DECISION_TASKS} progress={progress}
          onChoose={(scenario) => setScreen({ kind: "briefing", scenario })}
          onCourse={() => openModule(null)}
          onTask={(task) => { runCounter++; setScreen({ kind: "task", task, run: runCounter }); }}
          onBack={onExit} />
      )}
      {screen.kind === "briefing" && (
        <Briefing lang={lang} scenario={screen.scenario} world={gameWorld()} onStart={() => play(screen.scenario)} onBack={() => setScreen({ kind: "select" })} />
      )}
      {screen.kind === "play" && (
        <GameScreen key={screen.run} lang={lang} scenario={screen.scenario} seed={screen.seed}
          onFinish={(result) => setScreen({ kind: "debrief", scenario: screen.scenario, result })} />
      )}
      {screen.kind === "debrief" && (
        <Debrief lang={lang} scenario={screen.scenario} result={screen.result} world={gameWorld()}
          onPlayAgain={() => play(screen.scenario)} onBack={() => setScreen({ kind: "select" })} />
      )}
      {screen.kind === "course" && (
        <CourseScreen lang={lang} world={gameWorld()} progress={progress} open={screen.open}
          onOpen={(m) => openModule(m)}
          onExercise={(module, task) => { runCounter++; exerciseDone = false; setScreen({ kind: "exercise", module, task, run: runCounter }); }}
          onModulePassed={(m) => update(withModulePassed(progress, m.id))}
          onBack={() => setScreen({ kind: "select" })} />
      )}
      {screen.kind === "exercise" && (
        <TaskScreen key={screen.run} lang={lang} task={screen.task}
          onDone={(result) => { exerciseDone = true; recordTask(result); }}
          onBack={() => openModule(screen.module, { kind: exerciseDone ? "checks" : "exercise" })} />
      )}
      {screen.kind === "task" && (
        <TaskScreen key={screen.run} lang={lang} task={screen.task}
          onDone={recordTask}
          onBack={() => setScreen({ kind: "select" })} />
      )}
    </div>
  );
}

export default GameApp;
