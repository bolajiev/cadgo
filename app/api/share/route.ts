import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/ai/limit";
import { decodeDocumentShare } from "@/lib/studio/document/serialize";
import { createShareStorage, shareTtlMs } from "@/lib/share/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

const RATE_LIMIT = positiveInt(process.env.CADGO_SHARE_RATE_LIMIT, 30);
const RATE_WINDOW_MS = positiveInt(process.env.CADGO_SHARE_RATE_WINDOW_MS, 60 * 60 * 1000);
const schema = z.object({
  payload: z.string().min(10).max(2_000_000),
});

export async function POST(request: Request) {
  if (RATE_LIMIT > 0) {
    const limit = await rateLimit(clientKey(request, "share"), RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.ok) {
      return Response.json(
        { error: "Share creation is rate-limited. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "A compressed Cadgo document is required." }, { status: 400 });
  }

  const document = decodeDocumentShare(`#d=${parsed.data.payload}`);
  if (!document) {
    return Response.json({ error: "This is not a valid Cadgo document." }, { status: 400 });
  }

  const storage = createShareStorage();
  if (!storage) {
    return Response.json(
      {
        error:
          "Large-share storage is not configured on this deployment. Set BLOB_READ_WRITE_TOKEN or export the ZIP/JSON.",
      },
      { status: 503 },
    );
  }

  try {
    const record = await storage.put(parsed.data.payload, shareTtlMs());
    return Response.json(
      {
        id: record.id,
        path: `/studio?share=${record.id}`,
        expiresAt: record.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("share creation failed", error);
    return Response.json({ error: "Could not store this share." }, { status: 500 });
  }
}
