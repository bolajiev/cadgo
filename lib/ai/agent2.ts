import { AgentError } from "./agent";
import { AGENT_V2_SYSTEM_PROMPT } from "./agent-prompt";

type ToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | unknown[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ChatResponse = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; tool_calls?: ToolCall[] };
  }[];
  error?: { message?: string };
};

export type AgentV2AssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls: ToolCall[];
  model: string;
  truncated?: boolean;
};

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_DESIGN_MODEL ?? "deepseek-v4.1-flash";
const API_KEY = process.env.OPENCODE_GO_API_KEY ?? "";
const MAX_TOKENS = Number(process.env.CADGO_AGENT_MAX_TOKENS ?? 24000);
const UPSTREAM_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.CADGO_AGENT_UPSTREAM_TIMEOUT_MS ?? 240000);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 240000;
})();

const UPSTREAM_TIMEOUT_MINUTES = Math.max(1, Math.round(UPSTREAM_TIMEOUT_MS / 60000));
const UPSTREAM_TIMEOUT_MESSAGE = `The model did not finish one response within ${UPSTREAM_TIMEOUT_MINUTES} minute${UPSTREAM_TIMEOUT_MINUTES === 1 ? "" : "s"}. Your work is safe. Retry, or split the request into a smaller edit.`;

type UpstreamAbort = {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
};

function combineWithTimeout(clientSignal: AbortSignal): UpstreamAbort {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (clientSignal.aborted) controller.abort();
  else clientSignal.addEventListener("abort", forwardAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      clientSignal.removeEventListener("abort", forwardAbort);
    },
  };
}

const SYSTEM = AGENT_V2_SYSTEM_PROMPT;

const vec3 = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
} as const;

const material = {
  type: "object",
  properties: {
    color: { type: "string" },
    metalness: { type: "number" },
    roughness: { type: "number" },
    opacity: { type: "number" },
  },
  required: ["color"],
} as const;

const materialMode = {
  type: "string",
  enum: ["source", "override"],
} as const;

const jointFields = {
  name: { type: "string" },
  parentInstanceId: { type: "string" },
  childInstanceId: { type: "string" },
  childGroupId: { type: "string" },
  targetInstanceId: { type: "string" },
  axis: vec3,
  origin: vec3,
  parentPoint: vec3,
  childPoint: vec3,
  targetPoint: vec3,
  driverId: { type: "string" },
  expression: { type: "string" },
  limits: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
  stretch: { type: "boolean" },
  enabled: { type: "boolean" },
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_model",
      description: "List the assembly tree, IDs, revisions, parameters, compile status, joints and drivers. Source is omitted unless includeSource is true.",
      parameters: {
        type: "object",
        properties: { includeSource: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_definition",
      description: "Read one part definition: source, parameters, material, revision, compile status and logs.",
      parameters: {
        type: "object",
        properties: { definitionId: { type: "string" } },
        required: ["definitionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_definition",
      description: "Create a reusable part definition from complete OpenSCAD source. The source is audited and compiled.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          source: { type: "string" },
          material,
          materialMode,
        },
        required: ["name", "source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_definition",
      description: "Update a definition. Requires the current baseRevision. Source changes are audited and recompiled.",
      parameters: {
        type: "object",
        properties: {
          definitionId: { type: "string" },
          baseRevision: { type: "number" },
          name: { type: "string" },
          source: { type: "string" },
          material,
          materialMode,
          locked: { type: "boolean" },
        },
        required: ["definitionId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_definition",
      description: "Delete a definition. Fails while instances still use it.",
      parameters: {
        type: "object",
        properties: { definitionId: { type: "string" }, baseRevision: { type: "number" } },
        required: ["definitionId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_group",
      description: "Create an assembly group.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          parentId: { type: "string" },
          position: vec3,
          rotation: vec3,
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_group",
      description: "Update a group. Requires the current baseRevision.",
      parameters: {
        type: "object",
        properties: {
          groupId: { type: "string" },
          baseRevision: { type: "number" },
          name: { type: "string" },
          parentId: { type: "string" },
          position: vec3,
          rotation: vec3,
          visible: { type: "boolean" },
          locked: { type: "boolean" },
        },
        required: ["groupId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_group",
      description: "Delete a group. Use cascade to delete its children.",
      parameters: {
        type: "object",
        properties: {
          groupId: { type: "string" },
          baseRevision: { type: "number" },
          cascade: { type: "boolean" },
        },
        required: ["groupId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_instance",
      description: "Place a definition in the assembly.",
      parameters: {
        type: "object",
        properties: {
          definitionId: { type: "string" },
          name: { type: "string" },
          parentId: { type: "string" },
          position: vec3,
          rotation: vec3,
          material,
          materialMode,
          paramOverrides: { type: "object" },
        },
        required: ["definitionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_instance",
      description: "Move, rename, hide, lock, suppress or override a placed instance. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: {
          instanceId: { type: "string" },
          baseRevision: { type: "number" },
          name: { type: "string" },
          definitionId: { type: "string" },
          parentId: { type: "string" },
          position: vec3,
          rotation: vec3,
          material,
          materialMode,
          paramOverrides: { type: "object" },
          visible: { type: "boolean" },
          locked: { type: "boolean" },
          suppressed: { type: "boolean" },
        },
        required: ["instanceId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_instance",
      description: "Delete a placed instance. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: { instanceId: { type: "string" }, baseRevision: { type: "number" } },
        required: ["instanceId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_driver",
      description: "Create a named motion input, e.g. crank_angle.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number" },
          unit: { type: "string" },
        },
        required: ["name", "value", "min", "max"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_driver",
      description: "Update a driver. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: {
          driverId: { type: "string" },
          baseRevision: { type: "number" },
          name: { type: "string" },
          value: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number" },
          unit: { type: "string" },
        },
        required: ["driverId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_driver",
      description: "Delete a motion driver. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: { driverId: { type: "string" }, baseRevision: { type: "number" } },
        required: ["driverId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_joint",
      description: "Create a revolute, prismatic or link relationship. A revolute/prismatic joint targets a child instance or a child group; use a child group when the whole subassembly must spin together.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["revolute", "prismatic", "link"] },
          ...jointFields,
        },
        required: ["type", "name", "parentInstanceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_joint",
      description: "Update a joint. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: {
          jointId: { type: "string" },
          baseRevision: { type: "number" },
          ...jointFields,
        },
        required: ["jointId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_joint",
      description: "Delete a motion joint. Requires baseRevision.",
      parameters: {
        type: "object",
        properties: { jointId: { type: "string" }, baseRevision: { type: "number" } },
        required: ["jointId", "baseRevision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_views",
      description: "Render selected views of the current assembly into an inspection sheet.",
      parameters: {
        type: "object",
        properties: {
          views: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            items: { type: "string", enum: ["iso", "front", "back", "left", "right", "top", "bottom", "detail"] },
          },
          focusInstanceIds: { type: "array", items: { type: "string" } },
          hiddenInstanceIds: { type: "array", items: { type: "string" } },
        },
        required: ["views"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user for missing information. Pauses the run until they answer.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          header: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, description: { type: "string" } },
              required: ["label"],
            },
          },
          allowCustom: { type: "boolean" },
        },
        required: ["question"],
      },
    },
  },
];

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-40);
  const imageIndexes: number[] = [];
  recent.forEach((message, index) => {
    if (Array.isArray(message.content) && message.content.some((part) => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "image_url"))) {
      imageIndexes.push(index);
    }
  });
  const keepImages = new Set(imageIndexes.slice(-4));

  return recent.map((message, index) => {
    let next = message;
    if (Array.isArray(message.content) && !keepImages.has(index)) {
      const text = message.content
        .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "text"))
        .map((part) => part.text)
        .join("\n");
      next = { ...next, content: `${text}\n[previous inspection sheet omitted]` };
    }
    if (next.role === "assistant" && next.tool_calls?.length) {
      next = {
        ...next,
        tool_calls: next.tool_calls.map((call) => {
          const args = call.function?.arguments;
          if (typeof args !== "string" || args.length < 4000) return call;
          try {
            const parsed = JSON.parse(args) as Record<string, unknown>;
            if (typeof parsed.source === "string") parsed.source = "[source omitted; call get_definition]";
            return {
              ...call,
              function: { ...call.function, arguments: JSON.stringify(parsed) },
            };
          } catch {
            return call;
          }
        }),
      };
    }
    return next;
  });
}

export async function runAgentTurnV2(
  messages: ChatMessage[],
  sessionId: string,
  signal: AbortSignal,
  modelState = "",
): Promise<AgentV2AssistantMessage> {
  if (!API_KEY) throw new AgentError("OPENCODE_GO_API_KEY is not set on the server.", 503);
  const system = modelState
    ? `${SYSTEM}\n\nMODEL STATE (read-only snapshot; revisions are authoritative)\n${modelState}`
    : SYSTEM;
  const conversation: ChatMessage[] = [
    { role: "system", content: system },
    ...sanitizeMessages(messages),
  ];
  const upstream = combineWithTimeout(signal);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: upstream.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "x-opencode-session": `cadgo-v2-${sessionId}`.slice(0, 120),
        "x-opencode-client": "cadgo-assembly-studio",
        "User-Agent": "cadgo-agent-v2/0.1",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversation,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: Number.isFinite(MAX_TOKENS) && MAX_TOKENS > 0 ? MAX_TOKENS : 24000,
      }),
    });
    const text = await response.text();
    let payload: ChatResponse;
    try {
      payload = JSON.parse(text) as ChatResponse;
    } catch {
      throw new AgentError(`The CAD agent returned an unreadable response (${response.status}).`, 502);
    }
    if (!response.ok) {
      const error = payload.error?.message ?? `HTTP ${response.status}`;
      throw new AgentError(`CAD agent error: ${error}`, response.status === 429 ? 429 : 502);
    }
    const choice = payload.choices?.[0];
    if (!choice) throw new AgentError("The CAD agent returned no result.", 502);
    if (choice.finish_reason === "length") {
      return {
        role: "assistant",
        content: choice.message?.content ?? "",
        tool_calls: [],
        model: MODEL,
        truncated: true,
      };
    }
    return {
      role: "assistant",
      content: choice.message?.content ?? "",
      tool_calls: choice.message?.tool_calls ?? [],
      model: MODEL,
    };
  } catch (error) {
    if (upstream.timedOut()) throw new AgentError(UPSTREAM_TIMEOUT_MESSAGE, 504);
    throw error;
  } finally {
    upstream.dispose();
  }
}

type ToolDelta = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type StreamChunk = {
  choices?: {
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      reasoning?: string | null;
      tool_calls?: ToolDelta[];
    };
  }[];
  error?: { message?: string };
};

export function streamAgentTurnV2(
  messages: ChatMessage[],
  sessionId: string,
  signal: AbortSignal,
  modelState = "",
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: unknown) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // The consumer disconnected; there is nothing left to deliver.
    }
  };
  const close = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      controller.close();
    } catch {
      // The stream was already closed by the consumer.
    }
  };
  const system = modelState
    ? `${SYSTEM}\n\nMODEL STATE (read-only snapshot; revisions are authoritative)\n${modelState}`
    : SYSTEM;
  const conversation: ChatMessage[] = [
    { role: "system", content: system },
    ...sanitizeMessages(messages),
  ];

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!API_KEY) {
        send(controller, { type: "error", message: "OPENCODE_GO_API_KEY is not set on the server." });
        close(controller);
        return;
      }
      const upstream = combineWithTimeout(signal);
      try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          signal: upstream.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
            "x-opencode-session": `cadgo-v2-${sessionId}`.slice(0, 120),
            "x-opencode-client": "cadgo-assembly-studio",
            "User-Agent": "cadgo-agent-v2/0.1",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: conversation,
            tools: TOOLS,
            tool_choice: "auto",
            stream: true,
            max_tokens: Number.isFinite(MAX_TOKENS) && MAX_TOKENS > 0 ? MAX_TOKENS : 24000,
          }),
        });

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "");
          let detail = text;
          try {
            const parsed = JSON.parse(text) as ChatResponse;
            detail = parsed.error?.message ?? text;
          } catch {
            // Keep the raw response.
          }
          send(controller, {
            type: "error",
            message: `CAD agent error: ${detail || `HTTP ${response.status}`}`,
          });
          close(controller);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const calls = new Map<number, ToolCall>();
        let buffer = "";
        let content = "";
        let finishReason: string | null = null;
        let finished = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              finished = true;
              break;
            }
            let chunk: StreamChunk;
            try {
              chunk = JSON.parse(payload) as StreamChunk;
            } catch {
              continue;
            }
            if (chunk.error?.message) {
              send(controller, { type: "error", message: `CAD agent error: ${chunk.error.message}` });
              close(controller);
              return;
            }
            const choice = chunk.choices?.[0];
            if (!choice) continue;
            if (choice.finish_reason) finishReason = choice.finish_reason;
            const delta = choice.delta;
            if (typeof delta?.content === "string" && delta.content) {
              content += delta.content;
              send(controller, { type: "delta", content: delta.content });
            }
            const reasoning = delta?.reasoning_content ?? delta?.reasoning;
            if (typeof reasoning === "string" && reasoning) {
              send(controller, { type: "reasoning", content: reasoning });
            }
            if (Array.isArray(delta?.tool_calls)) {
              for (const item of delta.tool_calls) {
                const index = item.index ?? 0;
                const current =
                  calls.get(index) ?? {
                    id: item.id,
                    type: item.type,
                    function: { name: "", arguments: "" },
                  };
                if (item.id) current.id = item.id;
                if (item.type) current.type = item.type;
                if (item.function?.name) current.function = { ...current.function, name: item.function.name };
                if (item.function?.arguments) {
                  const previous = typeof current.function?.arguments === "string" ? current.function.arguments : "";
                  current.function = { ...current.function, arguments: previous + item.function.arguments };
                }
                calls.set(index, current);
              }
            }
          }
          if (finished) break;
        }

        const toolCalls = [...calls.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, call]) => call);
        const truncated = finishReason === "length";
        send(controller, {
          type: "done",
          message: {
            role: "assistant",
            content,
            tool_calls: truncated ? [] : toolCalls,
            model: MODEL,
            truncated,
          },
        });
        close(controller);
      } catch (error) {
        if (upstream.timedOut()) {
          send(controller, { type: "error", message: UPSTREAM_TIMEOUT_MESSAGE });
          close(controller);
          return;
        }
        if (signal.aborted) {
          close(controller);
          return;
        }
        send(controller, {
          type: "error",
          message: error instanceof Error ? error.message : "The CAD agent stream failed.",
        });
        close(controller);
      } finally {
        upstream.dispose();
      }
    },
  });
}
