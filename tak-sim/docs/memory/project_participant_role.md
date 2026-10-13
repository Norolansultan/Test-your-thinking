---
name: participant-role-decision
description: "Open design decision on whether the study participant is the incident commander or an advisor to a scripted IC; user leans commander, revisit after the map work"
metadata:
  node_type: memory
  type: project
  originSessionId: 2e2170e1-4278-4247-a900-c73e95bea049
  modified: 2026-09-23T16:51:56.018Z
---

On 2026-09-23 the user considered reframing the participant as an advisor (deputy/planning officer) whose allocations are logged recommendations, with a scripted on-scene incident commander issuing radio orders. Their answer: keep the participant as **commander**, and revisit the question once the map is finished.

**Why:** The advisor framing explains scripted unit movements and is common in tactical decision games. But it changes what doubt–action coherence measures: it becomes coherence of advice, not action. The user wants to settle the map first.

**Linked decision:** Also on 2026-09-23, the radio was removed as a participant tool (groups: Haku vs Haku + LLM, SPEC/02 revision (j)). A commander who cannot transmit is now a declared realism limitation, and that strengthens the case for the advisor framing. Raise the two together.

**How to apply:** Don't implement advisor framing or scripted-IC messages unprompted. When the map work is done, raise this again. Whatever the role, the related point still holds: scripted unit movements must not systematically follow the best row of the allocation viability table, or the map leaks the scoring key.

**Decided 1 Oct 2026:** participant = **commander orchestrating human teams and drone teams**. Advisor framing dropped. Implication: the allocation task must cover drone units (DR1–3, VD1, UGV1), not only fire crews.
