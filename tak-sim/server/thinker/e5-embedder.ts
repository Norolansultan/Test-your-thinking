/**
 * The default embedder (SPEC/11 §7.9): multilingual-e5-small, run locally in Node through
 * Transformers.js. Weights: `intfloat/multilingual-e5-small`, MIT licence, in the ONNX conversion
 * `Xenova/multilingual-e5-small` (int8-quantised), pinned to one revision. Runtime:
 * `@huggingface/transformers`, Apache-2.0. Nothing leaves the machine once the files are cached.
 *
 * Every text is embedded alone (batch size 1): padding in a batch changes the quantised model's
 * output, so batching would make the index depend on batch composition. Vectors are mean-pooled,
 * L2-normalised and rounded to fixed precision, the same way at build time and at query time.
 * e5 expects the prefixes "query: " and "passage: ".
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { roundVector, type Embedder } from "../../app/retrieval/hybrid.js";
import { repoPath } from "./config.js";

export const E5_MODEL = "Xenova/multilingual-e5-small";
export const E5_REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
export const E5_DTYPE = "q8";
export const E5_DIM = 384;
export const E5_EMBEDDER_ID = `${E5_MODEL}@${E5_REVISION.slice(0, 7)}/${E5_DTYPE}/mean/l2`;
export const E5_LICENCE = "MIT (weights: intfloat/multilingual-e5-small); runtime @huggingface/transformers Apache-2.0";
/** Local model cache (gitignored). The index build downloads into it; the server only reads it. */
export const MODEL_CACHE_DIR = ".cache/thinker-models";

/**
 * A download stores the files under `<model>/<revision>/`, but an offline load (`allowRemoteModels =
 * false`, the server and the evaluation) reads `<model>/` and then finds no tokenizer ("this.tokenizer is
 * not a function"; 3 Oct 2026, after the cache was rebuilt). Copying the pinned revision's files up one
 * level keeps exactly the files the index was built with.
 */
function mirrorPinnedFiles(): void {
  const base = join(repoPath(MODEL_CACHE_DIR), ...E5_MODEL.split("/"));
  const rev = join(base, E5_REVISION);
  if (!existsSync(rev)) return;
  for (const f of readdirSync(rev, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const from = join(f.parentPath, f.name);
    const to = join(base, relative(rev, from));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}

/**
 * Loads the pinned model. `allowRemote` is true only for the index build; the server runs from the
 * local cache, so it embeds with exactly the files the index was built with.
 */
export async function loadE5Embedder(options: { readonly allowRemote: boolean }): Promise<Embedder> {
  env.cacheDir = repoPath(MODEL_CACHE_DIR);
  env.allowRemoteModels = options.allowRemote;
  const extract = await pipeline("feature-extraction", E5_MODEL, { revision: E5_REVISION, dtype: E5_DTYPE });
  if (options.allowRemote) mirrorPinnedFiles();
  return {
    id: E5_EMBEDDER_ID,
    async embed(text, role) {
      const out = await extract(`${role}: ${text}`, { pooling: "mean", normalize: true });
      return roundVector(Array.from(out.data as Float32Array));
    },
  };
}
