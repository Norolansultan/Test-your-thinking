/**
 * SPEC/14 revision (v): the proxy picks the retrieval by the request's language and never mixes.
 * English with the English index → hybrid over it; without it → refused (HTTP 503) or, in the
 * declared demonstration fallback, the whole Finnish treatment logged as `hybrid_fi_fallback`; a
 * lexical-only proxy → the English lexical half. At startup a study-mode proxy refuses to start
 * without a built, declared and frozen English index. All without the English vector index.
 */

import { describe, expect, it } from "vitest";
import { vectorIndexOf, type VectorIndexFile } from "../../app/retrieval/hybrid.js";
import { INDEX_FILE_EN, loadSystemPrompt, serverModeOf, sha256Hex } from "../../server/thinker/config.js";
import { englishStartup } from "../../server/thinker/deps.js";
import { handleThinkerRequest, retrievalRoute, type ThinkerDeps } from "../../server/thinker/handler.js";
import { buildIndexText } from "../../tools/thinker/index-build.js";
import { frozenEmbedder, scenario, vectorIndex } from "../engine/thinker-fixtures.js";
import { stubEmbedder } from "../retrieval/stub-embedder.js";

const V6_START = scenario.cycles.find((c) => c.index === 6)!.startsAtVirtual;
const BASE = { sessionId: "en-1", condition: "substitutive", view: 6, virtualTimeS: V6_START, cell: "reasoning_once" };
const FI_Q = "onko 20 kV linja jännitteetön?"; // an authored question: its frozen vector exists (SPEC/33 (bc): was 110 kV)

function deps(over: Partial<ThinkerDeps>, logs: Record<string, unknown>[] = []): ThinkerDeps {
  return {
    scenario, vector: { embedder: frozenEmbedder, index: vectorIndex }, prompt: loadSystemPrompt(), promptEn: loadSystemPrompt("en"), client: null,
    appendLog: async (_id, line) => void logs.push(line), nowMs: () => 0, nowIso: () => "2026-10-05T00:00:00.000Z", ...over,
  };
}

describe("retrievalRoute", () => {
  const fiVector = { embedder: frozenEmbedder, index: vectorIndex };

  it("Finnish is unchanged: the Finnish index, or lexical alone", () => {
    expect(retrievalRoute(deps({}), "fi")).toMatchObject({ ok: true, lang: "fi", mode: "hybrid", indexFile: "content/thinker/index.json" });
    expect(retrievalRoute(deps({ vector: null }), "fi")).toMatchObject({ ok: true, lang: "fi", mode: "lexical_only", vector: null });
  });

  it("English without the English index is refused by default", () => {
    expect(retrievalRoute(deps({}), "en")).toMatchObject({ ok: false });
    expect(retrievalRoute(deps({ vectorEn: null, englishWithoutIndex: "refuse" }), "en")).toMatchObject({ ok: false });
  });

  it("English without the English index, demonstration fallback: the whole Finnish treatment, named", () => {
    const r = retrievalRoute(deps({ englishWithoutIndex: "fi_index" }), "en");
    expect(r).toMatchObject({ ok: true, lang: "fi", mode: "hybrid_fi_fallback", indexFile: "content/thinker/index.json" });
    expect(r.ok && r.vector?.index.language).toBe("fi");
  });

  it("English on a lexical-only proxy: the English lexical half", () => {
    expect(retrievalRoute(deps({ vector: null, englishWithoutIndex: "fi_index" }), "en")).toMatchObject({ ok: true, lang: "en", mode: "lexical_only", vector: null });
  });

  it("English with the English index: hybrid over it", async () => {
    const file = JSON.parse((await buildIndexText(scenario.atoms, stubEmbedder, "en", 26)).text) as VectorIndexFile;
    const en = { embedder: stubEmbedder, index: vectorIndexOf(file) };
    const r = retrievalRoute(deps({ vector: fiVector, vectorEn: en }), "en");
    expect(r).toMatchObject({ ok: true, lang: "en", mode: "hybrid", indexFile: INDEX_FILE_EN });
    expect(r.ok && r.vector?.index.language).toBe("en");
  });
});

describe("the handler by language", () => {
  it("refuses an English request with 503 when the English index is not loaded (default)", async () => {
    const logs: Record<string, unknown>[] = [];
    const res = await handleThinkerRequest(deps({}, logs), { ...BASE, question: FI_Q, language: "en" });
    expect(res.status).toBe(503);
    expect(res.status !== 200 && res.body.error).toMatch(/index\.en\.json/);
    expect(logs).toHaveLength(0);
  });

  it("demonstration fallback: answers over the Finnish index and says so in the response and the log", async () => {
    const logs: Record<string, unknown>[] = [];
    const res = await handleThinkerRequest(deps({ englishWithoutIndex: "fi_index" }, logs), { ...BASE, question: FI_Q, language: "en" });
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body).toMatchObject({ retrievalMode: "hybrid_fi_fallback", retrievalLanguage: "fi" });
    expect(logs[0]).toMatchObject({ retrievalMode: "hybrid_fi_fallback", retrievalLanguage: "fi", retrievalIndex: "content/thinker/index.json", language: "en" });
    // The answer and prompt are still English; only retrieval fell back.
    expect(res.body.promptHash).toBe(loadSystemPrompt("en").sha256);
  });

  it("a lexical-only proxy retrieves an English question over the English passages", async () => {
    const logs: Record<string, unknown>[] = [];
    const res = await handleThinkerRequest(deps({ vector: null }, logs), { ...BASE, question: "Is the 20 kV line de-energised?", language: "en" });
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body).toMatchObject({ retrievalMode: "lexical_only", retrievalLanguage: "en" });
    expect(res.body.retrieved[0]!.id).toBe("f7.planted_record");
    expect(logs[0]).toMatchObject({ retrievalIndex: null, retrievalLanguage: "en", embedderId: null });
  });

  it("with an English index, retrieves in English (hybrid) and logs the English index", async () => {
    const file = JSON.parse((await buildIndexText(scenario.atoms, stubEmbedder, "en", 26)).text) as VectorIndexFile;
    const logs: Record<string, unknown>[] = [];
    const d = deps({ vector: { embedder: stubEmbedder, index: vectorIndexOf({ ...file, language: "fi", atoms: [] }) }, vectorEn: { embedder: stubEmbedder, index: vectorIndexOf(file) } }, logs);
    const res = await handleThinkerRequest(d, { ...BASE, question: "Is the 20 kV line de-energised?", language: "en" });
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    expect(res.body).toMatchObject({ retrievalMode: "hybrid", retrievalLanguage: "en" });
    expect(logs[0]).toMatchObject({ retrievalIndex: INDEX_FILE_EN, embedderId: "stub/letters-26" });
  });

  it("Finnish requests are unchanged", async () => {
    const logs: Record<string, unknown>[] = [];
    const res = await handleThinkerRequest(deps({ englishWithoutIndex: "fi_index" }, logs), { ...BASE, question: FI_Q });
    expect(res.status === 200 && res.body).toMatchObject({ retrievalMode: "hybrid", retrievalLanguage: "fi" });
    expect(res.status === 200 && res.body.retrieved[0]!.id).toBe("f7.planted_record");
  });
});

describe("startup: study refuses, demonstration falls back and says so", () => {
  const manifest = { indexEn: { sha256: "x" }, retrievalEn: { neutralEval: { status: "frozen" } } };
  const embedderId = "stub/letters-26";

  it("study mode without index.en.json refuses to start, naming the build and freeze commands", () => {
    expect(() => englishStartup({ mode: "study", lexicalOnly: false, indexEnText: null, manifest: {}, embedderId })).toThrow(/study mode: content\/thinker\/index\.en\.json is absent.*npm run thinker:index -- --lang en`.*thinker:eval -- --lang en --write.*DEPLOYMENT/);
  });

  it("study mode refuses --lexical-only", () => {
    expect(() => englishStartup({ mode: "study", lexicalOnly: true, indexEnText: null, manifest: {}, embedderId: null })).toThrow(/lexical-only/);
  });

  it("demonstration mode without index.en.json: the Finnish-index fallback, announced", () => {
    const s = englishStartup({ mode: "demo", lexicalOnly: false, indexEnText: null, manifest: {}, embedderId });
    expect(s).toMatchObject({ indexEn: null, englishWithoutIndex: "fi_index" });
    expect(s.notice).toMatch(/ABSENT.*hybrid_fi_fallback/);
  });

  it("a present index must be English, from the loaded embedder, the manifest's, and frozen (study)", async () => {
    const text = (await buildIndexText(scenario.atoms.slice(0, 10), stubEmbedder, "en", 26)).text;
    const ok = { indexEn: { sha256: sha256Hex(text) }, retrievalEn: { neutralEval: { status: "frozen" } } };
    expect(englishStartup({ mode: "study", lexicalOnly: false, indexEnText: text, manifest: ok, embedderId }).indexEn?.language).toBe("en");
    expect(() => englishStartup({ mode: "study", lexicalOnly: false, indexEnText: text, manifest, embedderId })).toThrow(/not the manifest's indexEn/);
    expect(() => englishStartup({ mode: "study", lexicalOnly: false, indexEnText: text, manifest: { indexEn: ok.indexEn }, embedderId })).toThrow(/not frozen/);
    expect(() => englishStartup({ mode: "demo", lexicalOnly: false, indexEnText: text, manifest: ok, embedderId: "other" })).toThrow(/cannot be used/);
    const fiText = (await buildIndexText(scenario.atoms.slice(0, 10), stubEmbedder, "fi", 26)).text;
    expect(() => englishStartup({ mode: "demo", lexicalOnly: false, indexEnText: fiText, manifest: ok, embedderId })).toThrow(/language/);
    const demo = englishStartup({ mode: "demo", lexicalOnly: false, indexEnText: text, manifest, embedderId });
    expect(demo.notice).toMatch(/NOT the declared treatment/);
  });

  it("the mode comes from --study or THINKER_MODE=study; the default is demonstration", () => {
    expect(serverModeOf(["node", "main.ts"], {})).toBe("demo");
    expect(serverModeOf(["node", "main.ts", "--study"], {})).toBe("study");
    expect(serverModeOf([], { THINKER_MODE: "study" })).toBe("study");
  });
});
