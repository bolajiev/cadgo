import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { CadSpec, Joint, Vec3 } from "./types";
import { evaluateParameters, resolveVec3 } from "./expr";

export type JointState = {
  id: string;
  type: Joint["type"];
  value: number;
  min: number;
  max: number;
  origin: Vec3;
  axis: Vec3;
  pivotMatrix: Matrix4;
};

export type PoseResult = {
  matrices: Record<string, Matrix4>;
  rest: Record<string, Matrix4>;
  joints: Record<string, JointState>;
};

export function jointLimits(joint: Joint): [number, number] {
  if (joint.limits) return [joint.limits[0], joint.limits[1]];
  if (joint.type === "fixed") return [0, 0];
  if (joint.type === "prismatic") return [-50, 50];
  return [-180, 180];
}

export function clampJoint(joint: Joint, value: number): number {
  const [min, max] = jointLimits(joint);
  return Math.min(max, Math.max(min, value));
}

function matrixForPart(position: Vec3, rotation: Vec3): Matrix4 {
  const matrix = new Matrix4();
  const quaternion = new Quaternion().setFromEuler(
    new Euler(
      (rotation[0] * Math.PI) / 180,
      (rotation[1] * Math.PI) / 180,
      (rotation[2] * Math.PI) / 180,
      "XYZ",
    ),
  );
  matrix.compose(
    new Vector3(position[0], position[1], position[2]),
    quaternion,
    new Vector3(1, 1, 1),
  );
  return matrix;
}

function pivotMatrix(joint: Joint, value: number, vars: Record<string, number>): Matrix4 {
  const origin = resolveVec3(joint.origin, vars);
  const axis = joint.axis
    ? new Vector3(...resolveVec3(joint.axis, vars)).normalize()
    : new Vector3(0, 0, 1);
  const toOrigin = new Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2]);
  const back = new Matrix4().makeTranslation(origin[0], origin[1], origin[2]);
  if (joint.type === "fixed") return new Matrix4();
  if (joint.type === "prismatic") {
    return new Matrix4()
      .makeTranslation(axis.x * value, axis.y * value, axis.z * value)
      .multiply(new Matrix4());
  }
  return back
    .multiply(new Matrix4().makeRotationAxis(axis, (value * Math.PI) / 180))
    .multiply(toOrigin);
}

export function poseSpec(
  spec: CadSpec,
  values: Record<string, number>,
): PoseResult {
  const vars = evaluateParameters(spec.parameters);
  const rest: Record<string, Matrix4> = {};
  const matrices: Record<string, Matrix4> = {};
  for (const part of spec.parts) {
    const position = resolveVec3(part.position, vars);
    const rotation = part.rotation ? resolveVec3(part.rotation, vars) : ([0, 0, 0] as Vec3);
    rest[part.id] = matrixForPart(position, rotation);
    matrices[part.id] = rest[part.id].clone();
  }

  const childJoint = new Map<string, Joint>();
  const children = new Map<string, Joint[]>();
  for (const joint of spec.joints) {
    if (childJoint.has(joint.child)) continue;
    childJoint.set(joint.child, joint);
    const key = joint.parent;
    const list = children.get(key) ?? [];
    list.push(joint);
    children.set(key, list);
  }

  const states: Record<string, JointState> = {};
  const visiting = new Set<string>();

  const walk = (partId: string, parentWorld: Matrix4 | null) => {
    if (visiting.has(partId)) return;
    visiting.add(partId);
    const partJoints = children.get(partId) ?? [];
    for (const joint of partJoints) {
      const [min, max] = jointLimits(joint);
      const raw = values[joint.id] ?? joint.value ?? 0;
      const value = Math.min(max, Math.max(min, raw));
      const parentRest = rest[joint.parent] ?? new Matrix4();
      const parentPosed =
        joint.parent === "world"
          ? new Matrix4()
          : (matrices[joint.parent] ?? parentWorld ?? new Matrix4());
      const pivot = pivotMatrix(joint, value, vars);
      const localPivot = new Matrix4()
        .copy(parentRest)
        .invert()
        .multiply(pivot)
        .multiply(parentRest);
      const offset = new Matrix4()
        .copy(parentRest)
        .invert()
        .multiply(rest[joint.child] ?? new Matrix4());
      const childWorld = new Matrix4()
        .copy(parentPosed)
        .multiply(localPivot)
        .multiply(offset);
      matrices[joint.child] = childWorld;

      const axisSource = joint.axis
        ? new Vector3(...resolveVec3(joint.axis, vars)).normalize()
        : new Vector3(0, 0, 1);
      const pivotGroup = new Matrix4()
        .copy(parentPosed)
        .multiply(localPivot)
        .multiply(new Matrix4().copy(parentRest).invert());
      const origin = resolveVec3(joint.origin, vars);
      const worldOrigin = new Vector3(...origin).applyMatrix4(pivotGroup);
      const rotationPart = new Matrix4().extractRotation(pivotGroup);
      const worldAxis = axisSource.clone().applyMatrix4(rotationPart).normalize();
      states[joint.id] = {
        id: joint.id,
        type: joint.type,
        value,
        min,
        max,
        origin: [worldOrigin.x, worldOrigin.y, worldOrigin.z],
        axis: [worldAxis.x, worldAxis.y, worldAxis.z],
        pivotMatrix: pivotGroup,
      };
      walk(joint.child, childWorld);
    }
    visiting.delete(partId);
  };

  for (const part of spec.parts) {
    if (!childJoint.has(part.id)) {
      walk(part.id, null);
    }
  }
  for (const part of spec.parts) {
    if (!matrices[part.id]) matrices[part.id] = rest[part.id].clone();
  }
  return { matrices, rest, joints: states };
}

export function worldPoint(
  matrix: Matrix4,
  point: Vec3,
): Vec3 {
  const vector = new Vector3(...point).applyMatrix4(matrix);
  return [vector.x, vector.y, vector.z];
}
