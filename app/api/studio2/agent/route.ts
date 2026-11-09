import { z } from "zod";
import { AgentError } from "@/lib/ai/agent";
import { runAgentTurnV2, streamAgentTurnV2 } from "@/lib/ai/agent2";
import { clientKey, rateLimit } from "@/lib/ai/limit";

export const runtime = "nodejs";
export const maxDuration = 300;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

const SESSION_RATE_LIMIT = positiveInt(process.env.CADGO_AGENT_RATE_LIMIT, 0);
const IP_RATE_LIMIT = positiveInt(process.env.CADGO_AGENT_IP_RATE_LIMIT, 0);
const RATE_WINDOW_MS = positiveInt(process.env.CADGO_AGENT_RATE_WINDOW_MS, 60 * 60 * 1000);

// Explicit limiter namespaces: one budget per browser session (x-cadgo-session),
// plus a higher per-IP budget that guards the whole host against abuse.
const SESSION_SCOPE = "studio2-agent:session";
const IP_SCOPE = "studio2-agent:ip";

function sessionSubject(request: Request) {
  return (request.headers.get("x-cadgo-session") ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function rateLimited(reset: number) {
  const remainingMs = Math.max(0, reset - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return Response.json(
    { error: `The CAD agent is rate-limited by the server configuration. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(remainingMs / 1000))) } },
  );
}

const schema = z.object({
  messages: z.array(z.unknown()).min(1).max(80),
  modelState: z.string().max(200_000).optional(),
  sessionId: z.string().max(120).optional(),
  stream: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (IP_RATE_LIMIT > 0) {
    const ipLimit = await rateLimit(clientKey(request, IP_SCOPE), IP_RATE_LIMIT, RATE_WINDOW_MS);
    if (!ipLimit.ok) return rateLimited(ipLimit.reset);
  }
  if (SESSION_RATE_LIMIT > 0) {
    const sessionLimit = await rateLimit(
      clientKey(request, SESSION_SCOPE, sessionSubject(request)),
      SESSION_RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!sessionLimit.ok) return rateLimited(sessionLimit.reset);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "A conversation is required." }, { status: 400 });
  const sessionId =
    parsed.data.sessionId?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  try {
    if (parsed.data.stream) {
      const body = streamAgentTurnV2(
        parsed.data.messages as never,
        sessionId,
        request.signal,
        parsed.data.modelState ?? "",
      );
      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const result = await runAgentTurnV2(parsed.data.messages as never, sessionId, request.signal, parsed.data.modelState ?? "");
    return Response.json(result);
  } catch (error) {
    if (error instanceof AgentError) return Response.json({ error: error.message }, { status: error.status });
    console.error("studio2 agent failed", error);
    return Response.json({ error: "The CAD agent hit an unexpected fault." }, { status: 500 });
  }
}
