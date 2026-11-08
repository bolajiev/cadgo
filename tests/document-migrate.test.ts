import LZString from "lz-string";
import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "../lib/studio/document/defaults";
import { migrateLegacy } from "../lib/studio/document/migrate";
import {
  decodeDocumentShare,
  encodeDocumentShare,
  parseDocument,
  serializeDocument,
} from "../lib/studio/document/serialize";

const source = `// Knob
diameter = 42; // [24:70]
height = 24; // [12:40]
cylinder(d = diameter, h = height);
`;

describe("document migration and serialization", () => {
  it("migrates a legacy single-source model", () => {
    const document = migrateLegacy({ title: "Knob", code: source });
    expect(document.schemaVersion).toBe(2);
    expect(document.name).toBe("Knob");
    expect(document.definitions).toHaveLength(1);
    expect(document.instances).toHaveLength(1);
    expect(document.definitions[0].params.map((param) => param.name)).toEqual([
      "diameter",
      "height",
    ]);
    expect(document.instances[0].definitionId).toBe(document.definitions[0].id);
  });

  it("round-trips a v2 document through JSON", () => {
    const document = migrateLegacy({ title: "Knob", code: source });
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it("round-trips a v2 share link", () => {
    const document = migrateLegacy({ title: "Knob", code: source });
    const decoded = decodeDocumentShare(encodeDocumentShare(document));
    expect(decoded).toEqual(document);
  });

  it("loads a legacy #s= share link", () => {
    const payload = LZString.compressToEncodedURIComponent(
      JSON.stringify({ t: "Knob", c: source }),
    );
    const decoded = decodeDocumentShare(`#s=${payload}`);
    expect(decoded?.definitions[0].name).toBe("Knob");
    expect(decoded?.definitions[0].params).toHaveLength(2);
  });

  it("rejects malformed JSON and invalid documents", () => {
    expect(() => parseDocument("{")).toThrow(/valid JSON/);
    expect(() => parseDocument(JSON.stringify({ hello: "world" }))).toThrow(
      /Unsupported Cadgo document/,
    );
    const invalid = createEmptyDocument();
    invalid.instances.push({
      id: "inst-1",
      definitionId: "missing",
      name: "Ghost",
      parentId: null,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });
    expect(() => parseDocument(JSON.stringify(invalid))).toThrow(/invalid/);
  });

  it("returns null for unrelated or corrupt hashes", () => {
    expect(decodeDocumentShare("#nothing=1")).toBeNull();
    expect(decodeDocumentShare("#d=not-compressed")).toBeNull();
  });
});
