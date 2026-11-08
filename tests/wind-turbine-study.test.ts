import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";
import { validateDocument } from "../lib/studio/document/validate";
import { motionLocalTransforms, motionWorldMatrices } from "../lib/studio/v2/motion";
import { createWindTurbineStudy } from "../lib/studio/v2/studies/windTurbine";

describe("wind turbine study", () => {
  it("is a valid, fully parametric driven rotor assembly", () => {
    const document = createWindTurbineStudy();
    expect(validateDocument(document)).toEqual([]);
    expect(document.name).toBe("Wind turbine");
    expect(document.units).toBe("mm");
    expect(document.definitions).toHaveLength(3);
    expect(document.instances).toHaveLength(3);
    expect(document.groups).toHaveLength(1);
    expect(document.joints).toHaveLength(1);
    expect(document.drivers).toHaveLength(1);
    expect(document.drivers[0]).toMatchObject({
      id: "driver-rotor",
      name: "rotor_angle",
      value: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: "deg",
    });
    for (const definition of document.definitions) {
      const audit = auditParameterization(definition.source);
      expect(audit.ok, `${definition.name}: ${audit.message}`).toBe(true);
      expect(definition.materialMode).toBe("override");
    }
  });

  it("spins the whole rotor group around the hub without moving the tower or nacelle", () => {
    const document = createWindTurbineStudy();
    const rest = motionWorldMatrices(document, { "driver-rotor": 0 });
    const turned = motionWorldMatrices(document, { "driver-rotor": 90 });
    expect(rest.errors).toEqual({});
    expect(turned.errors).toEqual({});

    const rotorRest = rest.matrices.get("inst-rotor");
    const rotorTurned = turned.matrices.get("inst-rotor");
    expect(rotorRest).toBeDefined();
    expect(rotorTurned).toBeDefined();
    if (rotorRest && rotorTurned) {
      expect(rotorTurned.elements.every((value) => Number.isFinite(value))).toBe(true);
      expect(rotorTurned.elements).not.toEqual(rotorRest.elements);
      expect(rotorTurned.elements[14]).toBeGreaterThan(0);
      expect(rotorTurned.elements[14]).toBeCloseTo(rotorRest.elements[14], 5);
    }

    for (const instanceId of ["inst-tower", "inst-nacelle"]) {
      expect(turned.matrices.get(instanceId)?.elements).toEqual(
        rest.matrices.get(instanceId)?.elements,
      );
    }

    const joint = document.joints[0];
    expect(joint.type).toBe("revolute");
    expect(joint.parentInstanceId).toBe("inst-nacelle");
    expect("childGroupId" in joint ? joint.childGroupId : undefined).toBe("group-rotor");
    expect("driverId" in joint ? joint.driverId : undefined).toBe("driver-rotor");
    expect("expression" in joint ? joint.expression : undefined).toBe("angle");
  });

  it("provides local group transforms for GLB animation", () => {
    const document = createWindTurbineStudy();
    const rest = motionLocalTransforms(document, { "driver-rotor": 0 });
    const turned = motionLocalTransforms(document, { "driver-rotor": 90 });
    expect(rest.errors).toEqual({});
    expect(turned.errors).toEqual({});

    const rotorRest = rest.groups.get("group-rotor");
    const rotorTurned = turned.groups.get("group-rotor");
    expect(rotorRest).toBeDefined();
    expect(rotorTurned).toBeDefined();
    if (rotorRest && rotorTurned) expect(rotorTurned.equals(rotorRest)).toBe(false);

    for (const instanceId of ["inst-tower", "inst-nacelle"]) {
      const atRest = rest.instances.get(instanceId);
      const atTurn = turned.instances.get(instanceId);
      expect(atRest).toBeDefined();
      expect(atTurn).toBeDefined();
      if (atRest && atTurn) expect(atTurn.equals(atRest)).toBe(true);
    }
  });
});
