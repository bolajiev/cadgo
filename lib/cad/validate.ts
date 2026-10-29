import type { CadSpec, Joint } from "./types";
import { jointLimits } from "./pose";

export type SpecIssue = {
  level: "error" | "warning";
  message: string;
  path?: string;
};

export function validateSpec(spec: CadSpec): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const partIds = new Set<string>();
  const parameterIds = new Set<string>();
  for (const parameter of spec.parameters) {
    if (parameterIds.has(parameter.id)) {
      issues.push({ level: "error", message: `Duplicate parameter id: ${parameter.id}` });
    }
    parameterIds.add(parameter.id);
    if (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max) {
      issues.push({ level: "error", message: `Parameter ${parameter.id} has min above max` });
    }
    if (parameter.value < (parameter.min ?? -Infinity) || parameter.value > (parameter.max ?? Infinity)) {
      issues.push({ level: "warning", message: `Parameter ${parameter.id} starts outside its range` });
    }
  }
  for (const part of spec.parts) {
    if (partIds.has(part.id)) {
      issues.push({ level: "error", message: `Duplicate part id: ${part.id}` });
    }
    partIds.add(part.id);
  }
  const childOwner = new Map<string, string>();
  const jointIds = new Set<string>();
  for (const joint of spec.joints) {
    if (jointIds.has(joint.id)) {
      issues.push({ level: "error", message: `Duplicate joint id: ${joint.id}` });
    }
    jointIds.add(joint.id);
    if (!partIds.has(joint.child)) {
      issues.push({ level: "error", message: `Joint ${joint.id} points at missing part ${joint.child}` });
    }
    if (joint.parent !== "world" && !partIds.has(joint.parent)) {
      issues.push({ level: "error", message: `Joint ${joint.id} points at missing parent ${joint.parent}` });
    }
    if (joint.parent === joint.child) {
      issues.push({ level: "error", message: `Joint ${joint.id} joins a part to itself` });
    }
    if (childOwner.has(joint.child)) {
      issues.push({
        level: "error",
        message: `Part ${joint.child} is driven by two joints (${childOwner.get(joint.child)} and ${joint.id})`,
      });
    }
    childOwner.set(joint.child, joint.id);
    if (joint.type !== "fixed") {
      if (!joint.axis) {
        issues.push({ level: "error", message: `Joint ${joint.id} needs an axis` });
      } else if (Math.hypot(...joint.axis.map((value) => Number(value) || 0)) < 0.0001) {
        issues.push({ level: "error", message: `Joint ${joint.id} has a zero axis` });
      }
    }
    const [min, max] = jointLimits(joint);
    if (joint.type !== "fixed" && min >= max) {
      issues.push({ level: "error", message: `Joint ${joint.id} limits are not a range` });
    }
    if (joint.type === "revolute" && max - min > 360) {
      issues.push({ level: "warning", message: `Joint ${joint.id} has a very large travel` });
    }
  }

  const parents = new Map<string, string>();
  for (const joint of spec.joints) {
    if (joint.parent !== "world") parents.set(joint.child, joint.parent);
  }
  for (const part of spec.parts) {
    let cursor = part.id;
    const chain = new Set<string>();
    while (parents.has(cursor)) {
      if (chain.has(cursor)) {
        issues.push({ level: "error", message: `Joint loop detected at ${part.id}` });
        break;
      }
      chain.add(cursor);
      cursor = parents.get(cursor) as string;
    }
  }

  if (spec.parts.length === 0) {
    issues.push({ level: "error", message: "The assembly has no visible parts" });
  }
  if (!spec.joints.some((joint) => joint.type !== "fixed") && spec.parts.length > 1) {
    issues.push({ level: "warning", message: "No moving joint was found" });
  }
  for (const step of spec.demo ?? []) {
    if (!spec.joints.some((joint) => joint.id === step.joint)) {
      issues.push({ level: "warning", message: `Demo references missing joint ${step.joint}` });
    }
  }
  return issues;
}

export function specErrors(spec: CadSpec): string[] {
  return validateSpec(spec)
    .filter((issue) => issue.level === "error")
    .map((issue) => issue.message);
}

export function normalizeSpec(spec: CadSpec): CadSpec {
  const joints: Joint[] = spec.joints.map((joint) => {
    const [min, max] = jointLimits(joint);
    const value = Math.min(max, Math.max(min, joint.value ?? 0));
    return { ...joint, value, limits: [min, max] };
  });
  const parameters = spec.parameters.map((parameter) => {
    const min = parameter.min ?? Math.min(0, parameter.value * 0.4);
    const max = parameter.max ?? Math.max(parameter.value * 1.6, parameter.value + 1);
    return {
      ...parameter,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  });
  return { ...spec, joints, parameters };
}
