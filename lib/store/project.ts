"use client";

import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import LZString from "lz-string";
import { Euler, Quaternion, Vector3 } from "three";
import { cadClient } from "@/lib/cad/client";
import { lampSpec } from "@/lib/cad/examples/lamp";
import { normalizeSpec, specErrors, validateSpec } from "@/lib/cad/validate";
import { poseSpec } from "@/lib/cad/pose";
import { poseBounds } from "@/lib/cad/bounds";
import type { CadSpec, CompileResult, PartMesh, Vec3 } from "@/lib/cad/types";
import { downloadGlb, downloadStl } from "@/lib/export/mesh";
import type { OrbitView } from "@/lib/view";

export type Message = {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  notes?: string[];
  time: string;
};

export type StageStatus = "pending" | "active" | "done" | "error";

export type Stage = {
  id: string;
  label: string;
  status: StageStatus;
};

export type FacePick = {
  partId: string;
  point: Vec3;
  normal: Vec3;
};

export type RecentProject = {
  id: string;
  name: string;
  prompt: string;
  spec: CadSpec;
  updatedAt: number;
};

type Status = "idle" | "drafting" | "compiling" | "done" | "error";

type ProjectState = {
  screen: "landing" | "workbench";
  spec: CadSpec | null;
  meshes: PartMesh[];
  bounds: { min: Vec3; max: Vec3 } | null;
  offset: Vec3;
  compileMs: number;
  compileErrors: string[];
  jointValues: Record<string, number>;
  selectedPartId: string | null;
  selectedJointId: string | null;
  hoveredPartId: string | null;
  hiddenParts: Record<string, boolean>;
  view: OrbitView;
  plate: boolean;
  explode: number;
  fitKey: number;
  status: Status;
  stages: Stage[];
  error: string | null;
  prompt: string;
  messages: Message[];
  playing: boolean;
  timeline: number;
  history: CadSpec[];
  historyIndex: number;
  recents: RecentProject[];
  facePick: FacePick | null;
  pickMode: "none" | "hole";
  captureRequest: number;
  savedAt: number | null;
  lastPrompt: string;
};

type ProjectActions = {
  setPrompt: (prompt: string) => void;
  goHome: () => void;
  generate: (prompt: string) => Promise<void>;
  edit: (message: string) => Promise<void>;
  loadExample: (spec: CadSpec, prompt?: string) => Promise<void>;
  loadSpec: (spec: CadSpec, options?: { prompt?: string; fit?: boolean; history?: boolean }) => Promise<void>;
  compile: (spec: CadSpec, options?: { fit?: boolean; keepJoints?: boolean }) => Promise<boolean>;
  setParameter: (id: string, value: number) => void;
  selectPart: (id: string | null) => void;
  selectJoint: (id: string | null) => void;
  setHoveredPart: (id: string | null) => void;
  togglePart: (id: string) => void;
  setJoint: (id: string, value: number) => void;
  resetJoints: () => void;
  setView: (view: OrbitView) => void;
  setPlate: (plate: boolean) => void;
  setExplode: (explode: number) => void;
  fit: () => void;
  undo: () => void;
  redo: () => void;
  play: () => void;
  pause: () => void;
  seek: (progress: number) => void;
  exportStl: () => void;
  exportGlb: () => void;
  exportJson: () => void;
  shareLink: () => string | null;
  refreshRecents: () => Promise<void>;
  loadRecent: (id: string) => Promise<void>;
  loadFromHash: () => Promise<boolean>;
  setCaptureRequest: () => void;
  startHolePick: () => void;
  cancelHolePick: () => void;
  setFacePick: (pick: FacePick | null) => void;
  cutHole: (diameter: number) => Promise<void>;
  dismissError: () => void;
};

const initialStages: Stage[] = [
  { id: "brief", label: "Read the brief", status: "pending" },
  { id: "parts", label: "Cut the parts", status: "pending" },
  { id: "joints", label: "Fit the joints", status: "pending" },
  { id: "check", label: "Check the motion", status: "pending" },
];

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let compileTimer: ReturnType<typeof setTimeout> | null = null;
let playFrame: number | null = null;
let compileSeq = 0;
let requestSeq = 0;
let currentAbort: AbortController | null = null;

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clock() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function sessionId() {
  if (typeof window === "undefined") return "server";
  const key = "cadgo:session";
  let value = localStorage.getItem(key);
  if (!value) {
    value = uid();
    localStorage.setItem(key, value);
  }
  return value;
}

function offsetFor(bounds: CompileResult["bounds"]): Vec3 {
  if (!bounds) return [0, 0, 0];
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  return [-cx, -cy, -bounds.min[2]];
}

function initialJointValues(spec: CadSpec): Record<string, number> {
  const values: Record<string, number> = {};
  for (const joint of spec.joints) values[joint.id] = joint.value ?? 0;
  return values;
}

function stageSet(stages: Stage[], id: string, status: StageStatus) {
  return stages.map((stage) => (stage.id === id ? { ...stage, status } : stage));
}

function stepsFor(spec: CadSpec) {
  if (spec.demo && spec.demo.length) return spec.demo;
  const steps: { joint: string; to: number; duration: number; hold?: number }[] = [];
  for (const joint of spec.joints) {
    if (joint.type === "fixed") continue;
    const [min, max] = joint.limits ?? (joint.type === "prismatic" ? [-30, 30] : [-45, 45]);
    steps.push({ joint: joint.id, to: max, duration: 700, hold: 160 });
    steps.push({ joint: joint.id, to: min, duration: 900, hold: 160 });
    steps.push({ joint: joint.id, to: 0, duration: 700, hold: 100 });
  }
  return steps;
}

function timelineAt(spec: CadSpec, progress: number) {
  const steps = stepsFor(spec);
  if (!steps.length) return { values: initialJointValues(spec), active: null as string | null };
  const total = steps.reduce((sum, step) => sum + step.duration + (step.hold ?? 0), 0);
  let time = Math.min(Math.max(progress, 0), 1) * total;
  const values = initialJointValues(spec);
  for (const step of steps) {
    if (time <= step.duration) {
      const start = values[step.joint] ?? 0;
      const raw = step.duration > 0 ? time / step.duration : 1;
      const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      values[step.joint] = start + (step.to - start) * eased;
      return { values, active: step.joint };
    }
    values[step.joint] = step.to;
    time -= step.duration;
    const hold = step.hold ?? 0;
    if (time <= hold) return { values, active: step.joint };
    time -= hold;
  }
  return { values, active: steps.at(-1)?.joint ?? null };
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function saveRecent(spec: CadSpec, prompt: string) {
  if (typeof window === "undefined") return;
  const recent: RecentProject = {
    id: slug(spec.name) || "last",
    name: spec.name,
    prompt: prompt || spec.sourcePrompt || "",
    spec,
    updatedAt: Date.now(),
  };
  idbSet("cadgo:last", recent).catch(() => {});
  idbGet<RecentProject[]>("cadgo:recents")
    .then((existing) => {
      const list = (existing ?? []).filter((item) => item.spec.name !== spec.name);
      list.unshift(recent);
      return idbSet("cadgo:recents", list.slice(0, 8));
    })
    .catch(() => {});
}

export const useProject = create<ProjectState & ProjectActions>((set, get) => ({
  screen: "landing",
  spec: null,
  meshes: [],
  bounds: null,
  offset: [0, 0, 0],
  compileMs: 0,
  compileErrors: [],
  jointValues: {},
  selectedPartId: null,
  selectedJointId: null,
  hoveredPartId: null,
  hiddenParts: {},
  view: "iso",
  plate: false,
  explode: 0,
  fitKey: 0,
  status: "idle",
  stages: initialStages,
  error: null,
  prompt: "",
  messages: [],
  playing: false,
  timeline: 0,
  history: [],
  historyIndex: -1,
  recents: [],
  facePick: null,
  pickMode: "none",
  captureRequest: 0,
  savedAt: null,
  lastPrompt: "",

  setPrompt: (prompt) => set({ prompt }),

  goHome: () => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    get().pause();
    set({
      screen: "landing",
      selectedPartId: null,
      selectedJointId: null,
      plate: false,
      error: null,
    });
    window.setTimeout(() => get().refreshRecents(), 150);
  },

  compile: async (spec, options = {}) => {
    const seq = ++compileSeq;
    const keepJoints = options.keepJoints ?? false;
    set({
      status: "compiling",
      error: null,
      stages: stageSet(get().stages, "parts", "active"),
    } as Partial<ProjectState>);
    try {
      const result = await cadClient().compile(spec);
      if (seq !== compileSeq) return false;
      if (!result.parts.length) {
        throw new Error(result.errors[0]?.message ?? "No watertight parts were produced");
      }
      if (result.errors.length) {
        set({
          compileErrors: result.errors.map((item) => item.message),
          stages: stageSet(get().stages, "parts", "error"),
          status: "error",
          error: result.errors[0].message,
        });
        return false;
      }
      const restValues = initialJointValues(spec);
      const restPose = poseSpec(spec, restValues);
      const worldBounds = poseBounds(result.parts, restPose.matrices);
      const offset = offsetFor(worldBounds);
      const values = keepJoints ? get().jointValues : initialJointValues(spec);
      set({
        spec,
        meshes: result.parts,
        bounds: worldBounds,
        offset,
        compileMs: result.ms,
        compileErrors: [],
        jointValues: values,
        stages: stageSet(
          stageSet(stageSet(get().stages, "parts", "done"), "joints", "done"),
          "check",
          "done",
        ),
        status: "done",
        fitKey: options.fit ? get().fitKey + 1 : get().fitKey,
        savedAt: Date.now(),
      });
      saveRecent(spec, get().lastPrompt || get().prompt);
      return true;
    } catch (error) {
      if (seq !== compileSeq) return false;
      const message = error instanceof Error ? error.message : "The geometry did not build";
      set({
        status: "error",
        error: message,
        compileErrors: [message],
        stages: stageSet(get().stages, "parts", "error"),
      });
      return false;
    }
  },

  generate: async (prompt) => {
    const clean = prompt.trim();
    if (!clean) return;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    get().pause();
    const userMessage: Message = {
      id: uid(),
      role: "user",
      text: clean,
      time: clock(),
    };
    set({
      screen: "workbench",
      status: "drafting",
      prompt: "",
      lastPrompt: clean,
      error: null,
      selectedPartId: null,
      selectedJointId: null,
      plate: false,
      playing: false,
      timeline: 0,
      explode: 0,
      facePick: null,
      pickMode: "none",
      stages: initialStages.map((stage) => ({
        ...stage,
        status: stage.id === "brief" ? "active" : "pending",
      })),
      messages: get().screen === "workbench" && get().spec ? [...get().messages, userMessage] : [userMessage],
    });
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean, sessionId: sessionId() }),
        signal: currentAbort?.signal,
      });
      if (token !== requestSeq) return;
      const payload = await response.json();
      if (!response.ok || !payload.spec) {
        throw new Error(payload.error ?? "The drafter did not return a model");
      }
      let spec = normalizeSpec(payload.spec as CadSpec);
      const issues = specErrors(spec);
      if (issues.length) throw new Error(issues[0]);
      const aiMessage: Message = {
        id: uid(),
        role: "ai",
        text: payload.message ?? `Drafted ${spec.name}.`,
        notes: payload.notes ?? spec.notes,
        time: clock(),
      };
      set({
        messages: [...get().messages, aiMessage],
        stages: stageSet(get().stages, "brief", "done"),
      });
      if (token !== requestSeq) return;
      const ok = await get().compile(spec, { fit: true });
      if (token !== requestSeq) return;
      if (!ok) {
        throw new Error(get().error ?? "The parts did not survive the kernel");
      }
      const history = [...get().history.slice(0, get().historyIndex + 1), spec].slice(-20);
      set({
        status: "done",
        stages: stageSet(stageSet(get().stages, "check", "active"), "joints", "done"),
        history,
        historyIndex: history.length - 1,
        savedAt: Date.now(),
      });
      window.setTimeout(() => {
        if (get().status === "done") {
          set({ stages: stageSet(get().stages, "check", "done") });
        }
      }, 400);
    } catch (error) {
      if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
      const message = error instanceof Error ? error.message : "The draft failed";
      set({
        status: "error",
        error: message,
        stages: get().stages.map((stage) =>
          stage.status === "active" || stage.status === "pending"
            ? { ...stage, status: stage.status === "active" ? "error" : "pending" }
            : stage,
        ),
      });
    }
  },

  edit: async (message) => {
    const spec = get().spec;
    if (!spec || !message.trim()) return;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    get().pause();
    const userMessage: Message = { id: uid(), role: "user", text: message.trim(), time: clock() };
    set({
      status: "drafting",
      error: null,
      messages: [...get().messages, userMessage],
      stages: [
        { id: "edit", label: "Revise the assembly", status: "active" },
        { id: "parts", label: "Recut the changed parts", status: "pending" },
        { id: "fit", label: "Refit the joints", status: "pending" },
      ],
    });
    const selected = get().selectedPartId;
    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec,
          message: message.trim(),
          sessionId: sessionId(),
          selectedPartId: selected,
        }),
        signal: currentAbort?.signal,
      });
      if (token !== requestSeq) return;
      const payload = await response.json();
      if (!response.ok || !payload.spec) {
        throw new Error(payload.error ?? "The revision did not return a model");
      }
      const next = normalizeSpec(payload.spec as CadSpec);
      const issues = specErrors(next);
      if (issues.length) throw new Error(issues[0]);
      const aiMessage: Message = {
        id: uid(),
        role: "ai",
        text: payload.message ?? "Revised the assembly.",
        notes: payload.notes,
        time: clock(),
      };
      set({
        messages: [...get().messages, aiMessage],
        stages: [
          { id: "edit", label: "Revise the assembly", status: "done" },
          { id: "parts", label: "Recut the changed parts", status: "active" },
          { id: "fit", label: "Refit the joints", status: "pending" },
        ],
      });
      if (token !== requestSeq) return;
      const ok = await get().compile(next, { keepJoints: true });
      if (token !== requestSeq) return;
      if (!ok) throw new Error(get().error ?? "The revised parts did not build");
      const history = [...get().history.slice(0, get().historyIndex + 1), next].slice(-20);
      set({
        status: "done",
        stages: [
          { id: "edit", label: "Revise the assembly", status: "done" },
          { id: "parts", label: "Recut the changed parts", status: "done" },
          { id: "fit", label: "Refit the joints", status: "done" },
        ],
        history,
        historyIndex: history.length - 1,
      });
    } catch (error) {
      if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
      const text = error instanceof Error ? error.message : "The revision failed";
      set({
        status: "error",
        error: text,
        stages: get().stages.map((stage) =>
          stage.status === "active" ? { ...stage, status: "error" } : stage,
        ),
      });
    }
  },

  loadExample: async (spec, prompt) => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    get().pause();
    const clean = normalizeSpec(spec);
    const userMessage: Message = {
      id: uid(),
      role: "user",
      text: prompt ?? spec.sourcePrompt ?? `Show me ${spec.name}.`,
      time: clock(),
    };
    const aiMessage: Message = {
      id: uid(),
      role: "ai",
      text: `Loaded ${clean.name} from the benchbook.`,
      notes: clean.notes,
      time: clock(),
    };
    set({
      screen: "workbench",
      status: "compiling",
      prompt: "",
      lastPrompt: prompt ?? clean.sourcePrompt ?? clean.name,
      error: null,
      selectedPartId: null,
      selectedJointId: null,
      hiddenParts: {},
      plate: false,
      playing: false,
      timeline: 0,
      explode: 0,
      facePick: null,
      pickMode: "none",
      messages: [userMessage, aiMessage],
      stages: initialStages.map((stage) => ({ ...stage, status: "done" })),
      history: [clean],
      historyIndex: 0,
    });
    const ok = await get().compile(clean, { fit: true });
    set({
      status: ok ? "done" : "error",
      stages: ok
        ? initialStages.map((stage) => ({ ...stage, status: "done" }))
        : get().stages,
    });
  },

  loadSpec: async (spec, options = {}) => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    get().pause();
    const clean = normalizeSpec(spec);
    set({
      screen: "workbench",
      spec: clean,
      status: "compiling",
      error: null,
      selectedPartId: null,
      selectedJointId: null,
      hiddenParts: {},
      plate: false,
      playing: false,
      timeline: 0,
      explode: 0,
      facePick: null,
      pickMode: "none",
      messages: [
        ...(options.prompt
          ? [
              {
                id: uid(),
                role: "user" as const,
                text: options.prompt,
                time: clock(),
              },
            ]
          : []),
        {
          id: uid(),
          role: "ai" as const,
          text: `Loaded ${clean.name}.`,
          notes: clean.notes,
          time: clock(),
        },
      ],
      stages: initialStages.map((stage) => ({ ...stage, status: "done" })),
    });
    const ok = await get().compile(clean, { fit: options.fit ?? true });
    set({
      status: ok ? "done" : "error",
      history: options.history === false ? get().history : [clean],
      historyIndex: options.history === false ? get().historyIndex : 0,
    });
  },

  setParameter: (id, value) => {
    const spec = get().spec;
    if (!spec) return;
    const parameters = spec.parameters.map((parameter) => {
      if (parameter.id !== id) return parameter;
      const min = parameter.min ?? -Infinity;
      const max = parameter.max ?? Infinity;
      return { ...parameter, value: Math.min(max, Math.max(min, value)) };
    });
    const next = { ...spec, parameters };
    set({ spec: next });
    if (compileTimer) clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      const current = get().spec;
      if (current) get().compile(current, { keepJoints: true });
    }, 180);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveRecent(next, get().lastPrompt), 700);
  },

  selectPart: (id) => set({ selectedPartId: id, selectedJointId: null }),
  selectJoint: (id) => set({ selectedJointId: id, selectedPartId: null }),
  setHoveredPart: (id) => set({ hoveredPartId: id }),

  togglePart: (id) =>
    set((state) => ({
      hiddenParts: { ...state.hiddenParts, [id]: !state.hiddenParts[id] },
    })),

  setJoint: (id, value) => {
    const spec = get().spec;
    if (!spec) return;
    const joint = spec.joints.find((item) => item.id === id);
    if (!joint) return;
    const [min, max] = joint.limits ?? (joint.type === "prismatic" ? [-50, 50] : [-180, 180]);
    set({
      jointValues: { ...get().jointValues, [id]: Math.min(max, Math.max(min, value)) },
    });
  },

  resetJoints: () => {
    const spec = get().spec;
    if (!spec) return;
    set({ jointValues: initialJointValues(spec), timeline: 0, playing: false });
    if (playFrame) cancelAnimationFrame(playFrame);
    playFrame = null;
  },

  setView: (view) => set({ view, fitKey: get().fitKey + 1 }),
  setPlate: (plate) => set({ plate }),
  setExplode: (explode) => set({ explode: Math.min(1, Math.max(0, explode)) }),
  fit: () => set({ fitKey: get().fitKey + 1 }),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const spec = history[nextIndex];
    set({ historyIndex: nextIndex });
    get().compile(spec, { keepJoints: true });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const spec = history[nextIndex];
    set({ historyIndex: nextIndex });
    get().compile(spec, { keepJoints: true });
  },

  play: () => {
    const spec = get().spec;
    if (!spec || get().playing) return;
    if (playFrame) cancelAnimationFrame(playFrame);
    set({ playing: true, timeline: 0 });
    const start = performance.now();
    const steps = stepsFor(spec);
    const total = steps.reduce((sum, step) => sum + step.duration + (step.hold ?? 0), 0);
    const tick = (now: number) => {
      const progress = total > 0 ? Math.min(1, (now - start) / total) : 1;
      const { values } = timelineAt(spec, progress);
      set({ jointValues: values, timeline: progress });
      if (progress < 1 && get().playing) {
        playFrame = requestAnimationFrame(tick);
      } else {
        playFrame = null;
        set({ playing: false, timeline: 1 });
      }
    };
    playFrame = requestAnimationFrame(tick);
  },

  pause: () => {
    if (playFrame) cancelAnimationFrame(playFrame);
    playFrame = null;
    set({ playing: false });
  },

  seek: (progress) => {
    const spec = get().spec;
    if (!spec) return;
    get().pause();
    const clamped = Math.min(1, Math.max(0, progress));
    const { values } = timelineAt(spec, clamped);
    set({ jointValues: values, timeline: clamped });
  },

  exportStl: () => {
    const { spec, meshes, jointValues, offset } = get();
    if (!spec || !meshes.length) return;
    const pose = poseSpec(spec, jointValues);
    downloadStl(meshes, pose.matrices, offset, `${slug(spec.name)}.stl`);
  },

  exportGlb: () => {
    const { spec, meshes, jointValues, offset } = get();
    if (!spec || !meshes.length) return;
    const pose = poseSpec(spec, jointValues);
    downloadGlb(spec, meshes, pose.matrices, offset, `${slug(spec.name)}.glb`);
  },

  exportJson: () => {
    const spec = get().spec;
    if (!spec) return;
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(spec.name)}.cadgo.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  shareLink: () => {
    const spec = get().spec;
    if (!spec || typeof window === "undefined") return null;
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(spec));
    return `${window.location.origin}${window.location.pathname}#p=${encoded}`;
  },

  refreshRecents: async () => {
    try {
      const list = await idbGet<RecentProject[]>("cadgo:recents");
      set({ recents: list ?? [] });
    } catch {
      set({ recents: [] });
    }
  },

  loadRecent: async (id) => {
    const recent = get().recents.find((item) => item.id === id);
    if (recent) await get().loadSpec(recent.spec, { prompt: recent.prompt, fit: true });
  },

  loadFromHash: async () => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    if (!hash.startsWith("#p=")) return false;
    try {
      const raw = LZString.decompressFromEncodedURIComponent(hash.slice(3));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as CadSpec;
      await get().loadSpec(parsed, { prompt: parsed.sourcePrompt, fit: true });
      return true;
    } catch {
      return false;
    }
  },

  setCaptureRequest: () => set({ captureRequest: get().captureRequest + 1 }),

  startHolePick: () => set({ pickMode: "hole", facePick: null, plate: false }),
  cancelHolePick: () => set({ pickMode: "none", facePick: null }),
  setFacePick: (pick) => set({ facePick: pick }),

  cutHole: async (diameter) => {
    const { spec, facePick, selectedPartId } = get();
    if (!spec || !facePick) return;
    const partId = facePick.partId || selectedPartId;
    const part = spec.parts.find((item) => item.id === partId);
    if (!part) return;
    const radius = Math.max(0.4, diameter / 2);
    const normal = facePick.normal;
    const localNormal = normal;
    const rotation = rotationForNormal(localNormal);
    const hole = {
      op: "translate" as const,
      by: facePick.point,
      child: {
        op: "rotate" as const,
        degrees: rotation,
        child: {
          op: "cylinder" as const,
          radius,
          height: 2000,
          segments: 48,
        },
      },
    };
    const nextPart = {
      ...part,
      shape: { op: "difference" as const, a: part.shape, b: hole },
    };
    const next: CadSpec = {
      ...spec,
      parts: spec.parts.map((item) => (item.id === partId ? nextPart : item)),
      notes: [
        ...(spec.notes ?? []),
        `Cut a Ø${diameter.toFixed(1)} mm hole through ${part.name}.`,
      ].slice(-6),
    };
    set({
      pickMode: "none",
      facePick: null,
      messages: [
        ...get().messages,
        {
          id: uid(),
          role: "ai",
          text: `Cut a Ø${diameter.toFixed(1)} mm hole through ${part.name}.`,
          time: clock(),
        },
      ],
    });
    const ok = await get().compile(next, { keepJoints: true });
    if (ok) {
      const history = [...get().history.slice(0, get().historyIndex + 1), next].slice(-20);
      set({ history, historyIndex: history.length - 1, selectedPartId: partId });
    }
  },

  dismissError: () => set({ error: null }),
}));

function rotationForNormal(normal: Vec3): [number, number, number] {
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const target = new Vector3(normal[0] / length, normal[1] / length, normal[2] / length);
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), target);
  const euler = new Euler().setFromQuaternion(quaternion, "XYZ");
  const degrees = 180 / Math.PI;
  return [
    Math.round(euler.x * degrees * 1000) / 1000,
    Math.round(euler.y * degrees * 1000) / 1000,
    Math.round(euler.z * degrees * 1000) / 1000,
  ];
}

export const LAMP_EXAMPLE = lampSpec;
