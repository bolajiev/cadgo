import { describe, expect, it } from "vitest";
import { binaryStl } from "../lib/scad/stl";

describe("binary STL writer", () => {
  it("writes a valid one-triangle STL", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const stl = binaryStl(positions);
    expect(stl.byteLength).toBe(84 + 50);
    const view = new DataView(stl.buffer);
    expect(view.getUint32(80, true)).toBe(1);
  });

  it("exports only the selected component", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      10, 10, 10, 11, 10, 10, 10, 11, 10,
    ]);
    const components = new Uint32Array([0, 1]);
    const stl = binaryStl(positions, components, 1);
    const view = new DataView(stl.buffer);
    expect(view.getUint32(80, true)).toBe(1);
    expect(view.getFloat32(84 + 12, true)).toBe(10);
  });
});
