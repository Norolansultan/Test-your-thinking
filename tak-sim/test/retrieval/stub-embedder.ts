/**
 * A deterministic stub embedder for the English retrieval tests (SPEC/14 revision (v)): a
 * bag-of-letters vector, so similar texts are near. No model, no network.
 */

import type { Embedder } from "../../app/retrieval/hybrid.js";

export const stubEmbedder: Embedder = {
  id: "stub/letters-26",
  async embed(text) {
    const v = new Array<number>(26).fill(0);
    for (const ch of text.toLowerCase()) {
      const i = ch.charCodeAt(0) - 97;
      if (i >= 0 && i < 26) v[i]! += 1;
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  },
};
