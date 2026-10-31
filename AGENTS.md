# Cadgo agent instructions

## No hardcoded CAD

Every model, fixture, example and generated artifact must be fully parametric. Never hardcode geometry, dimensions or design data into production code.

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
- The agent asks for purpose, printer and bed before print-oriented work, and researches the printer when possible.
- Keep source editable, dimensions named, parts separate bodies, and exports standard STL/SCAD.
