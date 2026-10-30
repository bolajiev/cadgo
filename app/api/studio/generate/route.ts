import { z } from "zod";
import { generateScad, ScadError } from "@/lib/ai/scad";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  prompt: z.string().min(3).max(1600),
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
    const result = await generateScad(parsed.data.prompt, sessionId, request.signal);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio generate failed", error);
    return Response.json({ error: "The design compiler hit an unexpected fault." }, { status: 500 });
  }
}
