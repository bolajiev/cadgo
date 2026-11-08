export const COMPILER_VERSION = "openscad-2025.03-manifold-v1";

export function stableParams(params: Record<string, number | boolean>): string {
  const keys = Object.keys(params).sort();
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, params[key]])));
}

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fall through to the deterministic FNV hash.
    }
  }
  let hash = 2166136261;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv-${(hash >>> 0).toString(16)}`;
}

export async function compileKey(
  source: string,
  params: Record<string, number | boolean>,
  library = "",
): Promise<string> {
  return hashText(
    `${COMPILER_VERSION}\n${library}\n${source}\n${stableParams(params)}`,
  );
}

export class LruCache<T> {
  private values = new Map<string, T>();

  constructor(private limit: number) {
    if (!Number.isFinite(limit) || limit < 1) throw new Error("LRU limit must be at least 1.");
  }

  get(key: string): T | undefined {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.values.has(key)) this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  delete(key: string): boolean {
    return this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }

  get size(): number {
    return this.values.size;
  }

  keys(): string[] {
    return [...this.values.keys()];
  }
}
