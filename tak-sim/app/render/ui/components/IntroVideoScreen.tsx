import { useEffect, useRef, useState } from "preact/hooks";
import type { SessionOrchestrator } from "../../../session/orchestrator.js";
import type { IntroVideoOutcome } from "../../../telemetry/record-kinds.js";
import { useLang } from "../i18n.js";

/**
 * The intro video before the practice view (10 Oct 2026, `SessionOptions.introVideo`): full screen, the
 * same for every participant. "Start the practice" opens once the video has ended, or at once if it
 * cannot be played; only a demonstration may skip it. The browser may block autoplay with sound: the
 * video then waits for its own play button. How the page was left is logged (`briefing.video`).
 */
export function IntroVideoScreen({ video, orchestrator }: {
  readonly video: { readonly src: string; readonly skippable: boolean };
  readonly orchestrator: SessionOrchestrator;
}) {
  const { t } = useLang();
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"playing" | "blocked" | "ended" | "error">("playing");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.play()?.catch(() => setState((s) => (s === "playing" ? "blocked" : s)));
  }, []);

  const leave = (outcome: IntroVideoOutcome) => {
    if (leaving) return;
    setLeaving(true);
    ref.current?.pause();
    void orchestrator.finishIntroVideo(outcome).catch(() => setLeaving(false));
  };
  const canStart = state === "ended" || state === "error";
  const button = (primary: boolean, disabled: boolean) => ({
    padding: "10px 20px", borderRadius: 6, fontSize: 14, cursor: disabled ? "default" : "pointer", color: "#e8eaed", opacity: disabled ? 0.45 : 1,
    border: `1px solid ${primary ? "#f4a261" : "#3a3f44"}`, background: primary ? "#3a3f44" : "#2a2f34",
  });

  return (
    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box", background: "#000" }}>
      <div style={{ width: "100%", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 14 }}>
        <video
          ref={ref}
          src={video.src}
          controls={state === "blocked"}
          playsInline
          preload="auto"
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onPlay={() => setState((s) => (s === "blocked" ? "playing" : s))}
          onEnded={() => setState("ended")}
          onError={() => setState("error")}
          style={{ width: "100%", maxHeight: "calc(100vh - 140px)", background: "#000", borderRadius: 4 }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "#c9ced3", fontSize: 14 }}>
          <span role="status">{state === "error" ? t.introVideo.failed : state === "ended" ? "" : state === "blocked" ? t.introVideo.play : t.introVideo.watchFirst}</span>
          <div style={{ display: "flex", gap: 10 }}>
            {video.skippable && !canStart && <button style={button(false, leaving)} disabled={leaving} onClick={() => leave("skipped")}>{t.introVideo.skip}</button>}
            <button style={button(true, !canStart || leaving)} disabled={!canStart || leaving} onClick={() => leave(state === "error" ? "error" : "ended")}>{t.startPractice}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
