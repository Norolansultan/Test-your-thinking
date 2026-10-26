/**
 * The generated relations of the geometry contract (SPEC/33 §3): what each relation measures and who uses it. Values and
 * tolerances are filled in by `contract-extract.ts` from the map built now. Sources of each dependency: SPEC/18 §5 and revisions
 * (k)–(ay), SPEC/23 §4 and §12–§15, and the code paths cited in `usedBy`.
 *
 * Feature ids are `contract-map.ts` FEATURE_CATALOGUE's; `anchor.*` are deployment.ts FEATURES (unit, water and drone points).
 */

import { PLACE_NAMES_EN } from "../../../app/i18n/place-names.js";
import type { UsedBy } from "./contract.js";
import type { RelationSpec } from "./contract-extract.js";

const u = (file: string, id?: string, note?: string): UsedBy => ({ file, ...(id ? { id } : {}), ...(note ? { note } : {}) });
const up = (file: string, pattern: string, note?: string): UsedBy => ({ file, pattern, ...(note ? { note } : {}) });

const FB = "app/scenario/freeze-bank.ts", FBB = "app/scenario/freeze-bank-b.ts", DP = "app/scenario/demo-probes.ts", DD = "app/scenario/demo-directive.ts";
const DEP = "tools/fire-ca/deployment.ts", S18 = "tools/fire-ca/scenario-18.ts", TD = "tools/fire-ca/traffic-drones.ts", TW = "tools/fire-ca/traffic-water.ts";
const TR = "tools/fire-ca/traffic.ts", TP = "tools/fire-ca/traffic-places.ts", CR = "tools/fire-ca/crossings.ts", ST = "app/scenario/demo-story.ts";
const SM = "app/scenario/source-memory.ts", PE = "content/thinker/premise-evidence.json", BUNDLE = "app/scenario/site-scenario.json";
const TPL = "SPEC/23_Site_Selection.md §4", FK = "app/scenario/freeze-keys.ts";

/** SPEC/18 §5 / SPEC/23 §4 template: distance and bearing from IGN. */
function fromIgn(feature: string, usedBy: readonly UsedBy[], note?: string): RelationSpec[] {
  const id = feature.replace(/^anchor\./, "");
  return [
    { id: `dist.IGN.${id}`, type: "distance", measure: "distance", features: ["IGN", feature], usedBy: [u(TPL), ...usedBy], ...(note ? { note } : {}) },
    { id: `bearing.IGN.${id}`, type: "bearing", measure: "bearing", features: ["IGN", feature], usedBy: [u(TPL), ...usedBy] },
  ];
}

/** A scenario point a vehicle stands at must be on its road (a truck parks on the road; deployment.ts `at:` anchors). */
const onRoad = (anchor: string, road: string, usedBy: readonly UsedBy[], maxM = 30): RelationSpec => ({
  id: `on_road.${anchor.replace(/^anchor\./, "")}.${road}`, type: "on_road", measure: "distance", features: [anchor, road], tol: { kind: "range", max: maxM }, usedBy,
});

/** The scenario's copy of a map point (deployment.ts FEATURES) must stay on the map's feature. */
const same = (anchor: string, feature: string, usedBy: readonly UsedBy[], maxM = 25): RelationSpec => ({
  id: `adjacency.${anchor.replace(/^anchor\./, "")}=${feature}`, type: "adjacency", measure: "distance", features: [anchor, feature], tol: { kind: "range", max: maxM }, usedBy: [u(DEP, anchor), ...usedBy],
});

const sector = (feature: string, usedBy: readonly UsedBy[]): RelationSpec => ({
  id: `within_sector.${feature.replace(/^anchor\./, "")}`, type: "within_sector", measure: "sector", features: [feature], tol: { kind: "exact" }, usedBy: [u(TP, "sectorOfPoint"), ...usedBy],
});

const fire = (id: string, feature: string, steps: readonly number[], usedBy: readonly UsedBy[], extra: Partial<RelationSpec> = {}): RelationSpec => ({
  id: `ahead_of_fire.${id}`, type: "ahead_of_fire", measure: "fire_distance", features: [feature], params: { steps, layer: "truth", ...(extra.params ?? {}) }, usedBy, ...extra,
});

const route = (id: string, a: string, b: string, usedBy: readonly UsedBy[], params: Record<string, unknown> = {}): RelationSpec => ({
  id: `travel_time.${id}`, type: "travel_time", measure: "road_route", features: [a, b], params: { classes: ["main", "gravel", "forest"], ...params }, usedBy,
});

export const RELATION_SPECS: readonly RelationSpec[] = [
  // --- The template (SPEC/18 §5, SPEC/23 §4): where each feature lies from the ignition point -----------------------------------
  ...fromIgn("R1", [u(S18, "W3/W4/4", "spot fire across R1, R1 north verge"), u(ST, "atom.demo.1.1"), u(DP, "freeze.2.infra"), u(DP, "freeze.5.infra")], "SPEC/18 §5: R1 400 m N, E–W"),
  ...fromIgn("KUIVAKANGAS", [u(S18, "3", "second ignition on RIDGE 140 m ahead of the head"), u(FB, "freeze.2.ek11_point"), u(FB, "freeze.2.ek11_between"), u(DP, "spam2.6")], "SPEC/18 §5 RIDGE: esker 800–1200 m NE"),
  ...fromIgn("KUUSIMAKI", [u(FB, "freeze.2.spruce_behaviour"), u(ST, "atom.demo.4.0"), u(FB, "freeze.4.ek12_where"), u(DEP, "edge:SPR")], "SPEC/18 §5 SPR: spruce 1.3–2.2 km NE"),
  ...fromIgn("BIRCH", [u(FB, "freeze.4.crown_drops"), u(DEP, "edge:BIRCH"), u(DP, "spam.6")], "SPEC/18 §5 BIRCH: 2.3 km NE along Koivuoja"),
  ...fromIgn("HAUKILAMPI", [u(DP, "freeze.4.infra"), u(TW, "W1"), up(BUNDLE, "Haukilammelta \\(W1\\), noin [0-9,]+ km")], "SPEC/18 §5 POND: water point W1 ~1.5 km NW"),
  ...fromIgn("KARHUJARVI", [u(FB, "freeze.7.north_help"), u(DEP, "edge:L1B")], "SPEC/18 §5 LAKE-N: ~2.5 km NW"),
  ...fromIgn("MOKKIRANTA", [u(SM, "source.cabins_nw"), up(BUNDLE, "[Ll]ähin asutus:? Mökkiranta [0-9,]+ km"), u(FB, "freeze.7.cabins_reach"), u(FBB, "freeze.10.cabins_distance"), u(DP, "spam.8"), u(FBB, "settlementKey")], "SPEC/18 §9 V1: 14 cabins on Karhujärvi's shore facing IGN"),
  ...fromIgn("LAHDENKYLA", [u(FBB, "freeze.12.village_distance"), u(FBB, "freeze.12.front_toward"), u(FBB, "freeze.14.residents"), u(DD, "panel.V14"), up(BUNDLE, "Lahdenkylä [0-9,]+ km kaakkoon")], "SPEC/18 §5 VILLAGE-E, moved to 3.0 km (SPEC/23 §6)"),
  ...fromIgn("RAHKASUO", [u(TD, "BOG_S_POINTS"), u(DD, "panel.V14", "flare-up runs to Rahkasuo's drained peat"), u(DEP, "at:R2_BOG / at:FR_MID")], "SPEC/18 §5 BOG-S: drained peat 0.6–1.8 km S/SE"),
  ...fromIgn("R2", [u(FK, "R2_LINE"), u(FBB, "freeze.10.front_r2_80"), u(FBB, "freeze.14.road_crossed"), u(FBB, "freeze.14.se_front_r2"), u(DP, "freeze.10.infra"), u(PE, "premise.V14.P2")], "SPEC/18 §5 R2: along the E side"),
  ...fromIgn("HONKAHARJU_ROAD", [u(FBB, "freeze.14.road_crossed"), u(DD, "panel.V12"), u(DD, "panel.V13"), u(PE, "premise.V12.P2")], "phase-B line on the forest road S of the rekindle (deployment.ts FR_*)"),
  ...fromIgn("MYLLYOJA", [u(FB, "freeze.4.korpioja_spot"), u(FB, "RADIO.sparksMyllyoja")], "the brook N of the crown run, crossed by spotting in step 7"),
  ...fromIgn("KOIVUOJA", [u(DP, "spam.6"), u(FB, "freeze.4.crown_drops")]),
  ...fromIgn("POWER_LINE", [u(DP, "freeze.12.f7"), u(TR, "grid operator")], "SPEC/18 §5 PL, SPEC/33 (bc): 20 kV distribution line on wooden poles (was 110 kV), NE–SW, ~1.5 km E"),
  ...fromIgn("BRIDGE", [u(DP, "freeze.14.infra"), u(DEP, "OUT1/OUT2 step 16")], "SPEC/18 §5 BRIDGE: timber bridge, load limit 16 t, ~3 km E"),
  ...fromIgn("KOTKANJOKI", [u(DP, "freeze.7.infra"), u(FB, "freeze.4.crown_drops", "the 'river' distractor")]),
  ...fromIgn("CP", [u(FB, "freeze.7.cp_safe"), u("content/site/site.json", "commandPointTm35")], "SPEC/18 §5 CP: R1/R3 junction ~1 km W"),
  // --- The scenario's copies of map points (deployment.ts FEATURES) stay on the map's features -----------------------------------
  same("anchor.IGN", "IGN", []), same("anchor.CP", "CP", [u(TD, "STRETCHES at the command post")], 5),
  same("anchor.RIDGE", "KUIVAKANGAS", [u(TR, "placeNear Kuivakangas")]), same("anchor.SPR", "KUUSIMAKI", [u(TR, "placeNear Kuusimäki")]),
  same("anchor.BIRCH", "BIRCH", [u(TR, "placeNear Koivuoja")]), same("anchor.CABINS", "MOKKIRANTA", [u(TR, "settlements")]),
  same("anchor.BOG_S", "RAHKASUO", [u(TD, "BOG_S_POINTS")]), same("anchor.VILLAGE", "LAHDENKYLA", [u(TR, "settlements")]),
  { id: "adjacency.POND_W1.HAUKILAMPI", type: "adjacency", measure: "distance", features: ["anchor.POND_W1", "HAUKILAMPI"], tol: { kind: "range", max: 60 }, usedBy: [u(DEP, "at:POND_W1"), u(TW, "W1"), u(TD, "WATER_POINTS_FI")], note: "a tanker fills from the shore" },
  { id: "adjacency.POND_W2.W2_POND", type: "adjacency", measure: "distance", features: ["anchor.POND_W2", "W2_POND"], tol: { kind: "range", max: 30 }, usedBy: [u(DEP, "at:POND_W2"), u(TW, "W2")] },
  { id: "adjacency.BRIDGE_W3.KOTKANJOKI", type: "adjacency", measure: "distance", features: ["anchor.BRIDGE_W3", "KOTKANJOKI"], tol: { kind: "range", max: 20 }, usedBy: [u(DEP, "BRIDGE_W3", "west bank, ~10 m from the water"), u(DP, "freeze.7.infra")] },
  { id: "adjacency.BRIDGE_W3.BRIDGE", type: "adjacency", measure: "distance", features: ["anchor.BRIDGE_W3", "BRIDGE"], tol: { kind: "range", min: 10, max: 60 }, usedBy: [u(DEP, "BRIDGE_W3", "beside the bridge, not on its deck (revision (al))")] },
  { id: "adjacency.R3_BRIDGE_W.BRIDGE", type: "adjacency", measure: "distance", features: ["anchor.R3_BRIDGE_W", "BRIDGE"], tol: { kind: "relative", value: 0.15 }, usedBy: [u(DEP, "R3_BRIDGE_W", "400 m short of the bridge")] },
  { id: "adjacency.R3_BRIDGE_E.BRIDGE", type: "adjacency", measure: "distance", features: ["anchor.R3_BRIDGE_E", "BRIDGE"], tol: { kind: "range", max: 150 }, usedBy: [u(DEP, "R3_BRIDGE_E", "the east end, where OUT1/OUT2 are stopped"), u(DP, "freeze.14.infra")] },
  { id: "adjacency.LOG_LANDING.R2_FR", type: "adjacency", measure: "distance", features: ["LOG_LANDING", "anchor.R2_FR"], tol: { kind: "range", max: 60 }, usedBy: [u(DEP, "EK16 step 17/18 radio", "escape route east to the log landing at the R2 junction"), u(TR, "LOG_LANDING")] },
  // --- Vehicles stand on their roads (deployment.ts at: anchors) ------------------------------------------------------------------
  ...["R1_W", "R1_MID", "R1_BLACK", "R1_BLACK_MID", "R1_R2"].map((a) => onRoad(`anchor.${a}`, "R1", [u(DEP, `at:${a}`), u(TP, `at:${a}`)])),
  ...["R1_R2", "R2_BOG", "R2_FR", "R2_MID", "R2_S"].map((a) => onRoad(`anchor.${a}`, "R2", [u(DEP, `at:${a}`), u(FK, "R2_LINE"), u(TD, "STRETCHES")])),
  ...["FR_W", "FR_MID", "FR_E", "R2_FR"].map((a) => onRoad(`anchor.${a}`, "HONKAHARJU_ROAD", [u(DEP, `at:${a}`), u(TD, "roadById(\"honkaharju\")", "the Honkaharju road by its stable id"), u(FBB, "freeze.14.road_crossed")])),
  onRoad("anchor.R3_BRIDGE_W", "R3_E", [u(DEP, "at:R3_BRIDGE_W")]), onRoad("anchor.R3_BRIDGE_E", "R3_E", [u(DEP, "at:R3_BRIDGE_E")]),
  onRoad("anchor.BRIDGE_W3", "R3_E", [u(DEP, "at:BRIDGE_W3", "~18 m south of R3")]),
  onRoad("CP", "R1", [u(DEP, "at:CP"), u("content/site/site.json", "commandPointTm35")], 5), onRoad("CP", "R3_W", [u(DEP, "at:CP", "the R1/R3 junction")], 5),
  onRoad("anchor.CABINS", "KARHU_ROAD", [u(DEP, "CABINS"), u("tools/topo-map/roads.ts", "MOKKIRANTA_JUNCTION")], 80),
  onRoad("anchor.VILLAGE", "MAANTIE_S", [u("tools/topo-map/places.ts", "village houses along the maantie"), u(DEP, "at:VILLAGE")], 250),
  onRoad("anchor.POND_W1", "KARHU_ROAD", [up(BUNDLE, "Haukilammelta \\(W1\\).*ajo tietä R1"), u(TW, "W1")], 250),
  onRoad("anchor.POND_W2", "MAANTIE_S", [u(TW, "W2")], 150),
  // --- Junctions and topology ---------------------------------------------------------------------------------------------------
  { id: "adjacency.R2.R1", type: "adjacency", measure: "distance", features: ["R2", "anchor.R1_R2"], tol: { kind: "range", max: 20 }, usedBy: [u(FB, "freeze.2.junction_hour"), u(TD, "STRETCHES at the R2 junction")] },
  { id: "adjacency.R3_E.R1", type: "adjacency", measure: "distance", features: ["R3_E", "R1"], tol: { kind: "range", max: 5 }, usedBy: [u(DEP, "R3_BRIDGE_W"), u("tools/topo-map/roads.ts", "R3 east from R1's end")] },
  { id: "adjacency.R3_W.MAANTIE_S", type: "adjacency", measure: "distance", features: ["R3_W", "MAANTIE_S"], tol: { kind: "range", max: 30 }, usedBy: [u(DEP, "OUT1/OUT2 detour along the main road")] },
  { id: "adjacency.R2.MAANTIE_S", type: "adjacency", measure: "distance", features: ["R2", "MAANTIE_S"], tol: { kind: "range", max: 50 }, usedBy: [u(DEP, "R2 to the village; OUT1/OUT2 reach R2 from the main road"), u(TD, "STRETCHES at Lahdenkylä")], note: "the built R2 ends ~47 m short of the maantie (meander moved its end): a gap the road check of the rebuild should close; the contract needs only R2 to reach the main road at the village" },
  { id: "adjacency.R2_end.LAHDENKYLA", type: "adjacency", measure: "distance", features: ["R2", "LAHDENKYLA"], tol: { kind: "range", max: 300 }, usedBy: [u(DEP, "R2_S 'tielle R2 Lahdenkylän suuntaan'"), u(FBB, "freeze.12.front_toward")] },
  { id: "adjacency.HONKAHARJU_ROAD.R2", type: "adjacency", measure: "distance", features: ["HONKAHARJU_ROAD", "anchor.R2_FR"], tol: { kind: "range", max: 5 }, usedBy: [u(DEP, "R2_FR"), u(TR, "LOG_LANDING")] },
  { id: "adjacency.KARHU_ROAD.R1", type: "adjacency", measure: "distance", features: ["KARHU_ROAD", "R1"], tol: { kind: "range", max: 20 }, usedBy: [u(TW, "W1 via R1")] },
  // Play-test R7 (25 Oct 2026): the R1 stretch the step-5 DR1/DR3 road reports name "vajaa kilometri R2:n risteyksestä länteen" lies on
  // R1, just under a kilometre (~840 m, ±15 %) from the junction. No figure in the text: "800 m" with "R2" read as V10 front_r2_80's key.
  onRoad("R1_STRETCH_W_OF_R2", "R1", [u(TD, "STRETCHES")]),
  { id: "distance.R1_R2.R1_STRETCH_W_OF_R2", type: "distance", measure: "distance", features: ["anchor.R1_R2", "R1_STRETCH_W_OF_R2"], usedBy: [u(TD, "STRETCHES"), up(BUNDLE, "vajaa kilometri R2:n risteyksestä länteen|just under a kilometre west of the R2 junction", "DR1 14.46, DR3 14.48 (play-test R7)")] },
  { id: "adjacency.KOIVUOJA.MYLLYOJA", type: "adjacency", measure: "distance", features: ["KOIVUOJA", "MYLLYOJA"], tol: { kind: "range", max: 50 }, usedBy: [u("tools/topo-map/terrain.ts", "Koivuoja ends in Myllyoja")] },
  { id: "adjacency.BIRCH.KOIVUOJA", type: "adjacency", measure: "distance", features: ["BIRCH", "KOIVUOJA"], tol: { kind: "range", max: 150 }, usedBy: [u(FB, "freeze.4.crown_drops", "the birch strip along the brook"), u(DEP, "edge:BIRCH 'Koivuojan koivikkoon'")] },
  { id: "adjacency.POND_W2.LAHDENKYLA", type: "adjacency", measure: "distance", features: ["W2_POND", "LAHDENKYLA"], tol: { kind: "range", max: 400 }, usedBy: [u(TW, "W2 'Lahdenkylän lampi'")] },
  // --- Crossings -----------------------------------------------------------------------------------------------------------------
  { id: "crosses.R3_E.KOTKANJOKI@BRIDGE", type: "crosses", measure: "crossing_near", features: ["R3_E", "KOTKANJOKI", "BRIDGE"], tol: { kind: "range", max: 30 }, usedBy: [u(DP, "freeze.14.infra"), u(DEP, "OUT1/OUT2 'raskas säiliö ei pääse sillan yli'")] },
  { id: "crosses.bridge_drawn@BRIDGE", type: "crosses", measure: "bridge_near", features: ["BRIDGE"], tol: { kind: "range", max: 30 }, usedBy: [u(DP, "freeze.14.infra"), u("tools/topo-map/render.py", "bridge symbol")] },
  { id: "crosses.R1.KOTKANJOKI", type: "crosses", measure: "crossing_count", features: ["R1", "KOTKANJOKI"], usedBy: [u(DEP, "R1 stays west of the river")] },
  { id: "crosses.R2.KOTKANJOKI", type: "crosses", measure: "crossing_count", features: ["R2", "KOTKANJOKI"], usedBy: [u(TW, "the shuttle W1/W2 to the lines without a bridge")] },
  { id: "crosses.HONKAHARJU_ROAD.KOTKANJOKI", type: "crosses", measure: "crossing_count", features: ["HONKAHARJU_ROAD", "KOTKANJOKI"], usedBy: [u(DEP, "FR_* lines")] },
  { id: "crosses.R1.POWER_LINE", type: "crosses", measure: "crossing_count", features: ["R1", "POWER_LINE"], usedBy: [u(DP, "freeze.12.f7"), u(TR, "smoke under the line, cycle 6")] },
  { id: "crosses.HONKAHARJU_ROAD.POWER_LINE", type: "crosses", measure: "crossing_count", features: ["HONKAHARJU_ROAD", "POWER_LINE"], usedBy: [u(DEP, "FR_E (revision (al))")] },
  { id: "distance.FR_E.POWER_LINE", type: "distance", measure: "distance", features: ["anchor.FR_E", "POWER_LINE"], tol: { kind: "range", min: 60 }, usedBy: [u(DEP, "FR_E", "~127 m from the line, outside its 36 m corridor")] },
  { id: "crosses.MYLLYOJA.KARHUJARVI", type: "crosses", measure: "crossing_count", features: ["MYLLYOJA", "KARHUJARVI"], tol: { kind: "range", min: 2 }, usedBy: [u("tools/topo-map/terrain.ts", "Myllyoja flows through Karhujärvi")] },
  { id: "crosses.R1.MYLLYOJA", type: "crosses", measure: "crossing_count", features: ["R1", "MYLLYOJA"], usedBy: [u(FB, "freeze.4.korpioja_spot", "the brook is north of R1, between the head and the north")] },
  // --- Sectors (bearing wedges from IGN) -----------------------------------------------------------------------------------------
  sector("LAHDENKYLA", [u(DD, "VILLAGE_SECTOR"), u(DD, "panel.V14")]),
  { id: "sector_margin.LAHDENKYLA", type: "within_sector", measure: "sector_margin", features: ["LAHDENKYLA"], tol: { kind: "range", min: 20 }, usedBy: [u(DD, "VILLAGE_SECTOR")] },
  sector("MOKKIRANTA", [u(FB, "freeze.7.north_help"), u(DEP, "edge:L1B")]),
  sector("KUIVAKANGAS", [u(FB, "freeze.4.fastest_spread")]), sector("KUUSIMAKI", [u(FB, "freeze.4.fastest_spread")]), sector("BIRCH", [u(TP, "edge:BIRCH")]),
  sector("CP", [up(BUNDLE, "^Sääasema", "the station's records are located by sector")]),
  ...["FR_W", "FR_MID", "FR_E", "BOG_S"].map((a) => sector(`anchor.${a}`, [u(TP, `at:${a} L3-Etelä`)])),
  sector("anchor.ORIGIN_W", [u(TP, "at:ORIGIN_W L4-Länsi"), u(DD, "SECOND_REKINDLE")]),
  sector("RAHKASUO", [u(TP, "at:BOG_S L3-Etelä")]),
  // --- Names the scenario derives from the map ------------------------------------------------------------------------------------
  { id: "text_mention.HONKAHARJU_ROAD.name", type: "text_mention", measure: "nearest_label", features: ["HONKAHARJU_ROAD"], params: { styles: ["terrain", "place", "bog", "water"] }, usedBy: [u(CR, "barriers(): 'metsäautotien (Honkaharju)'"), u(FBB, "RADIO.roadStop / RADIO.roadCrossed"), u(DP, "CONTRADICTION_BACKUP_AUTHORED")] },
  ...["Karhujärvi", "Haukilampi", "Kotkanjoki", "Koivuoja", "Myllyoja", "Lahdenkylä", "Mökkiranta", "Rahkasuo", "Kuivakangas", "Kuusimäki", "Honkaharju"].map((name): RelationSpec => ({
    id: `text_mention.label.${name}`, type: "text_mention", measure: "label_present", features: [], params: { text: name, en: PLACE_NAMES_EN[name] }, usedBy: [u("app/i18n/place-names.ts", name, "named in the scenario's records, questions and directive")],
  })),
  // --- Fire against the map (the CA run on this map's grids; the band keys' own checks in freeze-bank*.ts) ------------------------
  fire("V2.junction_hour", "anchor.R1_R2", [5], [u(FB, "freeze.2.junction_hour")], { band: { edges: [400, 700, 1000], margin: 50 } }),
  fire("V7.cabins_reach", "anchor.CABINS", [10, 11, 12], [u(FB, "freeze.7.cabins_reach")], { tol: { kind: "range", min: 300 } }),
  fire("V7.cp_safe", "anchor.CP", [10, 11, 12], [u(FB, "freeze.7.cp_safe")], { tol: { kind: "range", min: 300 } }),
  fire("V10.cabins_distance", "anchor.CABINS", [13], [u(FBB, "freeze.10.cabins_distance")], { band: { edges: [800, 1500, 2500], margin: 0 } }),
  fire("V12.village_distance", "anchor.VILLAGE", [19], [u(FBB, "freeze.12.village_distance")], { band: { edges: [1200, 1600, 2100], margin: 100 } }),
  fire("unburned.CABINS", "anchor.CABINS", Array.from({ length: 20 }, (_, i) => i + 1), [u(SM, "source.cabins_nw"), u(DD, "DIRECTIVE_KEYS")], { tol: { kind: "range", min: 50 } }),
  fire("unburned.VILLAGE", "anchor.VILLAGE", Array.from({ length: 20 }, (_, i) => i + 1), [u(FBB, "freeze.14.residents")], { tol: { kind: "range", min: 50 } }),
  fire("unburned.CP", "anchor.CP", Array.from({ length: 20 }, (_, i) => i + 1), [u(FB, "freeze.7.cp_safe")], { tol: { kind: "range", min: 50 } }),
  fire("R2_held_20", "R2", [20], [u(PE, "premise.V14.P2"), u(FBB, "freeze.14.road_crossed"), u(DD, "panel.V14")], { tol: { kind: "range", min: 150 } }),
  fire("HONKAHARJU_ROAD_before_16", "HONKAHARJU_ROAD", [15], [u(DEP, "KY21 step 16 'reuna noin 100 m tiestä'"), u(DD, "panel.V12")], { tol: { kind: "range", min: 30 } }),
  fire("HONKAHARJU_ROAD_reached_18", "HONKAHARJU_ROAD", [18], [u(FBB, "RADIO.roadStop"), u(FBB, "freeze.14.road_crossed")], { tol: { kind: "range", max: 0 } }),
  // --- Driving (traffic-water.ts drives straight × 1.4 at 450 m/min; the radio states the times) ----------------------------------
  route("CP-POND_W1", "CP", "anchor.POND_W1", [u(TW, "driveS"), up(BUNDLE, "Haukilammelta \\(W1\\), noin [0-9,]+ km")]),
  route("POND_W1-R2_FR", "anchor.POND_W1", "anchor.R2_FR", [u(TW, "shuttle W1 → R2_FR")]),
  route("BRIDGE_W3-R2_FR", "anchor.BRIDGE_W3", "anchor.R2_FR", [u(TW, "shuttle W3 → R2_FR"), u(DEP, "EK12 step 10 'Poissa linjalta noin 20 min'")]),
  route("POND_W2-R2_FR", "anchor.POND_W2", "anchor.R2_FR", [u(TW, "shuttle W2 → R2_FR (phase B)")]),
  route("FR_E-LOG_LANDING", "anchor.FR_E", "LOG_LANDING", [u(DEP, "EK16 escape east along the road (~720 m, SPEC/18 al.3)")], { classes: ["main", "gravel", "forest"] }),
  { ...route("OUT_detour", "anchor.R3_BRIDGE_E", "anchor.R2_S", [u(DEP, "OUT1 step 17 'kiertotielle maantien kautta, noin 20 km'"), up("app/scenario/site-scenario.json", "kiertotielle maantien kautta, noin 20 km")], { classes: ["main", "gravel"], avoid: ["BRIDGE"] }),
    tol: { kind: "range", min: 15000 }, note: "without the R3 bridge the heavy tankers' way to R2 leaves the map (∞ on it) or is at least 15 km: the radio says ~20 km" },
];
