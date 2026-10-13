import { describe, expect, it } from "vitest";
import {
  DisplayValue,
  certaintyStrokeStyle,
  encodeDisplayValue,
  hueRolesAreDistinct,
  rateMarkText,
  stalenessOf,
} from "../../app/render/visual-encoding.js";

describe("stalenessOf — SPEC/12 §8 bands (0-5 / 5-15 / 15-40 / 40+ min -> 100/85/70/55%)", () => {
  it.each([
    [0, "fresh", 100],
    [60, "fresh", 100], // 1 min
    [4 * 60 + 59, "fresh", 100], // just under 5 min
    [5 * 60, "aging", 85], // exactly 5 min — boundary belongs to the next band
    [10 * 60, "aging", 85],
    [15 * 60, "old", 70], // exactly 15 min
    [39 * 60, "old", 70],
    [40 * 60, "very_stale", 55], // exactly 40 min
    [120 * 60, "very_stale", 55],
  ] as const)("age %i s -> bucket %s, opacity %i%%", (ageSeconds, bucket, opacity) => {
    const result = stalenessOf(ageSeconds);
    expect(result.bucket).toBe(bucket);
    expect(result.opacityPercent).toBe(opacity);
  });

  it("always carries the printed age (the required redundant channel)", () => {
    expect(stalenessOf(90).ageMinutes).toBeCloseTo(1.5);
  });

  it("rejects a negative age", () => {
    expect(() => stalenessOf(-1)).toThrow(RangeError);
  });

  it("rejects a non-finite age", () => {
    expect(() => stalenessOf(NaN)).toThrow(RangeError);
    expect(() => stalenessOf(Infinity)).toThrow(RangeError);
  });

  it("the four buckets are pairwise distinct in both bucket name and opacity", () => {
    const samples = [0, 6 * 60, 20 * 60, 60 * 60].map(stalenessOf);
    const buckets = new Set(samples.map((s) => s.bucket));
    const opacities = new Set(samples.map((s) => s.opacityPercent));
    expect(buckets.size).toBe(4);
    expect(opacities.size).toBe(4);
  });
});

describe("certaintyStrokeStyle — SPEC/12 §4.2", () => {
  it.each([
    [{ kind: "confirmed" as const }, "solid"],
    [{ kind: "probable" as const, basis: "x" }, "solid_light"],
    [{ kind: "uncertain" as const, basis: "x" }, "dashed"],
    [{ kind: "unknown" as const }, "dashed_with_badge"],
  ] as const)("%o -> %s", (certainty, style) => {
    expect(certaintyStrokeStyle(certainty)).toBe(style);
  });

  it("all four values are pairwise distinct stroke styles", () => {
    const styles = new Set(
      [{ kind: "confirmed" as const }, { kind: "probable" as const, basis: "x" }, { kind: "uncertain" as const, basis: "x" }, { kind: "unknown" as const }].map(
        certaintyStrokeStyle,
      ),
    );
    expect(styles.size).toBe(4);
  });
});

describe("encodeDisplayValue — SPEC/06 §3: unknown, absent, zero and stale each have a distinct visual form", () => {
  it("unknown gets the unknown badge and the literal 'ei tiedossa' text — never an empty cell", () => {
    const v: DisplayValue<number> = { kind: "unknown" };
    const encoding = encodeDisplayValue(v);
    expect(encoding.badge).toBe("unknown_badge");
    expect(encoding.requiredRedundantText).toBe("ei tiedossa");
    expect(encoding.requiredRedundantText).not.toBe("");
  });

  it("absent renders as nothing at all — no badge, no text, distinct from unknown", () => {
    const v: DisplayValue<number> = { kind: "absent" };
    const encoding = encodeDisplayValue(v);
    expect(encoding.badge).toBe("none");
    expect(encoding.staleness).toBeNull();
  });

  it("zero is a real informative value, not treated as nothing", () => {
    const v: DisplayValue<number> = { kind: "zero", ageSeconds: 30 };
    const encoding = encodeDisplayValue(v);
    expect(encoding.badge).toBe("none");
    expect(encoding.requiredRedundantText).toBe("0");
    expect(encoding.staleness).not.toBeNull();
  });

  it("a present non-zero value carries its age as the redundant text", () => {
    const v: DisplayValue<number> = { kind: "present", value: 9, ageSeconds: 300 };
    const encoding = encodeDisplayValue(v);
    expect(encoding.requiredRedundantText).toBe("5 min");
  });

  it("the four states are pairwise distinguishable by (badge, hasStaleness, redundantText) — no two collapse to the same encoding", () => {
    const states: DisplayValue<number>[] = [
      { kind: "unknown" },
      { kind: "absent" },
      { kind: "zero", ageSeconds: 0 },
      { kind: "present", value: 5, ageSeconds: 0 },
    ];
    const signatures = states.map((s) => {
      const e = encodeDisplayValue(s);
      return `${e.badge}|${e.staleness !== null}|${e.requiredRedundantText}`;
    });
    expect(new Set(signatures).size).toBe(4);
  });

  it("zero is never mistaken for absent by naive truthiness — the discriminant, not the value, decides", () => {
    // The bug this type exists to prevent: `value || fallback` would treat 0 as falsy.
    const zero: DisplayValue<number> = { kind: "zero", ageSeconds: 0 };
    expect(zero.kind).toBe("zero");
    expect(zero.kind).not.toBe("absent");
  });
});

describe("hueRolesAreDistinct — SPEC/12 §8.1: reported perimeter and projection envelope must never share a hue", () => {
  it("reported_perimeter and projection_envelope are distinct", () => {
    expect(hueRolesAreDistinct("reported_perimeter", "projection_envelope")).toBe(true);
  });

  it("every pair of the six named roles is pairwise distinct (no accidental hue collision)", () => {
    const roles = ["own_formation", "reported_perimeter", "projection_envelope", "participant_correction", "value_at_risk", "basemap"] as const;
    for (let i = 0; i < roles.length; i++) {
      for (let j = i + 1; j < roles.length; j++) {
        expect(hueRolesAreDistinct(roles[i]!, roles[j]!)).toBe(true);
      }
    }
  });

  it("a role compared with itself is (trivially) not distinct", () => {
    expect(hueRolesAreDistinct("own_formation", "own_formation")).toBe(false);
  });
});

describe("rateMarkText (SPEC/12 §5; fix pass 4)", () => {
  it("prints a measured rate as a figure and a rate judged by eye as a band marked as an estimate", () => {
    expect(rateMarkText({ rateMetresPerMinute: 8.8 }, "fi")).toBe("noin 8,8 m/min");
    expect(rateMarkText({ rateMetresPerMinute: 8.8 }, "en")).toBe("about 8.8 m/min");
    expect(rateMarkText({ rateMetresPerMinute: 8, rateBand: [6, 10] }, "fi")).toBe("noin 6–10 m/min, arvio");
    expect(rateMarkText({ rateMetresPerMinute: 8, rateBand: [6, 10] }, "en")).toBe("about 6–10 m/min, estimate");
  });
});
