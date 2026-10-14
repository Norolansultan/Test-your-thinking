/**
 * Game scenario "Kesäiltapäivä / Summer afternoon" (normal): the SPEC/18 incident from the first
 * hour — a harvester fire in the fourth week of a drought, burning for 40 minutes before the game
 * starts (lit ~11:20, called in at 11:32); EK11 is first on scene at noon, VPK and EK12 follow
 * minutes later, so the initial attack is a race. The south-westerly backs ahead of a weak front,
 * turns west after 17:00 and the north-westerly evening wind (the same afternoon as "Evening wind")
 * peaks around 19:00 and drives anything still burning south-east at Lahdenkylä. Separate fires the
 * player must find and catch: the ridge ignition at 14:00 (unreported), the rekindle at the origin's
 * old edge at 17:00 (SPOT reports it) and Rahkasuo's spoil banks surfacing at 17:20 (a vague call
 * only). The 110 kV line stays live until 15:30; the region takes units back at 17:40.
 * Reinforcements follow SPEC/18 §8.2 and revisions (y), (aa). Balance: `npm run game:balance`.
 */

import type { GameScenario } from "../contracts.js";
import { at, LAHDENKYLA, PLACES, radio, wx } from "./places.js";

const START = 720; // 12:00
const T = (hhmm: string): number => at(START, hhmm);

/** Rahkasuo's ditch-spoil banks south-east of the origin, where the peat holdover surfaces (as in "Evening wind"). */
const SURFACING = { x: 5640, y: 3420 };

export const SUMMER_AFTERNOON: GameScenario = {
  id: "summer-afternoon",
  titleFi: "Kesäiltapäivä",
  titleEn: "Summer afternoon",
  briefingFi: [
    "Perjantai heinäkuun lopussa, neljäs viikko ilman sadetta. Klo 11.32 harvesterin kuljettaja soitti 112:een: hakkuuaukealla palaa, ja savu kääntyy koilliseen.",
    "Olet pelastustoiminnan johtaja. Palo on palanut jo puoli tuntia. EK11 ja lämpökamerakopteri DR1 ovat paikalla, VPK ja EK12 tulevat muutaman minuutin päästä; vahvennuksia tulee iltapäivän mittaan — maastopaloyksikkö, säiliöauto, drooniryhmä, helikopteri.",
    "Tavoitteet: suojaa Lahdenkylä, saa palo rajattua klo 20 mennessä, ja tuo jokainen miehistö kotiin. Peli voitetaan vasta, kun mikään ei enää pala eikä kyte.",
    "Muista: 110 kV voimajohto on jännitteinen klo 15.30 asti — ei vettä 30 m sisällä. Tuuli kääntyy iltapäivällä kaakkoon, klo 17 jälkeen länteen ja illalla luoteeseen, puuskat yli 15 m/s klo 19 aikaan — silloin kaikki, mikä vielä palaa, juoksee kohti Lahdenkylää. Pidä silmät koko alueella: uusia paloja voi syttyä. Kuusikkoon ei hyökätä suoraan, jos teho kasvaa.",
  ].join("\n\n"),
  briefingEn: [
    "A Friday at the end of July, the fourth week without rain. At 11:32 a harvester operator called 112: the clear-cut is burning and the smoke is turning north-east.",
    "You are the incident commander. The fire has been burning for half an hour. EK11 and the thermal drone DR1 are on scene, the volunteer brigade VPK and EK12 are minutes away; reinforcements arrive through the afternoon — a forest-fire unit, a water tanker, the drone team, a helicopter.",
    "Objectives: protect Lahdenkylä (Bay Village), contain the fire by 20:00, and bring every crew home. The game is won only when nothing burns or smoulders any more.",
    "Remember: the 110 kV line is live until 15:30 — no water within 30 m of it. The wind backs south-east in the afternoon, turns west after 17:00 and north-west in the evening, gusting over 15 m/s around 19:00 — whatever still burns then runs at Bay Village. Keep eyes on the whole area: new fires can start. Do not attack into the spruce head when it runs hot.",
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
    // From 16:00 the same afternoon as "Evening wind" (phase B): the wind backs through the south-east,
    // turns west after 17:00 and the north-westerly peaks around 19:00 (SPEC/18 §6 cycles 9–17, aa.1).
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
  preBurnS: 40 * 60,
  units: [
    // SPEC/18 §8.2 W1–W4: EK11 first (launching DR1), VPK minutes behind, EK12 last of the first alarm.
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: T("12:06"), entryNode: 2 },
    { id: "EK12", kind: "engine", arriveAtS: T("12:15"), entryNode: 0 },
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
        "SÄÄ: Heikko sääfrontti lähestyy: tuuli kääntyy klo 16 aikaan kaakkoon ja klo 17 jälkeen länteen. Illalla luoteistuuli voimistuu, klo 19 aikaan 11 m/s, puuskat 16 m/s. Pohjoiskylki voi muuttua kärjeksi kohti Mökkirantaa, illalla kaakkoisreuna kohti Lahdenkylää.",
        "WEATHER: A weak front is approaching: the wind backs south-east around 16:00 and turns west after 17:00. In the evening the north-westerly strengthens to 11 m/s around 19:00, gusts 16 m/s. The north flank may become a head toward Lakeside Cottages, and in the evening the south-east edge a head toward Bay Village."),
    },
    {
      atS: T("16:00"), kind: "radio",
      message: radio(T("16:00"), "P3", "command", "routine",
        "P3: Mökkirannan mökkien asukastilanne on epäselvä, poliisi on tiedotettu.",
        "P3: Occupancy of the Lakeside Cottages is unknown; the police have been informed.",
        PLACES.MOKKIRANTA),
    },
    // The origin's old edge flares up (if the crews soaked the ground there, the nearest unburned fuel catches; sim/events.ts).
    { atS: T("17:00"), kind: "ignite", at: { x: PLACES.IGN.x + 85, y: PLACES.IGN.y - 115 } },
    {
      atS: T("17:01"), kind: "radio",
      message: radio(T("17:01"), "SPOT", "air", "important",
        "SPOT: Uusi palo syttymäkohdan kaakkoispuolella, noin 120 m vanhasta reunasta. Noin 0,5 ha, liekit alle metrin.",
        "SPOT: A new fire south-east of the point of origin, about 120 m outside the old edge. About 0.5 ha, flames under a metre.",
        { x: PLACES.IGN.x + 85, y: PLACES.IGN.y - 115 }),
    },
    // SPEC/18 cycle 12: the 2024 ditch-spoil banks in Rahkasuo surface as open fire, unreported…
    { atS: T("17:20"), kind: "ignite", at: SURFACING },
    {
      // …until a cabin owner calls about smoke, with no position.
      atS: T("17:35"), kind: "radio",
      message: radio(T("17:35"), "HÄTÄKESKUS", "command", "important",
        "HÄTÄKESKUS: Mökkiläinen ilmoittaa savua Rahkasuon kaakkoispuolelta, Lahdenkylän suunnasta katsottuna.",
        "EMERGENCY CENTRE: A cabin owner reports smoke south-east of Rahkasuo, seen from the direction of Bay Village."),
    },
    {
      atS: T("17:40"), kind: "units_recalled", unitIds: ["KY21", "DR3"],
      message: radio(T("17:40"), "P3", "command", "important",
        "P3: Alue tarvitsee KY21:n ja DR3:n toiselle palolle klo 17.40 alkaen. Irrottakaa ne heti.",
        "P3: The region needs KY21 and DR3 at another fire from 17:40. Release them now."),
    },
    {
      atS: T("18:20"), kind: "weather_warning",
      message: radio(T("18:20"), "SÄÄ", "support", "urgent",
        "SÄÄ: VAROITUS: luoteistuuli 9–11 m/s, puuskat 14–16 m/s klo 18.40–19.20. Vesidroonien ja helikopterin toiminta voi keskeytyä.",
        "WEATHER: WARNING: north-westerly 9–11 m/s, gusts 14–16 m/s from 18:40 to 19:20. Water drones and the helicopter may have to stop."),
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
