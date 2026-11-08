import { Matrix4, Quaternion, Vector3 } from "three";
import { evalExpr } from "../../cad/expr";
import type { CadDocument, Joint } from "../document/types";
import { transformMatrix } from "./geometry";

export type MotionResult = {
  transforms: Map<string, Matrix4>;
  errors: Record<string, string>;
};

export type MotionWorldResult = {
  matrices: Map<string, Matrix4>;
  errors: Record<string, string>;
};

export function driverValueMap(
  document: CadDocument,
  values: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const driver of document.drivers) {
    result[driver.name] = values[driver.id] ?? driver.value;
  }
  return result;
}

function jointVars(
  document: CadDocument,
  joint: Joint,
  driverValues: Record<string, number>,
  drivers: Record<string, number>,
) {
  const childInstanceId = "childInstanceId" in joint ? joint.childInstanceId : undefined;
  const child = childInstanceId
    ? document.instances.find((instance) => instance.id === childInstanceId)
    : undefined;
  const definition = child
    ? document.definitions.find((item) => item.id === child.definitionId)
    : undefined;
  const vars: Record<string, number> = { ...drivers };
  for (const param of definition?.params ?? []) {
    if (typeof param.value === "number") vars[param.name] = param.value;
  }
  for (const [name, value] of Object.entries(child?.paramOverrides ?? {})) {
    if (typeof value === "number") vars[name] = value;
  }
  const driverId = "driverId" in joint ? joint.driverId : undefined;
  const driver = driverId
    ? document.drivers.find((item) => item.id === driverId)
    : undefined;
  const angle = driver ? driverValues[driver.id] ?? driver.value : 0;
  vars.angle = angle;
  vars.value = angle;
  return { vars, child, definition };
}

function localJointMatrix(joint: Joint, vars: Record<string, number>): Matrix4 | null {
  if (joint.type === "revolute") {
    const degrees = evalExpr(joint.expression || "angle", vars);
    const axis = new Vector3(...joint.axis).normalize();
    const rotation = new Matrix4().makeRotationAxis(axis, (degrees * Math.PI) / 180);
    const origin = new Vector3(...joint.origin);
    return new Matrix4()
      .makeTranslation(origin.x, origin.y, origin.z)
      .multiply(rotation)
      .multiply(new Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
  }
  if (joint.type === "prismatic") {
    const distance = evalExpr(joint.expression || "0", vars);
    const axis = new Vector3(...joint.axis).normalize().multiplyScalar(distance);
    return new Matrix4().makeTranslation(axis.x, axis.y, axis.z);
  }
  return null;
}

export function jointTransforms(
  document: CadDocument,
  driverValues: Record<string, number>,
): MotionResult {
  const transforms = new Map<string, Matrix4>();
  const errors: Record<string, string> = {};
  const drivers = driverValueMap(document, driverValues);

  for (const joint of document.joints) {
    if (!joint.enabled || joint.type === "link") continue;
    try {
      const { vars } = jointVars(document, joint, driverValues, drivers);
      const local = localJointMatrix(joint, vars);
      if (!local) continue;
      if (!joint.childInstanceId) continue;
      const current = transforms.get(joint.childInstanceId) ?? new Matrix4();
      transforms.set(joint.childInstanceId, current.multiply(local));
    } catch (error) {
      errors[joint.id] = error instanceof Error ? error.message : "Joint expression failed.";
    }
  }

  return { transforms, errors };
}

export function motionWorldMatrices(
  document: CadDocument,
  driverValues: Record<string, number>,
): MotionWorldResult {
  const matrices = new Map<string, Matrix4>();
  const errors: Record<string, string> = {};
  const drivers = driverValueMap(document, driverValues);
  const groupMotions = new Map<string, Matrix4>();

  for (const joint of document.joints) {
    if (!joint.enabled || joint.type === "link") continue;
    if (!("childGroupId" in joint) || !joint.childGroupId) continue;
    try {
      const { vars } = jointVars(document, joint, driverValues, drivers);
      const local = localJointMatrix(joint, vars);
      if (!local) continue;
      const current = groupMotions.get(joint.childGroupId) ?? new Matrix4();
      groupMotions.set(joint.childGroupId, current.multiply(local));
    } catch (error) {
      errors[joint.id] = error instanceof Error ? error.message : "Joint expression failed.";
    }
  }

  const groupWorld = new Map<string, Matrix4>();
  const resolveGroup = (groupId: string | null): Matrix4 => {
    if (!groupId) return new Matrix4();
    const cached = groupWorld.get(groupId);
    if (cached) return cached.clone();
    const group = document.groups.find((item) => item.id === groupId);
    if (!group) return new Matrix4();
    const base = resolveGroup(group.parentId).multiply(transformMatrix(group.transform));
    const motion = groupMotions.get(groupId);
    const world = motion ? base.multiply(motion) : base;
    groupWorld.set(groupId, world);
    return world.clone();
  };

  for (const instance of document.instances) {
    const base = resolveGroup(instance.parentId).multiply(transformMatrix(instance.transform));
    matrices.set(instance.id, base);
  }

  for (const joint of document.joints) {
    if (!joint.enabled || joint.type === "link") continue;
    if (!joint.childInstanceId) continue;
    try {
      const { vars } = jointVars(document, joint, driverValues, drivers);
      const local = localJointMatrix(joint, vars);
      if (!local) continue;
      const current = matrices.get(joint.childInstanceId) ?? new Matrix4();
      matrices.set(joint.childInstanceId, current.multiply(local));
    } catch (error) {
      errors[joint.id] = error instanceof Error ? error.message : "Joint expression failed.";
    }
  }

  for (const joint of document.joints) {
    if (!joint.enabled || joint.type !== "link") continue;
    try {
      const parent = matrices.get(joint.parentInstanceId);
      const target = matrices.get(joint.targetInstanceId);
      const child = document.instances.find((instance) => instance.id === joint.childInstanceId);
      if (!parent || !target || !child) throw new Error("Link joint references a missing instance.");
      const parentPoint = new Vector3(...joint.parentPoint).applyMatrix4(parent);
      const targetPoint = new Vector3(...joint.targetPoint).applyMatrix4(target);
      const direction = targetPoint.clone().sub(parentPoint);
      const distance = direction.length();
      if (distance < 0.0001) throw new Error("Link joint endpoints are coincident.");
      const quaternion = new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        direction.normalize(),
      );
      const childPoint = new Vector3(...joint.childPoint).applyQuaternion(quaternion);
      const position = parentPoint.clone().sub(childPoint);
      const definition = document.definitions.find((item) => item.id === child.definitionId);
      const lengthParam = definition?.params.find((param) => param.name === "length")?.value;
      const naturalLength = typeof lengthParam === "number" && lengthParam > 0 ? lengthParam : distance;
      const scale = joint.stretch ? distance / naturalLength : 1;
      matrices.set(
        joint.childInstanceId,
        new Matrix4().compose(position, quaternion, new Vector3(1, 1, scale)),
      );
    } catch (error) {
      errors[joint.id] = error instanceof Error ? error.message : "Link joint failed.";
    }
  }

  return { matrices, errors };
}
