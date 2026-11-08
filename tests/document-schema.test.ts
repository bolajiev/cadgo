import { describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  defaultMaterial,
  identityTransform,
  newId,
} from "../lib/studio/document/defaults";
import { validateDocument } from "../lib/studio/document/validate";

describe("document schema", () => {
  it("creates an empty, valid document", () => {
    const doc = createEmptyDocument("V8 concept");
    expect(doc.schemaVersion).toBe(2);
    expect(doc.name).toBe("V8 concept");
    expect(doc.groups).toEqual([]);
    expect(doc.definitions).toEqual([]);
    expect(doc.instances).toEqual([]);
    expect(doc.joints).toEqual([]);
    expect(doc.drivers).toEqual([]);
    expect(validateDocument(doc)).toEqual([]);
  });

  it("uses an identity transform", () => {
    expect(identityTransform()).toEqual({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
  });

  it("rejects dangling references and group cycles", () => {
    const doc = createEmptyDocument();
    doc.definitions.push({
      id: newId("def"),
      name: "Block",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.instances.push({
      id: newId("inst"),
      definitionId: "missing",
      name: "Ghost",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    doc.groups.push(
      {
        id: "g1",
        name: "A",
        parentId: "g2",
        transform: identityTransform(),
        visible: true,
        locked: false,
        expanded: true,
        revision: 1,
      },
      {
        id: "g2",
        name: "B",
        parentId: "g1",
        transform: identityTransform(),
        visible: true,
        locked: false,
        expanded: true,
        revision: 1,
      },
    );
    const issues = validateDocument(doc);
    expect(issues.some((issue) => issue.path.includes("instances") && issue.path.includes("definitionId"))).toBe(true);
    expect(issues.some((issue) => issue.path === "groups")).toBe(true);
  });

  it("accepts valid material modes and rejects unknown modes", () => {
    const doc = createEmptyDocument("Material modes");
    doc.definitions.push({
      id: "def-1",
      name: "Block",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      materialMode: "source",
      locked: false,
      revision: 1,
    });
    doc.instances.push({
      id: "inst-1",
      definitionId: "def-1",
      name: "Block",
      parentId: null,
      transform: identityTransform(),
      materialMode: "override",
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    expect(validateDocument(doc)).toEqual([]);

    doc.definitions[0].materialMode = "bogus" as never;
    doc.instances[0].materialMode = "wrong" as never;
    const issues = validateDocument(doc);
    expect(issues.some((issue) => issue.path === "definitions.def-1.materialMode")).toBe(true);
    expect(issues.some((issue) => issue.path === "instances.inst-1.materialMode")).toBe(true);
  });

  it("rejects duplicate ids and unknown parameter overrides", () => {
    const doc = createEmptyDocument();
    const definition = {
      id: "def-1",
      name: "Piston",
      source: "diameter = 20; // [10:40]\ncylinder(d = diameter, h = 10);",
      params: [
        {
          name: "diameter",
          label: "Diameter",
          value: 20,
          min: 10,
          max: 40,
          step: 1,
          type: "number" as const,
        },
      ],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    };
    doc.definitions.push(definition, { ...definition, name: "Piston copy" });
    doc.instances.push({
      id: "inst-1",
      definitionId: "def-1",
      name: "Piston 1",
      parentId: null,
      transform: identityTransform(),
      paramOverrides: { missing: 4 },
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    const issues = validateDocument(doc);
    expect(issues.some((issue) => issue.path === "id")).toBe(true);
    expect(issues.some((issue) => issue.path.includes("paramOverrides.missing"))).toBe(true);
  });
});
