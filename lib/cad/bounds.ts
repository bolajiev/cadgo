import { Matrix4, Vector3 } from "three";
import type { Bounds, PartMesh } from "./types";

export function poseBounds(
  meshes: PartMesh[],
  matrices: Record<string, Matrix4>,
): Bounds | null {
  if (!meshes.length) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const point = new Vector3();
  for (const mesh of meshes) {
    const matrix = matrices[mesh.id];
    if (!matrix) continue;
    for (const x of [mesh.bounds.min[0], mesh.bounds.max[0]]) {
      for (const y of [mesh.bounds.min[1], mesh.bounds.max[1]]) {
        for (const z of [mesh.bounds.min[2], mesh.bounds.max[2]]) {
          point.set(x, y, z).applyMatrix4(matrix);
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
  if (!Number.isFinite(min[0])) return null;
  return { min, max };
}
