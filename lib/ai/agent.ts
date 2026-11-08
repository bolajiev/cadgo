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

export type AgentToolCall = ToolCall;
export type AgentAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls: ToolCall[];
  model: string;
  truncated?: boolean;
};

export class AgentError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_DESIGN_MODEL ?? "deepseek-v4.1-flash";
const API_KEY = process.env.OPENCODE_GO_API_KEY ?? "";
const MAX_TOKENS = Number(process.env.CADGO_AGENT_MAX_TOKENS ?? 24000);

const SYSTEM = `You are Cadgo, an agentic AI CAD editor. You build real OpenSCAD models and you converse like a careful engineer.

You have four tools:
1. ask_user({ question, header?, options?, allowCustom? })
2. build_model({ title, code })
3. render_views({ views: ["iso" | "front" | "back" | "left" | "right" | "top" | "bottom" | "detail"] })
4. answer_user({ message })

HOW TO WORK
- You decide what to do. There is no fixed sequence and no fixed number of builds.
- If the request is clear and the user wants a model, call build_model with complete raw OpenSCAD.
- If something important is missing or ambiguous (scale, purpose, hidden geometry, a named reference), call ask_user before guessing. You may also ask a question after seeing renders.
- After build_model, the browser compiles locally. If it fails, fix the source and build again.
- Use render_views to inspect only the views you need from the available angles. You may render again at any time, as many times as useful.
- If a view is wrong, revise the code and build again.
- The build tool rejects hardcoded dimensions. Every driving dimension inside a module must be a named top-level parameter or a derived value. Tolerances, clearances, wall thicknesses and offsets are dimensions too.
- When the model is good, answer_user. You may also answer a question without building.
- The user can interrupt, stop, or ask you a question at any time. Do not ignore their latest message.

DESIGN
- Millimetres. Z up. Use complete, compilable OpenSCAD.
- Top-level named parameters for driving dimensions. No external includes.
- Use color() for distinct parts. Keep the mesh efficient.
- A mechanism must be a coherent assembly of separate named parts, not one flattened block.
- If a reference image is supplied, match visible silhouette, proportions and features. Do not invent a hidden face as fact; state assumptions.
- Only model physical objects and mechanisms. Never people, faces, animals or scenes.
- This is a concept CAD model, not certified engineering. Do not claim print-readiness.
- If the user supplied a print/process setup, treat it as a constraint. If it is missing, do not invent a printer or bed.
- Do not rewrite or change the user's intent. Do not add unrelated features.
- No hardcoded workflow. Use tools as the situation requires.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user for missing information. This pauses the run until they answer.",
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
  {
    type: "function",
    function: {
      name: "build_model",
      description: "Compile a complete OpenSCAD model. Returns compiler status and geometry metrics. It does not force a render.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short model name." },
          code: { type: "string", description: "Complete OpenSCAD source. No markdown fences." },
        },
        required: ["title", "code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_views",
      description: "Render selected views of the current compiled mesh into an inspection sheet.",
      parameters: {
        type: "object",
        properties: {
          views: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            items: { type: "string", enum: ["iso", "front", "back", "left", "right", "top", "bottom", "detail"] },
          },
        },
        required: ["views"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "answer_user",
      description: "Send the final user-facing reply, after a build or as a normal chat answer.",
      parameters: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  },
];

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const imageMessages = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => Array.isArray(message.content) && message.content.some((part) => {
      return Boolean(part && typeof part === "object" && (part as { type?: string }).type === "image_url");
    }));
  const keep = new Set<number>();
  if (imageMessages.length) keep.add(imageMessages[0].index);
  if (imageMessages.length > 1) keep.add(imageMessages[imageMessages.length - 1].index);
  const recent = messages.slice(-40);
  return recent.map((message) => {
    if (!Array.isArray(message.content) || keep.has(messages.indexOf(message))) return message;
    if (!message.content.some((part) => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "image_url"))) {
      return message;
    }
    const text = message.content
      .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "text"))
      .map((part) => part.text)
      .join("\n");
    return { ...message, content: `${text}\n[previous inspection sheet omitted]` };
  });
}

export async function runAgentTurn(
  messages: ChatMessage[],
  sessionId: string,
  signal: AbortSignal,
): Promise<AgentAssistantMessage> {
  if (!API_KEY) throw new AgentError("OPENCODE_GO_API_KEY is not set on the server.", 503);
  const conversation: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...sanitizeMessages(messages),
  ];
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "x-opencode-session": `cadgo-agent-${sessionId}`.slice(0, 120),
      "x-opencode-client": "cadgo-studio",
      "User-Agent": "cadgo-agent/0.1",
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
}
