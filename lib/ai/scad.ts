import { jsonrepair } from "jsonrepair";
import { webLookup } from "./web";
import type { PrintProfile, StudioImage } from "@/lib/studio/profile";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
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

export type ScadPart = {
  name: string;
  quantity: number;
};

export type ScadArtifact = {
  title: string;
  code: string;
  message: string;
  model: string;
  ms: number;
  parts: ScadPart[];
  sources: ScadSource[];
};

type DesignPlan = {
  subject: string;
  interpretation: string;
  parts: string[];
  lookups: string[];
  dimensions: { name: string; value: string; source: string }[];
  imageNotes: string;
  unknowns: string;
  risks: string;
};

export type GenerateOptions = {
  image?: StudioImage;
  profile?: PrintProfile;
};

export class ScadError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_DESIGN_MODEL ?? "deepseek-v4.1-flash";
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
              quantity: {
                type: "integer",
                minimum: 1,
                maximum: 24,
                description: "How many separate instances of this part are in the assembly.",
              },
            },
            required: ["name", "role", "quantity"],
            additionalProperties: false,
          },
          description:
            "The bill of parts. Quantity is the number of separate bodies of this type; the sum must equal the mesh body count.",
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
  "subject": "short object name",
  "interpretation": "what the object is, its constraints, and what is deliberately assumed",
  "image_observations": "what the image shows, visible proportions, scale clues, hidden sides",
  "unknowns": "what the image or brief does not establish",
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
- For fasteners, plan clearance holes, not tapped holes. Every screw or bolt instance must remain a separate body with clearance.
- The user message includes a PRINT PROFILE. If its purpose is 3d-print, treat the bed as a hard envelope, plan for a flat base, minimum walls, and no supports unless allowed.
- If an image is attached, inspect the visible geometry and scale clues. State what is hidden. Never claim a hidden dimension is known.
- If the image has no scale and no known dimension is given, add a lookup/assumption note; do not pretend the size is measured.
- Use the user's dimensions first. Mark missing dimensions as assumed.
- Be concise. No prose outside the JSON.`;

const DESIGN_RULES = `
You are Cadgo's design engineer. You produce real, editable CAD, not pretty meshes. You have an approved plan and reference research. Build exactly that.

You have one tool: create_scad. Return exactly one create_scad call containing a COMPLETE, compilable OpenSCAD 2025 program and its parts manifest.

REAL CAD / PARTS
- A part is a standalone, watertight, printable body. A feature or a hole is not a part.
- If the object is one part, return exactly one connected body and declare one part.
- If the object is an assembly, every declared part instance must be its own connected body with a small visible clearance (0.2–0.8 mm) at mating faces. Do not union distinct parts into one solid. If parts overlap or touch, they become one body and the result is rejected.
- Keep the assembly in its working position, not exploded, unless the brief asks for an exploded view.
- Do not add unrequested loose parts, decorative floating solids or disconnected fragments. Every body must be in the parts manifest.
- The parts manifest is a bill of materials: use the same name and a quantity for identical parts (for example two M4 screws). The sum of quantities must equal the number of connected bodies in the mesh.
- Screws, pins, bearings, motors, lids and handles are parts when present. Model every instance as a separate solid with realistic clearances.
- Fasteners must not intersect the parts they pass through. Use through clearance holes 0.3–0.5 mm larger than the shank in every part, plus a small axial gap under the head. Do not model threads, tap holes or press fits: those fuse parts. If a thread is wanted, draw it only on the separate screw; the mating part still gets clearance.
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

PRINT PROFILE
- The user message includes the purpose, printer, build volume, material and support choice. Treat them as constraints.
- For purpose 3d-print: fit inside the build volume, sit on a flat base, use at least 1.2 mm walls, and avoid overhangs beyond 45 degrees when supports are disallowed.
- Do not silently shrink the user's dimensions to fit. If the part exceeds the bed, make a sensible split or state the overflow in the message.
- For visualization only, ignore printer constraints. For CNC or assembly, state the assumed process in the message.

IMAGE REFERENCE
- If an image is attached, reconstruct its visible geometry as parametric CAD. Use its proportions and features.
- Do not claim to see the hidden back, internal structure or exact scale. State those assumptions in the message.
- A known dimension or scale note in the brief overrides visual estimates.

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
Keep the design intent and parameter names. Fix the syntax, geometry, or body-count problem named in the check. If the body count does not match the parts manifest, fasteners are the usual cause: replace tap holes with through clearance holes 0.3–0.5 mm larger than the shank, remove threads from mating parts, and add an axial gap under each head. Every declared instance must be its own body. Do not simplify the model away.`;

const REVIEW_SYSTEM = `${DESIGN_RULES}

You are Cadgo's visual inspector. You receive a reference image and a render of the current OpenSCAD model.
Compare them at a useful level:
- silhouette, proportions and overall orientation;
- missing or extra parts;
- screws, pins or fasteners that stick out, float, are misplaced or are not seated;
- parts that are visibly fused when they should be separate;
- whether the model fits the declared print bed and reads as the reference.

Do not ignore a visible mismatch. Fix the source and return the complete corrected OpenSCAD program and parts manifest via create_scad.
Focus only on the physical object in the reference. Ignore UI chrome, labels, background and screenshot borders; if the reference is a photo, ignore the room and hands.
Preserve requested dimensions and the reference's geometry. If the render already matches, return the source unchanged with a short message that the visual check passed.
If the reference angle hides a face, do not invent it; state the assumption. Do not claim a visual match you cannot see.`;

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

function parseParts(raw: Record<string, unknown>): ScadPart[] {
  const entries = Array.isArray(raw.parts) ? raw.parts : [];
  const merged = new Map<string, number>();
  for (const entry of entries) {
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
  return result.length ? result : [{ name: "Body", quantity: 1 }];
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
  const subject =
    typeof raw.subject === "string" && raw.subject.trim()
      ? raw.subject.trim().slice(0, 120)
      : prompt.slice(0, 80);
  return {
    subject,
    interpretation:
      typeof raw.interpretation === "string" && raw.interpretation.trim()
        ? raw.interpretation.trim().slice(0, 900)
        : prompt.slice(0, 300),
    parts: [...new Set(parts.filter(Boolean))].slice(0, 12),
    lookups: [...new Set(lookups.map((item) => item.trim()))].slice(0, 3),
    dimensions: dimensions.slice(0, 16),
    imageNotes:
      typeof raw.image_observations === "string" ? raw.image_observations.trim().slice(0, 700) : "",
    unknowns:
      typeof raw.unknowns === "string" ? raw.unknowns.trim().slice(0, 500) : "",
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
    temperature,
    max_tokens: maxTokens,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
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
  return callModel(MODEL, messages, temperature, signal, sessionId, tools, maxTokens);
}

function profileBrief(profile?: PrintProfile) {
  if (!profile) return "PRINT PROFILE: not set. Do not claim the model is print-ready.";
  const bed = profile.bed;
  return [
    `PURPOSE: ${profile.purpose}`,
    profile.printer ? `PRINTER: ${profile.printer}` : "",
    bed ? `BUILD VOLUME: ${bed.x} x ${bed.y} x ${bed.z} mm` : "BUILD VOLUME: not set",
    profile.material ? `MATERIAL: ${profile.material}` : "",
    profile.supports ? `SUPPORTS: ${profile.supports}` : "",
    profile.scaleNote ? `KNOWN SCALE / DIMENSION: ${profile.scaleNote}` : "",
  ].filter(Boolean).join("\n");
}

function userContent(text: string, image?: StudioImage): string | ContentPart[] {
  if (!image) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: image.dataUrl } },
  ];
}

function multiImageContent(text: string, images: { dataUrl: string }[]): string | ContentPart[] {
  if (!images.length) return text;
  return [
    { type: "text", text },
    ...images.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } })),
  ];
}

async function planDesign(
  prompt: string,
  options: GenerateOptions,
  sessionId: string,
  signal: AbortSignal,
) {
  const imageNote = options.image
    ? "An image is attached. Inspect it for shape, proportions, visible features, scale clues and hidden sides."
    : "No image is attached.";
  const response = await runModel(
    [
      { role: "system", content: PLANNER_SYSTEM },
      {
        role: "user",
        content: userContent(
          `BRIEF: ${prompt}\n\n${profileBrief(options.profile)}\n\nIMAGE: ${imageNote}\n\nReturn the planning JSON now.`,
          options.image,
        ),
      },
    ],
    0.2,
    signal,
    sessionId,
    [],
    3500,
  );
  const content = Array.isArray(response.message.content) ? "" : response.message.content ?? "";
  return normalizePlan(content, prompt);
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

function lookupQueries(
  prompt: string,
  plan: DesignPlan,
  profile?: PrintProfile,
  image?: StudioImage,
) {
  const queries = [...plan.lookups];
  if (profile?.printer) {
    queries.unshift(`${profile.printer} build volume print bed size`);
  } else if (profile?.purpose === "3d-print") {
    queries.push("FDM 3D printing minimum wall thickness overhang clearance guidelines");
  }
  if (!queries.length && image) {
    queries.push(`${plan.subject || prompt.slice(0, 80)} dimensions design reference`);
  }
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
        let value = await webLookup(query);
        if (!value.results.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          value = await webLookup(query);
        }
        return value;
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
  options: GenerateOptions = {},
): Promise<ScadArtifact> {
  const profileKey = options.profile
    ? `${options.profile.purpose}:${options.profile.printer ?? ""}:${options.profile.bed?.x ?? ""}x${options.profile.bed?.y ?? ""}x${options.profile.bed?.z ?? ""}:${options.profile.material ?? ""}:${options.profile.scaleNote ?? ""}`
    : "no-profile";
  const key = `scad:${prompt.trim().toLowerCase()}:${profileKey}`;
  const canCache = !options.image;
  if (canCache) {
    const hit = cache.get(key);
    if (hit) return { ...hit, ms: 0 };
  }
  const started = Date.now();
  const runSignal = signal ?? new AbortController().signal;
  const plan = await planDesign(prompt, options, sessionId, runSignal);
  const queries = lookupQueries(prompt, plan, options.profile, options.image);
  const research = queries.length
    ? await researchReferences(queries)
    : { sources: [], text: "No external lookup was requested. Use stated assumptions and say so." };
  const planBlock = JSON.stringify(
    {
      subject: plan.subject,
      interpretation: plan.interpretation,
      image_observations: plan.imageNotes,
      unknowns: plan.unknowns,
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
        content: userContent(
          `BRIEF: ${prompt}\n\n${profileBrief(options.profile)}\n\nAPPROVED PLAN:\n${planBlock}\n\nREFERENCE RESEARCH:\n${research.text}\n\nBuild every planned part as a separate body. The attached image is the reference; match its visible geometry and proportions where the plan supports it. Call create_scad once with the complete source and the matching parts manifest.`,
          options.image,
        ),
      },
    ],
    sessionId,
    runSignal,
    research.sources,
    started,
  );
  if (canCache) {
    cache.set(key, artifact);
    if (cache.size > 32) cache.delete(cache.keys().next().value as string);
  }
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

export async function reviewScad(input: {
  code: string;
  parts: ScadPart[];
  prompt: string;
  profile?: PrintProfile;
  referenceImage?: string;
  render: string;
  metrics: string;
  sessionId: string;
  signal?: AbortSignal;
}): Promise<ScadArtifact> {
  const started = Date.now();
  const images = [
    input.referenceImage ? { dataUrl: input.referenceImage, label: "REFERENCE IMAGE" } : null,
    { dataUrl: input.render, label: "CURRENT MODEL RENDER" },
  ].filter((item): item is { dataUrl: string; label: string } => Boolean(item));
  const partsText = input.parts.map((part) => `${part.name} x${part.quantity}`).join(", ") || "not declared";
  const labels = images.map((item, index) => `Image ${index + 1}: ${item.label}`).join("\n");
  return buildArtifact(
    [
      { role: "system", content: REVIEW_SYSTEM },
      {
        role: "user",
        content: multiImageContent(
          `BRIEF: ${input.prompt}\n\n${profileBrief(input.profile)}\n\nDECLARED PARTS: ${partsText}\n\nMEASURED MESH: ${input.metrics}\n\n${labels}\n\nCURRENT OPENSCAD SOURCE:\n${input.code.slice(0, 60000)}\n\nCompare the reference and the render. Correct visible geometry errors and return the complete source and matching parts manifest via create_scad.`,
          images,
        ),
      },
    ],
    input.sessionId,
    input.signal ?? new AbortController().signal,
    [],
    started,
  );
}
