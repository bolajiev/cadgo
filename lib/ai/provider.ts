import { jsonrepair } from "jsonrepair";
import { cadSpecSchema } from "@/lib/cad/schema";
import { normalizeSpec, specErrors } from "@/lib/cad/validate";
import type { CadSpec } from "@/lib/cad/types";
import { cadSpecTool, editSystemPrompt, generationSystemPrompt, revisionBrief, userBrief } from "./schema";
import { EXAMPLES } from "@/lib/cad/examples";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ToolCall = {
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

type ChatResponse = {
  choices?: {
    finish_reason?: string;
    message?: {
      content?: string;
      tool_calls?: ToolCall[];
      reasoning_content?: string;
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
};

export type SpecResult = {
  spec: CadSpec;
  message: string;
  notes: string[];
  ms: number;
  usage?: ChatResponse["usage"];
  attempts: number;
};

export class DrafterError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_MODEL ?? "deepseek-v4.1-flash";
const API_KEY = process.env.OPENCODE_GO_API_KEY ?? "";

const cache = new Map<string, SpecResult>();

function cacheKey(kind: string, prompt: string) {
  return `${MODEL}:${kind}:${prompt.trim().toLowerCase()}`;
}

function modelForAttempt() {
  return MODEL;
}

async function chat(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  sessionId: string,
) {
  if (!API_KEY) {
    throw new DrafterError("OPENCODE_GO_API_KEY is not set on the server.", 503);
  }
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(55000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "x-opencode-session": `cadgo-${sessionId}`.slice(0, 120),
        "x-opencode-client": "cadgo",
        "User-Agent": "cadgo/0.1 (AI mechanism workbench)",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: [cadSpecTool],
        tool_choice: "auto",
        thinking:
          process.env.CADGO_THINKING === "1" ? { type: "enabled" } : { type: "disabled" },
        temperature,
        max_tokens: 32000,
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new DrafterError("The drafter timed out. Trying a second pass.", 504);
    }
    throw new DrafterError("The drafter could not be reached.", 502);
  }
  const text = await response.text();
  let payload: ChatResponse;
  try {
    payload = JSON.parse(text) as ChatResponse;
  } catch {
    throw new DrafterError(`The drafter returned an unreadable response (${response.status}).`, 502);
  }
  if (!response.ok) {
    const reason = payload.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new DrafterError("The drafter key was refused.", 502);
    }
    if (response.status === 429) {
      throw new DrafterError("The drafter is rate-limited right now. Try a bench example.", 429);
    }
    throw new DrafterError(`Drafter error: ${reason}`, 502);
  }
  const choice = payload.choices?.[0];
  if (!choice) throw new DrafterError("The drafter returned no choices.", 502);
  if (choice.finish_reason === "length") {
    throw new DrafterError("The drafter ran out of room. Try a smaller mechanism.", 502);
  }
  const toolCall = choice.message?.tool_calls?.find(
    (call) => call.function?.name === "create_spec",
  );
  let raw: Record<string, unknown> | null = null;
  if (toolCall?.function?.arguments) {
    if (typeof toolCall.function.arguments === "string") {
      try {
        raw = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch (parseError) {
        const textArgs = toolCall.function.arguments;
        try {
          raw = JSON.parse(jsonrepair(textArgs)) as Record<string, unknown>;
          console.warn("Repaired malformed tool JSON");
        } catch {
          const message = parseError instanceof Error ? parseError.message : "parse error";
          console.error("Bad tool args", choice.finish_reason, textArgs.length, message);
          throw new DrafterError("The drafter's spec was not valid JSON.", 502);
        }
      }
    } else {
      raw = toolCall.function.arguments as Record<string, unknown>;
    }
  } else if (choice.message?.content) {
    const content = choice.message.content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new DrafterError("The drafter did not call the spec tool.", 502);
    }
  }
  if (!raw) throw new DrafterError("The drafter did not return a spec.", 502);
  return { raw, payload, ms: Date.now() - started };
}

function parseSpec(raw: Record<string, unknown>, prompt: string) {
  const { message, notes, ...rest } = raw;
  const noteList = Array.isArray(notes)
    ? notes.filter((note): note is string => typeof note === "string")
    : [];
  const spec = cadSpecSchema.parse({
    ...rest,
    version: 1,
    sourcePrompt: prompt,
    notes: noteList,
  });
  return {
    spec: normalizeSpec(spec),
    message: typeof message === "string" ? message : `Drafted ${spec.name}.`,
    notes: noteList,
  };
}

function explainZod(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "spec"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : "schema validation failed";
}

export async function generateSpec(prompt: string, sessionId: string): Promise<SpecResult> {
  const key = cacheKey("gen", prompt);
  const hit = cache.get(key);
  if (hit) return { ...hit, ms: 0, attempts: 0 };

  const system = generationSystemPrompt([EXAMPLES[0].spec, EXAMPLES[1].spec]);
  let repair = "";
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          userBrief(prompt) +
          (repair
            ? `\n\nREPAIR ATTEMPT ${attempt - 1}: The previous attempt failed validation.\n${repair}\nReturn a corrected complete spec. Keep the design intent, reduce complexity if needed.`
            : ""),
      },
    ];
    try {
      const result = await chat(modelForAttempt(), messages, 0.35, sessionId);
      try {
        const parsed = parseSpec(result.raw, prompt);
        const issues = specErrors(parsed.spec);
        if (issues.length) {
          lastError = issues.join("; ");
          repair = `Validation errors:\n${lastError}\nPrevious spec:\n${JSON.stringify(result.raw).slice(0, 18000)}`;
          continue;
        }
        const final: SpecResult = {
          ...parsed,
          ms: result.ms,
          usage: result.payload.usage,
          attempts: attempt,
        };
        cache.set(key, final);
        if (cache.size > 24) cache.delete(cache.keys().next().value as string);
        return final;
      } catch (error) {
        lastError = explainZod(error);
        repair = `Validation errors:\n${lastError}\nPrevious spec:\n${JSON.stringify(result.raw).slice(0, 18000)}`;
      }
    } catch (error) {
      if (error instanceof DrafterError) {
        if (error.status === 429) throw error;
        if (attempt === 2) throw error;
        lastError = error.message;
        repair = `Transport/tool error: ${lastError}`;
      } else {
        throw error;
      }
    }
  }
  throw new DrafterError(`The draft did not validate after three attempts. ${lastError}`, 502);
}

export async function reviseSpec(
  spec: CadSpec,
  message: string,
  sessionId: string,
  selectedPartId?: string | null,
): Promise<SpecResult> {
  const system = editSystemPrompt();
  let repair = "";
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const user =
      revisionBrief(spec, message, selectedPartId) +
      (repair
        ? `\n\nREPAIR ATTEMPT ${attempt - 1}: The previous revision failed validation.\n${repair}\nReturn a corrected complete spec.`
        : "");
    try {
      const result = await chat(
        modelForAttempt(),
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        0.2,
        sessionId,
      );
      try {
        const parsed = parseSpec(result.raw, spec.sourcePrompt ?? spec.name);
        const issues = specErrors(parsed.spec);
        if (issues.length) {
          lastError = issues.join("; ");
          repair = `Validation errors:\n${lastError}\nPrevious spec:\n${JSON.stringify(result.raw).slice(0, 18000)}`;
          continue;
        }
        return {
          ...parsed,
          ms: result.ms,
          usage: result.payload.usage,
          attempts: attempt,
        };
      } catch (error) {
        lastError = explainZod(error);
        repair = `Validation errors:\n${lastError}\nPrevious spec:\n${JSON.stringify(result.raw).slice(0, 18000)}`;
      }
    } catch (error) {
      if (error instanceof DrafterError) {
        if (error.status === 429) throw error;
        if (attempt === 2) throw error;
        lastError = error.message;
        repair = `Transport/tool error: ${lastError}`;
      } else {
        throw error;
      }
    }
  }
  throw new DrafterError(`The revision did not validate after three attempts. ${lastError}`, 502);
}
