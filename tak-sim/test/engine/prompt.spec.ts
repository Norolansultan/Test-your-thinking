/**
 * SPEC/14 revision (q), `prompt.spec`: the system prompt's hash equals the manifest's, and the
 * manifest declares what the code runs (model, effort, embedder, weights, top-k). The prompt must
 * say nothing about hiding or surfacing conflicts.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREFIX_STEM_LENGTH, THINKER_RETRIEVAL_CONFIG } from "../../app/retrieval/hybrid.js";
import { loadSystemPrompt, THINKER_MAX_RETRIES, THINKER_MAX_TOKENS, THINKER_MODEL_ID, THINKER_SEED } from "../../server/thinker/config.js";
import { E5_EMBEDDER_ID } from "../../server/thinker/e5-embedder.js";
import { indexFile } from "./thinker-fixtures.js";

const manifest = JSON.parse(readFileSync(new URL("../../content/thinker/manifest.json", import.meta.url), "utf8"));

describe("the versioned system prompt", () => {
  it("hashes to the manifest's prompt hash", () => {
    expect(loadSystemPrompt().sha256).toBe(manifest.prompt.sha256);
  });

  it("says what SPEC/14 revision (q) requires", () => {
    const text = loadSystemPrompt().text;
    expect(text).toMatch(/Vastaa vain annettujen tietueiden perusteella/); // only from the given records
    expect(text).toMatch(/samalta lähteeltä.*uusinta/s); // the latest record per source
    expect(text).toMatch(/eivät riitä/); // say when the records are insufficient
    for (const part of ["vastaus", "perusteet", "varmuus", "muuttaisi"]) expect(text).toContain(`${part}:`);
    expect(text).toMatch(/lähde ja kellonaika/); // BASIS cites source and time
  });

  it("says nothing about conflicts or contradictions", () => {
    expect(loadSystemPrompt().text).not.toMatch(/ristiriit|konflikt|epäjohdonmuk|piilo|korosta|ristiin/i);
  });
});

/**
 * Phase B round 2 (D2): the strategy-guided prompt (cell `reasoning_intent`, V8–V14), fi and en.
 * The same rules as the standard prompt, plus the `linjaus` instructions; the directive itself is
 * appended by the server and is not in the file.
 */
describe("the strategy-guided system prompt", () => {
  const variants = [
    { lang: "fi", key: "promptIntent", standard: "prompt" },
    { lang: "en", key: "promptIntentEn", standard: "promptEn" },
  ] as const;

  it.each(variants)("($lang) hashes to the manifest's $key, and the standard prompts are unchanged", ({ lang, key, standard }) => {
    expect(loadSystemPrompt(lang, "intent").sha256).toBe(manifest[key].sha256);
    expect(manifest[key].file).toBe(`server/thinker/prompt.intent.${lang}.md`);
    expect(manifest[key].status).toMatch(/DRAFT/);
    expect(loadSystemPrompt(lang).sha256).toBe(manifest[standard].sha256);
  });

  // The strategy-guided prompt is withdrawn and frozen for old logs (8 Oct 2026): it keeps the standard
  // prompt's rules as they were when it was frozen, not the rules the standard prompt has since gained (D2(b), D7).
  const frozenStandardRules = {
    fi: [
      "1. Vastaa vain annettujen tietueiden perusteella. Älä käytä muuta tietoa äläkä tee oletuksia, joita tietueet eivät tue.",
      "2. Jos samalta lähteeltä on useita tietueita, käytä ensisijaisesti sen uusinta tietuetta.",
      "3. Jos tietueet eivät riitä vastaamaan kysymykseen, sano se suoraan.",
      "   - vastaus: suora vastaus kysymykseen, enintään kolme virkettä.",
      '   - perusteet: tietueet, joihin vastaus perustuu. Mainitse kunkin lähde ja kellonaika, esimerkiksi "KY21 klo 16.35".',
      "   - varmuus: kuinka varma vastaus on tietueiden perusteella (varma, todennäköinen, epävarma tai ei tiedossa) ja lyhyesti miksi.",
      "   - muuttaisi: mikä uusi tieto muuttaisi vastausta.",
    ],
    en: [
      "1. Answer only from the records given. Do not use any other information and do not make assumptions the records do not support.",
      "2. If there are several records from the same source, rely first on its latest record.",
      "3. If the records are not enough to answer the question, say so directly.",
      "   - vastaus (answer): a direct answer to the question, at most three sentences.",
      '   - perusteet (basis): the records the answer is based on. Give the source and time of each, for example "KY21 at 16.35".',
      "   - varmuus (certainty): how certain the answer is from the records (certain, probable, uncertain or not known) and briefly why.",
      "   - muuttaisi (would change it): what new information would change the answer.",
    ],
  } as const;

  it.each(variants)("($lang) keeps every rule of the standard prompt (as frozen) verbatim", ({ lang }) => {
    const intent = loadSystemPrompt(lang, "intent").text;
    for (const rule of frozenStandardRules[lang]) expect(intent).toContain(rule);
  });

  it("(fi) asks for the fifth field: fit only, the deciding record with source and time, ei_liity, no recommendations", () => {
    const text = loadSystemPrompt("fi", "intent").text;
    expect(text).toMatch(/6\. Täytä lisäksi viides osa, linjaus/);
    expect(text).toMatch(/vain, sopiiko annettujen tietueiden kuvaama tilanne voimassa olevaan linjaukseen/);
    for (const status of ['"sopii"', '"ei_sovi"', '"ei_liity"']) expect(text).toContain(status);
    expect(text).not.toContain("ei_arvioitu"); // the fallback's status is never the model's
    expect(text).toMatch(/perustelu: yksi virke.*lähde ja kellonaika/s);
    expect(text).toMatch(/Älä linjausosassa suosittele toimenpiteitä, yksiköitä, lohkoja tai toimintatapoja/);
    expect(text).toMatch(/"pitäisi", "kannattaa" tai "suositellaan"/);
    expect(text).toMatch(/ohjeiden lopussa on voimassa oleva linjaus/);
  });

  it("(en) asks the same in English", () => {
    const text = loadSystemPrompt("en", "intent").text;
    expect(text).toMatch(/answer the incident commander's question in English/);
    expect(text).toMatch(/assess only whether the situation described by the records given fits the directive in force/);
    for (const status of ['"sopii"', '"ei_sovi"', '"ei_liity"']) expect(text).toContain(status);
    expect(text).not.toContain("ei_arvioitu");
    expect(text).toMatch(/perustelu \(reason\): one sentence.*source and time/s);
    expect(text).toMatch(/do not recommend actions, units, sectors or postures/);
    expect(text).toMatch(/"should", "ought to" or "is advisable"/);
  });

  // SPEC/27 §3.2 P2 (reconciled 5 Oct 2026): the directive is used ONLY in the fifth field; the four
  // standard fields are filled as the standard prompt would fill them.
  it("(fi/en) confines the directive to the fifth field", () => {
    expect(loadSystemPrompt("fi", "intent").text).toMatch(
      /5\. Täytä nämä neljä osaa täsmälleen niin kuin täyttäisit ne ilman linjausta\. Älä mainitse niissä linjausta äläkä arvioi niissä tilannetta linjausta vasten\. Voimassa olevaa linjausta saat käyttää vain viidennessä osassa\./,
    );
    expect(loadSystemPrompt("en", "intent").text).toMatch(
      /5\. Fill in these four parts exactly as you would fill them in without the directive\. Do not mention the directive in them and do not assess the situation against the directive in them\. You may use the directive in force only in the fifth part\./,
    );
  });

  // SPEC/27 §3.2 P3: the three statuses are defined symmetrically, with no example of a situation.
  it.each([
    { lang: "fi", fits: /"sopii": tietueiden kuvaama tilanne sopii linjaukseen sellaisena kuin se on kirjoitettu\./, misfits: /"ei_sovi": tietueiden kuvaama tilanne ei sovi linjaukseen sellaisena kuin se on kirjoitettu\./ },
    { lang: "en", fits: /"sopii": the situation described by the records fits the directive as it is written\./, misfits: /"ei_sovi": the situation described by the records does not fit the directive as it is written\./ },
  ] as const)("($lang) defines sopii and ei_sovi symmetrically, without examples", ({ lang, fits, misfits }) => {
    const text = loadSystemPrompt(lang, "intent").text;
    const fit = text.match(fits)![0];
    const misfit = text.match(misfits)![0];
    // The two definitions differ only by the negation.
    expect(misfit.replace(/"ei_sovi"/, "").replace(/ei sovi|does not fit/, "")).toBe(fit.replace(/"sopii"/, "").replace(/sopii|fits/, ""));
    const statusLine = text.split("\n").find((l) => l.includes('"ei_liity"'))!;
    expect(statusLine).not.toMatch(/esimerkiksi|for example|esim\.|e\.g\./);
  });

  it.each(variants)("($lang) says nothing about conflicts, designed events, or the directive's text", ({ lang }) => {
    const text = loadSystemPrompt(lang, "intent").text;
    expect(text).not.toMatch(/ristiriit|konflikt|epäjohdonmuk|piilo|korosta|ristiin|contradict|conflict|inconsisten|highlight/i);
    expect(text).not.toMatch(/rekindle|jälleensyt|uudelleensyt|planted|voimajohto|power line|Lahdenkylä|Mökkiranta|puolustav|defensive/i);
  });
});

describe("the manifest declares what runs", () => {
  it("model, effort and length", () => {
    expect(manifest.model).toMatchObject({ id: THINKER_MODEL_ID, maxTokens: THINKER_MAX_TOKENS, maxRetries: THINKER_MAX_RETRIES, seed: THINKER_SEED }); // revision (al): one identical retry on 429 / 503, a fixed seed
  });

  it("embedder, fusion weights, top-k and the prefix stem", () => {
    expect(manifest.embedder.id).toBe(E5_EMBEDDER_ID);
    expect(indexFile.embedderId).toBe(E5_EMBEDDER_ID);
    expect(manifest.retrieval.fusion).toMatchObject({ lexicalWeight: THINKER_RETRIEVAL_CONFIG.lexicalWeight, vectorWeight: THINKER_RETRIEVAL_CONFIG.vectorWeight });
    expect(manifest.retrieval.topK).toBe(THINKER_RETRIEVAL_CONFIG.topK);
    expect(manifest.retrieval.lexical).toMatchObject({ k1: THINKER_RETRIEVAL_CONFIG.bm25.k1, b: THINKER_RETRIEVAL_CONFIG.bm25.b, prefixStem: PREFIX_STEM_LENGTH });
  });

  it("the routine-line collapse and the per-source cap, frozen on the neutral evaluation", () => {
    expect(manifest.retrieval.routineCollapse?.minDistinctSteps ?? null).toBe(THINKER_RETRIEVAL_CONFIG.routineCollapse?.minDistinctSteps ?? null);
    expect(manifest.retrieval.maxPerSource).toBe(THINKER_RETRIEVAL_CONFIG.maxPerSource);
    expect(manifest.retrieval.neutralEval).toMatchObject({ status: "frozen", date: "2026-10-01" });
    // The declared configuration is the one frozen on 1 Oct 2026 and never re-selected. After the
    // recency boost (fix pass 6, 8 Oct 2026) the selection rule narrowly picks collapse3+cap3 (MRR
    // 0.5571 vs 0.5498, recall equal); the researcher kept collapse3 declared and documented the
    // post-freeze mismatch (SPEC/14 (ab)). The manifest must record both honestly.
    expect(manifest.retrieval.neutralEval.declared).toBe("collapse3");
    // Review fixes (ah), 9 Oct 2026: on the regenerated corpus the rule picks collapse3+cap2 (recall .6961 vs .6912, MRR .5824 vs
    // .5733); collapse3 stays declared (a post-freeze observation, SPEC/24 and 18 revision (ah)).
    expect(["collapse3", "collapse3+cap3", "collapse3+cap2"]).toContain(manifest.retrieval.neutralEval.selected);
  });
});
