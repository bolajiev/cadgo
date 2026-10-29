import { describe, expect, it } from "vitest";
import { cadSpecSchema } from "../lib/cad/schema";
import { lampSpec } from "../lib/cad/examples/lamp";
import { normalizeSpec } from "../lib/cad/validate";

describe("CadSpec schema", () => {
  it("accepts the lamp study", () => {
    expect(() => cadSpecSchema.parse(lampSpec)).not.toThrow();
  });

  it("rejects a spec without parts", () => {
    expect(() =>
      cadSpecSchema.parse({
        version: 1,
        name: "Empty",
        units: "mm",
        parameters: [],
        parts: [],
        joints: [],
      }),
    ).toThrow();
  });

  it("fills missing joint limits", () => {
    const spec = normalizeSpec(lampSpec);
    expect(spec.joints.find((joint) => joint.id === "shoulder")?.limits).toEqual([-30, 60]);
  });
});
