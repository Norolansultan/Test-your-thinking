/**
 * Course module 2 (SPEC/34 §3): fire behaviour cues. Finnish texts DRAFT (native-speaker check), doctrine DRAFT
 * (domain reviewer).
 */

import type { CourseModule } from "../../tasks/contracts.js";
import { FIRE_EXERCISE } from "../exercises/fire.js";

export const FIRE_MODULE: CourseModule = {
  id: "fire",
  topic: "fire",
  // DRAFT fi
  titleFi: "Palon käyttäytyminen",
  titleEn: "How the fire behaves",
  pages: [
    {
      // DRAFT fi
      headingFi: "Kärki, sivustat ja perä",
      headingEn: "Head, flanks and heel",
      // DRAFT fi
      bodyFi: "Tuuli ja rinne työntävät paloa: palon nopein osa, kärki, on tuulen alapuolella. Sivustat etenevät sivulle hitaammin, ja perä (tuulen yläpuolinen pää) tuskin liikkuu.\n- Tuuli lounaasta → kärki etenee koilliseen.\n- Tuulen kääntyessä entinen sivusta voi muuttua kärjeksi.\n\nKärki on vaarallisin paikka: liekit ovat siellä pisimmät ja palo tulee kohti.",
      bodyEn: "Wind and slope push the fire: its fastest part, the head, is downwind. The flanks spread sideways more slowly, and the heel (the upwind end) hardly moves.\n- Wind from the south-west → the head runs north-east.\n- When the wind turns, a former flank can become a head.\n\nThe head is the most dangerous place: the flames are longest there and the fire comes toward you.",
      view: { centre: { x: 3800, y: 5300 }, widthM: 1600 },
    },
    {
      // DRAFT fi
      headingFi: "Polttoaine",
      headingEn: "Fuel",
      // DRAFT fi
      bodyFi: "Metsätyyppi ratkaisee palon nopeuden:\n- Kuivat kangasmänniköt: nopea pintapalo.\n- Varttunut, harventamaton kuusikko: matalat oksat vievät palon latvoihin (latvapalo).\n- Koivikot ja haavikot hidastavat paloa.\n- Ojitettu turvemaa: hidas eteneminen, pitkä kyteminen.\n\nLiekin pituus kertoo tehon: alle 1,2 m liekkeihin voi hyökätä käsityövälinein, 1,2–2,4 m liekkeihin letkuin; yli 2,4 m liekkejä ei pysäytetä suoralla hyökkäyksellä.",
      bodyEn: "The forest type decides the fire's speed:\n- Dry pine heath: a fast surface fire.\n- Mature, unthinned spruce: low branches carry the fire into the crowns (a crown fire).\n- Birch and aspen slow the fire.\n- Drained peat: slow spread, long smouldering.\n\nFlame length tells the intensity: flames under 1.2 m can be attacked with hand tools, 1.2–2.4 m with hose lines; flames over 2.4 m are not stopped by direct attack.",
    },
    {
      // DRAFT fi
      headingFi: "Kipinälento ja uudelleensyttyminen",
      headingEn: "Spotting and rekindling",
      // DRAFT fi
      bodyFi: "Kipinät ja kekäleet lentävät kärjen edelle ja sytyttävät uusia pesäkkeitä: tavallisesti kymmeniä metrejä, voimakkaassa palossa satoja metrejä. Tie tai oja ei siksi aina pysäytä paloa.\n\nKytevä turve, kannot ja karike voivat leimahtaa uudelleen, kun tuuli voimistuu ja aurinko kuivattaa. Mallin ennuste (+20 / +40 min) ei tiedä, mitkä kipinät syttyvät.",
      bodyEn: "Sparks and embers fly ahead of the head and light new spot fires: usually tens of metres, in an intense fire hundreds. A road or a ditch therefore does not always stop a fire.\n\nSmouldering peat, stumps and duff can flare up again when the wind picks up and the sun dries them. The model's forecast (+20 / +40 min) cannot know which embers will take.",
    },
  ],
  exercise: FIRE_EXERCISE,
  checks: [
    {
      id: "fire-head",
      // DRAFT fi
      promptFi: "Tuuli puhaltaa lounaasta. Missä palon kärki on?",
      promptEn: "The wind blows from the south-west. Where is the fire's head?",
      options: [
        { textFi: "Lounaispäässä", textEn: "At the south-west end" },
        { textFi: "Koillispäässä", textEn: "At the north-east end" },
        { textFi: "Luoteissivustalla", textEn: "On the north-west flank" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Tuulen suunta kerrotaan sen mukaan, mistä tuuli tulee. Lounaistuuli työntää paloa koilliseen, joten kärki on koillispäässä ja perä lounaispäässä.",
      explanationEn: "A wind is named for where it comes from. A south-westerly pushes the fire north-east, so the head is the north-east end and the heel the south-west end.",
    },
    {
      id: "fire-flames",
      // DRAFT fi
      promptFi: "Kärjessä liekit ovat noin 3 metriä. Mitä teet?",
      promptEn: "At the head the flames are about 3 m. What do you do?",
      options: [
        { textFi: "Lähetän kaikki miehistöt suoraan kärkeen", textEn: "Send every crew straight to the head" },
        { textFi: "Aloitan perästä ja sivustoilta ja pysäytän kärjen esteeseen tai ilmasta", textEn: "Start from the heel and flanks and stop the head at a barrier or from the air" },
        { textFi: "Odotan, että palo sammuu itsestään", textEn: "Wait for the fire to go out by itself" },
      ],
      correct: 1,
      // DRAFT fi
      explanationFi: "Yli 2,4 m liekkeihin ei hyökätä suoraan. Miehistöt kavennetaan paloa sivustoilta, ja kärki pysäytetään esteeseen, palokatkoon tai helikopterin pudotuksilla.",
      explanationEn: "Flames over 2.4 m are not attacked directly. Crews narrow the fire from the flanks, and the head is stopped at a barrier, a fire break or with helicopter drops.",
    },
    {
      id: "fire-crown",
      // DRAFT fi
      promptFi: "Missä metsätyypissä latvapalon vaara on suurin?",
      promptEn: "In which forest type is the risk of a crown fire highest?",
      options: [
        { textFi: "Varttuneessa, harventamattomassa kuusikossa", textEn: "Mature, unthinned spruce" },
        { textFi: "Koivikossa", textEn: "Birch forest" },
        { textFi: "Pellolla", textEn: "A field" },
      ],
      correct: 0,
      // DRAFT fi
      explanationFi: "Kuusen matalat oksat ja tiheä latvus muodostavat portaat, joita pitkin pintapalo nousee latvoihin.",
      explanationEn: "Spruce's low branches and dense canopy form a ladder that carries a surface fire up into the crowns.",
    },
  ],
};
