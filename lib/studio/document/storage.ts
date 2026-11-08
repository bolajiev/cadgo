import type { CadDocument } from "./types";

export type DocumentStorage = {
  load(id: string): Promise<CadDocument | null>;
  save(id: string, document: CadDocument): Promise<void>;
  remove(id: string): Promise<void>;
};

export function memoryStorage(seed: Record<string, CadDocument> = {}): DocumentStorage {
  const documents = new Map<string, CadDocument>(Object.entries(seed));
  return {
    async load(id) {
      return documents.get(id) ?? null;
    },
    async save(id, document) {
      documents.set(id, document);
    },
    async remove(id) {
      documents.delete(id);
    },
  };
}

export function indexedDbStorage(): DocumentStorage {
  if (typeof indexedDB === "undefined") return memoryStorage();
  const key = (id: string) => `cadgo:doc:${id}`;
  return {
    async load(id) {
      const { get } = await import("idb-keyval");
      return ((await get(key(id))) as CadDocument | undefined) ?? null;
    },
    async save(id, document) {
      const { set } = await import("idb-keyval");
      await set(key(id), document);
    },
    async remove(id) {
      const { del } = await import("idb-keyval");
      await del(key(id));
    },
  };
}
