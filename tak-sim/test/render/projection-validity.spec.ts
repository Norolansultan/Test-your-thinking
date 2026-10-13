/** SPEC/12 §4: the projection's "ennuste voimassa klo … saakka" label, authored or derived from the horizon. */

import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { clockAtVirtual, projectionValidityLabel, projectionValidityLabelFi } from "../../app/render/projection-validity.js";

describe("the projection's validity label", () => {
  it("uses the envelope's authored label when there is one", () => {
    expect(projectionValidityLabelFi({ horizonLabel: "ennuste voimassa klo 17:20 saakka", horizonVirtual: asVirtualTime(0) })).toBe("ennuste voimassa klo 17:20 saakka");
  });

  it("otherwise derives it from the horizon, the next view's start", () => {
    expect(projectionValidityLabelFi({ horizonLabel: "", horizonVirtual: asVirtualTime(4800) })).toBe("ennuste voimassa klo 14:40 saakka");
    expect(clockAtVirtual(0)).toBe("13:20");
    expect(clockAtVirtual(-1200)).toBe("13:00");
  });

  it("in an English session reads \"forecast valid until HH:MM\", whatever the authored Finnish label", () => {
    expect(projectionValidityLabel({ horizonLabel: "ennuste voimassa klo 17:20 saakka", horizonVirtual: asVirtualTime(4800) }, "en")).toBe("forecast valid until 14:40");
    expect(projectionValidityLabel({ horizonLabel: "", horizonVirtual: asVirtualTime(4800) })).toBe("ennuste voimassa klo 14:40 saakka");
  });

  it("agrees with the derived time for every view of the demo scenario", () => {
    const s = buildDemoScenario();
    for (const e of [...s.envelopes, s.practice.envelope]) {
      expect(projectionValidityLabelFi({ horizonLabel: "", horizonVirtual: e.horizonVirtual })).toBe(e.horizonLabel);
    }
  });
});
