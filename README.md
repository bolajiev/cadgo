# Cadgo

**Describe a part. Get real CAD.**

Cadgo is a browser-based AI CAD workbench. A plain-language brief becomes editable **OpenSCAD** source, compiled locally with the OpenSCAD WebAssembly kernel. Parameters rebuild in the browser, the source is visible and editable, and every model exports as STL or SCAD.

**Live demo:** https://cadgo.vercel.app  
**Repository:** https://github.com/bolajiev/cadgo  
**Hackathon:** Victoria VR AI Builder Hackathon 2026 · **AI-assisted 3D editing**

![Cadgo part studio](docs/studio.png)

## What it does

- **Prompt → parametric CAD.** Write “a 100 × 60 × 8 mm mounting plate with four 5 mm corner holes and rounded corners.” Cadgo writes OpenSCAD, compiles it in the browser, and exposes its dimensions as sliders.
- **Local parameter rebuilds.** Move a slider and the model recompiles in the browser. No AI round-trip, no server geometry.
- **Compiler repair.** If generated code does not compile, the compiler log goes back to the model for a fix. Detached floating solids are detected and repaired too.
- **Editable source.** The OpenSCAD panel shows and edits the actual source. Download the `.scad` or the `.stl`.
- **Fast fallback.** DeepSeek V4.1 Flash is the default design compiler; a GLM-5.3 Flash fast pass can answer first when the primary is slow. The compiler error loop is the quality gate.
- **Benchbook.** A knurled knob, honeycomb bracket, twisted vase and spur gear load instantly and stay fully parametric.
- **Mechanism lab.** The original jointed-assembly workbench lives at `/mechanism`: multi-part CadSpecs, real hinges and sliders, motion timelines, exploded views, BOM, STL/GLB and an ink-on-paper plate.

![Prompt and benchbook](docs/studio-panel.png)

## How it works

```
brief ──► DeepSeek V4.1 Flash ──► OpenSCAD source ──► local OpenSCAD WASM compile
              │   (GLM fast pass)                         │
              │                                            ├─ mesh + colours
              └─► compiler log / detached-part repair ◄────┘
                                                           │
                                             parameters ◄──┤
                                                           └──► STL / SCAD / share
```

The model writes a data-only OpenSCAD program through a tool call. The server never compiles or executes it; the browser does, in a module worker. Parameters are top-level Customizer variables:

```scad
// Overall diameter
diameter = 42; // [24:70]
```

Changing a slider rewrites that value in the source and recompiles locally. The source and the sliders can never disagree.

The mechanism lab uses a different engine: a validated CadSpec compiled with Manifold, plus a joint solver for revolute/prismatic joints.

## Run locally

```sh
npm install
cp .env.example .env.local
# add OPENCODE_GO_API_KEY
npm run dev
```

Open `http://localhost:3000`. The part studio is `/`; the mechanism lab is `/mechanism`.

| variable | default | purpose |
|---|---|---|
| `OPENCODE_GO_API_KEY` | — | server-side key; never sent to the browser |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible endpoint |
| `OPENCODE_GO_MODEL` | `deepseek-v4.1-flash` | primary design compiler |
| `OPENCODE_GO_FALLBACK_MODEL` | `glm-5.3-flash` | fast parallel pass / fallback |

### Checks

```sh
npm test                 # expression, schema, pose and OpenSCAD parameter tests
npm run typecheck
npm run check:examples   # compile the four mechanism-lab studies
npm run build
```

## Try this

1. Load the **Knurled control knob** and drag *Overall diameter* / *Height*.
2. Open **OpenSCAD** and read the source; click *Edit code* and compile a change.
3. Prompt: **“A honeycomb angle bracket with 90 mm flanges, 5 mm plate, four M5 holes and rounded corners.”**
4. Download **STL** and **SCAD** from Export.
5. Open **Mechanism lab**, drag the lamp’s elbow ring and press play.

If a live draft is slow, use the benchbook. The examples are complete OpenSCAD programs, not cached screenshots, and every parameter is live.

## Limits

- The part studio exports **STL and SCAD**; it is a mesh/OpenSCAD workflow, not a STEP/B-rep kernel.
- The AI can produce a weak design. The compiler, the detached-solid check and the repair loop catch structural failures, not every bad engineering decision.
- OpenSCAD WASM is a ~9 MB first load. It is cached by the browser; the first compile wakes it.
- No account or cloud project database. Share links carry the source in the URL fragment.
- The mechanism lab is a separate, heavier workflow (Manifold + joint solving) and is not required for part editing.

## Built with

Next.js 16, React 19, React Three Fiber, three.js, **OpenSCAD WebAssembly**, Zustand, Zod, Vercel. The mechanism lab additionally uses manifold-3d. The design compiler uses an OpenAI-compatible endpoint (DeepSeek V4.1 Flash / GLM-5.3 Flash via OpenCode Go).

The paper-and-ink plate language was informed by the [Anatomy](https://github.com/wheresryan22/anatomy) craft rules. The OpenSCAD WASM distribution and its source offer come from [CADAM](https://github.com/Adam-CAD/CADAM); see [THIRD_PARTY.md](THIRD_PARTY.md).

## License

**GPL-3.0.** The app distributes the OpenSCAD WebAssembly build, which is GPL-2.0-or-later; the combined distribution is GPL-3.0. See [LICENSE](LICENSE) and `public/openscad/SOURCE-OFFER.txt`.

## Submission

- [Demo video script](VIDEO.md)
- [Written submission](SUBMISSION.md)
- Category: **AI-assisted 3D editing**
