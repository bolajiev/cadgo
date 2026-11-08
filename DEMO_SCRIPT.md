# Cadgo demo script

**Recorded cut:** `docs/cadgo-demo.mp4` — 1:21, 1280×720, no voice track.
**Live URL:** `https://cadgo-v2.vercel.app/studio`

The recording is a real screen capture, not a motion mock-up. It shows a 15-part, 12-joint humanoid walk cycle, then a live agent edit with the thinking stream and local compile. Record your voice over it, or use this as the shot plan for a new take.

## The one-sentence story

Cadgo turns a sentence into an editable mechanical assembly: the agent plans and writes real parametric CAD, every part compiles locally, and the result can be inspected, moved and exported.

## Recorded cut — narration and actions

### 0:00–0:03 — Title

**Visual:** Cadgo title card.

**Voiceover:**
> “Most AI CAD tools stop at a picture. Cadgo gives you a working assembly.”

### 0:03–0:15 — The humanoid is a real mechanism

**Visual:** Humanoid study loaded. Tree on the left, stage in the centre, inspector on the right. The walk cycle starts; one leg lifts, the arms swing, the waist twists.

**On-screen caption:** `15 parts · 12 joints · one walk phase`

**Voiceover:**
> “Fifteen parts, twelve joints, one walk-phase driver. Hips, knees, ankles, arms and waist move as separate bodies — not a baked animation.”

### 0:15–1:12 — Agent edit, with visible reasoning

**Visual:** Agent tab. The prompt is already in the composer: **“Widen the humanoid torso: set torso width to 360 mm and depth to 220 mm. Keep the walk_phase cycle, all groups and separate bodies. Rebuild and stop.”** Send. The **THINKING** stream is visible. The agent reads the model, updates the Torso definition, recompiles it, renders inspection views, checks the arm clearance, and stops. The stage updates.

**On-screen caption:** `The agent reads the document, edits named source, and compiles locally.`

**Voiceover:**
> “Now the agent edits the same assembly. It reads the document, changes the torso’s named parameters, recompiles locally, and inspects its own work. The reasoning streams while it works. The torso is wider, the walk cycle still runs, and every part is still separate.”

### 1:12–1:16 — Outputs

**Visual:** Export menu open: Assembly STL, SCAD bundle, Cadgo document, share link. Left and right dividers have been dragged to show the resizable workspace.

**On-screen caption:** `Separate bodies · standard outputs · browser-local`

**Voiceover:**
> “Resize the workspace, isolate a body, and export separate STLs, a SCAD bundle, or the editable document. The geometry never leaves your browser.”

### 1:16–1:21 — Honest close

**Visual:** Cadgo close card with the URL.

**Voiceover:**
> “Cadgo is concept CAD, not an engineering B-Rep kernel. But it goes from a sentence to an assembly you can inspect, move and export. Describe it. Inspect it. Move it. Export it.”

## Prompt card

### Edit prompt used in the recorded cut

```text
Concept model, not for printing. Widen the humanoid torso: set torso width to 360 mm and depth to 220 mm. Keep the walk_phase cycle, all groups and separate bodies. Rebuild and stop.
```

### Full build prompt — wind turbine (optional live segment)

Use this if you want the agent to create an assembly from scratch. It is a longer segment; expect several minutes and time-lapse the middle.

```text
Concept model, not for printing. Build a 1000 mm tall three-part wind turbine: a fixed tower 700 mm tall; a nacelle 260 × 160 × 150 mm at the top; and a 600 mm diameter, 3-blade rotor in front of the nacelle. Put the rotor on one horizontal revolute group joint at the hub, with a driver named rotor_angle. Keep all three bodies separate and every dimension named. Build it, inspect it once, and stop.
```

### Build prompt — humanoid (optional live segment)

```text
Concept model, not for printing. Build a mechanical humanoid robot, not a person. Use a torso, pelvis, head, two arms and two legs. Make each limb a hierarchy with shoulder, elbow, hip, knee and ankle joints. Add a walk_phase driver from 0 to 360 that swings the arms opposite the legs, bends the knees during swing, and keeps the feet level. Keep every dimension named and every part separate.
```

### Inspection prompt

```text
Inspect the current assembly: check joint axes, intersections, floating parts and parameter errors. Fix what you find and list the changes.
```

### Backup prompt — simple printable part

```text
Create a parametric mounting plate, 120 × 80 × 6 mm, with four 4.5 mm holes inset 12 mm from the corners. Name every dimension, keep it one body, and show the final dimensions.
```

## Live build option — 2:30 shot list

If you replace the recorded agent edit with a from-scratch wind turbine build:

| Time | Action |
|---|---|
| 0:00–0:08 | Humanoid walk cold open |
| 0:08–0:25 | Studio overview: tree, stage, inspector, local kernel |
| 0:25–0:45 | Load humanoid; play walk; resize a divider |
| 0:45–1:45 | New part; paste turbine prompt; show thinking and first parts; time-lapse the middle |
| 1:45–2:05 | Play rotor; select the joint; show the axis |
| 2:05–2:20 | Edit one named dimension; recompile |
| 2:20–2:30 | Export menu; close and URL |

Keep the original recording and a backup MP4. A real-time build cut with a visible time-lapse is honest; do not fake parts appearing.

## Presenter rules

- One goal per turn. Wait for **Ready** before sending the next prompt.
- Say “concept model” when you do not want printer questions.
- The agent may ask for printer/bed information; answer: **“Concept model only — no printer constraints.”**
- If the agent starts drifting, press **Stop**, then restate the next concrete step.
- Do not claim engineering accuracy, B-Rep, STEP, or print certification.
- Show one limitation honestly. A bounded claim is stronger than a universal one.
- If the Vercel URL shows a security checkpoint after heavy automated traffic, wait for the challenge to clear or use the current Cloudflare tunnel fallback; test the exact URL on the recording machine before the take.

## Submission checklist

- [ ] Production URL loads logged out.
- [ ] Humanoid study loads and compiles; walk cycle runs.
- [ ] Agent edit completes; thinking stream visible.
- [ ] Export menu shown; no keys or unrelated tabs.
- [ ] Video under 3:00; audio checked; captions added.
- [ ] Final frame shows the URL.
- [ ] Save the raw recording and a backup MP4.
- [ ] Confirm the public repo is current before submitting.

## Video metadata

**Title:** Cadgo — from a sentence to a moving assembly

**Description:** Cadgo is a browser-native AI CAD assembly studio. Explore a 15-part, 12-joint humanoid walk cycle, then watch the agent read the assembly, edit named torso dimensions, recompile locally, and inspect its own work. Resize the workspace, inspect separate bodies, and export STLs, a SCAD bundle, or the editable document. Concept CAD, compiled locally in your browser.

**Short caption:** Describe it. Inspect it. Move it. Export it.
