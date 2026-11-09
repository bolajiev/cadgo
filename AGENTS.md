# Cadgo agent instructions

## No hardcoded 3D

Every part, scene, fixture, example and generated artifact must be fully parametric. Never hardcode geometry, dimensions or design data into production code.

- Every driving dimension inside a `module` or `function` must be a named top-level Customizer parameter or a value derived from those parameters.
- Clearances, wall thicknesses, fillets, chamfers, hole sizes, offsets and tolerances are dimensions too; expose them as parameters.
- Literal numbers are allowed only for structural invariants: `0`, `1`, `-1`, `2` (half/index), `90`, `180`, `270`, `360`, color channels, `$fn`, and tiny epsilon values (`0.001`, `0.01`).
- No hidden numbers in helper modules such as `wall = 2`; make them parameters or derived variables.
- No hardcoded printer beds, printer specs, user dimensions, model previews or fallback geometry in application code. Use user input, environment configuration or researched data.
- No secrets, API keys, tokens or private URLs in source, docs or agent files. Use environment variables.
- Run the parameterization audit before calling a generation complete. A hardcoded-dimension finding must be repaired, not ignored.
- Test fixtures may contain literal expected values, but production paths must not.

## Product constraints

- DeepSeek V4.1 Flash only; no model fallback.
- Local OpenSCAD WASM compile; no server-side geometry execution.
- Cadgo supports mechanical assemblies and concept 3D scenes through the same parametric assembly graph; do not fork a separate scene pipeline.
- Scenes and mechanical assemblies both use the same named-dimension and parameterization-audit rules.
- The agent asks for purpose, printer and bed before print-oriented work, and researches the printer when possible.
- Keep source editable, dimensions named, parts separate bodies, and exports standard STL/SCAD/glTF.

## No hardcoded agent behavior

- Never hardcode an agent workflow: no fixed iteration counts, timeouts, phase lists, tool sequences, question scripts, view counts, or forced build→inspect→answer loops.
- The model decides when to ask, build, render, inspect, revise, answer, or stop.
- The user must be able to chat at any time, interrupt the run, stop it, and answer questions.
- No automatic generation from a chat message; the model or an explicit user action decides whether to build.
- Any cost/time budget must be visible and configurable. Hidden limits in product code are defects. The app does not impose an upstream request timeout; hosting-platform limits are documented separately.
- No model fallback, no forced phases, no synthetic progress, and no stopgap wrappers presented as agent intelligence.
- Before shipping agent changes, audit for hardcoded workflow constants and user-blocking UI.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `bolajiev/cadgo`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
