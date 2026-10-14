/**
 * Game scenario "Iltatuuli / Evening wind" (hard): phase B of the SPEC/18 incident. At 16:00 three
 * fronts burn — the head near Kuivakangas, the rekindle at the origin and Rahkasuo's peat — the wind
 * swings through the south to the north-west, and the evening wind event peaks at 11 m/s (gusts 16)
 * around 19:00 (SPEC/18 §6 cycle 17, aa.1), driving the south-east front at Lahdenkylä. Fewer units,
 * the 110 kV line stays live all evening, the ditch spoil banks surface at 17:00 unreported, and the
 * helicopter is taken for another fire at 18:40.
 */

import type { GameScenario } from "../contracts.js";
import { at, LAHDENKYLA, PLACES, radio, wx } from "./places.js";

const START = 960; // 16:00
const T = (hhmm: string): number => at(START, hhmm);

const SURFACING = { x: 5640, y: 3420 };

export const EVENING_WIND: GameScenario = {
  id: "evening-wind",
  titleFi: "Iltatuuli",
  titleEn: "Evening wind",
  briefingFi: [
    "Klo 16.00. Palo on jo iso: kärki Kuivakankaan harjulla, uusi palo syttymäkohdan vieressä ja Rahkasuon turve kytee. Alueella on kolme muutakin paloa, eikä apua juuri tule.",
    "Sääpalvelu: luoteistuuli voimistuu illalla, klo 19 aikaan 11 m/s ja puuskat yli 15 m/s. Kuivaa ilmaa, kosteus laskee alle 30 %:n. Silloin kaakkoisrintama juoksee kohti Lahdenkylää.",
    "Tavoitteet: Lahdenkylä ei saa palaa, paloala pidettävä alle 150 hehtaarin, eikä yhtään miehistöä menetetä.",
    "Verkkoyhtiö ei saa 110 kV johtoa jännitteettömäksi — ei vettä 30 m sisällä koko iltana. HELI1 voidaan viedä toiselle palolle. Rakenna puolustuslinjat teiden ja veden varaan ajoissa, ennen tuulta.",
  ].join("\n\n"),
  briefingEn: [
    "16:00. The fire is already big: the head on the Kuivakangas esker, a new fire beside the point of origin, and Rahkasuo's peat smouldering. Three other fires burn in the region, and little help will come.",
    "Weather service: the north-westerly strengthens in the evening, 11 m/s around 19:00 with gusts over 15 m/s. Dry air, humidity below 30 %. That is when the south-east front runs at Lahdenkylä (Bay Village).",
    "Objectives: Bay Village must not burn, keep the burned area under 150 ha, and lose no crew.",
    "The grid operator cannot de-energise the 110 kV line — no water within 30 m of it all evening. HELI1 may be taken for another fire. Build your defensive lines on roads and water early, before the wind.",
  ].join("\n\n"),
  startClockMin: START,
  endAtS: T("20:00"),
  difficulty: "hard",
  ignitions: [
    { x: PLACES.KUIVAKANGAS.x - 10, y: PLACES.KUIVAKANGAS.y - 10 },
    { x: PLACES.IGN.x + 120, y: PLACES.IGN.y - 50 },
    { x: PLACES.RAHKASUO.x + 40, y: PLACES.RAHKASUO.y + 20 },
  ],
  weather: [
    wx(START, "16:00", 160, 5, 9, 25, 38),
    wx(START, "16:20", 130, 4, 7, 24, 40),
    wx(START, "16:40", 180, 3, 5, 23, 42),
    wx(START, "17:00", 240, 3, 6, 22, 40),
    wx(START, "17:20", 270, 5, 8, 23, 36),
    wx(START, "17:40", 280, 5, 10, 23, 33),
    wx(START, "18:00", 290, 6, 11, 22, 30),
    wx(START, "18:20", 310, 7, 12, 22, 28),
    wx(START, "18:40", 315, 9, 14, 21, 26),
    wx(START, "19:00", 315, 11, 16, 20, 25),
    wx(START, "19:20", 320, 8, 13, 20, 26),
    wx(START, "19:40", 320, 6, 11, 19, 28),
    wx(START, "20:00", 320, 5, 9, 19, 30),
  ],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: 0 },
    { id: "EK12", kind: "engine", arriveAtS: 0 },
    { id: "EK14", kind: "forest_unit", arriveAtS: 0 },
    { id: "KY21", kind: "engine", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "DR2", kind: "drone_thermal", arriveAtS: 0 },
    { id: "HELI1", kind: "helicopter", arriveAtS: 0 },
    { id: "KY23", kind: "engine", arriveAtS: T("17:00"), entryNode: 2 },
    { id: "EK16", kind: "engine", arriveAtS: T("17:40"), entryNode: 0 },
    { id: "OUT1", kind: "engine", arriveAtS: T("18:30"), entryNode: 1 },
    { id: "UGV1", kind: "ugv", arriveAtS: T("18:30"), entryNode: 1 },
  ],
  events: [
    {
      atS: 0, kind: "radio",
      message: radio(0, "P3", "command", "important",
        "P3: Alueella on nyt kolme maastopaloa. Ihmiset ja asutus ensin: valmistaudu Lahdenkylän evakuointiin poliisin kanssa. Puolustava toiminta teiden ja vesistöjen varassa. Ei miehistöä kärjen eteen kuusikossa.",
        "P3: There are now three wildfires in the region. People and settlement first: prepare Bay Village's evacuation with the police. Defensive action on roads and water. No crews ahead of the head in the spruce.",
        PLACES.LAHDENKYLA),
    },
    {
      atS: 60, kind: "radio",
      message: radio(60, "SÄÄ", "support", "important",
        "SÄÄ: Luoteistuuli voimistuu klo 18.30–19.00 välillä 7–9 m/s, puuskat 12 m/s, paikoin yli 15 m/s. Kuivaa mannerilmaa, kosteus laskee 25–30 %:iin.",
        "WEATHER: The north-westerly strengthens between 18:30 and 19:00 to 7–9 m/s, gusts 12 m/s, locally over 15 m/s. Dry continental air, humidity falling to 25–30 %."),
    },
    {
      atS: 600, kind: "radio",
      message: radio(600, "P3", "command", "important",
        "P3: Verkkoyhtiö ei saa 110 kV johtoa jännitteettömäksi tänään. Käsitelkää johto jännitteisenä koko illan.",
        "P3: The grid operator cannot de-energise the 110 kV line today. Treat it as live all evening."),
    },
    { atS: T("17:00"), kind: "ignite", at: SURFACING },
    {
      atS: T("17:10"), kind: "radio",
      message: radio(T("17:10"), "HÄTÄKESKUS", "command", "important",
        "HÄTÄKESKUS: Mökkiläinen ilmoittaa savua Rahkasuon kaakkoispuolelta, Lahdenkylän suunnasta katsottuna.",
        "EMERGENCY CENTRE: A cabin owner reports smoke south-east of Rahkasuo, seen from the direction of Bay Village."),
    },
    {
      atS: T("18:20"), kind: "weather_warning",
      message: radio(T("18:20"), "SÄÄ", "support", "urgent",
        "SÄÄ: VAROITUS: puuskat 14–16 m/s klo 18.40–19.20. Vesidroonien ja helikopterin toiminta voi keskeytyä.",
        "WEATHER: WARNING: gusts 14–16 m/s from 18:40 to 19:20. Water drones and the helicopter may have to stop."),
    },
    {
      atS: T("18:40"), kind: "units_recalled", unitIds: ["HELI1"],
      message: radio(T("18:40"), "P3", "command", "important",
        "P3: HELI1 siirtyy toiselle palolle. Korvaavaa konetta ei tänään saada.",
        "P3: HELI1 is moving to another fire. No replacement aircraft today."),
    },
    {
      atS: T("18:50"), kind: "radio",
      message: radio(T("18:50"), "P3", "command", "important",
        "P3: Poliisi aloittaa Lahdenkylän evakuoinnin. Kaksi taloutta kieltäytyy lähtemästä.",
        "P3: The police are starting Bay Village's evacuation. Two households refuse to leave.",
        PLACES.LAHDENKYLA),
    },
  ],
  objectives: [
    { kind: "protect_settlement", settlementId: LAHDENKYLA },
    { kind: "limit_area", maxHa: 150 },
    { kind: "no_casualties" },
  ],
  powerLineLiveAtStart: true,
};
