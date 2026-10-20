/**
 * SPEC/14 revision (v): the English retrieval mode, without the English vector index. The English
 * tokeniser; the passage by language; the index's language and the refusal of a mix; lexical-only
 * English retrieval; the collapse computed on the Finnish structure in both languages; an English
 * index built from a deterministic stub embedder (the build's code path, no model).
 */

import { describe, expect, it } from "vitest";
import { recordEn } from "../../app/i18n/text.js";
import {
  EN_TOKENISER_ID, hybridRetrieve, passageHash, passageText, retrievalConfigOf, sStem, StaleIndexError, THINKER_RETRIEVAL_CONFIG, THINKER_RETRIEVAL_CONFIG_EN,
  tokenise, tokeniseEn, vectorIndexOf, type VectorIndexFile,
} from "../../app/retrieval/hybrid.js";
import { collapseRoutine } from "../../app/retrieval/routine-collapse.js";
import { reachableAtoms } from "../../app/retrieval/time-gate.js";
import { DESIGNED_EVENT_IDS } from "../../app/scenario/types.js";
import { recordText } from "../../app/session/template-answer.js";
import { AUTHORED_QUESTIONS, AUTHORED_QUESTIONS_EN, PLANTED_PROBES } from "../../tools/thinker/authored-questions.js";
import { buildIndexText, buildQueriesText } from "../../tools/thinker/index-build.js";
import { ids, indexFile, scenario, stepAtViewStart } from "../engine/thinker-fixtures.js";
import { stubEmbedder } from "./stub-embedder.js";


describe("the English tokeniser (declared: en-sstem-prefix5-v1)", () => {
  it("keeps codes whole, drops possessives and a code's colon ending, S-stems then prefix-cuts words", () => {
    expect(EN_TOKENISER_ID).toBe("en-sstem-prefix5-v1");
    expect(tokeniseEn("EK11's tank, KY21:n hoses — TOIMINTA-2 on the 20 kV lines")).toEqual(["ek11", "tank", "ky21", "hose", "toiminta-2", "on", "the", "20", "kv", "line"]); // SPEC/33 (bc): the line is 20 kV
    expect(tokeniseEn("The units' fires; crews’ batteries")).toEqual(["the", "unit", "fire", "crew", "batte"]);
    expect(tokenise("Spreading south-east", "en")).toEqual(["sprea", "south"]);
  });

  it("joins singular and plural of short words, which the prefix cut alone would not", () => {
    for (const [a, b] of [["fire", "fires"], ["line", "lines"], ["unit", "units"], ["edge", "edges"], ["hose", "hoses"]] as const) {
      expect(tokeniseEn(a)).toEqual(tokeniseEn(b));
    }
  });

  it("applies Harman's S-stemmer rules exactly", () => {
    expect(sStem("batteries")).toBe("battery");
    expect(sStem("species")).toBe("specy"); // the rule, literally
    expect(sStem("boxes")).toBe("boxe");
    expect(sStem("toes")).toBe("toe"); // -oes keeps the e: only the s goes
    expect(sStem("status")).toBe("status");
    expect(sStem("grass")).toBe("grass");
    expect(sStem("units")).toBe("unit");
  });

  it("leaves the Finnish tokeniser unchanged", () => {
    expect(tokenise("TOIMINTA-2: KY21:n L1:lle, 20 kV sähkölinjan")).toEqual(["toiminta-2", "ky21", "l1", "20", "kv", "sähkö"]); // SPEC/33 (bc): the line is 20 kV
    expect(tokenise("TOIMINTA-2: KY21:n L1:lle, 20 kV sähkölinjan", "fi")).toEqual(tokenise("TOIMINTA-2: KY21:n L1:lle, 20 kV sähkölinjan"));
  });
});

describe("the passage by language", () => {
  const f7 = scenario.atoms.find((a) => a.id === DESIGNED_EVENT_IDS.planted)!;

  it("is the source and the Finnish text in Finnish, the source and the English text in English", () => {
    expect(passageText(f7)).toBe(`JOHTOPAIKKA: ${recordText(f7.record)}`);
    expect(passageText(f7, "fi")).toBe(passageText(f7));
    expect(passageText(f7, "en")).toBe(`JOHTOPAIKKA: ${recordEn(f7.id)}`);
    expect(passageText(f7, "en")).toMatch(/de-energised/);
  });

  it("every atom has an English passage that differs from its Finnish one, and a different hash", () => {
    let differ = 0;
    for (const a of scenario.atoms) {
      expect(recordEn(a.id), a.id).toBeDefined();
      if (passageText(a, "en") !== passageText(a, "fi")) {
        differ++;
        expect(passageHash(a, "en")).not.toBe(passageHash(a, "fi"));
      }
    }
    expect(differ).toBeGreaterThan(scenario.atoms.length * 0.9);
  });

  it("the frozen Finnish index still matches the Finnish passages (its hash and content untouched)", () => {
    const index = vectorIndexOf(indexFile);
    expect(index.language).toBe("fi");
    for (const a of scenario.atoms.slice(0, 50)) expect(() => index.vectorOf(a)).not.toThrow();
  });
});

describe("no mixing of languages", () => {
  it("refuses the Finnish index for English retrieval", () => {
    const fi = vectorIndexOf(indexFile);
    const v = fi.vectorOf(scenario.atoms[0]!);
    expect(() => hybridRetrieve("EK11", reachableAtoms(scenario.atoms, 5), { queryVector: v, index: fi }, undefined, "en")).toThrow(/no mixing/);
  });

  it("an index file read as the other language fails its passage hashes", () => {
    const relabelled = vectorIndexOf({ ...indexFile, language: "en" } as VectorIndexFile);
    const changed = scenario.atoms.find((a) => passageText(a, "en") !== passageText(a, "fi"))!;
    expect(() => relabelled.vectorOf(changed)).toThrow(StaleIndexError);
  });
});

describe("lexical-only English retrieval (no index needed)", () => {
  const gate = (view: number) => reachableAtoms(scenario.atoms, stepAtViewStart(view));

  it("uses the English configuration, provisionally the Finnish one", () => {
    expect(THINKER_RETRIEVAL_CONFIG_EN).toEqual(THINKER_RETRIEVAL_CONFIG);
    expect(retrievalConfigOf("en")).toBe(THINKER_RETRIEVAL_CONFIG_EN);
  });

  it("finds EK11's records for 'EK11' in English and scores the English text", () => {
    const r = hybridRetrieve("EK11", gate(12), null, undefined, "en");
    expect(r).toHaveLength(THINKER_RETRIEVAL_CONFIG.topK);
    for (const x of r) expect(passageText(x.atom, "en")).toMatch(/EK11/);
  });

  it("matches English words that the Finnish lexical half cannot", () => {
    const q = "How much water does EK11 have left?";
    const en = hybridRetrieve(q, gate(3), null, undefined, "en");
    expect(en.some((x) => /water/i.test(passageText(x.atom, "en")))).toBe(true);
    // The Finnish treatment matches the English question only on the code.
    const fi = hybridRetrieve("water left", gate(3), null, undefined, "fi");
    expect(fi).toHaveLength(0);
  });

  it("is deterministic: the same question and gate give the same ids and scores", () => {
    for (const q of Object.values(AUTHORED_QUESTIONS_EN).flat()) {
      const a = hybridRetrieve(q, gate(7), null, undefined, "en").map((r) => [r.atom.id, r.score]);
      expect(hybridRetrieve(q, gate(7), null, undefined, "en").map((r) => [r.atom.id, r.score])).toEqual(a);
    }
  });

  it("collapses the same records as in Finnish (the collapse reads the Finnish structure)", () => {
    const candidates = gate(14);
    const kept = new Set(collapseRoutine(candidates, THINKER_RETRIEVAL_CONFIG_EN.routineCollapse!));
    const all = { ...THINKER_RETRIEVAL_CONFIG_EN, topK: Number.MAX_SAFE_INTEGER };
    for (const r of hybridRetrieve("EK11 water tank position", candidates, null, all, "en")) expect(kept.has(r.atom)).toBe(true);
  });

  it("F7 (lexical only, actual behaviour, report-only): first for the English line question at V6, absent before step 8", () => {
    const [, , natural] = AUTHORED_QUESTIONS_EN.powerLine;
    expect(ids(hybridRetrieve(natural, gate(6), null, undefined, "en"))[0]).toBe(DESIGNED_EVENT_IDS.planted);
    expect(ids(hybridRetrieve(natural, reachableAtoms(scenario.atoms, 7), null, undefined, "en"))).not.toContain(DESIGNED_EVENT_IDS.planted);
  });
});

describe("the English authored questions", () => {
  it("translate the Finnish ones item for item", () => {
    expect(Object.keys(AUTHORED_QUESTIONS_EN)).toEqual(Object.keys(AUTHORED_QUESTIONS));
    for (const k of Object.keys(AUTHORED_QUESTIONS) as (keyof typeof AUTHORED_QUESTIONS)[]) expect(AUTHORED_QUESTIONS_EN[k]).toHaveLength(AUTHORED_QUESTIONS[k].length);
    expect(AUTHORED_QUESTIONS_EN.codes).toEqual(AUTHORED_QUESTIONS.codes);
    for (const p of PLANTED_PROBES) expect(p.en).not.toMatch(/[äöå]/i);
  });
});

describe("an English index built by the build's code path (stub embedder)", () => {
  it("is byte-stable, names its language, and serves English hybrid retrieval", async () => {
    const atoms = scenario.atoms.slice(0, 120);
    const a = await buildIndexText(atoms, stubEmbedder, "en", 26);
    const b = await buildIndexText([...atoms].reverse(), stubEmbedder, "en", 26);
    expect(b.text).toBe(a.text);
    const file = JSON.parse(a.text) as VectorIndexFile;
    expect(file.language).toBe("en");
    const index = vectorIndexOf(file);
    expect(index.language).toBe("en");
    const queryVector = await stubEmbedder.embed("EK11 water", "query");
    const r = hybridRetrieve("EK11 water", atoms, { queryVector, index }, undefined, "en");
    expect(r.length).toBeGreaterThan(0);
    expect(() => hybridRetrieve("EK11 water", atoms, { queryVector, index }, undefined, "fi")).toThrow(/no mixing/);
  });

  it("the Finnish file keeps its original header (no language field)", async () => {
    const fi = await buildIndexText(scenario.atoms.slice(0, 3), stubEmbedder, "fi", 26);
    expect(fi.text.startsWith('{"embedderId":"stub/letters-26","dim":26,"precision":6,"atoms":[')).toBe(true);
    const q = await buildQueriesText(AUTHORED_QUESTIONS_EN.codes, stubEmbedder, "en");
    expect(JSON.parse(q.text)).toMatchObject({ language: "en", queries: [{ text: "EK11" }, { text: "L3" }] });
  });
});
