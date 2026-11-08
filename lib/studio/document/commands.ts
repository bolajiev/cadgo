import { parseParameters, type ParameterDef } from "../../scad/params";
import { newId } from "./defaults";
import type {
  CadDocument,
  Driver,
  GroupNode,
  Id,
  Joint,
  JointDraft,
  PartDefinition,
  PartInstance,
} from "./types";
import { validateDocument } from "./validate";

export type Actor = "user" | "agent" | "system";

export type Command =
  | {
      id: Id;
      actor: Actor;
      kind: "create_definition";
      payload: {
        definition: Omit<PartDefinition, "revision" | "locked"> & { locked?: boolean };
      };
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_definition";
      payload: {
        definitionId: Id;
        patch: Partial<
          Pick<PartDefinition, "name" | "source" | "params" | "material" | "materialMode" | "locked">
        >;
      };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "delete_definition";
      payload: { definitionId: Id };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "create_group";
      payload: { group: Omit<GroupNode, "revision"> };
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_group";
      payload: {
        groupId: Id;
        patch: Partial<Pick<GroupNode, "name" | "parentId" | "transform" | "visible" | "locked" | "expanded">>;
      };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "delete_group";
      payload: { groupId: Id; cascade?: boolean };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "create_instance";
      payload: { instance: Omit<PartInstance, "revision"> };
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_instance";
      payload: {
        instanceId: Id;
        patch: Partial<
          Pick<
            PartInstance,
            | "name"
            | "definitionId"
            | "parentId"
            | "transform"
            | "material"
            | "materialMode"
            | "paramOverrides"
            | "visible"
            | "locked"
            | "suppressed"
          >
        >;
      };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "delete_instance";
      payload: { instanceId: Id };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "create_driver";
      payload: { driver: Omit<Driver, "revision"> };
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_driver";
      payload: {
        driverId: Id;
        patch: Partial<Pick<Driver, "name" | "value" | "min" | "max" | "step" | "unit">>;
      };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "delete_driver";
      payload: { driverId: Id };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "create_joint";
      payload: { joint: JointDraft };
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_joint";
      payload: { jointId: Id; patch: Record<string, unknown> };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "delete_joint";
      payload: { jointId: Id };
      targetRevision: number;
      label: string;
      at: string;
    }
  | {
      id: Id;
      actor: Actor;
      kind: "update_document";
      payload: { name?: string; library?: string };
      targetRevision: number;
      label: string;
      at: string;
    };

export type Conflict = {
  ok: false;
  conflict: true;
  nodeId: Id;
  currentRevision: number;
  currentNode: unknown;
  message: string;
};

export type ApplyResult =
  | { ok: true; document: CadDocument }
  | Conflict
  | { ok: false; conflict: false; error: string };

export function createCommand<T extends Omit<Command, "id" | "at">>(
  input: T,
  actor: Actor = "user",
): Command {
  return { ...input, id: newId("cmd"), at: new Date().toISOString(), actor } as Command;
}

export function definitionParamsFromSource(source: string): ParameterDef[] {
  return parseParameters(source);
}

function bump<T extends { revision: number }>(node: T): T {
  return { ...node, revision: node.revision + 1 };
}

function conflict(nodeId: Id, currentNode: { revision: number }): Conflict {
  return {
    ok: false,
    conflict: true,
    nodeId,
    currentRevision: currentNode.revision,
    currentNode: { ...currentNode, source: undefined },
    message: "This node changed since you read it. Re-read it and retry, or ask the user.",
  };
}

function lockedError(): ApplyResult {
  return { ok: false, conflict: false, error: "This node is locked. Unlock it before editing." };
}

function unlockOnly(patch: Record<string, unknown>): boolean {
  return patch.locked === false && Object.keys(patch).every((key) => key === "locked");
}

function finish(doc: CadDocument): ApplyResult {
  const next: CadDocument = {
    ...doc,
    revision: doc.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  const issues = validateDocument(next).filter((issue) => issue.level === "error");
  if (issues.length) {
    return {
      ok: false,
      conflict: false,
      error: issues.map((issue) => `${issue.path}: ${issue.message}`).slice(0, 4).join("; "),
    };
  }
  return { ok: true, document: next };
}

function childGroups(doc: CadDocument, groupId: Id): GroupNode[] {
  return doc.groups.filter((group) => group.parentId === groupId);
}

function descendantGroupIds(doc: CadDocument, groupId: Id): Set<Id> {
  const result = new Set<Id>([groupId]);
  let added = true;
  while (added) {
    added = false;
    for (const group of doc.groups) {
      if (group.parentId && result.has(group.parentId) && !result.has(group.id)) {
        result.add(group.id);
        added = true;
      }
    }
  }
  return result;
}

export function applyCommand(doc: CadDocument, command: Command): ApplyResult {
  switch (command.kind) {
    case "create_definition": {
      const input = command.payload.definition;
      if (doc.definitions.some((item) => item.id === input.id)) {
        return { ok: false, conflict: false, error: `Definition ${input.id} already exists.` };
      }
      if (input.source.length > 200_000) {
        return { ok: false, conflict: false, error: "Source exceeds 200 KB." };
      }
      const params = input.params.length ? input.params : definitionParamsFromSource(input.source);
      return finish({
        ...doc,
        definitions: [
          ...doc.definitions,
          { ...input, params, locked: input.locked ?? false, revision: 1 },
        ],
      });
    }

    case "update_definition": {
      const current = doc.definitions.find((item) => item.id === command.payload.definitionId);
      if (!current) return { ok: false, conflict: false, error: "Definition not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked && !unlockOnly(command.payload.patch)) return lockedError();
      const patch = { ...command.payload.patch };
      if (patch.source !== undefined && patch.source.length > 200_000) {
        return { ok: false, conflict: false, error: "Source exceeds 200 KB." };
      }
      const params =
        patch.params ?? (patch.source !== undefined ? definitionParamsFromSource(patch.source) : current.params);
      const next = bump({ ...current, ...patch, params });
      return finish({
        ...doc,
        definitions: doc.definitions.map((item) => (item.id === next.id ? next : item)),
      });
    }

    case "delete_definition": {
      const current = doc.definitions.find((item) => item.id === command.payload.definitionId);
      if (!current) return { ok: false, conflict: false, error: "Definition not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked) return lockedError();
      const used = doc.instances.filter((item) => item.definitionId === current.id);
      if (used.length) {
        return {
          ok: false,
          conflict: false,
          error: `Definition is used by ${used.length} instance(s). Delete the instances first.`,
        };
      }
      return finish({
        ...doc,
        definitions: doc.definitions.filter((item) => item.id !== current.id),
      });
    }

    case "create_group": {
      const input = command.payload.group;
      if (doc.groups.some((item) => item.id === input.id)) {
        return { ok: false, conflict: false, error: `Group ${input.id} already exists.` };
      }
      if (input.parentId && !doc.groups.some((item) => item.id === input.parentId)) {
        return { ok: false, conflict: false, error: "Parent group not found." };
      }
      return finish({ ...doc, groups: [...doc.groups, { ...input, revision: 1 }] });
    }

    case "update_group": {
      const current = doc.groups.find((item) => item.id === command.payload.groupId);
      if (!current) return { ok: false, conflict: false, error: "Group not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked && !unlockOnly(command.payload.patch)) return lockedError();
      if (command.payload.patch.parentId && !doc.groups.some((item) => item.id === command.payload.patch.parentId)) {
        return { ok: false, conflict: false, error: "Parent group not found." };
      }
      const next = bump({ ...current, ...command.payload.patch });
      return finish({
        ...doc,
        groups: doc.groups.map((item) => (item.id === next.id ? next : item)),
      });
    }

    case "delete_group": {
      const current = doc.groups.find((item) => item.id === command.payload.groupId);
      if (!current) return { ok: false, conflict: false, error: "Group not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked) return lockedError();
      const groups = childGroups(doc, current.id);
      const instances = doc.instances.filter((item) => item.parentId === current.id);
      if (!command.payload.cascade && (groups.length || instances.length)) {
        return { ok: false, conflict: false, error: "Group is not empty. Move or delete its children first." };
      }
      const removeGroups = command.payload.cascade
        ? descendantGroupIds(doc, current.id)
        : new Set<Id>([current.id]);
      const removeInstances = new Set(
        doc.instances.filter((item) => item.parentId && removeGroups.has(item.parentId)).map((item) => item.id),
      );
      return finish({
        ...doc,
        groups: doc.groups.filter((item) => !removeGroups.has(item.id)),
        instances: doc.instances.filter((item) => !removeInstances.has(item.id)),
        joints: doc.joints.filter(
          (joint) =>
            !removeInstances.has(joint.parentInstanceId) &&
            (!joint.childInstanceId || !removeInstances.has(joint.childInstanceId)) &&
            (!("childGroupId" in joint) ||
              !joint.childGroupId ||
              !removeGroups.has(joint.childGroupId)) &&
            (joint.type !== "link" || !removeInstances.has(joint.targetInstanceId)),
        ),
      });
    }

    case "create_instance": {
      const input = command.payload.instance;
      if (!doc.definitions.some((item) => item.id === input.definitionId)) {
        return { ok: false, conflict: false, error: "Definition not found." };
      }
      if (input.parentId && !doc.groups.some((item) => item.id === input.parentId)) {
        return { ok: false, conflict: false, error: "Parent group not found." };
      }
      if (doc.instances.some((item) => item.id === input.id)) {
        return { ok: false, conflict: false, error: `Instance ${input.id} already exists.` };
      }
      return finish({ ...doc, instances: [...doc.instances, { ...input, revision: 1 }] });
    }

    case "update_instance": {
      const current = doc.instances.find((item) => item.id === command.payload.instanceId);
      if (!current) return { ok: false, conflict: false, error: "Instance not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked && !unlockOnly(command.payload.patch)) return lockedError();
      const patch = command.payload.patch;
      if (patch.parentId && !doc.groups.some((item) => item.id === patch.parentId)) {
        return { ok: false, conflict: false, error: "Parent group not found." };
      }
      if (patch.definitionId && !doc.definitions.some((item) => item.id === patch.definitionId)) {
        return { ok: false, conflict: false, error: "Definition not found." };
      }
      const next = bump({ ...current, ...patch });
      return finish({
        ...doc,
        instances: doc.instances.map((item) => (item.id === next.id ? next : item)),
      });
    }

    case "delete_instance": {
      const current = doc.instances.find((item) => item.id === command.payload.instanceId);
      if (!current) return { ok: false, conflict: false, error: "Instance not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      if (current.locked) return lockedError();
      return finish({
        ...doc,
        instances: doc.instances.filter((item) => item.id !== current.id),
        joints: doc.joints.filter(
          (joint) =>
            joint.parentInstanceId !== current.id &&
            joint.childInstanceId !== current.id &&
            (joint.type !== "link" || joint.targetInstanceId !== current.id),
        ),
      });
    }

    case "create_driver": {
      const input = command.payload.driver;
      if (doc.drivers.some((item) => item.id === input.id)) {
        return { ok: false, conflict: false, error: `Driver ${input.id} already exists.` };
      }
      if (doc.drivers.some((item) => item.name === input.name)) {
        return { ok: false, conflict: false, error: "Driver name must be unique." };
      }
      return finish({ ...doc, drivers: [...doc.drivers, { ...input, revision: 1 }] });
    }

    case "update_driver": {
      const current = doc.drivers.find((item) => item.id === command.payload.driverId);
      if (!current) return { ok: false, conflict: false, error: "Driver not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      const next = bump({ ...current, ...command.payload.patch });
      return finish({
        ...doc,
        drivers: doc.drivers.map((item) => (item.id === next.id ? next : item)),
      });
    }

    case "delete_driver": {
      const current = doc.drivers.find((item) => item.id === command.payload.driverId);
      if (!current) return { ok: false, conflict: false, error: "Driver not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      return finish({
        ...doc,
        drivers: doc.drivers.filter((item) => item.id !== current.id),
        joints: doc.joints.map((joint) =>
          "driverId" in joint && joint.driverId === current.id
            ? bump({ ...joint, driverId: undefined } as Joint)
            : joint,
        ),
      });
    }

    case "create_joint": {
      const input = command.payload.joint;
      if (doc.joints.some((item) => item.id === input.id)) {
        return { ok: false, conflict: false, error: `Joint ${input.id} already exists.` };
      }
      const childInstanceId = "childInstanceId" in input ? input.childInstanceId : undefined;
      const childGroupId = "childGroupId" in input ? input.childGroupId : undefined;
      if (!childInstanceId && !childGroupId) {
        return { ok: false, conflict: false, error: "A joint needs a child instance or a child group." };
      }
      if (childInstanceId && childGroupId) {
        return { ok: false, conflict: false, error: "Choose one child target: instance or group." };
      }
      if (childInstanceId && input.parentInstanceId === childInstanceId) {
        return { ok: false, conflict: false, error: "A joint needs two different instances." };
      }
      if (!doc.instances.some((item) => item.id === input.parentInstanceId)) {
        return { ok: false, conflict: false, error: `Instance not found: ${input.parentInstanceId}` };
      }
      if (childInstanceId && !doc.instances.some((item) => item.id === childInstanceId)) {
        return { ok: false, conflict: false, error: `Instance not found: ${childInstanceId}` };
      }
      if (childGroupId && !doc.groups.some((item) => item.id === childGroupId)) {
        return { ok: false, conflict: false, error: `Group not found: ${childGroupId}` };
      }
      if (input.type === "link" && !doc.instances.some((item) => item.id === input.targetInstanceId)) {
        return { ok: false, conflict: false, error: "Target instance not found." };
      }
      return finish({ ...doc, joints: [...doc.joints, { ...input, revision: 1 } as Joint] });
    }

    case "update_joint": {
      const current = doc.joints.find((item) => item.id === command.payload.jointId);
      if (!current) return { ok: false, conflict: false, error: "Joint not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      const next = bump({ ...current, ...command.payload.patch } as Joint);
      return finish({
        ...doc,
        joints: doc.joints.map((item) => (item.id === next.id ? next : item)),
      });
    }

    case "delete_joint": {
      const current = doc.joints.find((item) => item.id === command.payload.jointId);
      if (!current) return { ok: false, conflict: false, error: "Joint not found." };
      if (current.revision !== command.targetRevision) return conflict(current.id, current);
      return finish({
        ...doc,
        joints: doc.joints.filter((item) => item.id !== current.id),
      });
    }

    case "update_document": {
      if (doc.revision !== command.targetRevision) return conflict(doc.id, doc);
      return finish({ ...doc, ...command.payload });
    }
  }
}
