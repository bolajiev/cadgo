import { applyCommand, type ApplyResult, type Command } from "./commands";
import type { CadDocument } from "./types";

const MAX_HISTORY = 100;

export type DocumentHistory = {
  document: CadDocument;
  apply(command: Command): ApplyResult;
  undo(): CadDocument | null;
  redo(): CadDocument | null;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(document: CadDocument): void;
  restore(index: number): CadDocument | null;
};

export function createHistory(initial: CadDocument): DocumentHistory {
  let document = initial;
  let past: CadDocument[] = [];
  let future: CadDocument[] = [];

  const pushPast = (value: CadDocument) => {
    past.push(value);
    if (past.length > MAX_HISTORY) past = past.slice(past.length - MAX_HISTORY);
    future = [];
  };

  return {
    get document() {
      return document;
    },
    apply(command: Command): ApplyResult {
      const result = applyCommand(document, command);
      if (result.ok) {
        pushPast(document);
        document = result.document;
      }
      return result;
    },
    undo(): CadDocument | null {
      const previous = past.pop();
      if (!previous) return null;
      future.push(document);
      if (future.length > MAX_HISTORY) future = future.slice(future.length - MAX_HISTORY);
      document = previous;
      return document;
    },
    redo(): CadDocument | null {
      const next = future.pop();
      if (!next) return null;
      past.push(document);
      if (past.length > MAX_HISTORY) past = past.slice(past.length - MAX_HISTORY);
      document = next;
      return document;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    reset(value: CadDocument) {
      document = value;
      past = [];
      future = [];
    },
    restore(index: number): CadDocument | null {
      const entries = [...past, document];
      if (index < 0 || index >= entries.length || index === entries.length - 1) return null;
      future = [...entries.slice(index + 1).reverse(), ...future].slice(0, MAX_HISTORY);
      document = entries[index];
      past = entries.slice(0, index);
      return document;
    },
  };
}
