export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset: number;
};

export type RateLimitStore = {
  hit(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
};

type Bucket = { count: number; reset: number };

/**
 * The local/development implementation. It is process-local, so a
 * multi-instance deployment should configure the Upstash/Vercel KV adapter.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  async hit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.reset < now) {
      const reset = now + windowMs;
      this.buckets.set(key, { count: 1, reset });
      return { ok: true, remaining: Math.max(0, max - 1), reset };
    }
    if (bucket.count >= max) {
      return { ok: false, remaining: 0, reset: bucket.reset };
    }
    bucket.count += 1;
    return { ok: true, remaining: Math.max(0, max - bucket.count), reset: bucket.reset };
  }
}

/**
 * A durable adapter for Upstash Redis or Vercel KV. Both expose the same
 * Redis REST pipeline API. No SDK is needed: the adapter uses fetch.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async hit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs, "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      throw new Error(`The durable rate-limit store returned HTTP ${response.status}.`);
    }
    const data = (await response.json()) as { result?: unknown; error?: string }[];
    const count = Number(data[0]?.result);
    const ttl = Number(data[2]?.result);
    if (!Number.isFinite(count)) {
      throw new Error(data[0]?.error ?? "The durable rate-limit store returned no count.");
    }
    const reset = Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs);
    return { ok: count <= max, remaining: Math.max(0, max - count), reset };
  }
}

const memoryStore = new MemoryRateLimitStore();
let configuredStore: RateLimitStore | null = null;

export function rateLimitStore(): RateLimitStore {
  if (configuredStore) return configuredStore;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  configuredStore = url && token ? new RedisRateLimitStore(url, token) : memoryStore;
  return configuredStore;
}

/**
 * Rate-limit through the configured store. If a durable store is configured
 * but temporarily unavailable, fall back to the in-process bucket rather than
 * blocking every request; the failure is logged so it is not silent.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    return await rateLimitStore().hit(key, max, windowMs);
  } catch (error) {
    console.error("Rate-limit store failed; using the in-process fallback.", error);
    return memoryStore.hit(key, max, windowMs);
  }
}

export function clientKey(request: Request, scope: string, subject?: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local";
  const safeSubject = (subject ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return `${scope}:${ip}:${safeSubject || "anonymous"}`;
}
