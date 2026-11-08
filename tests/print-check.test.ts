import { describe, expect, it } from "vitest";
import type { CompiledVariant } from "../lib/studio/compile/types";
import { createEmptyDocument, defaultMaterial, identityTransform } from "../lib/studio/document/defaults";
import type { CadDocument } from "../lib/studio/document/types";
import type { PrintProfile } from "../lib/studio/profile";
import { buildPrintCheck } from "../lib/studio/v2/print-check";

function document(): CadDocument {
  const doc = createEmptyDocument("Bracket");
  doc.definitions.push({
    id: "def-bracket",
    name: "Bracket",
    source: "cube([10, 10, 10]);",
    params: [],
    material: defaultMaterial(),
    materialMode: "source",
    locked: false,
    revision: 1,
  });
  doc.instances.push({
    id: "inst-bracket",
    definitionId: "def-bracket",
    name: "Bracket",
    parentId: null,
    transform: identityTransform(),
    visible: true,
    locked: false,
    suppressed: false,
    revision: 1,
  });
  return doc;
}

function variant(overrides: { overhangPercent?: number; boundaryEdges?: number } = {}): CompiledVariant {
  const overhangPercent = overrides.overhangPercent ?? 10;
  const boundaryEdges = overrides.boundaryEdges ?? 0;
  const bounds = { min: [0, 0, 0] as [number, number, number], max: [10, 10, 10] as [number, number, number] };
  return {
    key: "def-bracket@1",
    mesh: {
      positions: new Float32Array(),
      colors: new Float32Array(),
      triangles: 12,
      components: 1,
      floating: 0,
      boundaryEdges,
      nonManifoldEdges: 0,
      volume: 1000,
      surfaceArea: 600,
      overhangArea: 10,
      overhangPercent,
      componentIds: new Uint32Array(),
      bounds,
    },
    metrics: {
      triangles: 12,
      components: 1,
      bounds,
      volume: 1000,
      surfaceArea: 600,
      boundaryEdges,
      nonManifoldEdges: 0,
      overhangArea: 10,
      overhangPercent,
      compileMs: 1,
    },
    params: {},
    logs: "",
    duration: 1,
  };
}

const profile: PrintProfile = {
  purpose: "3d-print",
  printer: "Test printer",
  bed: { x: 100, y: 100, z: 100 },
  material: "PLA",
  supports: "none",
  maxOverhangPercent: 35,
};

describe("print check", () => {
  it("reports a clean part and a solid mass estimate", () => {
    const report = buildPrintCheck(document(), { "def-bracket": variant() }, {}, profile);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.ready).toBe(true);
    expect(report.parts).toHaveLength(1);
    expect(report.parts[0].watertight).toBe(true);
    expect(report.dimensions).toEqual({ x: 10, y: 10, z: 10 });
    expect(report.fitsBed).toBe(true);
    expect(report.solidVolumeMm3).toBe(1000);
    expect(report.estimatedMassG).toBeCloseTo(1.24);
  });

  it("blocks a part that exceeds the bed", () => {
    const report = buildPrintCheck(
      document(),
      { "def-bracket": variant() },
      {},
      { ...profile, bed: { x: 5, y: 100, z: 100 } },
    );
    expect(report.ready).toBe(false);
    expect(report.fitsBed).toBe(false);
    expect(report.errors.some((issue) => issue.includes("X bed"))).toBe(true);
  });

  it("warns about overhang unless supports are allowed", () => {
    const withWarning = buildPrintCheck(document(), { "def-bracket": variant({ overhangPercent: 50 }) }, {}, profile);
    expect(withWarning.errors).toEqual([]);
    expect(withWarning.warnings.some((issue) => issue.includes("overhang"))).toBe(true);

    const withSupports = buildPrintCheck(
      document(),
      { "def-bracket": variant({ overhangPercent: 50 }) },
      {},
      { ...profile, supports: "allowed" },
    );
    expect(withSupports.warnings).toEqual([]);
  });

  it("blocks a non-watertight part", () => {
    const report = buildPrintCheck(document(), { "def-bracket": variant({ boundaryEdges: 3 }) }, {}, profile);
    expect(report.ready).toBe(false);
    expect(report.parts[0].watertight).toBe(false);
    expect(report.errors.some((issue) => issue.includes("not watertight"))).toBe(true);
  });

  it("does not imply print checks without a print profile", () => {
    const report = buildPrintCheck(document(), { "def-bracket": variant() }, {}, null);
    expect(report.purpose).toBeNull();
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((issue) => issue.includes("3D printing profile"))).toBe(true);
    expect(report.fitsBed).toBeNull();
    expect(report.estimatedMassG).toBeUndefined();
  });

  it("skips bed and overhang checks for a non-print profile", () => {
    const report = buildPrintCheck(
      document(),
      { "def-bracket": variant({ overhangPercent: 50 }) },
      {},
      { purpose: "visualization", maxOverhangPercent: 35 },
    );
    expect(report.warnings.some((issue) => issue.includes("not for 3D printing"))).toBe(true);
    expect(report.bed).toBeNull();
    expect(report.fitsBed).toBeNull();
  });
});
