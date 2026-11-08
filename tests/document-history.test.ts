import { describe, expect, it } from "vitest";
import { createEmptyDocument, defaultMaterial, newId } from "../lib/studio/document/defaults";
import { createHistory } from "../lib/studio/document/history";
import type { Command } from "../lib/studio/document/commands";

function createDefinitionCommand(name: string): Command {
  const id = newId("def");
  return {
    id: newId("cmd"),
    actor: "user",
    kind: "create_definition",
    payload: {
      definition: {
        id,
        name,
        source: `width = 20;\ncube([width, width, width]);`,
        params: [],
        material: defaultMaterial(),
      },
    },
    label: `Create ${name}`,
    at: new Date().toISOString(),
  } as Command;
}

describe("document history", () => {
  it("undoes and redoes commands", () => {
    const history = createHistory(createEmptyDocument());
    expect(history.canUndo()).toBe(false);
    expect(history.apply(createDefinitionCommand("Block")).ok).toBe(true);
    expect(history.apply(createDefinitionCommand("Head")).ok).toBe(true);
    expect(history.document.definitions).toHaveLength(2);
    expect(history.canUndo()).toBe(true);

    expect(history.undo()).not.toBeNull();
    expect(history.document.definitions).toHaveLength(1);
    expect(history.undo()).not.toBeNull();
    expect(history.document.definitions).toHaveLength(0);
    expect(history.undo()).toBeNull();
    expect(history.canRedo()).toBe(true);

    expect(history.redo()).not.toBeNull();
    expect(history.document.definitions).toHaveLength(1);
    expect(history.redo()).not.toBeNull();
    expect(history.document.definitions).toHaveLength(2);
    expect(history.redo()).toBeNull();
  });

  it("caps history at 100 entries", () => {
    const history = createHistory(createEmptyDocument());
    for (let index = 0; index < 105; index++) {
      expect(history.apply(createDefinitionCommand(`Part ${index}`)).ok).toBe(true);
    }
    let undos = 0;
    while (history.undo()) undos++;
    expect(undos).toBe(100);
  });

  it("does not push failed commands", () => {
    const history = createHistory(createEmptyDocument());
    const command = createDefinitionCommand("Block");
    expect(history.apply(command).ok).toBe(true);
    expect(history.apply(command).ok).toBe(false);
    expect(history.canUndo()).toBe(true);
    history.undo();
    expect(history.document.definitions).toHaveLength(0);
  });

  it("restores to an earlier entry", () => {
    const history = createHistory(createEmptyDocument());
    history.apply(createDefinitionCommand("Block"));
    const first = history.document;
    history.apply(createDefinitionCommand("Head"));
    expect(history.document.definitions).toHaveLength(2);
    const restored = history.restore(1);
    expect(restored).toBe(first);
    expect(history.document.definitions).toHaveLength(1);
    expect(history.canRedo()).toBe(true);
  });
});
