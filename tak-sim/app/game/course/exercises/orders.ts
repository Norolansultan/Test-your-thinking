/**
 * Course exercise, module 4 (orders): anchor at the road and work the flanks. A half-hour-old fire 200 m west of the
 * gravel road, an easterly of 4 m/s driving the head away from the road. Two engines and a forest-fire unit;
 * contained (no flames) within 40 minutes and at most 1.5 ha. 09:30–10:10, south-west of the command post.
 */

import { burnedAtMost, noFlamesAtEnd } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRE = { x: 3000, y: 3150 };

export const ORDERS_EXERCISE = exercise({
  id: "course-orders",
  topic: "orders",
  // DRAFT fi
  titleFi: "Ankkuri ja sivustat",
  titleEn: "Anchor and flanks",
  // DRAFT fi
  promptFi: "Soratien länsipuolella palaa puolen tunnin ikäinen pintapalo. Itätuuli 4 m/s työntää kärkeä länteen, poispäin tiestä. Käytössäsi on kaksi pelastusyksikköä ja maastopaloyksikkö. Aloita tieltä, etene sivustoja pitkin ja rajaa palo: ei liekkejä 40 minuutin kuluttua, paloala enintään 1,5 ha.",
  promptEn: "A half-hour-old surface fire is burning west of the gravel road. An easterly of 4 m/s pushes the head west, away from the road. You have two rescue engines and a forest-fire unit. Start from the road, work along the flanks and contain the fire: no flames after 40 minutes, at most 1.5 ha burned.",
  startClockMin: 9 * 60 + 30,
  horizonS: 40 * 60,
  ignitions: [FIRE],
  preBurnS: 30 * 60,
  weather: morningWeather(90, 4, 40 * 60, 21, 33),
  units: [
    { id: "EK31", kind: "engine", arriveAtS: 0 },
    { id: "EK32", kind: "engine", arriveAtS: 0 },
    { id: "EK34", kind: "forest_unit", arriveAtS: 0 },
  ],
  criteria: [noFlamesAtEnd(), burnedAtMost(1.5)],
  reference: [
    ["EK31", { type: "attack", target: { x: 2900, y: 3200 } }],
    ["EK32", { type: "attack", target: { x: 2900, y: 3100 } }],
    ["EK34", { type: "attack", target: { x: 2700, y: 3150 } }],
  ],
  // DRAFT fi
  explanationFi: "Tie on ankkuri: palo ei pääse kiertämään sen taakse. EK31 ottaa pohjoissivustan ja EK32 eteläsivustan tieltä alkaen; maastopaloyksikkö ajaa maastossa kärjen eteen, koska se kulkee ilman tietä ja täyttää säiliönsä purosta.",
  explanationEn: "The road is the anchor: the fire cannot get round behind it. EK31 takes the north flank and EK32 the south flank from the road; the forest-fire unit drives through the forest to the head, since it needs no road and refills from the brook.",
  // DRAFT fi
  debriefFi: [
    "Jokainen linja alkaa ankkurista: tiestä, ojasta, vedestä tai jo palaneesta alueesta.",
    "Sivustoilta edetään kohti kärkeä (pihtiliike); kärkeen hyökätään suoraan vain, kun liekit ovat matalia.",
    "Anna jokaiselle yksikölle oma tehtävä ja paikka; samaan pisteeseen lähetetyt yksiköt tekevät samaa työtä.",
  ],
  debriefEn: [
    "Every line starts from an anchor: a road, a ditch, water or ground that has already burned.",
    "Work from the flanks toward the head (a pincer); attack the head directly only when the flames are low.",
    "Give each unit its own task and place; units sent to the same point do the same work.",
  ],
});
