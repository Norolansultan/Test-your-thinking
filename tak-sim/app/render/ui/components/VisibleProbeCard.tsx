import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { SessionOrchestrator, VisibleProbeView } from "../../../session/orchestrator.js";
import { useLang } from "../i18n.js";
import { Choice, ConfidencePicker, hint, label, PrimaryButton } from "./PanelParts.js";
import { areaAnswer, ProbeAnswerTracker } from "../probe-telemetry.js";
import { Glossed } from "../explain/Glossed.js";

/** An option's hover (`probe_option_hovered`) without changing its layout: the wrapper has no box of its own. */
function Hover({ onEnter, children }: { readonly onEnter: (pointerType: string) => void; readonly children: ComponentChildren }) {
  return <span style={{ display: "contents" }} onPointerEnter={(e) => onEnter(e.pointerType)}>{children}</span>;
}

/**
 * A visible probe — Type U (SPEC/08 §3.5, §4 PROBING_VISIBLE; 5 Oct 2026). It takes the
 * decision strip under the map, which stays on screen; Haku and Thinker are locked and the view's
 * clock stands still while it is open (`visible-probes.ts`). The decision strip stays mounted and
 * hidden under it, so its drafts survive. Three forms (Type E, the map area, withdrawn 6 Oct 2026;
 * revision (ai), 9 Oct 2026: no free text):
 * - V13's U (`area`): yes/no; on yes, which parts of the picture (any number, the participant's order);
 * - V14's backup (`choice`): one of the pairs, "none" last, then the confidence;
 * - V14's coverage (`scale`): the one scale.
 * The view carries no key. No word names a tool or a conflict.
 * SPEC/30 §5.4 (19 Oct 2026): option hovers and every answer change before sending are logged (`probe-telemetry.ts`:
 * `choice` the option id, `area` "no" / "yes" / "yes:<parts in order>", `scale` the value); a changed answer is shown
 * once its record is durable (I5).
 */
export function VisibleProbeCard({ probe, orchestrator }: {
  readonly probe: VisibleProbeView;
  readonly orchestrator: SessionOrchestrator;
}) {
  const { t, tr } = useLang();
  const v = t.visibleProbe;
  const [confidence, setConfidence] = useState<number | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [unsure, setUnsure] = useState<boolean | null>(null);
  const [areas, setAreas] = useState<readonly string[]>([]);
  const [sending, setSending] = useState(false);
  const answers = useRef<ProbeAnswerTracker | null>(null);
  answers.current ??= ProbeAnswerTracker.of(orchestrator);
  const chosenAreas = useRef<readonly string[]>([]); // the parts as last chosen (shown once their record is durable)
  useEffect(() => { setConfidence(null); setChoice(null); setUnsure(null); setAreas([]); setSending(false); chosenAreas.current = []; }, [probe.probeId]);

  const send = (fn: () => Promise<void>) => { setSending(true); void fn().catch(() => setSending(false)); };
  const hovered = (optionId: string) => (pointerType: string) => answers.current!.hovered(probe.probeId, optionId, pointerType);
  const changed = (to: string, show: () => void) => answers.current!.changed(probe.probeId, to, show);
  const answerUnsure = (yes: boolean) => {
    if (!yes) chosenAreas.current = [];
    changed(areaAnswer(yes, chosenAreas.current), () => { setUnsure(yes); if (!yes) setAreas([]); });
  };
  const toggleArea = (optionId: string) => {
    const a = chosenAreas.current;
    const next = a.includes(optionId) ? a.filter((x) => x !== optionId) : [...a, optionId];
    chosenAreas.current = next;
    changed(areaAnswer(true, next), () => setAreas(next));
  };
  const areaReady = unsure === false || (unsure === true && areas.length > 0);

  return (
    <div data-testid={`visible-probe-${probe.type}`} role="dialog" aria-label={v.title[probe.type]} style={{ padding: "12px 16px", borderTop: "2px solid #8ab4f8", background: "#20242a", flexShrink: 0 }}>
      <div style={label}>{v.title[probe.type]}</div>
      <p style={{ margin: "2px 0 8px", fontSize: 14 }}><Glossed text={tr(probe.promptFi)} surface="other" /></p>

      {probe.kind === "area" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <Hover onEnter={hovered("yes")}><Choice selected={unsure === true} onClick={() => answerUnsure(true)}>{v.yes}</Choice></Hover>
            <Hover onEnter={hovered("no")}><Choice selected={unsure === false} onClick={() => answerUnsure(false)}>{v.no}</Choice></Hover>
          </div>
          {unsure === true && probe.followUpFi && (
            <>
              <p style={{ margin: "2px 0 6px", fontSize: 14 }}><Glossed text={tr(probe.followUpFi)} surface="other" /></p>
              <div role="group" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {probe.options.map((o) => <Hover key={o.id} onEnter={hovered(o.id)}><Choice selected={areas.includes(o.id)} onClick={() => toggleArea(o.id)}><Glossed text={tr(o.fi)} surface="other" /></Choice></Hover>)}
              </div>
            </>
          )}
          <PrimaryButton disabled={sending || !areaReady} onClick={() => send(() => orchestrator.submitProbeArea(unsure === true, unsure === true ? areas : []))}>{v.submit}</PrimaryButton>
        </>
      )}

      {probe.kind === "choice" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            {probe.options.map((o) => <Hover key={o.id} onEnter={hovered(o.id)}><Choice selected={choice === o.id} onClick={() => changed(o.id, () => setChoice(o.id))}><Glossed text={tr(o.fi)} surface="other" /></Choice></Hover>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {probe.collectsConfidence && <ConfidencePicker value={confidence} onChange={setConfidence} />}
            <span style={{ flex: 1 }} />
            <PrimaryButton disabled={sending || choice === null || (probe.collectsConfidence && confidence === null)}
              onClick={() => send(() => orchestrator.submitProbeChoice(choice!, probe.collectsConfidence ? confidence! : undefined))}>{v.submit}</PrimaryButton>
          </div>
        </>
      )}

      {probe.kind === "scale" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConfidencePicker value={confidence} onChange={(c) => changed(String(c), () => setConfidence(c))} />
          <span style={{ flex: 1 }} />
          <PrimaryButton disabled={sending || confidence === null} onClick={() => send(() => orchestrator.submitProbeScale(confidence!))}>{v.submit}</PrimaryButton>
        </div>
      )}

      <p style={{ ...hint, margin: "8px 0 0", fontSize: 12 }}>{v.note}</p>
    </div>
  );
}
