/**
 * DEMONSTRATION ONLY. The data file the page-side bridge reads (`data.json`, published beside `bridge.js`): the parts of the
 * scenario the proxy's handler reads in lexical-only mode — the records (the lexical half's passages), the views' clocks, the
 * phase-A intent and the directive text, the sectors and the units on scene — and the six frozen prompts of Haku's chat and the
 * Open Thinker. Nothing else: no premise-evidence table, no directive premises, no freeze items or keys, no projections, no truth
 * (`test/demo-bridge/leaks.spec.ts` scans the built files).
 */

import type { InfoAtom, ScenarioContract } from "../../app/scenario/types.js";
import type { SystemPrompt } from "../../server/thinker/config.js";
import type { ThinkerDeps } from "../../server/thinker/handler.js";

export const DEMO_BRIDGE_DATA_FORMAT = "tak-sim-demo-bridge-data";
export const DEMO_BRIDGE_DATA_VERSION = 1;
/** The data file's name, beside `bridge.js`. */
export const DEMO_BRIDGE_DATA_FILE = "data.json";

/** The prompts the bridge answers with (the strategy-guided one was withdrawn on 8 Oct 2026; no request uses it). */
export const BRIDGE_PROMPT_KEYS = ["prompt", "promptEn", "promptOpen", "promptOpenEn", "promptOpenOnce", "promptOpenOnceEn"] as const;
export type BridgePrompts = { readonly [K in (typeof BRIDGE_PROMPT_KEYS)[number]]: SystemPrompt };

/** A record as the handler reads it: no `truth`, no `consequence`, no reviewer notes on its degradation. */
export type BridgeAtom = Pick<InfoAtom, "id" | "tier" | "cycle" | "record" | "provenance"> & { readonly degradation: readonly { readonly form: InfoAtom["degradation"][number]["form"] }[] };

interface BridgeView { readonly index: number; readonly phase: string; readonly startsAtVirtual: number; readonly steps: number }

/** What the handler reads of the scenario (`server/thinker/handler.ts`, `model.ts`): see the module comment. */
export interface BridgeScenario {
  readonly atoms: readonly BridgeAtom[];
  readonly cycles: readonly BridgeView[];
  readonly practice: { readonly cycle: BridgeView };
  readonly hinge: { readonly intentStatement: string };
  /** The phase-A intent only (P2's V1 message, `intentBlockOf`). */
  readonly dutyOfficerMessages: readonly Pick<ScenarioContract["dutyOfficerMessages"][number], "cycle" | "at" | "text" | "isStrategicGuidance" | "expectsReply">[];
  readonly allocationSpace: { readonly sectors: readonly { readonly id: string; readonly label: string }[]; readonly assets: ScenarioContract["allocationSpace"]["assets"] };
}

export interface DemoBridgeData {
  readonly format: typeof DEMO_BRIDGE_DATA_FORMAT;
  readonly version: typeof DEMO_BRIDGE_DATA_VERSION;
  readonly scenario: BridgeScenario;
  readonly prompts: BridgePrompts;
}

const viewOf = (v: BridgeView): BridgeView => ({ index: v.index, phase: v.phase, startsAtVirtual: v.startsAtVirtual, steps: v.steps });

/** The data file's content, from the scenario and the frozen prompts (the build checks the prompts against the manifest first). */
export function bridgeDataOf(scenario: ScenarioContract, prompts: Pick<ThinkerDeps, (typeof BRIDGE_PROMPT_KEYS)[number]>): DemoBridgeData {
  const picked = Object.fromEntries(BRIDGE_PROMPT_KEYS.map((k) => {
    const p = prompts[k];
    if (!p) throw new Error(`demo bridge: the prompt ${k} is not loaded`);
    return [k, { text: p.text, sha256: p.sha256 }];
  })) as BridgePrompts;
  return {
    format: DEMO_BRIDGE_DATA_FORMAT,
    version: DEMO_BRIDGE_DATA_VERSION,
    scenario: {
      atoms: scenario.atoms.map((a) => ({ id: a.id, tier: a.tier, cycle: a.cycle, record: a.record, provenance: a.provenance, degradation: a.degradation.map((d) => ({ form: d.form })) })),
      cycles: scenario.cycles.map(viewOf),
      practice: { cycle: viewOf(scenario.practice.cycle) },
      hinge: { intentStatement: scenario.hinge.intentStatement },
      dutyOfficerMessages: scenario.dutyOfficerMessages.filter((m) => !m.isStrategicGuidance && m.cycle === 1)
        .map((m) => ({ cycle: m.cycle, at: m.at, text: m.text, isStrategicGuidance: m.isStrategicGuidance, expectsReply: m.expectsReply })),
      allocationSpace: { sectors: scenario.allocationSpace.sectors.map((s) => ({ id: s.id, label: s.label })), assets: scenario.allocationSpace.assets },
    },
    prompts: picked,
  };
}

/** The parsed file, checked enough that a wrong or stale file is refused rather than half used. */
export function parseBridgeData(json: unknown): DemoBridgeData {
  const d = json as Partial<DemoBridgeData> | null;
  if (!d || d.format !== DEMO_BRIDGE_DATA_FORMAT || d.version !== DEMO_BRIDGE_DATA_VERSION) throw new Error("demo bridge: data.json is not this bridge's data file");
  if (!d.scenario || !Array.isArray(d.scenario.atoms) || !Array.isArray(d.scenario.cycles) || !d.prompts) throw new Error("demo bridge: data.json lacks the scenario or the prompts");
  for (const k of BRIDGE_PROMPT_KEYS) if (typeof d.prompts[k]?.text !== "string") throw new Error(`demo bridge: data.json lacks the prompt ${k}`);
  return d as DemoBridgeData;
}

/** The reduced scenario as the handler's type: it reads only the fields kept here. */
export const scenarioOfBridge = (s: BridgeScenario): ScenarioContract => s as unknown as ScenarioContract;
