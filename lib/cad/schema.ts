import { z } from "zod";
import type { CadSpec, CsgNode } from "./types";

const exprSchema = z.union([
  z.number(),
  z.string().min(1),
  z.object({ expr: z.string().min(1) }),
]);

const vec3Schema = z.tuple([exprSchema, exprSchema, exprSchema]);

const profileSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    width: exprSchema,
    height: exprSchema,
    radius: exprSchema.optional(),
  }),
  z.object({
    type: z.literal("circle"),
    radius: exprSchema,
  }),
  z.object({
    type: z.literal("polygon"),
    points: z.array(z.tuple([exprSchema, exprSchema])).min(3).max(64),
  }),
]);

export const csgSchema: z.ZodType<CsgNode> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({
      op: z.literal("box"),
      size: vec3Schema,
      center: z.boolean().optional(),
    }),
    z.object({
      op: z.literal("cylinder"),
      radius: exprSchema,
      height: exprSchema,
      segments: z.number().int().min(3).max(160).optional(),
      center: z.boolean().optional(),
    }),
    z.object({
      op: z.literal("cone"),
      radiusBottom: exprSchema,
      radiusTop: exprSchema,
      height: exprSchema,
      segments: z.number().int().min(3).max(160).optional(),
      center: z.boolean().optional(),
    }),
    z.object({
      op: z.literal("sphere"),
      radius: exprSchema,
      segments: z.number().int().min(3).max(128).optional(),
    }),
    z.object({
      op: z.literal("extrude"),
      profile: profileSchema,
      height: exprSchema,
      center: z.boolean().optional(),
      twist: exprSchema.optional(),
      scaleTop: exprSchema.optional(),
    }),
    z.object({
      op: z.literal("revolve"),
      profile: z.array(z.tuple([exprSchema, exprSchema])).min(3).max(120),
      segments: z.number().int().min(3).max(160).optional(),
    }),
    z.object({
      op: z.literal("union"),
      a: csgSchema,
      b: csgSchema,
    }),
    z.object({
      op: z.literal("difference"),
      a: csgSchema,
      b: csgSchema,
    }),
    z.object({
      op: z.literal("intersection"),
      a: csgSchema,
      b: csgSchema,
    }),
    z.object({
      op: z.literal("translate"),
      by: vec3Schema,
      child: csgSchema,
    }),
    z.object({
      op: z.literal("rotate"),
      degrees: vec3Schema,
      child: csgSchema,
    }),
    z.object({
      op: z.literal("mirror"),
      normal: vec3Schema,
      child: csgSchema,
    }),
    z.object({
      op: z.literal("pattern"),
      child: csgSchema,
      count: z.number().int().min(2).max(24),
      mode: z.enum(["linear", "circular"]),
      step: vec3Schema.optional(),
      axis: z.enum(["x", "y", "z"]).optional(),
      center: vec3Schema.optional(),
    }),
    z.object({
      op: z.literal("bolt"),
      diameter: exprSchema,
      length: exprSchema,
      headDiameter: exprSchema.optional(),
      headHeight: exprSchema.optional(),
    }),
  ]),
) as z.ZodType<CsgNode>;

const parameterSchema = z.object({
  id: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  value: z.number().finite(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  unit: z.string().optional(),
});

const partSchema = z.object({
  id: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  name: z.string().min(1),
  material: z.enum([
    "aluminium",
    "anodised",
    "brass",
    "steel",
    "rubber",
    "wood",
    "accent",
    "bulb",
  ]),
  position: vec3Schema,
  rotation: vec3Schema.optional(),
  shape: csgSchema,
  hidden: z.boolean().optional(),
});

const jointSchema = z.object({
  id: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  name: z.string().min(1),
  parent: z.union([z.string(), z.literal("world")]),
  child: z.string(),
  type: z.enum(["revolute", "prismatic", "fixed"]),
  origin: vec3Schema,
  axis: vec3Schema.optional(),
  limits: z.tuple([z.number().finite(), z.number().finite()]).optional(),
  value: z.number().finite().optional(),
  unit: z.enum(["deg", "mm"]).optional(),
});

const demoStepSchema = z.object({
  joint: z.string(),
  to: z.number().finite(),
  duration: z.number().min(80).max(5000),
  hold: z.number().min(0).max(5000).optional(),
});

export const cadSpecSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  subtitle: z.string().max(160).optional(),
  units: z.literal("mm"),
  parameters: z.array(parameterSchema).max(24),
  parts: z.array(partSchema).min(1).max(16),
  joints: z.array(jointSchema).max(16).default([]),
  demo: z.array(demoStepSchema).max(24).optional(),
  notes: z.array(z.string().max(240)).max(8).optional(),
  sourcePrompt: z.string().max(2000).optional(),
}) as z.ZodType<CadSpec>;

export const generateRequestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  sessionId: z.string().max(120).optional(),
});

export const editRequestSchema = z.object({
  spec: cadSpecSchema,
  message: z.string().min(2).max(1000),
  selectedPartId: z.string().optional(),
  selection: z
    .object({
      partId: z.string(),
      point: z.tuple([z.number(), z.number(), z.number()]),
      normal: z.tuple([z.number(), z.number(), z.number()]),
    })
    .optional(),
  sessionId: z.string().max(120).optional(),
});

export function parseSpec(value: unknown): CadSpec {
  return cadSpecSchema.parse(value);
}
