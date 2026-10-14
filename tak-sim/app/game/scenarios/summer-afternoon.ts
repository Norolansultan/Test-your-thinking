/**
 * Game scenario "Kesäiltapäivä / Summer afternoon" (normal): the SPEC/18 incident from the first
 * hour — a harvester fire at noon in the fourth week of a drought, the south-westerly that backs ahead
 * of a weak front and turns west after 17:00, the ridge ignition at 14:00, the 110 kV line that stays
 * live until 15:30, the rekindle at the origin at 17:00, and the region taking units back at 17:40.
 * Reinforcements follow SPEC/18 §8.2 and revisions (y), (aa).
 */

import type { GameScenario } from "../contracts.js";
import { at, LAHDENKYLA, PLACES, radio, wx } from "./places.js";

const START = 720; // 12:00
const T = (hhmm: string): number => at(START, hhmm);

export const SUMMER_AFTERNOON: GameScenario = {
  id: "summer-afternoon",
  titleFi: "Kesäiltapäivä",
  titleEn: "Summer afternoon",
  briefingFi: [
    "Perjantai heinäkuun lopussa, neljäs viikko ilman sadetta. Klo 11.32 harvesterin kuljettaja soitti 112:een: hakkuuaukealla palaa, ja savu kääntyy koilliseen.",
    "Olet pelastustoiminnan johtaja. Käytössäsi alkuun EK11, VPK, EK12 ja lämpökamerakopteri DR1; vahvennuksia tulee iltapäivän mittaan — maastopaloyksikkö, säiliöauto, drooniryhmä, helikopteri.",
    "Tavoitteet: suojaa Lahdenkylä, saa palo rajattua klo 20 mennessä, ja tuo jokainen miehistö kotiin.",
    "Muista: 110 kV voimajohto on jännitteinen klo 15.30 asti — ei vettä 30 m sisällä. Tuuli kääntyy iltapäivällä ensin etelään ja klo 17 jälkeen länteen; pohjoiskylki voi muuttua kärjeksi. Kuusikkoon ei hyökätä suoraan, jos teho kasvaa.",
  ].join("\n\n"),
  briefingEn: [
    "A Friday at the end of July, the fourth week without rain. At 11:32 a harvester operator called 112: the clear-cut is burning and the smoke is turning north-east.",
    "You are the incident commander. You start with EK11, the volunteer brigade VPK, EK12 and the thermal drone DR1; reinforcements arrive through the afternoon — a forest-fire unit, a water tanker, the drone team, a helicopter.",
    "Objectives: protect Lahdenkylä (Bay Village), contain the fire by 20:00, and bring every crew home.",
    "Remember: the 110 kV line is live until 15:30 — no water within 30 m of it. The wind backs south in the afternoon and turns west after 17:00; the north flank can become a head. Do not attack into the spruce head when it runs hot.",
  ].join("\n\n"),
  startClockMin: START,
  endAtS: T("20:00"),
  difficulty: "normal",
  ignitions: [PLACES.IGN],
  weather: [
    wx(START, "12:00", 225, 4, 7, 27, 30),
    wx(START, "13:00", 230, 5, 9, 28, 28),
    wx(START, "14:00", 235, 6, 11, 29, 26),
    wx(START, "15:00", 225, 6, 12, 29, 25),
    wx(START, "15:40", 210, 6, 10, 27, 30),
    wx(START, "16:00", 190, 5, 9, 25, 36),
    wx(START, "16:20", 170, 4, 7, 23, 42),
    wx(START, "17:00", 260, 5, 9, 23, 40),
    wx(START, "18:00", 270, 6, 10, 22, 35),
    wx(START, "19:00", 280, 5, 9, 20, 38),
    wx(START, "20:00", 285, 4, 7, 19, 42),
  ],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: 0 },
    { id: "EK12", kind: "engine", arriveAtS: 0 },
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "EK14", kind: "forest_unit", arriveAtS: T("13:20"), entryNode: 1 },
    { id: "DR2", kind: "drone_thermal", arriveAtS: T("13:20") },
    { id: "DR3", kind: "drone_vtol", arriveAtS: T("13:20") },
    { id: "SPOT", kind: "spotter", arriveAtS: T("13:20"), entryNode: 1 },
    { id: "EK13", kind: "tanker", arriveAtS: T("13:30"), entryNode: 0 },
    { id: "KY21", kind: "engine", arriveAtS: T("13:45"), entryNode: 2 },
    { id: "HELI1", kind: "helicopter", arriveAtS: T("15:40"), entryNode: 1 },
    { id: "EK15", kind: "engine", arriveAtS: T("16:20"), entryNode: 0 },
    { id: "VD1", kind: "drone_water", arriveAtS: T("16:40") },
    { id: "EK16", kind: "engine", arriveAtS: T("16:42"), entryNode: 0 },
    { id: "KY23", kind: "engine", arriveAtS: T("16:43"), entryNode: 2 },
    { id: "OUT1", kind: "engine", arriveAtS: T("18:20"), entryNode: 1 },
    { id: "UGV1", kind: "ugv", arriveAtS: T("18:20"), entryNode: 1 },
    { id: "OUT2", kind: "engine", arriveAtS: T("18:30"), entryNode: 1 },
  ],
  events: [
    {
      atS: 0, kind: "radio",
      message: radio(0, "HÄTÄKESKUS", "command", "important",
        "HÄTÄKESKUS: Maastopalo hakkuuaukealla Kuivakankaan lounaispuolella. Ilmoittaja harvesterin kuljettaja klo 11.32. Palo leviää koilliseen, savu näkyy kauas.",
        "EMERGENCY CENTRE: Wildfire on a clear-cut south-west of Kuivakangas. Reported by the harvester operator at 11:32. Spreading north-east, smoke visible from afar.",
        PLACES.IGN),
    },
    {
      atS: 60, kind: "radio",
      message: radio(60, "P3", "command", "important",
        "P3: Tavoite: palo rajataan metsäautotien, Haukilammen ja Rahkasuon väliin. Painopiste: kärki pysäytettävä koillisessa ennen kuusikkoa. Suora hyökkäys siellä, missä teho sallii. Lahdenkylä suojattava.",
        "P3: Intent: contain the fire between the forest road, Haukilampi and Rahkasuo. Priority: stop the head in the north-east before the spruce. Direct attack where intensity allows. Bay Village must be protected."),
    },
    { atS: T("14:00"), kind: "ignite", at: PLACES.KUIVAKANGAS },
    {
      atS: T("14:30"), kind: "weather_warning",
      message: radio(T("14:30"), "SÄÄ", "support", "important",
        "SÄÄ: Ilmatieteen laitos: puuskat jopa 12–13 m/s klo 15 aikaan. Metsäpalovaroitus voimassa.",
        "WEATHER: Finnish Meteorological Institute: gusts up to 12–13 m/s around 15:00. Forest-fire warning in force."),
    },
    {
      atS: T("15:30"), kind: "power_line_dead",
      message: radio(T("15:30"), "P3", "command", "important",
        "P3: Verkkoyhtiö: 110 kV johto kytketty irti ja maadoitettu klo 15.30. Vettä saa käyttää johtoalueella.",
        "P3: Grid operator: the 110 kV line is disconnected and earthed as of 15:30. Water may be used in the line corridor."),
    },
    {
      atS: T("15:50"), kind: "weather_warning",
      message: radio(T("15:50"), "SÄÄ", "support", "important",
        "SÄÄ: Heikko sääfrontti lähestyy: tuuli kääntyy klo 16 aikaan etelään ja klo 17 jälkeen länteen, 5–6 m/s. Pohjoiskylki voi muuttua kärjeksi kohti Mökkirantaa.",
        "WEATHER: A weak front is approaching: the wind backs south around 16:00 and turns west after 17:00, 5–6 m/s. The north flank may become a head toward Lakeside Cottages."),
    },
    {
      atS: T("16:00"), kind: "radio",
      message: radio(T("16:00"), "P3", "command", "routine",
        "P3: Mökkirannan mökkien asukastilanne on epäselvä, poliisi on tiedotettu.",
        "P3: Occupancy of the Lakeside Cottages is unknown; the police have been informed.",
        PLACES.MOKKIRANTA),
    },
    { atS: T("17:00"), kind: "ignite", at: { x: PLACES.IGN.x + 85, y: PLACES.IGN.y - 115 } },
    {
      atS: T("17:01"), kind: "radio",
      message: radio(T("17:01"), "SPOT", "air", "important",
        "SPOT: Uusi palo syttymäkohdan kaakkoispuolella, noin 120 m vanhasta reunasta. Noin 0,5 ha, liekit alle metrin.",
        "SPOT: A new fire south-east of the point of origin, about 120 m outside the old edge. About 0.5 ha, flames under a metre.",
        { x: PLACES.IGN.x + 85, y: PLACES.IGN.y - 115 }),
    },
    {
      atS: T("17:40"), kind: "units_recalled", unitIds: ["KY21", "DR3"],
      message: radio(T("17:40"), "P3", "command", "important",
        "P3: Alue tarvitsee KY21:n ja DR3:n toiselle palolle klo 17.40 alkaen. Irrottakaa ne heti.",
        "P3: The region needs KY21 and DR3 at another fire from 17:40. Release them now."),
    },
    {
      atS: T("19:00"), kind: "radio",
      message: radio(T("19:00"), "P3", "command", "routine",
        "P3: Yön organisaatio saapuu klo 20.00. Luovutus tehdään linjoilla, ei johtopaikalla.",
        "P3: The night organisation arrives at 20:00. Handover on the lines, not at the command post."),
    },
  ],
  objectives: [
    { kind: "protect_settlement", settlementId: LAHDENKYLA },
    { kind: "contain", byS: T("20:00") },
    { kind: "no_casualties" },
  ],
  powerLineLiveAtStart: true,
};
