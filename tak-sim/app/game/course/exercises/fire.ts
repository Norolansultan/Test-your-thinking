/**
 * Course exercise, module 2 (fire): read where the wind drives the head and stop it before it reaches the gravel road
 * by the command post. A ten-minute-old fire in pine heath, a south-westerly of 5 m/s. 10:00–10:30, south-west of the
 * command post.
 */

import { burnedAtMost, noFireWithin } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRE = { x: 3800, y: 5250 };
/** Ground by the gravel road, about 180 m downwind (north-east) of the ignition. */
const ROADSIDE = { x: 3930, y: 5380 };

export const FIRE_EXERCISE = exercise({
  id: "course-fire",
  topic: "fire",
  // DRAFT fi
  titleFi: "Missä on kärki?",
  titleEn: "Where is the head?",
  // DRAFT fi
  promptFi: "Kangasmetsässä johtopaikan lounaispuolella palaa nuori pintapalo. Tuuli on lounaasta 5 m/s. Päättele, mihin suuntaan palon kärki etenee, ja pysäytä se ennen kuin se ehtii soratien varteen. Käytössäsi on kaksi pelastusyksikköä. Aikaa 30 minuuttia; paloala enintään 1 ha.",
  promptEn: "A young surface fire is burning in heath forest south-west of the command post. The wind is from the south-west at 5 m/s. Work out which way the head runs and stop it before it reaches the gravel road. You have two rescue engines. 30 minutes; at most 1 ha burned.",
  startClockMin: 10 * 60,
  horizonS: 30 * 60,
  ignitions: [FIRE],
  preBurnS: 10 * 60,
  weather: morningWeather(225, 5, 30 * 60, 21, 33),
  units: [
    { id: "EK71", kind: "engine", arriveAtS: 0 },
    { id: "EK72", kind: "engine", arriveAtS: 0 },
  ],
  criteria: [
    // DRAFT fi
    noFireWithin("roadside", ROADSIDE, 60, "Kärki ei päässyt soratien varteen", "The head did not reach the gravel road"),
    burnedAtMost(1),
  ],
  reference: [
    ["EK71", { type: "attack", target: { x: 3880, y: 5330 } }],
    ["EK72", { type: "attack", target: { x: 3840, y: 5330 } }],
  ],
  // DRAFT fi
  explanationFi: "Lounaistuuli työntää kärkeä koilliseen, kohti tietä. Molemmat yksiköt hyökkäävät heti kärjen puoleiseen päähän, kun palo on vielä pieni ja liekit matalat; sivustat ja perä ehtivät myöhemmin.",
  explanationEn: "A south-westerly pushes the head north-east, toward the road. Both engines attack the head end at once, while the fire is still small and the flames low; the flanks and the heel can wait.",
  // DRAFT fi
  debriefFi: [
    "Tuuli ja rinne työntävät kärkeä: kärki on palon tuulen alapuolinen pää.",
    "Pieneen paloon voi hyökätä kärjestä; kun liekit kasvavat yli 2–3 metrin, kärkeen ei mennä miehistöllä.",
    "Perä ja sivustat etenevät hitaasti; ne ovat turvallisin paikka aloittaa isommassa palossa.",
  ],
  debriefEn: [
    "Wind and slope push the head: the head is the fire's downwind end.",
    "A small fire can be attacked at the head; once flames are over 2–3 m, crews do not go to the head.",
    "The heel and the flanks spread slowly; in a bigger fire they are the safest place to start.",
  ],
});
