import { describe, expect, it } from "vitest";
import { parseParameters, setParameterInCode } from "../lib/scad/params";
import { SCAD_EXAMPLES } from "../lib/scad/examples";

describe("OpenSCAD parameter extraction", () => {
  it("reads the knob parameters with ranges", () => {
    const params = parseParameters(SCAD_EXAMPLES[0].code);
    expect(params.map((item) => item.name)).toEqual([
      "diameter",
      "height",
      "shaft",
      "ridges",
      "knurl_depth",
      "set_screw",
    ]);
    const diameter = params.find((item) => item.name === "diameter");
    expect(diameter).toMatchObject({ value: 42, min: 24, max: 70, type: "number" });
  });

  it("updates the source without touching the comment", () => {
    const next = setParameterInCode(SCAD_EXAMPLES[0].code, "height", 30);
    expect(next).toContain("height = 30; // [12:40]");
    expect(parseParameters(next).find((item) => item.name === "height")?.value).toBe(30);
  });

  it("does not expose the internal $fn", () => {
    expect(parseParameters(SCAD_EXAMPLES[0].code).some((item) => item.name === "$fn")).toBe(false);
  });
});
