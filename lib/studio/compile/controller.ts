import { parametersToValues } from "../../scad/params";
import { stableParams } from "./cache";
import type { CadDocument, PartDefinition, PartInstance } from "../document/types";
import type { CompileOutcome, CompileRequest, CompiledVariant, CompileState } from "./types";

export type CompilePoolLike = {
  compile(request: CompileRequest, priority?: number): Promise<CompileOutcome>;
};

export type CompileControllerOptions = {
  pool: CompilePoolLike;
  priorityFor?: (definitionId: string) => number;
};

export type CompileController = {
  sync(document: CadDocument): void;
  getState(definitionId: string): CompileState | undefined;
  getVariant(definitionId: string): CompiledVariant | undefined;
  getInstanceState(instanceId: string): CompileState | undefined;
  getInstanceVariant(instanceId: string): CompiledVariant | undefined;
  subscribe(listener: () => void): () => void;
  retry(definitionId: string): void;
  dispose(): void;
};

export function createCompileController(options: CompileControllerOptions): CompileController {
  const states = new Map<string, CompileState>();
  const variants = new Map<string, CompiledVariant>();
  const revisions = new Map<string, number>();
  const versions = new Map<string, number>();
  const instanceStates = new Map<string, CompileState>();
  const instanceVariants = new Map<string, CompiledVariant>();
  const instanceSignatures = new Map<string, string>();
  const instanceVersions = new Map<string, number>();
  const listeners = new Set<() => void>();
  let document: CadDocument | null = null;
  let library = "";
  let disposed = false;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setState = (definitionId: string, state: CompileState) => {
    states.set(definitionId, state);
    notify();
  };

  const compileDefinition = (definition: PartDefinition) => {
    const version = (versions.get(definition.id) ?? 0) + 1;
    versions.set(definition.id, version);
    revisions.set(definition.id, definition.revision);
    const previous = states.get(definition.id)?.lastGood;
    setState(definition.id, {
      definitionId: definition.id,
      revision: definition.revision,
      key: "",
      status: previous ? "stale" : "queued",
      lastGood: previous,
    });
    const request: CompileRequest = {
      source: definition.source,
      params: parametersToValues(definition.params),
      library,
    };
    void options.pool
      .compile(request, options.priorityFor?.(definition.id) ?? 0)
      .then((outcome) => {
        if (disposed || versions.get(definition.id) !== version) return;
        if (outcome.ok) {
          variants.set(definition.id, outcome);
          setState(definition.id, {
            definitionId: definition.id,
            revision: definition.revision,
            key: outcome.key,
            status: "ready",
            metrics: outcome.metrics,
            logs: outcome.logs,
            lastGood: outcome,
          });
          return;
        }
        setState(definition.id, {
          definitionId: definition.id,
          revision: definition.revision,
          key: "",
          status: "error",
          error: outcome.error,
          logs: outcome.logs,
          lastGood: previous,
        });
      })
      .catch((error: unknown) => {
        if (disposed || versions.get(definition.id) !== version) return;
        setState(definition.id, {
          definitionId: definition.id,
          revision: definition.revision,
          key: "",
          status: "error",
          error: error instanceof Error ? error.message : "Compilation failed.",
          lastGood: previous,
        });
      });
  };

  const compileInstance = (instance: PartInstance, definition: PartDefinition) => {
    const version = (instanceVersions.get(instance.id) ?? 0) + 1;
    instanceVersions.set(instance.id, version);
    const previous = instanceStates.get(instance.id)?.lastGood;
    setInstanceState(instance.id, {
      definitionId: definition.id,
      revision: instance.revision,
      key: "",
      status: previous ? "stale" : "queued",
      lastGood: previous,
    });
    const params = {
      ...parametersToValues(definition.params),
      ...(instance.paramOverrides ?? {}),
    };
    void options.pool
      .compile({
        source: definition.source,
        params,
        library,
      })
      .then((outcome) => {
        if (disposed || instanceVersions.get(instance.id) !== version) return;
        if (outcome.ok) {
          instanceVariants.set(instance.id, outcome);
          setInstanceState(instance.id, {
            definitionId: definition.id,
            revision: instance.revision,
            key: outcome.key,
            status: "ready",
            metrics: outcome.metrics,
            logs: outcome.logs,
            lastGood: outcome,
          });
          return;
        }
        setInstanceState(instance.id, {
          definitionId: definition.id,
          revision: instance.revision,
          key: "",
          status: "error",
          error: outcome.error,
          logs: outcome.logs,
          lastGood: previous,
        });
      })
      .catch((error: unknown) => {
        if (disposed || instanceVersions.get(instance.id) !== version) return;
        setInstanceState(instance.id, {
          definitionId: definition.id,
          revision: instance.revision,
          key: "",
          status: "error",
          error: error instanceof Error ? error.message : "Compilation failed.",
          lastGood: previous,
        });
      });
  };

  const setInstanceState = (instanceId: string, state: CompileState) => {
    instanceStates.set(instanceId, state);
    notify();
  };

  return {
    sync(next) {
      if (disposed) return;
      const documentChanged = document?.id !== next.id;
      document = next;
      if (documentChanged) {
        states.clear();
        variants.clear();
        revisions.clear();
        versions.clear();
        instanceStates.clear();
        instanceVariants.clear();
        instanceSignatures.clear();
        instanceVersions.clear();
      }
      const libraryChanged = documentChanged || library !== next.library;
      library = next.library;
      const currentIds = new Set(next.definitions.map((definition) => definition.id));
      for (const id of [...states.keys()]) {
        if (!currentIds.has(id)) {
          states.delete(id);
          variants.delete(id);
          revisions.delete(id);
          versions.delete(id);
        }
      }
      for (const definition of next.definitions) {
        const lastRevision = revisions.get(definition.id);
        const state = states.get(definition.id);
        if (!libraryChanged && lastRevision === definition.revision && state) continue;
        compileDefinition(definition);
      }

      const instanceIds = new Set(next.instances.map((instance) => instance.id));
      for (const id of [...instanceStates.keys()]) {
        if (!instanceIds.has(id)) {
          instanceStates.delete(id);
          instanceVariants.delete(id);
          instanceSignatures.delete(id);
          instanceVersions.delete(id);
        }
      }
      const definitions = new Map(next.definitions.map((definition) => [definition.id, definition]));
      for (const instance of next.instances) {
        const overrides = instance.paramOverrides;
        if (!overrides || !Object.keys(overrides).length) {
          instanceStates.delete(instance.id);
          instanceVariants.delete(instance.id);
          instanceSignatures.delete(instance.id);
          instanceVersions.delete(instance.id);
          continue;
        }
        const definition = definitions.get(instance.definitionId);
        if (!definition) continue;
        const signature = `${instance.revision}:${definition.revision}:${stableParams(overrides)}`;
        if (!libraryChanged && instanceSignatures.get(instance.id) === signature && instanceStates.has(instance.id)) {
          continue;
        }
        instanceSignatures.set(instance.id, signature);
        compileInstance(instance, definition);
      }
      notify();
    },
    getState: (definitionId) => states.get(definitionId),
    getVariant: (definitionId) => variants.get(definitionId),
    getInstanceState: (instanceId) => instanceStates.get(instanceId),
    getInstanceVariant: (instanceId) => instanceVariants.get(instanceId),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retry(definitionId) {
      if (!document) return;
      const definition = document.definitions.find((item) => item.id === definitionId);
      if (!definition) return;
      revisions.delete(definitionId);
      compileDefinition(definition);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      states.clear();
      variants.clear();
      revisions.clear();
      versions.clear();
      instanceStates.clear();
      instanceVariants.clear();
      instanceSignatures.clear();
      instanceVersions.clear();
    },
  };
}
