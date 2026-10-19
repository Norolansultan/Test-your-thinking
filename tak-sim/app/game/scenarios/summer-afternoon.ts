/**
 * Game scenario "Kesäiltapäivä / Summer afternoon" (normal): the harvester fire of SPEC/18 from its first
 * hour — burning for 40 minutes before the game starts (lit ~11:20, called in at 11:32); EK11 is first
 * on scene at noon, VPK and EK12 follow minutes later, so the initial attack is a race. The ridge
 * ignition at 14:00 (unreported) and the reinforcements up to HELI1 (SPEC/18 §8.2, revisions (y), (aa))
 * are the study's opening; from mid-afternoon the story is the game's own (SPEC/29 §2.3 and revision
 * (ay), `31` P-12): the south-westerly holds and eases, the wind backs through the south to the east as
 * a low passes, and an easterly peaks around 18.20–18.35 that drives anything still burning west at the
 * command post and Mökkiranta. The region takes EK12 and DR2 at 16.15; the later reinforcements come on
 * the game's own times; the ridge fire's old edge on Kuivakangas flares up as the wind backs at 17.35 (a
 * hiker's vague call only). The 110 kV line is live all game (no switching, `29` (ay) rule 1). Nothing
 * here happens at the study's keyed times or places (`test/game/study-keyed-moments.ts`). Balance:
 * `npm run game:balance`.
 */

import type { GameScenario } from "../contracts.js";
import { at, MOKKIRANTA, PLACES, radio, wx } from "./places.js";

const START = 720; // 12:00
const T = (hhmm: string): number => at(START, hhmm);

export const SUMMER_AFTERNOON: GameScenario = {
  id: "summer-afternoon",
  titleFi: "Kesäiltapäivä",
  titleEn: "Summer afternoon",
  briefingFi: [
    "Perjantai heinäkuun lopussa, neljäs viikko ilman sadetta. Klo 11.32 harvesterin kuljettaja soitti 112:een: hakkuuaukealla palaa, ja savu kääntyy koilliseen.",
    "Olet pelastustoiminnan johtaja. Palo on palanut jo puoli tuntia. EK11 ja lämpökamerakopteri DR1 ovat paikalla, VPK ja EK12 tulevat muutaman minuutin päästä; vahvennuksia tulee iltapäivän mittaan — maastopaloyksikkö, säiliöauto, drooniryhmä, helikopteri.",
    "Tavoitteet: suojaa Mökkiranta, saa palo rajattua klo 20 mennessä, ja tuo jokainen miehistö kotiin. Peli voitetaan vasta, kun mikään ei enää pala eikä kyte.",
    "Muista: 110 kV voimajohto on jännitteinen — ei vettä 30 m sisällä. Lounaistuuli heikkenee iltapäivällä; matalapaine kulkee alueen eteläpuolitse, ja tuuli kääntyy illalla itään ja voimistuu — silloin kaikki, mikä vielä palaa, juoksee länteen kohti johtopaikkaa ja Mökkirantaa. Pidä silmät koko alueella: uusia paloja voi syttyä. Kuusikkoon ei hyökätä suoraan, jos teho kasvaa.",
  ].join("\n\n"),
  briefingEn: [
    "A Friday at the end of July, the fourth week without rain. At 11:32 a harvester operator called 112: the clear-cut is burning and the smoke is turning north-east.",
    "You are the incident commander. The fire has been burning for half an hour. EK11 and the thermal drone DR1 are on scene, the volunteer brigade VPK and EK12 are minutes away; reinforcements arrive through the afternoon — a forest-fire unit, a water tanker, the drone team, a helicopter.",
    "Objectives: protect Mökkiranta (Lakeside Cottages), contain the fire by 20:00, and bring every crew home. The game is won only when nothing burns or smoulders any more.",
    "Remember: the 110 kV line is live — no water within 30 m of it. The south-westerly eases in the afternoon; a low passes south of the area, and in the evening the wind turns east and strengthens — whatever still burns then runs west at the command post and Lakeside Cottages. Keep eyes on the whole area: new fires can start. Do not attack into the spruce head when it runs hot.",
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
    // From here the game's own afternoon (SPEC/29 (ay)): the south-westerly holds and eases, then backs
    // through the south to the east as a low passes south of the area; the easterly peaks at 18.20.
    wx(START, "16:20", 215, 4, 7, 27, 31),
    wx(START, "17:10", 195, 2, 4, 26, 32),
    wx(START, "17:30", 140, 3, 5, 25, 33),
    wx(START, "17:50", 105, 5, 8, 24, 32),
    wx(START, "18:05", 95, 7, 11, 24, 30),
    wx(START, "18:20", 90, 9, 14, 23, 28),
    wx(START, "18:35", 90, 10, 15, 23, 27),
    wx(START, "18:50", 95, 8, 13, 22, 28),
    wx(START, "19:10", 100, 6, 10, 21, 30),
    wx(START, "19:30", 100, 5, 8, 20, 32),
    wx(START, "20:00", 100, 4, 7, 19, 34),
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
    { id: "EK15", kind: "engine", arriveAtS: T("16:30"), entryNode: 0 },
    { id: "VD1", kind: "drone_water", arriveAtS: T("16:50") },
    { id: "EK16", kind: "engine", arriveAtS: T("16:55"), entryNode: 0 },
    { id: "KY23", kind: "engine", arriveAtS: T("17:05"), entryNode: 2 },
    { id: "OUT1", kind: "engine", arriveAtS: T("17:50"), entryNode: 1 },
    { id: "UGV1", kind: "ugv", arriveAtS: T("17:50"), entryNode: 1 },
    { id: "OUT2", kind: "engine", arriveAtS: T("18:00"), entryNode: 1 },
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
        "P3: Tavoite: palo rajataan metsäautotien, Haukilammen ja Rahkasuon väliin. Painopiste: kärki pysäytettävä koillisessa ennen kuusikkoa. Suora hyökkäys siellä, missä teho sallii. Mökkiranta suojattava.",
        "P3: Intent: contain the fire between the forest road, Haukilampi and Rahkasuo. Priority: stop the head in the north-east before the spruce. Direct attack where intensity allows. Lakeside Cottages must be protected."),
    },
    { atS: T("14:00"), kind: "ignite", at: PLACES.KUIVAKANGAS },
    {
      atS: T("14:30"), kind: "weather_warning",
      message: radio(T("14:30"), "SÄÄ", "support", "important",
        "SÄÄ: Ilmatieteen laitos: puuskat jopa 12–13 m/s klo 15 aikaan. Metsäpalovaroitus voimassa.",
        "WEATHER: Finnish Meteorological Institute: gusts up to 12–13 m/s around 15:00. Forest-fire warning in force."),
    },
    {
      atS: T("16:10"), kind: "weather_warning",
      message: radio(T("16:10"), "SÄÄ", "support", "important",
        "SÄÄ: Matalapaine kulkee alueen eteläpuolitse. Lounaistuuli heikkenee ja kääntyy etelän kautta itään klo 17.30–18 välillä. Itätuuli voimistuu klo 18.20 aikaan 9–10 m/s:iin, puuskat 15 m/s. Palon länsi- ja luoteisreuna voivat silloin muuttua kärjeksi kohti johtopaikkaa ja Mökkirantaa.",
        "WEATHER: A low is passing south of the area. The south-westerly eases and backs through the south to the east between 17:30 and 18:00. The easterly strengthens to 9–10 m/s around 18:20, gusts 15 m/s. The fire's west and north-west edges may then become heads toward the command post and Lakeside Cottages."),
    },
    {
      atS: T("16:15"), kind: "units_recalled", unitIds: ["EK12", "DR2"],
      message: radio(T("16:15"), "P3", "command", "important",
        "P3: Alue tarvitsee EK12:n ja DR2:n toiselle palolle. Irrottakaa ne heti; korvaavat yksiköt ovat matkalla.",
        "P3: The region needs EK12 and DR2 at another fire. Release them now; replacement units are on their way."),
    },
    {
      atS: T("17:15"), kind: "radio",
      message: radio(T("17:15"), "P3", "command", "routine",
        "P3: Mökkirannan mökkien asukastilanne on epäselvä, poliisi on tiedotettu.",
        "P3: Occupancy of the Lakeside Cottages is unknown; the police have been informed.",
        PLACES.MOKKIRANTA),
    },
    // The ridge fire's old edge on Kuivakangas flares up as the wind backs (if the crews soaked it, the nearest unburned
    // fuel catches; sim/events.ts)…
    { atS: T("17:35"), kind: "ignite", at: PLACES.KUIVAKANGAS },
    {
      atS: T("17:45"), kind: "weather_warning",
      message: radio(T("17:45"), "SÄÄ", "support", "urgent",
        "SÄÄ: VAROITUS: itätuuli 8–10 m/s, puuskat 13–15 m/s klo 18.10–18.50. Vesidroonien ja helikopterin toiminta voi keskeytyä.",
        "WEATHER: WARNING: easterly 8–10 m/s, gusts 13–15 m/s from 18:10 to 18:50. Water drones and the helicopter may have to stop."),
    },
    {
      // …and only a hiker's vague call reports it.
      atS: T("17:48"), kind: "radio",
      message: radio(T("17:48"), "HÄTÄKESKUS", "command", "important",
        "HÄTÄKESKUS: Retkeilijä ilmoittaa savua nousevan taas Kuivakankaan harjulta.",
        "EMERGENCY CENTRE: A hiker reports smoke rising again from the Kuivakangas esker."),
    },
    {
      atS: T("19:15"), kind: "radio",
      message: radio(T("19:15"), "P3", "command", "routine",
        "P3: Yön organisaatio saapuu klo 20.00. Luovutus tehdään linjoilla, ei johtopaikalla.",
        "P3: The night organisation arrives at 20:00. Handover on the lines, not at the command post."),
    },
  ],
  objectives: [
    { kind: "protect_settlement", settlementId: MOKKIRANTA },
    { kind: "contain", byS: T("20:00") },
    { kind: "no_casualties" },
  ],
  powerLineLiveAtStart: true,
};
