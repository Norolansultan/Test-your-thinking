/**
 * SPEC/28 §3: CoT times from virtual time only — the incident day is Friday 26 July 2030, Finnish summer
 * time (UTC+3), virtual 0 = 13:20 local (the start of step 1).
 */

import { describe, expect, it } from "vitest";
import { civilFromDays, daysFromCivil, isoOfUtcMs, isoOfVirtual, utcMsOfIso, VIRTUAL_ZERO_UTC_MS, virtualOfIso } from "../../app/tak/time.js";
import { STEP_SECONDS, stepStartVirtual } from "../../app/scenario/views.js";
import { COT_STEP_SECONDS } from "../../app/tak/compile.js";

describe("isoOfVirtual (SPEC/28 §3)", () => {
  it("13:00 local is 2030-07-26T10:00:00.000Z (the spec's anchor; step W5 starts at virtual −1200)", () => {
    expect(stepStartVirtual(0)).toBe(-1200);
    expect(isoOfVirtual(-1200)).toBe("2030-07-26T10:00:00.000Z");
  });

  it("virtual 0 is 13:20 local = 10:20Z; the practice view (12:00) and the last horizon (20:00)", () => {
    expect(isoOfVirtual(0)).toBe("2030-07-26T10:20:00.000Z");
    expect(isoOfVirtual(-4800)).toBe("2030-07-26T09:00:00.000Z"); // VP, 12:00 local
    expect(isoOfVirtual(20 * 1200)).toBe("2030-07-26T17:00:00.000Z"); // end of step 20, 20:00 local
    expect(isoOfVirtual(12000)).toBe("2030-07-26T13:40:00.000Z"); // V8, the directive, 16:40 local
  });

  it("crosses midnight and keeps milliseconds", () => {
    expect(isoOfVirtual(13 * 3600 + 40 * 60)).toBe("2030-07-27T00:00:00.000Z"); // 03:00 local next day
    expect(isoOfVirtual(-(10 * 3600 + 20 * 60) - 1)).toBe("2030-07-25T23:59:59.000Z");
    expect(isoOfVirtual(0.25)).toBe("2030-07-26T10:20:00.250Z");
    expect(isoOfVirtual(1.0004)).toBe("2030-07-26T10:20:01.000Z");
  });

  it("agrees with the platform's own calendar over a wide range (checked here only; the module itself uses no Date)", () => {
    expect(VIRTUAL_ZERO_UTC_MS).toBe(Date.UTC(2030, 6, 26, 10, 20, 0));
    for (let ms = Date.UTC(1999, 11, 31, 23, 0, 0); ms < Date.UTC(2101, 2, 2); ms += 7_777_777_777) {
      expect(isoOfUtcMs(ms)).toBe(new Date(ms).toISOString());
      expect(utcMsOfIso(new Date(ms).toISOString())).toBe(ms);
    }
    for (const leap of ["2000-02-29T12:00:00.000Z", "2024-02-29T00:00:00.000Z", "2030-07-26T10:20:00.000Z"]) {
      expect(isoOfUtcMs(utcMsOfIso(leap))).toBe(leap);
    }
  });

  it("26 July 2030 is a Friday (SPEC/18 §2: a Friday in late July)", () => {
    const days = daysFromCivil(2030, 7, 26);
    expect((((days + 4) % 7) + 7) % 7).toBe(5); // 1970-01-01 was a Thursday (4); 5 = Friday
    expect(civilFromDays(days)).toEqual({ year: 2030, month: 7, day: 26 });
  });

  it("virtualOfIso inverts isoOfVirtual", () => {
    for (const t of [-4800, -1200, 0, 1, 1200, 12_345, 24_000]) expect(virtualOfIso(isoOfVirtual(t))).toBe(t);
    expect(virtualOfIso("2030-07-26T10:00:00Z")).toBe(-1200);
  });

  it("refuses non-UTC, malformed or impossible timestamps", () => {
    expect(() => utcMsOfIso("2030-07-26T13:00:00+03:00")).toThrow(SyntaxError);
    expect(() => utcMsOfIso("2030-02-30T00:00:00Z")).toThrow(RangeError);
    expect(() => utcMsOfIso("26.7.2030 13:00")).toThrow(SyntaxError);
    expect(() => isoOfVirtual(Number.NaN)).toThrow(RangeError);
  });

  it("the compiler's step length is the scenario's (SPEC/26 §2)", () => {
    expect(COT_STEP_SECONDS).toBe(STEP_SECONDS);
  });
});
