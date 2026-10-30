# Cadgo — AI CAD part studio

**Hackathon:** Victoria VR AI Builder Hackathon 2026  
**Category:** AI-assisted 3D editing  
**Tagline:** Describe a part. Get real CAD.

## Short description

Cadgo is a browser-based AI CAD workbench that opens on a blank new part. A plain-language brief becomes editable OpenSCAD source, compiled locally with the OpenSCAD WebAssembly kernel. Parameters rebuild in the browser, the actual source is visible and editable, and every model exports as STL or SCAD. A plan-first pass, a body-count check and a compiler-repair loop keep real failures from becoming a broken result.

## Impact

CAD remains expert software, while most AI 3D tools stop at a mesh. Cadgo gives hardware teams, makers and educators a parametric starting point with editable source, real dimensions and STL/SCAD exports — a first draft that can enter a real workflow rather than a pretty dead end. The blank new-part state is deliberate: no forced demo model, no fake preview.

## What was built

- Prompt → parametric OpenSCAD source → local WASM mesh → interactive 3D.
- Chat feedback edits the current source in place; the reply reports changed lines instead of starting over.
- Top-level Customizer parameters exposed as live "Dimensions" sliders; slider edits rewrite the source and recompile locally.
- Optional "Dimensions" and "Source" inspector panels; the default stage stays open and uncluttered.
- A planner decomposes the object into real, separately manufacturable parts and lists the standards to verify; the server researches those references and shows the sources.
- Compiler-error repair and a body-count check: every declared part must be its own watertight body, so the result is a real assembly rather than a fused mesh.
- Four complete benchbook studies: knurled knob, honeycomb bracket, twisted hex vase, spur gear.
- Direct STL download of the current edited part; SCAD export and compressed share links.
- Plan → research → CAD → local compile → body-count check, with no fast fallback that can skip the quality gates.

## Generalizability

The engine is not specific to the four studies. Any OpenSCAD source can be imported; its top-level dimensions are extracted and exposed as sliders, and the compiler-repair loop works on arbitrary generated source. The same local kernel + parameter extractor + repair loop can be reused in a CAD editor, an API, or a classroom tool. STL and SCAD are standard outputs, so adoption does not require a proprietary runtime.

## How AI is used

The system is a **planning engineer + design compiler**, not a mesh generator. A first model call decomposes the brief into real parts, dimensions and a list of standards to verify. The server researches those references through a guarded web lookup and attaches the source links. A second model call writes a complete OpenSCAD program plus a bill of parts. The browser compiles it with OpenSCAD WASM; the compiler log, the connected-body count and the declared part count feed a repair pass. The gate is strict: distinct parts must remain separate bodies with clearance, and a declared part cannot disappear into a fused solid. In chat, the model receives the current source and applies the smallest coherent change; the UI reports changed lines and keeps the part manifest visible. The app opens with no preview or starter solid; a model appears only when the user generates one or explicitly opens a bench study. **New page** opens a fresh blank studio in a new tab. The model never executes code on the server. Parameters and direct code edits stay local and deterministic.

## Demo quality

Cadgo opens on a blank new part. The user can type a brief, import a `.scad`, or explicitly load a bench study; New page opens another blank studio in a new tab. The core journey — prompt, model, optional dimensions/source, direct STL download — fits on one screen with the inspector closed by default, and is designed to be recorded in under three minutes ([VIDEO.md](VIDEO.md)).

## Technical notes

- Next.js 16, React 19, React Three Fiber / three.js.
- OpenSCAD 2025 WebAssembly in a module worker: STL/OFF generation, source compile, local parameter rebuilds.
- Customizer-comment parameter extraction; source-preserving parameter updates.
- OpenCode Go OpenAI-compatible endpoint: GPT 6 Luna planner/writer, Kimi K3.1 Pro fallback.
- Compiler repair, connected-body counting and declared-part body checks.
- SSRF-guarded web research with a public-source allow path and visible citations.
- Server-only API key, per-IP rate limits, no account, browser-local share links.

## Links

- Repository: https://github.com/bolajiev/cadgo
- Live demo: https://cadgo.vercel.app
- Video: `<add video URL>`

## Credits

OpenSCAD / openscad-wasm (GPL-2.0-or-later), CADAM (GPL-3.0) for the WASM distribution and source offer, Manifold (Apache-2.0), three.js / React Three Fiber / Next.js (MIT), GPT 6 Luna and Kimi K3.1 Pro via OpenCode Go. The drafting visual system is informed by the Anatomy skill (MIT). All model renders and studies are generated by Cadgo.
