/**
 * SPEC/28 §6: `npm run tak:export` — the scenario as Cursor-on-Target, for TAK clients, reviewers and
 * the domain experts (outside study runs). Writes `dist-tak/`:
 *
 * - `V00.cot.xml` … `V14.cot.xml`: one `<events>` document per view (the practice view is V00), both
 *   steps of a merged view, sorted by (`time`, `uid`);
 * - `scenario.cot.jsonl`: the timed stream, one event per line: `{"t": virtual seconds (0 = 13:20),
 *   "view", "uid", "xml"}`, sorted as above (what `tak:replay` sends);
 * - `tak-sim-datapackage.zip`: a TAK data package, `MANIFEST/manifest.xml` + the fifteen view files.
 *
 * Two runs are byte-identical (I1; `test/tak/export.spec.ts`).
 *
 * The session walk ({@link sessionCotInputs}) drives the render tree (`applyRenderEvent`, the I4 type
 * boundary) over the scenario exactly as the orchestrator does — the view's start, its projection,
 * the first step's reports, a merged view's step boundary and its second step's reports — and hands
 * the compiler only what the tree holds: `Renderable*` values, never the scenario's truth.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderableAtom } from "../../app/boundary/render-boundary.js";
import { applyRenderEvent, EMPTY_RENDER_TREE, type RenderTree } from "../../app/render/render-tree.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { batteryTimeline, DRONE_BATTERY } from "../../app/scenario/drone-battery.js";
import type { InfoAtom, ScenarioContract, ViewEnvelope, ViewSpec } from "../../app/scenario/types.js";
import { serializeCot, serializeCotEvents, type CotEvent } from "../../app/tak/cot.js";
import { compileSessionCot, COT_STEP_SECONDS, viewLabel, type CotChatLine, type DeliveredBubble, type ViewCotInput } from "../../app/tak/compile.js";
import { virtualOfIso } from "../../app/tak/time.js";
import { buildDataPackage } from "./datapackage.js";

export const DEFAULT_OUT_DIR = "dist-tak";
export const DATA_PACKAGE_FILE = "tak-sim-datapackage.zip";
export const STREAM_FILE = "scenario.cot.jsonl";

/** Who the duty officer's messages are from (`app/session/orchestrator.ts` DUTY_OFFICER_ID). */
const DUTY_OFFICER_ID = "P2";

function stepStartOf(input: ViewCotInput): number {
  return input.cycle.startsAtVirtual + (input.cycle.stepShown - 1) * COT_STEP_SECONDS;
}

/**
 * Every view step of the session as compiler input, in session order: VP (V00), then V1–V14, each
 * merged view as two steps. Battery levels come from the drone battery model (`drone-battery.ts`, the
 * model the drones' own battery reports read), over the steps each drone is on the map.
 */
export function sessionCotInputs(scenario: ScenarioContract = buildDemoScenario()): ViewCotInput[] {
  const atomsById = new Map<string, InfoAtom>(scenario.atoms.map((a) => [a.id, a]));
  const views: { readonly spec: ViewSpec; readonly envelope: ViewEnvelope | undefined }[] = [
    { spec: scenario.practice.cycle, envelope: scenario.practice.envelope },
    ...[...scenario.cycles].sort((a, b) => a.index - b.index).map((c) => ({ spec: c as ViewSpec, envelope: scenario.envelopes.find((e) => e.cycle === c.index) })),
  ];

  const inputs: ViewCotInput[] = [];
  for (const { spec, envelope } of views) {
    let tree: RenderTree = applyRenderEvent(EMPTY_RENDER_TREE, { kind: "cycle_start", cycle: spec });
    if (envelope) tree = applyRenderEvent(tree, { kind: "envelope_revealed", envelope });

    /** Delivers the pushed items whose offset into the view falls in [from, to), as the orchestrator's `deliverPushed` does. */
    const deliver = (from: number, to: number): DeliveredBubble[] => {
      const out: DeliveredBubble[] = [];
      spec.pushedAtomIds.forEach((id, k) => {
        const offset = spec.deliveryOffsetsSeconds[k]!;
        if (offset < from || offset >= to) return;
        const atom = atomsById.get(id);
        if (!atom) throw new Error(`view ${spec.index} pushes unknown atom ${id}`);
        tree = applyRenderEvent(tree, { kind: "bubble_delivered", atom });
        const renderable: RenderableAtom = tree.bubbles[tree.bubbles.length - 1]!;
        out.push({ atom: renderable, deliveredAtVirtual: spec.startsAtVirtual + offset });
      });
      return out;
    };

    // The duty officer's messages open their view (the intent at V1, the directive at V8); not in the practice view.
    const chatLines: CotChatLine[] = spec.index === 0 ? [] : scenario.dutyOfficerMessages
      .filter((m) => m.cycle === spec.index)
      .map((m) => ({ id: m.isStrategicGuidance ? scenario.hinge.guidanceMessageId : `duty.cycle_${spec.index}`, sourceId: DUTY_OFFICER_ID, atVirtual: m.at, text: m.text }));

    const first = deliver(0, spec.stepBoundary ? COT_STEP_SECONDS : Infinity);
    inputs.push({ cycle: tree.cycleInfo!, envelope: tree.envelope, bubbles: first, chatLines });
    if (spec.stepBoundary) {
      tree = applyRenderEvent(tree, { kind: "step_boundary", cycle: spec });
      const second = deliver(COT_STEP_SECONDS, Infinity);
      inputs.push({ cycle: tree.cycleInfo!, envelope: tree.envelope, bubbles: second });
    }
  }

  // The drones' battery at each step's start, from the steps each is on the map (main steps only, as `allocation.ts` reads it).
  const flown = new Map<string, number[]>();
  for (const input of inputs) {
    const step = Math.round(stepStartOf(input) / COT_STEP_SECONDS) + 1;
    if (step < 1) continue;
    for (const a of input.cycle.aircraft) {
      if (!DRONE_BATTERY[a.platformId]) continue;
      flown.set(a.platformId, [...(flown.get(a.platformId) ?? []), step]);
    }
  }
  const timelines = new Map([...flown.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, steps]) => [id, batteryTimeline(id, steps)]));
  return inputs.map((input) => {
    const batteryPct: Record<string, number | null> = {};
    for (const a of input.cycle.aircraft) {
      const timeline = timelines.get(a.platformId);
      if (timeline) batteryPct[a.platformId] = timeline.levelAt(stepStartOf(input));
    }
    return { ...input, batteryPct };
  });
}

/** The whole session's CoT, sorted by (`time`, `uid`). */
export function compileScenarioCot(scenario: ScenarioContract = buildDemoScenario()): CotEvent[] {
  return compileSessionCot(sessionCotInputs(scenario));
}

/** The timed stream: one JSON object per line, keys in a fixed order. */
export function cotJsonLines(events: readonly CotEvent[]): string {
  return events.map((e) => `${JSON.stringify({ t: virtualOfIso(e.time), view: e.detail.taksim.view, uid: e.uid, xml: serializeCot(e) })}\n`).join("");
}

export interface TakExport {
  readonly dir: string;
  /** Written file names, in write order. */
  readonly files: readonly string[];
  readonly events: number;
  readonly packageUid: string;
}

/** Writes the export into `outDir` (created if missing; other files in it are left alone). */
export function exportTak(outDir: string = DEFAULT_OUT_DIR, scenario: ScenarioContract = buildDemoScenario()): TakExport {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const events = compileScenarioCot(scenario);
  const encoder = new TextEncoder();

  const viewIndices = [scenario.practice.cycle.index, ...scenario.cycles.map((c) => c.index)].sort((a, b) => a - b);
  const viewFiles = viewIndices.map((index) => {
    const label = viewLabel(index);
    return { name: `${label}.cot.xml`, text: serializeCotEvents(events.filter((e) => e.detail.taksim.view === label)) };
  });
  const written: string[] = [];
  for (const f of viewFiles) {
    writeFileSync(join(dir, f.name), f.text);
    written.push(f.name);
  }
  writeFileSync(join(dir, STREAM_FILE), cotJsonLines(events));
  written.push(STREAM_FILE);

  const pkg = buildDataPackage({
    name: `tak-sim ${scenario.id} ${scenario.version}`,
    files: viewFiles.map((f) => ({ name: f.name, data: encoder.encode(f.text) })),
  });
  writeFileSync(join(dir, DATA_PACKAGE_FILE), pkg.zip);
  written.push(DATA_PACKAGE_FILE);
  return { dir, files: written, events: events.length, packageUid: pkg.uid };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = exportTak(process.argv[2] ?? DEFAULT_OUT_DIR);
  console.log(`tak:export: ${out.events} CoT events, ${out.files.length} files -> ${out.dir}`);
  for (const f of out.files) console.log(`  ${f}`);
  console.log(`  data package uid ${out.packageUid}`);
}
