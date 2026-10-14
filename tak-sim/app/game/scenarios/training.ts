/**
 * Game scenario "Harjoitus / Training" (easy): a small fire beside the forest road, burning for 40
 * minutes before the game starts (about 2 ha), a light south-westerly and every unit on hand within
 * ten minutes. P3 talks the player through each kind of order; the 110 kV line is de-energised after
 * half an hour so the player meets the rule first. Sized so that a crew sent in contains it in about
 * 15–30 minutes and the game (out and mopped up) lasts through the tutorial; left alone it grows past
 * the area limit. Balance: `npm run game:balance`.
 */

import type { GameScenario } from "../contracts.js";
import { at, radio, wx } from "./places.js";

const START = 600; // 10:00
const T = (hhmm: string): number => at(START, hhmm);

const FIRE = { x: 4700, y: 5150 };

export const TRAINING: GameScenario = {
  id: "training",
  titleFi: "Harjoitus",
  titleEn: "Training",
  briefingFi: [
    "Rauhallinen aamupäivä. Metsäautotien eteläpuolella on palanut puolisen tuntia pieni pintapalo, tuuli on heikko lounaistuuli. Kaikki yksiköt ovat käytössäsi heti tai kymmenen minuutin sisällä.",
    "Harjoittele käskyt: suora hyökkäys reunaan, letkulinja tieltä, palokatko maastopaloyksiköllä, säiliöauton vesiajo, droonin tiedustelu ja helikopterin pudotukset. Näet kartalla vain sen, mitä yksiköt ovat nähneet.",
    "Tavoitteet: palo rajattu 90 minuutissa, paloala alle 10 ha, ei loukkaantuneita. Peli voitetaan, kun mikään ei enää pala eikä kyte: sammuta myös kytevä reuna.",
    "Voimajohto on jännitteinen ensimmäisen puolen tunnin ajan: vettä ei saa käyttää 30 m sisällä.",
  ].join("\n\n"),
  briefingEn: [
    "A quiet morning. A small surface fire has been burning south of the forest road for half an hour, and the wind is a light south-westerly. Every unit is yours now or within ten minutes.",
    "Practise the orders: direct attack on the edge, a hose line from the road, a fire break with the forest-fire unit, the tanker's water shuttle, drone reconnaissance and helicopter drops. The map shows only what your units have seen.",
    "Objectives: contain the fire within 90 minutes, keep it under 10 ha, no casualties. The game is won when nothing burns or smoulders any more: mop up the smouldering edge too.",
    "The power line is live for the first half hour: no water within 30 m of it.",
  ].join("\n\n"),
  startClockMin: START,
  endAtS: T("11:30"),
  difficulty: "easy",
  ignitions: [FIRE],
  weather: [
    wx(START, "10:00", 225, 3, 6, 20, 40),
    wx(START, "10:45", 230, 4.5, 7.5, 21, 38),
    wx(START, "11:30", 230, 3, 6, 22, 36),
  ],
  units: [
    { id: "EK11", kind: "engine", arriveAtS: 0 },
    { id: "VPK", kind: "volunteer", arriveAtS: 0 },
    { id: "EK12", kind: "engine", arriveAtS: 0 },
    { id: "EK13", kind: "tanker", arriveAtS: 0 },
    { id: "EK14", kind: "forest_unit", arriveAtS: 0 },
    { id: "DR1", kind: "drone_thermal", arriveAtS: 0 },
    { id: "DR3", kind: "drone_vtol", arriveAtS: 0 },
    { id: "VD1", kind: "drone_water", arriveAtS: 0 },
    { id: "UGV1", kind: "ugv", arriveAtS: 0 },
    { id: "HELI1", kind: "helicopter", arriveAtS: T("10:10"), entryNode: 1 },
  ],
  events: [
    {
      atS: 0, kind: "radio",
      message: radio(0, "P3", "command", "important",
        "P3: Harjoitus alkaa. Lähetä ensin DR1 tiedustelemaan paloa — kartalla näkyy vain se, mitä yksiköt näkevät.",
        "P3: The exercise begins. Send DR1 to scout the fire first — the map shows only what your units can see.",
        FIRE),
    },
    {
      atS: T("10:02"), kind: "radio",
      message: radio(T("10:02"), "P3", "command", "routine",
        "P3: Käske EK11 ja VPK suoraan hyökkäykseen reunaan. Miehistöt eivät hyökkää, jos teho ylittää rajansa.",
        "P3: Send EK11 and VPK to attack the edge directly. Crews will not attack an edge hotter than their limit."),
    },
    {
      atS: T("10:05"), kind: "radio",
      message: radio(T("10:05"), "P3", "command", "routine",
        "P3: Säiliöauto EK13 voi ajaa vettä hyökkäävälle yksikölle (vesiajo). Muuten tyhjä yksikkö lähtee itse täydentämään.",
        "P3: The tanker EK13 can shuttle water to an attacking unit. Otherwise an empty unit leaves the line to refill itself."),
    },
    {
      atS: T("10:10"), kind: "radio",
      message: radio(T("10:10"), "P3", "command", "routine",
        "P3: EK14 voi raivata palokatkon palon eteen ja vetää letkulinjan luonnonvedestä. HELI1 saapuu: anna sille pudotuskohde.",
        "P3: EK14 can cut a fire break ahead of the fire and lay a hose line from natural water. HELI1 is arriving: give it a drop target."),
    },
    {
      atS: T("10:15"), kind: "weather_warning",
      message: radio(T("10:15"), "SÄÄ", "support", "routine",
        "SÄÄ: Tuuli voimistuu hetkellisesti 4–5 m/s:iin, puuskat 7–8 m/s, klo 10.45 aikaan.",
        "WEATHER: The wind picks up briefly to 4–5 m/s, gusts 7–8 m/s, around 10:45."),
    },
    {
      atS: T("10:30"), kind: "power_line_dead",
      message: radio(T("10:30"), "P3", "command", "important",
        "P3: Verkkoyhtiö: voimajohto on nyt jännitteetön ja maadoitettu. Vettä saa käyttää johdon lähellä.",
        "P3: Grid operator: the power line is now de-energised and earthed. Water may be used near it."),
    },
  ],
  objectives: [
    { kind: "contain", byS: T("11:30") },
    { kind: "limit_area", maxHa: 10 },
    { kind: "no_casualties" },
  ],
  powerLineLiveAtStart: true,
  preBurnS: 40 * 60,
};
