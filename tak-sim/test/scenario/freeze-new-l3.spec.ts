/**
 * SPEC/30 §5.1 (19 Oct 2026): the eight new L3 items of the phase-A freezes (two each in V2, V4, V5, V7), against SPEC/08's rules —
 * consequences the envelope does not draw; the numeric key REPORT-keyed with a margin; the cited keys against the data; not answerable by
 * recall of a record on hand (the generic check in `freeze-bank.spec.ts`); nothing that cues a keyed phase-B view; place names only from the
 * map or the records. DRAFT items: these tests pin the data the domain reviewer is asked to confirm.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemoScenario } from "../../app/scenario/demo-scenario.js";
import { SITE_SCENARIO } from "../../app/scenario/site-scenario.js";
import { CYCLE_STORY } from "../../app/scenario/demo-story.js";
import { distanceToTruthM, reportedPointDistanceAt, siteStep } from "../../app/scenario/freeze-keys.js";
import { BIRCH_STRIP, FORECAST_HEADLINE, FREEZE_BANK, V2_JUNCTION, VPK_RELIEF_RE } from "../../app/scenario/freeze-bank.js";
import type { CycleIndex } from "../../app/engine/primitives.js";
import type { FreezeItem } from "../../app/scenario/types.js";

const scenario = buildDemoScenario();
const F = SITE_SCENARIO.features;
const NEW: Readonly<Record<number, readonly string[]>> = {
  2: ["spruce_behaviour", "junction_hour"], 4: ["crown_drops", "korpioja_spot"], 5: ["ek14_shelter", "road_jump"], 7: ["cp_safe", "relief_next"],
};
const item = (view: number, slug: string): FreezeItem => scenario.freezes.find((f) => f.cycle === view)!.items.find((it) => it.id === `freeze.${view}.${slug}`)!;
const key = (view: number, slug: string) => item(view, slug).options.find((o) => o.correct)!.id;
const radio = (step: number) => SITE_SCENARIO.radio.filter((r) => r.cycle === step).map((r) => r.text);
const traffic = (step: number) => SITE_SCENARIO.traffic.filter((t) => t.cycle === step).map((t) => t.content);
const corpusTexts = [...SITE_SCENARIO.radio.map((r) => ({ step: r.cycle, text: r.text })), ...SITE_SCENARIO.traffic.map((t) => ({ step: t.cycle, text: t.content }))];
const firstStep = (re: RegExp) => Math.min(...corpusTexts.filter((t) => re.test(t.text)).map((t) => t.step));

describe("the eight new L3 items (SPEC/30 §5.1)", () => {
  it("are two choice items in each phase-A freeze, L3, with a goal, a DRAFT basis citing SPEC/30 and a key interval from the freeze's now", () => {
    for (const [view, slugs] of Object.entries(NEW)) for (const slug of slugs) {
      const def = FREEZE_BANK[Number(view)]!.find((d) => d.slug === slug)!;
      expect(def, `V${view} ${slug}`).toBeDefined();
      expect(def).toMatchObject({ level: "L3", kind: "choice" });
      expect(def.basis, slug).toMatch(/SPEC\/30 §5\.1 \(DRAFT[;)]/); // `31` re-authorings cite their finding after the DRAFT mark
      expect(item(Number(view), slug).options, slug).toHaveLength(4);
    }
    const goals = Object.entries(NEW).flatMap(([v, slugs]) => slugs.map((s) => item(Number(v), s).goal));
    expect(new Set(goals)).toEqual(new Set(["containment", "resources", "safety"]));
  });

  it("V2 junction_hour: REPORT-keyed 400–700 m with a margin over 50 m; the CA truth lies in the same band; the map now lies in another", () => {
    expect(V2_JUNCTION).toMatchObject({ id: "m400_700" });
    expect(V2_JUNCTION.margin).toBeGreaterThan(50);
    expect(key(2, "junction_hour")).toBe("m400_700");
    const truth = distanceToTruthM(5, F["R1_R2"]!);
    expect(truth).toBeGreaterThan(400 + 50);
    expect(truth).toBeLessThan(700 - 50);
    expect(reportedPointDistanceAt(2, 2, F["R1_R2"]!)).toBeGreaterThan(700); // what V2's map draws (step 2): the lure band
    expect(item(2, "junction_hour").promptFi).toMatch(/klo 15\.00\?$/); // play-test R1: the clock only (was "tunnin kuluttua")
  });

  it("V2 spruce_behaviour: the head reaches the Kuusimäki spruce edge (14:40) and crowns (15:00), and the CA head speeds up", () => {
    expect(CYCLE_STORY[5 as CycleIndex].bubbles[0]!.text).toMatch(/Kuusimäen kuusikon reunalla/);
    expect(CYCLE_STORY[6 as CycleIndex].bubbles[0]!.text).toMatch(/^Latvapalo alkanut/);
    expect(siteStep(6).headRos.achievedMpm).toBeGreaterThan(2 * siteStep(3).headRos.achievedMpm);
    expect(key(2, "spruce_behaviour")).toBe("crown");
    expect(firstStep(/latva/i)).toBeGreaterThan(3);
  });

  it("V4 crown_drops and korpioja_spot: the crown fire drops into the Koivuoja birch at 15:20; embers cross Myllyoja (Korpioja until play-test R5); Myllyoja is first named at step 7, Koivuoja's birch strip at step 4 (play-test D3); both are map labels", () => {
    expect(CYCLE_STORY[7 as CycleIndex].bubbles[0]!.text).toMatch(/^Latvapalo laskeutunut Koivuojan koivikkoon/);
    expect(distanceToTruthM(6, F["BIRCH"]!)).toBeLessThan(50); // the CA head is at the birch strip at the end of step 6
    expect(siteStep(8).wind.fromDeg).toBeLessThan(200); // the wind turns only after it (the "not before the wind turns" lure)
    expect(siteStep(7).wind.fromDeg).toBeGreaterThan(200);
    expect(radio(7).some((t) => /^Kipinät lensivät Myllyojan yli, uusi palo toisella puolella/.test(t))).toBe(true);
    expect(key(4, "crown_drops")).toBe("birch");
    expect(key(4, "korpioja_spot")).toBe("jumps");
    // Play-test D3 (24 Oct 2026): no generated record names Koivuoja before step 7, but DR1's pushed 14.27 terrain line (V3, a story beat)
    // states the birch strip along it, so crown_drops has a basis.
    expect(firstStep(/Koivuoj/)).toBe(7);
    expect(Math.min(...Object.entries(CYCLE_STORY).filter(([, v]) => v.bubbles.some((b) => /Koivuoj/.test(b.text))).map(([st]) => Number(st)))).toBe(4);
    const strip = scenario.atoms.find((a) => a.id === BIRCH_STRIP)!;
    expect(strip.tier).toBe("T1_pushed");
    expect(Number(strip.cycle)).toBe(4);
    expect(item(4, "crown_drops").basisAtomIds).toEqual([BIRCH_STRIP]);
    expect(firstStep(/Myllyoj/)).toBe(7);
    const labels = JSON.parse(readFileSync("content/site/build/topo-features.json", "utf8")) as { labels: { text: string }[] };
    for (const name of ["Koivuoja", "Myllyoja", "Kotkanjoki"]) expect(labels.labels.some((l) => l.text === name), name).toBe(true);
  });

  it("V5 ek14_shelter: the forecast turn is on record by the freeze; EK14 withdraws to the burned area at step 8 because the north flank goes downwind", () => {
    const wx = scenario.atoms.find((a) => a.id === "evt.wx.03")!;
    expect(Number(wx.cycle)).toBeLessThanOrEqual(7);
    // Play-test D7 (24 Oct 2026): P2 pushes the forecast's headline at 15.05 (V4's second step); the full forecast stays recorded.
    expect(item(5, "ek14_shelter").keyAtomIds).toEqual(["evt.wx.03", FORECAST_HEADLINE]);
    const headline = scenario.atoms.find((a) => a.id === FORECAST_HEADLINE)!;
    expect(headline.tier).toBe("T1_pushed");
    expect(Number(headline.cycle)).toBe(6);
    expect(item(5, "ek14_shelter").retrievalDependent).toBeUndefined();
    expect(radio(8).some((t) => /^EK14: vetäydymme tielle R1 palaneen alueen keskelle, turva-alueelle; .*alatuuleen/.test(t))).toBe(true); // radio ST-07: speech
    expect(key(5, "ek14_shelter")).toBe("shelter");
  });

  // SPEC/33 stage 9 (20 Oct 2026, the rebuilt map): no forest road crosses the crown run's path at Kuusimäki any more; the item asks
  // whether Koivuoja, which stopped the surface fire at 15.00–15.20, stops it next: embers cross it at 15.20–15.40 (step 8).
  it("V5 road_jump: Koivuoja stops the surface fire on record at step 7, and embers cross it at step 8 (EK11's stretch)", () => {
    expect(radio(7).some((t) => /^Palo pysähtyi Koivuojan kohdalle klo 15\.00–15\.20/.test(t))).toBe(true);
    expect(radio(7).some((t) => /^Kipinät lensivät Myllyojan yli, uusi palo/.test(t))).toBe(true);
    expect(radio(8).some((t) => /^Kipinät lensivät Koivuojan yli, uusi palo toisella puolella\. EK11 joutui vetäytymään/.test(t))).toBe(true);
    expect([...radio(7), ...radio(8)].some((t) => /Kuusimäki\)/.test(t))).toBe(false);
    expect(key(5, "road_jump")).toBe("again");
    expect(item(5, "road_jump").promptFi).toMatch(/klo 16\.00 mennessä\?$/); // play-test R1: the clock only (was "seuraavan 40 minuutin aikana")
  });

  it("V7 cp_safe: the CA fire keeps over 600 m from the command post for the hour; EK11 at the CP sees no fire at step 11", () => {
    for (const st of [10, 11, 12]) expect(distanceToTruthM(st, F["CP"]!), `step ${st}`).toBeGreaterThan(600);
    expect(traffic(11).some((t) => /^EK11, johtopaikka: ei paloa näköetäisyydellä/.test(t))).toBe(true);
    expect(key(7, "cp_safe")).toBe("stays");
  });

  it("V7 relief_next: after EK11, VPK has the most hours on the line by step 10 and asks for a relief unit at step 11", () => {
    const hours = new Map<string, number>();
    for (const e of SITE_SCENARIO.traffic.filter((t) => t.cycle <= 10)) {
      const m = /^(\w+) \(kysyttäessä\).*Miehistö ollut kentällä (\d+),(\d) h/.exec(e.content);
      if (m) hours.set(m[1]!, Number(`${m[2]}.${m[3]}`));
    }
    const ranked = ["VPK", "EK12", "EK14", "KY21"].sort((a, b) => hours.get(b)! - hours.get(a)!);
    expect(ranked[0]).toBe("VPK");
    expect(hours.get("VPK")! - hours.get(ranked[1]!)!).toBeGreaterThan(0.25); // VPK 4.0 h at 16:00, EK12 3.7 h at 16:20: ~0.6 h apart at one clock
    expect(traffic(11).some((t) => VPK_RELIEF_RE.test(t))).toBe(true); // gate R (R1): either generated wording
    expect(traffic(10).some((t) => /^EK11, Koivuoja: miehistö ollut kentällä 4,5 h\. Pyydämme vuoronvaihtoa/.test(t))).toBe(true);
    expect(key(7, "relief_next")).toBe("VPK");
  });

  it("cue no keyed phase-B view or designed event: no new item names the south-east, Lahdenkylä, R2's south, the origin's south edge, a flare-up or the line", () => {
    for (const [view, slugs] of Object.entries(NEW)) for (const slug of slugs) {
      const it = item(Number(view), slug);
      const words = [it.promptFi, ...it.options.map((o) => o.labelFi)].join(" ");
      expect(words, it.id).not.toMatch(/kaakkoisrintam|Lahdenkyl|Rahkasuo|Honkaharju|syttymäkoh|uudelleen|kyte|leimah|(?:110|20) kV|voimajoh|sähkölinj|helikop|HELI/i);
    }
  });
});
