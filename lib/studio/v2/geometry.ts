import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { binaryStl } from "../../scad/stl";
import type { ScadMesh } from "../../scad/types";
import type { CadDocument, MaterialMode, MaterialRef, PartInstance, Transform } from "../document/types";
import type { CompiledVariant } from "../compile/types";
import { resolvePlacedMaterial } from "./material";

export type PlacedVariant = {
  instance: PartInstance;
  variant: CompiledVariant;
  matrix: Matrix4;
  material?: MaterialRef;
  materialMode?: MaterialMode;
};

export function transformMatrix(transform: Transform): Matrix4 {
  const position = new Vector3(...transform.position);
  const quaternion = new Quaternion().setFromEuler(
    new Euler(
      (transform.rotation[0] * Math.PI) / 180,
      (transform.rotation[1] * Math.PI) / 180,
      (transform.rotation[2] * Math.PI) / 180,
      "XYZ",
    ),
  );
  const scale = new Vector3(...transform.scale);
  return new Matrix4().compose(position, quaternion, scale);
}

export function groupMatrix(document: CadDocument, groupId: string | null): Matrix4 {
  if (!groupId) return new Matrix4();
  const group = document.groups.find((item) => item.id === groupId);
  if (!group) return new Matrix4();
  return groupMatrix(document, group.parentId).multiply(transformMatrix(group.transform));
}

export function instanceMatrix(document: CadDocument, instance: PartInstance): Matrix4 {
  return groupMatrix(document, instance.parentId).multiply(transformMatrix(instance.transform));
}

export function groupVisible(document: CadDocument, groupId: string | null): boolean {
  if (!groupId) return true;
  const group = document.groups.find((item) => item.id === groupId);
  if (!group) return true;
  return group.visible && groupVisible(document, group.parentId);
}

export function placedVariants(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  jointMatrices?: Map<string, Matrix4>,
  worldMatrices?: Map<string, Matrix4>,
  instanceVariants: Record<string, CompiledVariant> = {},
): PlacedVariant[] {
  const placed: PlacedVariant[] = [];
  for (const instance of document.instances) {
    if (!instance.visible || instance.suppressed) continue;
    if (!groupVisible(document, instance.parentId)) continue;
    const variant = instanceVariants[instance.id] ?? variants[instance.definitionId];
    if (!variant) continue;
    const matrix = worldMatrices?.get(instance.id) ?? instanceMatrix(document, instance);
    const local = jointMatrices?.get(instance.id);
    if (!worldMatrices && local) matrix.multiply(local);
    const definition = document.definitions.find((item) => item.id === instance.definitionId);
    const resolved = resolvePlacedMaterial(
      definition?.material,
      definition?.materialMode,
      instance.material,
      instance.materialMode,
    );
    placed.push({
      instance,
      variant,
      matrix,
      material: instance.material ?? definition?.material,
      materialMode: resolved.mode,
    });
  }
  return placed;
}

export function assemblyBounds(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
): { min: [number, number, number]; max: [number, number, number] } | null {
  const placed = placedVariants(document, variants, undefined, undefined, instanceVariants);
  if (!placed.length) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const point = new Vector3();
  for (const item of placed) {
    const bounds = item.variant.mesh.bounds;
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          point.set(x, y, z).applyMatrix4(item.matrix);
          min[0] = Math.min(min[0], point.x);
          min[1] = Math.min(min[1], point.y);
          min[2] = Math.min(min[2], point.z);
          max[0] = Math.max(max[0], point.x);
          max[1] = Math.max(max[1], point.y);
          max[2] = Math.max(max[2], point.z);
        }
      }
    }
  }
  return { min, max };
}

export function transformedPositions(mesh: ScadMesh, matrix: Matrix4): Float32Array {
  const positions = new Float32Array(mesh.positions.length);
  const point = new Vector3();
  for (let index = 0; index < mesh.positions.length; index += 3) {
    point
      .set(mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2])
      .applyMatrix4(matrix);
    positions[index] = point.x;
    positions[index + 1] = point.y;
    positions[index + 2] = point.z;
  }
  return positions;
}

export function assemblyStl(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
): Uint8Array | null {
  const placed = placedVariants(document, variants, undefined, undefined, instanceVariants);
  if (!placed.length) return null;
  let total = 0;
  for (const item of placed) total += item.variant.mesh.positions.length;
  const positions = new Float32Array(total);
  let cursor = 0;
  for (const item of placed) {
    const transformed = transformedPositions(item.variant.mesh, item.matrix);
    positions.set(transformed, cursor);
    cursor += transformed.length;
  }
  return binaryStl(positions);
}

export function instanceStl(variant: CompiledVariant, matrix: Matrix4): Uint8Array {
  return binaryStl(transformedPositions(variant.mesh, matrix));
}
