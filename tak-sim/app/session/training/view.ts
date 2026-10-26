/**
 * What the session's snapshot carries while the step is `training_incident` (SPEC/15 (bp), SPEC/08 (bp) §bp.1): the training is
 * played with the session's real components, so the snapshot fields those components read are the training's —
 *
 * - `renderTree.cycleInfo` (the live map `MapView`): the item's scene (`TRAINING.scenes`), only while the live map is open; during the
 *   memory exposure the `s1` scene with the memory unit alone (drawn as the shell draws a friendly ground vehicle with its call sign);
 * - `radioLog` (the message log, GeoChat): the training's log rows (`trainingLogRows`) while the log is open — S2's to 10.12, S3's all
 *   five (to the training's "now"; SPEC/08 (bp) §bp.6);
 * - `aiChatHistory` (the Haku pane): the training's own Haku turns (`haku.ts`), never the session's;
 * - `spam` (the SPAM question card, S3): the item's stem and options in the session language, opened at once (no ready prompt);
 * - `freeze` (the freeze screen, S4): the one item on screen;
 * - the session's tools, chips, badges and notices off; no envelope, no Thinker.
 *
 * Built from the content types only (I4: no key reaches the screen before the item's feedback; the feedback's drawing reads the key
 * from `TRAINING` itself, `training-overlay.ts`). Pure.
 */

import type { RenderableCycle } from "../../boundary/render-boundary.js";
import type { Lang } from "../../i18n/lang.js";
import { TRAINING_TEXT } from "../../i18n/training-texts.js";
import { EMPTY_RENDER_TREE, type RenderTree } from "../../render/render-tree.js";
import { clockAt } from "../template-answer.js";
import type { AiChatTurn, FreezeView, RadioLogEntry, SpamView } from "../snapshot.js";
import { TRAINING_VIEW, trainingLogRows } from "./corpus.js";
import type { TrainingView } from "./host.js";
import type { TrainingItem, TrainingSpec } from "./spec.js";

/** The clock S2's message log runs to (SPEC/08 (bp) §bp.6: "S2's scene shows those to 10.12"); S3's runs to the training's "now". */
export const TRAINING_S2_LOG_UNTIL = "10.12";

export interface TrainingSnapshotParts {
  readonly renderTree: RenderTree;
  readonly currentEnvelope: null;
  readonly clockLabel: string;
  readonly radioLog: readonly RadioLogEntry[];
  readonly bubbleHistory: readonly [];
  readonly aiChatHistory: readonly AiChatTurn[];
  readonly openThinkerHistory: readonly [];
  readonly freeze: FreezeView | null;
  readonly spam: SpamView | null;
  readonly aiAvailable: false;
  readonly toolsLocked: false;
  readonly decisionHeld: false;
  readonly visibleProbe: null;
  readonly consultPrompt: null;
  readonly suggestedQuestion: false;
  readonly hakuChip: false;
  readonly recordsBadge: false;
  readonly waitingOnSession: boolean;
}

export interface TrainingNow {
  readonly view: TrainingView | null;
  readonly item: TrainingItem | null;
  /** A question card's option chosen, its confidence asked next. */
  readonly cardChoice: string | null;
  readonly hakuTurns: readonly AiChatTurn[];
  readonly hakuWaiting: boolean;
}

/** The map's scene now: the item's, with the memory unit alone during its exposure; null while the live map is closed. */
export function trainingSceneOf(spec: TrainingSpec, view: TrainingView | null, item: TrainingItem | null): RenderableCycle | null {
  if (!view || !item || !view.tools.map || view.scene === null) return null;
  const scene = spec.scenes[view.scene];
  if (!scene) return null;
  if (view.phase !== "study" || !item.memory) return scene;
  return { ...scene, unitPositions: { [item.memory.unit]: item.memory.at }, unitWork: {}, aircraft: [], sensorFootprints: [] };
}

/** The message log's rows now: S2's to 10.12, S3's to the training's "now"; none while the log is closed. */
export function trainingLogNow(spec: TrainingSpec, view: TrainingView | null): RadioLogEntry[] {
  if (!view?.tools.log) return [];
  return trainingLogRows(view.sectionId === "s2" ? TRAINING_S2_LOG_UNTIL : spec.now.label);
}

/** The freeze screen's header: the training's span to its "now" ("10.00–10.18"). */
export function trainingFreezeNowLabel(spec: TrainingSpec): string {
  return `${clockAt(TRAINING_VIEW.startsAtVirtual)}–${spec.now.label}`;
}

function optionsOf(item: TrainingItem, lang: Lang): { id: string; label: string }[] {
  const text = TRAINING_TEXT[lang].item(item.id);
  return item.options.map((o) => ({ id: o.id, label: text.options[o.id] ?? o.id }));
}

/** S4's item on the freeze screen (the screen's own shape, no key): one item at a time. */
export function trainingFreezeOf(view: TrainingView | null, item: TrainingItem | null, lang: Lang): FreezeView | null {
  if (!view || !item || view.phase !== "question" || item.mode !== "freeze") return null;
  return {
    items: [{
      id: item.id, level: "L1", promptFi: TRAINING_TEXT[lang].item(item.id).stem, kind: item.answer === "point" ? "map_point" : "choice",
      options: item.answer === "point" ? [] : optionsOf(item, lang).map((o) => ({ id: o.id, labelFi: o.label })),
    }],
  };
}

/** S3's question card as the SPAM card draws it, opened at once (no ready prompt): its question, then its confidence. */
export function trainingCardOf(view: TrainingView | null, item: TrainingItem | null, choice: string | null, lang: Lang): SpamView | null {
  if (!view || !item || view.phase !== "question" || item.mode !== "card") return null;
  return {
    phase: choice === null ? "item" : "confidence", probeId: item.id, promptFi: TRAINING_TEXT[lang].item(item.id).stem,
    options: optionsOf(item, lang).map((o) => ({ id: o.id, fi: o.label })), chosen: choice, forced: false, itemIndex: 1, itemCount: 1,
  };
}

/** The snapshot's fields while the step is `training_incident`. */
export function trainingSnapshotParts(spec: TrainingSpec, now: TrainingNow, lang: Lang): TrainingSnapshotParts {
  const scene = trainingSceneOf(spec, now.view, now.item);
  return {
    renderTree: { ...EMPTY_RENDER_TREE, cycleInfo: scene },
    currentEnvelope: null,
    clockLabel: scene?.clockLabel ?? spec.now.label,
    radioLog: trainingLogNow(spec, now.view),
    bubbleHistory: [],
    aiChatHistory: now.view?.tools.haku ? now.hakuTurns : [],
    openThinkerHistory: [],
    freeze: trainingFreezeOf(now.view, now.item, lang),
    spam: trainingCardOf(now.view, now.item, now.cardChoice, lang),
    aiAvailable: false, toolsLocked: false, decisionHeld: false, visibleProbe: null,
    consultPrompt: null, suggestedQuestion: false, hakuChip: false, recordsBadge: false,
    waitingOnSession: now.hakuWaiting || now.view?.phase === "study" || (now.view?.phase === "question" && now.item?.mode === "freeze"),
  };
}
