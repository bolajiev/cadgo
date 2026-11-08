# Accepted decisions

Status: **Accepted** unless marked conditional. Owners are roles, not names.

| ID | Decision | Rationale | Owner | Due | Status |
|---|---|---|---|---|---|
| D-001 | Do not build more features until registration, eligibility and GPL/licence position are confirmed | These are potential disqualifiers | Lead / legal | 1 Nov | Conditional |
| D-002 | Position Cadgo as a **print-aware reference-to-parametric CAD**, not “image to exact CAD” | Image-to-CAD is commoditized; trust/print loop is the wedge | Product | 1 Nov | Accepted |
| D-003 | Freeze P0 around trust: scale, printability, per-part export, visible visual check, text-edit demo, physical print, video | Demo scope; avoid feature sprawl | Lead | 1 Nov | Accepted |
| D-004 | Use a **cable clip** as the primary physical demo object; print two copies | Small, flat, fast, functional fit test, no supports | Print lead | 1 Nov | Accepted |
| D-005 | Image demo must include a **plain-language text edit** | Hackathon core rule | Product / demo | 2 Nov | Accepted |
| D-006 | Require purpose + printer/bed + known dimension or explicit scale assumption for print work | Single-image scale is ambiguous | Product / AI | 2 Nov | Accepted |
| D-007 | Add hard printability gates: watertight/manifold, exact body count, bed fit; warnings for overhang/min wall | Body count alone is not printable | CAD/print | 5 Nov | Accepted |
| D-008 | P0 export: one STL per part in a zip; 3MF is P1 | Real multi-part workflow without a format rewrite | CAD/eng | 4 Nov | Accepted |
| D-009 | Visual check must be visible, run on edits, and never silently fail | Claim must be demoable and trustworthy | AI/UX | 4 Nov | Accepted |
| D-010 | Parameter audit must be blocking/complete; fix benchbook literals or soften claims | “Fully parametric” must be true | CAD/AI | 3 Nov | Accepted |
| D-011 | DeepSeek V4.1 Flash only; no fallback; accept provider risk | Team/product constraint | Lead | — | Accepted risk |
| D-012 | Remove/avoid “first,” “B-Rep,” “STEP-ready,” “watertight,” “print-ready,” “exact scan,” “any object” claims | Competitors/technical reality | Content | 2 Nov | Accepted |
| D-013 | Submit 9–10 Nov; video 2:40–2:50; freeze commit | Avoid timezone/deadline risk | Lead | 9 Nov | Accepted |
| D-014 | Cut P1/P2 work unless it directly supports P0 | Timebox | Lead | 1 Nov | Accepted |
| D-015 | No new model, no slicer, no STEP, no segmentation for this hackathon | Scope control | Lead | — | Accepted |
| D-016 | Build a 12-task golden set and one browser E2E smoke test | No regression protection today | QA | 6 Nov | Accepted |
| D-017 | Change privacy copy to “geometry stays in the browser; AI inputs go to the provider” | Current copy is inaccurate | UX/content | 2 Nov | Accepted |
| D-018 | Printability validation is a warning/blocker based on hard vs soft gates | Do not overclaim | CAD/print | 5 Nov | Accepted |

## Non-goals for this submission

- B-Rep/STEP export.
- Organic image reconstruction.
- Browser slicing/G-code.
- Multi-user accounts/PLM.
- Model fallback.
- Automatic support generation.

## Status update — 31 Oct 2026, 21:43 WAT

- **D-006 implemented:** image and print-intent text now require print setup; no hidden bed default; image work requires a known scale or an explicit “estimated scale” confirmation.
- **D-009 implemented:** visual check is a visible card with reference/render, status, and rejection/unavailable states; render capture retries; body-check failures revert to the last body-valid version.
- **D-017 implemented:** privacy copy now distinguishes local geometry from AI inputs.
- **Still open:** D-007 printability worker, D-008 per-part export, D-001 compliance/registration/licence.
- **Not committed yet:** changes are deployed to the test project but remain in the working tree.

## Status update — second P0 slice

- **D-007 partial:** watertight/open-edge/non-manifold checks, volume, exact bed-fit display, and hard export blocks for watertight/body/bed failures are implemented. Overhang, minimum-wall and support analysis remain open.
- **D-008 still open:** per-part export.
- **New print-check UI:** watertight, open edges, non-manifold edges, bed fit, volume.
- **Fail-closed:** visual/audit repairs that break body validity revert to the last body-valid model.
- **Not committed:** second slice is deployed but remains in the working tree.

## Status update — third P0 slice

- **D-008 implemented:** Export now offers **separate part STLs** named from the BOM/body list; multiple files are downloaded. A zip/3MF bundle remains P1.
- **D-007 extended:** overhang area/percentage, surface area and volume are computed; print-check UI shows watertight, open/non-manifold edges, overhang, bed fit and volume.
- **Export gates:** non-watertight meshes, body-count/BOM mismatches and bed overflows are blocked.
- **Min-wall and support-estimate checks** remain open.
- **Not committed:** these changes are deployed but remain in the working tree.

## Status update — thinking, intake guard and mechanism test

- **Planner reasoning enabled:** DeepSeek planning now uses reasoning tokens; the writer remains non-thinking because a 24k thinking writer run truncated.
- **Conditional questions:** uploading an image no longer opens the print setup card automatically. Print setup appears only for print-intent prompts or when the user opens it.
- **Object-only guard:** the planner classifies the image subject and rejects people, faces, animals and scenes.
- **Mechanism planning:** planner/writer prompts now ask for a real part graph for mechanisms instead of a flattened block.
- **Test on the supplied complex mechanism image:** the planner correctly identified a four-wheel steered chassis and produced a 59-part/83-body display assembly, but it was **not watertight (607 non-manifold edges), 29.6% overhang, and not faithful** to the reference. This confirms that the current OpenSCAD single-image pipeline is insufficient for engine-level CAD.
- **Recommendation:** keep the hackathon demo to a simple printable part; move accurate complex mechanisms to a separate R&D track with multi-view input, dimensions, and a B-Rep/assembly kernel (FreeCAD/CadQuery or an external CAD service). MCP is a transport/tool protocol, not a reconstruction engine.
- **Not committed:** these changes are deployed but remain in the working tree.

## Status update — B-Rep track started

- Added `services/cad-engine/`: a working CadQuery/OpenCascade B-Rep service with multi-part feature specs, STEP/STL export, validity/volume/bounds inspection, Docker, tests and an MCP server.
- Added `app/api/cad/brep/route.ts` as a server-only proxy; it returns 503 until `CAD_ENGINE_URL` is configured.
- **Not integrated into the studio UI** and **not deployed on Vercel**. Next: multi-view/dimension intake and an agent-to-assembly-spec bridge.
- This does not make one-image complex reconstruction solved; it provides the real kernel/tooling that was missing.

## Status update — B-Rep lab live (experimental)

- **`/assembly` live:** up to three labeled reference views, measured dimensions, DeepSeek assembly planning, CadQuery B-Rep build, STEP/STL/zip downloads.
- **Live test:** a two-part cable clamp brief produced two valid B-Rep parts with assumptions/warnings and STEP/STL links.
- **Host caveat:** the CadQuery service is currently reached through a temporary Cloudflare quick tunnel from the development VPS. Move it to a managed container host with HTTPS before production or judging.
- The safe feature spec covers boxes, cylinders and prisms; gears, fillets, sweeps, mates/kinematics and code execution remain future work.
- The studio remains the simple printable-part path; the B-Rep lab is the complex-assembly track.

## Final direction — Adam-style loop adopted

- Studied CADAM (Adam's open source): code generation + multi-view screenshot inspection + rewrite loop, no feature-tree DSL.
- Cadgo now uses that loop with **DeepSeek V4.1 Flash only**:
  write code → compile locally → render model-chosen views → model inspects → revise → `answer_user`.
- One studio at `/studio`; `/assembly` and `/mechanism` redirect to it.
- B-Rep/CadQuery remains archived as a separate future export track, not part of the studio.
- The V8 concept prompt produced a multi-build V8 assembly with an inspection sheet; this is concept CAD, not native B-Rep engineering CAD.
- The current work is deployed but not committed.
