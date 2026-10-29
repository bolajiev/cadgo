import { editRequestSchema } from "@/lib/cad/schema";
import { DrafterError, reviseSpec } from "@/lib/ai/provider";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "edit"), 120, 60 * 60 * 1000);
  if (!limit.ok) {
    return Response.json(
      { error: "The revision bench is rate-limited for this hour." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = editRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "A valid CadSpec and a short message are required." }, { status: 400 });
  }

  const sessionId =
    parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";

  try {
    const result = await reviseSpec(
      parsed.data.spec,
      parsed.data.message,
      sessionId,
      parsed.data.selectedPartId,
    );
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
    console.error("edit failed", error);
    return Response.json({ error: "The revision hit an unexpected fault." }, { status: 500 });
  }
}
