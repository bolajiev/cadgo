# Team split and timeline

## Workstreams

| Workstream | Owns | First deliverable |
|---|---|---|
| **A. Lead / submission / compliance** | Registration, eligibility, licence/GPL, deadline, repo/demo/video links | Go/no-go note by 1 Nov |
| **B. Product / AI agent** | Scale intake, print setup, visible plan/assumptions, question flow, text-edit demo | Scale gate and scripted prompts by 2 Nov |
| **C. CAD / printability** | Manifold/body checks, bed/overhang/wall, per-part export, print profile | Printability acceptance checklist by 3 Nov |
| **D. Print / demo / video** | Demo object, slicer, physical prints, calipers/fit test, 2:40 video | Print v1 by 1 Nov; final video by 8 Nov |
| **E. QA / reliability / ops** | Golden set, E2E, CI, timeouts/payloads, monitoring, deployment backup | 12-task golden set + smoke test by 6 Nov |
| **F. Narrative / content** | Claim hygiene, README/SUBMISSION, privacy copy, demo story | Corrected claims and privacy copy by 2 Nov |

## One-hour decision sprint

The research hour has already been used. For the next one-hour team block:

| Minutes | Activity | Output |
|---|---|---|
| 0–10 | Registration/eligibility/licence check | Go/no-go; written organizer questions |
| 10–25 | Parallel subagents: print demo plan, printability checklist, judge-proof prompts, eval set | Four short memos |
| 25–40 | Lead decision meeting | Confirm P0; assign owners; cut P1 |
| 40–55 | Demo object and script lock | Object, scale reference, text edits, print schedule |
| 55–60 | Risk review | Backup demo, spare print, API/network fallback |

**Rule:** no product coding until D-001 is resolved or accepted as a tracked risk.

## Ten-day plan

- **1 Nov:** Compliance/eligibility/licence; freeze P0; choose cable clip; start print v1.
- **2 Nov:** Require scale + print setup; visible assumptions; fix privacy/claims; lock 5 judge prompts.
- **3 Nov:** Manifold/body audit; printability checklist; parameter audit blocking; print v2.
- **4 Nov:** Visible visual check, run on edits; per-part STL zip; natural-language edit path.
- **5 Nov:** Bed/overhang/wall warnings; golden set; reliability caps and 413 handling.
- **6 Nov:** E2E smoke test; CI; fix contradictions; remove/legacy quarantine if safe.
- **7 Nov:** Full regression; final print; calipers/fit test; backup recording.
- **8 Nov:** Record 2:40–2:50 video; verify links logged out; repo/docs/licences.
- **9 Nov:** Submit early; save confirmation; freeze commit.
- **10 Nov:** Buffer only; no risky changes.
- **11 Nov:** Deadline; do not rely on the ambiguous timezone.

## Subagent briefs

Give each subagent one file/area, a read-only brief, and a strict output:

1. **Compliance:** official terms, registration, eligibility, GPL, organizer questions.
2. **Print demo:** object, slicer profile, print schedule, photo/measurement plan.
3. **Printability:** hard/soft gates and what can be implemented client-side in time.
4. **Judge-proof eval:** 5 text prompts, 4 image cases, 3 negative cases; expected outcomes.
5. **Content:** 2:40 script, claim audit, privacy copy, submission checklist.
6. **Reliability:** payload/timeout/rate-limit risks, backup plan, health checks.

Subagents are for isolated research/review. They must not edit production files without an owner.
