/**
 * Game mode: what units, P3, the emergency centre and the weather service say, in Finnish and
 * English. Generated from what the speaker can observe, never from the future (SPEC/18 (n)).
 * Every text is synthetic content pending domain review, like the scenario's corpus.
 */

import { compassEn, compassFromFi, compassToFi, groupThousands, roughNumber } from "./geom.js";
import type { Text } from "./radio.js";

const n = (v: number, lang: "fi" | "en"): string => roughNumber(v, lang);
const litres = (l: number, lang: "fi" | "en"): string => groupThousands(Math.round(l / 100) * 100, lang);

export const T = {
  arrived: (): Text => ({ fi: "saapunut alueelle, valmiina tehtävään.", en: "on scene, ready for tasking." }),

  /** "kärki etenee koilliseen noin 6 m/min, liekit 2 m" — the head or a flank as the crew sees it. */
  edge: (head: boolean, dirDeg: number, rosMpm: number, flameM: number): Text => {
    const slow = rosMpm < 2;
    if (head) {
      return {
        fi: `kärki etenee ${compassToFi(dirDeg)} noin ${n(rosMpm, "fi")} m/min, liekit ${n(flameM, "fi")} m.`,
        en: `head running ${compassEn(dirDeg)} at about ${n(rosMpm, "en")} m/min, flames ${n(flameM, "en")} m.`,
      };
    }
    return {
      fi: `reuna ${slow ? "etenee hitaasti" : "etenee"} ${compassToFi(dirDeg)} noin ${n(rosMpm, "fi")} m/min, liekit ${n(flameM, "fi")} m.`,
      en: `flank ${slow ? "creeping" : "moving"} ${compassEn(dirDeg)} at about ${n(rosMpm, "en")} m/min, flames ${n(flameM, "en")} m.`,
    };
  },
  attacking: (waterL: number, unlimited: boolean): Text => unlimited
    ? { fi: " Suora hyökkäys käynnissä, vesi luonnonvesipisteestä.", en: " Direct attack under way, water from natural water." }
    : { fi: ` Suora hyökkäys käynnissä, vettä noin ${litres(waterL, "fi")} l.`, en: ` Direct attack under way, about ${litres(waterL, "en")} l of water left.` },
  hoseHolding: (m: number): Text => ({ fi: ` Letkulinja ${groupThousands(m, "fi")} m pitää.`, en: ` Hose line of ${groupThousands(m, "en")} m holding.` }),
  breakProgress: (done: number, total: number): Text => ({
    fi: ` Palokatkoa valmiina ${groupThousands(done, "fi")}/${groupThousands(total, "fi")} m.`,
    en: ` Fire break ${groupThousands(done, "en")} of ${groupThousands(total, "en")} m cut.`,
  }),
  protecting: (): Text => ({ fi: " Suojaamme rakennuksia, sadettimet päällä.", en: " Protecting the buildings, sprinklers on." }),
  noFireSeen: (): Text => ({ fi: "ei liekehtivää paloa näkyvissä, valvomme.", en: "no open flame in sight, watching." }),

  airSitrep: (sensor: "thermal" | "eyes", ha: number, dirDeg: number | null, rosMpm: number): Text => {
    const what = sensor === "thermal" ? { fi: "lämpökamera: ", en: "thermal: " } : { fi: "", en: "" };
    if (ha <= 0) return { fi: `${what.fi}ei paloa näkyvissä.`, en: `${what.en}no fire in view.` };
    const head = dirDeg === null ? { fi: "", en: "" } : {
      fi: `, kärki etenee ${compassToFi(dirDeg)} noin ${n(rosMpm, "fi")} m/min`,
      en: `, head running ${compassEn(dirDeg)} at about ${n(rosMpm, "en")} m/min`,
    };
    return {
      fi: `${what.fi}palanutta ja palavaa alaa näkyvissä noin ${n(ha, "fi")} ha${head.fi}.`,
      en: `${what.en}about ${n(ha, "en")} ha burned and burning in view${head.en}.`,
    };
  },
  spotFire: (distM: number, dirDeg: number): Text => ({
    fi: `pistepalo noin ${groupThousands(Math.round(distM / 10) * 10, "fi")} m pääpalosta ${compassToFi(dirDeg)}!`,
    en: `spot fire about ${groupThousands(Math.round(distM / 10) * 10, "en")} m ${compassEn(dirDeg)} of the main fire!`,
  }),

  tankEmptyWaiting: (): Text => ({ fi: "vesi loppu. Odotamme vesiajoa.", en: "tank empty. Waiting for the water shuttle." }),
  tankEmptyRefill: (wpFi: string, wpEn: string, awayMin: number): Text => ({
    fi: `vesi loppu, lähdemme täydentämään: ${wpFi}. Poissa linjalta noin ${Math.max(5, Math.round(awayMin / 5) * 5)} min.`,
    en: `tank empty, going to refill at ${wpEn}. Off the line for about ${Math.max(5, Math.round(awayMin / 5) * 5)} min.`,
  }),
  filling: (wpFi: string, wpEn: string): Text => ({ fi: `täyttää säiliötä: ${wpFi}.`, en: `filling the tank at ${wpEn}.` }),
  tankFull: (back: boolean): Text => back
    ? { fi: "säiliö täynnä, palaamme tehtävään.", en: "tank full, returning to the task." }
    : { fi: "säiliö täynnä, valmiina.", en: "tank full, ready." },

  tooHot: (flameM: number): Text => ({
    fi: `liian kuuma suoraan hyökkäykseen, liekit noin ${n(flameM, "fi")} m. Vetäydymme turvaan ja odotamme.`,
    en: `too hot for direct attack, flames about ${n(flameM, "en")} m. Pulling back to safety and waiting.`,
  }),
  retreat: (): Text => ({ fi: "palo tulee päälle, vetäydymme turva-alueelle!", en: "the fire is on us, pulling back to a safety zone!" }),
  heatDanger: (): Text => ({ fi: "kuumuus sietämätön, miehistö vaarassa! Tarvitsemme pakotien!", en: "the heat is unbearable, crew in danger! We need an escape route!" }),
  mayday: (id: string): Text => ({
    fi: `MAYDAY MAYDAY MAYDAY, ${id}: miehistössä loukkaantuneita, palo saartanut. Tarvitsemme ensihoidon!`,
    en: `MAYDAY MAYDAY MAYDAY, ${id}: crew injured, the fire has cut us off. We need EMS!`,
  }),
  powerLineNoWater: (): Text => ({ fi: "20 kV voimajohto on jännitteinen, emme käytä vettä johdon lähellä.", en: "the 20 kV power line is live, we use no water near it." }),
  longShift: (h: number): Text => ({ fi: `miehistö ollut kentällä ${h} tuntia, vaihto tarpeen.`, en: `crew on the line for ${h} hours, relief needed.` }),

  hoseReady: (m: number, natural: boolean): Text => ({
    fi: `letkulinja valmis, ${groupThousands(m, "fi")} m. ${natural ? "Vesi luonnonvesipisteestä." : "Vesi kytketään, kun palo on noin 100 m päässä."}`,
    en: `hose line ready, ${groupThousands(m, "en")} m. ${natural ? "Fed from natural water." : "Water goes on when the fire is about 100 m away."}`,
  }),
  hoseDry: (): Text => ({ fi: "letku vedetty, mutta siinä ei ole vettä: tarvitaan syöttävä yksikkö tai vesipiste.", en: "hose laid, but there is no water in it: it needs a feeding unit or a water point." }),
  breakDone: (m: number): Text => ({ fi: `palokatko valmis, ${groupThousands(m, "fi")} m.`, en: `fire break finished, ${groupThousands(m, "en")} m.` }),
  knockedDown: (): Text => ({ fi: "reuna sammutettu tältä osin, jäämme valvomaan.", en: "edge knocked down here, staying to watch it." }),

  drop: (l: number): Text => ({
    fi: `pudotus tehty, ${groupThousands(l, "fi")} l. Pudotusalue ilmoitettu yksiköille, miehet pois alta (kuitattu).`,
    en: `drop made, ${groupThousands(l, "en")} l. Drop zone announced to the units, men clear of it (acknowledged).`,
  }),
  gustHold: (): Text => ({
    fi: "puuskat yli rajan, pudotukset tauolla. Jatkaa, kun puuskat eivät enää ylitä rajaa.",
    en: "gusts over the limit, drops paused. Resuming when the gusts no longer exceed the limit.",
  }),
  lowEnergy: (pct: number, fuel: boolean): Text => fuel
    ? { fi: "polttoaine vähissä, lähdemme tankkaamaan.", en: "fuel low, leaving to refuel." }
    : { fi: `akku ${Math.round(pct)} %, palaan johtopaikalle vaihtamaan akun.`, en: `battery at ${Math.round(pct)} %, returning to the command post for a battery swap.` },
  forcedLanding: (): Text => ({ fi: "akku loppu, pakkolasku!", en: "battery dead, forced landing!" }),

  shuttleFilling: (wpFi: string, wpEn: string): Text => ({ fi: `vesiajo: täytän, ${wpFi}.`, en: `water shuttle: filling at ${wpEn}.` }),
  shuttleDelivering: (m3: number, to: string): Text => ({
    fi: `vettä kyydissä noin ${roughNumber(m3, "fi")} m³, matkalla ${to}:lle.`,
    en: `about ${roughNumber(m3, "en")} m³ of water aboard, on the way to ${to}.`,
  }),
  shuttleStopped: (to: string): Text => ({ fi: `${to} ei ole enää linjalla, vesiajo keskeytetty.`, en: `${to} is off the line, water shuttle stopped.` }),
  protectStart: (placeFi: string, placeEn: string): Text => ({
    fi: `suojaamme kohdetta ${placeFi}, sadetinlinjat valmiina.`,
    en: `protecting ${placeEn}, sprinkler lines ready.`,
  }),

  buildingOnFire: (placeFi: string, placeEn: string, assetId: string): Text => ({
    fi: `rakennus syttynyt — ${placeFi} (${assetId}).`,
    en: `a building is on fire — ${placeEn} (${assetId}).`,
  }),
  settlementLost: (placeFi: string, placeEn: string): Text => ({
    fi: `${placeFi} menetetty: yli puolet rakennuksista palanut.`,
    en: `${placeEn} is lost: more than half of its buildings have burned.`,
  }),
  contained: (clock: string): Text => ({
    fi: `ei liekehtivää rintamaa klo ${clock}. Palo on rajattu; jälkisammutus ja valvonta jatkuvat.`,
    en: `no flaming front at ${clock}. The fire is contained; mop-up and patrol continue.`,
  }),
  won: (): Text => ({
    fi: "palo hallinnassa ja tavoitteet täyttyivät. Hyvää työtä — johtovastuu siirtyy yön organisaatiolle.",
    en: "the fire is under control and the objectives are met. Well done — command passes to the night organisation.",
  }),
  lost: (whyFi: string, whyEn: string): Text => ({ fi: `tavoite menetetty: ${whyFi}. Peli päättyy.`, en: `objective lost: ${whyEn}. The game ends.` }),
  ended: (clock: string): Text => ({
    fi: `vuoronvaihto klo ${clock}. Kaikki tavoitteet eivät täyttyneet; yön organisaatio jatkaa.`,
    en: `shift change at ${clock}. Not every objective was met; the night organisation takes over.`,
  }),

  weatherWarning: (fromDeg: number, ms: number, gust: number, clock: string): Text => ({
    fi: `varoitus: tuuli ${compassFromFi(fromDeg)} voimistuu noin ${n(ms, "fi")} m/s, puuskat ${n(gust, "fi")} m/s, klo ${clock} mennessä.`,
    en: `warning: wind from the ${compassEn(fromDeg)} strengthening to about ${n(ms, "en")} m/s, gusts ${n(gust, "en")} m/s, by ${clock}.`,
  }),
  powerLineDead: (): Text => ({
    fi: "verkkoyhtiön käyttökeskus vahvistaa: pyydetty poiskytkentä on tehty, 20 kV voimajohto on jännitteetön ja maadoitettu. Vettä saa käyttää johdon lähellä.",
    en: "the distribution company's control centre confirms: the requested switch-off is done, the 20 kV line is de-energised and earthed. Water may be used near the line.",
  }),
  recalled: (ids: readonly string[]): Text => ({
    fi: `alue irrottaa yksiköt ${ids.join(", ")} toiselle palolle. Vapauttakaa ne heti.`,
    en: `the region is releasing ${ids.join(", ")} to another fire. Release them now.`,
  }),
  leaving: (): Text => ({ fi: "irrotettu, lähdemme toiselle palolle.", en: "released, leaving for the other fire." }),
  reportedFire: (clock: string): Text => ({
    fi: `uusi ilmoitus maastopalosta klo ${clock}; sijainti merkitty karttaan.`,
    en: `a new wildfire reported at ${clock}; position marked on the map.`,
  }),
};
