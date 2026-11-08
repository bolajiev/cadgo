# Hackathon compliance and demo constraints

Official sources: [Terms](https://www.victoriavr.com/hackathon/2026/terms), [launch article](https://www.victoriavr.com/news/ai-builder-hackathon-2026-build-the-future-of-ai-native-3d-experiences-5915194b), [build-period article](https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3).

## Verified facts

- Event: Victoria VR AI Builder Hackathon 2026, online, global, €20,000 pool.
- Registration: 10 Jul – **8 Sep 2026, 16:00 CEST** (closed).
- Build period: 11 Sep – 11 Nov 2026.
- Submission deadline: **11 Nov 2026, 16:30 CEST** as written; treat as **15:30 WAT** because November is CET, not CEST.
- Required: public repo, hosted browser demo, **video under 3 minutes**, short description, category.
- Core rule: browser-based project that **turns plain language into 3D scenes and working logic**.
- Judges may use their own prompts, including outside the chosen focus area.
- Eligibility: individuals/informal teams only; companies, studios, universities and other legal entities are excluded.

## Compliance risks

### 1. Registration and eligibility — go/no-go
Verify every member has a registration confirmation from before 8 Sep. Verify the team is an informal team, not a company/university submission. If either is uncertain, contact the organizer in writing now.

### 2. Plain-language requirement
The image-first demo is not enough. The demo must visibly show text such as:
- “make the wall 3 mm”
- “add a 6 mm hole”
- “make it fit a 40 mm pipe”

### 3. Copyleft / GPL
T&Cs 7.2.3 restrict third-party material whose copyleft/share-alike obligations could require disclosure or restriction of the Organizer’s software. Cadgo is GPL-3.0 and bundles OpenSCAD (GPL). This needs a written legal/organizer review before submission. Do not assume it is fine.

### 4. Deadline timezone
The T&Cs say CEST (UTC+2) for a November date. Submit **9–10 Nov**, not on 11 Nov. Save the receipt.

### 5. Video
A video under three minutes is mandatory. `SUBMISSION.md` still contains a placeholder. Record 2:40–2:50 and test the link logged out.

### 6. Judging weights
The 30/25/20/25 weights are not in the official terms. They may be internal guidance. Do not quote them publicly; optimise for technical quality, originality, usefulness, UX, functionality and presentation.

### 7. Pre-existing work and licence grant
Disclose pre-existing Cadgo work and build-period additions if asked. The Organizer receives a broad licence for judging, promotion, research and commercial evaluation. Decide internally whether that is acceptable.

## Demo implications

- Lead with a real printed part and a real photo, but **include the text-edit path**.
- Use the printer/bed workflow and scale confirmation.
- Show the printability validator catching something and fixing it.
- Use a simple prismatic object that prints in under ~60–90 minutes without supports.
- Have a recorded backup, local build, pre-sliced file and spare print.
