import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isShareId, localShareStorage } from "../lib/share/storage";

let directory: string | null = null;

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = null;
  }
});

describe("local share storage", () => {
  it("stores and retrieves a compressed document", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "cadgo-share-"));
    const storage = localShareStorage(directory);
    const record = await storage.put("N4Igpayload", 60_000);
    expect(isShareId(record.id)).toBe(true);
    const loaded = await storage.get(record.id);
    expect(loaded?.payload).toBe("N4Igpayload");
  });

  it("rejects unknown, malformed and expired ids", async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "cadgo-share-"));
    const storage = localShareStorage(directory);
    expect(await storage.get("missing123")).toBeNull();
    expect(await storage.get("../etc/passwd")).toBeNull();
    const record = await storage.put("expired", -1);
    expect(await storage.get(record.id)).toBeNull();
  });
});
