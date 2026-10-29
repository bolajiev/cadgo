import { compileSpec, initEngine } from "../lib/cad/engine";
import type { WorkerRequest, WorkerResponse } from "../lib/cad/worker-types";

const scope = self as unknown as DedicatedWorkerGlobalScope;

function send(message: WorkerResponse, transfer?: Transferable[]) {
  scope.postMessage(message, transfer ?? []);
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "warm") {
      await initEngine(() => "/manifold.wasm");
      send({ id: request.id, type: "ready" });
      return;
    }
    if (request.type === "compile") {
      await initEngine(() => "/manifold.wasm");
      const result = await compileSpec(request.spec, () => "/manifold.wasm");
      const transfer: Transferable[] = [];
      for (const part of result.parts) {
        transfer.push(part.positions.buffer, part.normals.buffer, part.indices.buffer);
      }
      send({ id: request.id, type: "result", result }, transfer);
    }
  } catch (error) {
    send({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : "The CAD kernel failed",
    });
  }
};

export {};
