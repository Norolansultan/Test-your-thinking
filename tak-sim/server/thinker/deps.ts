/**
 * Wires the real dependencies for the proxy and the live check: the scenario, the frozen index and
 * the local embedder, the prompt (checked against the manifest), the Google GenAI client when a key
 * is set, and the per-session JSONL log under `logs/thinker/` (gitignored). The key is read by the
 * client from `GEMINI_API_KEY`; it is never logged or sent to the browser.
 *
 * English retrieval (SPEC/14 revision (v)): the English index `content/thinker/index.en.json` is
 * loaded when present. In study mode (`--study`, `THINKER_MODE=study`) the proxy refuses to start
 * unless it is present, matches the manifest's `indexEn` hash and the embedder, and the English
 * configuration is frozen (`retrievalEn.neutralEval.status`); `--lexical-only` is refused too. In
 * demonstration mode a missing English index is announced at startup and English questions are
 * answered over the Finnish index, logged as `hybrid_fi_fallback`.
 *
 * Revision (bp), 26 Oct 2026 (SPEC/14 (bp) §bp.1): the training incident's corpus is loaded next to the scenario (`deps.training`, from
 * `app/session/training/corpus.ts`, which the build writes from `content/training/corpus.json` and `records.en.json`), and checked at
 * startup: it loads, its ids all begin `trn.`, none is the scenario's, and every record is at the training's one step. Otherwise the
 * proxy refuses to start.
 */

import { GoogleGenAI } from "@google/genai";
import { appendFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { vectorIndexOf, type VectorIndexFile } from "../../app/retrieval/hybrid.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { checkDirectivePremises, loadDirectivePremises } from "./directive-premises.js";
import { checkPremiseEvidence, loadPremiseEvidence } from "./premise-check.js";
import { expectedModelVersionOf, INDEX_FILE, INDEX_FILE_EN, loadSystemPrompt, MANIFEST_FILE, normaliseNewlines, repoPath, sha256Hex, type ThinkerServerMode } from "./config.js";
import { loadE5Embedder } from "./e5-embedder.js";
import type { ThinkerDeps, TrainingCorpus } from "./handler.js";
import type { InfoAtom } from "../../app/scenario/types.js";
import { TRAINING_ATOMS, TRAINING_NOW_S, TRAINING_STEP } from "../../app/session/training/corpus.js";

export const LOG_DIR = "logs/thinker";

export function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(repoPath(relative), "utf8")) as T;
}

/** Appends to `logs/thinker/<sessionId>.jsonl`; the id is already restricted to `[A-Za-z0-9._-]`. */
export function jsonlLogger(dir = repoPath(LOG_DIR)): ThinkerDeps["appendLog"] {
  return async (sessionId, line) => {
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, `${sessionId}.jsonl`), `${JSON.stringify(line)}\n`, "utf8");
  };
}

export interface ManifestPrompts {
  readonly prompt: { readonly sha256: string };
  readonly promptEn?: { readonly sha256: string };
  readonly promptIntent?: { readonly sha256: string };
  readonly promptIntentEn?: { readonly sha256: string };
  readonly promptOpen?: { readonly sha256: string };
  readonly promptOpenEn?: { readonly sha256: string };
  readonly promptOpenOnce?: { readonly sha256: string };
  readonly promptOpenOnceEn?: { readonly sha256: string };
  /** Revision (ar): the directive's authored premises (`content/thinker/directive-premises.json`). */
  readonly directivePremises?: { readonly sha256: string };
  /** SPEC/30 §3: the premise-evidence table (`content/thinker/premise-evidence.json`). */
  readonly premiseEvidence?: { readonly sha256: string };
}

/**
 * Loads the eight versioned prompts (standard, strategy-guided, and the Open Thinker's of each Thinker
 * cell — revision (al) — fi and en) and checks each against the manifest's hash; any mismatch or
 * missing entry refuses to start.
 */
export function loadCheckedPrompts(manifest: ManifestPrompts): Pick<ThinkerDeps, "prompt" | "promptEn" | "promptIntent" | "promptIntentEn" | "promptOpen" | "promptOpenEn" | "promptOpenOnce" | "promptOpenOnceEn"> {
  const entries = [
    ["prompt", "the system prompt", loadSystemPrompt("fi")],
    ["promptEn", "the English system prompt", loadSystemPrompt("en")],
    ["promptIntent", "the strategy-guided system prompt", loadSystemPrompt("fi", "intent")],
    ["promptIntentEn", "the English strategy-guided system prompt", loadSystemPrompt("en", "intent")],
    ["promptOpen", "the Open Thinker system prompt", loadSystemPrompt("fi", "open")],
    ["promptOpenEn", "the English Open Thinker system prompt", loadSystemPrompt("en", "open")],
    ["promptOpenOnce", "the reasoning_once Open Thinker system prompt", loadSystemPrompt("fi", "open_once")],
    ["promptOpenOnceEn", "the English reasoning_once Open Thinker system prompt", loadSystemPrompt("en", "open_once")],
  ] as const;
  for (const [key, label, loaded] of entries) {
    const expected = manifest[key]?.sha256;
    if (expected !== loaded.sha256) {
      throw new Error(`${label}'s hash ${loaded.sha256} differs from the manifest's ${expected ?? "(none)"}; run \`npm run thinker:index\``);
    }
  }
  return { prompt: entries[0][2], promptEn: entries[1][2], promptIntent: entries[2][2], promptIntentEn: entries[3][2], promptOpen: entries[4][2], promptOpenEn: entries[5][2],
    promptOpenOnce: entries[6][2], promptOpenOnceEn: entries[7][2],
  };
}

/** What the manifest says about the English retrieval (written by `thinker:index` and `thinker:eval -- --lang en --write`). */
export interface ManifestEnglish {
  readonly indexEn?: { readonly sha256: string };
  readonly retrievalEn?: { readonly neutralEval?: { readonly status?: string } };
}

/** The English retrieval a proxy starts with, and the startup notice that says so. */
export interface EnglishStartup {
  /** The parsed English index file, or null when it is not used. */
  readonly indexEn: VectorIndexFile | null;
  readonly englishWithoutIndex: "refuse" | "fi_index";
  readonly notice: string;
}

/**
 * Decides the English retrieval at startup (SPEC/14 revision (v)); pure, so tests run it without
 * the model. `indexEnText` is the English index file's text, or null when the file is absent.
 * Throws — refusing to start — in study mode when the English treatment is not the declared one.
 */
export function englishStartup(options: {
  readonly mode: ThinkerServerMode;
  readonly lexicalOnly: boolean;
  readonly indexEnText: string | null;
  readonly manifest: ManifestEnglish;
  /** The loaded embedder's id; null on a lexical-only proxy. */
  readonly embedderId: string | null;
}): EnglishStartup {
  const { mode, lexicalOnly, indexEnText, manifest, embedderId } = options;
  const study = mode === "study";
  if (study && lexicalOnly) throw new Error("study mode: --lexical-only is not the declared treatment and cannot serve a study session");
  if (lexicalOnly) return { indexEn: null, englishWithoutIndex: "refuse", notice: "English: lexical half alone over the English passages (--lexical-only)" };
  const build = "build it with `npm run thinker:index -- --lang en` (needs the e5 model; the Finnish index is kept as it is) and freeze it with `npm run thinker:eval -- --lang en --write`, then copy content/thinker/index.en.json, authored-queries.en.json and manifest.json to the server (SPEC/14 revision (v); docs/DEPLOYMENT.md step 3)";
  if (indexEnText === null) {
    if (study) throw new Error(`study mode: ${INDEX_FILE_EN} is absent, so English Thinker requests cannot get the declared English retrieval; ${build}`);
    return {
      indexEn: null,
      englishWithoutIndex: "fi_index",
      notice: `English: ${INDEX_FILE_EN} is ABSENT — English questions are retrieved over the FINNISH index and logged as retrievalMode "hybrid_fi_fallback" (demonstration only; ${build})`,
    };
  }
  const file = JSON.parse(indexEnText) as VectorIndexFile;
  const problems: string[] = [];
  if (file.language !== "en") problems.push(`its language is ${file.language ?? "(none)"}, not en`);
  if (file.embedderId !== embedderId) problems.push(`its embedder ${file.embedderId} is not the loaded ${embedderId ?? "(none)"}`);
  const hash = sha256Hex(normaliseNewlines(indexEnText));
  if (manifest.indexEn?.sha256 !== hash) problems.push(`its hash ${hash} is not the manifest's indexEn ${manifest.indexEn?.sha256 ?? "(none)"}`);
  if (manifest.retrievalEn?.neutralEval?.status !== "frozen") problems.push("the English configuration is not frozen in the manifest (retrievalEn.neutralEval)");
  // A wrong language or embedder is never served; the declaration checks bind in study mode.
  if (file.language !== "en" || file.embedderId !== embedderId) throw new Error(`${INDEX_FILE_EN} cannot be used: ${problems.join("; ")}`);
  if (problems.length > 0 && study) throw new Error(`study mode: ${INDEX_FILE_EN} is not the declared English treatment: ${problems.join("; ")}`);
  return {
    indexEn: file,
    englishWithoutIndex: "refuse",
    notice: problems.length > 0 ? `English: hybrid over ${INDEX_FILE_EN}, NOT the declared treatment (${problems.join("; ")})` : `English: hybrid over ${INDEX_FILE_EN} (declared, frozen)`,
  };
}

/** Revision (bp): the training corpus's id prefix; no session record has it, and every training record has it. */
export const TRAINING_ID_PREFIX = "trn.";

/**
 * Revision (bp): what is wrong with a training corpus against the session's records (empty: nothing). Pure, so the tests run it on
 * fixtures: an empty corpus, an id without the `trn.` prefix or repeated, an id that is the session's, a record off the training's step.
 */
export function trainingCorpusProblems(training: TrainingCorpus, sessionAtoms: readonly Pick<InfoAtom, "id">[]): string[] {
  const problems: string[] = [];
  if (training.atoms.length === 0) problems.push("the training corpus is empty (build it: `npm run training:build`)");
  const session = new Set(sessionAtoms.map((a) => a.id));
  const seen = new Set<string>();
  for (const a of training.atoms) {
    if (!a.id.startsWith(TRAINING_ID_PREFIX)) problems.push(`${a.id}: a training record's id must begin "${TRAINING_ID_PREFIX}"`);
    if (session.has(a.id)) problems.push(`${a.id}: is a session record`);
    if (seen.has(a.id)) problems.push(`${a.id}: twice`);
    if (a.cycle !== training.step) problems.push(`${a.id}: at step ${a.cycle}, not the training's ${training.step}`);
    seen.add(a.id);
  }
  for (const a of sessionAtoms) if (a.id.startsWith(TRAINING_ID_PREFIX)) problems.push(`${a.id}: a session record with the training's prefix`);
  return problems;
}

/** Revision (bp): the training corpus the proxy serves, checked against the scenario; throws (the proxy does not start) on a problem. */
export function loadTrainingCorpus(sessionAtoms: readonly Pick<InfoAtom, "id">[], training: TrainingCorpus = { atoms: TRAINING_ATOMS, step: TRAINING_STEP, nowS: TRAINING_NOW_S }): TrainingCorpus {
  const problems = trainingCorpusProblems(training, sessionAtoms);
  if (problems.length > 0) throw new Error(`the training corpus cannot be served:\n  ${problems.join("\n  ")}`);
  return training;
}

/** `GEMINI_API_KEY` without the quotes or spaces a pasted value often carries (Google rejects them); undefined when unset. */
export function geminiKey(env: Readonly<Record<string, string | undefined>> = process.env): string | undefined {
  const key = env.GEMINI_API_KEY?.trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
  return key ? key : undefined;
}

export async function createThinkerDeps(options: { readonly lexicalOnly: boolean; readonly mode?: ThinkerServerMode }): Promise<ThinkerDeps & { readonly englishNotice: string }> {
  const mode = options.mode ?? "demo";
  const manifest = readJson<ManifestPrompts & ManifestEnglish & { embedder: { id: string } }>(MANIFEST_FILE);
  const prompts = loadCheckedPrompts(manifest);
  const scenario = buildDemoScenario();
  // Revision (ar): the authored premises must be the frozen ones and written for this scenario's directive; otherwise refuse to start.
  const directivePremises = loadDirectivePremises();
  checkDirectivePremises(directivePremises, manifest.directivePremises?.sha256, scenario.hinge.intentStatement);
  // SPEC/30 §3: the premise-evidence table must be the frozen one, written for these premises, and cite only records of this scenario once received.
  const premiseEvidence = loadPremiseEvidence();
  checkPremiseEvidence(premiseEvidence, manifest.premiseEvidence?.sha256, directivePremises, scenario.atoms);
  // Revision (bp): the training's corpus, checked before anything slow loads.
  const training = loadTrainingCorpus(scenario.atoms);
  const indexEnText = existsSync(repoPath(INDEX_FILE_EN)) ? readFileSync(repoPath(INDEX_FILE_EN), "utf8") : null;
  // Checked before the model loads, so a study proxy without the English index fails at once.
  if (mode === "study") englishStartup({ mode, lexicalOnly: options.lexicalOnly, indexEnText, manifest, embedderId: manifest.embedder.id });
  let vector: ThinkerDeps["vector"] = null;
  if (!options.lexicalOnly) {
    const indexFile = readJson<VectorIndexFile>(INDEX_FILE);
    const embedder = await loadE5Embedder({ allowRemote: false });
    if (embedder.id !== indexFile.embedderId || embedder.id !== manifest.embedder.id) {
      throw new Error(`embedder ${embedder.id} does not match the index (${indexFile.embedderId}) or manifest (${manifest.embedder.id})`);
    }
    vector = { embedder, index: vectorIndexOf(indexFile) };
  }
  const english = englishStartup({ mode, lexicalOnly: options.lexicalOnly, indexEnText, manifest, embedderId: vector?.embedder.id ?? null });
  return {
    scenario,
    training,
    directivePremises,
    premiseEvidence,
    // SPEC/30 §10: the pinned build (THINKER_EXPECTED_MODEL_VERSION), and each session's first build for `modelVersionChanged`.
    expectedModelVersion: expectedModelVersionOf(),
    sessionModelVersions: new Map(),
    vector,
    vectorEn: vector && english.indexEn ? { embedder: vector.embedder, index: vectorIndexOf(english.indexEn) } : null,
    englishWithoutIndex: english.englishWithoutIndex,
    englishNotice: english.notice,
    ...prompts,
    client: geminiKey() ? new GoogleGenAI({ apiKey: geminiKey()! }) : null,
    appendLog: jsonlLogger(),
    nowMs: () => performance.now(),
    nowIso: () => new Date().toISOString(),
  };
}
