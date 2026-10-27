/**
 * The training incident's screen (SPEC/15 (bp), SPEC/08 (bp); step `training_incident`, `snapshot.training`): a small fire at
 * Kaitajärvi in the basemap's north-east corner, played with the session's real components. It replaces the map training's extract
 * page and the practice feedback screen.
 *
 * - The intro, then each section's card (full pages), then its items: S1–S3 on the live stage (`TrainingStage`: the locked live map,
 *   the TAK toolbar with the item's tools, the item under the map); S4 on the session's freeze screen (`FreezeScreen`, one item at a
 *   time, its progress in the whole training, its blank map locked to the area), the memory item first shown for 8 s on the live map;
 *   S4's feedback under the map for a map item, else a full page; S5 the cell's recording (`TrainingDemoPage`).
 * - The countdown is the training's cap (12 min, to S4's end), polled from the session as every countdown is; S5 has none. S4's
 *   freeze screen says that this time keeps running (`ui.freezeNote`, in place of the session's "the clock has stopped"; review 27 Oct
 *   2026, finding 5), and S5 says when the cap ended the items (`ui.capEnded`, finding 4).
 * - The Thinker pane is never shown. Nothing on this screen logs; the session writes `training_*` records only.
 */

import { useEffect, useMemo, useState } from "preact/hooks";
import type { SessionOrchestrator, SessionSnapshot } from "../../../session/orchestrator.js";
import { TRAINING } from "../../../session/training/spec-data.js";
import { FreezeScreen } from "./FreezeScreen.js";
import { TrainingStage } from "./TrainingStage.js";
import { mmss, TrainingDemoPage, TrainingFeedbackPanel, TrainingIntro, TrainingSectionCard, trainingUi } from "./TrainingPanels.js";
import { trainingMapLock } from "../training-lock.js";
import { TRAINING_TEXT } from "../../../i18n/training-texts.js";
import { useLang } from "../i18n.js";

const AMBER = "#f4a261";

export function TrainingScreen({ snapshot, orchestrator }: { readonly snapshot: SessionSnapshot; readonly orchestrator: SessionOrchestrator }) {
  const { lang } = useLang();
  const view = snapshot.training;
  const lock = useMemo(() => trainingMapLock(TRAINING, lang), [lang]);
  const [left, setLeft] = useState({ cap: orchestrator.trainingSecondsLeft(), study: orchestrator.trainingStudySecondsLeft(), demo: orchestrator.trainingDemoSecondsLeft() });
  useEffect(() => {
    const id = setInterval(() => setLeft({ cap: orchestrator.trainingSecondsLeft(), study: orchestrator.trainingStudySecondsLeft(), demo: orchestrator.trainingDemoSecondsLeft() }), 250);
    return () => clearInterval(id);
  }, [orchestrator]);
  if (!view) return null; // ended: the intro video and VP follow

  const item = view.itemId !== null ? TRAINING.items.find((it) => it.id === view.itemId) ?? null : null;
  const capShown = view.phase !== "demo" && view.phase !== "ended";

  const content = (() => {
    switch (view.phase) {
      case "intro": return <TrainingIntro onStart={() => orchestrator.trainingStart()} />;
      case "section": return view.sectionId ? <TrainingSectionCard key={view.sectionId} sectionId={view.sectionId} onGo={() => orchestrator.trainingLeaveSection()} /> : null;
      case "demo": return <TrainingDemoPage cell={orchestrator.logHeader.cell} secondsLeft={left.demo} capEnded={view.endReason === "timeout"} onLeave={() => orchestrator.leaveTrainingDemo()} />;
      case "ended": return null;
      default: break;
    }
    if (!item) return null;
    if (view.phase === "question" && item.mode === "freeze" && snapshot.freeze) {
      return (
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <FreezeScreen key={item.id} freeze={snapshot.freeze} orchestrator={orchestrator} showLevels={false} progress={{ position: view.position, count: view.itemCount }} lock={lock} note={trainingUi(lang, "freezeNote")} />
        </div>
      );
    }
    if (!view.tools.map) {
      return <TrainingFeedbackPanel view={view} item={item} last={view.position === view.itemCount} page onLeave={() => orchestrator.leaveTrainingFeedback(item.id)} />;
    }
    return <TrainingStage snapshot={snapshot} orchestrator={orchestrator} view={view} item={item} lock={lock} studySecondsLeft={left.study} />;
  })();

  return (
    <div data-testid="training" data-phase={view.phase} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "8px 16px", borderBottom: "1px solid #33383e", background: "#15181c", flexShrink: 0 }}>
        <strong style={{ fontSize: 14 }}>{TRAINING_TEXT[lang].intro.title}</strong>
        {view.position > 0 && view.phase !== "section" && view.phase !== "demo" && (
          <span data-testid="training-progress" style={{ fontSize: 13, opacity: 0.75 }}>{trainingUi(lang, "progress", { n: view.position, of: view.itemCount })}</span>
        )}
        {capShown && (
          <span data-testid="training-time-left" role="timer" aria-live="off" style={{ marginLeft: "auto", fontSize: 14, fontVariantNumeric: "tabular-nums", color: left.cap <= 60 ? AMBER : "#e8eaed" }}>
            {trainingUi(lang, "timeLeft", { t: mmss(left.cap) })}
          </span>
        )}
      </header>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>{content}</div>
    </div>
  );
}
