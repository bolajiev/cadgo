type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: max - 1, reset: now + windowMs };
  }
  if (bucket.count >= max) {
    return { ok: false, remaining: 0, reset: bucket.reset };
  }
  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count, reset: bucket.reset };
}

export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local";
  return `${scope}:${ip}`;
}
