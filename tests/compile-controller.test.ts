import { describe, expect, it } from "vitest";
import { createCompileController, type CompilePoolLike } from "../lib/studio/compile/controller";
import { metricsFromMesh, type CompileOutcome, type CompileRequest } from "../lib/studio/compile/types";
import { createEmptyDocument, defaultMaterial } from "../lib/studio/document/defaults";

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

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function definition(source: string, revision = 1) {
  return {
    id: "def-1",
    name: "Block",
    source,
    params: [
      {
        name: "width",
        label: "Width",
        value: 10,
        min: 2,
        max: 50,
        step: 1,
        type: "number" as const,
      },
    ],
    material: defaultMaterial(),
    locked: false,
    revision,
  };
}

describe("compile controller", () => {
  it("compiles each definition revision once and stores the variant", async () => {
    const calls: CompileRequest[] = [];
    const pool: CompilePoolLike = {
      async compile(request): Promise<CompileOutcome> {
        calls.push(request);
        const mesh = fakeMesh();
        return {
          ok: true,
          key: `key-${calls.length}`,
          mesh,
          metrics: metricsFromMesh(mesh, 1),
          params: request.params,
          logs: "",
          duration: 1,
        };
      },
    };
    const controller = createCompileController({ pool });
    const document = createEmptyDocument();
    document.definitions.push(definition("width = 10;\ncube([width,width,width]);"));

    controller.sync(document);
    await wait();
    expect(calls).toHaveLength(1);
    expect(controller.getState("def-1")?.status).toBe("ready");
    expect(controller.getVariant("def-1")?.key).toBe("key-1");

    controller.sync(document);
    await wait();
    expect(calls).toHaveLength(1);
  });

  it("recompiles changed definitions and library changes", async () => {
    const calls: CompileRequest[] = [];
    const pool: CompilePoolLike = {
      async compile(request): Promise<CompileOutcome> {
        calls.push(request);
        const mesh = fakeMesh();
        return {
          ok: true,
          key: `key-${calls.length}`,
          mesh,
          metrics: metricsFromMesh(mesh, 1),
          params: request.params,
          logs: "",
          duration: 1,
        };
      },
    };
    const controller = createCompileController({ pool });
    const document = createEmptyDocument();
    document.definitions.push(definition("width = 10;\ncube([width,width,width]);"));
    controller.sync(document);
    await wait();
    expect(calls).toHaveLength(1);

    const updated = {
      ...document,
      definitions: [definition("width = 12;\ncube([width,width,width]);", 2)],
    };
    controller.sync(updated);
    await wait();
    expect(calls).toHaveLength(2);

    const withLibrary = { ...updated, library: "module helper() {}" };
    controller.sync(withLibrary);
    await wait();
    expect(calls).toHaveLength(3);

    controller.sync({ ...withLibrary, definitions: [] });
    await wait();
    expect(controller.getState("def-1")).toBeUndefined();
    expect(controller.getVariant("def-1")).toBeUndefined();
  });

  it("compiles per-instance parameter overrides as variants", async () => {
    const calls: CompileRequest[] = [];
    const pool: CompilePoolLike = {
      async compile(request): Promise<CompileOutcome> {
        calls.push(request);
        const mesh = fakeMesh();
        return {
          ok: true,
          key: `key-${calls.length}`,
          mesh,
          metrics: metricsFromMesh(mesh, 1),
          params: request.params,
          logs: "",
          duration: 1,
        };
      },
    };
    const controller = createCompileController({ pool });
    const document = createEmptyDocument();
    document.definitions.push(definition("width = 10;\ncube([width,width,width]);"));
    document.instances.push({
      id: "inst-1",
      definitionId: "def-1",
      name: "Wide block",
      parentId: null,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      paramOverrides: { width: 20 },
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    });

    controller.sync(document);
    await wait();
    expect(calls).toHaveLength(2);
    expect(controller.getInstanceState("inst-1")?.status).toBe("ready");
    expect(controller.getInstanceVariant("inst-1")?.params.width).toBe(20);

    controller.sync(document);
    await wait();
    expect(calls).toHaveLength(2);

    controller.sync({
      ...document,
      instances: [{ ...document.instances[0], paramOverrides: { width: 24 }, revision: 2 }],
    });
    await wait();
    expect(calls).toHaveLength(3);
    expect(controller.getInstanceVariant("inst-1")?.params.width).toBe(24);

    controller.sync({
      ...document,
      instances: [{ ...document.instances[0], paramOverrides: {}, revision: 3 }],
    });
    await wait();
    expect(controller.getInstanceState("inst-1")).toBeUndefined();
    expect(controller.getInstanceVariant("inst-1")).toBeUndefined();
  });

  it("recompiles when the document is replaced with colliding ids", async () => {
    const calls: CompileRequest[] = [];
    const pool: CompilePoolLike = {
      async compile(request): Promise<CompileOutcome> {
        calls.push(request);
        const mesh = fakeMesh();
        return {
          ok: true,
          key: `key-${calls.length}`,
          mesh,
          metrics: metricsFromMesh(mesh, 1),
          params: request.params,
          logs: "",
          duration: 1,
        };
      },
    };
    const controller = createCompileController({ pool });
    const first = createEmptyDocument("Plate");
    first.definitions.push(definition("width = 10;\ncube([width,width,width]);"));
    controller.sync(first);
    await wait();
    expect(calls).toHaveLength(1);

    const second = createEmptyDocument("Bracket");
    second.definitions.push(definition("width = 30;\ncube([width,width,width]);"));
    controller.sync(second);
    await wait();
    expect(calls).toHaveLength(2);
    expect(controller.getVariant("def-1")?.key).toBe("key-2");
  });

  it("keeps the last good variant when a new compile fails", async () => {
    let shouldFail = false;
    const pool: CompilePoolLike = {
      async compile(request): Promise<CompileOutcome> {
        if (shouldFail) return { ok: false, error: "bad source", logs: "line 1" };
        const mesh = fakeMesh();
        return {
          ok: true,
          key: "good",
          mesh,
          metrics: metricsFromMesh(mesh, 1),
          params: request.params,
          logs: "",
          duration: 1,
        };
      },
    };
    const controller = createCompileController({ pool });
    const document = createEmptyDocument();
    document.definitions.push(definition("width = 10;\ncube([width,width,width]);"));
    controller.sync(document);
    await wait();
    expect(controller.getState("def-1")?.status).toBe("ready");

    shouldFail = true;
    controller.sync({
      ...document,
      definitions: [definition("width = 10;\ncube([width,width,width]);", 2)],
    } as typeof document);
    await wait();
    const state = controller.getState("def-1");
    expect(state?.status).toBe("error");
    expect(state?.lastGood?.key).toBe("good");
  });
});
