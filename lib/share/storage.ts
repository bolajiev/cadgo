import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export type ShareRecord = {
  id: string;
  payload: string;
  createdAt: string;
  expiresAt: string;
};

export type ShareStorage = {
  put(payload: string, ttlMs: number): Promise<ShareRecord>;
  get(id: string): Promise<ShareRecord | null>;
};

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export function isShareId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function newShareId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

export function shareTtlMs(): number {
  const days = Number(process.env.CADGO_SHARE_TTL_DAYS ?? 30);
  return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60 * 1000;
}

const DEFAULT_SHARE_DIR = path.join(process.cwd(), ".data", "shares");

export function localShareStorage(directory = process.env.CADGO_SHARE_DIR ?? DEFAULT_SHARE_DIR): ShareStorage {
  const root = path.resolve(/* turbopackIgnore: true */ directory);
  const fileFor = (id: string) => path.join(root, `${id}.json`);

  return {
    async put(payload, ttlMs) {
      await mkdir(root, { recursive: true });
      const now = Date.now();
      const record: ShareRecord = {
        id: newShareId(),
        payload,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
      };
      await writeFile(fileFor(record.id), JSON.stringify(record), "utf8");
      return record;
    },
    async get(id) {
      if (!isShareId(id)) return null;
      try {
        const record = JSON.parse(await readFile(fileFor(id), "utf8")) as ShareRecord;
        if (record.id !== id) return null;
        if (new Date(record.expiresAt).getTime() <= Date.now()) {
          await unlink(fileFor(id)).catch(() => {});
          return null;
        }
        return record;
      } catch {
        return null;
      }
    },
  };
}

export function blobShareStorage(token: string): ShareStorage {
  const pathname = (id: string) => `cadgo-shares/${id}.json`;

  return {
    async put(payload, ttlMs) {
      const { put } = await import("@vercel/blob");
      const now = Date.now();
      const record: ShareRecord = {
        id: newShareId(),
        payload,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
      };
      await put(pathname(record.id), JSON.stringify(record), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        token,
      });
      return record;
    },
    async get(id) {
      if (!isShareId(id)) return null;
      const { get, del } = await import("@vercel/blob");
      try {
        const result = await get(pathname(id), { access: "public", token });
        if (!result || result.statusCode !== 200) return null;
        const record = JSON.parse(await new Response(result.stream).text()) as ShareRecord;
        if (record.id !== id) return null;
        if (new Date(record.expiresAt).getTime() <= Date.now()) {
          await del(pathname(id), { token }).catch(() => {});
          return null;
        }
        return record;
      } catch {
        return null;
      }
    },
  };
}

export function createShareStorage(): ShareStorage | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return blobShareStorage(token);
  if (process.env.VERCEL) return null;
  return localShareStorage();
}
