/**
 * Course module 6 (SPEC/34 §3): crew safety — LACES, the crews' limits, the live 20 kV line (wooden poles, the local
 * distribution company's), smoke. Finnish texts DRAFT (native-speaker check), doctrine DRAFT (domain reviewer; the
 * 15 m distance is the game's PROVISIONAL `POWER_LINE_SAFE_M`).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { SAFETY_EXERCISE } from "../exercises/safety.js";

export const SAFETY_MODULE: CourseModule = {
  id: "safety",
  topic: "safety",
  // DRAFT fi
  titleFi: "Työturvallisuus",
  titleEn: "Crew safety",
  pages: [
    {
      // DRAFT fi
      headingFi: "LACES ennen kuin kukaan menee palolle",
      headingEn: "LACES before anyone goes in",
      // DRAFT fi
      bodyFi: "- L, tähystäjät: joku seuraa paloa ja miehistöjä koko ajan (pelissä esimerkiksi lämpökamerakopteri).\n- A, tilannetietoisuus: jokainen tietää, missä palo on ja mihin se on menossa.\n- C, viestiyhteydet: miehistöt ja johto kuulevat toisensa.\n- E, pakoreitit: vähintään kaksi, ja ne tunnetaan.\n- S, turvapaikat: palanut alue, pelto, vesi tai tie, jonne palo ei yllä.\n\nJos jokin puuttuu, miehistö ei mene palolle.",
      bodyEn: "- L, lookouts: someone watches the fire and the crews all the time (in the game, for example the thermal drone).\n- A, awareness: everyone knows where the fire is and where it is going.\n- C, communications: crews and command can hear each other.\n- E, escape routes: at least two, and known.\n- S, safety zones: burned ground, a field, water or a road the fire cannot reach.\n\nIf any is missing, the crew does not go in.",
    },
    {
      // DRAFT fi
      headingFi: "Miehistön rajat ja savu",
      headingEn: "The crews' limits and smoke",
      // DRAFT fi
      bodyFi: "Miehistöt eivät hyökkää reunaan, jonka teho ylittää niiden rajan (käsityövälinein ja kannettavin pumpuin noin 2 000 kW/m, letkuin noin 4 000 kW/m). Kuormituspalkki näyttää, kun miehistö on lähellä kuumuutta; liian lähellä se vetäytyy.\n\nSavu sisältää häkää. Tuulen alapuolella savussa työskentely vaatii paineilmalaitteet, joten työskentele tuulen yläpuolelta. Älä koskaan sijoita miehistöä kärjen eteen.",
      bodyEn: "Crews will not attack an edge hotter than their limit (with hand tools and portable pumps about 2,000 kW/m, with hose lines about 4,000 kW/m). The strain bar shows when a crew is close to the heat; too close, it pulls back.\n\nSmoke carries carbon monoxide. Working downwind in the smoke needs compressed-air breathing apparatus, so work from upwind. Never place a crew in front of the head.",
    },
    {
      // DRAFT fi
      headingFi: "Jännitteinen 20 kV johto",
      headingEn: "The live 20 kV line",
      // DRAFT fi
      bodyFi: "Alueen halki kulkee paikallisen verkkoyhtiön 20 kV voimajohto puupylväillä. Niin kauan kuin johto on jännitteinen, vettä ei käytetä 15 metriä lähempänä sitä: vesisuihku johtaa sähköä.\n- Pyydä johdon poiskytkentää heti, kun palo on lähellä johtoa.\n- Odota käyttökeskuksen vahvistus, että johto on jännitteetön ja maadoitettu.\n- Sillä välin työskentele johdosta poispäin. Palavat puupylväät voivat kaatua ja pudottaa johtimet maahan.",
      bodyEn: "A 20 kV power line on wooden poles, the local distribution company's, crosses the area. While the line is live, no water is used within 15 metres of it: a water jet conducts electricity.\n- Ask for the line to be de-energised as soon as the fire is near it.\n- Wait for the control centre's confirmation that it is de-energised and earthed.\n- Meanwhile work away from the line. Burning wooden poles can fall and bring the conductors down.",
      view: { centre: { x: 3300, y: 1900 }, widthM: 1400 },
    },
  ],
  exercise: SAFETY_EXERCISE,
  checks: [
    {
      id: "safety-laces",
      // DRAFT fi
      promptFi: "Mitä L tarkoittaa LACES-muistisäännössä?",
      promptEn: "What does the L in LACES stand for?",
      options: [
        { textFi: "Letkulinjat", textEn: "Lines (hose lines)" },
        { textFi: "Tähystäjät (lookouts)", textEn: "Lookouts" },
        { textFi: "Liekkien pituus", textEn: "Length of flames" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "L = lookouts, tähystäjät. Tähystäjä näkee palon ja miehistöt ja varoittaa ajoissa, kun palo muuttuu.",
      explanationEn: "L = lookouts. A lookout sees the fire and the crews and warns in time when the fire changes.",
    },
    {
      id: "safety-line",
      // DRAFT fi
      promptFi: "Palo on 50 metrin päässä jännitteisestä 20 kV johdosta. Mitä teet?",
      promptEn: "The fire is 50 m from the live 20 kV line. What do you do?",
      options: [
        { textFi: "Sammutan johdon alta vedellä heti", textEn: "Put water under the line at once" },
        { textFi: "Pyydän poiskytkentää ja työskentelen johdosta poispäin, kunnes se on vahvistettu", textEn: "Ask for de-energising and work away from the line until it is confirmed" },
        { textFi: "Vedän kaikki yksiköt pois palolta", textEn: "Pull every unit off the fire" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Vettä ei käytetä 15 m sisällä jännitteisestä johdosta. Muun palon voi sammuttaa sillä aikaa, kun verkkoyhtiö kytkee johdon pois.",
      explanationEn: "No water within 15 m of a live line. The rest of the fire can be fought while the distribution company switches the line off.",
    },
    {
      id: "safety-smoke",
      // DRAFT fi
      promptFi: "Mistä suunnasta miehistö mieluiten työskentelee?",
      promptEn: "From which side should crews preferably work?",
      options: [
        { textFi: "Tuulen yläpuolelta", textEn: "From upwind" },
        { textFi: "Tuulen alapuolelta savun keskeltä", textEn: "From downwind, in the smoke" },
        { textFi: "Kärjen edestä", textEn: "From in front of the head" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Tuulen yläpuolella ei ole savua eikä häkää, ja palo etenee poispäin miehistöstä.",
      explanationEn: "Upwind there is no smoke or carbon monoxide, and the fire moves away from the crew.",
    },
  ],
};
