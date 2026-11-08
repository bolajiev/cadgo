import type { ScadMesh } from "../../scad/types";

export type CompileStatus = "idle" | "queued" | "compiling" | "ready" | "stale" | "error";

export type VariantMetrics = {
  triangles: number;
  components: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  volume: number;
  surfaceArea: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  overhangArea: number;
  overhangPercent: number;
  compileMs: number;
};

export type CompiledVariant = {
  key: string;
  mesh: ScadMesh;
  metrics: VariantMetrics;
  params: Record<string, number | boolean>;
  logs: string;
  duration: number;
};

export type CompileState = {
  definitionId: string;
  revision: number;
  key: string;
  status: CompileStatus;
  error?: string;
  logs?: string;
  metrics?: VariantMetrics;
  lastGood?: CompiledVariant;
};

export type CompileRequest = {
  source: string;
  params: Record<string, number | boolean>;
  library?: string;
};

export type CompileSuccess = CompiledVariant & { ok: true };

export type CompileFailure = {
  ok: false;
  error: string;
  logs: string;
};

export type CompileOutcome = CompileSuccess | CompileFailure;

export function metricsFromMesh(mesh: ScadMesh, duration: number): VariantMetrics {
  return {
    triangles: mesh.triangles,
    components: mesh.components,
    bounds: mesh.bounds,
    volume: mesh.volume,
    surfaceArea: mesh.surfaceArea,
    boundaryEdges: mesh.boundaryEdges,
    nonManifoldEdges: mesh.nonManifoldEdges,
    overhangArea: mesh.overhangArea,
    overhangPercent: mesh.overhangPercent,
    compileMs: duration,
  };
}
