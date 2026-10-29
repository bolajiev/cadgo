import type { CadSpec } from "@/lib/cad/types";

const expr = {
  anyOf: [{ type: "number" }, { type: "string" }],
  description: "A number, or an expression string referencing parameters, e.g. 'arm_len * 0.6'.",
};

const vec3 = {
  type: "array",
  minItems: 3,
  maxItems: 3,
  items: expr,
};

const parameter = {
  type: "object",
  properties: {
    id: { type: "string", description: "snake_case identifier used in expressions" },
    label: { type: "string" },
    value: { type: "number" },
    min: { type: "number" },
    max: { type: "number" },
    unit: { type: "string", enum: ["mm", "deg"] },
  },
  required: ["id", "label", "value"],
};

const part = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    material: {
      type: "string",
      enum: ["aluminium", "anodised", "brass", "steel", "rubber", "wood", "accent", "bulb"],
    },
    position: vec3,
    rotation: vec3,
    shape: {
      type: "object",
      description:
        "A CSG tree in the part's local frame. Nodes are objects with an 'op' field: " +
        "'box' {size:[x,y,z], center?}; 'cylinder' {radius,height,segments?,center?} axis Z; " +
        "'cone' {radiusBottom,radiusTop,height}; 'sphere' {radius}; " +
        "'extrude' {profile:{type:'rect',width,height,radius?}|{type:'circle',radius}|{type:'polygon',points:[[x,y],...]}, height, center?, twist?, scaleTop?} along Z; " +
        "'revolve' {profile:[[radius,z],...], segments?} around Z; " +
        "'union'|'difference'|'intersection' {a,b}; 'translate' {by:[x,y,z],child}; 'rotate' {degrees:[x,y,z],child}; 'mirror' {normal:[x,y,z],child}; " +
        "'pattern' {child,count,mode:'linear'|'circular',step?:[x,y,z],center?:[x,y,z],axis?:'x'|'y'|'z'}; " +
        "'bolt' {diameter,length,headDiameter?,headHeight?}. " +
        "All dimensions are millimetres. Box/cylinder/extrude are centered by default. " +
        "Every string may be an expression such as 'arm_len * 0.5'. " +
        "Example: {\"op\":\"difference\",\"a\":{\"op\":\"box\",\"size\":[120,60,10]},\"b\":{\"op\":\"pattern\",\"mode\":\"linear\",\"count\":2,\"step\":[80,0,0],\"child\":{\"op\":\"translate\",\"by\":[-40,0,0],\"child\":{\"op\":\"cylinder\",\"radius\":4,\"height\":30}}}}.",
    },
    hidden: { type: "boolean" },
  },
  required: ["id", "name", "material", "position", "shape"],
};

const joint = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    parent: { type: "string", description: "part id, or 'world'" },
    child: { type: "string" },
    type: { type: "string", enum: ["revolute", "prismatic", "fixed"] },
    origin: vec3,
    axis: vec3,
    limits: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "number" },
      description: "In degrees for revolute, millimetres for prismatic. Include 0.",
    },
    value: { type: "number" },
    unit: { type: "string", enum: ["deg", "mm"] },
  },
  required: ["id", "name", "parent", "child", "type", "origin"],
};

const demoStep = {
  type: "object",
  properties: {
    joint: { type: "string" },
    to: { type: "number" },
    duration: { type: "number" },
    hold: { type: "number" },
  },
  required: ["joint", "to", "duration"],
};

export const cadSpecTool = {
  type: "function",
  function: {
    name: "create_spec",
    description: "Return a complete, validated CadSpec for a browser CAD kernel.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short product name, e.g. 'Springline desk lamp'" },
        subtitle: { type: "string" },
        units: { type: "string", enum: ["mm"] },
        parameters: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: parameter,
        },
        parts: {
          type: "array",
          minItems: 1,
          maxItems: 14,
          items: part,
        },
        joints: {
          type: "array",
          minItems: 0,
          maxItems: 14,
          items: joint,
        },
        demo: {
          type: "array",
          minItems: 0,
          maxItems: 20,
          items: demoStep,
        },
        notes: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
        },
        message: {
          type: "string",
          description: "One short sentence to the user about what was drafted.",
        },
      },
      required: ["name", "units", "parameters", "parts", "joints", "demo", "notes", "message"],
    },
  },
};

export const CSG_COOKBOOK = `
CADGO CAD SPEC — DESIGN CONTRACT

World: millimetres, Z up, front is -Y. The assembly rests on Z=0 after cleanup.
A part's shape is a CSG tree in its own local frame. Its position (and optional rotation in degrees, XYZ) places the part in the world at rest. Do not bake world placement into the shape.
Prefer a logical local origin for moving parts: put the hinge eye or sliding collar at the part origin so the joint is easy to read.
A joint's origin and axis are in world-at-rest coordinates. For a revolute joint, the child rotates around the axis through the origin. For a prismatic joint, it translates along the axis. The graph must be a tree: every child has exactly one parent joint, and fixed joints attach hardware.
The joint value 0 must be the rest pose. Limits must include 0. A typical hinge has limits like [-35, 65].
Parts must meet: hinge eye around a boss, a pin through a hole, a guide rod through a bore, a foot under a base. Never leave a moving part floating.

CSG vocabulary:
- box {size:[x,y,z], center?} — centered by default.
- cylinder {radius,height,segments?,center?} — axis Z, centered by default.
- cone {radiusBottom,radiusTop,height} — axis Z.
- sphere {radius}.
- extrude {profile,height,center?,twist?,scaleTop?} — profile in XY, extruded along Z.
  profile = {type:'rect',width,height,radius?} | {type:'circle',radius} | {type:'polygon',points:[[x,y],...]}.
- revolve {profile:[[radius,z],...],segments?} — a closed profile revolved around Z. Radius is the first value. Use this for bases, collars, shade shells, knobs.
- union/difference/intersection {a,b}.
- translate {by:[x,y,z],child}; rotate {degrees:[x,y,z],child}; mirror {normal:[x,y,z],child}.
- pattern {child,count,mode,step?,center?,axis?} — 'linear' repeats along step; 'circular' rotates the child around center (default origin) about the chosen axis.
- bolt {diameter,length,headDiameter?,headHeight?} — a cosmetic hex-head bolt along Z.

Expressions: any numeric field may be a string such as "arm_len * 0.6", "base_d / 2", "shoulder_z - 18". Supported: + - * / % ^, parentheses, min, max, abs, sqrt, round, floor, ceil, sin, cos, tan, pow, pi. Angles for sin/cos/tan are degrees. Reference only declared parameters. Keep expressions short and readable.

DETAIL RULES:
- 3–8 parts is the sweet spot; 14 max. 1–5 moving joints. Add fixed joints for knobs, feet, bulbs, pins.
- Give every part at least one real feature: a hinge bore, guide bore, lightening holes, a rim, a boss, a bolt, a groove, a pattern of holes. Avoid plain unfeatured boxes.
- Use revolve for round bodies and shells: a base profile with a fillet-like curve, a shade with wall thickness, a knob with a stepped profile.
- Holes must be slightly larger than the pin (0.2–0.5 mm clearance). A hinge eye is a cylinder of the arm material with a bore.
- Model hinge bosses/pins as separate brass or steel parts so the joint reads.
- Keep the silhouette legible from an isometric view. Put the main motion in the XZ or XY plane, with axes on X, Y or Z.
- No text, no logos, no floating decorations. No parts below Z=0 (the base sits on the floor).

MOTION:
- Demo steps must be ordered, use joints that exist, stay within limits, and return near rest. 500–1200 ms per move.
- Use notes to explain the mechanism in 2–4 short lines.
`;

export function generationSystemPrompt(specs: CadSpec[]) {
  const examples = specs
    .map(
      (spec, index) =>
        `REFERENCE ${index + 1} (format and craft reference only — do not copy its subject):\n${JSON.stringify(spec)}`,
    )
    .join("\n\n");
  return `You are Cadgo's design compiler. You turn a plain-language brief into a complete CadSpec for a browser CAD kernel.

${CSG_COOKBOOK}

You must call the create_spec tool exactly once with the complete assembly. The spec is data, never code. Do not reply with prose. Design a real, buildable mechanism, not an abstract shape. If the brief names a function, make the motion visible and explain it with joints. If dimensions are missing, choose believable millimetre values. Prefer a compact object with a clear silhouette. The user is watching a 3D viewport, so give the model a good resting pose and a demo that shows what it does.

${examples}

DESIGN THE BRIEF. Do not copy a reference subject. Keep part ids short and stable. The message field is one sentence. The notes field holds 2–4 specific mechanical observations.`;
}

export function editSystemPrompt() {
  return `You are Cadgo's revision compiler. You receive a complete CadSpec and a user request. Return the complete revised CadSpec via the create_spec tool.

${CSG_COOKBOOK}

REVISION RULES:
- Preserve every part, parameter id, joint and note that the user did not ask to change. Keep ids stable.
- Apply the smallest coherent change. If the user asks for a dimension, alter the parameter value or the relevant expression. If the user asks for a feature, add CSG to the right part. If the user asks for a new part or joint, keep the joint graph a tree.
- Never silently delete parts. If a request is geometrically impossible, make the closest safe change and say so in the message.
- The revised spec must still compile, have no cycles, and keep joint values at 0 at rest.
- Return the full spec, not a patch. Do not reply with prose outside the tool.`;
}

export function userBrief(prompt: string) {
  return `BRIEF: ${prompt}\n\nDraft the assembly now. Call create_spec once.`;
}

export function revisionBrief(spec: CadSpec, message: string, selectedPartId?: string | null) {
  return `CURRENT CADSPEC:\n${JSON.stringify(spec)}\n\nSELECTED PART: ${selectedPartId ?? "none"}\n\nUSER REQUEST: ${message}\n\nReturn the complete revised spec via create_spec.`;
}
