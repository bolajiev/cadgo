import type { CadDocument, MaterialRef, Transform } from "./types";

export function newId(prefix = "id"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid.slice(0, 8)}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function identityTransform(): Transform {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
}

export const DEFAULT_MATERIAL: Required<MaterialRef> = {
  color: "#b9b2a4",
  metalness: 0.15,
  roughness: 0.55,
  opacity: 1,
};

export function defaultMaterial(): MaterialRef {
  return { ...DEFAULT_MATERIAL };
}

export function createEmptyDocument(name = "Untitled assembly"): CadDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: newId("doc"),
    name,
    revision: 1,
    units: "mm",
    library: "",
    groups: [],
    definitions: [],
    instances: [],
    joints: [],
    drivers: [],
    createdAt: now,
    updatedAt: now,
  };
}
