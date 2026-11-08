import type { ApplyResult, Command } from "./commands";
import { createHistory } from "./history";
import type { DocumentStorage } from "./storage";
import type { CadDocument } from "./types";

export type DocumentStoreOptions = {
  document: CadDocument;
  storage?: DocumentStorage;
  autosaveMs?: number;
};

export type DocumentStore = {
  getDocument(): CadDocument;
  subscribe(listener: (document: CadDocument) => void): () => void;
  dispatch(command: Command): ApplyResult;
  undo(): { ok: true; document: CadDocument } | null;
  redo(): { ok: true; document: CadDocument } | null;
  canUndo(): boolean;
  canRedo(): boolean;
  replace(document: CadDocument): void;
  flush(): Promise<void>;
  destroy(): void;
};

export function createDocumentStore(options: DocumentStoreOptions): DocumentStore {
  const history = createHistory(options.document);
  const listeners = new Set<(document: CadDocument) => void>();
  const autosaveMs = options.autosaveMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const saveNow = async () => {
    if (!options.storage) return;
    dirty = false;
    await options.storage.save(history.document.id, history.document);
  };

  const scheduleSave = () => {
    if (!options.storage) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void saveNow().catch((error) => {
        console.error("Cadgo document autosave failed", error);
      });
    }, autosaveMs);
  };

  const notify = () => {
    const document = history.document;
    for (const listener of listeners) listener(document);
  };

  const changed = () => {
    notify();
    scheduleSave();
  };

  return {
    getDocument: () => history.document,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(command: Command): ApplyResult {
      const result = history.apply(command);
      if (result.ok) changed();
      return result;
    },
    undo(): { ok: true; document: CadDocument } | null {
      const document = history.undo();
      if (!document) return null;
      changed();
      return { ok: true, document };
    },
    redo(): { ok: true; document: CadDocument } | null {
      const document = history.redo();
      if (!document) return null;
      changed();
      return { ok: true, document };
    },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    replace(document: CadDocument) {
      history.reset(document);
      changed();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (dirty) await saveNow();
    },
    destroy() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      listeners.clear();
    },
  };
}
