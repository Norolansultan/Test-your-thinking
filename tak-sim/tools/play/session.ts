/**
 * The play harness's session (`tools/play/`): the REAL session engine, headless — the app's `SessionOrchestrator` over
 * `buildDemoScenario()`, with the options the app gives a study session (`useSession.ts` under `?tuotanto`: the study shell, the
 * AI-literacy test, the intro video, the guided tour, the visible probes, the SA levels hidden, nothing skippable), the Haku group
 * (cell `radio`), the session language and audience the player chose — on the harness's virtual clock (`virtual-clock.ts`). Haku's
 * chat is answered by the proxy's no-model path (`haku-transport.ts`), the training incident's Search too (over its own records).
 * Revision (bp), 26 Oct 2026: the map training and the practice feedback are retired; the training incident (`training_incident`, work
 * package B's orchestrator) takes the map training's place, played with `training-commands.ts` and shown by `training-pages.ts`.
 *
 * State across CLI calls is REPLAY: a run is its configuration and the list of commands the player issued, each with the
 * virtual milliseconds it spent (`ActionRecord`); every call rebuilds the session from nothing and replays them (a whole
 * session replays in well under a second), then applies the new command. `spend` takes a cost from the record on replay, so a
 * change to `costs.ts` never changes an old run, and `atMs` is checked on every replayed command, so a run that no longer
 * replays to the same state (the app changed) fails loudly instead of drifting.
 *
 * What the screen keeps that the orchestrator does not (the plan form's draft, the freeze screen's item and drafts, the primer's
 * page, the questionnaire's ticks) lives here, as the app's components keep it. The steps a participant only clicks through
 * without content to judge — consent (accepted, attested), the AI-literacy test (skipped, as its button allows), the preflight (a
 * passing desktop browser) and the results step (no) — are completed neutrally by `autoAdvance`; so is the pre-session form (fatigue
 * 4, the scale's middle) in runs started before 25 Oct 2026. Since then the pre-session form, the post-session self-estimate and
 * influence items and the hinge's fatigue item are the player's (B2, `PlayConfig.questionnairesPlayed`).
 */

import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { ScenarioContract } from "../../app/scenario/types.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import type { PreflightEnv } from "../../app/session/preflight.js";
import type { Audience } from "../../app/session/public-session.js";
import type { Lang } from "../../app/i18n/lang.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { EMPTY_PLAN_DRAFT, type PlanDraft } from "../../app/render/ui/components/DecisionPanels.js";
import { initialPrimerState, type PrimerState } from "../../app/render/ui/explain/primer-flow.js";
import { PRIMER_CONTENT } from "../../app/render/ui/explain/primer-content.js";
import { VirtualClock } from "./virtual-clock.js";
import { noModelHakuTransport, unavailableOpenTransport, unavailablePremiseTransport } from "./haku-transport.js";
import type { ImageRequest } from "./map-data.js";
import type { Camera } from "../../app/render/map-frame.js";
import type { TrainingSpec } from "../../app/session/training/spec.js";
import type { TrainingTexts } from "../../app/i18n/training-texts-types.js";
import { TRAINING } from "../../app/session/training/spec-data.js";
import { TRAINING_TEXT } from "../../app/i18n/training-texts.js";
import { trainingViewOf } from "./training-host.js";

export interface PlayConfig {
  readonly audience: Audience;
  readonly lang: Lang;
  /**
   * `wait` stops when a message comes into the log (runs started from 24 Oct 2026). Runs started before it played with a `wait` that
   * never saw a new message (the snapshot shares the live list), and replay keeps that rule for them so their recorded times hold.
   */
  readonly waitStopsOnMessages?: boolean;
  /**
   * B2 (25 Oct 2026): the pre-session form (fatigue, sleep, the recent shift) is the player's, answered with `quest-answer` and sent with
   * `quest-submit` (runs started from 25 Oct 2026). Runs started before it had the form completed neutrally (fatigue 4, the rest blank),
   * and replay keeps that for them so their recorded times hold.
   */
  readonly questionnairesPlayed?: boolean;
}

/** One command the player issued: what, when (virtual ms at its start) and the virtual ms each of its costs spent. */
export interface ActionRecord {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly atMs: number;
  readonly costsMs: readonly number[];
}

/** A command refused (wrong screen, bad arguments): nothing is recorded, the session is as it was. */
export class PlayError extends Error {
  constructor(message: string) { super(message); this.name = "PlayError"; }
}

/** The participant code of every play run: fixes the option orders (`option-order.ts`) and the session id's placeholder. */
export const PLAY_PARTICIPANT_CODE = "PLAY-1";

/** The preflight's environment: a desktop browser that passes (as the specs' `GOOD_ENV`). */
const PASSING_ENV: PreflightEnv = {
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  maxTouchPoints: 0, pointer: "fine", viewport: { w: 1440, h: 900, dpr: 1 }, indexedDb: true, webgl2: true, proxy: "reachable",
};
/** The pre-session fatigue item, answered neutrally: the middle of its 1–7 scale. */
const NEUTRAL_FATIGUE = 4;

/** The steps in which the map, the message log and the tools are on screen (a view is running). */
export const VIEW_STEPS: ReadonlySet<SessionSnapshot["step"]> = new Set(["exploration", "allocation", "awaiting_view_end", "probe", "plan_confidence", "plan_review"]);

/** The app's options for a study session in the Haku group (`useSession.ts`, `App.tsx` under `?tuotanto`, `SessionLauncher`). */
export function studyOptions(config: PlayConfig, clock: VirtualClock, scenario: ScenarioContract): SessionOptions {
  return {
    cell: "radio", language: config.lang, audience: config.audience, participantCode: PLAY_PARTICIPANT_CODE,
    showProbeLevels: false, guidedTour: true, visibleProbes: true, studyShell: true, aiLiteracyTest: true, introVideo: "/video/intro.mp4",
    // Revision (bp): no map training and no practice feedback (retired); the training incident on, as the app sets it (work package B).
    allowPreflightOverride: false, allowViewSkip: false, trainingIncident: true,
    realClockMs: clock.now,
    thinker: { transport: noModelHakuTransport(scenario, clock.now), openTransport: unavailableOpenTransport, premiseReview: unavailablePremiseTransport },
  };
}

/** One freeze item's answer as the freeze screen holds it. */
export interface FreezeDraftFull { readonly optionId?: string; readonly point?: LatLon; readonly pointPx?: string; readonly confidence?: number }

export class PlaySession {
  readonly clock = new VirtualClock();
  readonly scenario: ScenarioContract;
  readonly o: SessionOrchestrator;
  private current: SessionSnapshot | null = null;
  /** Replay: the costs recorded for the command being replayed (taken in order); null when the command is live. */
  private replayCosts: number[] | null = null;
  /** The costs the command being applied has spent (recorded with it). */
  private spentNow: number[] = [];
  /** Image requests of the command just applied (rendered by the CLI for the last command only). */
  images: ImageRequest[] = [];
  /** Notes of what `autoAdvance` completed, for the next command's output. */
  autoNotes: string[] = [];

  // What the screen keeps (see the module comment).
  plan: { view: number | null; draft: PlanDraft } = { view: null, draft: EMPTY_PLAN_DRAFT };
  freezeSerial = 0;
  freezeUi: { serial: number; index: number; drafts: Map<string, FreezeDraftFull> } = { serial: -1, index: 0, drafts: new Map() };
  primer: PrimerState | null = null;
  /** The primer: the option chosen right on each page (the app marks it), and when the page on show was entered (its dwell). */
  primerRight: Map<number, number> = new Map();
  primerEnteredMs = 0;
  /** The questionnaire on screen: the player's answers so far (an option id, or a number for a scale or number item). */
  quest: Map<string, string | number> = new Map();
  /** The Haku pane is open in place of GeoChat (`commands.ts` opens it for a question and closes it after). */
  hakuPaneOpen = false;
  /** The live map's camera as the participant left it in a view (`map`); a new view opens on the opening frame again. */
  mapCamera: { view: number; camera: Camera } | null = null;
  /** The map's legend open (the harness's default) or collapsed by the player. */
  legendOpen = true;
  /** The Range & Bearing line the player measured in a view (`measure`): it stays on the map, as the app keeps it. */
  rb: { view: number; from: LatLon; to: LatLon } | null = null;
  /** Revision (bp): the training's content (its build, `content/training/`); the spec tests the pages on a fixture of its own. */
  trainingContent: { spec: TrainingSpec; texts: Readonly<Record<Lang, TrainingTexts>> } = { spec: TRAINING, texts: TRAINING_TEXT };
  /**
   * Revision (bp): the training's screen state: the item the readings belong to, its R&B readings (m) and line, and the live map's frame,
   * as `TrainingStage` keeps them (its Haku turns are the snapshot's, `aiChatHistory`, while the step is on).
   */
  trainingUi: { itemId: string | null; measures: number[]; rb: { from: LatLon; to: LatLon } | null; camera: Camera | null } = { itemId: null, measures: [], rb: null, camera: null };
  /** The message-log rows seen at the last `look` (the rows after them are marked new), and the screens drawn so far. */
  seenLog = 0;
  looks = 0;
  completed = false;

  private constructor(readonly config: PlayConfig) {
    this.clock.install();
    this.scenario = buildDemoScenario();
    this.o = new SessionOrchestrator(this.scenario, "directed", studyOptions(config, this.clock, this.scenario));
    let previous: SessionSnapshot["step"] | null = null;
    this.o.subscribe((s) => {
      this.current = s;
      if (s.step === "freeze" && previous !== "freeze") this.freezeSerial += 1;
      if (s.step === "primer" && previous !== "primer") { this.primer = initialPrimerState(PRIMER_CONTENT[config.lang].pages.length); this.primerEnteredMs = this.clock.now(); }
      if (s.step === "questionnaire" && previous !== "questionnaire") this.quest = new Map();
      previous = s.step;
    });
  }

  /** A new session at its first screen a participant answers (the neutral steps before it completed). */
  static async create(config: PlayConfig): Promise<PlaySession> {
    const session = new PlaySession(config);
    await session.o.start();
    await session.clock.flush();
    await session.autoAdvance();
    return session;
  }

  /** Puts the global timers back (the clock is the process's while a session lives). */
  dispose(): void { this.clock.uninstall(); }

  snap(): SessionSnapshot { return this.current!; }

  /**
   * The view's own seconds so far (the orchestrator's `ViewClock`; read, never written): what the participant's own sense of time gives.
   * Once the view has ended (the plan's confidence, an end freeze, the after-view probes) it is the end's moment: the stopped clock
   * keeps its last pause, so the readout fell back to a mid-view freeze's moment, or to 0 s (24 Oct 2026: "period 107 s" → "105 s").
   */
  viewSeconds(): number {
    const o = this.o as unknown as { viewClock?: { elapsedSeconds(): number }; viewEnd?: { readonly view: number; readonly viewSeconds: number } | null };
    if (o.viewEnd && o.viewEnd.view === this.snap().currentCycle) return o.viewEnd.viewSeconds;
    return o.viewClock ? o.viewClock.elapsedSeconds() : 0;
  }

  /** Starts a command: live (its costs recorded) or replayed (its recorded costs used, its start time checked). */
  begin(replay: ActionRecord | null): void {
    this.images = [];
    this.spentNow = [];
    this.replayCosts = replay ? [...replay.costsMs] : null;
    if (replay && replay.atMs !== this.clock.now()) throw new Error(`replay diverged at "${replay.cmd}": recorded at ${replay.atMs} ms, now ${this.clock.now()} ms (the app changed since the run was played?)`);
  }
  /** The costs this command spent, for its record. */
  spent(): number[] { return [...this.spentNow]; }

  /**
   * Spends a cost: virtual time passes (the session runs), stopping early when `stop` says so. On replay the recorded nominal
   * cost is used instead of `seconds` (the stop rule is the same, so the same time is spent). Returns the seconds spent.
   */
  async spend(seconds: number, stop: (before: SessionSnapshot, now: SessionSnapshot) => boolean = interrupted): Promise<number> {
    const nominal = this.replayCosts ? this.replayCosts.shift() ?? 0 : Math.round(seconds * 1000);
    if (!this.replayCosts) this.spentNow.push(nominal);
    const live = this.snap();
    const before = this.config.waitStopsOnMessages === true ? { ...live, radioLog: live.radioLog.slice() } : live;
    const ms = await this.clock.advance(nominal, () => stop(before, this.snap()));
    await this.autoAdvance();
    return ms / 1000;
  }

  /**
   * Runs one orchestrator call to its end: some wait on the session's own timers (Haku's 2.5 s latency floor), so virtual time
   * runs in 100 ms steps until the call settles (deterministic, so it is not recorded). Refusals become `PlayError`s.
   */
  async act<T>(call: () => Promise<T>, maxMs = 60_000): Promise<T> {
    const box: { done: boolean; ok: boolean; value?: T; error?: unknown } = { done: false, ok: false };
    void call().then((value) => { box.done = true; box.ok = true; box.value = value; }, (error: unknown) => { box.done = true; box.error = error; });
    await this.clock.flush();
    for (let waited = 0; !box.done && waited < maxMs; waited += 100) await this.clock.advance(100);
    if (!box.done) throw new PlayError("the session did not answer");
    if (!box.ok) throw new PlayError(box.error instanceof Error ? box.error.message : String(box.error));
    await this.autoAdvance();
    return box.value as T;
  }

  /** Completes the neutral steps (see the module comment) while one is on screen; notes each for the next output. */
  async autoAdvance(): Promise<void> {
    for (let guard = 0; guard < 20; guard++) {
      const s = this.snap();
      if (s.step === "consent") { await this.o.decideConsent(true, true); this.autoNotes.push("Consent: accepted (auto)."); }
      else if (s.step === "ai_literacy") { await this.o.skipAiLiteracy(); this.autoNotes.push("AI literacy questionnaire: skipped with its own button (auto)."); }
      else if (s.step === "preflight") { await this.o.submitPreflight(PASSING_ENV); this.autoNotes.push("Browser check: passed (auto)."); }
      else if (s.step === "questionnaire" && s.questionnaire?.id === "pre" && this.config.questionnairesPlayed !== true) { await this.o.submitQuestionnaire({ "fatigue.start": NEUTRAL_FATIGUE }); this.autoNotes.push(`Pre-session item (fatigue): ${NEUTRAL_FATIGUE} of 1–7 (auto).`); }
      else if (s.step === "results_optin") { await this.o.decideResultsOptIn(false); this.autoNotes.push("Personal results after the study: no (auto)."); }
      else if (s.step === "complete" && !this.completed) { this.completed = true; await this.o.completeSession(); }
      else return;
      await this.clock.flush();
    }
  }

  /** The participant's camera in the view on screen, or null (the opening frame). */
  camera(): Camera | null {
    return this.mapCamera && this.mapCamera.view === this.snap().currentCycle ? this.mapCamera.camera : null;
  }

  /** The plan form's draft for the view on screen (a new view starts empty, as `heldPlanDraft`). */
  planDraft(): PlanDraft {
    return this.plan.view === this.snap().currentCycle ? this.plan.draft : EMPTY_PLAN_DRAFT;
  }
  setPlanDraft(draft: PlanDraft): void { this.plan = { view: this.snap().currentCycle, draft }; }

  /** The freeze screen's state for the freeze on screen (a new freeze starts at its first item). */
  freezeState(): { index: number; drafts: Map<string, FreezeDraftFull> } {
    if (this.freezeUi.serial !== this.freezeSerial) this.freezeUi = { serial: this.freezeSerial, index: 0, drafts: new Map() };
    return this.freezeUi;
  }
}

/** A modal change: the view or a full-screen step changed, a freeze, probe or forced item opened. Busy costs stop there. */
export function interrupted(before: SessionSnapshot, now: SessionSnapshot): boolean {
  if (now.currentCycle !== before.currentCycle) return true;
  if (trainingChanged(before, now)) return true;
  if (now.tour !== before.tour) return true;
  const forced = (s: SessionSnapshot) => s.spam !== null && s.spam.phase !== "ready" && s.spam.forced;
  if (forced(now) && !forced(before)) return true;
  if (now.step === before.step) return false;
  const inView = (s: SessionSnapshot["step"]) => s === "exploration" || s === "allocation" || s === "awaiting_view_end";
  return !(inView(now.step) && inView(before.step));
}

/** Revision (bp): the training's screen moved on (an item's phase or the item: a card's window closing, the exposure ending, S5). */
export function trainingChanged(before: SessionSnapshot, now: SessionSnapshot): boolean {
  const a = trainingViewOf(before), b = trainingViewOf(now);
  return (a === null) !== (b === null) || (a !== null && b !== null && (a.phase !== b.phase || a.itemId !== b.itemId || a.sectionId !== b.sectionId));
}

/** `wait`'s rule: any change the participant would notice — a modal change, new messages, a SPAM prompt, the consult notice, the decision panel, the minimum. */
export function noticed(before: SessionSnapshot, now: SessionSnapshot): boolean {
  return interrupted(before, now) || now.step !== before.step || now.radioLog.length !== before.radioLog.length
    || (now.spam?.phase ?? null) !== (before.spam?.phase ?? null) || (now.consultPrompt !== null && before.consultPrompt === null)
    || now.minimumReached !== before.minimumReached || (now.recordsBadge && !before.recordsBadge);
}
