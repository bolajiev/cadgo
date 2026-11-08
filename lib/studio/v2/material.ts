import { DEFAULT_MATERIAL } from "../document/defaults";
import type { MaterialMode, MaterialRef } from "../document/types";

export type ResolvedPlacedMaterial = {
  mode: MaterialMode;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
};

export function isMaterialMode(value: unknown): value is MaterialMode {
  return value === "source" || value === "override";
}

export function isDefaultMaterial(material?: MaterialRef): boolean {
  if (!material) return true;
  return (
    material.color === DEFAULT_MATERIAL.color &&
    material.metalness === DEFAULT_MATERIAL.metalness &&
    material.roughness === DEFAULT_MATERIAL.roughness &&
    (material.opacity ?? DEFAULT_MATERIAL.opacity) === DEFAULT_MATERIAL.opacity
  );
}

export function inferMaterialMode(material?: MaterialRef, explicit?: MaterialMode): MaterialMode {
  if (explicit) return explicit;
  return isDefaultMaterial(material) ? "source" : "override";
}

export function resolvePlacedMaterial(
  definitionMaterial?: MaterialRef,
  definitionMode?: MaterialMode,
  instanceMaterial?: MaterialRef,
  instanceMode?: MaterialMode,
): ResolvedPlacedMaterial {
  const material = instanceMaterial ?? definitionMaterial ?? DEFAULT_MATERIAL;
  const mode = instanceMode
    ? instanceMode
    : instanceMaterial
      ? inferMaterialMode(instanceMaterial)
      : definitionMode
        ? definitionMode
        : inferMaterialMode(definitionMaterial);
  return {
    mode,
    color: material.color,
    metalness: material.metalness,
    roughness: material.roughness,
    opacity: material.opacity ?? DEFAULT_MATERIAL.opacity,
  };
}
