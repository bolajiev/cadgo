import * as THREE from "three";
import { DEFAULT_MATERIAL } from "../document/defaults";
import type { CadDocument } from "../document/types";
import type { CompiledVariant } from "../compile/types";
import { placedVariants } from "./geometry";
import { inferMaterialMode } from "./material";

export type AssemblyInspection = {
  dataUrl: string;
  width: number;
  height: number;
  views: string[];
};

const TILE = 420;
const COLS = 3;

const VIEW_DEFS: Record<string, { direction: THREE.Vector3; up: THREE.Vector3 }> = {
  iso: { direction: new THREE.Vector3(1, -1.15, 0.85), up: new THREE.Vector3(0, 0, 1) },
  front: { direction: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
  back: { direction: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, 1) },
  left: { direction: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
  right: { direction: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
  top: { direction: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
  bottom: { direction: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
  detail: { direction: new THREE.Vector3(0.7, -1, 0.55), up: new THREE.Vector3(0, 0, 1) },
};

export async function renderAssemblySheet(
  document: CadDocument,
  variants: Record<string, CompiledVariant>,
  title: string,
  requestedViews: string[] = ["iso"],
  options: {
    focusInstanceIds?: string[];
    hiddenInstanceIds?: string[];
    instanceVariants?: Record<string, CompiledVariant>;
  } = {},
): Promise<AssemblyInspection> {
  if (typeof document === "undefined") throw new Error("Inspection sheets render in the browser.");
  const views = requestedViews
    .map((view) => view.trim().toLowerCase())
    .filter((view, index, all) => VIEW_DEFS[view] && all.indexOf(view) === index)
    .slice(0, 10);
  if (!views.length) {
    throw new Error("Choose at least one known view: iso, front, back, left, right, top, bottom or detail.");
  }

  const focus = options.focusInstanceIds?.length ? new Set(options.focusInstanceIds) : null;
  const hidden = new Set(options.hiddenInstanceIds ?? []);
  const placed = placedVariants(document, variants, undefined, undefined, options.instanceVariants).filter((item) => {
    if (hidden.has(item.instance.id)) return false;
    if (focus && !focus.has(item.instance.id)) return false;
    return true;
  });
  if (!placed.length) throw new Error("No visible, compiled instances to render.");

  const canvas = window.document.createElement("canvas");
  const rows = Math.ceil(views.length / COLS);
  canvas.width = TILE * COLS;
  canvas.height = TILE * rows;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the inspection sheet.");
  context.fillStyle = "#f1eee5";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(TILE, TILE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor("#f1eee5", 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f1eee5");
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, -3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-3, 2, 2);
  scene.add(fill);

  const geometries = new Map<string, THREE.BufferGeometry>();
  const materials: THREE.MeshStandardMaterial[] = [];
  const meshes: THREE.Mesh[] = [];

  try {
    for (const item of placed) {
      let geometry = geometries.get(item.variant.key);
      if (!geometry) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(item.variant.mesh.positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(item.variant.mesh.colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        geometries.set(item.variant.key, geometry);
      }
      const materialMode = item.materialMode ?? inferMaterialMode(item.material);
      const override = materialMode === "override";
      const opacity = item.material?.opacity ?? 1;
      const material = new THREE.MeshStandardMaterial({
        vertexColors: !override,
        color: override ? item.material?.color ?? DEFAULT_MATERIAL.color : "#ffffff",
        roughness: item.material?.roughness ?? 0.55,
        metalness: item.material?.metalness ?? 0.12,
        flatShading: true,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrix.copy(item.matrix);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrixWorld(true);
      scene.add(mesh);
      meshes.push(mesh);
    }

    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.expandByObject(mesh);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(1, size.length() / 2);
    const distance = radius * 3.4;
    const half = radius * 1.18;
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, radius * 20);

    views.forEach((view, index) => {
      const definition = VIEW_DEFS[view];
      camera.up.copy(definition.up);
      camera.position.copy(center).addScaledVector(definition.direction.clone().normalize(), distance);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const x = (index % COLS) * TILE;
      const y = Math.floor(index / COLS) * TILE;
      context.drawImage(renderer.domElement, x, y, TILE, TILE);
      context.strokeStyle = "#d2cbbc";
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      context.fillStyle = "#191816";
      context.font = "600 16px monospace";
      context.fillText(view.toUpperCase(), x + 14, y + 28);
    });

    context.fillStyle = "#191816";
    context.font = "600 18px monospace";
    context.fillText(title.toUpperCase().slice(0, 46), 18, canvas.height - 20);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.86),
      width: canvas.width,
      height: canvas.height,
      views,
    };
  } finally {
    renderer.dispose();
    for (const geometry of geometries.values()) geometry.dispose();
    for (const material of materials) material.dispose();
  }
}
