import { generateRequestSchema } from "@/lib/cad/schema";
import { DrafterError, generateSpec } from "@/lib/ai/provider";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "generate"), 40, 60 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "The drafting bench is rate-limited for this hour. Load a bench example instead." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "A brief of 3–2000 characters is required." }, { status: 400 });
  }

  const sessionId =
    parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";

  try {
    const result = await generateSpec(parsed.data.prompt, sessionId);
    return Response.json({
      spec: result.spec,
      message: result.message,
      notes: result.notes,
      ms: result.ms,
      attempts: result.attempts,
    });
  } catch (error) {
    if (error instanceof DrafterError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("generate failed", error);
    return Response.json({ error: "The drafter hit an unexpected fault." }, { status: 500 });
  }
}
