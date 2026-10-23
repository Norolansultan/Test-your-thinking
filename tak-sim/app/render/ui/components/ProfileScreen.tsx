/**
 * SPEC/35 §4: the commander profile after the questionnaire (work package P1 shows it and logs `profile_shown`). Since SPEC/36 (23 Oct
 * 2026) it is shown only with `?profiili=heti` (either audience); otherwise the same profile is sent after the study closes.
 * One calm page: three cards (calibration, checking, tool use), each with the participant's own value, what the pattern means in
 * general and one generic tip, the expert comparison's slot, the note that the profile is private and not a test score, and Continue.
 * The values come from `commanderProfile` (`app/telemetry/profile.ts`), which returns aggregates only: nothing here can name an
 * item, a key or a correct answer. Hook-free (the profile is a cheap pure fold), so tests render it by calling it. Texts:
 * `profile/profile-texts.ts` (fi DRAFT).
 */

import type { ComponentChildren } from "preact";
import type { ProfileScreenProps } from "../audience-context.js";
import { commanderProfile, type CommanderProfile } from "../../../telemetry/profile.js";
import { PROFILE_TEXT, type ProfileLang, type ProfileTexts } from "../profile/profile-texts.js";

const page = { display: "flex", height: "100%", overflowY: "auto", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" } as const;
const column = { maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 16 } as const;
const para = { margin: 0, fontSize: 15, lineHeight: 1.6 } as const;
const card = { border: "1px solid #3a3f44", borderRadius: 8, background: "#2a2f34", padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 8 } as const;
const subhead = { margin: "6px 0 0", fontSize: 13, fontWeight: 600, letterSpacing: 0.3, color: "#b8bcc2", textTransform: "uppercase" } as const;
const band = { margin: 0, fontSize: 16, fontWeight: 600, color: "#f4a261" } as const;
const muted = { ...para, fontSize: 13, color: "#b8bcc2" } as const;
const button = {
  padding: "12px 24px", minHeight: 44, borderRadius: 6, fontSize: 15, cursor: "pointer", color: "#e8eaed", border: "1px solid #f4a261", background: "#3a3f44",
} as const;

const signed = (v: number): string => { const r = Math.round(v); return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)}`; };

export function ProfileScreen({ lang, records, onDone }: ProfileScreenProps) {
  return <ProfileView lang={lang} profile={commanderProfile(records)} onDone={onDone} />;
}

export function ProfileView({ lang, profile, onDone }: { readonly lang: ProfileLang; readonly profile: CommanderProfile; readonly onDone: () => void }) {
  const t = PROFILE_TEXT[lang];
  return (
    <div style={page} data-testid="profile-screen">
      <main lang={lang} style={column} aria-labelledby="profile-title">
        <h1 id="profile-title" style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
        <p style={para}>{t.intro}</p>
        <CalibrationCard t={t} profile={profile} />
        <CheckingCard t={t} profile={profile} />
        <ToolUseCard t={t} profile={profile} />
        <p role="note" data-testid="profile-note" style={{ ...para, padding: "10px 12px", borderLeft: "3px solid #f4a261", background: "#24282c" }}>{t.privacyNote}</p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" data-testid="profile-continue" style={button} onClick={onDone}>{t.continue}</button>
        </div>
      </main>
    </div>
  );
}

interface CardProps {
  readonly id: string;
  readonly t: ProfileTexts;
  readonly title: string;
  readonly bandLabel: string | null;
  readonly value: ComponentChildren;
  readonly meaning: string;
  readonly tip: string;
  readonly expert: string;
}

function Card({ id, t, title, bandLabel, value, meaning, tip, expert }: CardProps) {
  return (
    <section data-testid={`profile-${id}`} aria-labelledby={`profile-${id}-title`} style={card}>
      <h2 id={`profile-${id}-title`} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
      {bandLabel !== null && <p style={band}>{bandLabel}</p>}
      <h3 style={subhead}>{t.yourValue}</h3>
      {value}
      <h3 style={subhead}>{t.meaning}</h3>
      <p style={para}>{meaning}</p>
      <h3 style={subhead}>{t.tip}</h3>
      <p style={para}>{tip}</p>
      <p style={muted} data-testid={`profile-${id}-expert`}>{expert}</p>
    </section>
  );
}

const expertLine = (t: ProfileTexts, value: string | null): string => (value === null ? t.expertPending : t.expertMedian(value));

function CalibrationCard({ t, profile }: { readonly t: ProfileTexts; readonly profile: CommanderProfile }) {
  const c = profile.calibration, tx = t.calibration;
  const ref = profile.expert.calibrationGapPoints;
  const expert = expertLine(t, ref === null ? null : tx.gap(signed(ref)));
  if (c.status !== "ok" || c.band === null || c.meanConfidence === null || c.percentCorrect === null || c.gapPoints === null) {
    return <Card id="calibration" t={t} title={tx.title} bandLabel={null} value={<p style={para}>{c.status === "unavailable" ? tx.unavailable : tx.notEnough}</p>}
      meaning={tx.meaningOf.well} tip={tx.tipOf.well} expert={expert} />;
  }
  const resolution = c.resolution.status === "ok" && c.resolution.band !== null ? tx.resolution[c.resolution.band] : tx.resolutionNotEnough;
  return (
    <Card id="calibration" t={t} title={tx.title} bandLabel={tx.band[c.band]} meaning={tx.meaningOf[c.band]} tip={tx.tipOf[c.band]} expert={expert}
      value={<>
        <p style={para}>{tx.values(t.percent(c.meanConfidence), t.percent(c.percentCorrect))} {tx.gap(signed(c.gapPoints))}</p>
        <p style={para}>{resolution} <span style={{ color: "#b8bcc2" }}>{tx.resolutionCaveat}</span></p>
      </>} />
  );
}

function CheckingCard({ t, profile }: { readonly t: ProfileTexts; readonly profile: CommanderProfile }) {
  const c = profile.checking, tx = t.checking;
  const ref = profile.expert.checkingShare;
  const expert = expertLine(t, ref === null ? null : t.percent(ref * 100));
  if (c.status !== "ok" || c.band === null || c.share === null) {
    return <Card id="checking" t={t} title={tx.title} bandLabel={null} value={<p style={para}>{c.status === "unavailable" ? tx.unavailable : tx.notEnough}</p>}
      meaning={tx.meaningOf.often} tip={tx.tip} expert={expert} />;
  }
  return (
    <Card id="checking" t={t} title={tx.title} bandLabel={tx.band[c.band]} meaning={tx.meaningOf[c.band]} tip={tx.tip} expert={expert}
      value={<>
        <p style={para}>{tx.values(c.checked, c.decisions, t.percent(c.share * 100))}</p>
        {c.medianSecondsToFirstLookup !== null && <p style={para}>{tx.latency(t.duration(c.medianSecondsToFirstLookup))}</p>}
      </>} />
  );
}

function ToolUseCard({ t, profile }: { readonly t: ProfileTexts; readonly profile: CommanderProfile }) {
  const u = profile.toolUse, tx = t.toolUse, ref = profile.expert;
  const parts = [
    ref.hakuSearches === null ? null : tx.haku(ref.hakuSearches),
    u.guideQuestions === null || ref.guideQuestions === null ? null : tx.guide(ref.guideQuestions),
    ref.reviewChangeShare === null ? null : t.percent(ref.reviewChangeShare * 100),
  ].filter((p): p is string => p !== null);
  const expert = expertLine(t, parts.length === 0 ? null : parts.join(" · "));
  if (u.status !== "ok") {
    return <Card id="tooluse" t={t} title={tx.title} bandLabel={null} value={<p style={para}>{tx.unavailable}</p>} meaning={tx.meaning} tip={tx.tip} expert={expert} />;
  }
  return (
    <Card id="tooluse" t={t} title={tx.title} bandLabel={null} meaning={tx.meaning} tip={tx.tip} expert={expert}
      value={<>
        <ul style={{ ...para, paddingLeft: 20 }}>
          <li>{tx.haku(u.hakuSearches)}</li>
          {u.guideQuestions !== null && <li>{tx.guide(u.guideQuestions)}</li>}
        </ul>
        <p style={para}>{u.reviews === null ? tx.noReviews : tx.reviews(u.reviews.changed, u.reviews.shown)}</p>
      </>} />
  );
}
