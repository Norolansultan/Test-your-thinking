/**
 * Course exercise, module 6 (safety): LACES and the live 20 kV line. A small fire 150 m west of the 20 kV distribution
 * line (wooden poles, the local distribution company's). P3 has asked for the line to be de-energised; the company's
 * control centre confirms it after 20 minutes. Keep a lookout over the fire, keep the crews safe, use no water near
 * the live line and keep the fire small. 08:00–08:30 (well before the study's F7 window), south of the study's area.
 */

import { radio } from "../../scenarios/places.js";
import { burnedAtMost, crewsSafe, noWaterNearLiveLine, unitWorkedAtLeast } from "../criteria.js";
import { exercise, morningWeather } from "./common.js";

const FIRE = { x: 3200, y: 1900 };
const LINE_DEAD_S = 20 * 60;

export const SAFETY_EXERCISE = exercise({
  id: "course-safety",
  topic: "safety",
  // DRAFT fi
  titleFi: "Tähystäjä ja voimajohto",
  titleEn: "Lookout and the power line",
  // DRAFT fi
  promptFi: "Turvemaalla palaa pieni palo noin 150 m 20 kV voimajohdon länsipuolella. P3 on pyytänyt verkkoyhtiötä tekemään johdon jännitteettömäksi; käyttökeskus arvioi sen vievän 20 minuuttia. Ennen kuin miehistöt menevät palolle, aseta tähystäjä: lämpökamerakopteri DR6 palon ylle vähintään 20 minuutiksi. Pidä miehistöt turvassa, älä käytä vettä 15 m sisällä jännitteisestä johdosta ja pidä paloala enintään 0,6 ha:ssa 30 minuutin ajan.",
  promptEn: "A small fire is burning on peat about 150 m west of the 20 kV power line. P3 has asked the distribution company to de-energise the line; their control centre estimates 20 minutes. Before the crews go in, post a lookout: the thermal drone DR6 over the fire for at least 20 minutes. Keep the crews safe, use no water within 15 m of the live line and keep the burned area at most 0.6 ha for 30 minutes.",
  startClockMin: 8 * 60,
  horizonS: 30 * 60,
  ignitions: [FIRE],
  preBurnS: 30 * 60,
  weather: morningWeather(270, 4, 30 * 60, 20, 35),
  units: [
    { id: "EK61", kind: "engine", arriveAtS: 0 },
    { id: "EK64", kind: "forest_unit", arriveAtS: 0 },
    { id: "DR6", kind: "drone_thermal", arriveAtS: 0 },
  ],
  events: [
    {
      atS: LINE_DEAD_S, kind: "power_line_dead",
      // DRAFT fi
      message: radio(LINE_DEAD_S, "P3", "command", "important",
        "P3: Verkkoyhtiön käyttökeskus: pyytämämme poiskytkentä on tehty, 20 kV johto on jännitteetön ja maadoitettu. Vettä saa käyttää johdon lähellä.",
        "P3: The distribution company's control centre: the switch-off we requested is done, the 20 kV line is de-energised and earthed. Water may be used near it."),
    },
  ],
  criteria: [
    // DRAFT fi
    { ...unitWorkedAtLeast("DR6", 20), labelFi: "Tähystäjä (DR6) palon yllä vähintään 20 min", labelEn: "A lookout (DR6) over the fire for at least 20 min" },
    crewsSafe(),
    noWaterNearLiveLine(),
    burnedAtMost(0.6),
  ],
  reference: [
    ["DR6", { type: "recon", centre: FIRE }],
    ["EK61", { type: "attack", target: { x: 3150, y: 1900 } }],
    ["EK64", { type: "attack", target: { x: 3200, y: 1840 } }],
  ],
  // DRAFT fi
  explanationFi: "DR6 lähtee ensin palon ylle tähystäjäksi. EK61 ja EK64 hyökkäävät palon tuulen puoleisesta päästä (lännestä), poispäin johdosta: ne työskentelevät palaneen alueen reunalla, ja turvallinen paluureitti on tielle. Johdon lähellä oleva osa odottaa, kunnes käyttökeskus vahvistaa johdon jännitteettömäksi.",
  explanationEn: "DR6 goes first, over the fire as the lookout. EK61 and EK64 attack from the fire's upwind end (the west), away from the line: they work at the edge of the burned ground, with a safe way back to the road. The part near the line waits until the control centre confirms the line is de-energised.",
  // DRAFT fi
  debriefFi: [
    "LACES: tähystäjä, tilannetietoisuus, viestiyhteydet, pakoreitit ja turvapaikat ennen kuin miehistö menee palolle.",
    "Jännitteiseen johtoon ei suihkuteta vettä: pyydä poiskytkentä verkkoyhtiöltä heti ja odota vahvistus.",
    "Savun alapuolella on häkävaara; työskentele tuulen yläpuolelta aina kun voit.",
  ],
  debriefEn: [
    "LACES: lookouts, awareness, communications, escape routes and safety zones before a crew goes to the fire.",
    "No water on a live line: ask the distribution company to de-energise it at once, and wait for the confirmation.",
    "Downwind in the smoke there is a carbon-monoxide hazard; work from upwind whenever you can.",
  ],
});
