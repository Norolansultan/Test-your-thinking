/**
 * Course exercise, module 5 (water): keep one attacking engine supplied. A 3 000 l tank lasts about ten minutes on two
 * lines; the tanker's shuttle from Haukilampi keeps the engine on the line. 09:00–09:30, west of the command post.
 */

import { neverRanDry, unitWorkedAtLeast } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRE = { x: 3450, y: 6150 };

export const WATER_EXERCISE = exercise({
  id: "course-water",
  topic: "water",
  // DRAFT fi
  titleFi: "Vesi riittää",
  titleEn: "Keep the water coming",
  // DRAFT fi
  promptFi: "Pelastusyksikkö EK21 lähtee hyökkäämään johtopaikan luoteispuolella palavaan pintapaloon. Sen 3 000 litran säiliö riittää kahdella letkulla noin kymmeneksi minuutiksi. Järjestä vesi niin, ettei EK21:n säiliö tyhjene ja se on työssä palolla vähintään 15 minuuttia puolen tunnin aikana. Käytössäsi on säiliöauto EK23.",
  promptEn: "The rescue engine EK21 goes in to attack a surface fire north-west of the command post. Its 3,000 l tank lasts about ten minutes on two lines. Organise the water so that EK21's tank never runs dry and it works on the fire for at least 15 minutes of the half hour. You have the water tanker EK23.",
  startClockMin: 9 * 60,
  horizonS: 30 * 60,
  ignitions: [FIRE],
  preBurnS: 40 * 60,
  weather: morningWeather(225, 4, 30 * 60, 18, 40),
  units: [
    { id: "EK21", kind: "engine", arriveAtS: 0 },
    { id: "EK23", kind: "tanker", arriveAtS: 0 },
  ],
  criteria: [neverRanDry("EK21"), unitWorkedAtLeast("EK21", 15)],
  reference: [
    ["EK21", { type: "attack", target: FIRE }],
    ["EK23", { type: "shuttle", waterPointId: "haukilampi", toUnitId: "EK21" }],
  ],
  // DRAFT fi
  explanationFi: "EK21 hyökkää ja säiliöauto EK23 ajaa vettä Haukilammelta EK21:lle (vesisukkula). Haukilampi on lähin vesipiste tietä pitkin; 14 m³:n säiliöauto täyttää EK21:n säiliön moneen kertaan.",
  explanationEn: "EK21 attacks and the tanker EK23 shuttles water from Haukilampi to EK21. Haukilampi is the nearest water point by road; the 14 m³ tanker refills EK21's tank many times over.",
  // DRAFT fi
  debriefFi: [
    "Laske vesi: 300 l/min kuluttaa 3 000 litran säiliön kymmenessä minuutissa.",
    "Ilman huoltoa tyhjä yksikkö lähtee itse täyttämään ja on poissa linjalta 10–15 minuuttia.",
    "Vesipisteen etäisyys mitataan tietä pitkin, ei linnuntietä.",
  ],
  debriefEn: [
    "Do the water sums: 300 l/min empties a 3,000 l tank in ten minutes.",
    "Without supply an empty unit leaves to refill itself and is off the line for 10–15 minutes.",
    "Measure the distance to water along the road, not as the crow flies.",
  ],
});
