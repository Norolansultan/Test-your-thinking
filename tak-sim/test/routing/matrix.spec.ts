/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M5: "`test/routing/matrix.spec`
 * asserts, cell by cell, that each condition can reach exactly what `02`
 * §2 says and nothing more."
 */

import { describe, expect, it } from "vitest";
import {
  assertConditionInUse,
  CAPABILITY_MATRIX,
  CONDITIONS_IN_USE,
  ConditionNotInUseError,
} from "../../app/routing/capability-matrix.js";

describe("CAPABILITY_MATRIX — identical-across-all-three surfaces (SPEC/02 §2)", () => {
  it.each(["directed", "assistive", "substitutive"] as const)("%s: map, envelope, status strip and unit status match the fixed baseline", (condition) => {
    const row = CAPABILITY_MATRIX[condition];
    expect(row.mapMarkersBubbles).toBe("identical");
    expect(row.projectionEnvelope).toBe("identical"); // both groups see the envelope, SPEC/02 revision (o) §1
    expect(row.statusStripReportRail).toBe("identical");
    expect(row.unitStatusAndAge).toBe(true);
    expect(row).not.toHaveProperty("categoryQueryBuilder"); // SPEC/25's builder is withdrawn
    expect(row.crossSourceFreeTextQuery).toBe(true); // search parity (researcher decision 6 Oct 2026): Haku's free text too
    expect(row.hakuChat).toBe(true); // 8 Oct 2026: Haku's chat is everyone's
  });

  it("the Open Thinker is the AI condition's alone (8 Oct 2026)", () => {
    expect(CAPABILITY_MATRIX.directed.openThinker).toBe(false);
    expect(CAPABILITY_MATRIX.substitutive.openThinker).toBe(true);
  });

  it.each(["directed", "assistive", "substitutive"] as const)("%s: no radio capability — the participant cannot transmit (SPEC/02 revision (j))", (condition) => {
    const row = CAPABILITY_MATRIX[condition];
    expect(row).not.toHaveProperty("radioAskFormation");
    expect(row).not.toHaveProperty("radioAskDutyOfficer");
  });
});

describe("CAPABILITY_MATRIX — cell by cell, exactly what SPEC/02 §2's table says", () => {
  it("directed: browse-only reference data, scroll/filter situation log, named-unit-only traffic, free text (search parity, 6 Oct 2026), no AI drawer, no pushed channel", () => {
    const row = CAPABILITY_MATRIX.directed;
    expect(row.referenceData).toBe("browse_by_map_object");
    expect(row.situationLog).toBe("scroll_and_filter");
    expect(row.trafficLog).toBe("request_by_named_unit_only");
    expect(row.crossSourceFreeTextQuery).toBe(true);
    expect(row.aiDrawerPresent).toBe(false);
    expect(row.pushedChannelSignals).toBe(false);
  });

  it("assistive: browse+free-text reference data, free-text situation log, queryable traffic log, free text yes, AI drawer yes, no pushed channel (the assistive-substitutive boundary)", () => {
    const row = CAPABILITY_MATRIX.assistive;
    expect(row.referenceData).toBe("browse_and_free_text");
    expect(row.situationLog).toBe("free_text_search");
    expect(row.trafficLog).toBe("query_by_unit_group_time_content");
    expect(row.crossSourceFreeTextQuery).toBe(true);
    expect(row.aiDrawerPresent).toBe(true);
    expect(row.pushedChannelSignals).toBe(false);
  });

  it("substitutive: same as assistive except traffic log is also summarised into the channel, and the channel pushes (the step SPEC/02 §2 calls out as the assistive-to-substitutive boundary)", () => {
    const row = CAPABILITY_MATRIX.substitutive;
    expect(row.referenceData).toBe("browse_and_free_text");
    expect(row.situationLog).toBe("free_text_search");
    expect(row.trafficLog).toBe("query_and_summarised_into_channel");
    expect(row.crossSourceFreeTextQuery).toBe(true);
    expect(row.aiDrawerPresent).toBe(true);
    expect(row.pushedChannelSignals).toBe(true);
  });
});

describe("CAPABILITY_MATRIX — the matrix is a ladder, not independent toggles", () => {
  it("assistive has everything directed has, plus more (never less)", () => {
    const directed = CAPABILITY_MATRIX.directed;
    const assistive = CAPABILITY_MATRIX.assistive;
    expect(assistive.crossSourceFreeTextQuery).toBe(true);
    expect(directed.crossSourceFreeTextQuery).toBe(true); // search parity (researcher decision 6 Oct 2026)
    expect(assistive.aiDrawerPresent).toBe(true);
    expect(directed.aiDrawerPresent).toBe(false);
    // Everything directed can do, assistive can also do (the "identical" surfaces plus radio/unit-status, already asserted above).
  });

  it("substitutive has everything assistive has, plus pushed channel signals (nothing is removed going up the ladder)", () => {
    const assistive = CAPABILITY_MATRIX.assistive;
    const substitutive = CAPABILITY_MATRIX.substitutive;
    expect(substitutive.referenceData).toBe(assistive.referenceData);
    expect(substitutive.situationLog).toBe(assistive.situationLog);
    expect(substitutive.crossSourceFreeTextQuery).toBe(assistive.crossSourceFreeTextQuery);
    expect(substitutive.aiDrawerPresent).toBe(assistive.aiDrawerPresent);
    expect(substitutive.pushedChannelSignals).toBe(true);
    expect(assistive.pushedChannelSignals).toBe(false); // the one thing substitutive adds that assistive lacks
  });

  it("only substitutive pushes channel signals — the one surface where nothing is knowable in the other two conditions", () => {
    expect(CAPABILITY_MATRIX.directed.pushedChannelSignals).toBe(false);
    expect(CAPABILITY_MATRIX.assistive.pushedChannelSignals).toBe(false);
    expect(CAPABILITY_MATRIX.substitutive.pushedChannelSignals).toBe(true);
  });
});

describe("CONDITIONS_IN_USE — SPEC/02 revisions (f)/(g), SPEC/04 revision (f)", () => {
  it("is exactly directed and substitutive", () => {
    expect(CONDITIONS_IN_USE).toEqual(["directed", "substitutive"]);
  });

  it("assistive is defined in the matrix (architecture preserved) but not configurable", () => {
    expect(CAPABILITY_MATRIX.assistive).toBeDefined();
    expect(CONDITIONS_IN_USE).not.toContain("assistive");
  });

  it("assertConditionInUse passes for directed and substitutive", () => {
    expect(() => assertConditionInUse("directed")).not.toThrow();
    expect(() => assertConditionInUse("substitutive")).not.toThrow();
  });

  it("assertConditionInUse rejects assistive — 'CI asserts no session is configured with assistive' (SPEC/04 revision (f))", () => {
    expect(() => assertConditionInUse("assistive")).toThrow(ConditionNotInUseError);
  });
});
