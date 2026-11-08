import { createShareStorage, isShareId } from "@/lib/share/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isShareId(id)) return Response.json({ error: "Share not found." }, { status: 404 });

  const storage = createShareStorage();
  if (!storage) {
    return Response.json(
      {
        error:
          "Large-share storage is not configured on this deployment. Set BLOB_READ_WRITE_TOKEN or use the ZIP/JSON export.",
      },
      { status: 503 },
    );
  }

  try {
    const record = await storage.get(id);
    if (!record) return Response.json({ error: "Share not found or expired." }, { status: 404 });
    return Response.json(
      { payload: record.payload, createdAt: record.createdAt, expiresAt: record.expiresAt },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    console.error("share lookup failed", error);
    return Response.json({ error: "Could not read this share." }, { status: 500 });
  }
}
