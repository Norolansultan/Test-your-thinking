/**
 * Thinker in an English session (1 Oct 2026): the request carries the language, the model gets the
 * English prompt and the records in English, and the fallback template answers in English.
 * Retrieval runs in English too (SPEC/14 revision (v); test/server/thinker-english.spec.ts): this file uses a lexical-only proxy.
 */

import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { toRenderable } from "../../app/boundary/render-boundary.js";
import { templateThinkerAnswer, validateThinkerRequest } from "../../app/session/thinker-protocol.js";
import { buildUserContent } from "../../server/thinker/model.js";
import { loadSystemPrompt } from "../../server/thinker/config.js";
import { handleThinkerRequest } from "../../server/thinker/handler.js";
import manifest from "../../content/thinker/manifest.json" with { type: "json" };

const scenario = buildDemoScenario();
const atom = scenario.atoms.find((a) => a.id === "f7.grid_record")!;

describe("Thinker in English", () => {
  it("accepts fi, en or no language, and nothing else", () => {
    const base = { sessionId: "s1", condition: "substitutive", view: 6, virtualTimeS: 8000, question: "q", cell: "reasoning_once" };
    expect(validateThinkerRequest({ ...base }).ok).toBe(true);
    expect(validateThinkerRequest({ ...base, language: "en" }).ok).toBe(true);
    expect(validateThinkerRequest({ ...base, language: "sv" }).ok).toBe(false);
  });

  it("keeps the language in the validated request, so the proxy answers in it", async () => {
    const base = { sessionId: "s1", condition: "substitutive", view: 6, virtualTimeS: 8000, question: "q", cell: "reasoning_once" };
    const en = validateThinkerRequest({ ...base, language: "en" });
    expect(en.ok && en.request.language).toBe("en");
    const none = validateThinkerRequest(base);
    expect(none.ok && none.request.language).toBeUndefined();

    const lines: Record<string, unknown>[] = [];
    const virtualTimeS = scenario.cycles.find((c) => c.index === 6)!.startsAtVirtual;
    const result = await handleThinkerRequest(
      { scenario, vector: null, prompt: loadSystemPrompt("fi"), promptEn: loadSystemPrompt("en"), client: null, appendLog: async (_s, l) => { lines.push(l); }, nowMs: () => 0, nowIso: () => "t" },
      { ...base, virtualTimeS, question: "20 kV power line", language: "en" }, // SPEC/33 (bc): was 110 kV
    );
    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.promptHash).toBe(loadSystemPrompt("en").sha256);
    expect(lines[0]!.language).toBe("en");
    expect(result.body.answer.vastaus).not.toMatch(/jännite/);
  });

  it("gives the model the question and the records in English", () => {
    const text = buildUserContent("Is the power line live?", [{ atom, score: 1 } as never], "en");
    expect(text).toMatch(/^Question: Is the power line live\?\n\nRecords:\n\[T1\] source: /);
    expect(text).toContain("still live");
    expect(text).not.toMatch(/lähde|Kysymys|jännitteinen/);
  });

  it("answers the fallback template in English", () => {
    const a = templateThinkerAnswer([toRenderable(atom)], "en");
    expect(a.vastaus).toContain("20 kV power line"); // SPEC/33 (bc): was 110 kV
    expect(a.perusteet).toMatch(/ at \d\d\.\d\d/);
    expect(templateThinkerAnswer([], "en").vastaus).toMatch(/^No hits/);
  });

  it("has an English system prompt recorded in the manifest", () => {
    const en = loadSystemPrompt("en");
    expect(en.text).toMatch(/answer the incident commander's question in English/);
    expect((manifest as { promptEn?: { sha256: string } }).promptEn?.sha256).toBe(en.sha256);
    expect(loadSystemPrompt("fi").sha256).toBe(manifest.prompt.sha256); // the Finnish prompt is unchanged
  });
});
