# Competitor position

## Landscape

| Product | Input/output | Parametric? | Relevance |
|---|---|---|---|
| **CADAM** | Text/image → OpenSCAD, browser WASM, STL/SCAD/DXF | Yes, top-level params | Closest open-source competitor and upstream dependency |
| **Zoo / Text-to-CAD** | Image/text → KCL, STEP/STL/glTF | Yes, feature tree/params | Strong image-to-CAD and real CAD engine |
| **Backflip** | Photo/STL/drawing → parametric feature tree/STEP | Yes | Direct threat to “image → parametric” |
| **Adam** | AI copilot inside native CAD | Yes, native CAD history | High-end adjacent; owns CADAM |
| **Onshape / Fusion / NX** | Native CAD plus AI assistance | Yes, mature B-Rep/feature history | Incumbent bar for native CAD, constraints, assemblies, STEP |
| **Meshy / Tripo / Rodin** | Image/text → textured mesh, STL/3MF | Mesh only | Strong visual likeness; not dimensionally editable |

## What this means

- Image-to-CAD is **table stakes**, not a moat.
- Cadgo cannot win on organic likeness; mesh tools are better.
- Cadgo cannot claim B-Rep, STEP, constraints, PLM or native CAD replacement.
- CADAM shares the local OpenSCAD/source/slider experience. Cadgo’s difference must be the **print-aware quality loop and visible trust layer**, not the editor.

## Cadgo’s defensible wedge

1. Printer/bed/material-aware intake.
2. Real scale confirmation and measured-vs-inferred dimensions.
3. Deterministic printability gates, not just body count.
4. Visible render-vs-reference check and assumptions.
5. Per-part export and a printed physical proof.
6. Local geometry with transparent source.

## Claims to avoid

- “First/only image-to-CAD.”
- “Real B-Rep CAD” or “STEP-ready.”
- “Print-ready / guaranteed watertight.”
- “Exact photo reconstruction” or “engineering-grade dimensions.”
- “Any object, any photo.”
- “Replaces Onshape/Fusion/Adam.”
- “Fully local/private” — geometry is local, but images/prompts/research leave the browser.
- “Better likeness than Meshy/Tripo/Rodin.”

## Strategic conclusion

Win the **functional, dimensioned, printable part** niche. Do not build a CAD kernel or chase mesh fidelity. Make the print loop obvious, inspectable and physically proven.
