"use client";

import { create } from "zustand";
import LZString from "lz-string";
import { scadClient } from "@/lib/scad/client";
import type { ScadMesh, ScadParamValue } from "@/lib/scad/types";
import { auditParameterization } from "@/lib/scad/audit";
import {
  parametersToValues,
  parseParameters,
  setParameterInCode,
  type ParameterDef,
} from "@/lib/scad/params";
import { DEFAULT_EXAMPLE, SCAD_EXAMPLES } from "@/lib/scad/examples";
import type { OrbitView } from "@/lib/view";
import { useToast } from "@/lib/store/ui";
import type { PrintProfile, StudioImage } from "./profile";

export type StudioSource = {
  title: string;
  url: string;
};

export type StudioPart = {
  name: string;
  quantity: number;
};

export type StudioMessage = {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  note?: string;
  sources?: StudioSource[];
  image?: StudioImage;
  time: string;
};

export type StudioStatus = "booting" | "idle" | "drafting" | "compiling" | "repairing" | "reviewing" | "error";

type ApiArtifact = {
  title: string;
  code: string;
  message: string;
  model?: string;
  parts?: StudioPart[];
  sources?: StudioSource[];
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
  parts: StudioPart[];
  params: ParameterDef[];
  values: Record<string, ScadParamValue>;
  mesh: ScadMesh | null;
  status: StudioStatus;
  error: string | null;
  logs: string;
  compileMs: number;
  prompt: string;
  refine: string;
  referenceImage: StudioImage | null;
  printProfile: PrintProfile | null;
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
  setReferenceImage: (image: StudioImage | null) => void;
  setPrintProfile: (profile: PrintProfile | null) => void;
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

function message(
  role: StudioMessage["role"],
  text: string,
  note?: string,
  sources?: StudioSource[],
  image?: StudioImage,
): StudioMessage {
  return { id: uid(), role, text, note, sources, image, time: timeNow() };
}

function makeModelLabel(model?: string) {
  if (!model) return undefined;
  if (/deepseek/i.test(model)) return model.includes("pro") ? "DeepSeek V4 Pro" : "DeepSeek V4.1 Flash";
  if (/glm/i.test(model)) return "GLM";
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
  parts: StudioPart[],
  sessionIdValue: string,
): Promise<ApiArtifact> {
  const response = await fetch("/api/studio/repair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      error,
      parts: parts.map((part) => part.quantity > 1 ? `${part.name} (qty ${part.quantity})` : part.name),
      sessionId: sessionIdValue,
    }),
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
    parts: normalizeParts(payload.parts, parts),
    sources: Array.isArray(payload.sources) ? payload.sources : [],
  };
}

async function reviewArtifact(input: {
  code: string;
  parts: StudioPart[];
  prompt: string;
  profile: PrintProfile | null;
  referenceImage: string;
  render: string;
  metrics: string;
  sessionIdValue: string;
}): Promise<ApiArtifact> {
  const response = await fetch("/api/studio/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      parts: input.parts,
      prompt: input.prompt,
      profile: input.profile ?? undefined,
      referenceImage: input.referenceImage,
      render: input.render,
      metrics: input.metrics,
      sessionId: input.sessionIdValue,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.code) {
    throw new Error(payload.error ?? "The visual check did not return a model");
  }
  return {
    title: payload.title ?? "Reviewed model",
    code: payload.code,
    message: payload.message ?? "Checked the model against the image.",
    model: payload.model,
    parts: normalizeParts(payload.parts),
    sources: [],
  };
}

async function captureRender(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  let source: HTMLCanvasElement | null = null;
  const started = Date.now();
  while (Date.now() - started < 5000) {
    source = document.querySelector<HTMLCanvasElement>(".studio-stage canvas");
    if (source && source.width > 10 && source.height > 10) break;
    source = null;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!source) return null;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const scale = Math.min(1, 1200 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#f1eee5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
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

function normalizeParts(value: unknown, fallback: StudioPart[] = []): StudioPart[] {
  if (!Array.isArray(value)) return fallback;
  const merged = new Map<string, number>();
  for (const entry of value) {
    let name = "";
    let quantity = 1;
    if (typeof entry === "string") {
      name = entry.trim();
    } else if (entry && typeof entry === "object") {
      const item = entry as Record<string, unknown>;
      if (typeof item.name === "string") name = item.name.trim();
      if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
        quantity = Math.max(1, Math.min(24, Math.round(item.quantity)));
      }
    }
    if (!name) continue;
    merged.set(name, Math.min(24, (merged.get(name) ?? 0) + quantity));
  }
  const result = [...merged.entries()].slice(0, 12).map(([name, quantity]) => ({ name, quantity }));
  return result.length ? result : fallback;
}

function expectedBodies(parts: StudioPart[]) {
  return parts.reduce((sum, part) => sum + Math.max(1, part.quantity), 0);
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


function geometryIssue(outcome: CompileOutcome, parts: StudioPart[]) {
  if (!outcome.ok || !outcome.mesh) {
    return outcome.error ?? outcome.logs ?? "The kernel could not build this model.";
  }
  if (!parts.length) return null;
  const bodies = outcome.mesh.components;
  const expected = expectedBodies(parts);
  if (bodies !== expected) {
    return `The kernel found ${bodies} connected bod${bodies === 1 ? "y" : "ies"} but the parts manifest expects ${expected} bod${expected === 1 ? "y" : "ies"}. Keep every declared part instance its own watertight body with 0.2-0.8 mm clearance at mating faces; do not union distinct parts. If one part type has quantity 2, model two separate instances, not one fused pair.`;
  }
  return null;
}

function artifactNote(
  artifact: ApiArtifact,
  outcome: CompileOutcome,
  repaired: number,
  visualChecked = false,
  parametric?: { ok: boolean; params: number },
) {
  const label = makeModelLabel(artifact.model) ?? "Design compiler";
  const parts = artifact.parts ?? [];
  const bodyCount = outcome.mesh?.components ?? 0;
  const bits = [label];
  if (bodyCount) bits.push(`${bodyCount} bod${bodyCount === 1 ? "y" : "ies"}`);
  if (parts.length > 1) bits.push(`${parts.length} part types`);
  if (parts.length && bodyCount !== expectedBodies(parts)) bits.push("body mismatch");
  if (parametric?.ok) bits.push(`fully parametric · ${parametric.params} params`);
  else if (parametric && !parametric.ok) bits.push("hardcoded dimensions remain");
  if (artifact.sources?.length) bits.push(`${artifact.sources.length} source${artifact.sources.length === 1 ? "" : "s"}`);
  if (visualChecked) bits.push("visual check");
  if (repaired) bits.push(repaired === 1 ? "quality-repaired" : `quality-repaired ×${repaired}`);
  return bits.join(" · ");
}

export const useStudio = create<StudioState>((set, get) => ({
  booted: false,
  title: "New part",
  code: "",
  parts: [],
  params: [],
  values: {},
  mesh: null,
  status: "idle",
  error: null,
  logs: "",
  compileMs: 0,
  prompt: "",
  refine: "",
  referenceImage: null,
  printProfile: null,
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
        parts: [],
        referenceImage: null,
        printProfile: null,
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
      parts: [],
      referenceImage: null,
      printProfile: null,
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
      parts: [],
      referenceImage: null,
      printProfile: null,
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
      parts: [],
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
      parts: [],
      referenceImage: null,
      printProfile: null,
      messages: [...get().messages, message("user", example.prompt), message("ai", `${example.title} loaded from the benchbook.`)],
    });
    const outcome = await evaluateCode(example.code);
    if (seq !== compileSeq) return;
    if (outcome.ok && outcome.mesh && outcome.params && outcome.values) {
      set({
        params: outcome.params,
        values: outcome.values,
        mesh: outcome.mesh,
        parts: [],
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
    const image = get().referenceImage;
    const profile = get().printProfile;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    set({
      status: "drafting",
      error: null,
      prompt: "",
      messages: [...get().messages, message("user", prompt, undefined, undefined, image ?? undefined)],
    });
    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image: image ?? undefined,
          profile: profile ?? undefined,
          sessionId: sessionId(),
        }),
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
        parts: normalizeParts(payload.parts),
        sources: Array.isArray(payload.sources) ? payload.sources : [],
      };
      set({ status: "compiling" });
      let outcome = await evaluateCode(artifact.code);
      let repaired = 0;
      while (geometryIssue(outcome, artifact.parts ?? []) && repaired < 2) {
        if (token !== requestSeq) return;
        const issue = geometryIssue(outcome, artifact.parts ?? []);
        if (!issue) break;
        repaired++;
        set({ status: "repairing" });
        try {
          artifact = await repairArtifact(artifact.code, issue, artifact.parts ?? [], sessionId());
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "The repair pass failed");
        }
        outcome = await evaluateCode(artifact.code);
      }
      let visualChecked = false;
      if (image && outcome.ok && outcome.mesh && outcome.params && outcome.values && token === requestSeq) {
        const reviewMesh = outcome.mesh;
        const bounds = reviewMesh.bounds;
        const dims = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]]
          .map((value) => Math.round(value));
        set({
          status: "reviewing",
          mesh: reviewMesh,
          params: outcome.params,
          values: outcome.values,
          code: artifact.code,
          codeDraft: artifact.code,
          title: artifact.title,
          parts: artifact.parts ?? [],
          logs: outcome.logs ?? "",
          compileMs: Math.round(outcome.duration ?? 0),
          error: null,
          fitKey: get().fitKey + 1,
        });
        await new Promise((resolve) => setTimeout(resolve, 900));
        const render = await captureRender();
        if (render && token === requestSeq) {
          try {
            const reviewed = await reviewArtifact({
              code: artifact.code,
              parts: artifact.parts ?? [],
              prompt,
              profile,
              referenceImage: image.dataUrl,
              render,
              metrics: `Envelope ${dims.join("x")} mm; ${reviewMesh.components} connected bodies; ${reviewMesh.triangles} triangles; ${(artifact.parts ?? []).length} part types.`,
              sessionIdValue: sessionId(),
            });
            visualChecked = true;
            if (reviewed.code && reviewed.code !== artifact.code) {
              const previous = artifact;
              const previousOutcome = outcome;
              artifact = {
                ...artifact,
                code: reviewed.code,
                title: reviewed.title || artifact.title,
                message: reviewed.message || artifact.message,
                parts: reviewed.parts?.length ? reviewed.parts : artifact.parts,
              };
              set({ status: "compiling" });
              outcome = await evaluateCode(artifact.code);
              let visualRepairs = 0;
              while (geometryIssue(outcome, artifact.parts ?? []) && visualRepairs < 1) {
                if (token !== requestSeq) return;
                const issue = geometryIssue(outcome, artifact.parts ?? []);
                if (!issue) break;
                visualRepairs++;
                repaired++;
                set({ status: "repairing" });
                artifact = await repairArtifact(artifact.code, issue, artifact.parts ?? [], sessionId());
                outcome = await evaluateCode(artifact.code);
              }
              if (geometryIssue(outcome, artifact.parts ?? [])) {
                artifact = {
                  ...previous,
                  message: `${reviewed.message} Kept the compiled version because the visual correction did not pass the body check.`,
                };
                outcome = previousOutcome;
              }
            } else if (reviewed.message) {
              artifact = { ...artifact, message: reviewed.message };
            }
          } catch {
            // A failed visual check should not discard a valid model.
          }
        }
      }
      let parametric = auditParameterization(artifact.code);
      let parametricRepairs = 0;
      while (!parametric.ok && parametricRepairs < 2 && token === requestSeq) {
        parametricRepairs++;
        repaired++;
        set({ status: "repairing" });
        try {
          artifact = await repairArtifact(artifact.code, parametric.message, artifact.parts ?? [], sessionId());
        } catch {
          break;
        }
        outcome = await evaluateCode(artifact.code);
        parametric = auditParameterization(artifact.code);
      }
      let postAuditRepairs = 0;
      while (outcome.ok && outcome.mesh && geometryIssue(outcome, artifact.parts ?? []) && postAuditRepairs < 1) {
        if (token !== requestSeq) return;
        const issue = geometryIssue(outcome, artifact.parts ?? []);
        if (!issue) break;
        postAuditRepairs++;
        repaired++;
        set({ status: "repairing" });
        try {
          artifact = await repairArtifact(artifact.code, issue, artifact.parts ?? [], sessionId());
        } catch {
          break;
        }
        outcome = await evaluateCode(artifact.code);
      }
      parametric = auditParameterization(artifact.code);
      if (token !== requestSeq) return;
      if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
        set({
          status: "error",
          error: outcome.error ?? "The model did not compile after repair.",
          logs: outcome.logs ?? "",
          code: artifact.code,
          codeDraft: artifact.code,
          title: artifact.title,
          parts: artifact.parts ?? [],
        });
        set({ messages: [...get().messages, message("system", "The drafter returned code the kernel could not build.")] });
        return;
      }
      set({
        title: artifact.title,
        code: artifact.code,
        codeDraft: artifact.code,
        parts: artifact.parts ?? [],
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
            artifactNote(artifact, outcome, repaired, visualChecked, parametric),
            artifact.sources,
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
        body: JSON.stringify({
          code,
          message: text,
          parts: get().parts.map((part) => part.quantity > 1 ? `${part.name} (qty ${part.quantity})` : part.name),
          sessionId: sessionId(),
        }),
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
        parts: normalizeParts(payload.parts, get().parts),
        sources: Array.isArray(payload.sources) ? payload.sources : [],
      };
      set({ status: "compiling" });
      let outcome = await evaluateCode(artifact.code);
      let repaired = 0;
      while (geometryIssue(outcome, artifact.parts ?? []) && repaired < 2) {
        if (token !== requestSeq) return;
        const issue = geometryIssue(outcome, artifact.parts ?? []);
        if (!issue) break;
        repaired++;
        set({ status: "repairing" });
        artifact = await repairArtifact(artifact.code, issue, artifact.parts ?? [], sessionId());
        outcome = await evaluateCode(artifact.code);
      }
      let parametric = auditParameterization(artifact.code);
      let parametricRepairs = 0;
      while (!parametric.ok && parametricRepairs < 2 && token === requestSeq) {
        parametricRepairs++;
        repaired++;
        set({ status: "repairing" });
        try {
          artifact = await repairArtifact(artifact.code, parametric.message, artifact.parts ?? [], sessionId());
        } catch {
          break;
        }
        outcome = await evaluateCode(artifact.code);
        parametric = auditParameterization(artifact.code);
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
        parts: artifact.parts ?? [],
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
            `Edited in place · ${changed} line${changed === 1 ? "" : "s"} changed · ${artifactNote(artifact, outcome, repaired, false, parametric)}`,
            artifact.sources,
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
  setReferenceImage: (referenceImage) => set({ referenceImage }),
  setPrintProfile: (printProfile) => set({ printProfile }),
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
    set({ status: "compiling", error: null, code, codeDraft: code, parts: [] });
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
