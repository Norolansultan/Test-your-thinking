import type { SessionSnapshot } from "../../../session/orchestrator.js";
import { MAIN_VIEW_COUNT } from "../../../scenario/views.js";
import { useLang } from "../i18n.js";
import { unitCallSign } from "../../../i18n/place-names.js";
import type { Lang } from "../../../i18n/lang.js";
import { chapterLabel } from "../../../i18n/public-texts.js";
import { useAudience } from "../audience-context.js";

/**
 * What a screen reader announces of the countdown (6 Oct 2026): not every second, but each time it crosses
 * 20, 10 or 5 s — by the threshold crossed, so a jump past one (the countdown switches from the cap to the
 * minimum on confirmation) is still announced.
 */
const announcedThreshold = (s: number): number | null => (s <= 5 ? 5 : s <= 10 ? 10 : s <= 20 ? 20 : null);

const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 } as const;

/**
 * `onSkip`: the demonstration's "skip period" (`SessionOrchestrator.skipView`), given only while it is offered.
 * Review fixes 6 Oct 2026: the units are this view's roster (`snapshot.allocation`, as in the plan
 * panel), not a fixed list; the study phase letter, the condition and the log count are shown only in
 * demonstration (`skipAllowed`), never to a study participant.
 */
/**
 * The units the bar lists, as the session language names them (review of revision (ae), B1: the English bar
 * showed the raw id "VPK" while the plan panel, the markers and the log said VOL1).
 */
export function statusStripUnits(snapshot: Pick<SessionSnapshot, "allocation">, lang: Lang): string[] {
  return [...snapshot.allocation.crews, ...snapshot.allocation.droneTeams].map((u) => unitCallSign(lang, u));
}

export function StatusStrip({ snapshot, onSkip }: { readonly snapshot: SessionSnapshot; readonly onSkip?: () => void }) {
  const unreadCount = snapshot.renderTree.bubbles.length;
  const { t, lang } = useLang();
  const demo = snapshot.skipAllowed;
  const viewLabel = snapshot.practice ? t.practiceLabel : t.viewLabel(snapshot.currentCycle, MAIN_VIEW_COUNT);
  // SPEC/35 §4: a public session's chapter title (the time of day only; the same in every cell), none in the practice view.
  const chapter = useAudience().audience === "public" ? chapterLabel(lang, snapshot.currentCycle) : null;
  const units = statusStripUnits(snapshot, lang);
  // No countdown once the period has ended: a forced situation question holds the view's end with its clock
  // paused, and the frozen "1 s" read as a second timer beside the question (review 9 Oct 2026).
  const periodEnded = snapshot.spam !== null && "forced" in snapshot.spam && snapshot.spam.forced;
  const countdown = snapshot.secondsLeft !== null && snapshot.secondsLeft > 0 && snapshot.step !== "freeze" && !periodEnded ? snapshot.secondsLeft : null;
  return (
    <div
      data-tour="status"
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 4, padding: "8px 16px",
        background: "#20242a", borderBottom: "1px solid #33383e", fontSize: 13, fontFamily: "monospace",
        flexShrink: 0,
      }}
    >
      <span>{t.clock} {snapshot.clockLabel}</span>
      {/* The final countdown: the last 20 s before the view ends (its 150 s cap, or its minimum once confirmed); not during a freeze. */}
      {countdown !== null && (
        <span role="timer" style={{ color: "#f4a261", fontWeight: 700 }}>
          {t.periodEndsIn(countdown)}
        </span>
      )}
      {/* Always mounted, so the announcement is reliable; its text changes only when 20, 10 or 5 s is crossed. */}
      <span aria-live="polite" style={VISUALLY_HIDDEN}>
        {countdown !== null && announcedThreshold(countdown) !== null ? t.periodEndsIn(announcedThreshold(countdown)!) : ""}
      </span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>
        {snapshot.practice || !demo ? viewLabel : `${viewLabel} (${t.step} ${snapshot.phase})`}
      </span>
      {chapter && <span data-testid="chapter-title" style={{ opacity: 0.8 }}>{chapter}</span>}
      <span style={{ opacity: 0.6 }}>·</span>
      <span style={{ opacity: 0.8 }}>{t.phase[snapshot.cyclePhase]}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {units.map((u) => (
          <span key={u} title={`${u}: ${t.onScene}`}>
            {u} <Dot />
          </span>
        ))}
      </span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>{unreadCount} {t.newItems}</span>
      {onSkip && (
        <button
          data-testid="skip-view" onClick={onSkip}
          style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: "1px solid #f4a261", background: "none", color: "#f4a261", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
        >{t.skipView}</button>
      )}
      {(demo || snapshot.previewOverride) && (
        <span style={{ marginLeft: onSkip ? 0 : "auto", opacity: 0.5 }}>
          {snapshot.previewOverride && <span style={{ color: "#f4a261", opacity: 1 }}>{t.preview} {snapshot.previewOverride.minViewSeconds} s{demo ? " · " : ""}</span>}
          {demo && `${t.condition}: ${snapshot.conditionLabel} · ${t.logRecords}: ${snapshot.logRecordCount}`}
        </span>
      )}
    </div>
  );
}

function Dot() {
  return <span style={{ color: "#5ec26a" }}>●</span>;
}
