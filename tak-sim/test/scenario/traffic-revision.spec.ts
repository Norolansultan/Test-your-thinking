/**
 * The traffic corpus revision of 1 Oct 2026 (review items 1–7), against the frozen bundle and the
 * exported interaction log: places follow deployment, drones agree with the reported fire, the
 * deliberate BOG-S coverage gap of V7–V9 is kept but never stated (researcher decision 1 Oct
 * 2026: drones report only what they observed), tanks drain and refill, lateral
 * traffic and simultaneous reports are not copies, crews make requests, and the designed records
 * (F7, the rekindle arc) are untouched.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import type { InteractionEvent } from "../../app/scenario/types.js";
import type { LatLon } from "../../app/engine/primitives.js";
import { PRACTICE_UNITS, UNIT_PLAN } from "../../tools/fire-ca/deployment.js";
import { ANCHOR_PLACE, deployedPlace } from "../../tools/fire-ca/traffic-places.js";
import { BOG_S_POINTS } from "../../tools/fire-ca/traffic-drones.js";
import { wgs84ToTm35 } from "../../tools/fire-ca/tm35.js";
import { labelledHeader } from "../../app/retrieval/routine-collapse.js";

const LOG: InteractionEvent[] = readFileSync("content/corpus/interaction-log.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as InteractionEvent);
const TRAFFIC = SITE_SCENARIO.traffic;
const generated = (e: InteractionEvent) => e.id.startsWith("evt.");
const ign = wgs84ToTm35(SITE_SCENARIO.ignition);
const site = (q: LatLon) => { const t = wgs84ToTm35(q); return { x: t.eastM - ign.eastM, y: t.northM - ign.northM }; };
type Pt = { x: number; y: number };
function inRing(p: Pt, ring: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const ringsOf = (polys: readonly (readonly (readonly LatLon[])[])[]) => polys.map((poly) => poly[0]!.map(site));
const stepOf = (n: number) => SITE_SCENARIO.steps.find((s) => s.index === n)!;
/** Whether any reported fire of step n lies inside a disc. */
function fireInDisc(n: number, c: Pt, r: number): boolean {
  const st = stepOf(n);
  const rings = ringsOf([st.reported, ...st.reportedDetached]);
  for (let a = 0; a < 360; a += 15) for (const k of [0, 0.5, 1]) {
    const p = { x: c.x + Math.sin((a * Math.PI) / 180) * r * k, y: c.y + Math.cos((a * Math.PI) / 180) * r * k };
    if (rings.some((ring) => inRing(p, ring))) return true;
  }
  return rings.some((ring) => ring.some((q) => Math.hypot(q.x - c.x, q.y - c.y) <= r));
}

describe("item 1: a unit's place follows its deployment", () => {
  it("every generated record by a unit carries the place of the unit's current deployment", () => {
    // The water shuttle has no deployment after the handover: its place is where its run has it (fix pass 2, 7 Oct 2026).
    for (const e of TRAFFIC.filter((x) => UNIT_PLAN[x.actor] !== undefined && !UNIT_PLAN[x.actor]!.shuttle && x.cycle >= 1)) {
      // A stale step (AVL drift, dead zone) still names the place the map shows: the deployment before it (A3, 6 Oct 2026).
      // Review fixes (ah), M8: the AVL record after a move the stale map does not show yet names the new place.
      const avlAfterMove = /^AVL /.test(e.content) && UNIT_PLAN[e.actor]!.moves.some((m) => m.cycle === e.cycle);
      const shownStep = UNIT_PLAN[e.actor]!.stale?.includes(e.cycle) && !avlAfterMove ? e.cycle - 1 : e.cycle;
      expect(e.place, e.id).toBe(deployedPlace(e.actor, shownStep)!.place);
    }
    // The practice step (W2): the place of the practice deployment; EK12 is still on its way.
    for (const e of TRAFFIC.filter((x) => x.cycle < 1 && PRACTICE_UNITS[x.actor] !== undefined)) {
      expect(e.place, e.id).toBe(ANCHOR_PLACE[PRACTICE_UNITS[e.actor]!]!.place);
    }
  });

  it("VPK is on the origin's south edge after its step-9 move and on the north flank after step 10, never the L4 mop-up place there (2 Oct 2026: was Rahkasuo)", () => {
    for (const e of LOG.filter((x) => x.actor === "VPK" && x.cycle >= 9 && x.cycle <= 12)) expect(e.place, e.id).not.toBe("syttymäkohta");
    expect(LOG.find((e) => e.actor === "VPK" && e.cycle === 9 && /^VPK siirtyy syttymäkohdan eteläreunalle/.test(e.content))!.place).toBe("Syttymäkohdan eteläreuna"); // by content: EK11's 16:00 return now comes first (safety re-check (ah))
    expect(LOG.filter((e) => e.actor === "VPK" && e.cycle === 11 && generated(e)).every((e) => e.place === "pohjoisreuna, Karhujärven puoli")).toBe(true);
  });
});

describe("item 2: drone thermal reports agree with the reported fire under the camera", () => {
  const thermal = TRAFFIC.filter((e) => e.actor_type === "drone" && /lämpökuva, /.test(e.content));
  it("'no fire in the frame' only where no reported fire is under the footprint, and a moving edge only where there is", () => {
    expect(thermal.length).toBeGreaterThan(15);
    for (const e of thermal) {
      const air = stepOf(e.cycle).aircraft.find((a) => a.platformId === e.actor)!;
      const fp = air.footprint![0]!.map(site);
      const c = { x: fp.reduce((s, p) => s + p.x, 0) / fp.length, y: fp.reduce((s, p) => s + p.y, 0) / fp.length };
      const any = fireInDisc(e.cycle, c, 300);
      if (/kuva-alalla ei paloa/.test(e.content)) expect(any, e.id).toBe(false);
      if (/reuna etenee|erillinen palo/.test(e.content)) expect(any, e.id).toBe(true);
    }
  });

  it("at V9 (17:0x) no drone images the origin's south edge: DR2 is over the north flank (2 Oct 2026; SPOT reports the flare-up)", () => {
    const dr2 = thermal.filter((e) => e.actor === "DR2" && e.cycle === 12);
    expect(dr2.length).toBe(1);
    expect(dr2[0]!.place).toBe("pohjoisreuna, Karhujärven puoli");
    for (const e of thermal.filter((x) => x.cycle === 12)) expect(e.place, e.id).not.toBe("eteläreuna (L3)");
  });

  it("once crews are back on the old south edge (step 13), the drone over it reports the rekindled front", () => {
    const dr2 = thermal.filter((e) => e.actor === "DR2" && e.cycle === 13);
    expect(dr2.length).toBe(1);
    expect(dr2[0]!.content).toMatch(/erillinen palo|reuna etenee/);
    expect(dr2[0]!.place).toBe("eteläreuna (L3)");
  });

  it("offers more than the old 15 templates: rate, intensity, plume, roads, water, people, coverage, battery, confidence", () => {
    const drone = TRAFFIC.filter((e) => e.actor_type === "drone" || e.actor === "DRONERYHMÄ").map((e) => e.content);
    for (const re of [/mittaus: .* m\/min/, /Intensiteettiluokka \d\/5/, /savupatsas/, /tiehavainto/, /vesipiste W\d/, /Mökkiranta: 14 mökkiä/, /Droneryhmä klo .*: ilmassa/, /akku 20 %/, /laskeutuu klo/, /luotettavuus (hyvä|kohtalainen|heikko)/]) {
      expect(drone.some((c) => re.test(c)), String(re)).toBe(true);
    }
  });
});

describe("the deliberate BOG-S coverage gap, V7–V9 (SPEC/26 §5)", () => {
  it("no drone camera covers Rahkasuo in steps 10–12", () => {
    for (const n of [10, 11, 12]) {
      for (const a of stepOf(n).aircraft.filter((x) => x.kind === "drone" && x.footprint)) {
        const ring = a.footprint![0]!.map(site);
        for (const p of BOG_S_POINTS) expect(inRing(p, ring), `${a.platformId} step ${n}`).toBe(false);
      }
    }
  });

  it("no generated record states that a place was not imaged (only what was observed is reported)", () => {
    for (const e of LOG.filter(generated)) {
      expect(e.content, e.id).not.toMatch(/Kuvaamatta|ei ole kuva-alalla|ilman lämpökuvaa|ei lämpökuvaa|ei kuvattu klo/);
    }
  });

  it("no generated record in steps 10–11 says anything hot about the bog", () => {
    for (const e of TRAFFIC.filter((x) => x.cycle >= 10 && x.cycle <= 11)) {
      for (const sentence of e.content.split(/(?<=\.)\s/)) {
        if (/Rahkasuo|suo\b|suon\b|turve/i.test(sentence)) expect(sentence, e.id).not.toMatch(/kyt|kuum|liek|savua|lämpöpist|avotul/i);
      }
    }
  });
});

describe("item 3: tanks drain and refill", () => {
  const levels = new Map<string, number[]>();
  for (const e of TRAFFIC.filter((x) => x.tier === "T3_person")) {
    const m = /Vettä säiliössä noin (\d+) %/.exec(e.content);
    if (m) levels.set(e.actor, [...(levels.get(e.actor) ?? []), Number(m[1])]);
  }
  it("levels go both down and up for most tank units", () => {
    const both = [...levels.values()].filter((xs) => xs.some((x, i) => i > 0 && x < xs[i - 1]!) && xs.some((x, i) => i > 0 && x > xs[i - 1]! + 20));
    expect(both.length).toBeGreaterThanOrEqual(5);
  });
  it("no unit sits at or under 15 % for more than three answers in a row", () => {
    for (const [id, xs] of levels) {
      let run = 0;
      for (const x of xs) { run = x <= 15 ? run + 1 : 0; expect(run, id).toBeLessThanOrEqual(3); }
    }
  });
  it("refills are logged by the water supply", () => {
    expect(TRAFFIC.filter((e) => e.actor === "VESIHUOLTO").length).toBeGreaterThanOrEqual(10);
  });
});

describe("items 4, 5, 7: lateral traffic, simultaneous reports, requests", () => {
  it("lateral traffic is mostly distinct (ratio ≥ 0.7)", () => {
    const lat = LOG.filter((e) => e.tier === "T4_lateral");
    expect(new Set(lat.map((e) => e.content)).size / lat.length).toBeGreaterThanOrEqual(0.7);
  });
  // Generated records only: the scripted move radio (deployment.ts) is designed and has KY21 and VPK return with one reason.
  it("no two units send the same generated content in the same minute (unit ids aside)", () => {
    const seen = new Map<string, string>();
    for (const e of LOG.filter(generated)) {
      const key = `${e.timestamp.slice(0, 5)}|${e.content.split(e.actor).join("#")}`;
      const other = seen.get(key);
      if (other !== undefined) expect(other, `${e.id}: ${e.content}`).toBe(e.actor);
      seen.set(key, e.actor);
    }
  });
  it("crews make a realistic number of requests to command", () => {
    expect(LOG.filter((e) => e.event_type === "request" && e.addressee === "JOHTO").length).toBeGreaterThanOrEqual(30);
  });
});

describe("designed records unchanged", () => {
  const byId = new Map(LOG.map((e) => [e.id, e]));
  it("the rekindle arc and F7 read and time as authored", () => {
    expect(byId.get("rekindle.objection")).toMatchObject({ timestamp: "16:21:05", actor: "VPK", content: "Syttymäkohdan reunalla kannot ja hakkuutähteet voivat vielä kyteä pinnan alla. Jos tuuli kääntyy, se voi syttyä uudelleen. Pitäisi tarkistaa lämpökameralla ennen kuin lähdetään." });
    expect(byId.get("rekindle.overruled")).toMatchObject({ actor: "KY21", content: "Ei ole väkeä tarkistukseen. Lohko on hallinnassa, siirrytään L1:lle." });
    expect(byId.get("t4.private_doubt")).toMatchObject({ cycle: 11, actor: "VPK", content: "Meidät käskettiin pois syttymäkohdan eteläreunalta. En ole ollenkaan varma, että vanha reuna pitää, jos tuuli kääntyy." });
    expect(byId.get("f7.planted_record")).toMatchObject({ cycle: 8, content: "110 kV linja jännitteetön, vahvistettu." });
    expect(byId.get("f7.grid_record")!.cycle).toBe(6);
  });
  it("no generated record touches the power line, so nothing corrects F7", () => {
    for (const e of LOG.filter(generated)) expect(e.content, e.id).not.toMatch(/110 kV|voimajohto|jännite/i);
  });
});

describe("periodic lines carry a labelled header (app/retrieval/routine-collapse.ts)", () => {
  it("every recorded drone, water-supply, weather, AVL and asked-for line opens with 'label: '", () => {
    const periodic = TRAFFIC.filter((e) => (e.tier === "T2_system" || e.tier === "T3_person") && e.channel !== "radio_lateral" && e.channel !== "radio_command");
    expect(periodic.length).toBeGreaterThan(300);
    for (const e of periodic) expect(labelledHeader(e.content, e.actor), `${e.id}: ${e.content}`).not.toBeNull();
  });
});

describe("participant-facing text", () => {
  it("carries no internal design codes", () => {
    const codes = /BOG[-_]S|\bL1B\b|RIDGE|CABINS|VILLAGE|\b(?:edge|orbit|scoop|at):/;
    expect(TRAFFIC.filter((e) => codes.test(e.content)).map((e) => e.content)).toEqual([]);
  });
});
