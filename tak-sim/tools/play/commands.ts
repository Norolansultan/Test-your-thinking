/**
 * The play harness's commands (`tools/play/`): each one what a participant's click or typing does on the screen on show, through
 * the orchestrator's own API (the calls the app's components make), with its virtual-time cost (`costs.ts`). A command checks
 * that its screen is on show and its arguments are what the screen offers; refused, it throws `PlayError` and the run is as it was.
 * Thinking before a click is spent before it (the view's clock runs meanwhile, so the screen may change: the command then says so
 * and does not click); reading a full-screen text is spent before leaving it. The UI's own logging that the session's measures
 * read is kept (the Haku pane's `tab_selected` and pane records, the SPAM card's and freeze screen's answer changes, the legend's
 * toggle; Contacts and Range & Bearing in `tak-tools.ts`); hovers, camera records and pointer tracks are not simulated.
 * Revision (bp), 26 Oct 2026: the training incident's commands are `training-commands.ts` (`training-answer`, and `continue`, `haku`,
 * `measure`, `map` on its screen); the map training's `pretest-answer` and the practice feedback are retired with them.
 */

import type { SessionSnapshot } from "../../app/session/snapshot.js";
import { UI_TEXT } from "../../app/i18n/ui.js";
import { sourceName, tr } from "../../app/i18n/text.js";
import { CONFIDENCE_SCALE } from "../../app/session/confidence.js";
import { isMapItem, MAP_POINT_OPTION_ID, responsesFromDrafts } from "../../app/session/freeze-answers.js";
import { draftFromPlan, planFromDraft, planSummary, type PlanDraft } from "../../app/render/ui/components/DecisionPanels.js";
import { DEPARTURE_NOTE_FROM_VIEW, DEPARTURE_REASONS, MAIN_EFFORT_POSTURES, PLAN_DRONE_TASK_IDS, SECONDARY_TASK_IDS, type DepartureReason, type MainEffortPosture, type PlanDroneTaskId, type SecondaryTaskId } from "../../app/scenario/plan-types.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { back, choose, next, retry } from "../../app/render/ui/explain/primer-flow.js";
import { tourSteps } from "../../app/render/ui/tour.js";
import type { QuestionnaireItem } from "../../app/session/questionnaire.js";
import { studyTextFor } from "../../app/i18n/public-texts.js";
import { displayAnswerText } from "../../app/session/chat-display.js";
import { COST_S, DEFAULT_WAIT_S, MAX_WAIT_S } from "./costs.js";
import { noticed, PlayError, trainingChanged, VIEW_STEPS, type PlaySession } from "./session.js";
import { freezePointAt } from "./freeze-grid.js";
import { gl, logRow, lookText, optionByArg, optionLetter } from "./screen.js";
import { glossaryText, helpText } from "./help.js";
import { MAP_MOVE_ALIASES, MAP_MOVES, moveCamera, openingOf } from "./map-camera.js";
import { contactsCommand, measureCommand } from "./tak-tools.js";
import { playerQuestItems, scalePoints } from "./screen-pages.js";
import { inTraining, trainingViewOf } from "./training-host.js";
import { trainingAnswer, trainingContinue, trainingHaku, trainingMap, trainingMeasure } from "./training-commands.js";

export interface CommandContext { readonly runDir: string; readonly withMap: boolean }

const H = (s: string) => `» ${s}`;
const need = (ok: unknown, message: string): void => { if (!ok) throw new PlayError(message); };
const confidenceOf = (raw: string | undefined): number => {
  const v = Number(raw);
  need((CONFIDENCE_SCALE as readonly number[]).includes(v), `the confidence is one of ${CONFIDENCE_SCALE.join(", ")}`);
  return v;
};

/** Runs one command; returns what the player sees. Images to draw are left in `session.images`. */
export async function runCommand(session: PlaySession, cmd: string, args: readonly string[], ctx: CommandContext): Promise<string> {
  const before = session.snap();
  // The snapshot shares the orchestrator's live message list, so its length is read now (24 Oct 2026: no new message was ever reported).
  const logBefore = before.radioLog.length;
  const seen = session.seenLog;
  const notes = session.autoNotes.splice(0);
  if (cmd !== "haku" && cmd !== "look" && cmd !== "haku-history") await closeHakuPane(session);
  const body = await dispatch(session, cmd, args, ctx);
  const after = changeLines(before, logBefore, session.snap(), seen, session);
  return [...notes.map(H), body, ...after, ...session.autoNotes.splice(0).map(H)].filter((l) => l !== "").join("\n");
}

async function dispatch(session: PlaySession, cmd: string, args: readonly string[], ctx: CommandContext): Promise<string> {
  const s = session.snap();
  switch (cmd) {
    case "look": {
      // B10 (25 Oct 2026): the message log's new rows only, with a count of the earlier ones; `look --all` lists the whole log.
      need(args.every((a) => a === "--all" || a === "all"), "look [--all]");
      return look(session, ctx, args.length > 0);
    }
    case "chip": return chip(session);
    case "hinge-fatigue": {
      need(s.step === "hinge_pause" && s.hingeFatigue !== null, "the hinge's fatigue item is not on screen");
      const v = Number(args[0]);
      need(Number.isInteger(v) && v >= 1 && v <= 7, "hinge-fatigue <1–7> (optional; again: the last one counts)");
      await session.spend(COST_S.hingeFatigue);
      await session.act(() => session.o.rateHingeFatigue(v));
      return `${STUDY_TEXT_OF(session).questionnaire.items["fatigue.start"]!.prompt} ${v} ✓`;
    }
    case "continue": return proceed(session, s);
    case "wait": {
      const seconds = args[0] === undefined ? DEFAULT_WAIT_S : Number(args[0]);
      need(Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_WAIT_S, `wait <seconds>, 1–${MAX_WAIT_S}`);
      const spent = await session.spend(seconds, noticed);
      return `Waited ${Math.round(spent)} s${spent < seconds - 0.5 ? " (stopped early: something changed)" : ""}.`;
    }
    case "haku": return inTraining(s) ? trainingHaku(session, args.join(" ").trim()) : haku(session, args.join(" ").trim());
    case "haku-history": {
      const t = UI_TEXT[session.config.lang];
      await session.spend(COST_S.hakuHistory);
      if (s.aiChatHistory.length === 0) return t.noQuestions(t.haku);
      return s.aiChatHistory.map((turn, i) => [`[${i + 1}] ${turn.query}`, ...answerLines(session, turn.answer)].join("\n")).join("\n\n");
    }
    case "glossary": return glossaryText(session, args.join(" ").trim());
    case "help": return helpText(session, args[0], args[1]);
    case "contacts": return contactsCommand(session, args);
    case "measure": return inTraining(s) ? trainingMeasure(session, args) : measureCommand(session, args);
    case "map": {
      if (inTraining(s)) return trainingMap(session, args, () => look(session, ctx));
      need(VIEW_STEPS.has(s.step) || s.step === "hinge_pause", "the map is not on screen");
      if (args[0] === "legend") {
        session.legendOpen = !session.legendOpen;
        await session.act(() => session.o.logMapUse({ kind: "layer_toggled", detail: { layerId: "legend", newState: session.legendOpen } }));
        await session.spend(COST_S.mapMove);
        return look(session, ctx);
      }
      const move = args.map((a) => MAP_MOVE_ALIASES[a] ?? a).find((a) => (MAP_MOVES as readonly string[]).includes(a)) as (typeof MAP_MOVES)[number] | undefined;
      const centre = args.find((a) => a.startsWith("center="))?.slice("center=".length).split(",").map(Number);
      need(move !== undefined || centre !== undefined, `map ${MAP_MOVES.join("|")} [center=<x>,<y> of the last map image] | map legend`);
      need(centre === undefined || (centre.length === 2 && centre.every((v) => Number.isFinite(v))), "center=<x>,<y> (pixels of the last map image)");
      const from = session.camera() ?? openingOf(session.scenario.extent);
      session.mapCamera = { view: s.currentCycle, camera: moveCamera(session.scenario.extent, from, move ?? null, centre ? [centre[0]!, centre[1]!] : null) };
      await session.spend(COST_S.mapMove);
      return look(session, ctx);
    }
    case "consult": {
      need(s.consultPrompt !== null, "no consult notification is on screen");
      need(args[0] === "open" || args[0] === "dismiss", "consult open|dismiss");
      if (args[0] === "dismiss") { await session.act(() => session.o.dismissConsultPrompt()); await session.spend(COST_S.consult); return "Notification closed."; }
      await session.act(() => session.o.openConsultPrompt());
      await openHakuPane(session);
      await session.spend(COST_S.consult);
      return `${UI_TEXT[session.config.lang].tak.paneTitle.haku} opened (ask with \`haku "<question>"\`).`;
    }
    case "training-answer": return trainingAnswer(session, args, () => look(session, ctx));
    case "primer-answer": case "primer-retry": case "primer-next": case "primer-back": return primer(session, cmd, args, ctx);
    case "freeze-answer": return freezeAnswer(session, s, args, ctx);
    case "freeze-submit": {
      need(s.step === "freeze" && s.freeze, "no freeze is on screen");
      const items = s.freeze!.items;
      const state = session.freezeState();
      need(items.every((it) => state.drafts.get(it.id)?.confidence !== undefined), "answer every item first (one at a time)");
      const drafts = Object.fromEntries(items.map((it) => [it.id, state.drafts.get(it.id)!]));
      await session.act(() => session.o.submitFreeze(responsesFromDrafts(items, drafts)));
      await session.spend(COST_S.freezeSubmit);
      return "Freeze answers sent.";
    }
    case "spam-ready": case "spam-collapse": case "spam-expand": {
      need(s.spam?.phase === "ready", "no SPAM ready prompt is on screen");
      if (cmd === "spam-ready") { await session.act(() => session.o.spamReady()); await session.spend(COST_S.spamReady); return look(session, ctx); }
      await session.act(() => (cmd === "spam-collapse" ? session.o.collapseSpam() : session.o.expandSpam()));
      await session.spend(COST_S.spamToggle);
      return cmd === "spam-collapse" ? "Prompt collapsed to its pill." : "Prompt expanded.";
    }
    case "spam-answer": return spamAnswer(session, s, args, ctx);
    case "plan": return planCommand(session, s, args);
    case "confirm": {
      need(s.step === "allocation", "the plan form is not on screen");
      need(!s.decisionHeld, "the decision strip is held while the question is open");
      const plan = planFromDraft(session.planDraft(), s.allocation.droneTeams.length > 0, s.currentCycle >= DEPARTURE_NOTE_FROM_VIEW);
      need(plan, "the plan is not complete (see `look`)");
      await session.act(() => session.o.submitAllocation(plan!));
      await session.spend(COST_S.confirm);
      const t = UI_TEXT[session.config.lang];
      return `${t.planRecorded} ${gl(session, planSummary(plan!, s.allocation.sectors, s.allocation.droneTeams.length > 0, t, (fi) => tr(session.config.lang, fi)))}`;
    }
    case "revise": {
      need(s.step === "awaiting_view_end" && !s.decisionHeld, "nothing to revise now");
      session.setPlanDraft(draftFromPlan(s.recordedPlan));
      await session.act(() => session.o.reviseAllocation());
      await session.spend(COST_S.revise);
      return "The plan form is open again with the plan recorded.";
    }
    case "plan-confidence": {
      need(s.step === "plan_confidence" && s.planConfidence, "the plan's confidence is not asked now");
      const v = confidenceOf(args[0]);
      await session.spend(COST_S.planConfidence);
      await session.act(() => session.o.submitPlanConfidence(v));
      return "Confidence recorded.";
    }
    case "review": {
      need(s.step === "plan_review" && s.planReview, "no plan review is on screen");
      need(args[0] === "keep" || args[0] === "change", "review keep|change");
      await session.spend(COST_S.review);
      if (args[0] === "keep") { await session.act(() => session.o.keepPlan()); return `${UI_TEXT[session.config.lang].planReview.keep} ✓`; }
      session.setPlanDraft(draftFromPlan(s.recordedPlan));
      await session.act(() => session.o.revisePlan());
      return "The plan form is open again with the plan recorded (`plan …`, `confirm`).";
    }
    case "probe-answer": return probeAnswer(session, s, args);
    case "hinge-answer": {
      need(s.step === "hinge_pause" && s.hingeCheck?.phase === "item", "no hinge question is on screen");
      const hingeIds = s.hingeCheck!.options.map((o) => o.id);
      const chosen = optionByArg(hingeIds, args[0]);
      need(chosen !== null, `options: ${hingeIds.map((_, i) => optionLetter(i)).join(", ")}`);
      await session.spend(COST_S.hingeAnswer);
      await session.act(() => session.o.answerHingeCheck(chosen!));
      return look(session, ctx);
    }
    case "quest-answer": {
      need(s.step === "questionnaire" && s.questionnaire, "no questionnaire is on screen");
      // B2 (25 Oct 2026): every item of the pre-session form; the post-session form's source-memory, self-estimate and influence items.
      const items = playerQuestItems(s.questionnaire!);
      const item = items.find((i) => i.id === args[0]);
      need(item, `quest-answer <item id> <option id | number>; the items: ${items.map((i) => i.id).join(", ")}`);
      const value = questValue(item!, args[1]);
      need(value !== null, questHint(item!));
      session.quest.set(item!.id, value!);
      await session.spend(COST_S.questAnswer);
      return `${item!.id}: ${value}`;
    }
    case "quest-submit": {
      need(s.step === "questionnaire" && s.questionnaire, "no questionnaire is on screen");
      await session.spend(s.questionnaire!.id === "pre" ? COST_S.questSubmitPre : COST_S.questSubmit);
      const answers: Record<string, string | number> = {};
      for (const [id, v] of session.quest) answers[id] = v;
      await session.act(() => session.o.submitQuestionnaire(answers));
      return look(session, ctx);
    }
    default: throw new PlayError(`unknown command "${cmd}" (see tools/play/README.md)`);
  }
}

function look(session: PlaySession, ctx: CommandContext, wholeLog = false): string {
  session.looks += 1;
  const { text, images } = lookText(session, ctx.runDir, session.looks, ctx.withMap, wholeLog);
  session.images = images;
  return text;
}

/** The session's study-shell texts (the questionnaire's wording), as `StudyShell` takes them. */
const STUDY_TEXT_OF = (session: PlaySession) => studyTextFor(session.config.lang, { audience: session.o.audience, scope: session.o.scope });

/** B2: a questionnaire answer typed for `item` — an offered option id, or a whole number on its scale or in its range; null when not. */
function questValue(item: QuestionnaireItem, raw: string | undefined): string | number | null {
  if (raw === undefined) return null;
  if (item.kind === "choice") return item.options.includes(raw) ? raw : null;
  const v = Number(raw);
  if (item.kind === "scale") return scalePoints(item).includes(v) ? v : null;
  if (item.kind === "number") return Number.isInteger(v) && v >= item.min && v <= item.max ? v : null;
  return null;
}

function questHint(item: QuestionnaireItem): string {
  if (item.kind === "choice") return `${item.id}: one of ${item.options.join(", ")}`;
  if (item.kind === "scale") return `${item.id}: one of ${scalePoints(item).join(", ")}`;
  if (item.kind === "number") return `${item.id}: a whole number ${item.min}–${item.max}`;
  return `${item.id} is not answered in the harness`;
}

/** One button that leaves a screen: the training incident's, the tour, the intro video, the training text, the hinge, the debrief. */
async function proceed(session: PlaySession, s: SessionSnapshot): Promise<string> {
  const o = session.o;
  if (inTraining(s)) return trainingContinue(session);
  if (s.tour !== null) {
    await session.spend(COST_S.tour);
    await session.act(() => o.completeTour(tourSteps(s.tour!, s.conditionLabel, "radio").length));
    return "Tour finished: the period's time runs.";
  }
  switch (s.step) {
    case "briefing": await session.spend(COST_S.introVideo); await session.act(() => o.finishIntroVideo("ended")); return "Intro video ended.";
    case "training": await session.spend(COST_S.training); await session.act(() => o.completeTraining()); return "Training text left: the task starts.";
    case "debrief": await session.spend(COST_S.debrief); await session.act(() => o.finishDebrief()); return "Debrief closed.";
    case "profile": await session.act(() => o.finishProfile()); return "Profile left.";
    case "hinge_pause": {
      const check = s.hingeCheck;
      if (check?.phase === "directive") { await session.spend(COST_S.hingeRead); await session.act(() => o.showHingeCheck()); return "Directive read; its question follows (`look`)."; }
      need(check === null || check.phase === "answered", "answer the question first (`hinge-answer <letter>`)");
      await session.spend(COST_S.hingeContinue);
      await session.act(() => o.dismissHinge());
      return "Continued.";
    }
    default: throw new PlayError("nothing to continue here");
  }
}

async function openHakuPane(session: PlaySession): Promise<void> {
  if (session.hakuPaneOpen) return;
  const view = session.snap().currentCycle;
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_closed", detail: { pane: "geochat", view, cause: "replaced" } }));
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_opened", detail: { pane: "haku", view, cause: "toolbar" } }));
  await session.act(() => session.o.logTabSelected("haku"));
  session.hakuPaneOpen = true;
}

/** Back to GeoChat once a view's screen is up again (the badge can show again; as choosing GeoChat in the toolbar logs). */
async function closeHakuPane(session: PlaySession): Promise<void> {
  const s = session.snap();
  if (!session.hakuPaneOpen || !VIEW_STEPS.has(s.step)) return;
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_closed", detail: { pane: "haku", view: s.currentCycle, cause: "replaced" } }));
  await session.act(() => session.o.logMapUse({ kind: "tak_pane_opened", detail: { pane: "geochat", view: s.currentCycle, cause: "toolbar" } }));
  await session.act(() => session.o.logTabSelected("none"));
  session.hakuPaneOpen = false;
}

function answerLines(session: PlaySession, a: { answerFi: string; basisFi: string; certaintyFi: string; wouldChangeIfFi: string }): string[] {
  const t = UI_TEXT[session.config.lang];
  return [`${t.answer}: ${gl(session, displayAnswerText(a.answerFi))}`, `${t.basis}: ${gl(session, displayAnswerText(a.basisFi))}`, `${t.certainty}: ${gl(session, displayAnswerText(a.certaintyFi))}`, `${t.wouldChange}: ${gl(session, displayAnswerText(a.wouldChangeIfFi))}`];
}

/** Haku's chat: the pane opened, the question typed (the time it takes runs), sent, answered after the latency floor, read. */
async function haku(session: PlaySession, question: string): Promise<string> {
  need(question.length > 0, `haku "<question>"`);
  return askHaku(session, COST_S.hakuType, () => session.o.askAiChat(question), question);
}

/**
 * B1 (25 Oct 2026): the Haku group's suggested-question chip above Haku's input (V8–V14, SPEC/30 bf.1), clicked: exactly its question
 * through Haku's normal path, logged `viaChip` (`askHakuChip`), as `RightPanel`'s chip does. A click, not typing. The harness plays the
 * Haku group, so the guide's Thinker chip (`suggestedQuestion`) never shows here; it is printed if it ever does, with no command.
 */
async function chip(session: PlaySession): Promise<string> {
  const s = session.snap();
  need(s.hakuChip, "no suggested question is on screen (the Haku group's chip is in Haku's pane from V8)");
  return askHaku(session, COST_S.chip, () => session.o.askHakuChip(), UI_TEXT[session.config.lang].consult.hakuChip);
}

/** One Haku question: the pane opened, `beforeCost` (typing, or the chip's click) spent, sent, answered, read; back to GeoChat. */
async function askHaku(session: PlaySession, beforeCost: number, ask: () => Promise<{ answerFi: string; basisFi: string; certaintyFi: string; wouldChangeIfFi: string }>, question: string): Promise<string> {
  const s = session.snap();
  const t = UI_TEXT[session.config.lang];
  need(s.tour === null, "finish the tour first (`continue`)");
  need(["exploration", "allocation", "awaiting_view_end"].includes(s.step) && !s.toolsLocked, "Haku is not usable on this screen");
  await openHakuPane(session);
  await session.spend(beforeCost);
  const now = session.snap();
  if (!["exploration", "allocation", "awaiting_view_end"].includes(now.step) || now.toolsLocked || now.currentCycle !== s.currentCycle) return `${t.questionNotSent} (The screen changed meanwhile: \`look\`.)`;
  const startMs = session.clock.now();
  const answer = await session.act(ask);
  const waited = (session.clock.now() - startMs) / 1000;
  await session.spend(Math.max(0, COST_S.hakuRead - waited));
  const turn = session.snap().aiChatHistory.at(-1);
  if (!(session.snap().step === "freeze")) await closeHakuPane(session);
  return [H("Haku answer — TEMPLATE FALLBACK (the proxy's no-model answer over lexical retrieval), not the study's model."), `${t.haku} · ${now.clockLabel}`, `> ${turn?.query ?? question}`, ...answerLines(session, answer)].join("\n");
}

async function primer(session: PlaySession, cmd: string, args: readonly string[], ctx: CommandContext): Promise<string> {
  const s = session.snap();
  need(s.step === "primer" && session.primer, "the primer is not on screen");
  const pages = PRIMER_CONTENT[session.config.lang].pages;
  const state = session.primer!;
  const page = pages[state.page]!;
  if (cmd === "primer-answer") {
    const n = Number(args[0]);
    await session.spend(COST_S.primerAnswer);
    const r = choose(state, pages, n - 1);
    need(r, `primer-answer <1–${page.question.options.length}> while the question is asked`);
    session.primer = r!.state;
    if (r!.record.correct) session.primerRight.set(state.page, r!.record.chosen);
    await session.act(() => session.o.primerCheck(r!.record.questionId, r!.record.chosen, r!.record.correct, r!.record.attempt));
  } else if (cmd === "primer-retry") {
    session.primer = retry(state);
    await session.spend(COST_S.primerRetry);
  } else {
    const to = cmd === "primer-back" ? back(state) : next(state);
    need(cmd === "primer-back" ? state.page > 0 : to !== state, cmd === "primer-back" ? "this is the first page" : "answer the page's question first");
    await session.spend(COST_S.primerNext);
    await session.act(() => session.o.primerPage(page.id, Math.max(0, session.clock.now() - session.primerEnteredMs)));
    session.primerEnteredMs = session.clock.now();
    if (to === null) { await session.act(() => session.o.finishPrimer()); session.primer = null; }
    else session.primer = to;
  }
  return look(session, ctx);
}

async function freezeAnswer(session: PlaySession, s: SessionSnapshot, args: readonly string[], ctx: CommandContext): Promise<string> {
  need(s.step === "freeze" && s.freeze, "no freeze is on screen");
  const items = s.freeze!.items;
  const state = session.freezeState();
  const item = items[state.index]!;
  // The item on screen is answered (`freeze-answer <letter|x,y> <confidence>`); runs played before 24 Oct 2026 named the item first.
  if (items.some((i) => i.id === args[0])) { need(args[0] === item.id, "the item on screen is the one to answer (one at a time, no going back)"); args = args.slice(1); }
  const confidence = confidenceOf(args[1]);
  let draft: { optionId?: string; point?: { lat: number; lon: number }; pointPx?: string; confidence: number };
  if (isMapItem(item)) {
    const [x, y] = (args[0] ?? "").split(",").map(Number);
    const at = freezePointAt(x!, y!, session.scenario.extent);
    need(!("error" in at), "error" in at ? at.error : "");
    draft = { optionId: MAP_POINT_OPTION_ID, point: (at as { point: { lat: number; lon: number } }).point, pointPx: args[0]!, confidence };
  } else {
    const chosen = optionByArg(item.options.map((o) => o.id), args[0]);
    need(chosen !== null, `options: ${item.options.map((_, i) => optionLetter(i)).join(", ")}`);
    draft = { optionId: chosen!, confidence };
  }
  await session.spend(COST_S.freezeAnswer);
  if (session.snap().step !== "freeze" || session.freezeState() !== state) return "The freeze closed (its time ran out) before the answer.";
  if (!isMapItem(item)) await session.act(() => session.o.logPanelUse({ kind: "probe_answer_changed", detail: { probeId: item.id, from: null, to: draft.optionId! } }));
  state.drafts.set(item.id, draft);
  if (state.index < items.length - 1) {
    await session.act(() => session.o.markFreezeItemAnswered(item.id, responsesFromDrafts([item], { [item.id]: draft })[0]));
    state.index += 1;
  }
  const marked = isMapItem(item) ? `${UI_TEXT[session.config.lang].freezeMapMarked} (${draft.pointPx})\n` : "";
  return `${marked}${look(session, ctx)}`;
}

async function spamAnswer(session: PlaySession, s: SessionSnapshot, args: readonly string[], ctx: CommandContext): Promise<string> {
  const spam = s.spam;
  need(spam && spam.phase !== "ready", "no SPAM question is on screen (`spam-ready` first)");
  if (spam!.phase === "confidence") {
    const v = confidenceOf(args[0]);
    await session.spend(COST_S.spamAnswer / 2);
    await session.act(() => session.o.submitSpamConfidence(v));
    return look(session, ctx);
  }
  const item = spam as Exclude<NonNullable<SessionSnapshot["spam"]>, { phase: "ready" }>;
  const chosen = optionByArg(item.options.map((o) => o.id), args[0]);
  need(chosen !== null, `spam-answer <letter> <confidence>; options: ${item.options.map((_, i) => optionLetter(i)).join(", ")}`);
  const v = confidenceOf(args[1]);
  await session.spend(COST_S.spamAnswer);
  const now = session.snap().spam;
  if (!now || now.phase !== "item" || now.probeId !== item.probeId) return "The question closed before the answer (its answer window ran out).";
  await session.act(() => session.o.logPanelUse({ kind: "probe_answer_changed", detail: { probeId: item.probeId, from: null, to: chosen! } }));
  await session.act(() => session.o.answerSpam(chosen!));
  if (session.snap().spam?.phase === "confidence") await session.act(() => session.o.submitSpamConfidence(v));
  return look(session, ctx);
}

/** `plan key=value …`: the plan form's choices, as its buttons allow them (the main effort's change clears the same secondary sector). */
async function planCommand(session: PlaySession, s: SessionSnapshot, args: readonly string[]): Promise<string> {
  need(s.step === "allocation", "the plan form is not on screen");
  need(!s.decisionHeld, "the decision strip is held while the question is open");
  const sectors = s.allocation.sectors.map((x) => x.id);
  const hasDrones = s.allocation.droneTeams.length > 0;
  let d: PlanDraft = session.planDraft();
  need(args.length > 0, "plan main=<sector> posture=<id> secondary=none|<sector>:<task> drones=carry_on|<sector>:<task> [departure=yes|no reason=<id>]");
  for (const arg of args) {
    const [key, value = ""] = arg.split("=");
    const [sector, task] = value.split(":");
    switch (key) {
      case "main": need(sectors.includes(value), `main: ${sectors.join(", ")}`); d = { ...d, mainEffort: value, ...(d.secondarySector === value ? { secondarySector: undefined, secondaryTask: null } : {}) }; break;
      case "posture": need((MAIN_EFFORT_POSTURES as readonly string[]).includes(value), `posture: ${MAIN_EFFORT_POSTURES.join(", ")}`); d = { ...d, posture: value as MainEffortPosture }; break;
      case "secondary":
        if (value === "none") { d = { ...d, secondarySector: null, secondaryTask: null }; break; }
        need(sectors.includes(sector!) && sector !== d.mainEffort && (SECONDARY_TASK_IDS as readonly string[]).includes(task ?? ""), `secondary: none, or <sector other than the main effort>:<${SECONDARY_TASK_IDS.join("|")}>`);
        d = { ...d, secondarySector: sector!, secondaryTask: task as SecondaryTaskId }; break;
      case "drones":
        need(hasDrones, "no drone team is on scene in this period");
        if (value === "carry_on") { d = { ...d, droneSector: null, droneTask: null }; break; }
        need(sectors.includes(sector!) && (PLAN_DRONE_TASK_IDS as readonly string[]).includes(task ?? ""), `drones: carry_on, or <sector>:<${PLAN_DRONE_TASK_IDS.join("|")}>`);
        d = { ...d, droneSector: sector!, droneTask: task as PlanDroneTaskId }; break;
      case "departure": need(s.currentCycle >= DEPARTURE_NOTE_FROM_VIEW && (value === "yes" || value === "no"), `departure=yes|no (from V${DEPARTURE_NOTE_FROM_VIEW})`); d = { ...d, departureNoted: value === "yes", ...(value === "no" ? { departureReason: null } : {}) }; break;
      case "reason": need(d.departureNoted && (DEPARTURE_REASONS as readonly string[]).includes(value), `reason (with departure=yes): ${DEPARTURE_REASONS.join(", ")}`); d = { ...d, departureReason: value as DepartureReason }; break;
      default: throw new PlayError(`unknown plan field "${key}" (main, posture, secondary, drones, departure, reason)`);
    }
  }
  await session.spend(COST_S.plan);
  session.setPlanDraft(d);
  const plan = planFromDraft(d, hasDrones, s.currentCycle >= DEPARTURE_NOTE_FROM_VIEW);
  return plan ? "Plan form set: complete (`confirm` records it)." : "Plan form set: not complete yet (`look`).";
}

async function probeAnswer(session: PlaySession, s: SessionSnapshot, args: readonly string[]): Promise<string> {
  need(s.step === "probe" && s.visibleProbe, "no question card is on screen");
  const p = s.visibleProbe!;
  const ids = p.options.map((o) => o.id);
  if (p.kind === "area") {
    need(args[0] === "yes" || args[0] === "no", "probe-answer no | probe-answer yes <letter>[,<letter>…]");
    const areas = args[0] === "yes" ? (args[1] ?? "").split(",").filter((x) => x !== "").map((a) => optionByArg(ids, a) ?? a) : [];
    need(args[0] === "no" || (areas.length > 0 && areas.every((a) => ids.includes(a))), `parts: ${ids.map((_, i) => optionLetter(i)).join(", ")}`);
    await session.spend(COST_S.probeAnswer);
    await session.act(() => session.o.submitProbeArea(args[0] === "yes", areas));
  } else if (p.kind === "choice") {
    const chosen = optionByArg(ids, args[0]);
    need(chosen !== null, `options: ${ids.map((_, i) => optionLetter(i)).join(", ")}`);
    const c = p.collectsConfidence ? confidenceOf(args[1]) : undefined;
    await session.spend(COST_S.probeAnswer);
    await session.act(() => session.o.submitProbeChoice(chosen!, c));
  } else {
    const v = confidenceOf(args[0]);
    await session.spend(COST_S.probeAnswer);
    await session.act(() => session.o.submitProbeScale(v));
  }
  return "Answer sent.";
}

/** What changed while the command ran, as the participant would notice it; then where they are. */
function changeLines(before: SessionSnapshot, logBefore: number, now: SessionSnapshot, seenAtStart: number, session: PlaySession): string[] {
  const t = UI_TEXT[session.config.lang], lang = session.config.lang;
  const out: string[] = [];
  if (now.currentCycle !== before.currentCycle) out.push(`Period ended. Now: ${now.practice ? t.practiceLabel : t.viewLabel(now.currentCycle, 14)}, ${t.clock} ${now.clockLabel}.`);
  if (now.step !== before.step) out.push(`Screen: ${now.step}${now.step === "freeze" ? ` (${t.freezeTitle})` : ""}.`);
  // Revision (bp): the training's screen moved on (the next card, item, feedback or S5).
  const tv = trainingViewOf(now);
  if (tv && trainingChanged(before, now)) out.push(`Training: ${tv.phase}${tv.position > 0 ? ` (${tv.position} / ${tv.itemCount})` : ""}${tv.timedOut ? " — the card's time ran out" : ""} (\`look\`).`);
  const fresh = now.radioLog.length - Math.max(seenAtStart, logBefore);
  if (fresh > 0 && now.step !== "freeze") out.push(`${fresh} new message(s) in the log: ${now.radioLog.slice(-fresh).map((e) => `${e.clockLabel} ${sourceName(lang, e.from)}`).join(", ")} (\`look\`).`);
  // A freeze blanks the log, so the messages that came in before it are shown whole: a participant watching saw them arrive.
  if (fresh > 0 && now.step === "freeze") out.push(`${fresh} message(s) came into the log before the screen froze:`, ...now.radioLog.slice(-fresh).map((e) => `  ${logRow(session, e)}`));
  if (before.spam && before.spam.phase !== "ready" && !now.spam) out.push(`${t.spam.title}: the question card is no longer on screen.`);
  if (now.spam && (!before.spam || before.spam.probeId !== now.spam.probeId || before.spam.phase !== now.spam.phase) && now.spam.phase === "ready") out.push(`${t.spam.readyPrompt} (\`spam-ready\`)`);
  if (now.spam && now.spam.phase !== "ready" && now.spam.forced && !(before.spam && before.spam.phase !== "ready" && before.spam.forced)) out.push(t.spam.forcedTitle);
  if (now.consultPrompt && !before.consultPrompt) out.push(`[${t.consult.notice}]`);
  if (now.recordsBadge && !before.recordsBadge) out.push(`${t.tak.toolbar.haku}: [${t.recordsBadge}]`);
  if (now.minimumReached && !before.minimumReached && VIEW_STEPS.has(now.step)) out.push("The period's minimum length has passed.");
  if (now.secondsLeft !== null && now.secondsLeft > 0 && now.step !== "freeze") out.push(t.periodEndsIn(now.secondsLeft));
  const where = VIEW_STEPS.has(now.step) ? `${now.practice ? t.practiceLabel : t.viewLabel(now.currentCycle, 14)} · ${t.clock} ${now.clockLabel} · ${now.step}${now.tour ? " (tour)" : ` · period ${Math.floor(session.viewSeconds())} s`}` : tv ? `${now.step} · ${tv.phase}` : now.step;
  out.push(H(`[${where}]`));
  return out;
}
