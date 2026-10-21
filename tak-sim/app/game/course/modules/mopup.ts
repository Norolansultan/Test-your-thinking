/**
 * Course module 7 (SPEC/34 §3): mop-up and handover. Finnish texts DRAFT (native-speaker check), doctrine DRAFT
 * (domain reviewer).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { MOPUP_EXERCISE } from "../exercises/mopup.js";

export const MOPUP_MODULE: CourseModule = {
  id: "mopup",
  topic: "mopup",
  // DRAFT fi
  titleFi: "Jälkisammutus ja luovutus",
  titleEn: "Mop-up and handover",
  pages: [
    {
      // DRAFT fi
      headingFi: "Palo ei ole sammunut, kun liekit ovat poissa",
      headingEn: "The fire is not out when the flames are gone",
      // DRAFT fi
      bodyFi: "Turve, karike, kannot ja ojien kaivumaat voivat kyteä päiviä. Kun tuuli voimistuu ja aurinko kuivattaa, kytevä kohta leimahtaa ja palo lähtee uudelleen liikkeelle — usein reunalta, jota kukaan ei enää vartioi.\n\nPelissä kytevät solut näkyvät omalla värillään. Palo on sammunut vasta, kun mikään ei pala eikä kyte.",
      bodyEn: "Peat, duff, stumps and the spoil banks of ditches can smoulder for days. When the wind picks up and the sun dries them, a smouldering spot flares up and the fire runs again — often at an edge nobody is watching any more.\n\nIn the game, smouldering cells have their own colour. The fire is out only when nothing burns or smoulders.",
    },
    {
      // DRAFT fi
      headingFi: "Jälkisammutustyö",
      headingEn: "Mop-up work",
      // DRAFT fi
      bodyFi: "- Aloita reunoilta ja etene sisäänpäin: reunan kytevä kohta on lähimpänä palamatonta metsää.\n- Kytevä turve sammuu vasta läpimärkänä; varaa vettä enemmän kuin liekkien sammutukseen.\n- Maastopaloyksikkö ajaa maastossa ja ottaa vettä purosta tai lammesta.\n- Lämpökamerakopteri näyttää kuumat kohdat savun ja kasvillisuuden läpi.",
      bodyEn: "- Start at the edges and work inward: a smouldering spot at the edge is closest to the unburned forest.\n- Smouldering peat goes out only when soaked; set aside more water than for the flames.\n- The forest-fire unit drives across country and draws water from a brook or a pond.\n- The thermal drone shows the hot spots through smoke and vegetation.",
      view: { centre: { x: 2900, y: 5750 }, widthM: 1200 },
    },
    {
      // DRAFT fi
      headingFi: "Vartiointi ja luovutus",
      headingEn: "Patrol and handover",
      // DRAFT fi
      bodyFi: "Ennen kuin luovutat alueen vartioinnille, tarkasta reunat lämpökameralla ja kerro seuraavalle vuorolle, missä kyti viimeksi.\n\nKatso sääennuste: jos tuuli kääntyy, se työntää kytevää reunaa uuteen suuntaan. Vartioi sitä sivustaa, jota kohti tuulen ennustetaan kääntyvän.",
      bodyEn: "Before you hand the area over to patrol, check the edges with the thermal camera and tell the next shift where it last smouldered.\n\nRead the forecast: if the wind turns, it pushes the smouldering edge in a new direction. Patrol the flank toward which the wind is forecast to turn.",
    },
  ],
  exercise: MOPUP_EXERCISE,
  checks: [
    {
      id: "mopup-out",
      // DRAFT fi
      promptFi: "Milloin palo on sammunut?",
      promptEn: "When is the fire out?",
      options: [
        { textFi: "Kun liekkejä ei enää näy", textEn: "When no flames can be seen" },
        { textFi: "Kun mikään ei pala eikä kyte", textEn: "When nothing burns or smoulders" },
        { textFi: "Kun savu on vaalea", textEn: "When the smoke is pale" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Kytevä turve ja karike voivat syttyä uudelleen tunteja myöhemmin. Palo on sammunut vasta, kun kytevätkin kohdat on sammutettu.",
      explanationEn: "Smouldering peat and duff can rekindle hours later. The fire is out only when the smouldering spots are out too.",
    },
    {
      id: "mopup-thermal",
      // DRAFT fi
      promptFi: "Millä löydät kuumat kohdat parhaiten?",
      promptEn: "What finds the hot spots best?",
      options: [
        { textFi: "Lämpökamerakopterilla", textEn: "The thermal drone" },
        { textFi: "Säiliöautolla", textEn: "The water tanker" },
        { textFi: "Kartan polttoainetasolla", textEn: "The map's fuel layer" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Lämpökamera näkee kuumuuden savun läpi. Miehistö näkee vain sen, mikä savuaa näkyvästi lähellä.",
      explanationEn: "A thermal camera sees heat through smoke. A crew sees only what visibly smokes close by.",
    },
    {
      id: "mopup-patrol",
      // DRAFT fi
      promptFi: "Tuulen ennustetaan kääntyvän itään päin. Mitä sivustaa vartioit tarkimmin?",
      promptEn: "The wind is forecast to turn toward the east. Which flank do you patrol most closely?",
      options: [
        { textFi: "Länsisivustaa", textEn: "The west flank" },
        { textFi: "Itäsivustaa", textEn: "The east flank" },
        { textFi: "Kaikkia yhtä paljon", textEn: "All of them equally" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Kun tuuli puhaltaa itää kohti, se työntää kytevää itäreunaa palamattomaan metsään. Sinne vartiointi ja vesi.",
      explanationEn: "With the wind blowing toward the east, it pushes the smouldering east edge into the unburned forest. Put the patrol and the water there.",
    },
  ],
};
