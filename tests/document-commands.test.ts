import { describe, expect, it } from "vitest";
import {
  createEmptyDocument,
  defaultMaterial,
  identityTransform,
  newId,
} from "../lib/studio/document/defaults";
import { applyCommand, type Command } from "../lib/studio/document/commands";

function command(
  kind: Command["kind"],
  payload: unknown,
  targetRevision?: number,
): Command {
  return {
    id: newId("cmd"),
    actor: "user",
    kind,
    payload,
    targetRevision,
    label: kind,
    at: new Date().toISOString(),
  } as Command;
}

describe("document commands", () => {
  it("creates a definition and parses its parameters", () => {
    const doc = createEmptyDocument();
    const id = newId("def");
    const result = applyCommand(
      doc,
      command("create_definition", {
        definition: {
          id,
          name: "Block",
          source: "width = 20; // [10:40]\ncube([width, width, width]);",
          params: [],
          material: defaultMaterial(),
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.definitions).toHaveLength(1);
    expect(result.document.definitions[0].params.map((param) => param.name)).toEqual(["width"]);
    expect(result.document.definitions[0].revision).toBe(1);
    expect(result.document.revision).toBe(doc.revision + 1);
  });

  it("rejects stale writes and accepts current ones", () => {
    const doc = createEmptyDocument();
    const id = newId("def");
    const created = applyCommand(
      doc,
      command("create_definition", {
        definition: {
          id,
          name: "Block",
          source: "width = 20;\ncube([width, width, width]);",
          params: [],
          material: defaultMaterial(),
        },
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stale = applyCommand(
      created.document,
      command("update_definition", { definitionId: id, patch: { name: "Block v2" } }, 0),
    );
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.conflict).toBe(true);
    if (!stale.conflict) return;
    expect(stale.currentRevision).toBe(1);

    const updated = applyCommand(
      created.document,
      command("update_definition", { definitionId: id, patch: { name: "Block v2" } }, 1),
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.document.definitions[0].name).toBe("Block v2");
    expect(updated.document.definitions[0].revision).toBe(2);
  });

  it("rejects deleting a definition that still has instances", () => {
    const doc = createEmptyDocument();
    doc.definitions.push({
      id: "def-1",
      name: "Piston",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.instances.push({
      id: "inst-1",
      definitionId: "def-1",
      name: "Piston 1",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    const result = applyCommand(doc, command("delete_definition", { definitionId: "def-1" }, 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict).toBe(false);
  });

  it("enforces locks except for an unlock-only patch", () => {
    const doc = createEmptyDocument();
    doc.definitions.push({
      id: "def-1",
      name: "Block",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.instances.push({
      id: "inst-1",
      definitionId: "def-1",
      name: "Block",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: true,
      suppressed: false,
      revision: 1,
    });
    const blocked = applyCommand(
      doc,
      command("update_instance", { instanceId: "inst-1", patch: { name: "Nope" } }, 1),
    );
    expect(blocked.ok).toBe(false);
    const unlocked = applyCommand(
      doc,
      command("update_instance", { instanceId: "inst-1", patch: { locked: false } }, 1),
    );
    expect(unlocked.ok).toBe(true);
    if (unlocked.ok) expect(unlocked.document.instances[0].locked).toBe(false);
  });

  it("deletes a driver and clears joint references with a new revision", () => {
    const doc = createEmptyDocument();
    doc.definitions.push({
      id: "def-1",
      name: "Crank",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.instances.push(
      {
        id: "inst-1",
        definitionId: "def-1",
        name: "Block",
        parentId: null,
        transform: identityTransform(),
        visible: true,
        locked: false,
        suppressed: false,
        revision: 1,
      },
      {
        id: "inst-2",
        definitionId: "def-1",
        name: "Crank",
        parentId: null,
        transform: identityTransform(),
        visible: true,
        locked: false,
        suppressed: false,
        revision: 1,
      },
    );
    doc.drivers.push({
      id: "driver-1",
      name: "crank_angle",
      value: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: "deg",
      revision: 1,
    });
    doc.joints.push({
      id: "joint-1",
      name: "Crank rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-1",
      childInstanceId: "inst-2",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-1",
      expression: "angle",
    });

    const result = applyCommand(doc, command("delete_driver", { driverId: "driver-1" }, 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.drivers).toHaveLength(0);
    const joint = result.document.joints[0];
    expect(joint.type).toBe("revolute");
    if (joint.type === "revolute") expect(joint.driverId).toBeUndefined();
    expect(joint.revision).toBe(2);
  });

  it("cascades a group delete and removes referenced joints", () => {
    const doc = createEmptyDocument();
    doc.groups.push({
      id: "group-1",
      name: "Bank",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      expanded: true,
      revision: 1,
    });
    doc.definitions.push({
      id: "def-1",
      name: "Piston",
      source: "cube([1,1,1]);",
      params: [],
      material: defaultMaterial(),
      locked: false,
      revision: 1,
    });
    doc.instances.push(
      {
        id: "inst-1",
        definitionId: "def-1",
        name: "Piston 1",
        parentId: "group-1",
        transform: identityTransform(),
        visible: true,
        locked: false,
        suppressed: false,
        revision: 1,
      },
      {
        id: "inst-2",
        definitionId: "def-1",
        name: "Piston 2",
        parentId: "group-1",
        transform: identityTransform(),
        visible: true,
        locked: false,
        suppressed: false,
        revision: 1,
      },
    );
    doc.joints.push({
      id: "joint-1",
      name: "Link",
      type: "link",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-1",
      childInstanceId: "inst-2",
      targetInstanceId: "inst-2",
      parentPoint: [0, 0, 0],
      childPoint: [0, 0, 0],
      targetPoint: [0, 0, 1],
      stretch: false,
    });
    doc.groups.push({
      id: "group-2",
      name: "Child",
      parentId: "group-1",
      transform: identityTransform(),
      visible: true,
      locked: false,
      expanded: true,
      revision: 1,
    });
    const result = applyCommand(
      doc,
      command("delete_group", { groupId: "group-1", cascade: true }, 1),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.groups).toHaveLength(0);
    expect(result.document.instances).toHaveLength(0);
    expect(result.document.joints).toHaveLength(0);
  });
});
