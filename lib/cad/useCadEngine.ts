"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CadSpec, CompileResult } from "./types";
import type { WorkerRequest, WorkerResponse } from "./worker-types";

type Pending = {
  resolve: (result: CompileResult) => void;
  reject: (error: Error) => void;
};

export function useCadEngine() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const [status, setStatus] = useState<"cold" | "warming" | "ready" | "error">("cold");
  const [error, setError] = useState<string | null>(null);

  const boot = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("../../workers/cad.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "ready") {
        setStatus("ready");
        return;
      }
      const pending = pendingRef.current.get(message.id);
      if (!pending) return;
      pendingRef.current.delete(message.id);
      if (message.type === "result") pending.resolve(message.result);
      else if (message.type === "error") pending.reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      setStatus("error");
      setError(event.message || "The CAD worker could not start");
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error(event.message || "The CAD worker could not start"));
      }
      pendingRef.current.clear();
    };
    workerRef.current = worker;
    setStatus("warming");
    const id = nextId.current++;
    const request: WorkerRequest = { id, type: "warm" };
    worker.postMessage(request);
    return worker;
  }, []);

  useEffect(() => {
    boot();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("CAD worker stopped"));
      }
      pendingRef.current.clear();
    };
  }, [boot]);

  const compile = useCallback(
    (spec: CadSpec) =>
      new Promise<CompileResult>((resolve, reject) => {
        const worker = boot();
        const id = nextId.current++;
        pendingRef.current.set(id, { resolve, reject });
        const request: WorkerRequest = { id, type: "compile", spec };
        worker.postMessage(request);
      }),
    [boot],
  );

  const restart = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("cold");
    setError(null);
    boot();
  }, [boot]);

  return { compile, status, error, restart };
}
