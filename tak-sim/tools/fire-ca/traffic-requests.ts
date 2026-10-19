/**
 * Requests from crews to command (review 1 Oct 2026, item 7): resources and information, each
 * tied to the step's state or to a SPEC/18 §8.2 / SPEC/19 §5 beat — hose and wetting agent short
 * (step 15), food (step 10), relief for long shifts, pump and saw fuel, a wind forecast after the
 * wind turns, cabin occupancy (unknown until step 17), a guide for the out-of-region crews, a
 * thermal check of the bog once the fire is back there (step 13 on), heat stress on EK11 (step 19).
 * Water requests come from `traffic-water.ts`. Nothing here touches the power line (F7) or the bog
 * before step 12.
 */

import { actorTypeOf, dirFrom as dirFromFi, fmt1, hm, L, LL, r50, say, stepStartS, vary } from "./traffic-text.js";
import { hoursOnScene } from "./traffic-lateral.js";
import { HELD_FOR_REGION } from "./deployment.js";
import { isShuttle } from "./traffic-water.js";
import type { Out, TrafficCycleInput, TrafficState, TrafficUnit } from "./traffic-types.js";

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

export function requestTraffic(inp: TrafficCycleInput, state: TrafficState, out: Out): void {
  const { n } = inp;
  const { pick, rnd } = out.draw;
  const crews = inp.units.filter((u) => u.arrivedCycle <= n && !u.silent);
  const once = (key: string) => { if (state.said.has(key)) return false; state.said.add(key); return true; };
  const ask = (u: TrafficUnit, text: string, nav: "yksikot" | "vesi_reitit" | "saa" | "kohteet" | "palo" | "ilma" = "yksikot") =>
    out.push({ actor: u.id, actor_type: actorTypeOf(u.id, null), addressee: "JOHTO", pos: u.pos, place: u.place, location: u.sector, event_type: "request", task: u.task,
      content: say(u.id, u.place, text), tier: "T1_pushed", channel: "radio_command", nav });
  const on = (sector: string) => crews.filter((u) => u.sector === sector && u.onEdge);

  for (const u of crews) {
    const h = hoursOnScene(u, n);
    // Relief: once past four and a half hours on the line, and again past six and a half.
    if (u.onEdge && h >= 4.5 && once(`relief1:${u.id}`)) ask(u, pick([
      L(`miehistö ollut kentällä ${fmt1(h)} h. Pyydämme vuoronvaihtoa tai lepovuoroa seuraavan tunnin aikana.`, `crew in the field for ${fmt1(h)} h. We request a change of shift or a rest period within the next hour.`),
      L(`olemme olleet linjalla ${fmt1(h)} h ilman lepoa tai ruokataukoa. Pyydän korvaavaa yksikköä, jotta saadaan miehet huoltoon.`, `we have been on the line ${fmt1(h)} h without a rest or a meal break. I request a relief unit so the men can rest.`),
    ]));
    else if (u.onEdge && h >= 6.5 && once(`relief2:${u.id}`)) ask(u, L(`${fmt1(h)} h kentällä, kaksi miestä alkaa olla lopussa. Uusin pyynnön vuoronvaihdosta.`, `${fmt1(h)} h in the field, two men are close to exhausted. I repeat the request for a change of shift.`));
    // Fuel for pumps and saws.
    if (u.task === "pump_attack" && h >= 2 && once(`fuel:${u.id}:${Math.floor(h / 3)}`)) ask(u, ((m: number) => L(`moottoriruiskun polttoaine riittää noin ${m} min. Pyydämme 20 l bensiiniä ja kaksitahtiöljyä meille.`, `the portable pump has fuel for about ${m} min. We request 20 l of petrol and two-stroke oil.`))(40 + Math.floor(rnd() * 4) * 10));
    // Saw work on a fire edge (round 2, 5 Oct 2026: not the crews holding a road line, who clear its verge only).
    if (u.task === "firebreak" && u.onEdge && once(`saws:${u.id}`)) ask(u, L(`palokatkon raivaukseen tarvitaan lisää teräketjuja ja sahabensaa, kaksi sahaa seisoo.`, `we need more saw chains and saw fuel to cut the firebreak, two saws are idle.`));
    // Long hose lines need more hose and pressure.
    // Radio ST-08 (SPEC/31): the request in the crew's own words, fixed by unit and step (the same sentence came four times).
    if ((u.hoseM ?? 0) >= 500 && once(`hosereq:${u.id}:${u.anchor}`)) ask(u, ((m: number) => vary(u.id, n, [
      L(`letkulinja ${u.hoseM} m, letkua varalla alle ${m} m. Pyydämme lisää 76 mm ja 42 mm letkua sekä jakoliittimen.`, `hose line ${u.hoseM} m, under ${m} m of spare hose. We request more 76 mm and 42 mm hose and a dividing breeching.`),
      // Function words as in the first phrasing (one "ja"): a lexical match on "on"/"ja" moved V5's frozen retrieval (thinker-review-ah C2).
      L(`linjaa jo ${u.hoseM} m, varaletkua alle ${m} m. Tarvitsemme lisää 76 mm syöttöletkua, 42 mm työletkua sekä jakoliittimen.`, `the line is already ${u.hoseM} m, under ${m} m of spare hose. We need more 76 mm supply hose, 42 mm attack hose and a dividing breeching.`),
      L(`letku loppuu: linja ${u.hoseM} m, varalla alle ${m} m. Lähettäkää 76 mm ja 42 mm letkua sekä jakoliitin.`, `we are running out of hose: the line is ${u.hoseM} m, under ${m} m spare. Send 76 mm and 42 mm hose and a dividing breeching.`),
    ]))(r50(150 + rnd() * 100)), "vesi_reitit");
  }

  // Food and drink after the shower (SPEC/19 §5 step 10: food request).
  if (n === 10) for (const [k, u] of crews.filter((x) => x.onEdge).slice(0, 2).entries()) {
    // Radio ST-08 (SPEC/31): two crews in one step no longer say one sentence (EK11 16:31, EK14 16:33): each its own phrasing, by its
    // place in the step (the draw the `pick` made is still made). Review fixes (ah): every variant is a supply request ("huoltoa",
    // "muonaa"), whichever comes (neutral eval n32's question).
    if (once(`food:${u.id}`)) ask(u, vary("", n + k, [
      L("pyydämme huoltoa linjalle: muonaa ja juomaa, miehet eivät ole syöneet aamun jälkeen.", "we request supplies on the line: food and drink, the men have not eaten since the morning."),
      L(`pyydämme huoltoa: juomavettä ja muonaa linjalle, ${crews.length > 4 ? "useampi yksikkö samassa tilanteessa" : "kuusi miestä"}.`, `we request supplies: drinking water and food on the line, ${crews.length > 4 ? "several units in the same situation" : "six men"}.`),
      L("tarvitsemme huoltoa tänne: muonaa ja juomavettä, viimeisin ateria oli aamulla.", "we need supplies here: food and drinking water, the last meal was in the morning."),
    ], rnd));
  }

  // A wind forecast after the wind turns, from the crew nearest the head.
  if (inp.windPrev && angleDiff(inp.wind.fromDeg, inp.windPrev.fromDeg) >= 30) {
    const u = [...crews].filter((x) => x.onEdge).sort((a, b) => Math.hypot(a.pos.x - inp.head.x, a.pos.y - inp.head.y) - Math.hypot(b.pos.x - inp.head.x, b.pos.y - inp.head.y) || (a.id < b.id ? -1 : 1))[0];
    if (u) ask(u, out.fresh([
      L(`tuuli kääntyi klo ${hm(stepStartS(n))} jälkeen ${dirFromFi(inp.wind.fromDeg)}. Pyydämme Ilmatieteen laitoksen tuuliennustetta seuraavalle tunnille: suunta ja puuskat.`, `the wind turned after ${hm(stepStartS(n))}, now from the ${dirFromFi(inp.wind.fromDeg)}. We request the Meteorological Institute's wind forecast for the next hour: direction and gusts.`),
      L(`tuulen suunta muuttui taas, nyt ${dirFromFi(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s. Onko uutta ennustetta? Pitääkö varautua puuskiin?`, `the wind direction changed again, now from the ${dirFromFi(inp.wind.fromDeg)} ${fmt1(inp.wind.meanMs)} m/s. Is there a new forecast? Should we expect gusts?`),
    ]), "saa");
  }

  // Cabins on Karhujärvi: occupancy is unknown until step 17 (SPEC/18 §9 V1); crews facing them ask.
  if (n >= 9 && n <= 12) {
    const u = crews.find((x) => x.anchor === "edge:L1B" || x.anchor === "edge:L1");
    if (u && once(`cabins:${n <= 10 ? "a" : "b"}`)) ask(u, n <= 10
      ? L("onko Mökkirannan mökit tarkistettu? Emme tiedä onko siellä ihmisiä, ja palo painuu sinne päin.", "have the Mökkiranta cabins been checked? We do not know if there are people there, and the fire is pushing that way.")
      : L("toistan kysymyksen Mökkirannasta: onko poliisi saanut mökit tarkistettua? Tarvitsemme tiedon ennen kuin palokatko valmistuu.", "I repeat the question about Mökkiranta: have the police checked the cabins? We need to know before the firebreak is finished."), "kohteet");
  }

  // Thermal check of the old edge by the origin, once the fire is back there (after V9 only; hinge rule 3).
  if (n >= 13 && n <= 15) {
    const u = on("L3-Etelä").find((x) => x.id !== "KY21");
    // Not when a drone is already imaging the crew's stretch (audit item 18).
    if (u && !inp.aircraft.some((a) => a.covers(u.pos)) && once(`thermal:${n}`)) ask(u, pick([
      L("pyydämme dronea lämpökuvaamaan syttymäkohdan eteläreunan ennen kuin siirrymme. Kannot ja kuntta kytevät pinnan alla.", "we request a drone to take thermal images of the south edge by the point of origin before we move. Stumps and humus are smouldering under the surface."),
      L("tarvitsemme lämpökuvan vanhan eteläreunan itäosasta, emme näe savun takia mistä palo pääsee kantojen ja risukasojen kautta eteenpäin.", "we need a thermal image of the east part of the old south edge; we cannot see through the smoke where the fire is getting on through the stumps and slash piles."),
    ]), "ilma");
  }

  // Hose and wetting agent short on the peat (SPEC/18 §8.2 step 15).
  if (n === 15) {
    const l3 = on("L3-Etelä");
    if (l3[0] && once("wetting")) ask(l3[0], L("kostutusainetta enää yksi kanisteri. Vesi ei imeydy turpeeseen, pyydämme lisää kostutusainetta ja tunkeutumisputkia.", "only one canister of wetting agent left. The water does not soak into the peat; we request more wetting agent and piercing nozzles."), "vesi_reitit");
    if (l3[1] && once("hose15")) ask(l3[1], ((m: number) => L(`letkua puuttuu noin ${m} m, jotta linja ylettyy ojan yli. Pyydämme letkua tänne.`, `we are about ${m} m of hose short of reaching across the ditch. We request hose here.`))(r50(250 + rnd() * 150)), "vesi_reitit");
  }

  // Out-of-region crews do not know the forest roads (SPEC/18 §8.1).
  if (n === 16 || n === 17) for (const u of crews.filter((x) => x.id === "OUT1" || x.id === "OUT2")) {
    // Radio ST-08 (SPEC/31): OUT1 and OUT2 asked in one sentence four minutes apart; each now in its own words.
    if (once(`guide:${u.id}`)) ask(u, n === 16
      ? vary(u.id, 0, [
        L("pyydämme paikallista opasta tai VPK:n miestä mukaan, metsäautotiet eivät ole kartalla oikein.", "we request a local guide or a VPK man to come with us; the forest roads are not right on the map."),
        L("tarvitsemme oppaan, joka tuntee metsäautotiet; kartan tiet eivät täsmää maastoon.", "we need a guide who knows the forest roads; the roads on our map do not match the ground."),
      ])
      : L(`kiertotie maantien kautta ok. Mistä kohtaa pääsemme kaakkoisrintamalle raskaalla autolla?`, `the detour along the main road is OK. Where can we reach the south-east front with a heavy vehicle?`), "vesi_reitit");
  }

  // Evacuation in Lahdenkylä (step 17 on): what is left to do.
  if (n === 17 || n === 18) {
    const u = crews.find((x) => x.anchor === "at:VILLAGE");
    if (u && once(`village:${n}`)) ask(u, n === 17
      ? L("montako taloa Lahdenkylässä on vielä tyhjentämättä? Poliisi on kylän pohjoispäässä, me aloitamme etelästä.", "how many houses in Lahdenkylä are still not cleared? The police are at the north end of the village, we start from the south.")
      // Rescue Act §36 (D1, 6 Oct 2026): the incident commander decides the evacuation; the police carry it out.
      : L("kaksi taloa ilmoittaa jäävänsä. Pyydämme johdolta päätöstä, jatkammeko suostuttelua vai palaammeko linjalle.", "two houses say they are staying. We request a decision from command: do we keep persuading them or return to the line?"), "kohteet");
  }

  // Heat stress on EK11 (SPEC/18 §8.2 step 19): body-worn sensors.
  if (n === 19) {
    const u = crews.find((x) => x.id === "EK11");
    if (u && once("heat")) ask(u, L(`kehoanturit näyttävät kahdella miehellä korkeaa sykettä ja lämpöä klo ${hm(stepStartS(n) + 120)}. Pyydämme ensihoitoa tarkistamaan heidät johtopaikalla.`, `the body sensors show a high heart rate and temperature for two men at ${hm(stepStartS(n) + 120)}. We request paramedics to check them at the command post.`));
  }

  // A crew whose stretch is quiet offers itself — the other half of a request.
  const idle = crews.filter((x) => x.task === "staging" && hoursOnScene(x, n) < 1 && !isShuttle(x.id)); // the water shuttle on stand-by is not idle (fix pass 4)
  // A reinforcement the region holds says so (fix pass 2, FC5): its idle hour at the CP has a reason.
  for (const u of idle) if (once(`offer:${u.id}`)) ask(u, ((p: string) => HELD_FOR_REGION.has(u.id)
    ? L(`valmiina johtopaikalla. Alue pitää meidät varalla toisen palon varalta; siirrymme, kun alue vapauttaa meidät.`, `ready at the command post. The region is holding us in reserve for another fire; we move once the region releases us.`)
    : L(`valmiina johtopaikalla, ${p}.`, `ready at the command post, ${p}.`))(pick(LL(["odotamme tehtävää", "kertokaa mihin siirrytään", "kalusto tarkastettu, valmiina lähtöön"], ["waiting for a task", "tell us where to go", "equipment checked, ready to leave"]))));
}
