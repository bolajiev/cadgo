# Cadgo research and decisions

**Research date:** 31 October 2026  
**Timebox:** 20:46–21:46 WAT (Nigeria, UTC+1)  
**Research method:** four parallel subagents — repo audit, competitor landscape, hackathon/print demo, technical feasibility  
**Code changes:** none; this folder is analysis and decisions only

## Executive decision

Cadgo should not compete on “image to exact CAD.” That space is already served by Zoo, Backflip, CADAM and others. Cadgo should compete on the **complete print-aware quality loop**:

> researched printer/bed → real scale intake → editable named-parameter CAD → local compile → separate-body and parameter checks → visible render-vs-reference check → printable, per-part export → physical print proof.

The demo must include a **plain-language text edit path**, because the hackathon rules require plain language → 3D. Image-only positioning is a compliance risk.

## Read in this order

1. [Current state and gaps](01-current-state.md)
2. [Competitor position](02-competitors.md)
3. [Hackathon compliance and print demo](03-hackathon-compliance.md)
4. [Technical feasibility](04-technical-gaps.md)
5. [Accepted decisions](05-decisions.md)
6. [Team split and 10-day plan](06-team-and-timeline.md)
7. [Demo and submission plan](07-demo-and-submission.md)
8. [Sources](08-sources.md)

## Top decisions

- **Freeze P0 scope** around trust and printability, not new model features.
- **Verify registration, eligibility and the GPL/open-source position before building further.**
- **Require scale and print setup** for print-oriented work.
- **Make printability checks real**: watertight/manifold, body count, bed fit, overhang and minimum wall.
- **Export per-part**, not only one merged STL.
- **Make the visual check visible**; never silently swallow a failed check.
- **Use a cable clip as the primary physical demo object**; print it early and print a spare.
- **Lead with image + ruler, then a text edit**, to satisfy the plain-language rule.
- **Do not claim** “first,” “B-Rep,” “STEP-ready,” “watertight,” “print-ready,” “exact scan,” or “any object.”
- **Submit early on 9–10 November**, not on the deadline day.
