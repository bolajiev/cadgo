import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";
import { validateDocument } from "../lib/studio/document/validate";
import { motionWorldMatrices } from "../lib/studio/v2/motion";
import { createRotaryStudy } from "../lib/studio/v2/studies/rotary";

describe("rotary mechanism study", () => {
  it("is a valid, fully parametric transparent assembly", () => {
    const document = createRotaryStudy();
    expect(validateDocument(document)).toEqual([]);
    expect(document.definitions).toHaveLength(8);
    expect(document.instances).toHaveLength(31);
    expect(document.joints).toHaveLength(10);
    expect(document.definitions.find((item) => item.name === "Base plate")?.material.opacity).toBeLessThan(1);
    expect(document.definitions.find((item) => item.name === "Rotor housing")?.material.opacity).toBeLessThan(1);
    for (const definition of document.definitions) {
      const audit = auditParameterization(definition.source);
      expect(audit.ok, `${definition.name}: ${audit.message}`).toBe(true);
    }
  });

  it("rotates the gear, rotors and shafts without joint errors", () => {
    const document = createRotaryStudy();
    const motion = motionWorldMatrices(document, { "driver-rotor": 90 });
    expect(motion.errors).toEqual({});
    expect(motion.matrices.get("inst-gear")).toBeDefined();
    for (let index = 1; index <= 4; index++) {
      const rotor = motion.matrices.get(`inst-rotor-${index}`);
      const shaft = motion.matrices.get(`inst-shaft-${index}`);
      expect(rotor?.elements.every((value) => Number.isFinite(value))).toBe(true);
      expect(shaft?.elements.every((value) => Number.isFinite(value))).toBe(true);
    }
  });
});
