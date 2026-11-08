import { describe, expect, it } from "vitest";
import { createEmptyDocument, defaultMaterial, identityTransform } from "../lib/studio/document/defaults";
import { validateDocument } from "../lib/studio/document/validate";
import { motionWorldMatrices } from "../lib/studio/v2/motion";

describe("group motion", () => {
  function turbine() {
    const doc = createEmptyDocument("Turbine");
    doc.definitions.push({
      id: "def-part",
      name: "Part",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.groups.push({
      id: "group-rotor",
      name: "Rotor",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      expanded: true,
      revision: 1,
    });
    const base = {
      definitionId: "def-part",
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    };
    doc.instances.push(
      { ...base, id: "inst-tower", name: "Tower", parentId: null },
      { ...base, id: "inst-hub", name: "Hub", parentId: "group-rotor" },
      { ...base, id: "inst-blade", name: "Blade", parentId: "group-rotor", transform: { ...identityTransform(), position: [10, 0, 0] } },
    );
    doc.drivers.push({
      id: "driver-rotor",
      name: "rotor_angle",
      value: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: "deg",
      revision: 1,
    });
    doc.joints.push({
      id: "joint-rotor",
      name: "Rotor spin",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-tower",
      childGroupId: "group-rotor",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-rotor",
      expression: "angle",
    });
    return doc;
  }

  it("rotates every instance in a group joint", () => {
    const doc = turbine();
    expect(validateDocument(doc)).toEqual([]);
    const top = motionWorldMatrices(doc, { "driver-rotor": 0 });
    const turned = motionWorldMatrices(doc, { "driver-rotor": 90 });
    expect(top.errors).toEqual({});
    expect(turned.errors).toEqual({});
    const bladeTop = top.matrices.get("inst-blade");
    const bladeTurned = turned.matrices.get("inst-blade");
    expect(bladeTop).toBeDefined();
    expect(bladeTurned).toBeDefined();
    if (bladeTop && bladeTurned) {
      expect(bladeTop.elements[12]).toBeCloseTo(10, 5);
      expect(bladeTop.elements[13]).toBeCloseTo(0, 5);
      expect(bladeTurned.elements[12]).toBeCloseTo(0, 5);
      expect(bladeTurned.elements[13]).toBeCloseTo(10, 5);
    }
    const hubTurned = turned.matrices.get("inst-hub");
    expect(hubTurned?.elements.every((value) => Number.isFinite(value))).toBe(true);
  });
});
