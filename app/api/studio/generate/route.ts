import { z } from "zod";
import { generateScad, ScadError } from "@/lib/ai/scad";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const imageSchema = z.object({
  dataUrl: z.string().max(4_000_000).refine(
    (value) => /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value),
    "Image must be a PNG, JPEG or WebP data URL.",
  ),
  name: z.string().max(120),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
});

const profileSchema = z.object({
  purpose: z.enum(["3d-print", "visualization", "cnc", "assembly"]),
  printer: z.string().max(120).optional(),
  bed: z.object({
    x: z.number().positive().max(2000),
    y: z.number().positive().max(2000),
    z: z.number().positive().max(2000),
  }).optional(),
  material: z.string().max(40).optional(),
  supports: z.enum(["none", "allowed"]).optional(),
});

const schema = z.object({
  prompt: z.string().min(3).max(1600),
  image: imageSchema.optional(),
  profile: profileSchema.optional(),
  sessionId: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "studio-generate"), 40, 60 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "The design compiler is rate-limited for this hour. Load an example instead." },
      { status: 429 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "A short part description is required." }, { status: 400 });
  const sessionId = parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  try {
    const result = await generateScad(parsed.data.prompt, sessionId, request.signal, {
      image: parsed.data.image,
      profile: parsed.data.profile,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio generate failed", error);
    return Response.json({ error: "The design compiler hit an unexpected fault." }, { status: 500 });
  }
}
