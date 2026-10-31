# Cadgo

**Describe a part. Get real CAD.**

Cadgo is a browser-based AI CAD workbench. A plain-language brief becomes editable **OpenSCAD** source, compiled locally with the OpenSCAD WebAssembly kernel. Parameters rebuild in the browser, the source is visible and editable, and every model exports as STL or SCAD.

**Live demo:** https://cadgo-ashy.vercel.app  
**Repository:** https://github.com/bolajiev/cadgo  
**Hackathon:** Victoria VR AI Builder Hackathon 2026 · **AI-assisted 3D editing**

The app opens on a **blank new part** — no hardcoded preview. **New page** opens another blank studio in a new tab.

![Cadgo part studio with a bench study loaded; Dimensions and Source stay optional](docs/studio.png)

## What it does

- **Prompt → parametric CAD.** Write “a 100 × 60 × 8 mm mounting plate with four 5 mm corner holes and rounded corners.” Cadgo writes OpenSCAD, compiles it in the browser, and exposes its dimensions as sliders.
- **Image → parametric CAD.** Attach a photo or render. The agent asks what it is for, asks for the printer and bed size when relevant, and uses the image as a geometric reference. It is a printable approximation, not a pixel-perfect scan.
- **Print setup + research.** The agent asks purpose, printer, bed, material and supports; it researches the printer's build volume and FDM constraints and treats the bed as a hard envelope.
- **Visual check.** After compiling, Cadgo renders the model and sends the render plus the reference image back through DeepSeek vision. The inspector must fix visible mismatches or the correction is rejected if it breaks the body check.
- **Chat to edit.** Reply in the same thread; the agent revises the current source instead of starting over. The reply reports how many lines changed.
- **Local parameter rebuilds.** Move a slider and the model recompiles in the browser. No AI round-trip, no server geometry.
- **Build checks.** If generated code does not compile, the compiler log goes back to the model. The kernel also counts connected bodies; every declared part must be a separate watertight body, or the model gets a quality-repair pass.
- **Research before drawing.** A planning pass lists every real part and the standards/missing dimensions to verify. The server searches for those references and shows the sources beside the reply; if a lookup fails, the assumption is stated.
- **Parametric audit.** Generated source is checked before it is accepted. Every driving number inside a module must be a named top-level parameter or derived value; hardcoded dimensions are sent back for repair. See [AGENTS.md](AGENTS.md).
- **Optional inspector.** Dimensions and Source are buttons, not default panels. The stage keeps the space; open the inspector only when you need a slider or the code.
- **Direct download.** The header's Download button saves the current, edited part as STL. Source export and share links live in Export.
- **Plan-first quality pass.** DeepSeek V4.1 Flash decomposes the object into real parts, researches the printer/standards, writes OpenSCAD, then checks the render against the reference. The deliberate path has no fast model fallback and no fused assemblies. Compiler, body-count and visual gates are the checks.
- **Benchbook.** A knurled knob, honeycomb bracket, twisted vase and spur gear load instantly and stay fully parametric.

![The blank new-part state, prompt composer and benchbook entry point](docs/studio-panel.png)

## Why it matters

CAD is still expert software. AI 3D tools usually return a pretty mesh that cannot be dimensioned, edited or manufactured. Cadgo returns the thing a hardware team actually needs: **editable source, named dimensions, a local kernel and a manufacturable export**.

- **Who benefits:** hardware teams prototyping fixtures and brackets, makers without CAD training, educators teaching parametric design, and engineers who want a fast first draft they can take into their real toolchain.
- **Why now:** browser WebAssembly makes a real CAD kernel local and private; LLMs are now good at writing OpenSCAD; the missing piece was a reliable design-spec → compile → repair loop. That is what Cadgo adds.
- **Adoption path:** the output is standard `.scad` and `.stl`, not proprietary state. A team can adopt it beside an existing CAD workflow on day one.

## Beyond the demo

The engine is not tied to the four studies.

- **Bring your own source:** import any `.scad`; top-level dimensions become sliders immediately.
- **Bring your own data:** the OpenSCAD source is visible and editable; the generated program is the artifact, not hidden model state.
- **Reusable compiler loop:** the same parameter extractor, research pass, compiler repair, body-count check and local worker can sit behind any CAD UI, API or classroom tool.
- **Any part, not one niche:** the benchbook spans a knob, a bracket, a vase and a gear; the prompt path is not limited to those categories.
- **Export:** `.stl` for printing and `.scad` for the source; no lock-in.

## How it works

```
brief ──► planner: parts + dimensions + lookups
              │
              ├─► reference research (real sources, shown in chat)
              │
              ▼
        CAD writer: DeepSeek V4.1 Flash ──► OpenSCAD source ──► local OpenSCAD WASM compile
              ▲                                           │
              │                                           ├─ mesh + colours + body count
              └─► compiler / body-count repair ◄──────────┤
                                                          │
                                            parameters ◄──┤
                                                          └──► STL / SCAD / share
```

The planner writes a design intent; the server researches its reference queries; the CAD writer turns that into a data-only OpenSCAD program and a bill of parts. The server never compiles or executes the source; the browser does, in a module worker. Parameters are top-level Customizer variables:

```scad
// Overall diameter
diameter = 42; // [24:70]
```

Changing a slider rewrites that value in the source and recompiles locally. The source and the sliders can never disagree.

## Run locally

```sh
npm install
cp .env.example .env.local
# add OPENCODE_GO_API_KEY
npm run dev
```

Open `http://localhost:3000`. The part studio is `/` and starts on a blank new part — no starter model. Use **New page** or the empty-state button to open a fresh studio in a new tab.

| variable | default | purpose |
|---|---|---|
| `OPENCODE_GO_API_KEY` | — | server-side key; never sent to the browser |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible endpoint |
| `OPENCODE_GO_DESIGN_MODEL` | `deepseek-v4.1-flash` | planner and CAD writer |

### Checks

```sh
npm test                 # expression, schema, pose and OpenSCAD parameter tests
npm run typecheck
npm run build
```

## Try this

1. Load the **Knurled control knob** and drag *Overall diameter* / *Height*.
2. Open the optional **Source** inspector, read the code and compile a change. Open **Dimensions** for the sliders.
3. Prompt: **“A honeycomb angle bracket with 90 mm flanges, 5 mm plate, four M5 holes and rounded corners.”**
4. Click **Download** for the current STL; use **Export** for SCAD and the share link.
5. Use **Import .scad** to bring an existing OpenSCAD source; its dimensions become sliders.
6. Use **New page** to open a blank studio in a new tab.

The app opens blank. Loading a bench study or generating a part is an explicit action; the examples are complete OpenSCAD programs, not cached screenshots, and every parameter is live.

## Limits

- The part studio exports **STL and SCAD**; it is a mesh/OpenSCAD workflow, not a STEP/B-rep kernel.
- The AI can produce a weak design. The body-count check and the repair loop catch structural failures, not every bad engineering decision.
- OpenSCAD WASM is a ~9 MB first load. It is cached by the browser; the first compile wakes it.
- No account or cloud project database. Share links carry the source in the URL fragment.

## Judging alignment

- **Impact (30%):** turns natural language into an editable, exportable CAD starting point for hardware teams, makers and educators; standard STL/SCAD output fits existing workflows.
- **Generalizability (25%):** OpenSCAD import, source-preserving parameter extraction and a reusable compile/repair engine apply to arbitrary parametric parts, not just the benchbook.
- **Technical depth (20%):** local OpenSCAD WebAssembly kernel, module worker, parameter extraction, compiler repair, separate-part body checks, deterministic local rebuilds, binary STL writer, SSRF-guarded reference lookup, tests.
- **Demo quality (25%):** blank new-part start, image + print setup, visible research, plan, render and visual repair, one-screen chat → model → optional dimensions/source → direct STL download; the shot list is in [VIDEO.md](VIDEO.md).

## Built with

Next.js 16, React 19, React Three Fiber, three.js, **OpenSCAD WebAssembly**, Zustand, Zod, Vercel. The design engine uses an OpenAI-compatible endpoint (DeepSeek V4.1 Flash via OpenCode Go).

The paper-and-ink plate language was informed by the [Anatomy](https://github.com/wheresryan22/anatomy) craft rules. The OpenSCAD WASM distribution and its source offer come from [CADAM](https://github.com/Adam-CAD/CADAM); see [THIRD_PARTY.md](THIRD_PARTY.md).

## License

**GPL-3.0.** The app distributes the OpenSCAD WebAssembly build, which is GPL-2.0-or-later; the combined distribution is GPL-3.0. See [LICENSE](LICENSE) and `public/openscad/SOURCE-OFFER.txt`.

## Submission

- [Demo video script](VIDEO.md)
- [Written submission](SUBMISSION.md)
- Category: **AI-assisted 3D editing**
