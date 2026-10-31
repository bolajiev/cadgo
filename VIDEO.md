# Demo video — 3 minutes

Target length: **2:35**. Record the production build at 1440×900 or 1920×1080. Pre-warm the studio with the exact prompts before recording. Use the benchbook if a live draft runs long.

## Shot list

**0:00–0:15 — The problem**
- Open the part studio on its blank new-part state. Click **Benchbook**, then **Knurled control knob**.
- Voice: “Text-to-3D usually stops at a pretty mesh. Real CAD needs editable dimensions, code and a file you can manufacture. Cadgo turns plain language into that.”

**0:15–0:45 — Parameters are real**
- Open **Dimensions** (optional button). Drag **Overall diameter** and **Height**; the part recuts locally. Point at the envelope and compile readout.
- Optionally open **Source** briefly to show the actual OpenSCAD; close it. Click *Edit code*, change a dimension, compile.
- Voice: “This is OpenSCAD compiled in the browser. The sliders rewrite the actual source, so the code and the model cannot disagree.”

**0:45–1:10 — Generate a new part**
- Type: `A 100 x 60 x 8 mm mounting plate with four 5 mm corner holes and rounded corners, one watertight solid`
- Press **Generate**. Show the busy state.
- When it lands: orbit; open **Dimensions** (optional); change the corner radius and hole diameter.
- Voice: “Cadgo plans the real parts, checks the standards it needs, then writes the OpenSCAD. The local kernel compiles it and checks that every declared part stayed a separate body. Failures go back for a repair.”

**1:10–1:35 — Chat to edit**
- In the chat input below the messages, type: `Make the corner radius 12 mm and add a second pair of holes.`
- Press **Send**. Show the model changing and the reply note **“Edited in place · N lines changed.”**
- Voice: “This is the important part. Feedback is not a new generation; the agent edits the current source. It reports exactly how many lines changed.”

**1:35–1:50 — Image reference and print setup**
- Attach a clean photo of a simple part with a ruler or known dimension.
- Show the **Agent setup** card: choose 3D printing, enter the printer and bed size. Point at the research sources for the printer.
- Voice: “The agent asks for the process and the bed, researches the printer, and only then writes the CAD. No silent guesses.”

**1:50–2:05 — Visual check**
- Show the render check against the reference, then open **Dimensions** and the **Part manifest**.
- Voice: “It compiles locally, then checks its own render against the reference. A correction that breaks the part check is rejected.”

**2:05–2:20 — The benchbook**
- Click **Benchbook**, then **Honeycomb angle bracket**, **Twisted hex vase**, **Spur gear**. Show the parameters changing.
- Voice: “Four proven studies load instantly. They are real OpenSCAD programs, not screenshots. Named standards trigger a guarded research pass, and the sources are shown beside the reply.”

**2:20–2:35 — Export and share**
- Click **Download** (STL) in the header; show the toast. Open **Export** for SCAD and the share link.
- Voice: “The header download gives the edited part as STL. The optional export also carries the source and a share link. No account.”

**2:35–2:45 — Bring your own source**
- Click **Import .scad** and load one of the benchbook files (or paste source in the code tab); show the dimensions becoming sliders.
- Voice: “The engine is not tied to these demos. Any OpenSCAD source you already have becomes parametric.”

**2:45–2:50 — New page / close**
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
