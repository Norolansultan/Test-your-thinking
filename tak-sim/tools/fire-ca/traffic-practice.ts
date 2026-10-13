/**
 * The practice view's traffic (researcher decision 1 Oct 2026): VP is step W2 (12:00–12:20), a small
 * fire just after the first crews arrived, and it opens with a thorough starting picture so the
 * participant can try the message log and every Haku category before V1. About a dozen pushed
 * messages and a handful of recorded lines; all of them stay searchable later, as incident history.
 *
 * Every number comes from the CA and the deployment at W2 (`TrafficCycleInput`): area, length,
 * head direction and rate, distances to the road, the settlements and the water point. Temperature
 * and humidity are SPEC/18 §6's W2 row (the forcing carries wind only). SPEC/18 §8.2's W2 row: EK11
 * on scene by R1, VPK on L4, EK12 en route, DR1 launched from EK11; HARV (the harvester) digs a
 * mineral-soil line on L4. Identical for everyone; nothing here names the bog, the power line or
 * any designed event.
 */

import { FIXED_ROADS } from "../topo-map/roads.js";
import { FEATURES, type P } from "./deployment.js";
import { escapeRoute, routeEn } from "./traffic-lateral.js";
import { bearing, dirFrom, dirTo, dist, fmt1, FLAME_FI, hm, intensityClass, L, pl, r10, r50, stepStartS } from "./traffic-text.js";
import type { TrafficCycleInput, TrafficEvent } from "./traffic-types.js";

/** SPEC/18 §6, row W2. */
const W2_TEMP_C = 27;
const W2_RH_PCT = 30;
/** When the first crews arrived (SPEC/18 §8.2: EK11 on scene at W2, 1.5 h before the 13:20 handover). */
const EK11_ARRIVED = "11.50";
const EK12_ETA = "12.35";

const R1 = FIXED_ROADS[3]!.line;
const toLine = (p: P, line: readonly P[]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!, b = line[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
};

export function practiceTraffic(inp: TrafficCycleInput): TrafficEvent[] {
  const t0 = stepStartS(inp.n);
  const ek11 = inp.units.find((u) => u.id === "EK11");
  const vpk = inp.units.find((u) => u.id === "VPK");
  if (!ek11 || !vpk) throw new Error("practice traffic: EK11 and VPK must be on the W2 map (PRACTICE_UNITS)");
  const dir = dirTo(inp.headingDeg);
  const rate = Math.max(1, Math.round(inp.observedRateMpm));
  const cls = intensityClass(inp.landCoverAt(inp.head), inp.observedRateMpm, true);
  const headToR1 = r10(toLine(inp.head, R1));
  const wind = L(`tuuli ${dirFrom(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s, puuskissa ${fmt1(inp.wind.gustMs)}`, `wind from the ${dirFrom(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s, gusts ${fmt1(inp.wind.gustMs)}`);
  const towns = inp.settlements.map((s) => `${s.fi} ${fmt1(dist(inp.head, s.at) / 1000)} km ${dirTo(bearing(inp.head, s.at))}`).join(", ");
  const w1 = dist(ek11.pos, FEATURES.POND_W1);
  const hot = Math.max(2, Math.round(inp.areaHa * 4));
  const ev = (offsetS: number, e: Omit<TrafficEvent, "offsetS">): TrafficEvent => ({ offsetS, ...e });
  const crew = (u: typeof ek11) => ({ actor: u.id, actor_type: u.id === "VPK" ? "volunteer_brigade" as const : "fire_team" as const, addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, task: u.task });
  const drone = { actor: "DR1", actor_type: "drone" as const, pos: inp.head, place: "kärki", location: ek11.sector, task: "orbit:head" };
  const log = (actor: string, actor_type: TrafficEvent["actor_type"], pos: P) => ({ actor, actor_type, addressee: null, pos, place: null, location: null, task: null });

  return [
    ev(5, { ...log("SAA", "weather_station", FEATURES.CP), event_type: "weather", content: L(`Sääasema: ${wind}, lämpötila ${W2_TEMP_C} °C, ilmankosteus ${W2_RH_PCT} %. Ei sadetta.`, `Weather station: ${wind}, temperature ${W2_TEMP_C} °C, humidity ${W2_RH_PCT} %. No rain.`), tier: "T2_system", channel: "system_log", nav: "saa" }),
    ev(30, { actor: "HÄTÄKESKUS", actor_type: "command", addressee: "JOHTO", pos: FEATURES.IGN, place: "syttymäkohta", location: null, task: null, event_type: "report",
      content: L("Hätäkeskus: maastopalo hakkuuaukealla, ilmoittaja metsäkoneen kuljettaja klo 11.32. Hälytetty EK11, VPK ja EK12.", "Emergency centre: forest fire on a clear-cut, reported by the harvester operator at 11.32. EK11, VPK and EK12 dispatched."), tier: "T1_pushed", channel: "radio_command", nav: "johto" }),
    ev(60, { ...crew(ek11), event_type: "size_up",
      content: L(`EK11 paikalla klo ${EK11_ARRIVED}. Palo noin ${fmt1(inp.areaHa)} ha, pituus noin ${r50(inp.lengthM)} m. Kärki etenee ${dir} noin ${rate} m/min kohti tietä R1. Pintapaloa hakkuutähteessä ja kanervakankaalla, ${FLAME_FI[cls]}.`, `EK11 on scene since ${EK11_ARRIVED}. Fire about ${fmt1(inp.areaHa)} ha, about ${r50(inp.lengthM)} m long. The head is spreading ${dir} at about ${rate} m/min towards road R1. Surface fire in logging slash and heather heath, ${FLAME_FI[cls]}.`), tier: "T1_pushed", channel: "radio_command", nav: "palo" }),
    ev(95, { ...crew(ek11), event_type: "observation", content: L(`EK11: savupatsas vaalea, kallistuu ${dir}. Kärjestä tielle R1 noin ${headToR1} m.`, `EK11: smoke column light-coloured, leaning ${dir}. About ${headToR1} m from the head to road R1.`), tier: "T1_pushed", channel: "radio_command", nav: "palo" }),
    ev(130, { ...crew(ek11), event_type: "report",
      content: L(`EK11: tehtävä sammutus letkulinjalla kärjen pohjoissivustassa. Ajoneuvo tiellä R1${ek11.hoseM ? `, letkulinja noin ${ek11.hoseM} m` : ""}. Perääntymistie: ${escapeRoute(ek11.pos, inp.head, inp.fire, ek11.vehicle).fi}.`, `EK11: task attack with a hose line on the north flank of the head. Vehicle on road R1${ek11.hoseM ? `, hose line about ${ek11.hoseM} m` : ""}. Escape route: ${routeEn(escapeRoute(ek11.pos, inp.head, inp.fire, ek11.vehicle).fi)}.`), tier: "T1_pushed", channel: "radio_command", nav: "yksikot" }),
    ev(180, { ...crew(ek11), event_type: "report", content: L("EK11: metsäkoneen kuljettaja kaivaa kivennäismaakaistaa syttymäkohdan länsipuolelle. Kone pysyy palon takana.", "EK11: the harvester operator is digging a mineral-soil strip west of the point of origin. The machine stays behind the fire."), tier: "T1_pushed", channel: "radio_command", nav: "yksikot" }),
    ev(200, { ...log("DR1", "drone", inp.head), event_type: "status", content: L(`DR1 anturiloki: lähetetty EK11:ltä klo 12.03, korkeus 120 m, kartoitettu alue noin 300 m säteellä, akku 96 %.`, `DR1 sensor log: launched from EK11 at 12.03, altitude 120 m, mapped area within about 300 m, battery 96 %.`), tier: "T2_system", channel: "sensor_feed", nav: "ilma" }),
    ev(240, { ...crew(vpk), event_type: "size_up",
      content: L("VPK saapunut syttymäkohdan taakse (lohko L4). Palon takaosa savuaa, reuna etenee hitaasti. Aloitamme reunan sammutuksen ja varmistamme metsäkoneen kaivaman kaistan.", "VPK has arrived behind the point of origin (sector L4). The back of the fire is smoking, the edge is spreading slowly. We start putting out the edge and secure the strip the harvester dug."), tier: "T1_pushed", channel: "radio_command", nav: "palo" }),
    ev(330, { ...drone, addressee: "JOHTO", event_type: "detection",
      content: L(`DR1 lämpökuva, kärki klo ${hm(t0 + 300)}: reuna etenee ${dir} noin ${rate} m/min, ${FLAME_FI[cls]}; ${hot} tuoretta lämpöpistettä kuva-alalla. (luotettavuus hyvä.)`, `DR1 thermal image, head at ${hm(t0 + 300)}: the edge is spreading ${dir} at about ${rate} m/min, ${FLAME_FI[cls]}; ${hot} fresh hot spots in the image. (reliability good.)`), tier: "T1_pushed", channel: "radio_command", nav: "ilma" }),
    ev(360, { ...log("AVL", "command", ek11.pos), actor: "EK11", actor_type: "fire_team", place: ek11.place, location: ek11.sector, task: ek11.task, event_type: "status", content: L(`AVL EK11: ${ek11.place ?? "maastossa"}, tehtävä sammutus letkulinjalla.`, `AVL EK11: ${pl(ek11.place ?? "maastossa")}, task attack with a hose line.`), tier: "T2_system", channel: "system_log", nav: "yksikot" }),
    ev(375, { ...log("AVL", "command", vpk.pos), actor: "VPK", actor_type: "volunteer_brigade", place: vpk.place, location: vpk.sector, task: vpk.task, event_type: "status", content: L(`AVL VPK: ${vpk.place ?? "maastossa"}, tehtävä jälkisammutus.`, `AVL VPK: ${pl(vpk.place ?? "maastossa")}, task mop-up.`), tier: "T2_system", channel: "system_log", nav: "yksikot" }),
    ev(420, { ...crew(ek11), event_type: "observation", content: L(`EK11: lähin asutus ${towns} kärjestä. Ei välitöntä uhkaa.`, `EK11: nearest homes ${towns} of the head. No immediate threat.`), tier: "T1_pushed", channel: "radio_command", nav: "kohteet" }),
    ev(480, { ...log("METSÄKESKUS", "command", FEATURES.IGN), event_type: "status",
      content: L("Metsävararekisteri: syttymäkohta on tämän vuoden hakkuuaukea, ympärillä kuivaa mäntykangasta. Maaperä kivennäismaata, kantaa koneet.", "Forest resource register: the point of origin is this year's clear-cut, surrounded by dry pine heath. Mineral soil that carries machines."), tier: "T2_system", channel: "system_log", nav: "maasto" }),
    ev(540, { ...crew(vpk), event_type: "observation",
      content: L(`VPK: vettä saa Haukilammelta (W1), noin ${fmt1(w1 / 1000)} km ${dirTo(bearing(ek11.pos, FEATURES.POND_W1))} EK11:stä, ajo tietä R1. Metsäautotie kantaa säiliöauton.`, `VPK: water is available at Haukilampi (W1), about ${fmt1(w1 / 1000)} km ${dirTo(bearing(ek11.pos, FEATURES.POND_W1))} of EK11, along road R1. The forest road takes a tanker.`), tier: "T1_pushed", channel: "radio_command", nav: "vesi_reitit" }),
    ev(600, { ...log("SAA", "weather_station", FEATURES.CP), event_type: "weather", content: L(`Sääasema: ${wind}, suunta vaihtelee ±15°.`, `Weather station: ${wind}, direction varying ±15°.`), tier: "T2_system", channel: "system_log", nav: "saa" }),
    ev(660, { ...crew(ek11), event_type: "request", content: L("EK11: pyydän lisää vettä ja maastopaloyksikön pohjoisreunalle, jos kärki ylittää tien R1.", "EK11: I request more water and a forest-fire unit for the north flank if the head crosses road R1."), tier: "T1_pushed", channel: "radio_command", nav: "johto" }),
    ev(720, { ...log("VESIHUOLTO", "command", ek11.pos), event_type: "status", content: L("Vesihuoltoloki: EK11 säiliö noin 90 %, VPK noin 85 %. Lähin vesipiste W1 Haukilampi.", "Water supply log: EK11 tank about 90 %, VPK about 85 %. Nearest water point W1 Haukilampi."), tier: "T2_system", channel: "system_log", nav: "vesi_reitit" }),
    ev(780, { actor: "EK12", actor_type: "fire_team", addressee: "JOHTO", pos: FEATURES.CP, place: null, location: null, task: "transit", event_type: "report",
      content: L(`EK12 matkalla, arvioitu saapuminen noin klo ${EK12_ETA}.`, `EK12 on the way, estimated arrival at about ${EK12_ETA}.`), tier: "T1_pushed", channel: "radio_command", nav: "yksikot" }),
    ev(900, { ...crew(vpk), event_type: "observation", content: L("VPK: reuna rauhallinen syttymäkohdan takana, kantoja ja kariketta savuaa. Ei leviämistä meidän puolella.", "VPK: the edge is calm behind the point of origin, stumps and litter smoking. No spread on our side."), tier: "T1_pushed", channel: "radio_command", nav: "palo" }),
    ev(1020, { ...drone, addressee: null, event_type: "detection",
      content: L(`DR1 tiehavainto: tie R1, palo noin ${headToR1} m tiestä — tie ajettavissa, ei savua tiellä (luotettavuus hyvä).`, `DR1 road report: road R1, fire about ${headToR1} m from the road — road passable, no smoke on the road (reliability good).`), tier: "T2_system", channel: "sensor_feed", nav: "vesi_reitit" }),
    ev(1080, { ...crew(ek11), event_type: "observation", content: L(`EK11: ${wind}. Kärki jatkaa ${dir}, pohjoissivusta pitää.`, `EK11: ${wind}. The head keeps going ${dir}, the north flank holds.`), tier: "T1_pushed", channel: "radio_command", nav: "saa" }),
  ];
}
