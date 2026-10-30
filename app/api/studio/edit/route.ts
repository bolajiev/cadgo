import { z } from "zod";
import { editScad, ScadError } from "@/lib/ai/scad";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  code: z.string().min(10).max(60000),
  message: z.string().min(2).max(1000),
  parts: z.array(z.string().max(80)).max(12).optional(),
  sessionId: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "studio-edit"), 120, 60 * 60 * 1000);
  if (!limit.ok) return Response.json({ error: "The edit bench is rate-limited for this hour." }, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "The current code and a short request are required." }, { status: 400 });
  const sessionId = parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  try {
    const result = await editScad(parsed.data.code, parsed.data.message, parsed.data.parts ?? [], sessionId, request.signal);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio edit failed", error);
    return Response.json({ error: "The edit hit an unexpected fault." }, { status: 500 });
  }
}
