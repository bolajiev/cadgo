import type { ScadMesh } from "../../scad/types";
import type { CompileRequest } from "./types";

export type WorkerCompileResult = {
  mesh: ScadMesh;
  logs: string;
  duration: number;
};

export type CompileWorker = {
  compile(request: CompileRequest): Promise<WorkerCompileResult>;
  terminate(): void;
};

export type CompileWorkerFactory = () => CompileWorker;

export class CompileError extends Error {
  logs: string;
  constructor(message: string, logs = "") {
    super(message);
    this.name = "CompileError";
    this.logs = logs;
  }
}

type WorkerMessage = {
  id: number;
  type: string;
  ok?: boolean;
  error?: string;
  positions?: Float32Array;
  colors?: Float32Array;
  triangles?: number;
  bounds?: ScadMesh["bounds"];
  components?: number;
  floating?: number;
  boundaryEdges?: number;
  nonManifoldEdges?: number;
  volume?: number;
  surfaceArea?: number;
  overhangArea?: number;
  overhangPercent?: number;
  componentIds?: Uint32Array;
  stderr?: string;
  duration?: number;
};

type Pending = {
  resolve: (result: WorkerCompileResult) => void;
  reject: (error: Error) => void;
};

class BrowserCompileWorker implements CompileWorker {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker("/openscad/worker.js", { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.handle(event.data);
    this.worker.onerror = (event) => {
      const error = new CompileError(event.message || "The OpenSCAD worker could not start.");
      this.rejectAll(error);
    };
  }

  private handle(message: WorkerMessage) {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.ok === false) {
      pending.reject(new CompileError(message.error ?? "OpenSCAD could not build this model."));
      return;
    }
    if (message.type !== "preview" || !message.positions || !message.colors) {
      pending.reject(new CompileError("The OpenSCAD worker returned an unexpected response."));
      return;
    }
    pending.resolve({
      mesh: {
        positions: message.positions,
        colors: message.colors,
        triangles: message.triangles ?? message.positions.length / 9,
        bounds: message.bounds ?? { min: [0, 0, 0], max: [0, 0, 0] },
        components: message.components ?? 1,
        floating: message.floating ?? 0,
        boundaryEdges: message.boundaryEdges ?? 0,
        nonManifoldEdges: message.nonManifoldEdges ?? 0,
        volume: message.volume ?? 0,
        surfaceArea: message.surfaceArea ?? 0,
        overhangArea: message.overhangArea ?? 0,
        overhangPercent: message.overhangPercent ?? 0,
        componentIds: message.componentIds ?? new Uint32Array(0),
      },
      logs: message.stderr ?? "",
      duration: message.duration ?? 0,
    });
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  compile(request: CompileRequest): Promise<WorkerCompileResult> {
    const code = request.library?.trim()
      ? `${request.library.trim()}\n\n${request.source}`
      : request.source;
    const id = this.nextId++;
    return new Promise<WorkerCompileResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        id,
        type: "preview",
        code,
        params: request.params,
      });
    });
  }

  terminate() {
    this.rejectAll(new CompileError("The CAD worker was restarted."));
    this.worker.terminate();
  }
}

export function browserCompileWorkerFactory(): CompileWorkerFactory {
  return () => {
    if (typeof Worker === "undefined") {
      throw new CompileError("The OpenSCAD worker only runs in the browser.");
    }
    return new BrowserCompileWorker();
  };
}
