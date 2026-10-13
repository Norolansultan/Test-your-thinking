/**
 * SPEC/14 revision (v): the English neutral evaluation. The English questions are the Finnish ones
 * item for item with the same needs, ask nothing about the designed events, and the runner's
 * scoring path (the proxy's retrieval, the same candidates and rule) runs on a stub embedder with
 * an English index built in memory — no model, no English index file.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THINKER_RETRIEVAL_CONFIG_EN, vectorIndexOf, type VectorIndexFile } from "../../app/retrieval/hybrid.js";
import { embeddingWith, gateStepOfView, langArg, loadCorpus, loadQueryEmbedding, retrieveAtView, scenario } from "../../tools/thinker/eval-common.js";
import { buildIndexText } from "../../tools/thinker/index-build.js";
import {
  CANDIDATE_CONFIGS, englishQuestions, evaluateCandidates, resolveNeed, sameConfig, selectConfig, type NeutralEvalEnFile, type NeutralEvalFile,
} from "../../tools/thinker/neutral-eval.js";
import { englishRetrievalBlock } from "../../tools/thinker/retrieval-manifest.js";
import { stubEmbedder } from "./stub-embedder.js";

const read = <T>(p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8")) as T;
const fi = read<NeutralEvalFile>("content/thinker/neutral-eval.json");
const en = read<NeutralEvalEnFile>("content/thinker/neutral-eval.en.json");

describe("the English neutral set", () => {
  it("translates the 34 Finnish questions item for item and takes their needs", () => {
    const qs = englishQuestions(fi, en);
    expect(qs).toHaveLength(fi.questions.length);
    expect(en.needsFrom).toBe("content/thinker/neutral-eval.json");
    qs.forEach((q, i) => {
      expect(q).toMatchObject({ id: fi.questions[i]!.id, topic: fi.questions[i]!.topic, view: fi.questions[i]!.view, needs: fi.questions[i]!.needs });
      expect(q.question).not.toBe(fi.questions[i]!.question);
    });
  });

  it("refuses an English set that is not the Finnish one item for item", () => {
    expect(() => englishQuestions(fi, { ...en, questions: en.questions.slice(1) })).toThrow(/item for item/);
    expect(() => englishQuestions(fi, { ...en, questions: [...en.questions].reverse() })).toThrow(/item for item/);
  });

  it("asks nothing about the designed events", () => {
    for (const q of en.questions) expect(q.question).not.toMatch(/\bbog\b|Rahkasuo|smoulder|\b110\b|\bkV\b|power ?line|energi|F7|north edge|point of origin/i);
  });
});

describe("the runner (stub embedder, English index built in memory)", () => {
  it("--lang picks the language", () => {
    expect(langArg([])).toBe("fi");
    expect(langArg(["--lang", "en"])).toBe("en");
    expect(langArg(["--lang=en", "--write"])).toBe("en");
    expect(() => langArg(["--lang", "sv"])).toThrow();
  });

  it("without index.en.json the English run is lexical-only and says why", async () => {
    const e = await loadQueryEmbedding(false, "en", () => null); // as if index.en.json had not been built
    expect(e.mode).toBe("lexical_only");
    expect(e.reason).toMatch(/index\.en\.json is absent/);
  });

  it("scores every declared candidate with the same rule, deterministically", async () => {
    const qs = englishQuestions(fi, en).slice(0, 6);
    const corpus = loadCorpus();
    const resolved = qs.map((q) => q.needs.map((n) => resolveNeed(n, corpus, gateStepOfView(q.view))));
    const file = JSON.parse((await buildIndexText(scenario.atoms, stubEmbedder, "en", 26)).text) as VectorIndexFile;
    const embedding = embeddingWith(stubEmbedder, vectorIndexOf(file), "en");
    expect(() => embeddingWith(stubEmbedder, vectorIndexOf({ ...file, language: "fi" }), "en")).toThrow(/fi index/);
    const run = () => evaluateCandidates(qs, resolved, async (q, config) => (await retrieveAtView(q.question, q.view, embedding, config)).map((r) => r.atom.id));
    const a = await run();
    expect(a.map((s) => s.name)).toEqual(CANDIDATE_CONFIGS.map((c) => c.name));
    for (const s of a) {
      expect(s.recallAtK).toBeGreaterThanOrEqual(0);
      expect(s.recallAtK).toBeLessThanOrEqual(1);
    }
    expect(await run()).toEqual(a);
    expect(CANDIDATE_CONFIGS.map((c) => c.name)).toContain(selectConfig(a).name);
    expect(CANDIDATE_CONFIGS.some((c) => sameConfig(c.config, THINKER_RETRIEVAL_CONFIG_EN))).toBe(true);
  });

  it("the manifest's English block declares language, passage, tokeniser and the collapse rule", () => {
    const b = englishRetrievalBlock({ status: "frozen" });
    expect(b).toMatchObject({ language: "en", index: "content/thinker/index.en.json", topK: 8, lexical: { tokeniser: "en-sstem-prefix5-v1", k1: 1.2, b: 0.75 }, neutralEval: { status: "frozen" } });
    expect(String((b["routineCollapse"] as Record<string, unknown>)["language"])).toMatch(/Finnish source text/);
  });
});
