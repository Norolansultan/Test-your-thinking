/**
 * The mop-up patrol on the old fire's east and south-east edge (review fixes (ah), 9 Oct 2026; the researcher's question
 * "why does the old fire never spread again in the evening north-westerly?").
 *
 * In the CA the old fire stops for good once its sectors are secured (`scenario-18.ts` control events, 16:20 and 16:40). Per
 * stretch of the old perimeter after 17:00 (bearing from the ignition point; `SPEC/24` revision (ah)):
 *   - 0–30° (north edge, Bear Lake side): crews on it (EK14, EK15, KY23, KY21/VPK until 17:40);
 *   - 30–90° (the old head and its east side): road R1, the Koivuoja brook and the open bog and fields north-east of
 *     the head on a third of it, the secured line on the rest, which faces downwind in the evening;
 *   - 90–130° (the old south-east flank): the secured line only, downwind;
 *   - 130–260° (sector L3, the origin's south side): not secured, no crew — where the old edge does flare up (17:00, V9);
 *   - 260–360° (the origin's rear and the north-west edge): faces the wind, so it backs into it; the secured line —
 *     and where it flares up anyway in the 19:00 wind, the origin's west edge (19:20, the second rekindle).
 * The secured stretches that face downwind (30–130°) with nothing but the line are what this patrol holds: the region's
 * forestry contractor with two forwarders carrying water and four men, from 16:45, which digs and soaks the hot spots
 * along the line. Its rounds are logged (a labelled header, "Jälkivartion kierros klo hh.mm: "); the 18:50 round is the wind
 * event's flare-up inside the line.
 *
 * Authored, not drawn, identical for every participant; own id sequence (`evt.op.NN`), appended after the generated
 * traffic as the forecasts are, so no other record's id, time or text moves. Recorded (T2), not pushed; from V10 on,
 * so V9 (the omission) has nothing new about any edge.
 */

import type { InteractionEvent } from "../../app/scenario/types.js";
import { viewOfStep } from "../../app/scenario/views.js";
import { clockAt, stepStartS } from "./traffic-text.js";

/** The patrol's source id in the corpus (English "Mop-up patrol", `content/i18n/labels.en.json`). */
export const PATROL_SOURCE = "JÄLKIVARTIO";

const ROUNDS: readonly { readonly step: number; readonly offsetS: number; readonly fi: string; readonly en: string }[] = [
  {
    step: 13, offsetS: 300,
    fi: "Jälkivartion kierros klo 17.25: vanhan palon itä- ja kaakkoisreuna (lohko L2) kierretty. Vartiossa klo 16.45 alkaen metsänhoitoyhdistyksen urakoitsija alueen pyynnöstä, kaksi kuormatraktoria 10 m³:n vesisäiliöin ja neljä miestä. Linja kaivettu kivennäismaahan ja kasteltu, ei liekkejä; kolme kytöpesäkettä kasteltu ja kaivettu auki.",
    en: "Mop-up patrol round at 17.25: the old fire's east and south-east edge (sector L2) patrolled. On watch since 16.45: the forest owners' association's contractor at the region's request, two forwarders with 10 m³ water tanks and four men. The line is dug to mineral soil and soaked, no flames; three smouldering spots soaked and dug out.",
  },
  {
    step: 15, offsetS: 300,
    fi: "Jälkivartion kierros klo 18.05: lohkon L2 itä- ja kaakkoisreuna kierretty toiseen kertaan. Länsiluoteistuuli painaa savua linjan yli, mutta linja pitää; kaksi kytöpesäkettä kasteltu, yksi kanto kaivettu auki.",
    en: "Mop-up patrol round at 18.05: sector L2's east and south-east edge patrolled a second time. The west-north-west wind pushes smoke over the line, but the line holds; two smouldering spots soaked, one stump dug out.",
  },
  {
    step: 17, offsetS: 600,
    fi: "Jälkivartion kierros klo 18.50: puuskat voimistuneet. Itäreunalla yksi kanto leimahti linjan sisäpuolella, sammutettu traktorin säiliöllä; kipinöitä ei linjan yli. Kierrämme reunaa tiheämmin; perääntyminen tarvittaessa tielle R1, kaikki tallessa.",
    en: "Mop-up patrol round at 18.50: the gusts have strengthened. On the east edge a stump flared up inside the line, put out from a forwarder's tank; no embers across the line. We patrol the edge more often; if needed we pull back to road R1, all accounted for.",
  },
  {
    step: 19, offsetS: 300,
    fi: "Jälkivartion kierros klo 19.25: lohkon L2 reuna pitää, ei avotulta. Vartiointi jatkuu yön yli.",
    en: "Mop-up patrol round at 19.25: sector L2's edge holds, no open fire. The patrol continues through the night.",
  },
];

/** The patrol's rounds as interaction-log records (T2, recorded) and their English by record id. */
export function patrolTraffic(): { readonly events: InteractionEvent[]; readonly english: Record<string, string> } {
  const events = ROUNDS.map((r, k): InteractionEvent => {
    const sim = stepStartS(r.step) + r.offsetS;
    return {
      id: `evt.op.${String(k + 1).padStart(2, "0")}`, cycle: r.step, session_view: viewOfStep(r.step)?.index ?? null, sim_time_s: sim, timestamp: clockAt(sim),
      actor: PATROL_SOURCE, actor_type: "command", addressee: "JOHTO", location: "L2-Koillinen", place: null, lat: null, lon: null,
      event_type: "report", task: null, content: r.fi, tier: "T2_system", channel: "system_log", nav: "palo", lang: "fi",
    };
  });
  return { events, english: Object.fromEntries(events.map((e, k) => [e.id, ROUNDS[k]!.en])) };
}
