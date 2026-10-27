/**
 * The play harness's commands in the training incident (revision (bp), 26 Oct 2026; SPEC/15 (bp) §bp.2, SPEC/08 (bp)): each one what the
 * participant's click or typing does on the training's screen, through work package B's orchestrator methods (`TrainingHost`), with its
 * DRAFT cost (`costs.ts`). Refused on the wrong screen, as every command.
 *
 * - `continue`: the intro ("Aloita"), a section card, an item's feedback ("Seuraava" / "Valmis"), S5's recording (its button waits 10 s).
 * - `training-answer <letter> [confidence]` or `training-answer <x>,<y> [confidence]`: the item on screen, once, final. A point is read off
 *   the image's grid in the PNG's own pixels (the live map's, or the memory item's blank map: play-test B12); a question card and a
 *   freeze item take the confidence too (`answerTraining` takes both directly). The R&B readings taken on the item go with it (each
 *   noted as the stage notes it, `noteTrainingMeasure`).
 * - `haku "<question>"` on an S3 card: Search over the training's own records (the harness's no-model transport answers it, as the
 *   proxy's fallback); the answer is the training's own Haku turn (the snapshot's `aiChatHistory` while the step is on).
 * - `measure x1,y1 x2,y2` and `map 2.5km|1km|reset [center=x,y]` on the training's live map. The training's map use is not logged
 *   (SPEC/07 (bp)), so nothing here writes a map record. Each new item opens on the opening frame, as the app's map returns to it
 *   (play-test round 4, B26: T1's 1 km zoom carried into T2 and hid its mark A); the item's feedback keeps the item's camera.
 */

import type { TrainingAnswer, TrainingConfidence } from "../../app/session/training/host.js";
import { displayAnswerText } from "../../app/session/chat-display.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { formatBearing, formatRange, rangeBearing } from "../../app/render/ui/tak/RangeBearing.js";
import { COST_S } from "./costs.js";
import { PlayError, type PlaySession } from "./session.js";
import { freezePointAt } from "./freeze-grid.js";
import { metresBetween, moveTrainingCamera, trainingItemOf, trainingLockBox, trainingOpening, trainingPointAt, trainingViewOf, TRAINING_MOVES } from "./training-host.js";

const need = (ok: unknown, message: string): void => { if (!ok) throw new PlayError(message); };
const H = (s: string) => `» ${s}`;

/** The training's view, or a refusal: the training is not on screen. */
function viewOrRefuse(session: PlaySession) {
  const view = trainingViewOf(session.snap());
  need(view, "the training is not on screen");
  return view!;
}

/** The harness's UI state for the item on screen: a new item starts with no readings, on the opening frame (round 4, B26). */
function uiFor(session: PlaySession, itemId: string | null) {
  if (session.trainingUi.itemId !== itemId) session.trainingUi = { itemId, measures: [], rb: null, camera: null };
  return session.trainingUi;
}

/** `continue` on the training's screen. */
export async function trainingContinue(session: PlaySession): Promise<string> {
  const view = viewOrRefuse(session);
  const host = session.o;
  switch (view.phase) {
    case "intro": await session.spend(COST_S.trainingCard); await session.act(() => host.trainingStart()); return "Training started (`look`).";
    case "section": await session.spend(COST_S.trainingCard); await session.act(() => host.trainingLeaveSection()); return "Section card left (`look`).";
    case "feedback": {
      await session.spend(COST_S.trainingFeedback);
      const now = trainingViewOf(session.snap());
      if (now?.itemId !== view.itemId || now.phase !== "feedback") return "The screen changed meanwhile (`look`).";
      await session.act(() => host.leaveTrainingFeedback(view.itemId!));
      return view.position === view.itemCount ? "Feedback left: the last item." : "Next item (`look`).";
    }
    case "demo": await session.spend(Math.max(COST_S.trainingDemo, host.trainingDemoSecondsLeft())); await session.act(() => host.leaveTrainingDemo()); return "Recording left: the training is done.";
    case "study": throw new PlayError(`the unit is still on the map: \`wait ${Math.max(1, host.trainingStudySecondsLeft())}\`, then \`look\``);
    case "question": throw new PlayError("answer the item first (`training-answer …`)");
    default: throw new PlayError("nothing to continue here");
  }
}

/** `training-answer <letter|x,y> [confidence]`. */
export async function trainingAnswer(session: PlaySession, args: readonly string[], look: () => string): Promise<string> {
  const view = viewOrRefuse(session);
  if (view.phase === "feedback" && args.length === 0) return trainingContinue(session);
  need(view.phase === "question", view.phase === "study" ? "the unit is still on the map: `wait`, then `look`" : view.phase === "feedback" ? "the feedback is on screen: `continue`" : "no training item is on screen");
  const spec = session.trainingContent.spec;
  const item = trainingItemOf(view, spec);
  need(item, "the item on screen is not in the training's spec (its build)");
  const arg = args[0] === item!.id ? args[1] : args[0];
  const rest = args[0] === item!.id ? args.slice(2) : args.slice(1);
  let confidence: TrainingConfidence | undefined;
  if (item!.mode !== "live") {
    const v = Number(rest[0]);
    need((CONFIDENCE_SCALE as readonly number[]).includes(v), `training-answer <answer> <confidence ${CONFIDENCE_SCALE.join("|")}> (this item asks how sure you are)`);
    confidence = v as TrainingConfidence;
  }
  let answer: TrainingAnswer;
  if (item!.answer === "point") {
    const [x, y] = (arg ?? "").split(",").map(Number);
    const at = item!.mode === "freeze" ? freezePointAt(x!, y!, trainingLockBox(spec)) : trainingPointAt(x!, y!, uiFor(session, item!.id).camera ?? trainingOpening(spec), spec);
    need(!("error" in at), "error" in at ? at.error : "");
    answer = { point: (at as { point: { lat: number; lon: number } }).point, ...(confidence !== undefined ? { confidence } : {}) };
  } else {
    const i = /^[a-z]$/.test(arg ?? "") ? arg!.charCodeAt(0) - 97 : -1;
    need(i >= 0 && i < item!.options.length, `options: ${item!.options.map((_, k) => String.fromCharCode(97 + k)).join(", ")}`);
    answer = { choiceId: item!.options[i]!.id, ...(confidence !== undefined ? { confidence } : {}) };
  }
  await session.spend(COST_S.trainingAnswer);
  const now = trainingViewOf(session.snap());
  if (now?.itemId !== view.itemId || now.phase !== "question") return "The item closed before the answer (its time ran out): `look`.";
  uiFor(session, item!.id);
  await session.act(() => session.o.answerTraining(item!.id, answer));
  return look();
}

/** `haku "<question>"` on an S3 card: the training's Search. */
export async function trainingHaku(session: PlaySession, question: string): Promise<string> {
  const view = viewOrRefuse(session);
  need(question.length > 0, `haku "<question>"`);
  need(view.phase === "question" && view.tools.haku, "Search is open only on the training's S3 question cards");
  await session.spend(COST_S.hakuType);
  const now = trainingViewOf(session.snap());
  if (now?.itemId !== view.itemId || now.phase !== "question") return "The card closed before the question was sent: `look`.";
  const before = session.snap().aiChatHistory.length;
  const startMs = session.clock.now();
  await session.act(() => session.o.askTrainingHaku(question));
  await session.spend(Math.max(0, COST_S.hakuRead - (session.clock.now() - startMs) / 1000));
  const turns = session.snap().aiChatHistory;
  need(turns.length > before, "the training's Search gave no answer");
  const turn = turns.at(-1)!;
  const t = UI_TEXT[session.config.lang], d = (x: string) => displayAnswerText(x);
  return [H("Search answer — TEMPLATE FALLBACK (the proxy's no-model answer over lexical retrieval), over the training's records only."),
    `> ${turn.query}`, `${t.answer}: ${d(turn.answer.answerFi)}`, `${t.basis}: ${d(turn.answer.basisFi)}`, `${t.certainty}: ${d(turn.answer.certaintyFi)}`, `${t.wouldChange}: ${d(turn.answer.wouldChangeIfFi)}`].join("\n");
}

/** `measure x1,y1 x2,y2` on the training's live map (R&B; not logged). */
export async function trainingMeasure(session: PlaySession, args: readonly string[]): Promise<string> {
  const view = viewOrRefuse(session);
  need(view.phase === "question" && view.tools.rb, "the R&B tool is not open on this training screen");
  const spec = session.trainingContent.spec;
  const camera = uiFor(session, view.itemId).camera ?? trainingOpening(spec);
  const pts = args.slice(0, 2).map((a) => a.split(",").map(Number));
  need(pts.length === 2 && pts.every((p) => p.length === 2), "measure <x1>,<y1> <x2>,<y2> (pixels of the training map image, its grid's labels)");
  const at = pts.map((p) => trainingPointAt(p[0]!, p[1]!, camera, spec));
  for (const a of at) need(!("error" in a), "error" in a ? a.error : "");
  const [a, b] = at.map((x) => (x as { point: { lat: number; lon: number } }).point) as [{ lat: number; lon: number }, { lat: number; lon: number }];
  await session.spend(COST_S.measure);
  const ui = uiFor(session, view.itemId);
  const metres = Math.round(metresBetween(a, b));
  session.o.noteTrainingMeasure(metres); // as the stage notes an R&B reading for the item's answer
  session.trainingUi = { ...ui, measures: [...ui.measures, metres], rb: { from: a, to: b } };
  const lang = session.config.lang, rb = UI_TEXT[lang].tak.rb, r = rangeBearing(a, b);
  return `-- ${UI_TEXT[lang].tak.paneTitle.range_bearing} --\n${rb.range}: ${formatRange(r.metres, lang)} · ${rb.bearing}: ${formatBearing(r.bearingDeg)} · ${rb.backBearing}: ${formatBearing(r.backBearingDeg)}\n${rb.keeps}`;
}

/** `map 2.5km|1km|reset [center=x,y]` on the training's live map (its zoom buttons; the map is locked to the square). */
export async function trainingMap(session: PlaySession, args: readonly string[], look: () => string): Promise<string> {
  const view = viewOrRefuse(session);
  need(view.tools.map && (view.phase === "question" || view.phase === "feedback"), "the training's map is not on screen");
  const move = args.find((a) => (TRAINING_MOVES as readonly string[]).includes(a)) as (typeof TRAINING_MOVES)[number] | undefined;
  const centre = args.find((a) => a.startsWith("center="))?.slice("center=".length).split(",").map(Number);
  need(move !== undefined || centre !== undefined, `map ${TRAINING_MOVES.join("|")} [center=<x>,<y> of the last map image] (the training's zoom buttons)`);
  need(centre === undefined || (centre.length === 2 && centre.every((v) => Number.isFinite(v))), "center=<x>,<y> (pixels of the last map image)");
  const spec = session.trainingContent.spec;
  const ui = uiFor(session, view.itemId);
  session.trainingUi = { ...ui, camera: moveTrainingCamera(ui.camera ?? trainingOpening(spec), move ?? null, centre ? [centre[0]!, centre[1]!] : null, spec) };
  await session.spend(COST_S.mapMove);
  return look();
}
