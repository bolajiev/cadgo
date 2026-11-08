# Current state and gaps

## What exists

- Blank “New part” studio, chat, benchbook, `.scad` import.
- Image upload, print setup card, known-scale field.
- DeepSeek V4.1 Flash planner/writer, web research and printer lookup.
- Local OpenSCAD WASM compile; source editor; named parameter sliders.
- Compiler repair, body-count checks, parameterization audit, one visual review pass.
- Separate-body BOM quantities; direct STL/SCAD/share.
- Responsive interface and a hosted demo.
- 14 unit tests; typecheck and production build pass.

See `components/studio/*`, `lib/studio/*`, `lib/ai/*`, `lib/scad/*`, `app/api/studio/*`.

## What is missing or weak

| Area | Gap | Consequence |
|---|---|---|
| Scale | Known scale is optional free text; bed is prefilled | A single photo can produce the wrong real-world size |
| Print intake | Setup is forced only with an image; prompt-only print requests can skip bed/printer | Contradicts the product story |
| Image workflow | One image; no crop/rotate/multi-view; image cannot be added once code exists | Weak geometry and poor image iteration |
| Agent | Setup is a static form; no true `ask_user`, pause/resume or visible plan | Feels less capable than a real CAD agent |
| Reasoning | DeepSeek thinking is disabled | Faster, but weaker design reasoning |
| Visual check | Runs only on first image generation; not visible; failures swallowed | Strong claim is not demoable or trustworthy |
| Parameter audit | Regex-based, scope-limited, non-blocking after repairs, not run on imports/manual edits | “Fully parametric” is inconsistent |
| Benchbook | Examples contain hidden literals | Contradicts the no-hardcode rule |
| Printability | Body count is not manifold proof; no overhang, wall, support or orientation check; bed is warning-only | “Printable” is not substantiated |
| Export | One STL for all bodies; no per-part export, BOM export or 3MF | Multi-part workflow is incomplete |
| Persistence | No save, undo, revert or cancel | Fragile demo; refresh loses work |
| Reliability | Review payload can exceed Vercel limits; in-memory rate limits; no global budget | Judge prompts can trigger failures |
| QA | Most tests cover legacy mechanism code; no E2E, golden set or CI | No regression protection for the studio |
| Ops | No monitoring/analytics; privacy copy says nothing is uploaded although prompts/images go to the provider | Trust and debugging risk |
| Submission | No video URL; legacy mechanism routes still built; env/docs contradictions | Weak judging surface |

## Claims that currently conflict with reality

1. “No model fallback” vs the old `.env.example` fallback.
2. “Agent asks for printer/bed” vs prompt-only print generation skipping setup.
3. “Hardcoded dimensions are rejected” vs acceptance after two repairs and non-blocking audit.
4. “Benchbook fully parametric” vs hidden literals.
5. “Watertight” vs connected-component counting only.
6. “Nothing is uploaded” vs images/prompts/renders being sent to the model provider.
7. “Visual check after compiling” vs only the first image generation and no visible result.
8. “Import any `.scad` and dimensions become sliders” vs literal-only top-level parser.

## Priority

**P0 before demo:** compliance, scale gate, printability gate, per-part export, visible visual check, plain-language demo path, physical print, video.

**P1:** undo/cancel/persistence, multi-view/crop, exact numeric entry, golden set/CI, monitoring, durable rate limits, docs/privacy corrections, legacy cleanup.

**P2:** 3MF with objects, orientation/support analysis, slicer validation, STEP, hybrid image-to-mesh.
