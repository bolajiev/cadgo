import type { CadDocument, Vec3 } from "./types";

export type DocumentIssue = {
  path: string;
  message: string;
  level: "error" | "warning";
};

const MAX_SOURCE = 200_000;
const MAX_LIBRARY = 400_000;

function finiteVec3(value: Vec3): boolean {
  return value.length === 3 && value.every((item) => Number.isFinite(item));
}

function validMaterialMode(value: unknown): boolean {
  return value === undefined || value === "source" || value === "override";
}

function duplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    if (seen.has(item.id)) duplicates.push(item.id);
    seen.add(item.id);
  }
  return duplicates;
}

export function validateDocument(doc: CadDocument): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const add = (path: string, message: string, level: "error" | "warning" = "error") =>
    issues.push({ path, message, level });

  if (doc.schemaVersion !== 2) add("schemaVersion", "Only schema version 2 is supported.");
  if (doc.units !== "mm") add("units", "Only millimetres are supported.");
  if (!doc.name.trim()) add("name", "The document needs a name.");

  const allNodes = [
    ...doc.groups,
    ...doc.definitions,
    ...doc.instances,
    ...doc.joints,
    ...doc.drivers,
  ];
  for (const id of duplicateIds(allNodes)) add("id", `Duplicate id: ${id}`);

  const groupIds = new Set(doc.groups.map((group) => group.id));
  const definitionIds = new Set(doc.definitions.map((definition) => definition.id));
  const instanceIds = new Set(doc.instances.map((instance) => instance.id));
  const driverIds = new Set(doc.drivers.map((driver) => driver.id));

  for (const group of doc.groups) {
    if (group.parentId && !groupIds.has(group.parentId)) {
      add(`groups.${group.id}.parentId`, `Missing parent group: ${group.parentId}`);
    }
    if (!finiteVec3(group.transform.position)) add(`groups.${group.id}.position`, "Position must be finite.");
    if (!finiteVec3(group.transform.rotation)) add(`groups.${group.id}.rotation`, "Rotation must be finite.");
    if (!finiteVec3(group.transform.scale)) add(`groups.${group.id}.scale`, "Scale must be finite.");
  }

  for (const group of doc.groups) {
    const chain = new Set<string>();
    let cursor: string | null = group.id;
    while (cursor) {
      if (chain.has(cursor)) {
        add("groups", `Group cycle detected at ${group.id}.`);
        break;
      }
      chain.add(cursor);
      cursor = doc.groups.find((item) => item.id === cursor)?.parentId ?? null;
    }
  }

  for (const definition of doc.definitions) {
    if (!validMaterialMode(definition.materialMode)) {
      add(`definitions.${definition.id}.materialMode`, "Material mode must be source or override.");
    }
    if (!definition.name.trim()) add(`definitions.${definition.id}.name`, "The part needs a name.");
    if (!definition.source.trim()) add(`definitions.${definition.id}.source`, "The part needs source.");
    if (definition.source.length > MAX_SOURCE) {
      add(`definitions.${definition.id}.source`, "Source exceeds 200 KB.");
    }
    const names = new Set<string>();
    for (const param of definition.params) {
      if (names.has(param.name)) {
        add(`definitions.${definition.id}.params`, `Duplicate parameter: ${param.name}`);
      }
      names.add(param.name);
      if (typeof param.value === "number" && !Number.isFinite(param.value)) {
        add(`definitions.${definition.id}.params.${param.name}`, "Parameter value must be finite.");
      }
      if (!Number.isFinite(param.min) || !Number.isFinite(param.max)) {
        add(`definitions.${definition.id}.params.${param.name}`, "Parameter range must be finite.");
      }
      if (param.min > param.max) {
        add(`definitions.${definition.id}.params.${param.name}`, "Parameter min is above max.");
      }
    }
  }

  for (const instance of doc.instances) {
    if (!validMaterialMode(instance.materialMode)) {
      add(`instances.${instance.id}.materialMode`, "Material mode must be source or override.");
    }
    if (!definitionIds.has(instance.definitionId)) {
      add(`instances.${instance.id}.definitionId`, `Missing definition: ${instance.definitionId}`);
      continue;
    }
    const definition = doc.definitions.find((item) => item.id === instance.definitionId);
    if (instance.parentId && !groupIds.has(instance.parentId)) {
      add(`instances.${instance.id}.parentId`, `Missing parent group: ${instance.parentId}`);
    }
    if (!finiteVec3(instance.transform.position)) add(`instances.${instance.id}.position`, "Position must be finite.");
    if (!finiteVec3(instance.transform.rotation)) add(`instances.${instance.id}.rotation`, "Rotation must be finite.");
    if (!finiteVec3(instance.transform.scale)) add(`instances.${instance.id}.scale`, "Scale must be finite.");
    for (const [name, value] of Object.entries(instance.paramOverrides ?? {})) {
      const param = definition?.params.find((item) => item.name === name);
      if (!param) {
        add(`instances.${instance.id}.paramOverrides.${name}`, `Unknown parameter: ${name}`);
        continue;
      }
      if (param.type === "number" && typeof value === "number") {
        if (!Number.isFinite(value)) {
          add(`instances.${instance.id}.paramOverrides.${name}`, "Override must be finite.");
        } else if (value < param.min || value > param.max) {
          add(`instances.${instance.id}.paramOverrides.${name}`, "Override is outside the parameter range.");
        }
      }
    }
  }

  for (const joint of doc.joints) {
    if (!instanceIds.has(joint.parentInstanceId)) {
      add(`joints.${joint.id}.parentInstanceId`, "Missing parent instance.");
    }
    const childInstanceId = "childInstanceId" in joint ? joint.childInstanceId : undefined;
    const childGroupId = "childGroupId" in joint ? joint.childGroupId : undefined;
    if (!childInstanceId && !childGroupId) {
      add(`joints.${joint.id}`, "A joint needs a child instance or a child group.");
    }
    if (childInstanceId && childGroupId) {
      add(`joints.${joint.id}`, "A joint cannot target both an instance and a group.");
    }
    if (childInstanceId && !instanceIds.has(childInstanceId)) {
      add(`joints.${joint.id}.childInstanceId`, "Missing child instance.");
    }
    if (childGroupId && !groupIds.has(childGroupId)) {
      add(`joints.${joint.id}.childGroupId`, "Missing child group.");
    }
    if (childInstanceId && joint.parentInstanceId === childInstanceId) {
      add(`joints.${joint.id}`, "A joint cannot join an instance to itself.");
    }
    if (joint.type === "link" && !instanceIds.has(joint.targetInstanceId)) {
      add(`joints.${joint.id}.targetInstanceId`, "Missing target instance.");
    }
    if ("driverId" in joint && joint.driverId && !driverIds.has(joint.driverId)) {
      add(`joints.${joint.id}.driverId`, "Missing driver.");
    }
    if ("axis" in joint && joint.axis.every((value) => value === 0)) {
      add(`joints.${joint.id}.axis`, "Axis cannot be zero.");
    }
    if (joint.type === "link") {
      const points = [
        ["parentPoint", joint.parentPoint],
        ["childPoint", joint.childPoint],
        ["targetPoint", joint.targetPoint],
      ] as const;
      for (const [key, point] of points) {
        if (!finiteVec3(point)) add(`joints.${joint.id}.${key}`, "Point must be finite.");
      }
    }
  }

  const driverNames = new Set<string>();
  for (const driver of doc.drivers) {
    if (!driver.name.trim()) add(`drivers.${driver.id}.name`, "The driver needs a name.");
    if (driverNames.has(driver.name)) {
      add(`drivers.${driver.id}.name`, `Duplicate driver name: ${driver.name}`);
    }
    driverNames.add(driver.name);
    if (!Number.isFinite(driver.value) || !Number.isFinite(driver.min) || !Number.isFinite(driver.max)) {
      add(`drivers.${driver.id}`, "Driver values must be finite.");
    }
    if (driver.min > driver.max) add(`drivers.${driver.id}`, "Driver min is above max.");
  }

  if (doc.library.length > MAX_LIBRARY) add("library", "Library exceeds 400 KB.");

  return issues;
}
