import Module, { type Manifold, type ManifoldToplevel } from "manifold-3d";
import type {
  Bounds,
  CadSpec,
  CompileResult,
  CsgNode,
  Part,
  PartMesh,
  Profile,
  Vec2,
} from "./types";
import { resolveNum, resolveVec3, evaluateParameters } from "./expr";

export type Engine = ManifoldToplevel;

let engine: Engine | null = null;

export async function initEngine(locateFile?: () => string): Promise<Engine> {
  if (engine) return engine;
  const instance = await Module(locateFile ? { locateFile } : undefined);
  instance.setup();
  engine = instance;
  return instance;
}

function crossSectionPoints(profile: Profile, vars: Record<string, number>): Vec2[] {
  if (profile.type === "circle") {
    const radius = resolveNum(profile.radius, vars);
    validatePositive(radius, "circle radius");
    const segments = 64;
    return Array.from({ length: segments }, (_, index) => {
      const angle = (index / segments) * Math.PI * 2;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius] as Vec2;
    });
  }
  if (profile.type === "polygon") {
    const points = profile.points.map(
      ([x, y]) => [resolveNum(x, vars), resolveNum(y, vars)] as Vec2,
    );
    return ensureWinding(points);
  }
  const width = resolveNum(profile.width, vars);
  const height = resolveNum(profile.height, vars);
  validatePositive(width, "profile width");
  validatePositive(height, "profile height");
  const radius = profile.radius ? resolveNum(profile.radius, vars) : 0;
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  const hw = width / 2;
  const hh = height / 2;
  if (r < 0.001) {
    return [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
  }
  const points: Vec2[] = [];
  const corners: { cx: number; cy: number; from: number; to: number }[] = [
    { cx: hw - r, cy: -hh + r, from: -90, to: 0 },
    { cx: hw - r, cy: hh - r, from: 0, to: 90 },
    { cx: -hw + r, cy: hh - r, from: 90, to: 180 },
    { cx: -hw + r, cy: -hh + r, from: 180, to: 270 },
  ];
  for (const corner of corners) {
    for (let i = 0; i <= 8; i++) {
      const angle = ((corner.from + ((corner.to - corner.from) * i) / 8) * Math.PI) / 180;
      points.push([
        corner.cx + Math.cos(angle) * r,
        corner.cy + Math.sin(angle) * r,
      ]);
    }
  }
  return points;
}

function ensureWinding(points: Vec2[]): Vec2[] {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area < 0 ? [...points].reverse() : points;
}

function validatePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function polylineArea(points: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function transformGroup(
  manifold: Manifold,
  center: [number, number, number],
  axis: "x" | "y" | "z",
  angle: number,
): Manifold {
  const [cx, cy, cz] = center;
  let result = manifold.translate(-cx, -cy, -cz);
  if (axis === "z") result = result.rotate(0, 0, angle);
  else if (axis === "x") result = result.rotate(angle, 0, 0);
  else result = result.rotate(0, angle, 0);
  return result.translate(cx, cy, cz);
}

function buildNode(
  top: Engine,
  node: CsgNode,
  vars: Record<string, number>,
): Manifold {
  const { Manifold: M, CrossSection: CS } = top;
  switch (node.op) {
    case "box": {
      const size = resolveVec3(node.size, vars);
      for (const value of size) validatePositive(value, "box size");
      return M.cube(size, node.center !== false);
    }
    case "cylinder": {
      const radius = resolveNum(node.radius, vars);
      const height = resolveNum(node.height, vars);
      validatePositive(radius, "cylinder radius");
      validatePositive(height, "cylinder height");
      return M.cylinder(
        height,
        radius,
        radius,
        node.segments ?? 64,
        node.center !== false,
      );
    }
    case "cone": {
      const radiusBottom = resolveNum(node.radiusBottom, vars);
      const radiusTop = resolveNum(node.radiusTop, vars);
      const height = resolveNum(node.height, vars);
      validatePositive(radiusBottom, "cone bottom radius");
      validatePositive(height, "cone height");
      if (radiusTop < 0) throw new Error("cone top radius cannot be negative");
      return M.cylinder(
        height,
        radiusBottom,
        radiusTop,
        node.segments ?? 64,
        node.center !== false,
      );
    }
    case "sphere": {
      const radius = resolveNum(node.radius, vars);
      validatePositive(radius, "sphere radius");
      return M.sphere(radius, node.segments ?? 48);
    }
    case "extrude": {
      const height = resolveNum(node.height, vars);
      validatePositive(height, "extrude height");
      const points = crossSectionPoints(node.profile, vars);
      if (points.length < 3) throw new Error("extrude profile needs three points");
      const section = new CS(points);
      const twist = node.twist ? resolveNum(node.twist, vars) : 0;
      const scaleTop = node.scaleTop ? resolveNum(node.scaleTop, vars) : 1;
      let solid = section.extrude(
        height,
        Math.abs(twist) > 0.01 ? Math.max(2, Math.ceil(Math.abs(twist) / 30)) : undefined,
        twist,
        scaleTop,
        false,
      );
      section.delete();
      if (node.center !== false) solid = solid.translate(0, 0, -height / 2);
      return solid;
    }
    case "revolve": {
      const points = node.profile.map(
        ([r, z]) => [resolveNum(r, vars), resolveNum(z, vars)] as Vec2,
      );
      for (const [r] of points) {
        if (r < -0.001) throw new Error("revolve radius cannot be negative");
      }
      const wound = ensureWinding(points);
      if (polylineArea(wound) <= 0) throw new Error("revolve profile is empty");
      const section = new CS(wound);
      const solid = section.revolve(node.segments ?? 72);
      section.delete();
      return solid;
    }
    case "union": {
      const a = buildNode(top, node.a, vars);
      const b = buildNode(top, node.b, vars);
      const result = a.add(b);
      a.delete();
      b.delete();
      return result;
    }
    case "difference": {
      const a = buildNode(top, node.a, vars);
      const b = buildNode(top, node.b, vars);
      const result = a.subtract(b);
      a.delete();
      b.delete();
      return result;
    }
    case "intersection": {
      const a = buildNode(top, node.a, vars);
      const b = buildNode(top, node.b, vars);
      const result = a.intersect(b);
      a.delete();
      b.delete();
      return result;
    }
    case "translate": {
      const by = resolveVec3(node.by, vars);
      const child = buildNode(top, node.child, vars);
      const result = child.translate(by);
      child.delete();
      return result;
    }
    case "rotate": {
      const degrees = resolveVec3(node.degrees, vars);
      const child = buildNode(top, node.child, vars);
      const result = child.rotate(degrees);
      child.delete();
      return result;
    }
    case "mirror": {
      const normal = resolveVec3(node.normal, vars);
      const child = buildNode(top, node.child, vars);
      const result = child.mirror(normal);
      child.delete();
      return result;
    }
    case "pattern": {
      const base = buildNode(top, node.child, vars);
      const copies: Manifold[] = [];
      if (node.mode === "linear") {
        if (!node.step) throw new Error("linear pattern needs a step vector");
        const step = resolveVec3(node.step, vars);
        for (let index = 0; index < node.count; index++) {
          copies.push(base.translate(step[0] * index, step[1] * index, step[2] * index));
        }
      } else {
        const center = node.center ? resolveVec3(node.center, vars) : ([0, 0, 0] as [number, number, number]);
        for (let index = 0; index < node.count; index++) {
          copies.push(
            transformGroup(
              base,
              center,
              node.axis ?? "z",
              (360 / node.count) * index,
            ),
          );
        }
      }
      const result = copies.length === 1 ? copies[0] : M.union(copies);
      if (copies.length > 1) copies.forEach((copy) => copy.delete());
      base.delete();
      return result;
    }
    case "bolt": {
      const diameter = resolveNum(node.diameter, vars);
      const length = resolveNum(node.length, vars);
      const headDiameter = node.headDiameter
        ? resolveNum(node.headDiameter, vars)
        : diameter * 1.8;
      const headHeight = node.headHeight
        ? resolveNum(node.headHeight, vars)
        : diameter * 0.65;
      validatePositive(diameter, "bolt diameter");
      validatePositive(length, "bolt length");
      const shaft = M.cylinder(length, diameter / 2, diameter / 2, 32, false);
      const head = M.cylinder(headHeight, headDiameter / 2, headDiameter / 2, 6, false);
      const result = shaft.add(head);
      shaft.delete();
      head.delete();
      return result;
    }
  }
}

function buildPart(top: Engine, part: Part, vars: Record<string, number>): PartMesh {
  let solid: Manifold | null = null;
  try {
    solid = buildNode(top, part.shape, vars);
    const volume = solid.volume();
    if (!Number.isFinite(volume) || volume <= 0.0001) {
      throw new Error("solid is empty");
    }
    const box = solid.boundingBox();
    const withNormals = solid.calculateNormals(0, 28);
    const mesh = withNormals.getMesh(0);
    const count = mesh.vertProperties.length / mesh.numProp;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const base = index * mesh.numProp;
      positions[index * 3] = mesh.vertProperties[base];
      positions[index * 3 + 1] = mesh.vertProperties[base + 1];
      positions[index * 3 + 2] = mesh.vertProperties[base + 2];
      if (mesh.numProp >= 6) {
        normals[index * 3] = mesh.vertProperties[base + 3];
        normals[index * 3 + 1] = mesh.vertProperties[base + 4];
        normals[index * 3 + 2] = mesh.vertProperties[base + 5];
      }
    }
    const indices = new Uint32Array(mesh.triVerts);
    withNormals.delete();
    solid.delete();
    solid = null;
    return {
      id: part.id,
      positions,
      normals,
      indices,
      volume,
      bounds: { min: box.min, max: box.max },
      triangles: indices.length / 3,
    };
  } catch (error) {
    if (solid) solid.delete();
    throw new Error(
      `${part.name || part.id}: ${error instanceof Error ? error.message : "geometry failed"}`,
    );
  }
}

function unionBounds(parts: PartMesh[]): Bounds | null {
  if (!parts.length) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], part.bounds.min[i]);
      max[i] = Math.max(max[i], part.bounds.max[i]);
    }
  }
  return { min, max };
}

export async function compileSpec(
  spec: CadSpec,
  locateFile?: () => string,
): Promise<CompileResult> {
  const started = performance.now();
  const top = await initEngine(locateFile);
  const vars = evaluateParameters(spec.parameters);
  const parts: PartMesh[] = [];
  const errors: { part: string; message: string }[] = [];
  for (const part of spec.parts) {
    if (part.hidden) continue;
    try {
      parts.push(buildPart(top, part, vars));
    } catch (error) {
      errors.push({
        part: part.id,
        message: error instanceof Error ? error.message : "geometry failed",
      });
    }
  }
  return {
    parts,
    errors,
    totalVolume: parts.reduce((total, part) => total + part.volume, 0),
    bounds: unionBounds(parts),
    ms: Math.round(performance.now() - started),
  };
}

export function disposePartMesh(mesh: PartMesh) {
  mesh.positions = new Float32Array(0);
  mesh.normals = new Float32Array(0);
  mesh.indices = new Uint32Array(0);
}
