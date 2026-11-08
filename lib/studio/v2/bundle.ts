import { strToU8, zipSync } from "fflate";
import type { CadDocument } from "../document/types";

export function safeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "part";
}

export function buildScadBundle(document: CadDocument): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const definitions = document.definitions.map((definition, index) => {
    const file = `parts/${String(index + 1).padStart(2, "0")}-${safeFileName(definition.name)}.scad`;
    files[file] = strToU8(definition.source);
    return {
      id: definition.id,
      name: definition.name,
      file,
      revision: definition.revision,
      params: definition.params,
      material: definition.material,
    };
  });

  const manifest = {
    name: document.name,
    units: document.units,
    exportedAt: new Date().toISOString(),
    definitions,
    groups: document.groups,
    instances: document.instances,
    joints: document.joints,
    drivers: document.drivers,
  };
  files["assembly.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["document.cadgo.json"] = strToU8(JSON.stringify(document, null, 2));
  files["README.txt"] = strToU8(
    [
      "Cadgo assembly bundle",
      "",
      `Document: ${document.name}`,
      `Units: ${document.units}`,
      `Parts: ${document.definitions.length}`,
      `Instances: ${document.instances.length}`,
      "",
      "Each file in parts/ is a complete, editable OpenSCAD program.",
      "assembly.json carries the part files, parameters, groups, instances, joints and drivers.",
      "document.cadgo.json is the native Cadgo document; re-import it to restore the assembly.",
      "",
      "This is concept CAD, not a validated manufacturing artifact.",
      "",
    ].join("\n"),
  );

  return zipSync(files, { level: 6 });
}
