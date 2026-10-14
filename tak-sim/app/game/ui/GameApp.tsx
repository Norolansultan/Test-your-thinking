/**
 * Game mode (SPEC/29): the screen's entry, lazily imported by the demonstration start page (`render/ui/App.tsx`, never
 * under `?tuotanto`). Scenario select → briefing → the game → debrief, full-screen, in the start page's language.
 * Nothing here touches the study's session log, telemetry, IndexedDB store or upload (SPEC/29 §2).
 */

import { useEffect, useState } from "preact/hooks";
import type { GameScenario } from "../contracts.js";
import type { Lang } from "../../i18n/lang.js";
import { Briefing } from "./Briefing.js";
import { Debrief, type GameResult } from "./Debrief.js";
import { gameScenarios, gameWorld } from "./game-source.js";
import { GameScreen } from "./GameScreen.js";
import { ScenarioSelect } from "./ScenarioSelect.js";
import { injectGameCss } from "./styles.js";
import { GAME_TEXT } from "./text.js";

type Screen =
  | { readonly kind: "select" }
  | { readonly kind: "briefing"; readonly scenario: GameScenario }
  | { readonly kind: "play"; readonly scenario: GameScenario; readonly seed: number; readonly run: number }
  | { readonly kind: "debrief"; readonly scenario: GameScenario; readonly result: GameResult };

/** Seeds: the first game of a scenario uses 1, each replay the next (deterministic, no clock). */
let runCounter = 0;

export function GameApp({ lang, onExit }: { readonly lang: Lang; readonly onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "select" });
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
  return (
    <div class="gm-root" lang={lang} data-testid="game-root">
      {screen.kind === "select" && (
        <ScenarioSelect lang={lang} scenarios={gameScenarios()} onChoose={(scenario) => setScreen({ kind: "briefing", scenario })} onBack={onExit} />
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
    </div>
  );
}

export default GameApp;
