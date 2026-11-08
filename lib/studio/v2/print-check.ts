import type { CadDocument, Vec3 } from "../document/types";
import type { CompiledVariant } from "../compile/types";
import { DEFAULT_MAX_OVERHANG_PERCENT, type PrintProfile } from "../profile";
import { assemblyBounds, placedVariants } from "./geometry";

export const MATERIAL_DENSITY: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  Resin: 1.1,
};

export type PrintCheckPart = {
  instanceId: string;
  name: string;
  definitionName: string;
  watertight: boolean;
  overhangPercent: number;
  volumeMm3: number;
  triangles: number;
};

export type PrintCheckReport = {
  purpose: PrintProfile["purpose"] | null;
  parts: PrintCheckPart[];
  errors: string[];
  warnings: string[];
  ready: boolean;
  bounds: { min: Vec3; max: Vec3 } | null;
  dimensions: { x: number; y: number; z: number } | null;
  bed: PrintProfile["bed"] | null;
  fitsBed: boolean | null;
  overhangLimit: number;
  supports: NonNullable<PrintProfile["supports"]>;
  material?: string;
  solidVolumeMm3: number;
  estimatedMassG?: number;
};

export function buildPrintCheck(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
  profile: PrintProfile | null = null,
): PrintCheckReport {
  const placed = placedVariants(document, variants, undefined, undefined, instanceVariants);
  const parts: PrintCheckPart[] = placed.map((item) => {
    const definition = document.definitions.find((entry) => entry.id === item.instance.definitionId);
    return {
      instanceId: item.instance.id,
      name: item.instance.name,
      definitionName: definition?.name ?? item.instance.definitionId,
      watertight: item.variant.metrics.boundaryEdges === 0 && item.variant.metrics.nonManifoldEdges === 0,
      overhangPercent: item.variant.metrics.overhangPercent,
      volumeMm3: item.variant.metrics.volume,
      triangles: item.variant.metrics.triangles,
    };
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  const overhangLimit = profile?.maxOverhangPercent ?? DEFAULT_MAX_OVERHANG_PERCENT;
  const supports = profile?.supports ?? "none";

  for (const part of parts) {
    if (!part.watertight) errors.push(`${part.name} is not watertight.`);
  }

  if (!profile) {
    warnings.push("Set a 3D printing profile to check the bed and overhang.");
  } else if (profile.purpose !== "3d-print") {
    warnings.push("This profile is not for 3D printing; only watertightness is checked.");
  } else {
    for (const part of parts) {
      if (part.overhangPercent > overhangLimit && supports !== "allowed") {
        warnings.push(
          `${part.name} has ${part.overhangPercent.toFixed(0)}% overhang over ${overhangLimit.toFixed(0)}%; enable supports or reorient it.`,
        );
      }
    }
  }

  const bounds = assemblyBounds(document, variants, instanceVariants);
  const dimensions = bounds
    ? {
        x: bounds.max[0] - bounds.min[0],
        y: bounds.max[1] - bounds.min[1],
        z: bounds.max[2] - bounds.min[2],
      }
    : null;
  const bed = profile?.purpose === "3d-print" ? profile.bed ?? null : null;
  let fitsBed: boolean | null = null;
  if (profile?.purpose === "3d-print") {
    if (!bed) {
      warnings.push("No print bed size is set.");
    } else if (dimensions) {
      fitsBed = true;
      const axes: [keyof typeof dimensions, number][] = [
        ["x", bed.x],
        ["y", bed.y],
        ["z", bed.z],
      ];
      for (const [axis, limit] of axes) {
        const value = dimensions[axis];
        if (value > limit) {
          fitsBed = false;
          errors.push(`Assembly exceeds the ${axis.toUpperCase()} bed by ${(value - limit).toFixed(1)} mm.`);
        }
      }
    }
  }

  const solidVolumeMm3 = parts.reduce((sum, part) => sum + part.volumeMm3, 0);
  const density = profile?.material ? MATERIAL_DENSITY[profile.material] : undefined;

  return {
    purpose: profile?.purpose ?? null,
    parts,
    errors,
    warnings,
    ready: errors.length === 0,
    bounds,
    dimensions,
    bed,
    fitsBed,
    overhangLimit,
    supports,
    material: profile?.material,
    solidVolumeMm3,
    estimatedMassG: density ? (solidVolumeMm3 / 1000) * density : undefined,
  };
}
