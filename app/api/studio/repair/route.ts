import { z } from "zod";
import { repairScad, ScadError } from "@/lib/ai/scad";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  code: z.string().min(10).max(60000),
  error: z.string().min(2).max(6000),
  sessionId: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "studio-repair"), 120, 60 * 60 * 1000);
  if (!limit.ok) return Response.json({ error: "The repair bench is rate-limited for this hour." }, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Code and compiler log are required." }, { status: 400 });
  const sessionId = parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  try {
    const result = await repairScad(parsed.data.code, parsed.data.error, sessionId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio repair failed", error);
    return Response.json({ error: "The repair hit an unexpected fault." }, { status: 500 });
  }
}
