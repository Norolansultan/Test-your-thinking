import { describe, expect, it } from "vitest";
import { Xorshift64Star, deriveSeed, hashString64 } from "../../app/engine/prng.js";

describe("hashString64", () => {
  it("is deterministic for the same input", () => {
    expect(hashString64("scenario-alpha")).toBe(hashString64("scenario-alpha"));
  });

  it("differs for different inputs", () => {
    expect(hashString64("scenario-alpha")).not.toBe(hashString64("scenario-beta"));
  });

  it("is sensitive to empty vs non-empty input", () => {
    expect(hashString64("")).not.toBe(hashString64("a"));
  });
});

describe("deriveSeed", () => {
  it("is deterministic", () => {
    const a = deriveSeed(42n, "scenario-alpha");
    const b = deriveSeed(42n, "scenario-alpha");
    expect(a).toBe(b);
  });

  it("diverges when scenarioId differs, same numeric seed", () => {
    const a = deriveSeed(42n, "scenario-alpha");
    const b = deriveSeed(42n, "scenario-beta");
    expect(a).not.toBe(b);
  });

  it("diverges by stream label so independent streams don't correlate", () => {
    const a = deriveSeed(42n, "scenario-alpha", "probe-order");
    const b = deriveSeed(42n, "scenario-alpha", "fire-noise");
    expect(a).not.toBe(b);
  });
});

describe("Xorshift64Star", () => {
  it("produces a fully deterministic, reproducible sequence for a fixed seed", () => {
    const seed = deriveSeed(1234567890123n, "golden-scenario");
    const rngA = new Xorshift64Star(seed);
    const rngB = new Xorshift64Star(seed);
    const seqA = Array.from({ length: 20 }, () => rngA.nextU64().toString());
    const seqB = Array.from({ length: 20 }, () => rngB.nextU64().toString());
    expect(seqA).toEqual(seqB);
  });

  it("never repeats the seed value verbatim as the first output (sanity, not a real randomness test)", () => {
    const rng = new Xorshift64Star(1n);
    expect(rng.nextU64()).not.toBe(1n);
  });

  it("nextFloat stays within [0, 1)", () => {
    const rng = new Xorshift64Star(deriveSeed(7n, "s"));
    for (let i = 0; i < 1000; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextInt is within [0, bound) and covers the full range over many draws", () => {
    const rng = new Xorshift64Star(deriveSeed(99n, "s"));
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });

  it("nextInt rejects non-positive-integer bounds", () => {
    const rng = new Xorshift64Star(1n);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-3)).toThrow(RangeError);
    expect(() => rng.nextInt(1.5)).toThrow(RangeError);
  });

  it("shuffle is deterministic for a fixed seed and does not mutate the input", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const rngA = new Xorshift64Star(deriveSeed(5n, "s"));
    const rngB = new Xorshift64Star(deriveSeed(5n, "s"));
    const shuffledA = rngA.shuffle(items);
    const shuffledB = rngB.shuffle(items);
    expect(shuffledA).toEqual(shuffledB);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // unmutated
    expect(shuffledA.slice().sort((a, b) => a - b)).toEqual(items); // same multiset
  });

  it("handles a zero seed without degenerating (xorshift64* requires non-zero state)", () => {
    const rng = new Xorshift64Star(0n);
    const values = Array.from({ length: 10 }, () => rng.nextU64());
    expect(new Set(values.map(String)).size).toBe(10);
  });
});
