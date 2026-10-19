/**
 * Game scenario "Iltatuuli / Evening wind" (hard): the game's own evening on the shared terrain (SPEC/29
 * §2.3 and revision (ay), `31` P-12; it was phase B of the study's incident and replayed its keyed moments).
 * A dry thunderstorm crossed the north of the area at about 15:30; at 16:00 three lightning fires burn
 * in the pine north of Korpioja and Karhujärvi, a fourth strike smoulders unseen and flares up at 16:45
 * (a cabin owner's vague call only). The north-easterly turns east and strengthens to 10 m/s (gusts 15)
 * around 18.00–18.20, driving the fires west and south-west at Mökkiranta's cabins on Karhujärvi's
 * shore. Few units, no road north of Korpioja, the region takes EK12 at 17.05. The 110 kV line is
 * live all game and far from the fires. Nothing here happens at the study's keyed times or places
 * (`test/game/study-keyed-moments.ts`).
 */

import type { GameScenario } from "../contracts.js";
import { at, MOKKIRANTA, PLACES, radio, wx } from "./places.js";

const START = 960; // 16:00
const T = (hhmm: string): number => at(START, hhmm);

export const EVENING_WIND: GameScenario = {
  id: "evening-wind",
  titleFi: "Iltatuuli",
  titleEn: "Evening wind",
  briefingFi: [
    "Klo 16.00. Kuiva ukkosrintama kulki alueen pohjoisosan yli puoli tuntia sitten. Salamat sytyttivät kolme paloa Korpiojan ja Karhujärven pohjoispuolen männiköissä, eikä niille johda tietä. Alueella palaa muitakin metsiä, eikä apua juuri tule.",
    "Sääpalvelu: koillistuuli kääntyy illalla itään ja voimistuu, klo 18 aikaan 9–10 m/s ja puuskat 15 m/s. Kuivaa ilmaa, kosteus laskee 25 %:iin. Silloin palot juoksevat länteen ja lounaaseen kohti Karhujärven rannan mökkejä.",
    "Tavoitteet: Mökkiranta ei saa palaa, paloala pidettävä alle 150 hehtaarin, eikä yhtään miehistöä menetetä.",
    "Salama voi jäädä kytemään puuhun ja syttyä myöhemmin: pidä silmät koko alueella. 110 kV voimajohto on jännitteinen — ei vettä 30 m sisällä. Rakenna puolustuslinjat teiden ja veden varaan ajoissa, ennen tuulta.",
  ].join("\n\n"),
  briefingEn: [
    "16:00. A dry thunderstorm crossed the north of the area half an hour ago. Lightning lit three fires in the pine north of Korpioja and Karhujärvi, with no road to any of them. Other forests are burning in the region, and little help will come.",
    "Weather service: the north-easterly turns east and strengthens toward the evening, 9–10 m/s around 18:00 with gusts of 15 m/s. Dry air, humidity falling to 25 %. That is when the fires run west and south-west at the cabins on Karhujärvi's shore.",
    "Objectives: Mökkiranta (Lakeside Cottages) must not burn, keep the burned area under 150 ha, and lose no crew.",
    "A lightning strike can smoulder in a tree and flare up later: keep eyes on the whole area. The 110 kV line is live — no water within 30 m of it. Build your defensive lines on roads and water early, before the wind.",
  ].join("\n\n"),
  startClockMin: START,
  endAtS: T("20:00"),
  difficulty: "hard",
  ignitions: [PLACES.STRIKE_KORPIOJA, PLACES.STRIKE_KARHUJARVI, PLACES.STRIKE_KOIVUOJA],
  weather: [
    wx(START, "16:00", 30, 4, 8, 26, 32),
    wx(START, "16:20", 35, 4, 7, 26, 31),
    wx(START, "16:40", 40, 4, 7, 25, 31),
    wx(START, "17:00", 50, 5, 8, 25, 30),
    wx(START, "17:20", 60, 6, 9, 24, 29),
    wx(START, "17:40", 70, 8, 12, 24, 27),
    wx(START, "18:00", 80, 10, 15, 23, 25),
    wx(START, "18:20", 85, 10, 15, 23, 25),
    wx(START, "18:40", 90, 8, 13, 22, 26),
    wx(START, "19:10", 95, 6, 10, 21, 28),
    wx(START, "19:40", 100, 5, 8, 20, 30),
    wx(START, "20:00", 100, 4, 7, 19, 32),
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
    { id: "EK16", kind: "engine", arriveAtS: T("17:30"), entryNode: 0 },
    { id: "OUT1", kind: "engine", arriveAtS: T("18:30"), entryNode: 1 },
    { id: "UGV1", kind: "ugv", arriveAtS: T("18:30"), entryNode: 1 },
  ],
  events: [
    {
      atS: 0, kind: "radio",
      message: radio(0, "P3", "command", "important",
        "P3: Salamat sytyttivät kolme paloa Korpiojan ja Karhujärven pohjoispuolelle. Ihmiset ensin: Mökkirannan mökit ovat täynnä lomalaisia, poliisi varoittaa heitä. Puolustava toiminta teiden ja vesistöjen varassa. Ei miehistöä tuulessa juoksevan kärjen eteen.",
        "P3: Lightning has lit three fires north of Korpioja and Karhujärvi. People first: Lakeside Cottages are full of holidaymakers, and the police are warning them. Defensive action on roads and water. No crews ahead of a head running in the wind.",
        PLACES.MOKKIRANTA),
    },
    {
      atS: 60, kind: "radio",
      message: radio(60, "SÄÄ", "support", "important",
        "SÄÄ: Koillistuuli kääntyy itään ja voimistuu klo 17.30–18.30 välillä 8–10 m/s:iin, puuskat 15 m/s. Kuivaa mannerilmaa, kosteus laskee 25 %:iin.",
        "WEATHER: The north-easterly turns east and strengthens between 17:30 and 18:30 to 8–10 m/s, gusts 15 m/s. Dry continental air, humidity falling to 25 %."),
    },
    // A fourth strike has smouldered in a pine since the storm and flares up, unreported…
    { atS: T("16:45"), kind: "ignite", at: PLACES.STRIKE_LATE },
    {
      // …until a cabin owner calls about smoke, with no position.
      atS: T("16:55"), kind: "radio",
      message: radio(T("16:55"), "HÄTÄKESKUS", "command", "important",
        "HÄTÄKESKUS: Mökkiläinen ilmoittaa uutta savua Karhujärven koillispuolelta.",
        "EMERGENCY CENTRE: A cabin owner reports new smoke north-east of Karhujärvi."),
    },
    {
      atS: T("17:05"), kind: "units_recalled", unitIds: ["EK12"],
      message: radio(T("17:05"), "P3", "command", "important",
        "P3: Alue tarvitsee EK12:n rakennuspaloon taajamassa. Korvaavaa yksikköä ei tule ennen iltaa.",
        "P3: The region needs EK12 for a building fire in town. No replacement before the evening."),
    },
    {
      atS: T("17:30"), kind: "weather_warning",
      message: radio(T("17:30"), "SÄÄ", "support", "urgent",
        "SÄÄ: VAROITUS: itätuuli 9–10 m/s, puuskat 14–15 m/s klo 17.50–18.30. Vesidroonien ja helikopterin toiminta voi keskeytyä.",
        "WEATHER: WARNING: easterly 9–10 m/s, gusts 14–15 m/s from 17:50 to 18:30. Water drones and the helicopter may have to stop."),
    },
    {
      atS: T("18:10"), kind: "radio",
      message: radio(T("18:10"), "P3", "command", "important",
        "P3: Poliisi on tyhjentänyt Mökkirannan mökit. Mökkitie on suljettu muulta liikenteeltä.",
        "P3: The police have cleared Lakeside Cottages. The cabin road is closed to other traffic.",
        PLACES.MOKKIRANTA),
    },
  ],
  objectives: [
    { kind: "protect_settlement", settlementId: MOKKIRANTA },
    { kind: "limit_area", maxHa: 150 },
    { kind: "no_casualties" },
  ],
  powerLineLiveAtStart: true,
};
