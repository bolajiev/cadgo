import { z } from "zod";
import { reviewScad, ScadError } from "@/lib/ai/scad";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const image = z.string().max(4_000_000).refine(
  (value) => /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value),
  "Image must be a PNG, JPEG or WebP data URL.",
);

const schema = z.object({
  code: z.string().min(10).max(60000),
  parts: z.array(z.object({ name: z.string().max(100), quantity: z.number().int().min(1).max(24) })).max(12),
  prompt: z.string().min(3).max(1600),
  profile: z.object({
    purpose: z.enum(["3d-print", "visualization", "cnc", "assembly"]),
    printer: z.string().max(120).optional(),
    bed: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }).optional(),
    material: z.string().max(40).optional(),
    supports: z.enum(["none", "allowed"]).optional(),
    scaleNote: z.string().max(200).optional(),
  }).optional(),
  referenceImage: image.optional(),
  render: image,
  metrics: z.string().max(600),
  sessionId: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "studio-review"), 80, 60 * 60 * 1000);
  if (!limit.ok) {
    return Response.json({ error: "The visual check is rate-limited for this hour." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "The source, render and part manifest are required." }, { status: 400 });
  const sessionId = parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  try {
    const result = await reviewScad({
      code: parsed.data.code,
      parts: parsed.data.parts,
      prompt: parsed.data.prompt,
      profile: parsed.data.profile,
      referenceImage: parsed.data.referenceImage,
      render: parsed.data.render,
      metrics: parsed.data.metrics,
      sessionId,
      signal: request.signal,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio review failed", error);
    return Response.json({ error: "The visual check hit an unexpected fault." }, { status: 500 });
  }
}
