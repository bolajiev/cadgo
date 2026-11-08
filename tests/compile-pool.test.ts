import { describe, expect, it } from "vitest";
import { CompilePool } from "../lib/studio/compile/pool";
import type { CompileRequest } from "../lib/studio/compile/types";
import type { CompileWorker, WorkerCompileResult } from "../lib/studio/compile/worker";
import { CompileError } from "../lib/studio/compile/worker";

function fakeMesh() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    colors: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    triangles: 1,
    bounds: { min: [0, 0, 0] as [number, number, number], max: [1, 1, 0] as [number, number, number] },
    components: 1,
    floating: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    volume: 1,
    surfaceArea: 1,
    overhangArea: 0,
    overhangPercent: 0,
    componentIds: new Uint32Array([0]),
  };
}

class FakeWorker implements CompileWorker {
  calls: CompileRequest[] = [];
  active = 0;
  maxActive = 0;
  terminated = false;
  private pending: {
    resolve: (result: WorkerCompileResult) => void;
    reject: (error: Error) => void;
  }[] = [];

  compile(request: CompileRequest): Promise<WorkerCompileResult> {
    this.calls.push(request);
    this.active++;
    this.maxActive = Math.max(this.maxActive, this.active);
    return new Promise<WorkerCompileResult>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  resolveNext() {
    const pending = this.pending.shift();
    if (!pending) throw new Error("No pending compile");
    this.active--;
    pending.resolve({ mesh: fakeMesh(), logs: "", duration: 1 });
  }

  rejectNext(error: Error) {
    const pending = this.pending.shift();
    if (!pending) throw new Error("No pending compile");
    this.active--;
    pending.reject(error);
  }

  terminate() {
    this.terminated = true;
    const pending = this.pending.splice(0);
    for (const item of pending) item.reject(new CompileError("worker terminated"));
    this.active = 0;
  }
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => boolean, timeoutMs = 2000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for condition");
    await wait(10);
  }
}

function makePool(size = 1, timeoutMs = 1000) {
  const workers: FakeWorker[] = [];
  const pool = new CompilePool({
    size,
    timeoutMs,
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { pool, workers };
}

const request = (source: string): CompileRequest => ({
  source,
  params: {},
  library: "",
});

describe("compile pool", () => {
  it("returns a compiled variant and caches it", async () => {
    const { pool, workers } = makePool();
    const pending = pool.compile(request("cube([10,10,10]);"));
    await waitFor(() => workers[0].calls.length === 1);
    workers[0].resolveNext();
    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.metrics.triangles).toBe(1);

    const cached = await pool.compile(request("cube([10,10,10]);"));
    expect(cached.ok).toBe(true);
    expect(workers[0].calls).toHaveLength(1);
    pool.dispose();
  });

  it("deduplicates identical in-flight requests", async () => {
    const { pool, workers } = makePool();
    const first = pool.compile(request("cube([10,10,10]);"));
    const second = pool.compile(request("cube([10,10,10]);"));
    await waitFor(() => workers[0].calls.length === 1);
    expect(workers[0].calls).toHaveLength(1);
    workers[0].resolveNext();
    const [a, b] = await Promise.all([first, second]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    pool.dispose();
  });

  it("limits concurrency to the pool size", async () => {
    const { pool, workers } = makePool(2);
    const requests = ["A", "B", "C", "D"].map((source) => pool.compile(request(source)));
    await waitFor(() => workers[0].calls.length === 1 && workers[1].calls.length === 1);
    expect(workers[0].calls).toHaveLength(1);
    expect(workers[1].calls).toHaveLength(1);
    workers[0].resolveNext();
    workers[1].resolveNext();
    await wait();
    expect(workers[0].calls).toHaveLength(2);
    expect(workers[1].calls).toHaveLength(2);
    workers[0].resolveNext();
    workers[1].resolveNext();
    const outcomes = await Promise.all(requests);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(Math.max(workers[0].maxActive, workers[1].maxActive)).toBe(1);
    pool.dispose();
  });

  it("starts higher-priority queued work first", async () => {
    const { pool, workers } = makePool(1);
    const first = pool.compile(request("A"), 0);
    await waitFor(() => workers[0].calls.length === 1);
    const low = pool.compile(request("B"), 0);
    const high = pool.compile(request("C"), 10);
    await waitFor(() => pool.stats().queued === 2);
    workers[0].resolveNext();
    await waitFor(() => workers[0].calls.length === 2);
    expect(workers[0].calls[1].source).toBe("C");
    workers[0].resolveNext();
    await waitFor(() => workers[0].calls.length === 3);
    expect(workers[0].calls[2].source).toBe("B");
    workers[0].resolveNext();
    await Promise.all([first, low, high]);
    pool.dispose();
  });

  it("returns the worker error and logs on failure", async () => {
    const { pool, workers } = makePool();
    const pending = pool.compile(request("bad"));
    await waitFor(() => workers[0].calls.length === 1);
    workers[0].rejectNext(new CompileError("OpenSCAD failed", "line 1"));
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe("OpenSCAD failed");
      expect(outcome.logs).toBe("line 1");
    }
    pool.dispose();
  });

  it("times out a hung compile and restarts the worker", async () => {
    const { pool, workers } = makePool(1, 10);
    const pending = pool.compile(request("slow"));
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/timed out/i);
    expect(workers[0].terminated).toBe(true);
    expect(workers.length).toBe(2);
    pool.dispose();
  });
});
