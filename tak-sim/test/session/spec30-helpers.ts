/**
 * Shared steps for the SPEC/30 session specs (consult notification, suggested question, plan confidence, end-of-view
 * freeze, second SPAM item): a session in a chosen cell brought to a view's start, a sink that can hold its writes
 * (I5 checks), and record lookups.
 */

import { vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import type { Cell, ScenarioContract } from "../../app/scenario/types.js";
import { SessionOrchestrator, type SessionOptions, type SessionSnapshot } from "../../app/session/orchestrator.js";
import { conditionOfCell } from "../../app/session/preview.js";
import { InMemoryLogSink, type LogRecord, type LogSink } from "../../app/telemetry/log.js";
import { allocateAndConfirm, passHinge, runOutView } from "./view-flow.js";

export const scenario = buildDemoScenario();

/** A sink whose writes wait while it is held (a slow IndexedDB commit). */
export class HeldSink implements LogSink {
  private readonly inner = new InMemoryLogSink();
  private held = false;
  private waiting: (() => void)[] = [];
  hold(): void { this.held = true; }
  release(): void { this.held = false; const w = this.waiting; this.waiting = []; for (const f of w) f(); }
  async append(record: LogRecord): Promise<void> {
    if (this.held) await new Promise<void>((resolve) => this.waiting.push(resolve));
    await this.inner.append(record);
  }
  readAll() { return this.inner.readAll(); }
}

export interface Running {
  readonly o: SessionOrchestrator;
  readonly snap: () => SessionSnapshot;
}

/** A session of `cell` (the Haku group by default) over `s`, started: VP on screen. */
export async function startSession(cell: Cell = "radio", options: SessionOptions = {}, s: ScenarioContract = scenario): Promise<Running> {
  const o = new SessionOrchestrator(s, conditionOfCell(cell), { participantCode: "P-30", cell, ...options });
  const box: { snap: SessionSnapshot | null } = { snap: null };
  o.subscribe((x) => (box.snap = x));
  await o.start();
  return { o, snap: () => box.snap! };
}

/** Answers the visible probe on screen (V13's area item, V14's after-view items), if any. */
export async function answerVisibleProbe({ o, snap }: Running): Promise<boolean> {
  const p = snap().visibleProbe;
  if (!p) return false;
  if (p.kind === "area") await o.submitProbeArea(false, []);
  else if (p.kind === "choice") await o.submitProbeChoice(p.options[0]!.id, p.collectsConfidence ? 50 : undefined);
  else await o.submitProbeScale(50);
  return true;
}

/** A main view's time run out to its minimum: a freeze, a SPAM item and a visible probe answered on the way. */
async function runOutMain(r: Running): Promise<void> {
  const { o, snap } = r;
  const view = snap().currentCycle;
  while (snap().currentCycle === view && !(snap().minimumReached && snap().spam === null && snap().visibleProbe === null)) {
    if (await answerVisibleProbe(r)) continue;
    const spam = snap().spam;
    if (spam?.phase === "ready") { await o.spamReady(); continue; }
    if (spam?.phase === "item") { await o.answerSpam(spam.options[0]!.id); continue; }
    if (spam?.phase === "confidence") { await o.submitSpamConfidence(50); continue; }
    if (snap().step === "freeze") { await o.submitFreeze([]); continue; }
    await vi.advanceTimersByTimeAsync(1_000);
  }
}

/** Completes the view on screen (its time run out, the plan, its confidence, an end-of-view freeze, after-view probes), the training and the hinge after it. */
export async function completeView(r: Running): Promise<void> {
  const { o, snap } = r;
  if (snap().practice) await runOutView(o, snap); else await runOutMain(r);
  await allocateAndConfirm(o, snap);
  while (await answerVisibleProbe(r)) { /* V14's after-view probes */ }
  if (snap().step === "training") await o.completeTraining();
  if (snap().step === "hinge_pause") await passHinge(o);
}

/** A session brought to `view`'s start (its clock at 0). */
export async function atView(view: number, cell: Cell = "radio", options: SessionOptions = {}, s: ScenarioContract = scenario): Promise<Running> {
  const r = await startSession(cell, options, s);
  while (r.snap().currentCycle !== view) await completeView(r);
  return r;
}

/** A session brought to the hinge screen (V7 completed, the hinge not yet passed; SPEC/15 (bf)'s fatigue item). */
export async function atHinge(cell: Cell = "radio", options: SessionOptions = {}, s: ScenarioContract = scenario): Promise<Running> {
  const r = await atView(7, cell, options, s);
  await runOutMain(r);
  await allocateAndConfirm(r.o, r.snap);
  return r;
}

/** Lets every pending microtask and zero-delay timer run. */
export const settle = () => vi.advanceTimersByTimeAsync(0);

export const ofKind = (records: readonly LogRecord[], kind: string, cycle?: number) =>
  records.filter((r) => r.kind === kind && (cycle === undefined || (r.detail as { cycle?: number }).cycle === cycle));

export const indexOfKind = (records: readonly LogRecord[], kind: string, cycle: number) =>
  records.findIndex((r) => r.kind === kind && (r.detail as { cycle?: number }).cycle === cycle);
