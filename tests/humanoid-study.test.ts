import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";
import { validateDocument } from "../lib/studio/document/validate";
import { motionWorldMatrices } from "../lib/studio/v2/motion";
import { createHumanoidStudy } from "../lib/studio/v2/studies/humanoid";

describe("humanoid robot study", () => {
  it("is a valid, fully parametric robot mechanism", () => {
    const document = createHumanoidStudy();
    expect(validateDocument(document)).toEqual([]);
    expect(document.definitions).toHaveLength(9);
    expect(document.instances).toHaveLength(15);
    expect(document.groups).toHaveLength(12);
    expect(document.joints).toHaveLength(12);
    expect(document.drivers).toHaveLength(1);
    expect(document.drivers[0]).toMatchObject({ name: "walk_phase", min: 0, max: 360 });
    for (const definition of document.definitions) {
      const audit = auditParameterization(definition.source);
      expect(audit.ok, `${definition.name}: ${audit.message}`).toBe(true);
    }
  });

  it("moves nested limb groups without joint errors", () => {
    const document = createHumanoidStudy();
    const rest = motionWorldMatrices(document, { "driver-walk": 0 });
    const walk = motionWorldMatrices(document, { "driver-walk": 90 });
    expect(rest.errors).toEqual({});
    expect(walk.errors).toEqual({});
    const handRest = rest.matrices.get("inst-hand-l");
    const handWalk = walk.matrices.get("inst-hand-l");
    expect(handRest).toBeDefined();
    expect(handWalk).toBeDefined();
    if (handRest && handWalk) {
      expect(handWalk.elements.every((value) => Number.isFinite(value))).toBe(true);
      expect(handWalk.elements).not.toEqual(handRest.elements);
    }
    expect(walk.matrices.get("inst-foot-r")?.elements.every((value) => Number.isFinite(value))).toBe(true);
    const passing = motionWorldMatrices(document, { "driver-walk": 0 });
    const contact = motionWorldMatrices(document, { "driver-walk": 90 });
    const passingLeft = passing.matrices.get("inst-foot-l");
    const contactLeft = contact.matrices.get("inst-foot-l");
    expect(passingLeft).toBeDefined();
    expect(contactLeft).toBeDefined();
    if (passingLeft && contactLeft) {
      expect(passingLeft.elements[14]).toBeGreaterThan(contactLeft.elements[14] + 10);
    }
    expect(contactLeft?.elements.every((value) => Number.isFinite(value))).toBe(true);
  });
});
