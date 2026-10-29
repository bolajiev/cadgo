"use client";

import type { CadSpec, CompileResult } from "./types";
import type { WorkerRequest, WorkerResponse } from "./worker-types";

type Pending = {
  resolve: (result: CompileResult) => void;
  reject: (error: Error) => void;
};

class CadClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  private boot() {
    if (typeof window === "undefined") {
      throw new Error("The CAD kernel only runs in the browser");
    }
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("../../workers/cad.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.type === "result") pending.resolve(message.result);
      else if (message.type === "error") pending.reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "The CAD worker could not start");
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  warm(): Promise<void> {
    const worker = this.boot();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("The CAD kernel took too long to start"));
      }, 20000);
      const request: WorkerRequest = { id, type: "warm" };
      this.pending.set(id, {
        resolve: () => {
          window.clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      });
      worker.postMessage(request);
    });
  }

  compile(spec: CadSpec): Promise<CompileResult> {
    const worker = this.boot();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: WorkerRequest = { id, type: "compile", spec };
      worker.postMessage(request);
    });
  }

  cancelAll(reason = "Compile cancelled") {
    for (const pending of this.pending.values()) pending.reject(new Error(reason));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

let client: CadClient | null = null;

export function cadClient(): CadClient {
  if (!client) client = new CadClient();
  return client;
}
