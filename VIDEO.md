# Demo video — 3 minutes

Target length: **2:45**. Record the production build at 1440×900 or 1920×1080. Pre-warm the studio with the exact prompts before recording. Use the benchbook if a live draft runs long.

## Shot list

**0:00–0:15 — The problem**
- Open on the part studio with the knurled knob already on the bench.
- Voice: “Text-to-3D usually stops at a pretty mesh. Real CAD needs editable dimensions, code and a file you can manufacture. Cadgo turns plain language into that.”

**0:15–0:45 — Parameters are real**
- Drag **Overall diameter** and **Height** on the knob. The part recuts locally; point at the envelope and compile readout.
- Open the **OpenSCAD** tab. Show the source. Click *Edit code*, change a dimension, compile.
- Voice: “This is OpenSCAD compiled in the browser. The sliders rewrite the actual source, so the code and the model cannot disagree.”

**0:45–1:25 — Generate a new part**
- Type: `A 100 x 60 x 8 mm mounting plate with four 5 mm corner holes and rounded corners, one watertight solid`
- Press **Generate**. Show the busy state.
- When it lands: orbit; open Parameters; change the corner radius and hole diameter.
- Voice: “DeepSeek writes a complete OpenSCAD program. The local kernel compiles it. If the code fails, the compiler log goes back to the model for a repair; floating parts get the same treatment.”

**1:25–1:50 — The benchbook**
- Click **Honeycomb angle bracket**, then **Twisted hex vase**, then **Spur gear**. Show the parameters changing.
- Voice: “Four proven studies load instantly. They are real OpenSCAD programs, not screenshots.”

**1:50–2:15 — Export and share**
- Export **STL**; show the toast. Export **SCAD**. Copy a share link.
- Voice: “STL for the slicer, SCAD for the source, a share link that carries the code. No account.”

**2:15–2:35 — The mechanism lab**
- Open **Mechanism lab**. Load the Springline lamp. Drag the shoulder ring; press play; explode.
- Voice: “For things that move, the mechanism lab adds a joint graph, a motion timeline and a BOM — the same CAD discipline, with working logic.”

**2:35–2:45 — Close**
- Return to the part studio, knob on the bench.
- Voice: “Cadgo. Describe a part. Get real CAD.”
- On-screen: repo URL · live demo URL · Victoria VR AI Builder Hackathon 2026.

## Prep checklist

- Use the production URL, a clean profile, no dev tools or Next.js badge.
- Pre-warm the plate prompt before recording; the live model usually answers in 15–40 seconds.
- Keep the cursor slow; pause on each state.
- Show the actual OpenSCAD source; do not hide the code.
- Record a 1080p MP4 under 3 minutes; check audio and captions.
- Do not show API keys, terminals or `.env.local`.

## Backup flow

If the live drafter is slow, use the benchbook and show the same parameter/code/export flow. Do not fake a generation result.
