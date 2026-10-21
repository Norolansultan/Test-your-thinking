/**
 * Game mode, SPEC/34 §4: the decision-task screen. The task's game opens paused at the planning moment (`runner.ts`
 * `startTask`): the map, the task and its criteria in the card, orders as in free play, the speed controls disabled.
 * "Commit plan" starts the run: the screen advances the same game itself at `RUN_SPEED` game seconds per real second
 * through `advanceRun` (so the trace is the runner's), orders locked unless the task allows later ones, with a skip to
 * the horizon. The result judges the run, calls `onDone`, and works out the expert reference on the same seed beside
 * it, with a switch to show either outcome on the map. "Try again" replays the same seed from the planning moment.
 * The free-play `GameScreen` is reused through its optional task props. No clock is read: frame time only.
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { SIM_STEP_S } from "../contracts.js";
import { GameScreen } from "../ui/GameScreen.js";
import type { TaskResult, TaskScreenProps } from "./contracts.js";
import { taskEnv } from "./env.js";
import { advanceRun, beginRun, judgeRun, runOver, runReference, startTask, type TaskOutcome, type TaskRun } from "./runner.js";
import { PlanCard, ResultCard, RunCard } from "./TaskCard.js";

/** Game seconds per real second while the plan runs (45 minutes in about 20 seconds). */
export const RUN_SPEED = 135;
/** The card is redrawn at most this often while the map plays, real seconds. */
const CARD_EVERY_S = 0.4;

type Phase = "plan" | "run" | "result";

export function TaskScreen({ lang, task, onDone, onBack }: TaskScreenProps) {
  const env = useMemo(taskEnv, []);
  const [attempt, setAttempt] = useState(0);
  const tg = useMemo(() => startTask(task, env), [task, env, attempt]);
  const [phase, setPhase] = useState<Phase>("plan");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [reference, setReference] = useState<TaskOutcome | null>(null);
  const [showExpert, setShowExpert] = useState(false);
  const [, setCardVersion] = useState(0);
  const runRef = useRef<TaskRun | null>(null);
  const accRef = useRef(0);
  const cardRef = useRef(0);
  const doneRef = useRef(false);

  const finish = (run: TaskRun) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const judged = judgeRun(run, env.world);
    setResult(judged.result);
    setPhase("result");
    onDone(judged.result);
  };

  // The expert's run on the same seed, worked out once the player's result is on screen.
  useEffect(() => {
    if (phase !== "result" || reference !== null) return;
    const id = setTimeout(() => setReference(runReference(task, env)), 30);
    return () => clearTimeout(id);
  }, [phase, reference, task, env]);

  const commit = () => {
    if (phase !== "plan") return;
    runRef.current = beginRun(tg);
    accRef.current = 0;
    setPhase("run");
  };

  const onFrame = (realDtS: number) => {
    cardRef.current += realDtS;
    if (cardRef.current >= CARD_EVERY_S) { cardRef.current = 0; setCardVersion((v) => v + 1); }
    const run = runRef.current;
    if (phase !== "run" || run === null || doneRef.current) return;
    accRef.current += realDtS * RUN_SPEED;
    const steps = Math.floor(accRef.current / SIM_STEP_S);
    if (steps > 0) {
      accRef.current -= steps * SIM_STEP_S;
      advanceRun(run, steps * SIM_STEP_S);
    }
    if (runOver(run)) finish(run);
  };

  const skip = () => {
    const run = runRef.current;
    if (run === null || doneRef.current) return;
    advanceRun(run, run.endS - run.game.state.tS);
    finish(run);
  };

  const tryAgain = () => {
    runRef.current = null;
    doneRef.current = false;
    setResult(null);
    setReference(null);
    setShowExpert(false);
    setPhase("plan");
    setAttempt((a) => a + 1);
  };

  const run = runRef.current;
  const shown = phase === "result" && showExpert && reference !== null ? reference.game : tg.game;
  const aside = phase === "plan"
    ? <PlanCard lang={lang} task={task} orders={tg.game.commands.length - tg.setupCount} onCommit={commit} onBack={onBack} />
    : phase === "run" && run !== null
      ? <RunCard lang={lang} task={task} state={tg.game.state} startS={run.startS} endS={run.endS} onSkip={skip} />
      : result !== null
        ? <ResultCard lang={lang} task={task} result={result} mine={tg.game.state} reference={reference} showExpert={showExpert}
          onToggleExpert={() => setShowExpert((s) => !s)} onTryAgain={tryAgain} onBack={onBack} />
        : null;

  return (
    <div data-testid="task-screen" data-phase={phase} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* The result opens a fresh map with the true fire on (the player's picture was the fogged one). */}
      <GameScreen key={`${attempt}-${phase === "result" ? "result" : "play"}`} lang={lang} scenario={task.scenario} seed={task.seed} game={shown}
        clockLocked ordersLocked={phase === "result" || (phase === "run" && task.allowLaterOrders !== true)}
        onFrame={onFrame} aside={aside ?? undefined} onQuit={onBack} onFinish={() => undefined}
        initialLayers={phase === "result" ? { truth: true } : {}} />
    </div>
  );
}
