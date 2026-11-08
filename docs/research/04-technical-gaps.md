# Technical feasibility and gaps

## Image-to-parametric reality

Single-image reconstruction is ill-posed: hidden faces and metric scale are unavailable. 2026 image-conditioned CAD benchmarks remain well below production reverse-engineering accuracy. Cadgo should promise a **printable parametric approximation**, not exact reconstruction.

- A single known dimension is more reliable than monocular metric depth.
- Multi-view helps, but only with consistent labeled views.
- Keep to prismatic/rotational parts: plates, brackets, clips, spacers, adapters, knobs, enclosures.
- Do not target organic shapes, tight tolerances, GD&T or STEP/B-Rep.

## Missing technical gates

### Intake and scale
- Require purpose, printer/bed and a known dimension for print work.
- Show measured vs inferred dimensions.
- Do not silently guess scale.

### Printability
- Watertight/manifold check on welded topology, not just connected components.
- Exact body count vs BOM quantities.
- Bed fit with margin.
- Overhang area/angle and minimum wall (sampled).
- Orientation and support estimate.
- Per-part export (one STL per part or 3MF objects), not one merged STL only.

### Agent
- Real `ask_user` with pause/resume, or at least a blocking print setup for all print prompts.
- Show plan, assumptions, unknown dimensions and research sources.
- Visual check must be visible and run on edits; failures must not be swallowed.
- Add a parameter-delta guard so visual review cannot change user-confirmed dimensions.
- Bound steps, time and cost; terminal states: success, needs-user, budget-exceeded, failed.

### Reliability
- Vercel request limit: 4.5 MB. Reference + render + code can exceed it. Downscale images and split phases.
- Add per-request timeouts, global budget, no-progress detection and graceful 413/504 handling.
- Rate limits are in-memory; use durable limits for a public demo.
- Validate web fetch content, cap response size, re-check redirects and DNS.

### Evaluation
A frozen 12–24 task golden set:
- prompt-only prismatic parts;
- single-image objects;
- scale/reference images;
- text edits/regressions;
- negative cases.

Metrics: compile rate, body-count match, parameter-audit pass, watertight rate, key-dimension error, silhouette IoU, latency, cost. Hard gates: compile, body count, parameterization, watertight. Do not use “VLM says it looks good” as the only gate.

## Realistic 1–2 week scope

**Yes:** scale intake, per-part export, manifold/body/bed/overhang/wall warnings, visible visual check, natural-language edits, golden set, reliability caps.

**No:** STEP/B-Rep, browser slicer, SAM segmentation, multi-view reconstruction, hybrid image→mesh→CAD, organic surfaces.
