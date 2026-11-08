# Architecture

Cadgo is an AI 3D assembly studio for mechanical assemblies and concept 3D scenes. This document records the decisions that keep both uses on one engine.

## One assembly graph

There is a single document model, not a CAD path and a scene path. The graph contains:

- **Groups** — a transform/visibility tree for organising assemblies and scenes.
- **Definitions** — reusable OpenSCAD source with named parameters, a source material and a revision.
- **Instances** — placements of a definition with an optional material override, parameter overrides, visibility, locking and suppression.
- **Joints** — revolute, prismatic and link constraints, with either an instance or a whole group as the child.
- **Drivers** — named values with min/max/step/unit that feed joint expressions.

Every mutation is an immutable command. Per-node revisions drive optimistic concurrency and conflicts; history provides undo/redo; the document autosaves to IndexedDB. A scene and a mechanical assembly use the same nodes, revisions and commands.

Motion is derived from the graph, not baked into geometry. Driver values and joint expressions produce transforms at render time, so changing a crank angle or rotor speed does not recompile parts. Group joints keep subassemblies intact while they move.

## Material model

`PartDefinition.material` is the source material. `PartInstance.material` is an optional override. Both carry an optional `materialMode`:

- `source` — OpenSCAD `color()` vertex colours are the authored colour; metalness, roughness and opacity still come from the material.
- `override` — the material colour, metalness, roughness and opacity replace the source colour.

Precedence is explicit and one-directional:

```
instance.material ?? definition.material
instance.materialMode ?? infer(instance.material)
definition.materialMode ?? infer(definition.material)
```

A default material with no explicit mode infers `source`; a custom material infers `override`. The override is not merged into the definition. That keeps a shared definition stable while one placement changes colour, finish or opacity, which is useful for both mechanical variants and scene dressing. The serialized document and the SCAD bundle each record the definition material; the instance override stays with the placement. The same resolver drives the stage, inspection sheet and GLB export, so a part looks the same everywhere colour is supported. STL exports carry geometry only.

## Export pipeline

Geometry exports run entirely in the browser; the server never receives a mesh. The only server-side document path is the optional large-share store, which receives a compressed share payload, not geometry.

- **Assembly STL** — each visible placed variant is transformed into world coordinates and written as a binary STL.
- **Scene GLB** — the document group hierarchy is rebuilt as a three.js scene and exported with `GLTFExporter`; materials carry the resolved source/override mode. For each driver, `motionLocalTransforms` is sampled and the animated group/instance local transforms become a glTF animation clip. `buildSceneGlb` exposes sample count, clip duration and a static-only option; a document with no drivers exports a static scene.
- **Part STLs ZIP** — `assembly.stl` plus one transformed STL per visible instance, a manifest and a README.
- **SCAD ZIP** — one editable `.scad` per definition, plus `assembly.json` (parts, parameters, groups, instances, joints, drivers), `document.cadgo.json` and a README.
- **Native JSON** — the full document for round-trip import.
- **Share links** — compressed document payload; large payloads can use an optional Blob or local share store.

The shared extension point is `placedVariants`: it yields the instance, compiled mesh, world matrix and resolved material. `buildSceneGroup` preserves local transforms and group parenting; `buildSceneGlb` exports that hierarchy; `buildPartStlBundle` reuses `instanceStl`. All formats are browser-local and share the same visibility, suppression, material and unit rules.

## Print checks

`buildPrintCheck` is the single source of truth for manufacturing checks. It reads the visible compiled variants and the print profile, then reports:

- watertightness from boundary and non-manifold edge counts;
- overhang percentage against `maxOverhangPercent` (default 35%) and whether supports are allowed;
- assembly bounds against the print bed;
- solid volume and a mass estimate from the material density.

The print-check dialog and the STL/Part STL export gate both consume the same report, so the warning and the block cannot disagree. Wall thickness and slicer time are deliberately not estimated: the OpenSCAD mesh kernel does not provide them, and a fake number would be worse than an explicit non-goal.

## Compile path

OpenSCAD runs as WebAssembly in a browser module worker pool. The compile controller keeps a cache keyed by source plus parameter values, compiles per-instance parameter variants separately, and retains the last good mesh when a compile fails. Metrics and compiler logs travel back to the UI and the agent. The server is a model proxy only; there is no server-side geometry execution.

## Agent reliability

The agent is a streaming, tool-using loop over the same assembly graph.

- **Streaming** — the server relays server-sent events; the client renders text deltas and assembles tool-call deltas before executing them.
- **Truncation continuation** — a response cut off by the output limit is marked truncated and the loop continues from the last unfinished point with a compact continuation instruction, rather than asking the user to prompt again.
- **Empty-response recovery** — an empty assistant turn is not treated as a completed answer. The loop recovers or surfaces an error instead of ending silently.
- **Upstream timeout** — the model request is bounded by a configurable upstream timeout (`CADGO_AGENT_UPSTREAM_TIMEOUT_MS`), separate from the user's ability to stop the run.
- **Rate limits** — per-session requests are bounded by `CADGO_AGENT_RATE_LIMIT`; `CADGO_AGENT_IP_RATE_LIMIT` caps requests per IP so new sessions cannot bypass the budget. Both are configurable and `0` disables the limit. The limiter is a `RateLimitStore`: an in-process bucket for local use and a Redis REST adapter for Upstash or Vercel KV in multi-instance deployments. The durable store is optional and configured by environment, not hardcoded.

Budgets and limits are surfaced in configuration or the UI; there are no hidden fixed iteration counts or forced tool sequences. The model decides when to build, inspect, ask, revise or stop.

## Non-goals

Cadgo does not implement B-Rep or STEP, tolerances or mating constraints, physics, gameplay or an animation timeline. Concept scenes share the assembly graph for placement, materials and joint motion; they are not a game engine.
