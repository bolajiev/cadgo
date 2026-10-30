"use client";

import type { ScadMesh, ScadParamValue, ScadPreview } from "./types";

type Pending = {
  resolve: (value: ScadPreview | Uint8Array | void) => void;
  reject: (error: Error) => void;
};

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
  stderr?: string;
  duration?: number;
  stl?: Uint8Array;
};

class ScadClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private warmPromise: Promise<void> | null = null;

  private boot() {
    if (typeof window === "undefined") {
      throw new Error("The CAD kernel only runs in the browser");
    }
    if (this.worker) return this.worker;
    const worker = new Worker("/openscad/worker.js", { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok === false) {
        pending.reject(new Error(message.error ?? "OpenSCAD could not build this model"));
        return;
      }
      if (message.type === "preview" && message.positions && message.colors) {
        pending.resolve({
          positions: message.positions,
          colors: message.colors,
          triangles: message.triangles ?? message.positions.length / 9,
          bounds: message.bounds ?? {
            min: [0, 0, 0],
            max: [0, 0, 0],
          },
          components: message.components ?? 1,
          floating: message.floating ?? 0,
          stderr: message.stderr ?? "",
          duration: message.duration ?? 0,
        });
      } else if (message.type === "export" && message.stl) {
        pending.resolve(message.stl);
      } else {
        pending.resolve();
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "The OpenSCAD worker could not start");
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      worker.terminate();
      this.worker = null;
      this.warmPromise = null;
    };
    this.worker = worker;
    return worker;
  }

  private send<T>(message: Record<string, unknown>): Promise<T> {
    const worker = this.boot();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as Pending["resolve"],
        reject,
      });
      worker.postMessage({ ...message, id });
    });
  }

  warm(): Promise<void> {
    if (!this.warmPromise) {
      this.warmPromise = this.send<void>({ type: "warm" }).catch((error) => {
        this.warmPromise = null;
        throw error;
      });
    }
    return this.warmPromise;
  }

  preview(code: string, params: Record<string, ScadParamValue> = {}): Promise<ScadPreview> {
    return this.send<ScadPreview>({ type: "preview", code, params });
  }

  exportStl(code: string, params: Record<string, ScadParamValue> = {}): Promise<Uint8Array> {
    return this.send<Uint8Array>({ type: "export", format: "stl", code, params });
  }

  reset() {
    this.worker?.terminate();
    this.worker = null;
    this.warmPromise = null;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("CAD worker restarted"));
    }
    this.pending.clear();
  }
}

let client: ScadClient | null = null;

export function scadClient(): ScadClient {
  if (!client) client = new ScadClient();
  return client;
}
