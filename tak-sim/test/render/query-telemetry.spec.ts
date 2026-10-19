/**
 * Query composition records (SPEC/30 §5.4, SPEC/07 §2.5): `query_focus`, `query_first_keystroke` once per composition,
 * `query_edit` per deletion run with a count and never the text (SPEC/07 §3), each with its field and view. The rule is
 * tested without a DOM; the wiring of the index search's free text is checked at the source.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QueryInputTracker, type QueryEvent } from "../../app/render/ui/useQueryTelemetry.js";

function tracker(cycle: number | null = 3) {
  const out: QueryEvent[] = [];
  return { t: new QueryInputTracker((e) => out.push(e), "thinker_chat", () => cycle ?? undefined), out };
}

/** Types `text` one character at a time from `from`. */
const type = (t: QueryInputTracker, from: string, text: string): string => {
  let v = from;
  for (const ch of text) { v += ch; t.input(v); }
  return v;
};

describe("QueryInputTracker", () => {
  it("logs the focus and the composition's first keystroke once, with the field and the view", () => {
    const { t, out } = tracker();
    t.focus("");
    type(t, "", "Where is EK11?");
    expect(out).toEqual([
      { kind: "query_focus", detail: { field: "thinker_chat", cycle: 3 } },
      { kind: "query_first_keystroke", detail: { field: "thinker_chat", cycle: 3 } },
    ]);
  });

  it("counts a backspace run when typing resumes, and a clearing at once", () => {
    const { t, out } = tracker();
    t.focus("");
    let v = type(t, "", "head rate");
    for (let i = 0; i < 4; i++) { v = v.slice(0, -1); t.input(v); } // "head "
    v = type(t, v, "speed");
    t.input(""); // select all, delete
    expect(out.filter((e) => e.kind === "query_edit")).toEqual([
      { kind: "query_edit", detail: { count: 4, field: "thinker_chat", cycle: 3 } },
      { kind: "query_edit", detail: { count: "head speed".length, field: "thinker_chat", cycle: 3 } },
    ]);
  });

  it("ends a run on blur, and a send that empties the field starts a new composition", () => {
    const { t, out } = tracker();
    t.focus("");
    let v = type(t, "", "abc");
    v = v.slice(0, -2); t.input(v);
    t.blur();
    expect(out.at(-1)).toEqual({ kind: "query_edit", detail: { count: 2, field: "thinker_chat", cycle: 3 } });
    t.focus(v);
    type(t, v, "x");
    t.valueSet(""); // sent: the screen emptied the field (focus stays)
    type(t, "", "next");
    expect(out.map((e) => e.kind)).toEqual(["query_focus", "query_first_keystroke", "query_edit", "query_focus", "query_first_keystroke", "query_first_keystroke"]);
    t.valueSet("next"); // the screen shows what was typed: no change
    expect(out).toHaveLength(6);
  });

  it("never carries the text, and leaves the view out where the component has none", () => {
    const { t, out } = tracker(null);
    t.focus("");
    let v = type(t, "", "salainen kysymys");
    v = v.slice(0, -5); t.input(v);
    t.blur();
    const json = JSON.stringify(out);
    for (const word of ["salainen", "kysymys", "kysy"]) expect(json).not.toContain(word);
    expect(out[0]).toEqual({ kind: "query_focus", detail: { field: "thinker_chat" } });
  });
});

describe("the index search's free text (Drawers.tsx)", () => {
  it("is bound to the tracker as field haku_search", () => {
    const src = readFileSync("app/render/ui/components/Drawers.tsx", "utf8");
    expect(src).toMatch(/useQueryTelemetry\("haku_search", orchestrator, cycle, text\)/);
    expect(src).toMatch(/value=\{text\} \{\.\.\.typing\.props\(setText\)\}/);
  });
});
