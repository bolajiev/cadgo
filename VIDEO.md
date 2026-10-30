# Demo video — 3 minutes

Target length: **2:45**. Record at 1440×900 or 1920×1080, browser zoom 100%. Use the production build, not the dev server. Pre-warm the drafter with the exact prompts before recording; if a live draft runs long, use the cached response or the benchbook.

## Shot list

**0:00–0:20 — The problem**
- Open on the Cadgo landing page.
- Voice: “CAD software is built for experts. AI 3D tools can make a pretty mesh, but a mesh does not work. Cadgo generates the parts, the joints, and the logic that makes a mechanism move.”

**0:20–0:45 — Describe a mechanism**
- Type: `A compact desk lamp with a heavy round base, two hinged arms, a conical shade and brass joints, 300 mm reach`
- Press **Draft it**. Show the loading card, elapsed clock and stages for a beat.
- When the lamp lands, orbit once; let the brass hinges and shade read.
- Voice: “A plain-language brief becomes a CadSpec: named parts, millimetres, materials, a joint graph and a demo motion. The LLM writes data, never code.”

**0:45–1:20 — It moves**
- Drag the shoulder joint ring. The arm follows.
- Click **Play**. Let the fold run for 2–3 seconds.
- Select **Upper arm** in Parameters and move the slider; the geometry recuts locally. Point at the updated mass/volume.
- Voice: “This is the part a static generator cannot do. Drag a hinge, scrub a motion, or change a dimension and watch only the geometry recut — no AI round-trip.”

**1:20–1:55 — Keep shaping it**
- Load the lamp (or the camera slider if using the live demo).
- In the Brief, type: `Widen the base 20% and add a cable hole at the back.` Show the revised model.
- Select the base, click **Cut a hole**, click the top face, set Ø 8 mm, cut. Show the hole and the new note.
- Voice: “Conversation changes the spec. Face-level edits are deterministic: a pick, a diameter, a real boolean. The result survives parameter changes and exports.”

**1:55–2:20 — Take it out**
- Toggle **Explode**. Let it sit.
- Toggle **Plate**. Show the ink-on-paper study.
- Open **Export**; show STL, GLB, CadSpec, Plate PNG and Share. Download the STL (or point at the toast).
- Voice: “Watertight STL and GLB, the editable CadSpec, a drawing plate, or a share link. The browser is the whole workbench.”

**2:20–2:35 — The pipeline**
- Cut to the benchbook / a quick architecture card (optional).
- Voice: “DeepSeek V4.1 Flash or GLM writes a validated CadSpec. Manifold builds solids. A joint solver poses them. If a draft fails, Cadgo repairs it or falls back to a proven study — the demo never dead-ends.”
- Show the four benchbook cards.

**2:35–2:45 — Close**
- Return to the landing title.
- Voice: “Cadgo. Say it, shape it, set it in motion.”
- On-screen: https://github.com/bolajiev/cadgo · https://cadgo.vercel.app · “Victoria VR AI Builder Hackathon 2026”.

## Prep checklist

- Use the production URL and a clean browser profile; hide bookmarks and dev tools.
- Warm the cache with the lamp prompt and the edit prompt before recording.
- Record at 60 fps; the joint motion and plate transitions are the visual moments.
- Keep the cursor movements slow; pause 0.5 s on each state.
- Do not show the Next.js dev badge, terminal, or API keys.
- Export a 1080p MP4 under 3 minutes; verify audio levels and captions.

## Backup flow (if the live drafter is slow)

Use the benchbook lamp, then show the same edit and hole flow. The AI generation can be represented by the loading card + the four pre-generated studies; do not fake a live result. The story is the spec, the joints and the deterministic edits.
