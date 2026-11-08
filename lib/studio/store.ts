"use client";

import { create } from "zustand";
import LZString from "lz-string";
import { scadClient } from "@/lib/scad/client";
import type { ScadMesh, ScadParamValue } from "@/lib/scad/types";
import { binaryStl } from "@/lib/scad/stl";
import { auditParameterization } from "@/lib/scad/audit";
import { renderInspectionSheet } from "@/lib/studio/inspection";
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

export type StudioInspection = {
  dataUrl: string;
  iteration: number;
  title: string;
  width: number;
  height: number;
  views: string[];
};

export type AgentQuestion = {
  toolCallId: string;
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
  allowCustom: boolean;
};

export type AgentUiMessage = {
  role: "user" | "assistant" | "tool";
  content: string | Record<string, unknown>[];
  tool_calls?: {
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string | Record<string, unknown> };
  }[];
  tool_call_id?: string;
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
  referenceImage: StudioImage | null;
  printProfile: PrintProfile | null;
  inspection: StudioInspection | null;
  pendingQuestion: AgentQuestion | null;
  agentMessages: AgentUiMessage[];
  agentActivity: string[];
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
  setPrompt: (value: string) => void;
  setReferenceImage: (image: StudioImage | null) => void;
  setPrintProfile: (profile: PrintProfile | null) => void;
  stopAgent: () => void;
  answerQuestion: (answer: string) => Promise<void>;
  runAgent: (token: number) => Promise<void>;
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
  exportParts: () => Promise<void>;
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

function completedAgentHistory(messages: AgentUiMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") return messages.slice(0, index);
  }
  return [];
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
        boundaryEdges: preview.boundaryEdges,
        nonManifoldEdges: preview.nonManifoldEdges,
        volume: preview.volume,
        surfaceArea: preview.surfaceArea,
        overhangArea: preview.overhangArea,
        overhangPercent: preview.overhangPercent,
        componentIds: preview.componentIds,
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

function expectedBodies(parts: StudioPart[]) {
  return parts.reduce((sum, part) => sum + Math.max(1, part.quantity), 0);
}

function safeName(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "cadgo-part";
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
  referenceImage: null,
  printProfile: null,
  inspection: null,
  pendingQuestion: null,
  agentMessages: [],
  agentActivity: [],
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
    set({ booted: true, status: "booting" });
    try {
      await scadClient().warm();
      set((state) => ({
        booted: true,
        status: state.status === "booting" ? "idle" : state.status,
        error: state.status === "booting" ? null : state.error,
      }));
    } catch (error) {
      set((state) => ({
        booted: true,
        status: state.status === "booting" ? "error" : state.status,
        error: state.status === "booting"
          ? error instanceof Error ? error.message : "The local CAD kernel did not start in this browser."
          : state.error,
      }));
    }
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
        inspection: null,
        pendingQuestion: null,
        agentMessages: [],
        agentActivity: [],
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
      inspection: null,
      pendingQuestion: null,
      agentMessages: [],
      agentActivity: [],
      params: [],
      values: {},
      mesh: null,
      status: "idle",
      error: null,
      logs: "",
      compileMs: 0,
      prompt: "",
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
      inspection: null,
      pendingQuestion: null,
      agentMessages: [],
      agentActivity: [],
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
      inspection: null,
      pendingQuestion: null,
      agentMessages: [],
      agentActivity: [],
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
    const currentCode = get().code;
    const printProfile = get().printProfile;
    const wasBusy = ["drafting", "compiling", "reviewing"].includes(get().status);
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    const baseConversation = wasBusy ? completedAgentHistory(get().agentMessages) : get().agentMessages;
    const content: Record<string, unknown>[] = [
      {
        type: "text",
        text: `${prompt}${printProfile ? `\n\nUSER-PROVIDED PRINT / PROCESS SETUP:\n${JSON.stringify(printProfile, null, 2)}` : ""}${currentCode ? `\n\nCURRENT OPENSCAD SOURCE:\n${currentCode}` : ""}`,
      },
    ];
    if (image) content.push({ type: "image_url", image_url: { url: image.dataUrl } });
    const userMessage: AgentUiMessage = { role: "user", content };
    set({
      status: "drafting",
      error: null,
      prompt: "",
      pendingQuestion: null,
      agentMessages: [...baseConversation, userMessage],
      agentActivity: ["Reading your message"],
      messages: [...get().messages, message("user", prompt, undefined, undefined, image ?? undefined)],
    });
    await get().runAgent(token);
  },

  runAgent: async (token) => {
    const signal = currentAbort?.signal;
    if (!signal) return;
    const callAgent = async (messages: AgentUiMessage[]) => {
      const response = await fetch("/api/studio/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, sessionId: sessionId() }),
        signal,
      });
      const text = await response.text();
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const html = text.trim().startsWith("<");
        throw new Error(
          html
            ? `The agent API returned an HTML page (HTTP ${response.status}). This deployment does not expose the studio agent route.`
            : `The agent API returned an unreadable response (HTTP ${response.status}).`,
        );
      }
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : `The CAD agent endpoint returned HTTP ${response.status}.`,
        );
      }
      return payload as {
        content: string;
        tool_calls: { id?: string; function?: { name?: string; arguments?: string | Record<string, unknown> } }[];
        model: string;
      };
    };
    const parseArgs = (value: string | Record<string, unknown> | undefined) => {
      if (!value) return null;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return null;
      }
    };
    const pushActivity = (line: string) => set({ agentActivity: [...get().agentActivity.slice(-8), line] });
    let builds = 0;

    try {
      while (true) {
        if (token !== requestSeq) return;
        set({ status: "drafting" });
        pushActivity("Thinking");
        const assistant = await callAgent(get().agentMessages);
        if (token !== requestSeq) return;
        const calls = assistant.tool_calls ?? [];
        const assistantMessage: AgentUiMessage = {
          role: "assistant",
          content: assistant.content ?? "",
          tool_calls: calls,
        };
        set({ agentMessages: [...get().agentMessages, assistantMessage] });
        if (!calls.length) {
          const text = assistant.content.trim() || "Done.";
          set({
            status: "idle",
            agentActivity: [],
            pendingQuestion: null,
            messages: [
              ...get().messages,
              message("ai", text, `${makeModelLabel(assistant.model) ?? "Design compiler"} · chat`),
            ],
          });
          return;
        }

        let finalText: string | null = null;
        let asked: AgentQuestion | null = null;
        let didTool = false;

        for (const call of calls) {
          const name = call.function?.name;
          const id = call.id ?? `tool-${Date.now()}`;
          if (name === "ask_user") {
            const raw = parseArgs(call.function?.arguments);
            const question = typeof raw?.question === "string" ? raw.question.trim() : "";
            if (!question) {
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: "A question is required." }) }] });
              continue;
            }
            const options = Array.isArray(raw?.options)
              ? raw.options.flatMap((item) => {
                  if (!item || typeof item !== "object") return [];
                  const record = item as Record<string, unknown>;
                  return typeof record.label === "string"
                    ? [{ label: record.label, description: typeof record.description === "string" ? record.description : undefined }]
                    : [];
                })
              : [];
            asked = {
              toolCallId: id,
              question,
              header: typeof raw?.header === "string" ? raw.header : undefined,
              options,
              allowCustom: raw?.allowCustom !== false,
            };
            continue;
          }

          if (name === "build_model") {
            didTool = true;
            const raw = parseArgs(call.function?.arguments);
            const code = typeof raw?.code === "string" ? raw.code.trim().replace(/^```(?:scad|openscad)?\s*/i, "").replace(/```\s*$/, "").trim() : "";
            if (!code) {
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: "build_model needs complete OpenSCAD code." }) }] });
              continue;
            }
            const parametric = auditParameterization(code);
            if (!parametric.ok) {
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: parametric.message }) }] });
              pushActivity("Parametric audit failed · model will revise");
              continue;
            }
            const title = typeof raw?.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : get().title;
            builds++;
            set({ status: "compiling" });
            pushActivity(`Compiling build ${builds}`);
            const outcome = await evaluateCode(code);
            if (token !== requestSeq) return;
            if (!outcome.ok || !outcome.mesh || !outcome.params || !outcome.values) {
              const issue = outcome.error ?? "The code did not compile.";
              set({ status: "drafting", agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: issue }) }] });
              pushActivity("Compile failed · model will revise");
              continue;
            }
            set({
              mesh: outcome.mesh,
              params: outcome.params,
              values: outcome.values,
              code,
              codeDraft: code,
              title,
              parts: [],
              status: "reviewing",
              error: null,
              logs: outcome.logs ?? "",
              compileMs: Math.round(outcome.duration ?? 0),
              activeTab: "parameters",
              fitKey: get().fitKey + 1,
              agentMessages: [...get().agentMessages, {
                role: "tool",
                tool_call_id: id,
                content: JSON.stringify({
                  ok: true,
                  title,
                  bodies: outcome.mesh.components,
                  triangles: outcome.mesh.triangles,
                  bounds: outcome.mesh.bounds,
                  compileMs: Math.round(outcome.duration ?? 0),
                  params: parametric.params,
                }),
              }],
            });
            pushActivity(`Compiled ${title} · ${outcome.mesh.components} bodies · ${parametric.params} params`);
            continue;
          }

          if (name === "render_views") {
            didTool = true;
            const raw = parseArgs(call.function?.arguments);
            const views = Array.isArray(raw?.views) ? raw.views.filter((view): view is string => typeof view === "string") : [];
            const mesh = get().mesh;
            if (!mesh) {
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: "Build a model before rendering views." }) }] });
              continue;
            }
            if (!views.length) {
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: "Choose one or more views." }) }] });
              continue;
            }
            set({ status: "reviewing" });
            pushActivity(`Rendering ${views.join(", ")}`);
            try {
              const sheet = await renderInspectionSheet(mesh, get().title, views);
              if (token !== requestSeq) return;
              set({
                inspection: { ...sheet, iteration: builds, title: get().title },
                agentMessages: [
                  ...get().agentMessages,
                  {
                    role: "tool",
                    tool_call_id: id,
                    content: JSON.stringify({ ok: true, views: sheet.views, bodies: mesh.components, triangles: mesh.triangles }),
                  },
                  {
                    role: "user",
                    content: [
                      { type: "text", text: `Inspection sheet for ${sheet.views.join(", ")}. Use it as evidence; render more views or revise if needed.` },
                      { type: "image_url", image_url: { url: sheet.dataUrl } },
                    ],
                  },
                ],
                status: "drafting",
              });
              pushActivity(`Inspection sheet ready · ${sheet.views.join(", ")}`);
            } catch (error) {
              const issue = error instanceof Error ? error.message : "Could not render the inspection sheet.";
              set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: issue }) }], status: "drafting" });
              pushActivity("Inspection render failed");
            }
            continue;
          }

          if (name === "answer_user") {
            const raw = parseArgs(call.function?.arguments);
            finalText = typeof raw?.message === "string" ? raw.message.trim() : "";
            set({
              agentMessages: [
                ...get().agentMessages,
                { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: true, delivered: true }) },
              ],
            });
            continue;
          }

          set({ agentMessages: [...get().agentMessages, { role: "tool", tool_call_id: id, content: JSON.stringify({ ok: false, error: `Unknown tool ${name ?? "call"}.` }) }] });
        }

        if (finalText !== null) {
          const text = finalText || (get().mesh ? "Done." : assistant.content.trim() || "Done.");
          if (asked) {
            set({
              agentMessages: [
                ...get().agentMessages,
                {
                  role: "tool",
                  tool_call_id: asked.toolCallId,
                  content: JSON.stringify({ ok: false, error: "The agent finished with a final answer instead of asking." }),
                },
              ],
            });
          }
          set({
            status: "idle",
            agentActivity: [],
            pendingQuestion: null,
            messages: [
              ...get().messages,
              message("ai", text, `${makeModelLabel(assistant.model) ?? "Design compiler"} · ${builds} build${builds === 1 ? "" : "s"}`),
            ],
          });
          return;
        }

        if (asked) {
          set({
            status: "idle",
            pendingQuestion: asked,
            agentActivity: ["Waiting for your answer"],
          });
          return;
        }

        if (!didTool) {
          const text = assistant.content.trim() || "The agent did not return a model.";
          set({
            status: "idle",
            agentActivity: [],
            messages: [
              ...get().messages,
              message("ai", text, `${makeModelLabel(assistant.model) ?? "Design compiler"} · chat`),
            ],
          });
          return;
        }
      }
    } catch (error) {
      if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
      const message = error instanceof Error ? error.message : "The CAD agent failed.";
      set({
        status: "idle",
        agentActivity: [],
        error: message,
        agentMessages: completedAgentHistory(get().agentMessages),
      });
    }
  },

  answerQuestion: async (answer) => {
    const question = get().pendingQuestion;
    if (!question) return;
    const token = ++requestSeq;
    currentAbort?.abort();
    currentAbort = new AbortController();
    set({
      pendingQuestion: null,
      status: "drafting",
      error: null,
      agentActivity: ["Continuing with your answer"],
      messages: [...get().messages, message("user", answer)],
      agentMessages: [
        ...get().agentMessages,
        { role: "tool", tool_call_id: question.toolCallId, content: JSON.stringify({ answer }) },
      ],
    });
    await get().runAgent(token);
  },

  stopAgent: () => {
    requestSeq++;
    currentAbort?.abort();
    currentAbort = null;
    set({
      status: "idle",
      pendingQuestion: null,
      agentActivity: [],
      agentMessages: [],
      error: null,
    });
  },

  setPrompt: (value) => set({ prompt: value }),
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
    set({ code: nextCode, codeDraft: nextCode, params, values, status: "compiling", error: null, inspection: null });
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
    set({ status: "compiling", error: null, code, codeDraft: code, parts: [], inspection: null });
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
    const { code, values, title, mesh, parts, printProfile } = get();
    if (!code || !mesh) return;
    const expected = expectedBodies(parts);
    if (mesh.boundaryEdges > 0 || mesh.nonManifoldEdges > 0) {
      useToast.getState().notify("Export blocked: the mesh is not watertight.", "accent");
      return;
    }
    if (parts.length && mesh.components !== expected) {
      useToast.getState().notify(`Export blocked: ${mesh.components} bodies for ${expected} declared parts.`, "accent");
      return;
    }
    if (printProfile?.purpose === "3d-print" && printProfile.bed) {
      const bounds = mesh.bounds;
      const dims = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]];
      const bed = printProfile.bed;
      if (dims[0] > bed.x || dims[1] > bed.y || dims[2] > bed.z) {
        useToast.getState().notify("Export blocked: the part exceeds the declared print bed.", "accent");
        return;
      }
    }
    try {
      useToast.getState().notify("Compiling the STL…");
      const stl = await scadClient().exportStl(code, values);
      downloadBlob(new Blob([stl.buffer as ArrayBuffer], { type: "model/stl" }), `${safeName(title)}.stl`);
      useToast.getState().notify("STL downloaded · millimetres");
    } catch (error) {
      useToast.getState().notify(error instanceof Error ? error.message : "STL export failed", "accent");
    }
  },

  exportParts: async () => {
    const { mesh, parts, title } = get();
    if (!mesh || !mesh.componentIds.length) return;
    if (mesh.boundaryEdges > 0 || mesh.nonManifoldEdges > 0) {
      useToast.getState().notify("Export blocked: the mesh is not watertight.", "accent");
      return;
    }
    const names: string[] = [];
    for (const part of parts) {
      for (let index = 0; index < Math.max(1, part.quantity); index++) {
        names.push(part.quantity > 1 ? `${part.name} ${index + 1}` : part.name);
      }
    }
    while (names.length < mesh.components) names.push(`Body ${String(names.length + 1).padStart(2, "0")}`);
    const base = safeName(title);
    for (let component = 0; component < mesh.components; component++) {
      const stl = binaryStl(mesh.positions, mesh.componentIds, component);
      downloadBlob(
        new Blob([stl.buffer as ArrayBuffer], { type: "model/stl" }),
        `${base}-${safeName(names[component] ?? `part-${component + 1}`)}.stl`,
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    useToast.getState().notify(`Downloaded ${mesh.components} separate part STL${mesh.components === 1 ? "" : "s"}`);
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
