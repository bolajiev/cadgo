import { describe, expect, it } from "vitest";
import { evalExpr, evaluateParameters } from "../lib/cad/expr";

describe("expressions", () => {
  it("evaluates parameters and functions", () => {
    expect(evalExpr("arm * cos(60) + 4", { arm: 100 })).toBeCloseTo(54);
    expect(evalExpr("max(2, min(9, 5))", {})).toBe(5);
    expect(evalExpr("2 ^ 3 ^ 2", {})).toBe(512);
  });

  it("rejects unknown parameters", () => {
    expect(() => evalExpr("missing * 2", {})).toThrow(/Unknown parameter/);
  });

  it("reads parameter values in order", () => {
    expect(
      evaluateParameters([
        { id: "a", label: "A", value: 10 },
        { id: "b", label: "B", value: 20 },
      ]),
    ).toEqual({ a: 10, b: 20 });
  });
});
