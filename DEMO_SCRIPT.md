# Cadgo demo script — the replacement furniture foot

**Format:** 2:30 screen recording + physical B-roll, 1440×900 or 1920×1080, voiceover or burned captions.  
**Live:** https://cadgo-3d.vercel.app/  
**Studio:** https://cadgo-3d.vercel.app/studio  
**Repository:** https://github.com/bolajiev/cadgo

This script replaces the old humanoid cut. It follows one real maker job: a missing furniture foot, measured, modeled, print-checked, exported and printed. The last 20 seconds show other parts in the same workflow.

---

## The one-sentence story

A table wobbles because one plastic foot is gone; Cadgo turns the measurement into an editable parametric replacement, checks it against a real print bed, and exports the STL that fixes the table.

## Pre-flight checklist

- [ ] Open `https://cadgo-3d.vercel.app/` and `/studio` logged out; confirm the new landing page and the five-item Concept labs.
- [ ] Send one small test prompt to the agent at least 20 minutes before recording. Confirm a reply and a compile.
- [ ] Clear the desk. Put the broken/missing foot, a caliper, the cable/cable clip and one pre-printed replacement foot in frame.
- [ ] Print the replacement foot before recording. Keep one finished print and one unpainted print.
- [ ] Open the slicer with the exported STL already sliced. Do not wait for a slice on camera.
- [ ] Set browser zoom to 100%, hide bookmarks and notifications, and use a clean browser profile.
- [ ] Use a real printer and bed. The example uses **Bambu Lab A1 mini · 180 × 180 × 180 mm**; replace it with your printer. Never invent a bed size.
- [ ] Record system audio and a separate mic track; the agent's thinking time is cut in editing.
- [ ] Keep the old `docs/cadgo-demo.mp4` as a backup. Record the new cut as `docs/cadgo-print-demo.mp4`.

## Measurement card

Fill this in before recording; the numbers below are examples.

| Measurement | Example | Yours |
|---|---:|---:|
| Furniture leg / old foot top diameter | 44 mm | |
| Old foot bottom diameter | 36 mm | |
| Old foot height | 28 mm | |
| Pad recess diameter × depth | 28 × 2 mm | |
| Screw pilot diameter × depth | 4 × 12 mm | |

If the old foot is gone, measure the leg socket and the floor clearance instead. State the assumption on camera.

---

## Timeline

| Time | Screen/action | Voiceover | Caption |
|---|---|---|---|
| 0:00–0:12 | Physical cold open: the table wobbles; the missing foot; caliper on the leg. | “This table has wobbled for a month because one plastic foot is gone. I measured the leg, and I’m going to model and print the replacement instead of buying a pack of five.” | `A real missing part. One measurement.` |
| 0:12–0:22 | Landing page `https://cadgo-3d.vercel.app/`. Pause on the hero, then click **Open the studio**. | “Cadgo turns a sentence into an editable parametric assembly. It compiles locally in the browser — no account, no server geometry.” | `cadgo-3d.vercel.app` |
| 0:22–0:35 | Studio. Open **Benchbook → Furniture foot**. The part loads. Select it in the tree or stage; the inspector appears. | “I’ll start from the furniture foot in the starter library. It is real parametric OpenSCAD source, not a screenshot.” | `Starter library · Furniture foot` |
| 0:35–0:55 | In the inspector, set the measured values: top diameter 44, bottom 36, height 28, pilot 4 × 12, pad recess 28 × 2. Show the local rebuild after each change. | “These are named dimensions. I change them to the measurements and the browser recompiles locally — no AI round trip.” | `Named dimensions → local recompile` |
| 0:55–1:20 | Open the **Agent** tab. Paste the edit prompt from the prompt cards. Send. Show the thinking stream and the compile. If the wait exceeds 10 seconds, cut to a visible `×8` time-lapse; do not fake parts appearing. | “I need a small chamfer on the bottom rim and the measured dimensions in the source, so I ask the agent. It reads the current part, edits it, recompiles locally, and inspects the result. It does not start over.” | `The agent edits the current part.` |
| 1:20–1:40 | **Export → Print check**. First show “Set a 3D printing profile”, then **Edit print setup**. Choose 3D printing, enter the real printer and bed, PLA, supports none, overhang warning 35. Click **Use setup**, reopen **Print check**. Show watertight, overhang, bed fit, solid volume and mass. | “Before exporting I give Cadgo the real printer and bed. The print check reads the compiled mesh: watertight, overhang, bed fit and a solid mass estimate. It is honest that wall thickness and slicer time still belong to the slicer.” | `Print check: watertight · overhang · bed fit · mass` |
| 1:40–1:55 | **Export → Part STLs**. Show the ZIP; open the slicer; import `parts/01-furniture-foot.stl`; show the sliced preview, estimated time and filament. | “Export the part STL, open it in the slicer, and print. The geometry is standard; nothing is locked inside Cadgo.” | `Part STL → slicer` |
| 1:55–2:20 | Physical B-roll: the pre-printed foot; press the felt pad into the recess; screw it into the leg; set the table down; the wobble is gone. Show the old broken foot beside the new one. | “A few minutes later the foot fits, the table sits flat, and the repair is done. This is a concept part, but it solved the actual problem.” | `Printed, fitted, done.` |
| 2:20–2:30 | Quick montage: Project box cover, Pipe adapter, Desk cable clip, then the landing page. End on the URL and the “Open the studio” button. | “The same workflow works for a box cover, a pipe adapter or a desk cable clip. Describe it. Inspect it. Print it. Cadgo.” | `cadgo-3d.vercel.app · open source · local-first` |

Keep the total under 3:00. If the agent edit runs long, cut the wait; the finished part is the proof.

---

## Prompt cards

### Main agent edit — furniture foot

Paste this into the **Agent** tab after loading the furniture foot and setting the rough dimensions:

```text
Edit the current Furniture foot. Set top_diameter to 44 mm, bottom_diameter to 36 mm, height to 28 mm, pilot_diameter to 4 mm, pilot_depth to 12 mm, pad_diameter to 28 mm, pad_depth to 2 mm. Add a 2 mm chamfer at the bottom rim as a named top-level parameter. Keep it one body, keep every dimension named, compile once, inspect once, and stop.
```

If the agent stops early or drifts:

```text
Continue the current Furniture foot edit. Keep the measured dimensions, add the 2 mm bottom chamfer as a named parameter, keep one body, compile once, and stop.
```

### From-scratch alternative — replacement foot

Use this if you want to show a full build instead of a starter-library edit. It takes longer; time-lapse the middle.

```text
Concept model for 3D printing, not certified engineering. Build a replacement furniture foot as one body: a tapered cylinder with top diameter 44 mm, bottom diameter 36 mm and height 28 mm; a 4 mm diameter × 12 mm deep blind screw pilot in the top; a 28 mm diameter × 2 mm deep felt-pad recess in the bottom; and a 2 mm chamfer on the bottom rim. Name every dimension as a top-level parameter, keep one body, compile once, inspect once, and stop.
```

### Backup 45-second cut — desk cable clip

If the furniture-foot print or the agent edit is not ready, use the desk cable clip. It is smaller and prints fast.

1. Landing page → **Open the studio**.
2. **Benchbook → Desk cable clip**.
3. Set `cable_diameter` to the measured cable (for example 8 mm), `base_length` to 40 mm and `base_width` to 18 mm.
4. **Export → Print check → Edit print setup**: 3D printing, real printer/bed, PLA, supports none, overhang 35. Show the check.
5. **Export → Part STLs**, open the STL in the slicer, then show the printed clip holding the cable.
6. Close: “A real cable, a real fit, a real print.”

### Optional second feature — two screw holes

If the agent edit finishes quickly, add this beat:

```text
Add a second 4 mm screw hole to the current Desk cable clip, 10 mm from the opposite end of the base. Keep the C-ring for an 8 mm cable, keep one body, keep every dimension named, compile once, and stop.
```

---

## Starter-library examples

Use these as the montage or as backup recordings. All four are fully parametric and load from **Benchbook**.

| Part | Measure | Change first | Print note |
|---|---|---|---|
| Project box cover | Box opening length × width, screw spacing | `length`, `width`, `thickness`, `screw_inset` | Flat part; check the lip and screw holes in the slicer. |
| Pipe adapter | Pipe outer diameters and bore | `large_diameter`, `small_diameter`, `bore_large`, `bore_small` | Print flange-down; check the bore in the slicer. |
| Furniture foot | Leg socket, old foot height, pad recess | `top_diameter`, `bottom_diameter`, `height`, `pilot_depth` | Print bottom-down; add a felt pad after printing. |
| Desk cable clip | Cable diameter, base length, screw size | `cable_diameter`, `base_length`, `screw_diameter` | Check the overhang warning; allow supports or reorient in the slicer if needed. |

Example prompts for the montage:

```text
Concept model for printing: a screw-down project box cover 140 × 90 mm with a 2 mm locating lip and four M4 clearance holes. Keep every dimension named, one body, inspect once, and stop.
```

```text
Concept model for printing: a stepped pipe adapter with a 46 mm flange, a 34 mm large end, a 24 mm small end and a through bore. Keep every dimension named, one body, inspect once, and stop.
```

```text
Concept model for printing: a desk cable clip for an 8 mm cable with a C-ring, a snap-in slot and one 4 mm screw hole. Keep every dimension named, one body, inspect once, and stop.
```

---

## Presenter rules

- Do not claim engineering certification, B-Rep, STEP, tolerances, physics or gameplay.
- Do not claim the print check measures wall thickness or slicer time; it does not.
- Do not claim a mass is exact; it is solid-volume mass at 100% infill.
- Do not fake a print or a time-lapse. Use a visible `×8` card and keep the result real.
- If the agent takes too long, press **Stop**, use the inspector or the starter library, and keep the story moving.
- If the printer is unavailable, show the sliced preview and a pre-printed sample; label it “prototype print.”
- Keep the real URL on screen at the end: `https://cadgo-3d.vercel.app/`.
- Do not use a stale tab; reload the landing page and the studio before recording.

## Video metadata

**Title:** Cadgo — one measurement to a printed replacement part  
**Description:** A real maker workflow: measure a missing furniture foot, turn it into editable parametric CAD with Cadgo, edit it with an agent, run a watertight/overhang/bed-fit print check, export the STL and print the replacement. Concept 3D, local-first, open source.  
**Short caption:** Measure it. Model it. Check it. Print it.  
**Links:** https://cadgo-3d.vercel.app/ · https://github.com/bolajiev/cadgo

## Post-record checklist

- [ ] Video is under 3:00.
- [ ] The real URL is visible at the end.
- [ ] The printed part is shown fitting the real object, or the slicer preview is clearly labeled.
- [ ] No stale tabs, notifications, API keys or unrelated windows.
- [ ] The new video is saved as `docs/cadgo-print-demo.mp4` with captions beside it.
- [ ] The landing page opens logged out and the studio URL still works.
