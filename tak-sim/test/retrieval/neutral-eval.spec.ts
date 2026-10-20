/**
 * The neutral evaluation set and its scoring (`tools/thinker/neutral-eval.ts`): every need
 * resolves at its view's gate, no need targets a designed event, and the metrics and the declared
 * selection rule behave as documented.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESIGNED_EVENT_IDS, type InteractionEvent } from "../../app/scenario/types.js";
import { gateStepOfView, loadCorpus } from "../../tools/thinker/eval-common.js";
import { aggregate, CANDIDATE_CONFIGS, resolveNeed, scoreQuestion, selectConfig, type NeutralEvalFile } from "../../tools/thinker/neutral-eval.js";

const file = JSON.parse(readFileSync(new URL("../../content/thinker/neutral-eval.json", import.meta.url), "utf8")) as NeutralEvalFile;
const corpus = loadCorpus();
const designed = new Set<string>(Object.values(DESIGNED_EVENT_IDS).flat());

describe("the neutral evaluation set", () => {
  it("has 25-34 questions over the declared topics, in views 1-14 (n31-n34 added after review)", () => {
    expect(file.questions.length).toBeGreaterThanOrEqual(25);
    expect(file.questions.length).toBeLessThanOrEqual(34);
    const topics = new Set(file.questions.map((q) => q.topic));
    for (const t of ["unit_status", "water", "wind", "spread_direction", "spot_fires", "evacuation", "road_access", "drone_findings", "sector_status", "lateral_coordination"]) expect(topics).toContain(t);
    for (const q of file.questions) expect(q.view >= 1 && q.view <= 14).toBe(true);
  });

  it("resolves every need at the view's gate, never to a designed-event record or a later step", () => {
    for (const q of file.questions) {
      const gate = gateStepOfView(q.view);
      for (const need of q.needs) {
        const ids = resolveNeed(need, corpus, gate);
        expect(ids.length, `${q.id} "${need.contains}"`).toBeGreaterThan(0);
        for (const id of ids) {
          expect(designed.has(id), `${q.id} targets ${id}`).toBe(false);
          expect(corpus.find((e) => e.id === id)!.cycle).toBeLessThanOrEqual(gate);
        }
      }
    }
  });

  it("asks nothing about the designed events", () => {
    for (const q of file.questions) expect(q.question).not.toMatch(/(^|\s)suo(n|lla|lta|sta)?\b|Rahkasuo|kyte|\b110\b|\bkV\b|voimajoh|sähkölinj|jännit|F7|pohjoisreuna/i);
  });
});

describe("scoring", () => {
  const ev = (id: string, cycle: number, actor: string, content: string) => ({ id, cycle, sim_time_s: cycle * 600, actor, event_type: "status", content }) as InteractionEvent;
  const tiny = [ev("a1", 1, "XY7", "Vettä 50 %"), ev("a2", 2, "XY7", "Vettä 20 %"), ev("a3", 3, "XY7", "Vettä 5 %")];

  it("'latest' picks the newest record at the gate; 'any' accepts all matches", () => {
    expect(resolveNeed({ actor: "XY7", contains: "vettä", pick: "latest", ids: [] }, tiny, 2)).toEqual(["a2"]);
    expect(resolveNeed({ actor: "XY7", contains: "vettä", pick: "any", ids: [] }, tiny, 3)).toEqual(["a3", "a2", "a1"]);
    expect(resolveNeed({ actor: "QZ1", contains: "vettä", pick: "any", ids: [] }, tiny, 3)).toEqual([]);
  });

  it("recall is the share of needs met; reciprocal rank is of the first record meeting any need", () => {
    const s = scoreQuestion("q", [["a2"], ["b9"]], ["x", "a2", "y"]);
    expect(s.recall).toBe(0.5);
    expect(s.reciprocalRank).toBe(0.5);
    expect(scoreQuestion("q", [["b9"]], ["x"]).reciprocalRank).toBe(0);
  });

  it("selects by recall, then MRR, then the earlier candidate", () => {
    const q = (recall: number, rr: number) => ({ id: "q", recall, reciprocalRank: rr, met: [], unresolved: 0 });
    const scores = [aggregate("a", [q(0.5, 1)]), aggregate("b", [q(0.8, 0.2)]), aggregate("c", [q(0.8, 0.2)]), aggregate("d", [q(0.8, 0.1)])];
    expect(selectConfig(scores).name).toBe("b");
    expect(CANDIDATE_CONFIGS[0]!.config.routineCollapse).toBeNull();
    expect(CANDIDATE_CONFIGS[0]!.config.maxPerSource).toBeNull();
  });
});
