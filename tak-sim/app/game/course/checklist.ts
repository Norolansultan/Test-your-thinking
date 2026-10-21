/**
 * Game mode, SPEC/34 §5: the commander's situation check card of the instructions panel ("Tarkistuslista /
 * Checklist"). Generic doctrine for any fire — never a hint for the current task. Finnish DRAFT (native-speaker
 * check), doctrine DRAFT (domain reviewer).
 */

export interface ChecklistItem {
  readonly id: string;
  readonly headingFi: string;
  readonly headingEn: string;
  /** The questions to ask, one per line. */
  readonly pointsFi: readonly string[];
  readonly pointsEn: readonly string[];
}

export const CHECKLIST: readonly ChecklistItem[] = [
  {
    id: "fire",
    // DRAFT fi
    headingFi: "Palo",
    headingEn: "Fire",
    pointsFi: ["Missä kärki on, kuinka nopeasti se etenee ja mitä kohti?", "Kuinka pitkät liekit kärjessä ja sivustoilla?", "Onko pesäkkeitä palon edellä (kipinälento)?"],
    pointsEn: ["Where is the head, how fast is it moving and toward what?", "How long are the flames at the head and on the flanks?", "Are there spot fires ahead of it?"],
  },
  {
    id: "weather",
    // DRAFT fi
    headingFi: "Sää",
    headingEn: "Weather",
    pointsFi: ["Tuuli nyt: suunta, nopeus, puuskat.", "Ennuste: kääntyykö tai voimistuuko tuuli, milloin?"],
    pointsEn: ["Wind now: direction, speed, gusts.", "Forecast: will the wind turn or strengthen, and when?"],
  },
  {
    id: "terrain",
    // DRAFT fi
    headingFi: "Maasto ja polttoaine",
    headingEn: "Terrain and fuel",
    pointsFi: ["Mitä palon edellä on: kangasta, kuusikkoa, turvetta, suota?", "Rinteet, ja esteet joihin palo voi pysähtyä: tiet, ojat, pellot, vesi."],
    pointsEn: ["What lies ahead of the fire: heath, spruce, peat, bog?", "Slopes, and barriers where it may stop: roads, ditches, fields, water."],
  },
  {
    id: "people",
    // DRAFT fi
    headingFi: "Ihmiset ja omaisuus",
    headingEn: "People and property",
    pointsFi: ["Ketä ja mitä on vaarassa: talot, mökit, tilat, tiet?", "Kuinka paljon aikaa on ennen kuin palo on siellä?"],
    pointsEn: ["Who and what is at risk: houses, cabins, farms, roads?", "How much time is there before the fire gets there?"],
  },
  {
    id: "resources",
    // DRAFT fi
    headingFi: "Voimavarat",
    headingEn: "Resources",
    pointsFi: ["Kuka on missä ja mitä tekee?", "Kuka on tulossa ja milloin? Riittääkö — pyydä lisää ajoissa."],
    pointsEn: ["Who is where, doing what?", "Who is coming and when? Is it enough — ask for more early."],
  },
  {
    id: "water",
    // DRAFT fi
    headingFi: "Vesi",
    headingEn: "Water",
    pointsFi: ["Kuinka paljon vettä yksiköillä on jäljellä ja kuinka kauan se riittää?", "Missä on lähin vesipiste tietä pitkin? Kuka huoltaa?"],
    pointsEn: ["How much water do the units have left, and for how long?", "Where is the nearest water point by road? Who keeps them supplied?"],
  },
  {
    id: "safety",
    // DRAFT fi
    headingFi: "Turvallisuus",
    headingEn: "Safety",
    pointsFi: ["LACES: tähystäjät, tilannetietoisuus, viestiyhteydet, pakoreitit, turvapaikat.", "Voimajohto: onko jännitteinen? Poiskytkentä pyydetty ja vahvistettu?", "Savu: kuka on tuulen alapuolella?"],
    pointsEn: ["LACES: lookouts, awareness, communications, escape routes, safety zones.", "Power line: is it live? De-energising requested and confirmed?", "Smoke: who is downwind?"],
  },
  {
    id: "picture",
    // DRAFT fi
    headingFi: "Tilannekuvan ikä",
    headingEn: "Age of the picture",
    pointsFi: ["Kuka näki tämän ja milloin?", "Mitä en ole nähnyt? Lähetä tiedustelu ennen tärkeää päätöstä."],
    pointsEn: ["Who saw this, and when?", "What have I not seen? Send reconnaissance before an important decision."],
  },
];
