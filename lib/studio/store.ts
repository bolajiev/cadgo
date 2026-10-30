"use client";

import { create } from "zustand";
import LZString from "lz-string";
import { scadClient } from "@/lib/scad/client";
import type { ScadMesh, ScadParamValue } from "@/lib/scad/types";
import {
  parametersToValues,
  parseParameters,
  setParameterInCode,
  type ParameterDef,
} from "@/lib/scad/params";
import { DEFAULT_EXAMPLE, SCAD_EXAMPLES } from "@/lib/scad/examples";
import type { OrbitView } from "@/lib/view";
import { useToast } from "@/lib/store/ui";

export type StudioMessage = {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  note?: string;
  time: string;
};

export type StudioStatus = "booting" | "idle" | "drafting" | "compiling" | "repairing" | "error";

type ApiArtifact = {
  title: string;
  code: string;
  message: string;
  model?: string;
};

type CompileOutcome = {
  ok: boolean;
  mesh?: ScadMesh;
  params?: ParameterDef[];
  values?: Record<string, ScadParamValue>;
  error?: string;
  logs?: string;
  duration?: number;
};

type StudioState = {
  booted: boolean;
  title: string;
  code: string;
  params: ParameterDef[];
  values: Record<string, ScadParamValue>;
  mesh: ScadMesh | null;
  status: StudioStatus;
  error: string | null;
  logs: string;
  compileMs: number;
  prompt: string;
  refine: string;
  messages: StudioMessage[];
  model: string;
  activeTab: "parameters" | "code";
  view: OrbitView;
  fitKey: number;
  showEdges: boolean;
  showGrid: boolean;
  codeDraft: string;
  boot: () => Promise<void>;
  loadFromHash: () => Promise<boolean>;
  loadExample: (id: string) => Promise<void>;
  importScad: (code: string, title?: string) => Promise<void>;
  newPart: () => void;
  generate: (prompt?: string) => Promise<void>;
  refineModel: (message?: string) => Promise<void>;
  setPrompt: (value: string) => void;
  setRefine: (value: string) => void;
  setParam: (name: string, value: number | boolean) => void;
  applyCode: (code: string) => Promise<void>;
  setCodeDraft: (code: string) => void;
  compileCurrent: (fit?: boolean) => Promise<void>;
  setActiveTab: (tab: "parameters" | "code") => void;
  setView: (view: OrbitView) => void;
  fit: () => void;
  setShowEdges: (value: boolean) => void;
  setShowGrid: (value: boolean) => void;
  exportStl: () => Promise<void>;
  exportScad: () => void;
  shareLink: () => string | null;
};

let compileSeq = 0;
let requestSeq = 0;
let currentAbort: AbortController | null = null;
let compileTimer: ReturnType<typeof setTimeout> | null = null;
let bootedGlobal = false;

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timeNow() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function sessionId() {
  if (typeof window === "undefined") return "server";
  const key = "cadgo:studio-session";
  let value = localStorage.getItem(key);
  if (!value) {
    value = uid();
    localStorage.setItem(key, value);
  }
  return value;
}

function message(role: StudioMessage["role"], text: string, note?: string): StudioMessage {
  return { id: uid(), role, text, note, time: timeNow() };
}

function makeModelLabel(model?: string) {
  if (!model) return undefined;
  if (/glm/i.test(model)) return "GLM fast pass";
  if (/deepseek/i.test(model)) return "DeepSeek V4.1 Flash";
  return model;
}

async function evaluateCode(code: string): Promise<CompileOutcome> {
  const params = parseParameters(code);
  const values = parametersToValues(params);
  try {
    const preview = await scadClient().preview(code, {});
    return {
      ok: true,
      mesh: {
        positions: preview.positions,
        colors: preview.colors,
        triangles: preview.triangles,
        components: preview.components,
        floating: preview.floating,
        bounds: preview.bounds,
      },
      params,
      values,
      logs: preview.stderr,
      duration: preview.duration,
    };
  } catch (error) {
    return {
      ok: false,
      params,
      values,
      error: error instanceof Error ? error.message : "OpenSCAD could not compile this model",
      logs: error instanceof Error ? error.message : "",
    };
  }
}

async function repairArtifact(
  code: string,
  error: string,
  sessionIdValue: string,
): Promise<ApiArtifact> {
  const response = await fetch("/api/studio/repair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, error, sessionId: sessionIdValue }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.code) {
    throw new Error(payload.error ?? "The repair pass did not return code");
  }
  return {
    title: payload.title ?? "Repaired model",
    code: payload.code,
    message: payload.message ?? "Fixed the model.",
    model: payload.model,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeName(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "cadgo-part";
}

function changedLineCount(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  let previous = new Uint16Array(b.length + 1);
  let current = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }
  return Math.max(a.length, b.length) - previous[b.length];
}

export const useStudio = create<StudioState>((set, get) => ({
  booted: false,
  title: "New part",
  code: "",
  params: [],
  values: {},
  mesh: null,
  status: "idle",
  error: null,
  logs: "",
  compileMs: 0,
  prompt: "",
  refine: "",
  messages: [],
  model: "",
  activeTab: "parameters",
  view: "iso",
  fitKey: 0,
  showEdges: true,
  showGrid: true,
  codeDraft: "",

  boot: async () => {
    if (bootedGlobal) return;
    bootedGlobal = true;
    if (compileTimer) clearTimeout(compileTimer);
    const fromHash = await get().loadFromHash();
    if (fromHash) return;
    set({ booted: true, status: "idle" });
  },

  loadFromHash: async () => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return false;
    try {
      const raw = LZString.decompressFromEncodedURIComponent(hash.slice(3));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { t?: string; c?: string };
      if (!parsed.c) return false;
      get().setCodeDraft(parsed.c);
      set({ status: "compiling", error: null });
      const seq = ++compileSeq;
      const outcome = await evaluateCode(parsed.c);
      if (seq !== compileSeq) return false;
      if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
        set({ booted: true, status: "error", error: outcome.error ?? "The shared model did not compile." });
        return false;
      }
      set({
        booted: true,
        title: parsed.t ?? "Shared model",
        code: parsed.c,
        codeDraft: parsed.c,
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        status: "idle",
        compileMs: Math.round(outcome.duration ?? 0),
        logs: outcome.logs ?? "",
        fitKey: get().fitKey + 1,
        messages: [message("ai", "Shared model loaded. Parameters and code are editable.", "Shared link")],
      });
      return true;
    } catch {
      return false;
    }
  },

  newPart: () => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    if (compileTimer) clearTimeout(compileTimer);
    ++compileSeq;
    set({
      title: "New part",
      code: "",
      codeDraft: "",
      params: [],
      values: {},
      mesh: null,
      status: "idle",
      error: null,
      logs: "",
      compileMs: 0,
      prompt: "",
      refine: "",
      messages: [],
      model: "",
      activeTab: "parameters",
      fitKey: get().fitKey + 1,
    });
  },

  importScad: async (code, title) => {
    const clean = code.slice(0, 200000).trim();
    if (!clean) return;
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    const seq = ++compileSeq;
    const name = (title ?? "Imported part").replace(/\.scad$/i, "").slice(0, 80);
    set({
      status: "compiling",
      error: null,
      title: name,
      code: clean,
      codeDraft: clean,
      prompt: "",
      messages: [...get().messages, message("user", `Imported ${name}.scad`)],
    });
    const outcome = await evaluateCode(clean);
    if (seq !== compileSeq) return;
    if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
      set({
        status: "error",
        error: outcome.error ?? "The imported source did not compile.",
        logs: outcome.logs ?? "",
        messages: [
          ...get().messages,
          message("system", "Imported source did not compile. Open the OpenSCAD tab and fix it, or ask Cadgo for a repair."),
        ],
      });
      return;
    }
    set({
      params: outcome.params,
      values: outcome.values,
      mesh: outcome.mesh,
      status: "idle",
      logs: outcome.logs ?? "",
      compileMs: Math.round(outcome.duration ?? 0),
      activeTab: "parameters",
      fitKey: get().fitKey + 1,
      messages: [
        ...get().messages,
        message(
          "ai",
          `Imported and compiled ${name}.scad. The top-level dimensions are now sliders.`,
          "Bring your own OpenSCAD",
        ),
      ],
    });
  },

  loadExample: async (id) => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    const seq = ++compileSeq;
    const example = SCAD_EXAMPLES.find((item) => item.id === id) ?? DEFAULT_EXAMPLE;
    set({
      status: "compiling",
      error: null,
      title: example.title,
      code: example.code,
      codeDraft: example.code,
      messages: [...get().messages, message("user", example.prompt), message("ai", `${example.title} loaded from the benchbook.`)],
    });
    const outcome = await evaluateCode(example.code);
    if (seq !== compileSeq) return;
    if (outcome.ok && outcome.mesh && outcome.params && outcome.values) {
      set({
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        status: "idle",
        compileMs: Math.round(outcome.duration ?? 0),
        logs: outcome.logs ?? "",
        activeTab: "parameters",
        fitKey: get().fitKey + 1,
      });
    } else {
      set({ status: "error", error: outcome.error ?? "The example did not compile.", logs: outcome.logs ?? "" });
    }
  },

  generate: async (promptInput) => {
    const prompt = (promptInput ?? get().prompt).trim();
    if (!prompt) return;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    set({
      status: "drafting",
      error: null,
      prompt: "",
      messages: [...get().messages, message("user", prompt)],
    });
    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sessionId: sessionId() }),
        signal: currentAbort.signal,
      });
      if (token !== requestSeq) return;
      const payload = await response.json();
      if (!response.ok || !payload.code) throw new Error(payload.error ?? "The design compiler did not return a model");
      let artifact: ApiArtifact = {
        title: payload.title ?? "OpenSCAD model",
        code: payload.code,
        message: payload.message ?? "Drafted the model.",
        model: payload.model,
      };
      set({ status: "compiling" });
      let outcome = await evaluateCode(artifact.code);
      let repaired = 0;
      const needsRepair = () =>
        !outcome.ok || (outcome.mesh?.floating ?? 0) > 0;
      while (needsRepair() && repaired < 2) {
        if (token !== requestSeq) return;
        repaired++;
        set({ status: "repairing" });
        const issue = outcome.ok
          ? `The mesh has ${outcome.mesh?.floating ?? 0} detached floating solid(s). Connect every solid to the main body, or remove the floating geometry.`
          : outcome.error ?? outcome.logs ?? "compile failed";
        try {
          artifact = await repairArtifact(artifact.code, issue, sessionId());
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "The repair pass failed");
        }
        outcome = await evaluateCode(artifact.code);
      }
      if (token !== requestSeq) return;
      if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
        set({
          status: "error",
          error: outcome.error ?? "The model did not compile after repair.",
          logs: outcome.logs ?? "",
          code: artifact.code,
          codeDraft: artifact.code,
          title: artifact.title,
        });
        set({ messages: [...get().messages, message("system", "The drafter returned code the kernel could not build.")] });
        return;
      }
      set({
        title: artifact.title,
        code: artifact.code,
        codeDraft: artifact.code,
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        status: "idle",
        error: null,
        logs: outcome.logs ?? "",
        compileMs: Math.round(outcome.duration ?? 0),
        activeTab: "parameters",
        fitKey: get().fitKey + 1,
        model: artifact.model ?? "",
        messages: [
          ...get().messages,
          message(
            "ai",
            artifact.message,
            `${makeModelLabel(artifact.model) ?? "Design compiler"}${repaired ? " · repaired compiler error" : ""}`,
          ),
        ],
      });
    } catch (error) {
      if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
      set({
        status: "error",
        error: error instanceof Error ? error.message : "The draft failed",
      });
    }
  },

  refineModel: async (messageInput) => {
    const text = (messageInput ?? get().refine).trim();
    const code = get().code;
    if (!text || !code) return;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    set({
      status: "drafting",
      error: null,
      refine: "",
      messages: [...get().messages, message("user", text)],
    });
    try {
      const response = await fetch("/api/studio/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message: text, sessionId: sessionId() }),
        signal: currentAbort.signal,
      });
      if (token !== requestSeq) return;
      const payload = await response.json();
      if (!response.ok || !payload.code) throw new Error(payload.error ?? "The revision did not return code");
      let artifact: ApiArtifact = {
        title: payload.title ?? get().title,
        code: payload.code,
        message: payload.message ?? "Revised the model.",
        model: payload.model,
      };
      set({ status: "compiling" });
      let outcome = await evaluateCode(artifact.code);
      let repaired = 0;
      const needsRepair = () => !outcome.ok || (outcome.mesh?.floating ?? 0) > 0;
      while (needsRepair() && repaired < 2) {
        if (token !== requestSeq) return;
        repaired++;
        set({ status: "repairing" });
        const issue = outcome.ok
          ? `The mesh has ${outcome.mesh?.floating ?? 0} detached floating solid(s). Connect every solid to the main body, or remove the floating geometry.`
          : outcome.error ?? outcome.logs ?? "compile failed";
        artifact = await repairArtifact(artifact.code, issue, sessionId());
        outcome = await evaluateCode(artifact.code);
      }
      if (token !== requestSeq) return;
      if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
        set({
          status: "error",
          error: outcome.error ?? "The revision did not compile.",
          logs: outcome.logs ?? "",
        });
        return;
      }
      const changed = changedLineCount(code, artifact.code);
      set({
        title: artifact.title,
        code: artifact.code,
        codeDraft: artifact.code,
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        status: "idle",
        logs: outcome.logs ?? "",
        compileMs: Math.round(outcome.duration ?? 0),
        activeTab: "parameters",
        fitKey: get().fitKey + 1,
        model: artifact.model ?? "",
        messages: [
          ...get().messages,
          message(
            "ai",
            artifact.message,
            `Edited in place · ${changed} line${changed === 1 ? "" : "s"} changed${repaired ? " · repaired" : ""}`,
          ),
        ],
      });
    } catch (error) {
      if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
      set({ status: "error", error: error instanceof Error ? error.message : "The revision failed" });
    }
  },

  setPrompt: (value) => set({ prompt: value }),
  setRefine: (value) => set({ refine: value }),
  setCodeDraft: (value) => set({ codeDraft: value }),

  setParam: (name, value) => {
    const current = get();
    const nextCode = setParameterInCode(current.code, name, value);
    if (nextCode === current.code) return;
    const params = parseParameters(nextCode).map((param) =>
      param.name === name ? { ...param, value } : param,
    );
    const values = parametersToValues(params);
    set({ code: nextCode, codeDraft: nextCode, params, values, status: "compiling", error: null });
    if (compileTimer) clearTimeout(compileTimer);
    compileTimer = setTimeout(async () => {
      const seq = ++compileSeq;
      const outcome = await evaluateCode(nextCode);
      if (seq !== compileSeq) return;
      if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
        set({ status: "error", error: outcome.error ?? "This parameter cannot be built.", logs: outcome.logs ?? "" });
        return;
      }
      set({
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        status: "idle",
        error: null,
        logs: outcome.logs ?? "",
        compileMs: Math.round(outcome.duration ?? 0),
      });
    }, 120);
  },

  applyCode: async (code) => {
    const seq = ++compileSeq;
    set({ status: "compiling", error: null, code, codeDraft: code });
    const outcome = await evaluateCode(code);
    if (seq !== compileSeq) return;
    if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
      set({ status: "error", error: outcome.error ?? "The code did not compile.", logs: outcome.logs ?? "" });
      return;
    }
    set({
      params: outcome.params,
      values: outcome.values,
      mesh: outcome.mesh,
      status: "idle",
      logs: outcome.logs ?? "",
      compileMs: Math.round(outcome.duration ?? 0),
      activeTab: "parameters",
      fitKey: get().fitKey + 1,
    });
  },

  compileCurrent: async (fit = false) => {
    const code = get().code;
    const seq = ++compileSeq;
    set({ status: "compiling", error: null });
    const outcome = await evaluateCode(code);
    if (seq !== compileSeq) return;
    if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
      set({ status: "error", error: outcome.error ?? "The code did not compile.", logs: outcome.logs ?? "" });
      return;
    }
    set({
      params: outcome.params,
      values: outcome.values,
      mesh: outcome.mesh,
      status: "idle",
      logs: outcome.logs ?? "",
      compileMs: Math.round(outcome.duration ?? 0),
      fitKey: fit ? get().fitKey + 1 : get().fitKey,
    });
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setView: (view) => set({ view, fitKey: get().fitKey + 1 }),
  fit: () => set({ fitKey: get().fitKey + 1 }),
  setShowEdges: (showEdges) => set({ showEdges }),
  setShowGrid: (showGrid) => set({ showGrid }),

  exportStl: async () => {
    const { code, values, title, mesh } = get();
    if (!code || !mesh) return;
    try {
      useToast.getState().notify("Compiling the STL…");
      const stl = await scadClient().exportStl(code, values);
      downloadBlob(new Blob([stl.buffer as ArrayBuffer], { type: "model/stl" }), `${safeName(title)}.stl`);
      useToast.getState().notify("STL downloaded · millimetres");
    } catch (error) {
      useToast.getState().notify(error instanceof Error ? error.message : "STL export failed", "accent");
    }
  },

  exportScad: () => {
    const { code, title } = get();
    downloadBlob(new Blob([code], { type: "text/plain" }), `${safeName(title)}.scad`);
    useToast.getState().notify("OpenSCAD source downloaded");
  },

  shareLink: () => {
    if (typeof window === "undefined") return null;
    const { code, title } = get();
    if (!code) return null;
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify({ t: title, c: code }));
    return `${window.location.origin}${window.location.pathname}#s=${encoded}`;
  },
}));
