# Licensing compliance note

This note records the licensing position for the Victoria VR AI Builder Hackathon 2026 submission. It is factual project documentation, not legal advice, and it does not predict the Organizer's decision.

## Current distribution

Cadgo is distributed under GPL-3.0. The reason is concrete: the app ships the OpenSCAD WebAssembly build, which is GPL-2.0-or-later, and uses it as the local geometry kernel. The combined distribution is therefore GPL-3.0. The corresponding source offer is included at `public/openscad/SOURCE-OFFER.txt`; see [THIRD_PARTY.md](../THIRD_PARTY.md) for the dependency inventory.

## Hackathon terms

Section 7.2.3 of the hackathon terms prohibits components with copyleft or share-alike obligations that could restrict the Organizer's proprietary software. Whether the OpenSCAD WASM distribution falls within that prohibition depends on the full terms and the Organizer's interpretation. The team has not received a written ruling.

This is a material submission risk because the kernel is part of the shipped product, not an optional development tool. It is not a proven disqualification.

## Options

1. **Keep GPL-3.0 and disclose.** Submit with the GPL-3.0 notice and source offer, and ask the Organizer in writing for confirmation that the distribution is acceptable under §7.2.3. This preserves the current product.
2. **Isolate or replace the kernel.** Move to a permissively licensed geometry path before submission, or separate the GPL component so the submitted proprietary work does not include it. This requires engineering and licensing work that is not complete today.

Relicensing the existing distribution as non-copyleft is not an option while it contains the OpenSCAD WASM build.

## Source offer

The OpenSCAD WASM source offer is at `public/openscad/SOURCE-OFFER.txt`. The vendored distribution and source-offer practice come from CADAM (GPL-3.0). Any change to the kernel must keep the corresponding source offer accurate.
