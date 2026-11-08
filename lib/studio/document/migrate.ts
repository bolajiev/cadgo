import { parseParameters } from "../../scad/params";
import { createEmptyDocument, defaultMaterial, identityTransform } from "./defaults";
import type { CadDocument } from "./types";

export function migrateLegacy(input: { title: string; code: string }): CadDocument {
  const title = input.title.trim() || "Untitled part";
  const source = input.code.trim();
  const document = createEmptyDocument(title);
  if (!source) return document;

  const definitionId = "def-main";
  const instanceId = "inst-main";
  document.definitions.push({
    id: definitionId,
    name: title,
    source,
    params: parseParameters(source),
    material: defaultMaterial(),
    materialMode: "source",
    locked: false,
    revision: 1,
  });
  document.instances.push({
    id: instanceId,
    definitionId,
    name: title,
    parentId: null,
    transform: identityTransform(),
    visible: true,
    locked: false,
    suppressed: false,
    revision: 1,
  });
  document.updatedAt = new Date().toISOString();
  return document;
}
