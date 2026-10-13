/**
 * SPEC/28 §6: `npm run tak:export` — the scenario as Cursor-on-Target, for TAK clients, reviewers and
 * the domain experts (outside study runs). Writes `dist-tak/`:
 *
 * - `V00.cot.xml` … `V14.cot.xml`: one `<events>` document per view (the practice view is V00), both
 *   steps of a merged view, sorted by (`time`, `uid`);
 * - `scenario.cot.jsonl`: the timed stream, one event per line: `{"t": virtual seconds (0 = 13:20),
 *   "view", "uid", "xml"}`, sorted as above (what `tak:replay` sends);
 * - `packages/tak-sim-V00.zip` … `packages/tak-sim-V14.zip`: one TAK data package per view that ATAK,
 *   WinTAK or iTAK import as map items — the view's picture at its last step (a merged view's second
 *   step: units, aircraft, fire, projection, footprints, rate marks, the self marker) plus every
 *   GeoChat message of the view (both steps), one event per entry `<uid>/<uid>.cot` with a manifest
 *   `Content` and `uid` parameter for each (`datapackage.ts` `buildCotDataPackage`).
 *
 * The earlier single `tak-sim-datapackage.zip` (the fifteen `<events>` documents as plain contents) is
 * no longer written: TAK clients dispatch only one-event `.cot` entries with a `uid` parameter as map
 * items, so it did not import. A stale copy from an earlier export is removed.
 *
 * Two runs are byte-identical (I1; `test/tak/export.spec.ts`).
 *
 * The session walk ({@link sessionCotInputs}) drives the render tree (`applyRenderEvent`, the I4 type
 * boundary) over the scenario exactly as the orchestrator does — the view's start, its projection,
 * the first step's reports, a merged view's step boundary and its second step's reports — and hands
 * the compiler only what the tree holds: `Renderable*` values, never the scenario's truth.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderableAtom } from "../../app/boundary/render-boundary.js";
import { applyRenderEvent, EMPTY_RENDER_TREE, type RenderTree } from "../../app/render/render-tree.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { batteryTimeline, DRONE_BATTERY } from "../../app/scenario/drone-battery.js";
import type { InfoAtom, ScenarioContract, ViewEnvelope, ViewSpec } from "../../app/scenario/types.js";
import { serializeCot, serializeCotDocument, serializeCotEvents, type CotEvent } from "../../app/tak/cot.js";
import { compileSessionCot, COT_STEP_SECONDS, viewLabel, type CotChatLine, type DeliveredBubble, type ViewCotInput } from "../../app/tak/compile.js";
import { virtualOfIso } from "../../app/tak/time.js";
import { buildCotDataPackage } from "./datapackage.js";

export const DEFAULT_OUT_DIR = "dist-tak";
export const STREAM_FILE = "scenario.cot.jsonl";
/** The per-view data packages' directory inside the output directory. */
export const PACKAGES_DIR = "packages";
/** The single package of the first export layout; removed if found (see the header). */
export const LEGACY_DATA_PACKAGE_FILE = "tak-sim-datapackage.zip";

/** `packages/tak-sim-V07.zip`. */
export function viewPackageFile(view: string): string {
  return `${PACKAGES_DIR}/tak-sim-${view}.zip`;
}

/** A view package's name in the manifest and in a TAK client's list: `TAK-SIM V07`. */
export function viewPackageName(view: string): string {
  return `TAK-SIM ${view}`;
}

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

/**
 * A view's package content: its picture at its last step (every map object's event of that step) and
 * every GeoChat message of the view, both steps. One event per uid (a uid twice is refused when packed).
 */
export function viewSnapshotEvents(events: readonly CotEvent[], view: string): CotEvent[] {
  const ofView = events.filter((e) => e.detail.taksim.view === view);
  const mapObjects = ofView.filter((e) => e.detail.taksim.kind !== "chat");
  const lastStep = mapObjects.reduce((max, e) => Math.max(max, e.detail.taksim.step), 0);
  return ofView.filter((e) => e.detail.taksim.kind === "chat" || e.detail.taksim.step === lastStep);
}

export interface TakExport {
  readonly dir: string;
  /** Written file paths relative to `dir`, in write order. */
  readonly files: readonly string[];
  readonly events: number;
  /** Each view's package: its file, manifest uid and number of events. */
  readonly packages: readonly { readonly view: string; readonly file: string; readonly uid: string; readonly events: number }[];
}

/** Writes the export into `outDir` (created if missing; other files in it are left alone, except the legacy single package). */
export function exportTak(outDir: string = DEFAULT_OUT_DIR, scenario: ScenarioContract = buildDemoScenario()): TakExport {
  const dir = resolve(outDir);
  mkdirSync(join(dir, PACKAGES_DIR), { recursive: true });
  rmSync(join(dir, LEGACY_DATA_PACKAGE_FILE), { force: true });
  const events = compileScenarioCot(scenario);

  const views = [scenario.practice.cycle.index, ...scenario.cycles.map((c) => c.index)].sort((a, b) => a - b).map(viewLabel);
  const written: string[] = [];
  for (const view of views) {
    const name = `${view}.cot.xml`;
    writeFileSync(join(dir, name), serializeCotEvents(events.filter((e) => e.detail.taksim.view === view)));
    written.push(name);
  }
  writeFileSync(join(dir, STREAM_FILE), cotJsonLines(events));
  written.push(STREAM_FILE);

  const packages = views.map((view) => {
    const snapshot = viewSnapshotEvents(events, view);
    const pkg = buildCotDataPackage({ name: viewPackageName(view), items: snapshot.map((e) => ({ uid: e.uid, document: serializeCotDocument(e) })) });
    const file = viewPackageFile(view);
    writeFileSync(join(dir, file), pkg.zip);
    written.push(file);
    return { view, file, uid: pkg.uid, events: snapshot.length };
  });
  return { dir, files: written, events: events.length, packages };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = exportTak(process.argv[2] ?? DEFAULT_OUT_DIR);
  console.log(`tak:export: ${out.events} CoT events, ${out.files.length} files -> ${out.dir}`);
  for (const f of out.files) {
    const pkg = out.packages.find((p) => p.file === f);
    console.log(pkg ? `  ${f}  (${pkg.events} events, uid ${pkg.uid})` : `  ${f}`);
  }
}
