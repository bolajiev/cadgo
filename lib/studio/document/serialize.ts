import LZString from "lz-string";
import { migrateLegacy } from "./migrate";
import type { CadDocument } from "./types";
import { validateDocument } from "./validate";

function validationError(document: CadDocument): Error | null {
  const issues = validateDocument(document).filter((issue) => issue.level === "error");
  if (!issues.length) return null;
  return new Error(
    `This document is invalid: ${issues
      .slice(0, 4)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ")}`,
  );
}

export function serializeDocument(document: CadDocument): string {
  return JSON.stringify(document);
}

export function parseDocument(text: string): CadDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file is not a Cadgo document.");
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion === 2) {
    const document = parsed as CadDocument;
    const error = validationError(document);
    if (error) throw error;
    return document;
  }
  if (typeof record.c === "string") {
    const document = migrateLegacy({
      title: typeof record.t === "string" ? record.t : "Shared part",
      code: record.c,
    });
    const error = validationError(document);
    if (error) throw error;
    return document;
  }
  throw new Error("Unsupported Cadgo document version.");
}

export function encodeDocumentShare(document: CadDocument): string {
  return `#d=${LZString.compressToEncodedURIComponent(serializeDocument(document))}`;
}

export function decodeDocumentShare(hash: string): CadDocument | null {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (value.startsWith("d=")) {
    const raw = LZString.decompressFromEncodedURIComponent(value.slice(2));
    if (!raw) return null;
    try {
      return parseDocument(raw);
    } catch {
      return null;
    }
  }
  if (value.startsWith("s=")) {
    const raw = LZString.decompressFromEncodedURIComponent(value.slice(2));
    if (!raw) return null;
    try {
      return parseDocument(raw);
    } catch {
      return null;
    }
  }
  return null;
}
