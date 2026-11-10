# Cadgo — AI 3D assembly studio

**Hackathon:** Victoria VR AI Builder Hackathon 2026  
**Category:** AI-assisted 3D editing  
**Tagline:** Describe a part or scene. Get editable 3D.

## Short description

Cadgo is a browser-based AI 3D assembly studio for mechanical assemblies and concept 3D scenes. A plain-language brief becomes a parametric assembly graph of reusable OpenSCAD definitions, placed instances, groups, joints and drivers. Every part compiles locally in the browser. You can select a part, edit its dimensions, source or placement, hide or lock it, and keep working while the agent builds another part; material overrides are set through the agent or the source. The output is editable source, named dimensions, separate bodies and standard exports — not a frozen mesh. CAD-grade parametric editing stays the core.

## Impact

CAD is still expert software, and most AI 3D tools stop at a mesh. Cadgo gives hardware teams, makers, educators and concept-scene creators a usable starting point: a real parametric model they can dimension, edit, inspect, drive through joints and export. The assembly tree and per-part revisions make a multi-part model editable layer by layer instead of forcing a full regeneration.

## What was built

- Unified assembly graph: groups, definitions, instances, joints, drivers, commands, undo/redo and IndexedDB autosave. The same graph backs mechanical assemblies and concept 3D scenes.
- DeepSeek V4.1 Flash agent with tools for definitions, groups, instances, drivers and joints. Every mutation carries a base revision; the user wins on conflict and the agent re-reads.
- Local OpenSCAD WASM compile pool with per-variant hash caching, progressive loading, last-good meshes, per-part metrics and compiler logs.
- CAD workspace: orthographic stage, standard views, axis gizmo, overall dimension lines, assembly tree, 3D selection, translate/rotate gizmo, isolate, group transforms and a per-part inspector.
- Per-instance parameter overrides compiled as separate variants.
- Material inspector with source-colour and override modes, colour, metalness, roughness and opacity per definition or instance.
- Print check from the compiled mesh: watertightness, overhang against a configurable limit, bed fit, solid volume and a material-density mass estimate. The same report gates STL export.
- Image reference (up to three views) and optional print setup (purpose, printer, bed, material, supports, overhang limit), available from the print-check panel; the profile gates STL export on bed overflow.
- Expression-driven motion as working logic for mechanisms and scenes: revolute, prismatic and link joints, including group joints so a complete rotor/fan subassembly spins intact; crank-angle and rotor-angle drivers; contextual motion (select a part or group and play its driver, or double-click a moving part); concept labs for a driven wind turbine, a lighthouse scene, a V8, a transparent rotary mechanism and a phase-driven humanoid walk cycle.
- Inspection sheets rendered from the assembled scene and returned to the agent as vision evidence.
- Exports: assembly STL, Scene GLB with the group hierarchy, resolved materials, driver animation clips and options for samples, duration and static export, a Part STLs ZIP with one transformed STL per visible instance plus the merged assembly, a ZIP with one editable SCAD per definition plus the assembly manifest and native document, plus `.cadgo.json`. Import `.scad` or `.cadgo.json`.
- Compressed share links, with an optional Blob/local service for assemblies above the URL limit.
- Starter library: project box cover, pipe adapter, furniture foot and desk cable clip, all parametric and audit-clean.
- Guarded server-side web research for standards, fastener dimensions, printer build volumes, material properties, compatibility, regulations and real-product dimensions; sources are shown in the transcript and treated as untrusted evidence.
- All benchbook studies pass the parametric audit; the unit/integration suite plus Playwright smoke, export and visual snapshot coverage verify the document, compile, motion, GLB, per-part STL and scene paths.

## Generalizability

The engine is not tied to a single study or to CAD alone. Any OpenSCAD source becomes a definition; instances reuse compiled geometry; the command/revision model applies to arbitrary assemblies and scenes. The same unified graph, local kernel, parameter extractor, audit, agent tools and export path can sit behind a CAD API, classroom tool, scene editor or plugin. Scene GLB exports the same assembly graph into the three.js/glTF ecosystem, so the output is usable beyond the studio.

## How AI is used

The system is an **agentic 3D assembly editor**. DeepSeek V4.1 Flash decides when to list, read, create, update, place, inspect, ask or answer; there is no fixed phase list. The same tools build mechanical assemblies and concept scenes, with joints and drivers as the working logic. Agent replies stream into the chat and render Markdown, including bold text, lists and fenced OpenSCAD blocks. If a turn hits the output limit, the agent automatically continues in smaller steps rather than stopping for a manual prompt. The client sends a compact model state plus the conversation, not the whole document, and the agent fetches only the definition it is about to change.

`create_definition` / `update_definition` enforce the parametric audit before mutating the document. The browser compiles locally and returns metrics or logs. `render_views` renders the assembly and sends the sheet back as vision evidence. User edits and agent edits are both immutable commands; each agent mutation is checked against the target revision. A conflict is returned for the agent to rebase or ask about. The model never executes geometry on the server.

## Demo quality

- Recorded demo: [FlexStand 50-second cut](docs/flexstand-demo-60s.mp4) — real agent build, edited for time, with music and captions. The physical print is still pending.
- Recorded backup: `docs/cadgo-demo.mp4` (1:21, 1280×720, silent) with captions in `docs/cadgo-demo.srt`. The real-world print walkthrough script is kept out of the public repo and is intended for the next recording.

The core journey fits on one screen: describe a part or scene, watch the agent build or edit it, adjust dimensions or source in the inspector, orbit or use standard views, drag the gizmo, then export STL, Scene GLB, Part STLs, SCAD and JSON. The agent remains usable while the user edits; questions and conflicts are non-blocking. Concept labs exercise larger assemblies, a driven wind turbine, a lighthouse scene, motion and transparent materials.

## Technical notes

- Next.js 16, React 19, React Three Fiber / three.js.
- OpenSCAD 2025 WebAssembly in a module-worker pool, Manifold backend.
- Immutable document commands with per-node revisions, undo/redo and autosave.
- SHA-256 variant cache, LRU memory cap, progressive compile and last-good meshes.
- Expression-driven joints using a restricted expression parser; no server geometry and no recompile for motion.
- Definition materials with explicit per-instance overrides; an override never mutates the shared definition.
- Scene GLB export with the group hierarchy, resolved materials and one animation clip per driver; a scene with no drivers exports static.
- Print checks are based on real mesh metrics; wall thickness and slicer time are not measured, and mass assumes 100% infill.
- Orthographic CAD stage with view gizmo, dimension annotations, transparent materials and a presentation-lighting toggle with soft shadows.
- Parametric audit extended to top-level geometry calls and external includes.
- Server-only API key, optional per-session and per-IP rate limits (disabled by default) with an optional durable Redis (Upstash or Vercel KV) store, no account, local documents. Optional large-share storage through Vercel Blob or a local `.data/shares` directory.

## Links

- Repository: https://github.com/bolajiev/cadgo
- Live studio: https://cadgo-3d.vercel.app/studio
- Landing page: https://cadgo-3d.vercel.app/

## Credits

OpenSCAD / openscad-wasm (GPL-2.0-or-later), CADAM (GPL-3.0) for the WASM distribution and source offer, Manifold (Apache-2.0), three.js / React Three Fiber / Next.js (MIT), DeepSeek V4.1 Flash via OpenCode Go. The drafting visual system is informed by the Anatomy skill (MIT). All model renders and studies are generated by Cadgo.
