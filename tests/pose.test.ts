import { describe, expect, it } from "vitest";
import { poseSpec } from "../lib/cad/pose";
import { lampSpec } from "../lib/cad/examples/lamp";

describe("pose solver", () => {
  const values: Record<string, number> = {};
  for (const joint of lampSpec.joints) values[joint.id] = 0;

  it("places the lamp at rest", () => {
    const pose = poseSpec(lampSpec, values);
    const shoulder = pose.matrices.lower_arm.elements.slice(12, 15);
    expect(shoulder[0]).toBeCloseTo(0, 4);
    expect(shoulder[2]).toBeCloseTo(100, 4);
    const elbow = pose.joints.elbow.origin;
    expect(elbow[0]).toBeCloseTo(109, 1);
    expect(elbow[2]).toBeCloseTo(255.6, 1);
  });

  it("clamps a joint to its limits", () => {
    const pose = poseSpec(lampSpec, { ...values, shoulder: 200 });
    expect(pose.joints.shoulder.value).toBe(60);
    const moved = pose.matrices.lower_arm.elements.slice(12, 15);
    expect(moved[0]).toBeCloseTo(0, 4);
    expect(moved[2]).toBeCloseTo(100, 4);
  });
});
