import { z } from "zod";
import { researchWeb } from "@/lib/research/service";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z
  .object({
    query: z.string().trim().max(400).optional(),
    url: z.string().trim().max(1000).optional(),
    depth: z.enum(["quick", "deep"]).optional(),
  })
  .refine((value) => Boolean(value.query?.trim() || value.url?.trim()), {
    message: "A query or URL is required.",
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid research request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid research request." }, { status: 400 });
  }
  const result = await researchWeb(parsed.data);
  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
