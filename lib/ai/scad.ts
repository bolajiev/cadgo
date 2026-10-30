import { jsonrepair } from "jsonrepair";
import { webLookup } from "./web";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};

type ChatResponse = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; tool_calls?: ToolCall[] };
  }[];
  error?: { message?: string };
};

export type ScadSource = {
  title: string;
  url: string;
};

export type ScadArtifact = {
  title: string;
  code: string;
  message: string;
  model: string;
  ms: number;
  parts: string[];
  sources: ScadSource[];
};

type DesignPlan = {
  interpretation: string;
  parts: string[];
  lookups: string[];
  dimensions: { name: string; value: string; source: string }[];
  risks: string;
};

export class ScadError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_DESIGN_MODEL ?? "gpt-6-luna";
const FALLBACK_MODEL = process.env.OPENCODE_GO_DESIGN_FALLBACK_MODEL ?? "kimi-k3.1-pro";
const API_KEY = process.env.OPENCODE_GO_API_KEY ?? "";

const cache = new Map<string, ScadArtifact>();

const createTool = {
  type: "function",
  function: {
    name: "create_scad",
    description:
      "Return a complete, compilable OpenSCAD program and its bill of parts. Every distinct real part must be a separate connected body.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short product name, e.g. 'Split shaft collar'." },
        code: {
          type: "string",
          description: "The complete OpenSCAD source. Top-level parameters with // [min:max] comments.",
        },
        message: {
          type: "string",
          description: "One short sentence about the model, including assumptions or source names.",
        },
        parts: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Short real part name." },
              role: { type: "string", description: "Its role in the assembly." },
            },
            required: ["name", "role"],
            additionalProperties: false,
          },
          description: "The bill of parts. Each entry must be one separate connected body in the mesh.",
        },
      },
      required: ["title", "code", "message", "parts"],
    },
  },
};

const REFERENCE = `// Split shaft collar — two separate, clearanced parts
// [Bore diameter]
bore = 12; // [6:30]
// [Outer diameter]
outer = 30; // [18:60]
// [Collar width]
width = 10; // [6:20]
// [Parting gap]
gap = 0.5; // [0.2:1.2]
// [Cap screw diameter]
screw = 3.4; // [2.5:5]
// [Screw span]
span = 36; // [24:80]

$fn = 72;

module half(side = 1) {
  difference() {
    intersection() {
      cylinder(h = width, d = outer, center = true);
      translate([0, side * gap / 2, 0])
        cube([outer * 1.6, outer, width + 2], center = true);
    }
    cylinder(h = width + 2, d = bore, center = true);
    for (x = [-1, 1])
      translate([x * span / 2, 0, 0])
        rotate([90, 0, 0]) cylinder(h = outer * 2, d = screw, center = true);
  }
}

color([0.28, 0.30, 0.33])
  translate([0, gap / 2 + 0.01, 0]) half(-1);
color([0.42, 0.18, 0.10])
  translate([0, -gap / 2 - 0.01, 0]) rotate([0, 0, 180]) half(1);
`;

const PLANNER_SYSTEM = `You are Cadgo's lead CAD engineer. Plan before anyone writes geometry. Do not write OpenSCAD yet.

Return exactly one JSON object with this shape:
{
  "interpretation": "what the object is, its constraints, and what is deliberately assumed",
  "parts": [{ "name": "short real part name", "role": "what it does and how it mates" }],
  "dimensions": [{ "name": "dimension", "value": "value and unit", "source": "given | assumed | lookup" }],
  "lookups": ["specific web search queries for real standards or missing critical dimensions"],
  "risks": "the most likely geometry, clearance or manufacturability failure"
}

PLANNING RULES
- Decompose the object into real, separately manufacturable parts. A hole, fillet or feature is not a part.
- A single-part object has exactly one part. An assembly lists every screw, pin, lid, motor, bearing or handle as a separate part.
- Parts must be separate bodies with 0.2–0.8 mm clearance at mating faces. They must not be fused.
- List lookups for named real components, standards, fasteners, motors, boards and fittings. Do not invent a mounting pattern you can verify.
- Use the user's dimensions first. Mark missing dimensions as assumed.
- Be concise. No prose outside the JSON.`;

const DESIGN_RULES = `
You are Cadgo's design engineer. You produce real, editable CAD, not pretty meshes. You have an approved plan and reference research. Build exactly that.

You have one tool: create_scad. Return exactly one create_scad call containing a COMPLETE, compilable OpenSCAD 2025 program and its parts manifest.

REAL CAD / PARTS
- A part is a standalone, watertight, printable body. A feature or a hole is not a part.
- If the object is one part, return exactly one connected body and declare one part.
- If the object is an assembly, every declared part must be its own connected body with a small visible clearance (0.2–0.8 mm) at mating faces. Do not union distinct parts into one solid. If parts overlap or touch, they become one body and the result is rejected.
- Keep the assembly in its working position, not exploded, unless the brief asks for an exploded view.
- Do not add unrequested loose parts, decorative floating solids or disconnected fragments. Every body must be in the parts manifest.
- Screws, pins, bearings, motors, lids and handles are parts when present. Model them as separate solids with realistic clearances.
- Use colour to distinguish parts. 1–4 intentional colours; a neutral structure plus accents reads well.

OPENSCAD
- Built-in OpenSCAD 2025 only. Never use include, use, import, surface, text, or external libraries.
- Millimetres, Z up. Put the assembly on z = 0 and centre it around x = 0, y = 0.
- Top-level parameters go before the first module/function. Each has a description line and a range:
    // Overall diameter
    diameter = 42; // [24:70]
  Use 4–9 meaningful parameters. Do not expose implementation variables starting with $.
- Set $fn = 64 or 96 once for round features.
- Prefer cylinder, cube, difference, union, intersection, hull, linear_extrude, rotate_extrude and for loops. Avoid minkowski.
- Make each part manufacturable: wall thickness, chamfers, fillets via hull/rounded profiles, bosses, bores, countersinks, lightening holes. No zero-thickness walls.
- Keep the source under 220 lines. No random(), no animation, no echo output.
- Compiler errors are fatal. Verify every block closes and every cut has positive volume.

CRAFT
- Knobs: knurled rim, a D-bore or keyway, a real separate set screw, a pointer.
- Brackets: flanges, rounded corners, mounting holes, lightening cutouts, a gusset or rib.
- Housings: wall thickness, bosses, screw holes, a separate lid, clearance for assembly.
- Gears/pulleys: real tooth count, hub, bore, lightening holes, a separate shaft or pin.
- Vases/containers: closed bottom, wall thickness, rim, twist or facet count.
- Mechanisms: separate links, pins, bearings and fasteners with working clearances.

REFERENCE RESEARCH
- The user message includes verified lookup results. Use those dimensions. If a lookup failed, state the assumption in the message.
- Do not invent a standard interface that the research contradicts.
- Name any source you used in the message.

REFERENCE FORMAT (do not copy the subject):
${REFERENCE}
`;

const GENERATE_SYSTEM = `${DESIGN_RULES}

The approved plan is the design intent. Fix only clear geometry or manufacturability errors in it. Do not add unrelated features. Use the tool, never prose, for the model.`;

const EDIT_SYSTEM = `${DESIGN_RULES}

You are revising an existing assembly. Return the complete revised source and parts manifest.
- Preserve every parameter name and everything the user did not ask to change.
- Keep the same part breakdown, colours and design language unless the request adds or removes a part.
- Apply the smallest coherent change. Keep every declared part a separate body.
- If the request is impossible, make the closest safe change and say so in the message.`;

const REPAIR_SYSTEM = `${DESIGN_RULES}

You are fixing OpenSCAD source that failed a build check. Return the complete corrected source and parts manifest.
Keep the design intent and parameter names. Fix the syntax, geometry, or body-count problem named in the check. If the check says the body count does not match the parts manifest, separate the declared parts with clearance; do not fuse them. Do not simplify the model away.`;

function parseToolArguments(value: string | Record<string, unknown> | undefined) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(jsonrepair(value)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function parseParts(raw: Record<string, unknown>) {
  const entries = Array.isArray(raw.parts) ? raw.parts : [];
  const names = entries.flatMap((entry) => {
    if (typeof entry === "string") return [entry.trim()];
    if (entry && typeof entry === "object" && "name" in entry) {
      const name = (entry as { name?: unknown }).name;
      return typeof name === "string" ? [name.trim()] : [];
    }
    return [];
  });
  const unique = [...new Set(names.filter(Boolean))].slice(0, 12);
  return unique.length ? unique : ["Body"];
}

function parseJsonObject(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(jsonrepair(clean.slice(start, end + 1))) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function normalizePlan(text: string, prompt: string): DesignPlan {
  const raw = parseJsonObject(text) ?? {};
  const parts = Array.isArray(raw.parts)
    ? raw.parts.flatMap((entry) => {
        if (typeof entry === "string") return [entry.trim()];
        if (entry && typeof entry === "object" && "name" in entry) {
          const name = (entry as { name?: unknown }).name;
          return typeof name === "string" ? [name.trim()] : [];
        }
        return [];
      })
    : [];
  const lookups = Array.isArray(raw.lookups)
    ? raw.lookups.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        if (typeof item.name !== "string" || typeof item.value !== "string") return [];
        return [{
          name: item.name,
          value: item.value,
          source: typeof item.source === "string" ? item.source : "assumed",
        }];
      })
    : [];
  return {
    interpretation:
      typeof raw.interpretation === "string" && raw.interpretation.trim()
        ? raw.interpretation.trim().slice(0, 900)
        : prompt.slice(0, 300),
    parts: [...new Set(parts.filter(Boolean))].slice(0, 12),
    lookups: [...new Set(lookups.map((item) => item.trim()))].slice(0, 3),
    dimensions: dimensions.slice(0, 16),
    risks: typeof raw.risks === "string" ? raw.risks.trim().slice(0, 500) : "",
  };
}

function artifactFromRaw(
  raw: Record<string, unknown>,
  model: string,
  started: number,
  sources: ScadSource[],
): ScadArtifact {
  let code = typeof raw.code === "string" ? raw.code : "";
  code = code.trim();
  if (/^```/.test(code)) {
    code = code.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  }
  if (!code || code.length < 30 || !/;/.test(code)) {
    throw new ScadError("The design compiler returned an empty model.", 502);
  }
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 80)
      : "OpenSCAD model";
  const message =
    typeof raw.message === "string" && raw.message.trim()
      ? raw.message.trim().slice(0, 360)
      : "Drafted the model.";
  return {
    title,
    code,
    message,
    model,
    ms: Date.now() - started,
    parts: parseParts(raw),
    sources,
  };
}

function addSources(target: ScadSource[], results: { title: string; url: string }[]) {
  for (const result of results) {
    if (target.length >= 4) return;
    if (!result.url || target.some((item) => item.url === result.url)) continue;
    target.push({ title: result.title.slice(0, 90), url: result.url });
  }
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  signal: AbortSignal,
  sessionId: string,
  tools: unknown[],
  maxTokens: number,
) {
  if (!API_KEY) throw new ScadError("OPENCODE_GO_API_KEY is not set on the server.", 503);
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: /kimi/i.test(model) ? 1 : temperature,
    max_tokens: maxTokens,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
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
        "User-Agent": "cadgo-studio/0.4",
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
    throw new ScadError("The design compiler ran out of room. Try a simpler assembly.", 502);
  }
  return { message: choice.message ?? {}, model };
}

async function runModel(
  messages: ChatMessage[],
  temperature: number,
  signal: AbortSignal,
  sessionId: string,
  tools: unknown[],
  maxTokens: number,
) {
  try {
    return await callModel(MODEL, messages, temperature, signal, sessionId, tools, maxTokens);
  } catch (error) {
    if (error instanceof ScadError && error.status === 499) throw error;
    try {
      return await callModel(FALLBACK_MODEL, messages, temperature, signal, sessionId, tools, maxTokens);
    } catch {
      throw error;
    }
  }
}

async function planDesign(prompt: string, sessionId: string, signal: AbortSignal) {
  const response = await runModel(
    [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: `BRIEF: ${prompt}\n\nReturn the planning JSON now.` },
    ],
    0.2,
    signal,
    sessionId,
    [],
    3500,
  );
  return normalizePlan(response.message.content ?? "", prompt);
}

function inferLookupQuery(prompt: string) {
  const metric = prompt.match(/\bM(\d+(?:\.\d+)?)\b/i);
  if (metric) return `ISO 4762 M${metric[1]} socket head cap screw dimensions`;
  if (/NEMA\s*\d+/i.test(prompt)) return "NEMA stepper motor mounting hole spacing dimensions";
  if (/raspberry pi/i.test(prompt)) return "Raspberry Pi mounting hole spacing dimensions";
  if (/arduino/i.test(prompt)) return "Arduino board mounting hole spacing dimensions";
  if (/\b(\d{3,4})\s*(?:ZZ|2RS|bearing)\b/i.test(prompt)) return `${prompt.match(/\d{3,4}/)?.[0]} ball bearing dimensions`;
  return null;
}

function lookupQueries(prompt: string, plan: DesignPlan) {
  const queries = [...plan.lookups];
  if (!queries.length) {
    const inferred = inferLookupQuery(prompt);
    if (inferred) queries.push(inferred);
  }
  return [...new Set(queries.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
}

async function researchReferences(queries: string[]) {
  const sources: ScadSource[] = [];
  const blocks: string[] = [];
  const results = await Promise.all(
    queries.map(async (query) => {
      try {
        return await webLookup(query);
      } catch (error) {
        return { query, results: [], error: error instanceof Error ? error.message : "Lookup failed" };
      }
    }),
  );
  for (const result of results) {
    addSources(sources, result.results);
    if (!result.results.length) {
      blocks.push(`LOOKUP: ${result.query}\nRESULT: ${result.error ?? "No source found. State the assumption."}`);
      continue;
    }
    for (const item of result.results.slice(0, 2)) {
      blocks.push(
        `LOOKUP: ${result.query}\nSOURCE: ${item.title} — ${item.url}\nEXTRACT: ${(item.text ?? item.snippet).slice(0, 1800)}`,
      );
    }
  }
  return { sources, text: blocks.join("\n\n").slice(0, 12000) };
}

async function buildArtifact(
  messages: ChatMessage[],
  sessionId: string,
  signal: AbortSignal,
  sources: ScadSource[],
  started: number,
) {
  const response = await runModel(messages, 0.2, signal, sessionId, [createTool], 20000);
  const calls = response.message.tool_calls ?? [];
  const specCall = calls.find((call) => call.function?.name === "create_scad");
  if (specCall) {
    const raw = parseToolArguments(specCall.function?.arguments);
    if (!raw) throw new ScadError("The design compiler returned malformed code data.", 502);
    return artifactFromRaw(raw, response.model, started, sources);
  }
  const content = (response.message.content ?? "")
    .trim()
    .replace(/^```(?:scad|openscad|json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (content) {
    const raw = parseJsonObject(content);
    if (raw && typeof raw.code === "string") return artifactFromRaw(raw, response.model, started, sources);
    if (content.includes("module") || content.includes("difference") || content.includes("union")) {
      return artifactFromRaw(
        { title: "OpenSCAD model", code: content, message: "Designed the model." },
        response.model,
        started,
        sources,
      );
    }
  }
  throw new ScadError("The design compiler did not return a model.", 502);
}

export async function generateScad(
  prompt: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ScadArtifact> {
  const key = `scad:${prompt.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return { ...hit, ms: 0 };
  const started = Date.now();
  const runSignal = signal ?? new AbortController().signal;
  const plan = await planDesign(prompt, sessionId, runSignal);
  const queries = lookupQueries(prompt, plan);
  const research = queries.length
    ? await researchReferences(queries)
    : { sources: [], text: "No external lookup was requested by the plan. Use stated assumptions." };
  const planBlock = JSON.stringify(
    {
      interpretation: plan.interpretation,
      parts: plan.parts,
      dimensions: plan.dimensions,
      lookups: plan.lookups,
      risks: plan.risks,
    },
    null,
    2,
  );
  const artifact = await buildArtifact(
    [
      { role: "system", content: GENERATE_SYSTEM },
      {
        role: "user",
        content: `BRIEF: ${prompt}\n\nAPPROVED PLAN:\n${planBlock}\n\nREFERENCE RESEARCH:\n${research.text}\n\nBuild every planned part as a separate body. Call create_scad once with the complete source and the matching parts manifest.`,
      },
    ],
    sessionId,
    runSignal,
    research.sources,
    started,
  );
  cache.set(key, artifact);
  if (cache.size > 32) cache.delete(cache.keys().next().value as string);
  return artifact;
}

export async function editScad(
  code: string,
  message: string,
  parts: string[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<ScadArtifact> {
  const started = Date.now();
  return buildArtifact(
    [
      { role: "system", content: EDIT_SYSTEM },
      {
        role: "user",
        content: `CURRENT PARTS: ${parts.length ? parts.join(", ") : "not declared"}\n\nCURRENT OPENSCAD SOURCE:\n${code}\n\nUSER REQUEST: ${message}\n\nReturn the complete revised source and matching parts manifest via create_scad.`,
      },
    ],
    sessionId,
    signal ?? new AbortController().signal,
    [],
    started,
  );
}

export async function repairScad(
  code: string,
  error: string,
  parts: string[],
  sessionId: string,
  signal?: AbortSignal,
): Promise<ScadArtifact> {
  const started = Date.now();
  return buildArtifact(
    [
      { role: "system", content: REPAIR_SYSTEM },
      {
        role: "user",
        content: `DECLARED PARTS: ${parts.length ? parts.join(", ") : "not declared"}\n\nTHE SOURCE FAILED A BUILD CHECK.\n\nCHECK:\n${error.slice(0, 5000)}\n\nSOURCE:\n${code.slice(0, 60000)}\n\nReturn the complete corrected source and matching parts manifest via create_scad.`,
      },
    ],
    sessionId,
    signal ?? new AbortController().signal,
    [],
    started,
  );
}
