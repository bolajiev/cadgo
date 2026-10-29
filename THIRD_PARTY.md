# Third-party notices

Cadgo is MIT licensed. It builds on the following projects:

| Project | License | Use |
|---|---|---|
| [manifold-3d](https://github.com/elalish/manifold) | Apache-2.0 | watertight CSG kernel (WASM) |
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

The Manifold WASM binary is redistributed at `public/manifold.wasm`; its license is at https://github.com/elalish/manifold/blob/master/LICENSE.

The design compiler uses an OpenAI-compatible endpoint (OpenCode Go). Model availability and terms are governed by that provider. No model weights are redistributed.

All images in `public/examples` and `public/hero-lamp.png` are renders of Cadgo's own CadSpecs.
