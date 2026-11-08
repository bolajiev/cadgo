import { describe, expect, it } from "vitest";
import {
  LruCache,
  compileKey,
  hashText,
  stableParams,
} from "../lib/studio/compile/cache";

describe("compile cache keys", () => {
  it("sorts parameter keys deterministically", () => {
    expect(stableParams({ b: 2, a: 1 })).toBe(stableParams({ a: 1, b: 2 }));
    expect(stableParams({ a: 1, b: false })).toBe('{"a":1,"b":false}');
  });

  it("produces the same key for the same inputs and different keys otherwise", async () => {
    const first = await compileKey("cube([10,10,10]);", { size: 10 }, "");
    const second = await compileKey("cube([10,10,10]);", { size: 10 }, "");
    const changed = await compileKey("cube([12,10,10]);", { size: 10 }, "");
    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it("hashes text to a stable value", async () => {
    const first = await hashText("hello");
    const second = await hashText("hello");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("evicts the least recently used entry", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(cache.size).toBe(2);
  });
});
