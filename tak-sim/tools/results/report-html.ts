/**
 * One self-contained HTML page per participant (SPEC/36 §3): the study's look (the dark page, the amber accent of the session screens),
 * a print style (white, black text, no backgrounds), no external resource, no script. Every dynamic string is escaped.
 *
 * Contents: the profile in bands (calibration and its resolution, checking, the tool counts and plan reviews), the comparison bands
 * against the same background group and the expert median, 2–4 development tips, the reliability note and the privacy note. Never:
 * an item, a key, a right or wrong answer, an exact score (the profile's percentages stay out), the address, or another participant's
 * value (only the participant's own band within a group of at least `MIN_COMPARISON_GROUP`).
 */

import { PROFILE_TEXT } from "../../app/render/ui/profile/profile-texts.js";
import { TIP_TEXT } from "../../app/telemetry/profile-tips.js";
import type { Comparison, PersonalResult } from "./comparison.js";
import { REPORT_TEXT } from "./report-texts.js";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: #1f2327; color: #e8eaed; font: 15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 48px; display: flex; flex-direction: column; gap: 16px; }
h1 { margin: 0; font-size: 24px; font-weight: 600; }
h2 { margin: 8px 0 0; font-size: 18px; font-weight: 600; }
h3 { margin: 0; font-size: 15px; font-weight: 600; }
p { margin: 0; }
.subtitle { color: #b8bcc2; font-size: 14px; }
.card { border: 1px solid #3a3f44; border-radius: 8px; background: #2a2f34; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.band { color: #f4a261; font-weight: 600; }
.muted { color: #b8bcc2; font-size: 13.5px; }
.note { padding: 10px 12px; border-left: 3px solid #f4a261; background: #24282c; }
ol.tips { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; }
footer { color: #b8bcc2; font-size: 12.5px; border-top: 1px solid #3a3f44; padding-top: 10px; }
@media print {
  :root { color-scheme: light; }
  body { background: #fff; color: #000; font-size: 11pt; }
  main { padding: 0; max-width: none; }
  .card { background: none; border-color: #999; break-inside: avoid; }
  .band { color: #000; }
  .muted, .subtitle, footer { color: #333; }
  .note { background: none; border-left-color: #000; }
}
`;

const p = (text: string, cls?: string) => `<p${cls ? ` class="${cls}"` : ""}>${escapeHtml(text)}</p>`;

function profileSection(result: PersonalResult, lang: "fi" | "en"): string {
  const pt = PROFILE_TEXT[lang], rt = REPORT_TEXT[lang], { calibration: c, checking: k, toolUse: u } = result.profile;
  const calibration = c.status === "ok" && c.band !== null
    ? [p(pt.calibration.band[c.band], "band"), p(pt.calibration.meaningOf[c.band]),
      p(c.resolution.status === "ok" && c.resolution.band !== null ? pt.calibration.resolution[c.resolution.band] : pt.calibration.resolutionNotEnough, "muted")].join("")
    : p(c.status === "unavailable" ? pt.calibration.unavailable : pt.calibration.notEnough, "muted");
  const checking = k.status === "ok" && k.band !== null
    ? [p(pt.checking.band[k.band], "band"), p(pt.checking.meaningOf[k.band])].join("")
    : p(k.status === "unavailable" ? pt.checking.unavailable : pt.checking.notEnough, "muted");
  const tools = u.status === "ok"
    ? [p(rt.questions(u.hakuSearches, u.guideQuestions)), p(u.reviews === null ? pt.toolUse.noReviews : rt.reviews(u.reviews.changed, u.reviews.shown)), p(pt.toolUse.meaning, "muted")].join("")
    : p(rt.noAnswers, "muted");
  const card = (title: string, body: string) => `<section class="card"><h3>${escapeHtml(title)}</h3>${body}</section>`;
  return [card(pt.calibration.title, calibration), card(pt.checking.title, checking), card(pt.toolUse.title, tools)].join("\n");
}

function comparisonCard(cmp: Comparison, lang: "fi" | "en"): string {
  const rt = REPORT_TEXT[lang];
  const own = !cmp.hasValue ? rt.noValue : cmp.band === null ? rt.tooFew : rt.band[cmp.metric][cmp.band];
  const expert = cmp.expert === null ? rt.expertPending : rt.expert[cmp.metric][cmp.expert];
  return `<section class="card"><h3>${escapeHtml(rt.metric[cmp.metric])}</h3>${p(own, cmp.band === null ? "muted" : undefined)}${p(expert, "muted")}</section>`;
}

/** The whole report page. */
export function reportHtml(result: PersonalResult, lang: "fi" | "en"): string {
  const rt = REPORT_TEXT[lang];
  const tips = result.tips.map((id) => `<li><h3>${escapeHtml(TIP_TEXT[lang][id].title)}</h3>${p(TIP_TEXT[lang][id].text)}</li>`).join("\n");
  const decisions = result.profile.checking.decisions, answers = result.profile.calibration.answers;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(rt.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header><h1>${escapeHtml(rt.title)}</h1>${p(rt.subtitle, "subtitle")}</header>
${p(rt.intro)}
<h2>${escapeHtml(rt.profileHeading)}</h2>
${profileSection(result, lang)}
<h2>${escapeHtml(rt.comparisonHeading)}</h2>
${p(rt.groupLine(rt.group[result.group]))}
${result.comparisons.map((c) => comparisonCard(c, lang)).join("\n")}
<h2>${escapeHtml(rt.tipsHeading)}</h2>
<ol class="tips">
${tips}
</ol>
<h2>${escapeHtml(rt.aboutHeading)}</h2>
${p(rt.reliability(answers, decisions), "note")}
${p(rt.privacy, "note")}
<footer>${escapeHtml(rt.footer)}</footer>
</main>
</body>
</html>
`;
}
