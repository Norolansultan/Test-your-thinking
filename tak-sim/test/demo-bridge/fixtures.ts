/**
 * Shared fixtures for the demo bridge's tests (`tools/demo-bridge/`): the bridge's data from the real scenario, the training's
 * corpus (revision (bp)) and frozen prompts, a fake `sample` capability that records each call, and a fake page (`BridgeWindow`) whose original fetch records
 * what passed through.
 */

import { vi } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { MANIFEST_FILE } from "../../server/thinker/config.js";
import { loadCheckedPrompts, readJson, type ManifestPrompts } from "../../server/thinker/deps.js";
import { bridgeDataOf, type DemoBridgeData } from "../../tools/demo-bridge/data.js";
import { bridgedFetch, type BridgeWindow } from "../../tools/demo-bridge/install.js";
import type { SampleFn, SampleInput, SampleOptions } from "../../tools/demo-bridge/sample-client.js";
import { TRAINING_FOR_TESTS } from "../retrieval/training-fixture.js";

export const scenario = buildDemoScenario();
/** Revision (bp): the training's corpus (the built one after the merge, the fixture before: `test/retrieval/training-fixture.ts`). */
export const training = TRAINING_FOR_TESTS;
export const data: DemoBridgeData = bridgeDataOf(scenario, loadCheckedPrompts(readJson<ManifestPrompts>(MANIFEST_FILE)), training);
/** The data file as the page would fetch it (through JSON, as published). */
export const dataJson = JSON.stringify(data);

export const startOf = (view: number) => (view === 0 ? scenario.practice.cycle : scenario.cycles.find((c) => c.index === view)!).startsAtVirtual;

export const HAKU = { sessionId: "demo-bridge-1", condition: "directed", cell: "radio", view: 9, virtualTimeS: startOf(9), question: "Missä palon pää on nyt?", queryId: "ai.1" } as const;
export const OPEN = { sessionId: "demo-bridge-1", condition: "substitutive", cell: "reasoning_intent", view: 9, virtualTimeS: startOf(9), question: "Mitä vaihtoehtoja minulla on?", queryId: "ai_open.2" } as const;

export const FOUR = { vastaus: "Pää on Koivuojan kohdalla.", perusteet: "[T1] klo 17.00.", varmuus: "todennäköinen", muuttaisi: "Uusi havainto päästä." };
export const OPTIONS_ANSWER = {
  kind: "options", unforeseen: null, premises: [], facts: [{ text: "Palo etenee itään.", tags: ["T1"] }], inference: null, questionsForYou: ["Missä linja pitää?"],
  options: [
    { option: "Suora hyökkäys", tradeoffs: "Nopea, lähellä päätä.", verdict: "fits", tags: ["T1"] },
    { option: "Puolustuslinja tielle", tradeoffs: "Hitaampi, pitää tien.", verdict: "departs", tags: ["T2"] },
  ],
};

export interface SampleCall { readonly verb: "json" | "text"; readonly input: SampleInput; readonly options: SampleOptions | undefined }

/** A fake `sample`: `answer` returns the parsed JSON (or text), or throws a `{code}` rejection. */
export function fakeSample(answer: (input: SampleInput, options: SampleOptions | undefined) => unknown) {
  const calls: SampleCall[] = [];
  const json = vi.fn(async (input: SampleInput, options?: SampleOptions) => { calls.push({ verb: "json", input, options }); return answer(input, options); });
  const text = vi.fn(async (input: SampleInput, options?: SampleOptions) => { calls.push({ verb: "text", input, options }); return { text: String(answer(input, options)), truncated: false }; });
  return { sample: Object.assign(text, { json }) as unknown as SampleFn, calls };
}

export const DATA_URL = "https://demo.example/demo-bridge/data.json";

/** A fake page: its original fetch serves `data.json` and answers 404 to anything else, recording every call. */
export function fakePage(claude: BridgeWindow["claude"], search = "") {
  const passed: { readonly input: unknown; readonly init: RequestInit | undefined }[] = [];
  const original = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === DATA_URL) return new Response(dataJson, { status: 200, headers: { "content-type": "application/json" } });
    passed.push({ input, init });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
  const win: BridgeWindow = { fetch: original, location: { href: `https://demo.example/index.html${search}`, search }, claude };
  return { win, original, passed, fetch: bridgedFetch(win, original, { dataUrl: DATA_URL, clock: { nowMs: () => 0, nowIso: () => "2026-10-23T00:00:00.000Z" } }) };
}

/** A runtime whose `use("sample")` resolves `sample` (or null). */
export const runtime = (sample: SampleFn | null): BridgeWindow["claude"] => ({ use: vi.fn(async (name: string) => (name === "sample" ? sample : null)) });

export const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
