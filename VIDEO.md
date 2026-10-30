# Demo video — 3 minutes

Target length: **2:35**. Record the production build at 1440×900 or 1920×1080. Pre-warm the studio with the exact prompts before recording. Use the benchbook if a live draft runs long.

## Shot list

**0:00–0:15 — The problem**
- Open the part studio on its blank new-part state. Click **Benchbook**, then **Knurled control knob**.
- Voice: “Text-to-3D usually stops at a pretty mesh. Real CAD needs editable dimensions, code and a file you can manufacture. Cadgo turns plain language into that.”

**0:15–0:45 — Parameters are real**
- Drag **Overall diameter** and **Height** on the knob. The part recuts locally; point at the envelope and compile readout.
- Open the **Source** tab. Show the source. Click *Edit code*, change a dimension, compile.
- Voice: “This is OpenSCAD compiled in the browser. The sliders rewrite the actual source, so the code and the model cannot disagree.”

**0:45–1:10 — Generate a new part**
- Type: `A 100 x 60 x 8 mm mounting plate with four 5 mm corner holes and rounded corners, one watertight solid`
- Press **Generate**. Show the busy state.
- When it lands: orbit; open **Dimensions**; change the corner radius and hole diameter.
- Voice: “DeepSeek writes a complete OpenSCAD program. The local kernel compiles it. If the code fails, the compiler log goes back to the model for a repair; floating parts get the same treatment.”

**1:10–1:35 — Chat to edit**
- In the chat input below the messages, type: `Make the corner radius 12 mm and add a second pair of holes.`
- Press **Send**. Show the model changing and the reply note **“Edited in place · N lines changed.”**
- Voice: “This is the important part. Feedback is not a new generation; the agent edits the current source. It reports exactly how many lines changed.”

**1:35–1:50 — The benchbook**
- Click **Benchbook**, then **Honeycomb angle bracket**, **Twisted hex vase**, **Spur gear**. Show the parameters changing.
- Voice: “Four proven studies load instantly. They are real OpenSCAD programs, not screenshots. Named standards can trigger a guarded reference lookup for missing dimensions.”

**1:50–2:10 — Export and share**
- Export **STL**; show the toast. Export **SCAD**. Copy a share link.
- Voice: “STL for the slicer, SCAD for the source, a share link that carries the code. No account.”

**2:10–2:25 — Bring your own source**
- Click **Import .scad** and load one of the benchbook files (or paste source in the code tab); show the dimensions becoming sliders.
- Voice: “The engine is not tied to these demos. Any OpenSCAD source you already have becomes parametric.”

**2:25–2:35 — New page / close**
- Click **New page**; a blank studio opens in a new tab. Point at the empty stage.
- Voice: “No starter model, no forced example. A clean sheet every time. Cadgo — describe a part, get real CAD.”
- On-screen: repo URL · live demo URL · Victoria VR AI Builder Hackathon 2026.

## Prep checklist

- Use the production URL, a clean profile, no dev tools or Next.js badge.
- Pre-warm the plate prompt before recording; the live model usually answers in a few seconds to ~40 seconds. Show the chat edit after it lands.
- Keep the cursor slow; pause on each state.
- Show the actual OpenSCAD source; do not hide the code.
- Record a 1080p MP4 under 3 minutes; check audio and captions.
- Do not show API keys, terminals or `.env.local`.

## Backup flow

If the live drafter is slow, use the benchbook and show the same parameter/code/export flow. Do not fake a generation result.
