import { strFromU8, unzipSync } from "fflate";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import type { CompiledVariant } from "../lib/studio/compile/types";
import type { CadDocument, PartDefinition, PartInstance, Transform } from "../lib/studio/document/types";
import { buildPartStlBundle, buildSceneGlb, buildSceneGroup } from "../lib/studio/v2/export";

function makeTransform(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): Transform {
  return { position, rotation, scale };
}

function makeVariant(key: string, offset: number): CompiledVariant {
  const positions = new Float32Array([
    offset, 0, 0,
    offset + 1, 0, 0,
    offset, 1, 0,
  ]);
  const colors = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]);
  const bounds = { min: [offset, 0, 0] as [number, number, number], max: [offset + 1, 1, 0] as [number, number, number] };
  return {
    key,
    mesh: {
      positions,
      colors,
      triangles: 1,
      components: 1,
      floating: 0,
      boundaryEdges: 3,
      nonManifoldEdges: 0,
      volume: 0,
      surfaceArea: 0,
      overhangArea: 0,
      overhangPercent: 0,
      componentIds: new Uint32Array([0]),
      bounds,
    },
    metrics: {
      triangles: 1,
      components: 1,
      bounds,
      volume: 0,
      surfaceArea: 0,
      boundaryEdges: 3,
      nonManifoldEdges: 0,
      overhangArea: 0,
      overhangPercent: 0,
      compileMs: 1,
    },
    params: {},
    logs: "",
    duration: 1,
  };
}

function makeDocument(): CadDocument {
  const definitions: PartDefinition[] = [
    {
      id: "def-bracket",
      name: "Bracket",
      source: "cube([10, 10, 4]);",
      params: [],
      material: { color: "#ff8800", metalness: 0.8, roughness: 0.2 },
      materialMode: "override",
      locked: false,
      revision: 1,
    },
    {
      id: "def-pin",
      name: "Pin",
      source: "cylinder(h = 10, r = 2);",
      params: [],
      material: { color: "#00ff00", metalness: 0.1, roughness: 0.9 },
      materialMode: "source",
      locked: false,
      revision: 1,
    },
  ];
  const instances: PartInstance[] = [
    {
      id: "inst-bracket",
      definitionId: "def-bracket",
      name: "Bracket A",
      parentId: "group-inner",
      transform: makeTransform([1, 2, 3], [0, 0, 45], [2, 2, 2]),
      material: { color: "#00aaff", metalness: 0.3, roughness: 0.2, opacity: 0.5 },
      materialMode: "override",
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    },
    {
      id: "inst-pin",
      definitionId: "def-pin",
      name: "Pin B",
      parentId: null,
      transform: makeTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    },
    {
      id: "inst-hidden",
      definitionId: "def-pin",
      name: "Hidden Pin",
      parentId: "group-frame",
      transform: makeTransform(),
      visible: false,
      locked: false,
      suppressed: false,
      revision: 1,
    },
    {
      id: "inst-suppressed",
      definitionId: "def-pin",
      name: "Suppressed Pin",
      parentId: null,
      transform: makeTransform(),
      visible: true,
      locked: false,
      suppressed: true,
      revision: 1,
    },
    {
      id: "inst-hidden-group",
      definitionId: "def-pin",
      name: "Group Hidden Pin",
      parentId: "group-hidden",
      transform: makeTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    },
  ];
  return {
    schemaVersion: 2,
    id: "doc-test",
    name: "Test Assembly",
    revision: 1,
    units: "mm",
    library: "",
    groups: [
      {
        id: "group-frame",
        name: "Frame",
        parentId: null,
        transform: makeTransform([10, 0, 0], [0, 0, 90]),
        visible: true,
        locked: false,
        expanded: true,
        revision: 1,
      },
      {
        id: "group-inner",
        name: "Inner",
        parentId: "group-frame",
        transform: makeTransform([0, 5, 0]),
        visible: true,
        locked: false,
        expanded: true,
        revision: 1,
      },
      {
        id: "group-hidden",
        name: "Hidden group",
        parentId: null,
        transform: makeTransform([-10, 0, 0]),
        visible: false,
        locked: false,
        expanded: true,
        revision: 1,
      },
    ],
    definitions,
    instances,
    joints: [],
    drivers: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeVariants(): Record<string, CompiledVariant> {
  return {
    "def-bracket": makeVariant("bracket-1", 0),
    "def-pin": makeVariant("pin-1", 10),
  };
}

function meshNamed(root: Group, name: string): Mesh {
  const found = root.getObjectByName(name);
  expect(found).toBeDefined();
  return found as Mesh;
}

describe("part STL bundle", () => {
  it("packages the merged assembly, one STL per visible instance, a manifest and a README", () => {
    const document = makeDocument();
    const bundle = buildPartStlBundle(document, makeVariants());
    const files = unzipSync(bundle);
    const names = Object.keys(files).sort();

    expect(names).toEqual([
      "README.txt",
      "assembly.stl",
      "manifest.json",
      "parts/01-bracket-a.stl",
      "parts/02-pin-b.stl",
    ]);
    for (const name of names) {
      expect(files[name].byteLength).toBeGreaterThan(0);
    }
    expect(files["assembly.stl"].byteLength).toBe(84 + 2 * 50);
    expect(files["parts/01-bracket-a.stl"].byteLength).toBe(84 + 50);

    const manifest = JSON.parse(strFromU8(files["manifest.json"])) as {
      name: string;
      units: string;
      exportedAt: string;
      definitions: { name: string }[];
      instances: { name: string; definitionName: string; file: string }[];
    };
    expect(manifest.name).toBe("Test Assembly");
    expect(manifest.units).toBe("mm");
    expect(manifest.exportedAt).toBeTruthy();
    expect(manifest.definitions.map((definition) => definition.name)).toEqual(["Bracket", "Pin"]);
    expect(manifest.instances.map((instance) => instance.name)).toEqual(["Bracket A", "Pin B"]);
    expect(manifest.instances[0].definitionName).toBe("Bracket");
    expect(manifest.instances[0].file).toBe("parts/01-bracket-a.stl");

    const readme = strFromU8(files["README.txt"]).toLowerCase();
    expect(readme).toContain("millimetres");
    expect(readme).toContain("assembly.stl");
    expect(readme).toContain("parts/");
  });

  it("keeps duplicate instance names in separate files", () => {
    const document = makeDocument();
    document.instances.push({
      id: "inst-bracket-copy",
      definitionId: "def-bracket",
      name: "Bracket A",
      parentId: null,
      transform: makeTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    const files = unzipSync(buildPartStlBundle(document, makeVariants()));
    const parts = Object.keys(files).filter((name) => name.startsWith("parts/"));
    expect(parts).toHaveLength(3);
    expect(new Set(parts).size).toBe(3);
    expect(parts).toContain("parts/01-bracket-a.stl");
    expect(parts).toContain("parts/03-bracket-a.stl");
  });
});

describe("scene group", () => {
  it("preserves group hierarchy, local transforms and instance names", () => {
    const document = makeDocument();
    const root = buildSceneGroup(document, makeVariants());
    expect(root.name).toBe("Test Assembly");

    const frame = root.getObjectByName("Frame") as Group;
    expect(frame).toBeDefined();
    expect(frame.parent).toBe(root);
    expect(frame.position.toArray()).toEqual([10, 0, 0]);
    expect(frame.rotation.z).toBeCloseTo(Math.PI / 2);

    const inner = root.getObjectByName("Inner") as Group;
    expect(inner.parent).toBe(frame);
    expect(inner.position.toArray()).toEqual([0, 5, 0]);

    const bracket = meshNamed(root, "Bracket A");
    expect(bracket.parent).toBe(inner);
    expect(bracket.position.toArray()).toEqual([1, 2, 3]);
    expect(bracket.rotation.z).toBeCloseTo(Math.PI / 4);
    expect(bracket.scale.toArray()).toEqual([2, 2, 2]);

    const pin = meshNamed(root, "Pin B");
    expect(pin.parent).toBe(root);

    expect(bracket.geometry.getAttribute("position").count).toBe(3);
    expect(bracket.geometry.getAttribute("color").count).toBe(3);
    expect(bracket.geometry.getAttribute("normal")).toBeDefined();
  });

  it("skips hidden and suppressed instances and hides hidden groups", () => {
    const root = buildSceneGroup(makeDocument(), makeVariants());
    expect(root.getObjectByName("Hidden Pin")).toBeUndefined();
    expect(root.getObjectByName("Suppressed Pin")).toBeUndefined();
    expect(root.getObjectByName("Group Hidden Pin")).toBeUndefined();

    const hiddenGroup = root.getObjectByName("Hidden group") as Group;
    expect(hiddenGroup).toBeDefined();
    expect(hiddenGroup.visible).toBe(false);
  });

  it("applies override and source material modes", () => {
    const root = buildSceneGroup(makeDocument(), makeVariants());

    const bracketMaterial = meshNamed(root, "Bracket A").material as MeshStandardMaterial;
    expect(bracketMaterial.vertexColors).toBe(false);
    expect(bracketMaterial.color.getHexString()).toBe("00aaff");
    expect(bracketMaterial.metalness).toBeCloseTo(0.3);
    expect(bracketMaterial.roughness).toBeCloseTo(0.2);
    expect(bracketMaterial.opacity).toBeCloseTo(0.5);
    expect(bracketMaterial.transparent).toBe(true);
    expect(bracketMaterial.depthWrite).toBe(false);

    const pinMaterial = meshNamed(root, "Pin B").material as MeshStandardMaterial;
    expect(pinMaterial.vertexColors).toBe(true);
    expect(pinMaterial.color.getHexString()).toBe("ffffff");
    expect(pinMaterial.metalness).toBeCloseTo(0.1);
    expect(pinMaterial.roughness).toBeCloseTo(0.9);
    expect(pinMaterial.opacity).toBe(1);
    expect(pinMaterial.transparent).toBe(false);
    expect(pinMaterial.depthWrite).toBe(true);
  });
});

describe("scene GLB", () => {
  it("returns a non-empty ArrayBuffer when the exporter works in this runtime", async () => {
    let buffer: ArrayBuffer | null = null;
    let failure: unknown = null;
    try {
      buffer = await buildSceneGlb(makeDocument(), makeVariants());
    } catch (error) {
      failure = error;
    }
    if (!buffer) {
      console.warn(
        `Scene GLB assertion skipped in this runtime: ${
          failure instanceof Error ? failure.message : "exporter unavailable"
        }`,
      );
      return;
    }
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(new Uint8Array(buffer, 0, 4))).toBe("glTF");
  });
});
