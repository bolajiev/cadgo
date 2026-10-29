"use client";

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { CadSpec, PartMesh, Vec3 } from "@/lib/cad/types";
import { MATERIALS } from "@/lib/cad/materials";

function offsetMatrix(offset: Vec3) {
  return new Matrix4().makeTranslation(offset[0], offset[1], offset[2]);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadStl(
  meshes: PartMesh[],
  matrices: Record<string, Matrix4>,
  offset: Vec3,
  filename: string,
) {
  let triangleCount = 0;
  for (const part of meshes) triangleCount += part.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const header = "Cadgo · mm · watertight assembly";
  for (let index = 0; index < 80; index++) {
    view.setUint8(index, index < header.length ? header.charCodeAt(index) : 32);
  }
  view.setUint32(80, triangleCount, true);
  const world = offsetMatrix(offset);
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  let cursor = 84;
  for (const part of meshes) {
    const matrix = new Matrix4().copy(world).multiply(matrices[part.id] ?? new Matrix4());
    const positions = part.positions;
    for (let index = 0; index < part.indices.length; index += 3) {
      for (let corner = 0; corner < 3; corner++) {
        const base = part.indices[index + corner] * 3;
        vertices[corner]
          .set(positions[base], positions[base + 1], positions[base + 2])
          .applyMatrix4(matrix);
      }
      const a = vertices[0];
      const b = vertices[1];
      const c = vertices[2];
      const ab = new Vector3().subVectors(b, a);
      const ac = new Vector3().subVectors(c, a);
      const normal = new Vector3().crossVectors(ab, ac).normalize();
      view.setFloat32(cursor, normal.x, true);
      view.setFloat32(cursor + 4, normal.y, true);
      view.setFloat32(cursor + 8, normal.z, true);
      for (let corner = 0; corner < 3; corner++) {
        const vertex = vertices[corner];
        view.setFloat32(cursor + 12 + corner * 12, vertex.x, true);
        view.setFloat32(cursor + 16 + corner * 12, vertex.y, true);
        view.setFloat32(cursor + 20 + corner * 12, vertex.z, true);
      }
      view.setUint16(cursor + 48, 0, true);
      cursor += 50;
    }
  }
  triggerDownload(new Blob([buffer], { type: "model/stl" }), filename);
}

function geometryFor(part: PartMesh) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(part.positions.slice(), 3));
  geometry.setAttribute("normal", new BufferAttribute(part.normals.slice(), 3));
  geometry.setIndex(new BufferAttribute(part.indices.slice(), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export async function downloadGlb(
  spec: CadSpec,
  meshes: PartMesh[],
  matrices: Record<string, Matrix4>,
  offset: Vec3,
  filename: string,
) {
  const group = new Group();
  group.name = spec.name;
  const world = offsetMatrix(offset);
  for (const part of meshes) {
    const source = spec.parts.find((item) => item.id === part.id);
    const material = MATERIALS[source?.material ?? "aluminium"];
    const mesh = new Mesh(
      geometryFor(part),
      new MeshStandardMaterial({
        color: material.color,
        metalness: material.metalness,
        roughness: material.roughness,
        emissive: source?.material === "bulb" ? material.color : "#000000",
        emissiveIntensity: source?.material === "bulb" ? 0.7 : 0,
      }),
    );
    mesh.name = source?.name ?? part.id;
    mesh.matrix.copy(new Matrix4().copy(world).multiply(matrices[part.id] ?? new Matrix4()));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  exporter.parse(
    group,
    (result) => {
      const blob =
        result instanceof ArrayBuffer
          ? new Blob([result], { type: "model/gltf-binary" })
          : new Blob([JSON.stringify(result, null, 2)], { type: "model/gltf+json" });
      triggerDownload(blob, filename);
    },
    (error) => {
      console.error(error);
    },
    { binary: true, onlyVisible: true },
  );
}
