# Cadgo

**Describe a part or scene. Get editable 3D.**

Cadgo is a browser-based AI 3D assembly studio for mechanical parts, mechanisms and concept scenes. A plain-language brief becomes a parametric assembly graph: reusable OpenSCAD definitions, placed instances, groups, joints and drivers. Every part compiles locally in the browser, and every dimension stays editable.

[Live studio](https://cadgo-3d.vercel.app/studio) · [Landing page](https://cadgo-3d.vercel.app/) · [50-second demo](docs/flexstand-demo-60s.mp4) · [Repository](https://github.com/bolajiev/cadgo)

[![Cadgo assembly studio](docs/studio.png)](https://cadgo-3d.vercel.app/studio)

## Demo

[Watch the 50-second FlexStand build](docs/flexstand-demo-60s.mp4) — a real agent build, speed-ramped and edited for time. It covers the build, refinement, editable parameters, print check and driver showcase. The physical print is still pending and is labelled as such.

Earlier humanoid backup: [`docs/cadgo-demo.mp4`](docs/cadgo-demo.mp4).

## Why Cadgo

Most AI 3D tools stop at a pretty mesh. Cadgo keeps the model editable:

- **Real parametric geometry** — the agent writes OpenSCAD source with named top-level dimensions, not a one-off voxel or image.
- **Local compilation** — OpenSCAD WebAssembly runs in browser workers. The server proxies the AI and research; it never executes geometry.
- **One assembly graph** — parts, instances, groups, transforms, joints and drivers share the same document model for mechanical assemblies and concept scenes.
- **Edit while the agent works** — select a part, change a dimension, move it, hide it or edit its source while the agent continues. Revisions prevent silent conflicts.
- **Standard outputs** — STL, Part STLs, Scene GLB with driver clips, editable SCAD, `.cadgo.json` and share links.

## Features

### Agent and modelling
- DeepSeek V4.1 Flash agent with tool calling, optional reference images and inspection renders.
- Creates and edits definitions, instances, groups, joints and drivers.
- Writes editable OpenSCAD source with named parameters and keeps dimensions in the inspector.
- Compiles, inspects orthographic views and corrects compile or geometry errors.
- Optional guarded web research for standards, fasteners, printer volumes and material data, with sources shown in the transcript.

### Studio
- Three.js / React Three Fiber stage with orthographic views, dimension lines, axis gizmo and presentation lighting.
- Assembly tree, property inspector, transform gizmo, isolate, visibility, locking and suppression.
- Per-instance parameter overrides and material overrides without changing the shared definition.
- Per-node revisions, immutable commands, undo/redo and agent/user conflict handling.
- Driver animations for rotors, beacons, V8 studies and other mechanism concepts.

### Print and export
- Print check for watertightness, overhang, bed fit, solid volume and material-mass estimate.
- Configurable printer, bed, material, supports and overhang warning limit.
- Assembly STL, one STL per visible instance, Scene GLB with animation clips, SCAD bundle, `.cadgo.json` and compressed share links.
- Import `.scad` as a new part or `.cadgo.json` to restore an assembly.
- Autosave to IndexedDB; optional Blob or local storage for large share links.

### Benchbook and labs
- Fully parametric mounting plate, honeycomb bracket, knurled knob, spur gear, project box cover, pipe adapter, furniture foot and desk cable clip.
- Concept labs: driven wind turbine, lighthouse scene, V8, transparent rotary mechanism and phase-driven humanoid walk cycle.

## How it works

```text
prompt / image / print setup
            │
            ▼
DeepSeek V4.1 Flash agent
  tools: create/update definition, place instance, group,
         joint, driver, compile, inspect, research
            │
            ▼
immutable assembly document  ──►  IndexedDB autosave
            │
            ▼
OpenSCAD WASM compile pool
  browser workers · source + parameter hash cache
            │
            ▼
three.js stage · tree · inspector · motion · print check
            │
            ▼
STL · Scene GLB · Part STLs · SCAD · .cadgo.json · share
```

The server is a model proxy. It never executes geometry. OpenSCAD runs in the browser.

## Tech stack

| Layer | Used |
|---|---|
| App | Next.js 16, React 19, TypeScript 5.9 |
| 3D | three.js 0.186, React Three Fiber 9, Drei 10 |
| CAD | OpenSCAD 2025.03.25 WASM, Manifold 3.5.4 |
| AI | DeepSeek V4.1 Flash via OpenCode Go (OpenAI-compatible API); no model fallback |
| State/data | Zustand, Zod, IndexedDB, lz-string, fflate, jsonrepair |
| Hosting | Vercel; optional Vercel Blob and Upstash |
| Testing | Vitest, Playwright |
| Demo media | screen recording; locally generated music; guide voice via edge-tts / Microsoft neural TTS |

## Getting started

Requirements: Node.js 20.10+.

```sh
npm install
cp .env.example .env.local
# add OPENCODE_GO_API_KEY to .env.local
npm run dev
```

- Landing page: `http://localhost:3000/`
- Studio: `http://localhost:3000/studio`

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENCODE_GO_API_KEY` | — | Server-side AI key; never sent to the browser |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | OpenAI-compatible endpoint |
| `OPENCODE_GO_DESIGN_MODEL` | `deepseek-v4.1-flash` | Agent and vision model |
| `BRAVE_SEARCH_API_KEY` | — | Optional Brave Search key |
| `TAVILY_API_KEY` | — | Optional Tavily key |
| `SERPER_API_KEY` | — | Optional Serper key |
| `WEB_SEARCH_PROVIDER` | — | Preferred research provider |
| `CADGO_AGENT_MAX_TOKENS` | `24000` | Agent output cap |
| `CADGO_AGENT_REASONING_EFFORT` | — | Optional `low`, `medium` or `high` |
| `CADGO_AGENT_RATE_LIMIT` | `0` | Optional per-session request limit; `0` disables |
| `CADGO_AGENT_RATE_WINDOW_MS` | `3600000` | Rate-limit window |
| `CADGO_AGENT_IP_RATE_LIMIT` | `0` | Optional per-IP request limit; `0` disables |
| `UPSTASH_REDIS_REST_URL` | — | Optional durable rate-limit store |
| `UPSTASH_REDIS_REST_TOKEN` | — | Optional durable rate-limit token |
| `BLOB_READ_WRITE_TOKEN` | — | Optional large-share storage |
| `CADGO_SHARE_DIR` | `.data/shares` | Local large-share directory |
| `CADGO_SHARE_TTL_DAYS` | `30` | Large-share expiry |

Without a durable rate-limit store, limits are in-process and suitable for local or single-instance use. Agent rate limits default to disabled.

## Scripts

```sh
npm run dev          # development server
npm run build        # production build
npm run start        # production server
npm run typecheck    # TypeScript
npm test             # Vitest
npm run test:e2e     # build + Playwright
```

## Repository layout

```text
app/          Next.js routes and API handlers
components/   Studio, stage, inspector, agent chat and UI
lib/          document model, compiler, agent tools, print checks, research
public/       OpenSCAD/Manifold WASM, landing assets
tests/        Vitest and Playwright tests
docs/         screenshots, deployment notes, demo assets and attribution
```

## Screenshots

| Studio | Concept scene |
|---|---|
| ![Assembly tree and inspector](docs/studio-panel.png) | ![Lighthouse scene](docs/lighthouse.png) |

## Limits

Cadgo is a concept CAD and concept-scene tool, not certified engineering software.

- No B-Rep, STEP, tolerances, mating constraints or manufacturing certification.
- No physics, gameplay, animation timeline or scene scripting.
- OpenSCAD is a mesh/CSG kernel; organic surfaces and tight fits are approximations.
- Print check does not measure wall thickness or slicer time; mass assumes 100% infill.
- Web research returns excerpts and sources, not certification.
- The physical FlexStand print is still pending; the current demo does not claim a tested phone/cable fit.

## License and attribution

Cadgo is **GPL-3.0**. It distributes an OpenSCAD WebAssembly build (GPL-2.0-or-later), so the combined work is GPL-3.0.

- [LICENSE](LICENSE)
- [Third-party notices](THIRD_PARTY.md)
- [OpenSCAD source offer](public/openscad/SOURCE-OFFER.txt)
- [Deployment guide](docs/deployment.md)

The design language is informed by the [Anatomy](https://github.com/wheresryan22/anatomy) skill (MIT). OpenSCAD WASM distribution comes from CADAM. Full asset and service terms are listed in `THIRD_PARTY.md`.

## Submission

- [Written submission](SUBMISSION.md)
- Category: **AI-assisted 3D editing**
- Victoria VR AI Builder Hackathon 2026
