"use client";

import { create } from "zustand";
import { SCAD_EXAMPLES } from "@/lib/scad/examples";
import { parseParameters, setParameterInCode } from "@/lib/scad/params";
import {
  createCommand,
  type Actor,
  type Command,
} from "@/lib/studio/document/commands";
import { createEmptyDocument, defaultMaterial, identityTransform, newId } from "@/lib/studio/document/defaults";
import { migrateLegacy } from "@/lib/studio/document/migrate";
import { createDocumentStore, type DocumentStore } from "@/lib/studio/document/store";
import { indexedDbStorage } from "@/lib/studio/document/storage";
import { decodeDocumentShare } from "@/lib/studio/document/serialize";
import type { CadDocument } from "@/lib/studio/document/types";
import { CompilePool } from "@/lib/studio/compile/pool";
import {
  createCompileController,
  type CompileController,
} from "@/lib/studio/compile/controller";
import type { CompileState, CompiledVariant } from "@/lib/studio/compile/types";
import { browserCompileWorkerFactory } from "@/lib/studio/compile/worker";
import type { AgentMessage, ChatEntry, Inspection, PendingQuestion } from "./agent-types";
import type { PrintProfile, StudioImage } from "../profile";
import { createV8Study } from "./studies/v8";
import { createRotaryStudy } from "./studies/rotary";
import { createHumanoidStudy } from "./studies/humanoid";
import { createWindTurbineStudy } from "./studies/windTurbine";
import { createLighthouseStudy } from "./studies/lighthouse";

const LAST_DOCUMENT_KEY = "cadgo:v2:last-document";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type CommandInput = DistributiveOmit<Command, "id" | "at" | "actor"> & { actor?: Actor };

type StudioV2State = {
  document: CadDocument;
  booted: boolean;
  selectedInstanceId: string | null;
  selectedDefinitionId: string | null;
  selectedGroupId: string | null;
  isolatedInstanceId: string | null;
  dirtyDefinitionId: string | null;
  sourceDraft: string;
  compileStates: Record<string, CompileState>;
  variants: Record<string, CompiledVariant>;
  instanceStates: Record<string, CompileState>;
  instanceVariants: Record<string, CompiledVariant>;
  notice: string | null;
  agentMessages: AgentMessage[];
  chat: ChatEntry[];
  agentStatus: "idle" | "thinking" | "paused" | "error";
  agentActivity: string[];
  pendingQuestion: PendingQuestion | null;
  agentSteps: number;
  agentBudget: number;
  agentError: string | null;
  inspection: Inspection | null;
  agentModel: string;
  driverValues: Record<string, number>;
  driverPlaying: string | null;
  driverSpeed: number;
  referenceImages: StudioImage[];
  printProfile: PrintProfile | null;
  addReferenceImage: (image: StudioImage) => boolean;
  removeReferenceImage: (index: number) => void;
  clearReferenceImages: () => void;
  setPrintProfile: (profile: PrintProfile | null) => void;
  setDriverValue: (driverId: string, value: number) => void;
  setDriverPlaying: (driverId: string | null) => void;
  setDriverSpeed: (speed: number) => void;
  commitDriver: (driverId: string) => boolean;
  boot: () => Promise<void>;
  run: (command: CommandInput) => boolean;
  selectInstance: (id: string | null) => void;
  selectDefinition: (id: string | null) => void;
  selectGroup: (id: string | null) => void;
  isolateInstance: (id: string | null) => void;
  setSourceDraft: (id: string, source: string) => void;
  clearSourceDraft: () => void;
  applySource: (id: string) => boolean;
  setParam: (id: string, name: string, value: number | boolean) => boolean;
  setTitle: (name: string) => void;
  addInstance: (definitionId: string) => boolean;
  deleteSelected: () => boolean;
  loadExample: (id: string) => void;
  loadV8Study: () => void;
  loadRotaryStudy: () => void;
  loadHumanoidStudy: () => void;
  loadWindTurbineStudy: () => void;
  loadLighthouseStudy: () => void;
  newPart: () => void;
  importDocument: (document: CadDocument) => void;
  importScad: (code: string, title?: string) => boolean;
  undo: () => void;
  redo: () => void;
  setNotice: (notice: string | null) => void;
};

let documentStore: DocumentStore | null = null;
let compileController: CompileController | null = null;
let compilePool: CompilePool | null = null;
let bootPromise: Promise<void> | null = null;

function getDocumentStore(initial?: CadDocument): DocumentStore {
  if (!documentStore) {
    documentStore = createDocumentStore({
      document: initial ?? createEmptyDocument("New part"),
      storage: indexedDbStorage(),
      autosaveMs: 600,
    });
  }
  return documentStore;
}

function snapshotCompile(controller: CompileController, document: CadDocument) {
  const compileStates: Record<string, CompileState> = {};
  const variants: Record<string, CompiledVariant> = {};
  const instanceStates: Record<string, CompileState> = {};
  const instanceVariants: Record<string, CompiledVariant> = {};
  for (const definition of document.definitions) {
    const state = controller.getState(definition.id);
    if (state) compileStates[definition.id] = state;
    const variant = controller.getVariant(definition.id);
    if (variant) variants[definition.id] = variant;
  }
  for (const instance of document.instances) {
    const state = controller.getInstanceState(instance.id);
    if (state) instanceStates[instance.id] = state;
    const variant = controller.getInstanceVariant(instance.id);
    if (variant) instanceVariants[instance.id] = variant;
  }
  useStudioV2.setState({ compileStates, variants, instanceStates, instanceVariants });
}

export const useStudioV2 = create<StudioV2State>((set, get) => ({
  document: createEmptyDocument("New part"),
  booted: false,
  selectedInstanceId: null,
  selectedDefinitionId: null,
  selectedGroupId: null,
  isolatedInstanceId: null,
  dirtyDefinitionId: null,
  sourceDraft: "",
  compileStates: {},
  variants: {},
  instanceStates: {},
  instanceVariants: {},
  notice: null,
  agentMessages: [],
  chat: [],
  agentStatus: "idle",
  agentActivity: [],
  pendingQuestion: null,
  agentSteps: 0,
  agentBudget: 120,
  agentError: null,
  inspection: null,
  agentModel: "",
  driverValues: {},
  driverPlaying: null,
  driverSpeed: 90,
  referenceImages: [],
  printProfile: null,
  addReferenceImage: (image) => {
    const current = get().referenceImages;
    if (current.length >= 3) {
      set({ notice: "Up to three reference views are supported. Remove one first." });
      return false;
    }
    const total = current.reduce((sum, item) => sum + item.dataUrl.length, 0) + image.dataUrl.length;
    if (total > 3_000_000) {
      set({ notice: "Reference images are too large. Remove one or use a smaller image." });
      return false;
    }
    set({ referenceImages: [...current, image], notice: null });
    return true;
  },
  removeReferenceImage: (index) =>
    set((state) => ({ referenceImages: state.referenceImages.filter((_, item) => item !== index) })),
  clearReferenceImages: () => set({ referenceImages: [] }),
  setPrintProfile: (profile) => set({ printProfile: profile }),
  setDriverValue: (driverId, value) => {
    set((state) => ({ driverValues: { ...state.driverValues, [driverId]: value } }));
  },
  setDriverPlaying: (driverId) => set({ driverPlaying: driverId }),
  setDriverSpeed: (speed) => set({ driverSpeed: speed }),
  commitDriver: (driverId) => {
    const document = get().document;
    const driver = document.drivers.find((item) => item.id === driverId);
    if (!driver) return false;
    const value = get().driverValues[driverId] ?? driver.value;
    const ok = get().run({
      kind: "update_driver",
      payload: { driverId, patch: { value } },
      targetRevision: driver.revision,
      label: "Set driver",
    });
    return ok;
  },

  boot: async () => {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      const store = getDocumentStore(get().document);
      const storage = indexedDbStorage();
      let loadedShared = false;
      if (typeof window !== "undefined") {
        const shareId = new URL(window.location.href).searchParams.get("share");
        if (shareId) {
          try {
            const response = await fetch(`/api/share/${encodeURIComponent(shareId)}`);
            const data = (await response.json().catch(() => ({}))) as { payload?: string; error?: string };
            if (response.ok && typeof data.payload === "string") {
              const shared = decodeDocumentShare(`#d=${data.payload}`);
              if (shared) {
                store.replace(shared);
                loadedShared = true;
                window.history.replaceState(null, "", window.location.pathname);
              }
            } else {
              set({ notice: data.error ?? "Share link not found or expired." });
              loadedShared = true;
            }
          } catch {
            set({ notice: "Could not load this share link." });
            loadedShared = true;
          }
        }
        if (!loadedShared) {
          const shared = decodeDocumentShare(window.location.hash);
          if (shared) {
            store.replace(shared);
            loadedShared = true;
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      }
      if (!loadedShared) {
        const lastId =
          typeof window === "undefined" ? null : window.localStorage.getItem(LAST_DOCUMENT_KEY);
        if (lastId) {
          const saved = await storage.load(lastId);
          if (saved) store.replace(saved);
        }
      }
      const document = store.getDocument();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_DOCUMENT_KEY, document.id);
      }
      compilePool = new CompilePool({
        factory: browserCompileWorkerFactory(),
        size: 2,
        timeoutMs: 30_000,
        cacheLimit: 64,
      });
      compileController = createCompileController({ pool: compilePool });
      compileController.subscribe(() => snapshotCompile(compileController as CompileController, store.getDocument()));
      store.subscribe((next) => {
        set((state) => ({
          document: next,
          driverValues: Object.fromEntries(
            next.drivers.map((driver) => [driver.id, state.driverValues[driver.id] ?? driver.value]),
          ),
        }));
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_DOCUMENT_KEY, next.id);
        }
        compileController?.sync(next);
        snapshotCompile(compileController as CompileController, next);
      });
      compileController.sync(document);
      set({
        document,
        booted: true,
        driverValues: Object.fromEntries(document.drivers.map((driver) => [driver.id, driver.value])),
      });
      snapshotCompile(compileController, document);
    })();
    return bootPromise;
  },

  run: (input) => {
    const store = getDocumentStore(get().document);
    const result = store.dispatch(createCommand(input as never));
    if (!result.ok) {
      set({
        notice: result.conflict
          ? "That part changed while you were editing it. Your current edit was kept."
          : result.error,
      });
      return false;
    }
    set({ notice: null });
    return true;
  },

  selectInstance: (id) => {
    if (!id) {
      set({ selectedInstanceId: null, selectedDefinitionId: null, selectedGroupId: null, sourceDraft: "", dirtyDefinitionId: null });
      return;
    }
    const document = get().document;
    const instance = document.instances.find((item) => item.id === id);
    if (!instance) return;
    const definition = document.definitions.find((item) => item.id === instance.definitionId);
    set({
      selectedInstanceId: id,
      selectedDefinitionId: instance.definitionId,
      selectedGroupId: null,
      sourceDraft: definition?.source ?? "",
      dirtyDefinitionId: null,
    });
  },

  selectDefinition: (id) => {
    if (!id) {
      set({ selectedDefinitionId: null, sourceDraft: "", dirtyDefinitionId: null });
      return;
    }
    const definition = get().document.definitions.find((item) => item.id === id);
    if (!definition) return;
    set({
      selectedDefinitionId: id,
      selectedInstanceId: null,
      selectedGroupId: null,
      sourceDraft: definition.source,
      dirtyDefinitionId: null,
    });
  },

  selectGroup: (id) => {
    if (!id) {
      set({ selectedGroupId: null, sourceDraft: "", dirtyDefinitionId: null });
      return;
    }
    const group = get().document.groups.find((item) => item.id === id);
    if (!group) return;
    set({
      selectedGroupId: id,
      selectedInstanceId: null,
      selectedDefinitionId: null,
      sourceDraft: "",
      dirtyDefinitionId: null,
    });
  },

  isolateInstance: (id) => set({ isolatedInstanceId: id }),

  setSourceDraft: (id, source) => {
    set({ dirtyDefinitionId: id, sourceDraft: source });
  },

  clearSourceDraft: () => {
    const definition = get().document.definitions.find((item) => item.id === get().selectedDefinitionId);
    set({
      dirtyDefinitionId: null,
      sourceDraft: definition?.source ?? "",
    });
  },

  applySource: (id) => {
    const definition = get().document.definitions.find((item) => item.id === id);
    if (!definition) return false;
    const ok = get().run({
      kind: "update_definition",
      payload: { definitionId: id, patch: { source: get().sourceDraft } },
      targetRevision: definition.revision,
      label: "Edit part source",
    });
    if (ok) set({ dirtyDefinitionId: null });
    return ok;
  },

  setParam: (id, name, value) => {
    const definition = get().document.definitions.find((item) => item.id === id);
    if (!definition) return false;
    const source = setParameterInCode(definition.source, name, value);
    if (source === definition.source) return false;
    return get().run({
      kind: "update_definition",
      payload: { definitionId: id, patch: { source } },
      targetRevision: definition.revision,
      label: `Set ${name}`,
    });
  },

  setTitle: (name) => {
    const document = get().document;
    get().run({
      kind: "update_document",
      payload: { name },
      targetRevision: document.revision,
      label: "Rename document",
    });
  },

  addInstance: (definitionId) => {
    const document = get().document;
    const definition = document.definitions.find((item) => item.id === definitionId);
    const count = document.instances.filter((item) => item.definitionId === definitionId).length;
    const variant = get().variants[definitionId];
    const width = variant
      ? Math.max(1, variant.mesh.bounds.max[0] - variant.mesh.bounds.min[0])
      : 0;
    const transform = identityTransform();
    transform.position = [count * width * 2, 0, 0];
    const instance = {
      id: newId("inst"),
      definitionId,
      name: `${definition?.name ?? "Part"} ${count + 1}`,
      parentId: null,
      transform,
      visible: true,
      locked: false,
      suppressed: false,
    };
    const ok = get().run({
      kind: "create_instance",
      payload: { instance },
      label: "Add instance",
    });
    if (ok) get().selectInstance(instance.id);
    return ok;
  },

  deleteSelected: () => {
    const { selectedInstanceId, selectedDefinitionId, document } = get();
    if (selectedInstanceId) {
      const instance = document.instances.find((item) => item.id === selectedInstanceId);
      if (!instance) return false;
      return get().run({
        kind: "delete_instance",
        payload: { instanceId: selectedInstanceId },
        targetRevision: instance.revision,
        label: "Delete instance",
      });
    }
    if (selectedDefinitionId) {
      const definition = document.definitions.find((item) => item.id === selectedDefinitionId);
      if (!definition) return false;
      return get().run({
        kind: "delete_definition",
        payload: { definitionId: definition.id },
        targetRevision: definition.revision,
        label: "Delete part",
      });
    }
    return false;
  },

  loadExample: (id) => {
    const example = SCAD_EXAMPLES.find((item) => item.id === id);
    if (!example) return;
    get().importDocument(migrateLegacy({ title: example.title, code: example.code }));
    set({ notice: `${example.title} loaded as an editable part.` });
  },

  loadV8Study: () => {
    get().importDocument(createV8Study());
    set({ notice: "V8 concept loaded. Select any part, scrub the crank, or ask the agent to change it." });
  },

  loadRotaryStudy: () => {
    get().importDocument(createRotaryStudy());
    set({ notice: "Rotary mechanism loaded. Transparent housings show the rotors and drive gear." });
  },

  loadHumanoidStudy: () => {
    get().importDocument(createHumanoidStudy());
    set({ notice: "Humanoid robot loaded. Scrub walk_phase or press play to run the walk cycle." });
  },

  loadWindTurbineStudy: () => {
    get().importDocument(createWindTurbineStudy());
    set({ notice: "Wind turbine loaded. Scrub rotor_angle or press play to spin the rotor." });
  },

  loadLighthouseStudy: () => {
    get().importDocument(createLighthouseStudy());
    set({ notice: "Lighthouse scene loaded. Scrub beacon_angle or press play to turn the beacon." });
  },

  newPart: () => {
    get().importDocument(createEmptyDocument("New part"));
  },

  importDocument: (document) => {
    getDocumentStore(get().document).replace(document);
    set({
      document,
      driverValues: Object.fromEntries(document.drivers.map((driver) => [driver.id, driver.value])),
      driverPlaying: null,
      selectedInstanceId: null,
      selectedDefinitionId: null,
      selectedGroupId: null,
      isolatedInstanceId: null,
      referenceImages: [],
      printProfile: null,
      sourceDraft: document.definitions[0]?.source ?? "", 
      dirtyDefinitionId: null,
      notice: null,
      agentMessages: [],
      chat: [],
      agentStatus: "idle",
      agentActivity: [],
      pendingQuestion: null,
      agentSteps: 0,
      agentError: null,
      inspection: null,
      agentModel: "",
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_DOCUMENT_KEY, document.id);
    }
    compileController?.sync(document);
    if (compileController) snapshotCompile(compileController, document);
  },

  importScad: (code, title) => {
    const source = code.slice(0, 200_000).trim();
    if (!source) {
      set({ notice: "That OpenSCAD file is empty." });
      return false;
    }
    const name = (title ?? "Imported part").replace(/\.scad$/i, "").slice(0, 80) || "Imported part";
    const definition = {
      id: newId("def"),
      name,
      source,
      params: parseParameters(source),
      material: defaultMaterial(),
      materialMode: "source" as const,
      locked: false,
    };
    if (!get().run({ kind: "create_definition", payload: { definition }, label: `Import ${name}` })) {
      return false;
    }
    const instance = {
      id: newId("inst"),
      definitionId: definition.id,
      name,
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
    };
    const ok = get().run({
      kind: "create_instance",
      payload: { instance },
      label: `Place ${name}`,
    });
    if (ok) get().selectInstance(instance.id);
    return ok;
  },

  undo: () => {
    const result = getDocumentStore(get().document).undo();
    if (!result) {
      set({ notice: "Nothing to undo." });
      return;
    }
    set({ document: result.document, notice: null });
  },

  redo: () => {
    const result = getDocumentStore(get().document).redo();
    if (!result) {
      set({ notice: "Nothing to redo." });
      return;
    }
    set({ document: result.document, notice: null });
  },

  setNotice: (notice) => set({ notice }),
}));

export function selectedDefinition(document: CadDocument, definitionId: string | null) {
  return definitionId ? document.definitions.find((item) => item.id === definitionId) ?? null : null;
}

export function selectedInstance(document: CadDocument, instanceId: string | null) {
  return instanceId ? document.instances.find((item) => item.id === instanceId) ?? null : null;
}
