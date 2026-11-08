import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDocument, defaultMaterial, newId } from "../lib/studio/document/defaults";
import { memoryStorage } from "../lib/studio/document/storage";
import { createDocumentStore } from "../lib/studio/document/store";
import type { Command } from "../lib/studio/document/commands";

function createDefinitionCommand(name: string): Command {
  return {
    id: newId("cmd"),
    actor: "user",
    kind: "create_definition",
    payload: {
      definition: {
        id: newId("def"),
        name,
        source: "width = 20;\ncube([width, width, width]);",
        params: [],
        material: defaultMaterial(),
      },
    },
    label: `Create ${name}`,
    at: new Date().toISOString(),
  } as Command;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document store", () => {
  it("notifies subscribers and persists after the debounce", async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const document = createEmptyDocument("Assembly");
    const store = createDocumentStore({ document, storage, autosaveMs: 500 });
    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications++;
    });

    expect(store.dispatch(createDefinitionCommand("Block")).ok).toBe(true);
    expect(notifications).toBe(1);
    expect(await storage.load(document.id)).toBeNull();

    await vi.advanceTimersByTimeAsync(500);
    const saved = await storage.load(document.id);
    expect(saved?.definitions).toHaveLength(1);
    expect(saved?.definitions[0].name).toBe("Block");

    unsubscribe();
    store.destroy();
  });

  it("flushes immediately and preserves undo state", async () => {
    const storage = memoryStorage();
    const document = createEmptyDocument("Assembly");
    const store = createDocumentStore({ document, storage });
    store.dispatch(createDefinitionCommand("Block"));
    await store.flush();
    const saved = await storage.load(document.id);
    expect(saved?.definitions).toHaveLength(1);
    expect(store.canUndo()).toBe(true);
    expect(store.undo()?.ok).toBe(true);
    expect(store.getDocument().definitions).toHaveLength(0);
    expect(store.canRedo()).toBe(true);
    store.destroy();
  });

  it("replaces the document and resets history", async () => {
    const storage = memoryStorage();
    const first = createEmptyDocument("First");
    const store = createDocumentStore({ document: first, storage });
    store.dispatch(createDefinitionCommand("Block"));
    expect(store.canUndo()).toBe(true);

    const replacement = createEmptyDocument("Second");
    store.replace(replacement);
    expect(store.getDocument().name).toBe("Second");
    expect(store.canUndo()).toBe(false);
    await store.flush();
    expect((await storage.load(replacement.id))?.name).toBe("Second");
    store.destroy();
  });
});
