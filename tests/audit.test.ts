import { describe, expect, it } from "vitest";
import { auditParameterization } from "../lib/scad/audit";

describe("parameterization audit", () => {
  it("passes a fully parametric source", () => {
    const result = auditParameterization(`
width = 20; // [10:40]
depth = 12; // [5:30]
height = 6; // [2:20]
half = width / 2;
module body() {
  cube([width, depth, height], center = true);
  translate([0, 0, 0]) cylinder(h = height, d = depth, center = true);
}
color([0.3, 0.4, 0.5]) body();
`);
    expect(result.ok).toBe(true);
    expect(result.params).toBe(3);
  });

  it("flags literal dimensions inside modules", () => {
    const result = auditParameterization(`
width = 20; // [10:40]
module body() {
  cube([width, 12, 6], center = true);
}
`);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.value === "12")).toBe(true);
    expect(result.issues.some((issue) => issue.value === "6")).toBe(true);
  });

  it("ignores colour channels and allowed invariants", () => {
    const result = auditParameterization(`
width = 20; // [10:40]
module body() {
  rotate([0, 0, 90]) cube([width, width, 2], center = true);
}
color([0.3, 0.4, 0.5]) body();
`);
    expect(result.ok).toBe(true);
  });
});
