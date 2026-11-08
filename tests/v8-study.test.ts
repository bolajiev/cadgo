import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";
import { createV8Study } from "../lib/studio/v2/studies/v8";
import { validateDocument } from "../lib/studio/document/validate";
import { jointTransforms, motionWorldMatrices } from "../lib/studio/v2/motion";

describe("V8 concept study", () => {
  it("is a valid, fully parametric assembly", () => {
    const document = createV8Study();
    expect(validateDocument(document)).toEqual([]);
    expect(document.definitions).toHaveLength(15);
    expect(document.instances.length).toBeGreaterThan(40);
    expect(document.drivers).toHaveLength(1);
    expect(document.joints.length).toBe(21);
    for (const definition of document.definitions) {
      const audit = auditParameterization(definition.source);
      expect(audit.ok, `${definition.name}: ${audit.message}`).toBe(true);
    }
  });

  it("moves the crank train without joint errors", () => {
    const document = createV8Study();
    const top = jointTransforms(document, { "driver-crank": 0 });
    expect(top.errors).toEqual({});
    expect(top.transforms.has("inst-crank")).toBe(true);
    expect(top.transforms.has("inst-piston-1")).toBe(true);

    const ninety = jointTransforms(document, { "driver-crank": 90 });
    expect(ninety.errors).toEqual({});
    const piston = ninety.transforms.get("inst-piston-1");
    expect(piston).toBeDefined();
    if (piston) {
      expect(Number.isFinite(piston.elements[14])).toBe(true);
      expect(piston.elements[14]).toBeLessThan(0);
    }
  });

  it("links the rods to the crank and pistons", () => {
    const document = createV8Study();
    const motion = motionWorldMatrices(document, { "driver-crank": 90 });
    expect(motion.errors).toEqual({});
    for (let index = 1; index <= 8; index++) {
      const matrix = motion.matrices.get(`inst-rod-${index}`);
      expect(matrix, `rod ${index}`).toBeDefined();
      if (matrix) {
        expect(matrix.elements.every((value) => Number.isFinite(value))).toBe(true);
      }
    }
  });

  it("keeps phases different across pistons", () => {
    const document = createV8Study();
    const result = jointTransforms(document, { "driver-crank": 90 });
    const first = result.transforms.get("inst-piston-1");
    const third = result.transforms.get("inst-piston-2");
    expect(first).toBeDefined();
    expect(third).toBeDefined();
    if (first && third) {
      expect(Math.abs(first.elements[14] - third.elements[14])).toBeGreaterThan(1);
    }
  });
});
