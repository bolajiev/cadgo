import { jsonrepair } from "jsonrepair";
import { SCAD_EXAMPLES } from "@/lib/scad/examples";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ToolCall = {
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};

type ChatResponse = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string; tool_calls?: ToolCall[] };
  }[];
  error?: { message?: string };
};

export type ScadArtifact = {
  title: string;
  code: string;
  message: string;
  model: string;
  ms: number;
};

export class ScadError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_MODEL ?? "deepseek-v4.1-flash";
const FALLBACK_MODEL = process.env.OPENCODE_GO_FALLBACK_MODEL ?? "glm-5.3-flash";
const API_KEY = process.env.OPENCODE_GO_API_KEY ?? "";

const cache = new Map<string, ScadArtifact>();

const createTool = {
  type: "function",
  function: {
    name: "create_scad",
    description: "Return a complete, compilable OpenSCAD program for the requested CAD model.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short product name, e.g. 'Knurled control knob'" },
        code: {
          type: "string",
          description: "The complete OpenSCAD source. Top-level parameters with // [min:max] comments.",
        },
        message: { type: "string", description: "One short sentence about the model." },
      },
      required: ["title", "code", "message"],
    },
  },
};

const DESIGN_RULES = `
You are Cadgo's OpenSCAD compiler. You write real CAD, not pictures.

Return exactly one create_scad tool call containing a COMPLETE, compilable OpenSCAD 2025 program.

HARD RULES
- Built-in OpenSCAD only. Never use include, use, import, surface, text, or external libraries.
- Millimetres, Z up. Put the model on z = 0 and centre it around x = 0, y = 0.
- If the brief names one object, the result must be ONE connected watertight solid. No loose pins, plugs, caps, domes or decorative floating parts.
- A multi-part assembly is allowed only when the brief explicitly asks for one; every part must touch or overlap another part. Never a 2D-only object.
- Top-level parameters go before the first module/function. Each has a description line and a range:
    // Overall diameter
    diameter = 42; // [24:70]
  Use 4–8 meaningful parameters. Do not expose implementation variables starting with $.
- Set $fn = 64 or 96 once for round features.
- Use color() for 1–3 intentional colours. A neutral body plus one accent reads well.
- Prefer cylinder, cube, difference, union, intersection, hull, linear_extrude, rotate_extrude and for loops. Avoid minkowski.
- Make it manufacturable-looking: chamfers, fillets via hull/rounded profiles, bosses, bores, countersinks, lightening holes.
- Before returning, check every solid touches the main body or another solid. A detached part is a failed model.
- Keep it under 180 lines. No random(), no animation, no echo output.
- The geometry must have real volume. Use module definitions for reusable shapes.
- Compiler errors are fatal. Keep syntax simple and verify every block closes.

CRAFT
- Knobs: knurled rims, a D-bore or keyway, a pointer mark, a set screw.
- Brackets: two flanges, rounded outside corners, mounting holes, lightening cutouts, a gusset or rib.
- Housings: wall thickness, bosses, screw holes, chamfered lids.
- Gears/pulleys: real tooth count, hub, bore, lightening holes.
- Vases/containers: closed bottom, wall thickness, rim, twist or facet count.
- Assemblies: separate coloured solids, small realistic clearances; do not intersect moving parts.

REFERENCE FORMAT (do not copy the subject):
${SCAD_EXAMPLES[0].code}
`;

const GENERATE_SYSTEM = `${DESIGN_RULES}

Design exactly what the user asks for. Do not add unrelated features. If a dimension is unspecified, choose a believable millimetre value. Use the tool, never prose, for the model.`;

const EDIT_SYSTEM = `${DESIGN_RULES}

You are revising an existing OpenSCAD model. Return the complete revised source.
- Preserve every parameter name and everything the user did not ask to change.
- Keep the same colours and overall design language.
- Apply the smallest coherent change. Keep the code compilable.
- If the request is impossible, make the closest safe change and say so in the message.`;

const REPAIR_SYSTEM = `${DESIGN_RULES}

You are fixing OpenSCAD source that failed to compile. Return the complete corrected source.
Keep the design intent and parameter names. Fix the syntax or geometry error named in the compiler log. If the log reports floating/disconnected solids, connect them to the main body or remove them. Do not simplify the model away.`;

function toolSchema() {
  return [createTool];
}

async function callOnce(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  signal: AbortSignal,
  sessionId: string,
) {
  if (!API_KEY) throw new ScadError("OPENCODE_GO_API_KEY is not set on the server.", 503);
  const started = Date.now();
  const body: Record<string, unknown> = {
    model,
    messages,
    tools: toolSchema(),
    tool_choice: "auto",
    temperature,
    max_tokens: 12000,
  };
  if (/deepseek|glm/i.test(model)) body.thinking = { type: "disabled" };
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "x-opencode-session": `cadgo-studio-${sessionId}`.slice(0, 120),
        "x-opencode-client": "cadgo-studio",
        "User-Agent": "cadgo-studio/0.2",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (signal.aborted) throw new ScadError("Cancelled", 499);
    throw new ScadError("The design compiler could not be reached.", 502);
  }
  const text = await response.text();
  let payload: ChatResponse;
  try {
    payload = JSON.parse(text) as ChatResponse;
  } catch {
    throw new ScadError(`The design compiler returned an unreadable response (${response.status}).`, 502);
  }
  if (!response.ok) {
    const reason = payload.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 429) throw new ScadError("The design compiler is rate-limited. Try an example.", 429);
    throw new ScadError(`Design compiler error: ${reason}`, 502);
  }
  const choice = payload.choices?.[0];
  if (!choice) throw new ScadError("The design compiler returned no result.", 502);
  if (choice.finish_reason === "length") {
    throw new ScadError("The design compiler ran out of room. Try a simpler part.", 502);
  }
  const call = choice.message?.tool_calls?.find((item) => item.function?.name === "create_scad");
  let raw: Record<string, unknown> | null = null;
  if (call?.function?.arguments) {
    const args = call.function.arguments;
    if (typeof args === "string") {
      try {
        raw = JSON.parse(args) as Record<string, unknown>;
      } catch {
        try {
          raw = JSON.parse(jsonrepair(args)) as Record<string, unknown>;
        } catch {
          throw new ScadError("The design compiler returned malformed code data.", 502);
        }
      }
    } else {
      raw = args;
    }
  } else if (choice.message?.content) {
    const content = choice.message.content
      .trim()
      .replace(/^```(?:scad|openscad|json)?/i, "")
      .replace(/```$/, "")
      .trim();
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      if (content.includes("module") || content.includes("difference") || content.includes("union")) {
        raw = { title: "OpenSCAD model", code: content, message: "Designed the model." };
      }
    }
  }
  if (!raw) throw new ScadError("The design compiler did not return a model.", 502);
  let code = typeof raw.code === "string" ? raw.code : "";
  code = code.trim();
  if (/^```/.test(code)) {
    code = code.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  }
  if (!code || code.length < 30 || !/;/.test(code)) {
    throw new ScadError("The design compiler returned an empty model.", 502);
  }
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : "OpenSCAD model";
  const message =
    typeof raw.message === "string" && raw.message.trim()
      ? raw.message.trim().slice(0, 240)
      : "Drafted the model.";
  return { title, code, message, model, ms: Date.now() - started } satisfies ScadArtifact;
}

function raceModels(messages: ChatMessage[], temperature: number, sessionId: string) {
  return new Promise<ScadArtifact>((resolve, reject) => {
    let settled = false;
    let primaryAbort: AbortController | null = new AbortController();
    let fallbackAbort: AbortController | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let lastError: Error | null = null;

    const finish = (error: Error | null, artifact?: ScadArtifact) => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      primaryAbort?.abort();
      fallbackAbort?.abort();
      primaryAbort = null;
      fallbackAbort = null;
      if (error || !artifact) reject(error ?? new ScadError("No model was produced.", 502));
      else resolve(artifact);
    };

    const startFallback = () => {
      if (settled || fallbackAbort) return;
      fallbackAbort = new AbortController();
      callOnce(FALLBACK_MODEL, messages, temperature, fallbackAbort.signal, sessionId)
        .then((artifact) => finish(null, artifact))
        .catch((error) => {
          if (!settled) finish(error);
        });
    };

    callOnce(MODEL, messages, temperature, primaryAbort.signal, sessionId)
      .then((artifact) => finish(null, artifact))
      .catch((error) => {
        if (settled) return;
        lastError = error;
        if (!fallbackAbort) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          startFallback();
        } else {
          finish(lastError);
        }
      });

    fallbackTimer = setTimeout(startFallback, 4000);
  });
}

export async function generateScad(prompt: string, sessionId: string): Promise<ScadArtifact> {
  const key = `scad:${prompt.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, ms: 0 };
  const artifact = await raceModels(
    [
      { role: "system", content: GENERATE_SYSTEM },
      {
        role: "user",
        content: `BRIEF: ${prompt}\n\nDesign the part now. Call create_scad once with the complete source.`,
      },
    ],
    0.35,
    sessionId,
  );
  cache.set(key, artifact);
  if (cache.size > 32) cache.delete(cache.keys().next().value as string);
  return artifact;
}

export async function editScad(
  code: string,
  message: string,
  sessionId: string,
): Promise<ScadArtifact> {
  return raceModels(
    [
      { role: "system", content: EDIT_SYSTEM },
      {
        role: "user",
        content: `CURRENT OPENSCAD SOURCE:\n${code}\n\nUSER REQUEST: ${message}\n\nReturn the complete revised source via create_scad.`,
      },
    ],
    0.25,
    sessionId,
  );
}

export async function repairScad(
  code: string,
  error: string,
  sessionId: string,
): Promise<ScadArtifact> {
  return raceModels(
    [
      { role: "system", content: REPAIR_SYSTEM },
      {
        role: "user",
        content: `THE SOURCE FAILED TO COMPILE.\n\nCOMPILER LOG:\n${error.slice(0, 4000)}\n\nSOURCE:\n${code.slice(0, 60000)}\n\nReturn the complete corrected source via create_scad.`,
      },
    ],
    0.15,
    sessionId,
  );
}
