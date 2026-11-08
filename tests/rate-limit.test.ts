import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRateLimitStore, RedisRateLimitStore } from "../lib/ai/limit";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MemoryRateLimitStore", () => {
  it("allows requests up to the limit and resets after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const store = new MemoryRateLimitStore();

    const first = await store.hit("session:a", 2, 1000);
    expect(first).toMatchObject({ ok: true, remaining: 1 });

    const second = await store.hit("session:a", 2, 1000);
    expect(second).toMatchObject({ ok: true, remaining: 0 });

    const third = await store.hit("session:a", 2, 1000);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);

    vi.advanceTimersByTime(1001);
    const next = await store.hit("session:a", 2, 1000);
    expect(next.ok).toBe(true);
    expect(next.remaining).toBe(1);
  });

  it("keeps separate buckets per key", async () => {
    const store = new MemoryRateLimitStore();
    expect((await store.hit("a", 1, 1000)).ok).toBe(true);
    expect((await store.hit("b", 1, 1000)).ok).toBe(true);
    expect((await store.hit("a", 1, 1000)).ok).toBe(false);
  });
});

describe("RedisRateLimitStore", () => {
  it("uses the Redis REST pipeline and reports the limit state", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { result: 3 },
        { result: 1 },
        { result: 500 },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const store = new RedisRateLimitStore("https://redis.example.test/", "secret");
    const result = await store.hit("scope:ip", 2, 1000);

    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reset).toBeGreaterThan(Date.now());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example.test/pipeline");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", "scope:ip"],
      ["PEXPIRE", "scope:ip", 1000, "NX"],
      ["PTTL", "scope:ip"],
    ]);
  });

  it("throws when the durable store rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    const store = new RedisRateLimitStore("https://redis.example.test", "secret");
    await expect(store.hit("scope:ip", 2, 1000)).rejects.toThrow(/HTTP 503/);
  });
});
