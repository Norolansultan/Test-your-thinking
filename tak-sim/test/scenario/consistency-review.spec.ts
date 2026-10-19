/**
 * The content-consistency review of 1 Oct 2026, one regression test per class of defect, against
 * the exported interaction log and the frozen bundle: refill timelines, drone batteries and the
 * allocation roster, on-scene time, one arrival per unit, escape routes, peat words and tasks,
 * road safety, area reports to the end, distances that follow the CA, Finnish wording and
 * repetition, the step-18 reconciling item, and the rekindle reported from the air.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { InteractionEvent } from "../../app/scenario/types.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { allocationAssets, buildAllocationSpace, rosterForView } from "../../app/scenario/allocation.js";
import { batteryTimeline } from "../../app/scenario/drone-battery.js";
import { AIR_PLAN } from "../../tools/fire-ca/deployment.js";
import { FIXED_ROADS } from "../../tools/topo-map/roads.js";
import { siteTrafficHelpers } from "../../tools/fire-ca/traffic.js";
import { isBog } from "../../tools/fire-ca/traffic-text.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";

const LOG: InteractionEvent[] = readFileSync("content/corpus/interaction-log.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as InteractionEvent);
const generated = LOG.filter((e) => e.id.startsWith("evt."));
const ign = wgs84ToTm35(SITE_SCENARIO.ignition);
const site = (q: LatLon) => { const t = wgs84ToTm35(q); return { x: t.eastM - ign.eastM, y: t.northM - ign.northM }; };
/** "16.17" or "16:17:04" → seconds after midnight. */
const secs = (hm: string) => { const [h, m, s] = hm.split(/[.:]/).map(Number); return h! * 3600 + m! * 60 + (s ?? 0); };

describe("item 1: one water delivery is one timeline (fix pass 2, 7 Oct 2026: the water shuttle's basin)", () => {
  // A crew's call for the shuttle names when the basin will be there: "perillä noin klo hh.mm", "arvio klo hh.mm" or "noin N min päästä".
  const calls = generated.filter((e) => e.event_type === "request" && /EK13 (tuo vettä|tulossa)|EK13:lta vesiajon/.test(e.content));
  const logs = generated.filter((e) => e.actor === "VESIHUOLTO" && /EK13 toi vettä .*:n linjalle/.test(e.content));
  const promised = (e: (typeof calls)[number]) => {
    const at = /klo (\d\d\.\d\d)/.exec(e.content);
    return at ? secs(at[1]!) : secs(e.timestamp) + Number(/noin (\d+) min päästä/.exec(e.content)![1]) * 60;
  };

  it("no crew's vehicle leaves its line for water, so no crew is left on a dead hose", () => {
    expect(generated.filter((e) => /Miehistö jää linjalle|automme lähtee nyt täyttämään|Ajoneuvo lähtee täyttämään/.test(e.content)).map((e) => e.id)).toEqual([]);
  });

  it("a crew's call is followed by the shuttle's delivery log when it said, ± 2 min", () => {
    expect(calls.length).toBeGreaterThan(3);
    for (const c of calls) {
      if (promised(c) > secs("20.00")) continue; // promised after the session's last step ends (safety re-check (ah): EK12's call at 19.58), never logged
      const log = logs.find((l) => l.content.includes(`vettä ${c.actor}:n linjalle`) && l.sim_time_s >= c.sim_time_s && l.sim_time_s - c.sim_time_s < 60 * 60);
      expect(log, c.id).toBeDefined();
      expect(Math.abs(secs(/klo (\d\d\.\d\d)\.$/.exec(log!.content)![1]!) - promised(c)) / 60, `${c.id} → ${log!.id}`).toBeLessThanOrEqual(2);
    }
  });

  it("no crew calls for the shuttle twice for one delivery", () => {
    for (const c of calls) {
      const next = logs.find((l) => l.content.includes(`vettä ${c.actor}:n linjalle`) && l.sim_time_s >= c.sim_time_s)!;
      const again = calls.filter((x) => x.actor === c.actor && x.id !== c.id && x.sim_time_s >= c.sim_time_s && x.sim_time_s < next.sim_time_s);
      expect(again.map((x) => x.id), c.id).toEqual([]);
    }
  });

  it("after a scripted refill the crew reports the full tank after the fill, not 'back in 20 minutes'", () => {
    expect(generated.some((e) => /Täydennys käynnissä, takaisin linjalle noin 20/.test(e.content))).toBe(false);
    const full = generated.filter((e) => /säiliö täynnä klo/i.test(e.content));
    expect(full.length).toBeGreaterThanOrEqual(2); // VPK (step 5) and EK12 (step 10); fix pass 3: EK11 no longer drives to W2
    for (const e of full) {
      const fill = generated.find((f) => f.actor === "VESIHUOLTO" && f.cycle === e.cycle && f.content.includes(`: ${e.actor} täytti säiliön`));
      expect(fill, e.id).toBeDefined();
      expect(fill!.sim_time_s, e.id).toBeLessThan(e.sim_time_s);
    }
  });
});

describe("items 2–3: one battery model for the log and the roster", () => {
  const readings = (id: string) => LOG.filter((e) => e.actor === id && /akku \d+ %/.test(e.content)).sort((a, b) => a.sim_time_s - b.sim_time_s);

  it("a drone's battery only falls between swaps, swaps at 20 %, and is near full after a swap", () => {
    for (const id of ["DR1", "DR2", "DR3", "VD1"]) {
      const rs = readings(id);
      expect(rs.length, id).toBeGreaterThan(3);
      let prev: { pct: number; swap: boolean; at: number } | null = null;
      for (const e of rs) {
        const pct = Number(/akku (\d+) %/.exec(e.content)![1]);
        const swap = /akku 20 %, (vaihto|laskeutuu)|akku 20 % klo/.test(e.content);
        if (swap) expect(pct, e.id).toBe(20);
        if (prev && !prev.swap && e.sim_time_s - prev.at < 20 * 60) expect(pct, `${e.id} after ${prev.pct} %`).toBeLessThanOrEqual(prev.pct);
        prev = { pct, swap, at: e.sim_time_s };
      }
    }
  });

  it("DR2 runs dry at the end of its long sortie, and only the battery model says 'kaikki akut tyhjinä'", () => {
    const dry = LOG.filter((e) => /kaikki akut tyhjinä/.test(e.content));
    expect(dry.map((e) => e.actor)).toEqual(["DR2"]);
    const steps = Object.keys(AIR_PLAN).map(Number).filter((n) => AIR_PLAN[n]!.DR2);
    expect(batteryTimeline("DR2", steps).dry.map((d) => d.atS)).toEqual([dry[0]!.sim_time_s]);
  });

  it("a drone with every pack empty at a decision point is not offered; with a charged pack it is", () => {
    // A synthetic day: DR2 flies steps 2–6 (13:40–15:20), runs dry at 15:14, first pack charged at 15:38.
    const steps = Array.from({ length: 8 }, (_, i) => ({ index: i, units: {}, aircraft: i >= 2 && i <= 6 ? [{ platformId: "DR2", kind: "drone" }] : [] }));
    const dr2 = allocationAssets({ units: [], steps } as unknown as Parameters<typeof allocationAssets>[0]).find((a) => a.id === "DR2")!;
    expect(dr2.unavailableInViews).toEqual([4]); // V4 (steps 5–6) decides at 15:20
    expect(rosterForView({ assets: [dr2] }, 4)).toEqual([]);
    expect(rosterForView({ assets: [dr2] }, 5).map((a) => a.id)).toEqual(["DR2"]);
  });

  it("in the frozen scenario DR2 is grounded 15:54–16:18 inside V6, and has a charged pack at V6's decision (16:20)", () => {
    const ids = (view: number) => rosterForView(buildAllocationSpace(), view).map((a) => a.id);
    expect(ids(6)).toEqual(expect.arrayContaining(["DR1", "DR2", "DR3"]));
    // 7 Oct 2026: DR3 (left for another fire) and EK16/KY23 (held by the region) are unavailable by design; DR2's battery never is.
    expect(buildAllocationSpace().assets.find((a) => a.id === "DR2")!.unavailableInViews).toBeUndefined();
  });
});

describe("items 4–6: arrivals, time on scene and escape routes", () => {
  it("units already working at the handover do not 'arrive' at 13:20; they say how long they have been there", () => {
    const step1 = generated.filter((e) => e.cycle === 1);
    expect(step1.some((e) => /^(VPK|EK12) saapunut/.test(e.content))).toBe(false);
    expect(step1.some((e) => /^VPK, .*olemme olleet täällä noin 1,3 h/.test(e.content))).toBe(true);
  });

  it("every unit arrives once", () => {
    const arrivals = new Map<string, string[]>();
    for (const e of LOG.filter((x) => /^\S+ saapunut\b/.test(x.content))) arrivals.set(e.actor, [...(arrivals.get(e.actor) ?? []), e.id]);
    for (const [id, recs] of arrivals) expect(recs, id).toHaveLength(1);
  });

  it("a late arrival's first size-up comes after its arrival message", () => {
    for (const s of generated.filter((e) => /ensimmäinen tilannearvio/.test(e.content))) {
      const arrival = LOG.find((e) => e.actor === s.actor && /saapunut/.test(e.content) && e.cycle === s.cycle);
      if (arrival) expect(arrival.sim_time_s, s.id).toBeLessThan(s.sim_time_s);
    }
  });

  it("one crew names one escape route in a step (size-up, answers, lateral traffic)", () => {
    for (const n of [1, 2]) {
      const routes = generated.filter((e) => e.actor === "EK11" && e.cycle === n).flatMap((e) => [...e.content.matchAll(/(?:perääntymistie|Perääntymistie):? \(?(tie R\d \w+|R1\/R2-risteys|johtopaikka)/g)].map((m) => m[1]));
      expect(new Set(routes).size, `step ${n}: ${routes.join(", ")}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("items 7–8: ground and flames", () => {
  const { landCoverAt } = siteTrafficHelpers();

  it("a crew's task is peat work only where the ground it reports is peat", () => {
    for (const st of SITE_SCENARIO.steps.filter((s) => s.index >= 1)) {
      for (const [id, w] of Object.entries(st.unitWork)) {
        if (w.task === "peat_soak") expect(isBog(landCoverAt(site(st.units[id]!))), `${id} step ${st.index}`).toBe(true);
      }
    }
  });

  it("drone 'ojanpenkat ja turve' only once the fire is on Rahkasuo (step 12 on)", () => {
    for (const e of generated.filter((x) => /ojanpenkat ja turve/.test(x.content))) expect(e.cycle, e.id).toBeGreaterThanOrEqual(12);
  });

  // SPEC/31 D1: from step 11 the bands are the flame table's (tools/fire-ca/flame-table.ts: 2–3, 3–4, 4–5, over 5 m).
  it("a drone calls a road unsafe only where its camera measures flames above 0.3 m at the road", () => {
    for (const e of generated.filter((x) => /ajo ei turvallista/.test(x.content))) expect(e.content, e.id).toMatch(/liekit (0,3–1 m|1–2 m|2–3 m|2–4 m|3–4 m|4–5 m|yli 5 m|puiden)/);
  });
});

describe("items 9–10: area and distances follow the CA", () => {
  it("the burned area is reported in every step to the end, and grows to the CA's reported area", () => {
    for (let n = 13; n <= 20; n++) expect(LOG.some((e) => e.cycle === n && /palanut ala/i.test(e.content)), `step ${n}`).toBe(true);
    const last = LOG.filter((e) => e.cycle === 20 && /Palanut ala noin ([\d,]+) ha/.test(e.content)).at(-1)!;
    expect(Number(/Palanut ala noin ([\d,]+) ha/.exec(last.content)![1]!.replace(",", "."))).toBeGreaterThan(140);
  });

  it("a drone's distance from R2 to the fire is the reported perimeter's distance to the road, within 50 m", () => {
    const r2 = FIXED_ROADS[5]!.line;
    const segD = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    const reports = generated.filter((e) => /tiehavainto: tie R2[^,]*, palo noin (\d+) m/.test(e.content));
    // Fewer since 2 Oct 2026 (the rekindled front reaches R2 only at steps 19–20); none since review fixes (ah), 9 Oct 2026: with the
    // re-authored evening winds the front stays ~500 m from R2 to 20:00, outside the drones' road-report range. The check stays for any.
    expect(reports.length).toBeGreaterThanOrEqual(0);
    for (const e of reports) {
      const st = SITE_SCENARIO.steps.find((s) => s.index === e.cycle)!;
      let geo = Infinity;
      for (const poly of [st.reported, ...st.reportedDetached]) for (const q of poly[0]!) { const p = site(q); for (let i = 0; i + 1 < r2.length; i++) geo = Math.min(geo, segD(p, r2[i]!, r2[i + 1]!)); }
      const said = Number(/palo noin (\d+) m/.exec(e.content)![1]);
      expect(Math.abs(said - geo), `${e.id}: said ${said}, CA ${Math.round(geo)}`).toBeLessThanOrEqual(50);
    }
  });

  it("the rekindle is reported at 17:01 from the air, ~120 m from the point of origin, and every distance to it agrees (2 Oct 2026: was ~1.6 km, the bog; 6 Oct: ~200 m before it was anchored to the burned edge)", () => {
    const rep = LOG.find((e) => e.id === "atom.demo.12.0")!;
    expect(rep.timestamp).toBe("17:01:00");
    expect(rep.actor).toBe("SPOT");
    expect(rep.actor_type).toBe("spotter_aircraft");
    expect(rep.content).toMatch(/noin 120 m syttymäkohdasta/);
    expect(AIR_PLAN[12]!.SPOT).toBe("patrol");
    // Fix pass 2 (7 Oct 2026, FF9): the old edge flaring up is an "uudelleensyttymä" (US1, US2), placed from the point of
    // origin, never a "pistepalo"; spot fires are placed against the current head, not "the edge in the previous image".
    expect(LOG.some((e) => /edellisen kuvan palon reunasta/.test(e.content))).toBe(false);
    const rekindles = LOG.filter((x) => /uudelleensyttymä US\d vahvistettu lämpökuvasta, noin (\d+) m syttymäkohdasta/.test(x.content));
    expect(rekindles.length).toBeGreaterThan(0);
    for (const e of rekindles) expect(Number(/noin (\d+) m syttymäkohdasta/.exec(e.content)![1]), e.id).toBeLessThan(400);
    expect(LOG.some((e) => /pistepalo US\d/i.test(e.content))).toBe(false);
    // No generic "no other smoke" from SPOT in the step it reports the open fire; its second pass (round 2,
    // 5 Oct 2026, recorded) measures the same fire.
    expect(LOG.filter((e) => e.actor === "SPOT" && e.cycle === 12).map((e) => e.id)).toEqual(["atom.demo.12.0", "atom.demo.12.1"]);
    expect(LOG.find((e) => e.id === "atom.demo.12.1")!.content).toMatch(/^SPOT, toinen ylilento klo 17\.10: syttymäkohdan kaakkoispuolen uusi palo/);
  });
});

describe("item 11: Finnish wording", () => {
  it("wind turns read 'lounaasta etelään', and no change is stated when the named direction is the same", () => {
    for (const e of generated) {
      expect(e.content, e.id).not.toMatch(/kääntyi noin klo \d\d\.\d\d (\p{L}+sta|\p{L}+stä) (\p{L}+sta|\p{L}+stä)\b/u);
      const m = /tulee nyt (\p{L}+) \(oli (\p{L}+)\)/u.exec(e.content);
      if (m) expect(m[1], e.id).not.toBe(m[2]);
    }
  });

  it("compass sides as compounds ('itäpuolella'), percentages within 0–100, hose in metres", () => {
    for (const e of generated) {
      expect(e.content, e.id).not.toMatch(/(itään|pohjoiseen|etelään|länteen|koilliseen|kaakkoon|lounaaseen|luoteeseen) puolella/);
      for (const m of e.content.matchAll(/(\d+) %/g)) expect(Number(m[1]), e.id).toBeLessThanOrEqual(100);
      expect(e.content, e.id).not.toMatch(/\d+ letkua teille/);
      expect(e.content, e.id).not.toMatch(/perääntymistie tie|Perääntymistie tie/);
    }
  });

  it("no stock phrase is said more than three times in the day", () => {
    for (const phrase of ["Kumpi ottaa välin? Ehdotan että me.", "Pitäkää radio auki", "porukka alkaa olla väsynyttä"]) {
      expect(generated.filter((e) => e.content.includes(phrase)).length, phrase).toBeLessThanOrEqual(3);
    }
  });
});

describe("item 12: the step-18 reconciling item (SPEC/18 §7.1)", () => {
  it("EK14 tells its neighbour on the north flank that something smokes east of the track, not theirs", () => {
    const r = LOG.find((e) => e.id === "atom.demo.contradiction.reconciling")!;
    expect(r.timestamp).toBe("19:03:20");
    expect(r.tier).toBe("T4_lateral");
    expect(r.actor).toBe("EK14");
    expect(r.addressee).toBe("EK15");
    expect(r.content).toBe("Uran itäpuolella savuaa jotain, ei meidän lohkoa.");
  });
});
