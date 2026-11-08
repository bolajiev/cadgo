import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";
import { validateDocument } from "../lib/studio/document/validate";
import { motionLocalTransforms, motionWorldMatrices } from "../lib/studio/v2/motion";
import { createLighthouseStudy } from "../lib/studio/v2/studies/lighthouse";

describe("lighthouse scene study", () => {
  it("is a valid, fully parametric driven scene", () => {
    const document = createLighthouseStudy();
    expect(validateDocument(document)).toEqual([]);
    expect(document.name).toBe("Lighthouse");
    expect(document.definitions).toHaveLength(5);
    expect(document.instances).toHaveLength(5);
    expect(document.groups).toHaveLength(1);
    expect(document.joints).toHaveLength(1);
    expect(document.drivers).toHaveLength(1);
    expect(document.drivers[0]).toMatchObject({
      id: "driver-beacon",
      name: "beacon_angle",
      min: 0,
      max: 360,
    });
    for (const definition of document.definitions) {
      const audit = auditParameterization(definition.source);
      expect(audit.ok, `${definition.name}: ${audit.message}`).toBe(true);
      expect(definition.materialMode).toBe("override");
    }
  });

  it("turns the beacon group while the tower and lamp room stay fixed", () => {
    const document = createLighthouseStudy();
    const rest = motionLocalTransforms(document, { "driver-beacon": 0 });
    const turned = motionLocalTransforms(document, { "driver-beacon": 90 });
    expect(rest.errors).toEqual({});
    expect(turned.errors).toEqual({});

    const beaconRest = rest.groups.get("group-beacon");
    const beaconTurned = turned.groups.get("group-beacon");
    expect(beaconRest).toBeDefined();
    expect(beaconTurned).toBeDefined();
    if (beaconRest && beaconTurned) expect(beaconTurned.equals(beaconRest)).toBe(false);

    for (const instanceId of ["inst-rock", "inst-tower", "inst-lamp", "inst-cap"]) {
      const atRest = rest.instances.get(instanceId);
      const atTurn = turned.instances.get(instanceId);
      expect(atRest).toBeDefined();
      expect(atTurn).toBeDefined();
      if (atRest && atTurn) expect(atTurn.equals(atRest)).toBe(true);
    }

    const world = motionWorldMatrices(document, { "driver-beacon": 90 });
    expect(world.errors).toEqual({});
    expect(world.matrices.get("inst-beacon")?.elements.every((value) => Number.isFinite(value))).toBe(true);
    expect(world.matrices.get("inst-beacon")?.elements[14]).toBeGreaterThan(0);
  });
});
