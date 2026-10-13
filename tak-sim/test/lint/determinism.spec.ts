import { describe, expect, it } from "vitest";
import { scanForBannedApis } from "../../tools/validate/determinism-lint.js";

describe("scanForBannedApis — fixture proof (does the linter actually catch things)", () => {
  it("flags every banned API in the deliberately bad fixture", () => {
    const violations = scanForBannedApis("test/lint/fixtures/bad-determinism");
    const rules = new Set(violations.map((v) => v.rule));
    expect(rules).toEqual(
      new Set([
        "no-date-now",
        "no-crypto-random-uuid",
        "no-math-random",
        "no-sort-without-comparator",
        "no-network-fetch",
      ]),
    );
  });

  it("does not flag the line exempted by an allowlist comment", () => {
    const violations = scanForBannedApis("test/lint/fixtures/bad-determinism");
    expect(violations.some((v) => v.rule === "no-performance-now")).toBe(false);
  });

  it("reports zero violations on a clean fixture", () => {
    expect(scanForBannedApis("test/lint/fixtures/clean-determinism")).toEqual([]);
  });

  it("returns an empty array for a non-existent directory rather than throwing", () => {
    expect(scanForBannedApis("test/lint/fixtures/does-not-exist")).toEqual([]);
  });
});

describe("scanForBannedApis — the real engine (M1 acceptance: no banned API reachable from engine/)", () => {
  it("app/engine is clean", () => {
    const violations = scanForBannedApis("app/engine");
    if (violations.length > 0) {
      const detail = violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`).join("\n");
      throw new Error(`Determinism violations found in app/engine:\n${detail}`);
    }
    expect(violations).toEqual([]);
  });

  it("app/telemetry is clean except explicitly allowlisted wall-clock annotation code", () => {
    const violations = scanForBannedApis("app/telemetry");
    expect(violations).toEqual([]);
  });
});
