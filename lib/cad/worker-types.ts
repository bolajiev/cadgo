import type { CadSpec, CompileResult } from "./types";

export type WorkerRequest =
  | { id: number; type: "warm" }
  | { id: number; type: "compile"; spec: CadSpec };

export type WorkerResponse =
  | { id: number; type: "ready" }
  | { id: number; type: "result"; result: CompileResult }
  | { id: number; type: "error"; message: string };
