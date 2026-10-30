# Third-party notices

Cadgo is distributed under **GPL-3.0** because it includes the OpenSCAD WebAssembly build.

| Project | License | Use |
|---|---|---|
| [OpenSCAD](https://github.com/openscad/openscad) / [openscad-wasm](https://github.com/openscad/openscad-wasm) | GPL-2.0-or-later | local CAD kernel (WASM); distributed here as part of the GPL-3.0 combined work |
| [CADAM](https://github.com/Adam-CAD/CADAM) | GPL-3.0 | source of the vendored OpenSCAD WASM distribution/source offer |
| [manifold-3d](https://github.com/elalish/manifold) | Apache-2.0 | mesh CSG kernel for the mechanism lab |
| [three.js](https://threejs.org) | MIT | 3D rendering |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) | MIT | React renderer for three.js |
| [@react-three/drei](https://github.com/pmndrs/drei) | MIT | R3F helpers |
| [Next.js](https://nextjs.org) | MIT | application framework |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | state |
| [Zod](https://zod.dev) | MIT | schema validation |
| [jsonrepair](https://github.com/josdejong/jsonrepair) | ISC | tolerant JSON parsing |
| [lz-string](https://github.com/pieroxy/lz-string) | MIT | share-link compression |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | Apache-2.0 | local recent projects |
| [Anatomy](https://github.com/wheresryan22/anatomy) | MIT | drafting/plate design language |

The OpenSCAD WASM source offer is at `public/openscad/SOURCE-OFFER.txt`. The Manifold WASM binary is at `public/manifold.wasm`; its license is at https://github.com/elalish/manifold/blob/master/LICENSE.

The design compiler uses an OpenAI-compatible endpoint (OpenCode Go). Model availability and terms are governed by that provider. No model weights are redistributed.

All images in `public/examples`, `public/hero-lamp.png` and `docs/` are renders of Cadgo's own models.
