import { strToU8, zipSync } from "fflate";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { DEFAULT_MATERIAL } from "../document/defaults";
import type { CadDocument, MaterialMode, MaterialRef, Transform } from "../document/types";
import type { CompiledVariant } from "../compile/types";
import { safeFileName } from "./bundle";
import { assemblyStl, instanceStl, placedVariants } from "./geometry";
import { buildSceneAnimations, type SceneAnimationOptions } from "./animation";

function applyLocalTransform(object: Object3D, transform: Transform): void {
  object.position.set(transform.position[0], transform.position[1], transform.position[2]);
  object.rotation.set(
    (transform.rotation[0] * Math.PI) / 180,
    (transform.rotation[1] * Math.PI) / 180,
    (transform.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  object.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
}

function variantGeometry(variant: CompiledVariant): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(variant.mesh.positions.slice(), 3));
  geometry.setAttribute("color", new BufferAttribute(variant.mesh.colors.slice(), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function variantMaterial(mode: MaterialMode, material?: MaterialRef): MeshStandardMaterial {
  const override = mode === "override";
  const opacity = material?.opacity ?? DEFAULT_MATERIAL.opacity;
  return new MeshStandardMaterial({
    vertexColors: !override,
    color: override ? material?.color ?? DEFAULT_MATERIAL.color : "#ffffff",
    metalness: material?.metalness ?? DEFAULT_MATERIAL.metalness,
    roughness: material?.roughness ?? DEFAULT_MATERIAL.roughness,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

function disposeScene(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const material = object.material as Material | Material[];
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material.dispose();
    }
  });
}

export function buildPartStlBundle(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
): Uint8Array {
  const placed = placedVariants(document, variants, undefined, undefined, instanceVariants);
  if (!placed.length) {
    throw new Error("There is nothing to export. Wait for a visible part to finish compiling.");
  }
  const assembly = assemblyStl(document, variants, instanceVariants);
  if (!assembly) {
    throw new Error("There is nothing to export. Wait for a visible part to finish compiling.");
  }

  const files: Record<string, Uint8Array> = { "assembly.stl": assembly };
  const instances: {
    id: string;
    name: string;
    definitionId: string;
    definitionName: string;
    file: string;
  }[] = [];

  placed.forEach((item, index) => {
    const definition = document.definitions.find((entry) => entry.id === item.instance.definitionId);
    const base = `${String(index + 1).padStart(2, "0")}-${safeFileName(item.instance.name)}`;
    let file = `parts/${base}.stl`;
    let duplicate = 2;
    while (files[file]) {
      file = `parts/${base}-${duplicate}.stl`;
      duplicate += 1;
    }
    files[file] = instanceStl(item.variant, item.matrix);
    instances.push({
      id: item.instance.id,
      name: item.instance.name,
      definitionId: item.instance.definitionId,
      definitionName: definition?.name ?? item.instance.definitionId,
      file,
    });
  });

  const manifest = {
    name: document.name,
    units: document.units,
    exportedAt: new Date().toISOString(),
    assembly: "assembly.stl",
    definitions: document.definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
    })),
    instances,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["README.txt"] = strToU8(
    [
      "Cadgo scene export",
      "",
      `Document: ${document.name}`,
      `Units: ${document.units} (millimetres)`,
      `Definitions: ${document.definitions.length}`,
      `Exported instances: ${instances.length}`,
      "",
      "assembly.stl is the merged, visible assembly.",
      "Each file in parts/ is one visible instance, positioned in assembly space.",
      "manifest.json lists the definitions and the instance files in this archive.",
      "All coordinates and sizes are millimetres.",
      "",
      "This is concept CAD, not a validated manufacturing artifact.",
      "",
    ].join("\n"),
  );

  return zipSync(files, { level: 6 });
}

function uniqueName(used: Set<string>, base: string): string {
  const trimmed = base.trim() || "Object";
  let name = trimmed;
  let index = 2;
  while (used.has(name)) {
    name = `${trimmed} ${index}`;
    index += 1;
  }
  used.add(name);
  return name;
}

export function buildSceneGroup(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
): Group {
  const usedNames = new Set<string>();
  const root = new Group();
  root.name = uniqueName(usedNames, document.name);

  const groupObjects = new Map<string, Group>();
  for (const group of document.groups) {
    const object = new Group();
    object.name = uniqueName(usedNames, group.name);
    object.visible = group.visible;
    object.userData.cadgoId = group.id;
    applyLocalTransform(object, group.transform);
    groupObjects.set(group.id, object);
  }
  for (const group of document.groups) {
    const object = groupObjects.get(group.id);
    if (!object) continue;
    const parent = group.parentId ? groupObjects.get(group.parentId) : undefined;
    (parent ?? root).add(object);
  }

  for (const item of placedVariants(document, variants, undefined, undefined, instanceVariants)) {
    const mesh = new Mesh(
      variantGeometry(item.variant),
      variantMaterial(item.materialMode ?? "source", item.material),
    );
    mesh.name = uniqueName(usedNames, item.instance.name);
    mesh.userData.cadgoId = item.instance.id;
    applyLocalTransform(mesh, item.instance.transform);
    const parent = item.instance.parentId ? groupObjects.get(item.instance.parentId) : undefined;
    (parent ?? root).add(mesh);
  }

  return root;
}

export type SceneGlbOptions = SceneAnimationOptions & {
  animations?: boolean;
};

export type SceneGlbResult = {
  buffer: ArrayBuffer;
  animationCount: number;
};

export async function buildSceneGlb(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant> = {},
  options: SceneGlbOptions = {},
): Promise<SceneGlbResult> {
  const root = buildSceneGroup(document, variants, instanceVariants);
  try {
    const animations = options.animations === false ? [] : buildSceneAnimations(document, root, options);
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(root, {
      binary: true,
      onlyVisible: true,
      animations,
    });
    if (!(result instanceof ArrayBuffer)) {
      throw new Error("Scene GLB export did not produce a binary buffer.");
    }
    return { buffer: result, animationCount: animations.length };
  } finally {
    disposeScene(root);
  }
}
