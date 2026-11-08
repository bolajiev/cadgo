import { LruCache, compileKey, stableParams } from "./cache";
import { metricsFromMesh, type CompileOutcome, type CompileRequest, type CompiledVariant } from "./types";
import { CompileError, type CompileWorker, type CompileWorkerFactory } from "./worker";

export type CompilePoolOptions = {
  factory: CompileWorkerFactory;
  size?: number;
  timeoutMs?: number;
  cacheLimit?: number;
};

export type CompilePoolStats = {
  queued: number;
  active: number;
  cached: number;
};

type Task = {
  key: string;
  request: CompileRequest;
  priority: number;
  sequence: number;
  resolve: (outcome: CompileOutcome) => void;
  settled: boolean;
};

type Slot = {
  worker: CompileWorker;
  task: Task | null;
  timer: ReturnType<typeof setTimeout> | null;
};

export class CompilePool {
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private inflight = new Map<string, Promise<CompileOutcome>>();
  private cache: LruCache<CompiledVariant>;
  private sequence = 0;
  private disposed = false;
  private readonly timeoutMs: number;

  constructor(private options: CompilePoolOptions) {
    const size = Math.max(1, options.size ?? 2);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.cache = new LruCache<CompiledVariant>(options.cacheLimit ?? 64);
    for (let index = 0; index < size; index++) {
      this.slots.push({ worker: options.factory(), task: null, timer: null });
    }
  }

  compile(request: CompileRequest, priority = 0): Promise<CompileOutcome> {
    if (this.disposed) {
      return Promise.resolve({ ok: false, error: "The compile pool is disposed.", logs: "" });
    }
    const inputKey = `${request.library ?? ""}\n${request.source}\n${stableParams(request.params)}`;
    const existing = this.inflight.get(inputKey);
    if (existing) return existing;

    const promise = this.compileUncached(request, priority);
    this.inflight.set(inputKey, promise);
    void promise.finally(() => this.inflight.delete(inputKey));
    return promise;
  }

  private async compileUncached(request: CompileRequest, priority: number): Promise<CompileOutcome> {
    const key = await compileKey(request.source, request.params, request.library);
    const cached = this.cache.get(key);
    if (cached) return { ...cached, ok: true };

    return new Promise<CompileOutcome>((resolve) => {
      this.queue.push({
        key,
        request,
        priority,
        sequence: this.sequence++,
        resolve,
        settled: false,
      });
      this.queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      this.pump();
    });
  }

  stats(): CompilePoolStats {
    return {
      queued: this.queue.length,
      active: this.slots.filter((slot) => slot.task !== null).length,
      cached: this.cache.size,
    };
  }

  getCached(key: string): CompiledVariant | undefined {
    return this.cache.get(key);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const task of this.queue.splice(0)) {
      this.settle(task, { ok: false, error: "The compile pool was disposed.", logs: "" });
    }
    for (const slot of this.slots) {
      if (slot.timer) clearTimeout(slot.timer);
      if (slot.task) {
        this.settle(slot.task, { ok: false, error: "The compile pool was disposed.", logs: "" });
        slot.task = null;
      }
      slot.worker.terminate();
    }
    this.slots = [];
    this.inflight.clear();
  }

  private pump() {
    if (this.disposed) return;
    for (const slot of this.slots) {
      if (slot.task || !this.queue.length) continue;
      const task = this.queue.shift();
      if (!task) continue;
      if (task.settled) continue;
      this.start(slot, task);
    }
  }

  private start(slot: Slot, task: Task) {
    slot.task = task;
    slot.timer = setTimeout(() => {
      if (slot.task !== task) return;
      this.settle(task, {
        ok: false,
        error: `Compilation timed out after ${Math.round(this.timeoutMs / 1000)} seconds.`,
        logs: "",
      });
      slot.task = null;
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      this.restart(slot);
      this.pump();
    }, this.timeoutMs);

    slot.worker
      .compile(task.request)
      .then((result) => {
        if (slot.task !== task || task.settled) return;
        const variant: CompiledVariant = {
          key: task.key,
          mesh: result.mesh,
          metrics: metricsFromMesh(result.mesh, result.duration),
          params: task.request.params,
          logs: result.logs,
          duration: result.duration,
        };
        this.cache.set(task.key, variant);
        this.settle(task, { ...variant, ok: true });
        this.finish(slot, task);
      })
      .catch((error: unknown) => {
        if (slot.task !== task || task.settled) return;
        const logs = error instanceof CompileError ? error.logs : "";
        this.settle(task, {
          ok: false,
          error: error instanceof Error ? error.message : "OpenSCAD failed.",
          logs,
        });
        if (error instanceof CompileError && /worker|wasm|module/i.test(error.message)) {
          this.restart(slot);
        }
        this.finish(slot, task);
      });
  }

  private finish(slot: Slot, task: Task) {
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    if (slot.task === task) slot.task = null;
    this.pump();
  }

  private settle(task: Task, outcome: CompileOutcome) {
    if (task.settled) return;
    task.settled = true;
    task.resolve(outcome);
  }

  private restart(slot: Slot) {
    slot.worker.terminate();
    try {
      slot.worker = this.options.factory();
    } catch (error) {
      slot.worker = {
        compile: async () => {
          throw error instanceof Error ? error : new CompileError("The CAD worker could not restart.");
        },
        terminate: () => {},
      };
    }
  }
}
