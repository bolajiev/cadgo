import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { migrateLegacy } from "../lib/studio/document/migrate";
import { buildScadBundle } from "../lib/studio/v2/bundle";

describe("SCAD bundle", () => {
  it("packages editable parts, the manifest and the document", () => {
    const document = migrateLegacy({
      title: "Knob",
      code: "size = 20; // [10:40]\ncube([size, size, size], center = true);",
    });
    document.definitions.push({
      id: "def-2",
      name: "Knob",
      source: "size = 10; // [5:30]\ncube([size, size, size]);",
      params: [],
      material: document.definitions[0].material,
      locked: false,
      revision: 1,
    });

    const bundle = buildScadBundle(document);
    const files = unzipSync(bundle);
    const names = Object.keys(files).sort();
    expect(names).toContain("assembly.json");
    expect(names).toContain("document.cadgo.json");
    expect(names).toContain("README.txt");
    expect(names).toContain("parts/01-knob.scad");
    expect(names).toContain("parts/02-knob.scad");

    expect(strFromU8(files["parts/01-knob.scad"])).toContain("cube([size, size, size]");
    const manifest = JSON.parse(strFromU8(files["assembly.json"])) as {
      definitions: { file: string }[];
      instances: { name: string }[];
    };
    expect(manifest.definitions).toHaveLength(2);
    expect(manifest.instances[0].name).toBe("Knob");
    const restored = JSON.parse(strFromU8(files["document.cadgo.json"])) as { name: string };
    expect(restored.name).toBe("Knob");
  });
});
