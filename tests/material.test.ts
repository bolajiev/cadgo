import { describe, expect, it } from "vitest";
import type { CompiledVariant } from "../lib/studio/compile/types";
import { createEmptyDocument, DEFAULT_MATERIAL, defaultMaterial, identityTransform } from "../lib/studio/document/defaults";
import type { MaterialRef } from "../lib/studio/document/types";
import { placedVariants } from "../lib/studio/v2/geometry";
import {
  inferMaterialMode,
  isDefaultMaterial,
  isMaterialMode,
  resolvePlacedMaterial,
} from "../lib/studio/v2/material";

const custom: MaterialRef = { color: "#ff5500", metalness: 0.8, roughness: 0.2, opacity: 0.6 };

const variant: CompiledVariant = {
  key: "def-1@1",
  mesh: {
    positions: new Float32Array(),
    colors: new Float32Array(),
    triangles: 0,
    components: 1,
    floating: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    volume: 0,
    surfaceArea: 0,
    overhangArea: 0,
    overhangPercent: 0,
    componentIds: new Uint32Array(),
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  },
  metrics: {
    triangles: 0,
    components: 1,
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    volume: 0,
    surfaceArea: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    overhangArea: 0,
    overhangPercent: 0,
    compileMs: 0,
  },
  params: {},
  logs: "",
  duration: 0,
};

function materialDocument() {
  const document = createEmptyDocument("Materials");
  document.definitions.push({
    id: "def-1",
    name: "Part",
    source: "cube([1,1,1]);",
    params: [],
    material: defaultMaterial(),
    materialMode: "source",
    locked: false,
    revision: 1,
  });
  document.instances.push({
    id: "inst-1",
    definitionId: "def-1",
    name: "Part",
    parentId: null,
    transform: identityTransform(),
    visible: true,
    locked: false,
    suppressed: false,
    revision: 1,
  });
  return document;
}

describe("material mode helpers", () => {
  it("validates explicit material modes", () => {
    expect(isMaterialMode("source")).toBe(true);
    expect(isMaterialMode("override")).toBe(true);
    expect(isMaterialMode("material")).toBe(false);
    expect(isMaterialMode(undefined)).toBe(false);
    expect(isMaterialMode(null)).toBe(false);
  });

  it("detects the default material", () => {
    expect(isDefaultMaterial(DEFAULT_MATERIAL)).toBe(true);
    expect(isDefaultMaterial(defaultMaterial())).toBe(true);
    expect(isDefaultMaterial(undefined)).toBe(true);
    expect(isDefaultMaterial({ ...DEFAULT_MATERIAL, opacity: undefined })).toBe(true);
    expect(isDefaultMaterial(custom)).toBe(false);
    expect(isDefaultMaterial({ ...DEFAULT_MATERIAL, color: "#ffffff" })).toBe(false);
    expect(isDefaultMaterial({ ...DEFAULT_MATERIAL, metalness: 0.9 })).toBe(false);
    expect(isDefaultMaterial({ ...DEFAULT_MATERIAL, roughness: 0.1 })).toBe(false);
    expect(isDefaultMaterial({ ...DEFAULT_MATERIAL, opacity: 0.5 })).toBe(false);
  });

  it("infers source for default materials and override for authored materials", () => {
    expect(inferMaterialMode(defaultMaterial())).toBe("source");
    expect(inferMaterialMode(undefined)).toBe("source");
    expect(inferMaterialMode(custom)).toBe("override");
    expect(inferMaterialMode(defaultMaterial(), "override")).toBe("override");
    expect(inferMaterialMode(custom, "source")).toBe("source");
  });

  it("prefers instance material over definition material", () => {
    const resolved = resolvePlacedMaterial(defaultMaterial(), "source", custom, undefined);
    expect(resolved).toEqual({
      mode: "override",
      color: custom.color,
      metalness: custom.metalness,
      roughness: custom.roughness,
      opacity: custom.opacity,
    });
  });

  it("lets an explicit instance mode win over inference", () => {
    const resolved = resolvePlacedMaterial(custom, "override", defaultMaterial(), "source");
    expect(resolved.mode).toBe("source");
    expect(resolved.color).toBe(DEFAULT_MATERIAL.color);
  });

  it("falls back to the definition when the instance has no material", () => {
    const source = resolvePlacedMaterial(defaultMaterial(), "source");
    expect(source.mode).toBe("source");
    expect(source.color).toBe(DEFAULT_MATERIAL.color);

    const override = resolvePlacedMaterial(custom);
    expect(override.mode).toBe("override");
    expect(override.color).toBe(custom.color);
  });

  it("lets an explicit instance mode override the definition even without an instance material", () => {
    const resolved = resolvePlacedMaterial(custom, "override", undefined, "source");
    expect(resolved.mode).toBe("source");
    expect(resolved.color).toBe(custom.color);
  });

  it("falls back to the default material when nothing is authored", () => {
    expect(resolvePlacedMaterial()).toEqual({
      mode: "source",
      color: DEFAULT_MATERIAL.color,
      metalness: DEFAULT_MATERIAL.metalness,
      roughness: DEFAULT_MATERIAL.roughness,
      opacity: DEFAULT_MATERIAL.opacity,
    });
    expect(resolvePlacedMaterial(undefined).opacity).toBe(DEFAULT_MATERIAL.opacity);
  });

  it("resolves a missing opacity to the default opacity", () => {
    const resolved = resolvePlacedMaterial({ color: "#123456", metalness: 0.4, roughness: 0.5 });
    expect(resolved.opacity).toBe(DEFAULT_MATERIAL.opacity);
  });
});

describe("placed variant materials", () => {
  it("carries the resolved material and mode onto placed variants", () => {
    const document = materialDocument();
    const [placed] = placedVariants(document, { "def-1": variant });
    expect(placed.material).toEqual(defaultMaterial());
    expect(placed.materialMode).toBe("source");

    document.instances[0].material = custom;
    document.instances[0].materialMode = "override";
    const [overridden] = placedVariants(document, { "def-1": variant });
    expect(overridden.material).toBe(custom);
    expect(overridden.materialMode).toBe("override");
  });

  it("keeps source rendering for instances without a definition or material", () => {
    const document = materialDocument();
    document.instances[0].definitionId = "def-missing";
    const [placed] = placedVariants(document, { "def-missing": variant });
    expect(placed.material).toBeUndefined();
    expect(placed.materialMode).toBe("source");
  });
});
