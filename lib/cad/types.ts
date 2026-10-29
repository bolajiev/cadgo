export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type Expr = number | string | { expr: string };

export type Parameter = {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
};

export type MaterialId =
  | "aluminium"
  | "anodised"
  | "brass"
  | "steel"
  | "rubber"
  | "wood"
  | "accent"
  | "bulb";

export type Profile =
  | { type: "rect"; width: Expr; height: Expr; radius?: Expr }
  | { type: "circle"; radius: Expr }
  | { type: "polygon"; points: [Expr, Expr][] };

export type RevolveProfile = [Expr, Expr][];

export type CsgNode =
  | { op: "box"; size: [Expr, Expr, Expr]; center?: boolean }
  | { op: "cylinder"; radius: Expr; height: Expr; segments?: number; center?: boolean }
  | { op: "cone"; radiusBottom: Expr; radiusTop: Expr; height: Expr; segments?: number; center?: boolean }
  | { op: "sphere"; radius: Expr; segments?: number }
  | { op: "extrude"; profile: Profile; height: Expr; center?: boolean; twist?: Expr; scaleTop?: Expr }
  | { op: "revolve"; profile: RevolveProfile; segments?: number }
  | { op: "union"; a: CsgNode; b: CsgNode }
  | { op: "difference"; a: CsgNode; b: CsgNode }
  | { op: "intersection"; a: CsgNode; b: CsgNode }
  | { op: "translate"; by: [Expr, Expr, Expr]; child: CsgNode }
  | { op: "rotate"; degrees: [Expr, Expr, Expr]; child: CsgNode }
  | { op: "mirror"; normal: [Expr, Expr, Expr]; child: CsgNode }
  | {
      op: "pattern";
      child: CsgNode;
      count: number;
      mode: "linear" | "circular";
      step?: [Expr, Expr, Expr];
      axis?: "x" | "y" | "z";
      center?: [Expr, Expr, Expr];
    }
  | {
      op: "bolt";
      diameter: Expr;
      length: Expr;
      headDiameter?: Expr;
      headHeight?: Expr;
    };

export type Part = {
  id: string;
  name: string;
  material: MaterialId;
  position: [Expr, Expr, Expr];
  rotation?: [Expr, Expr, Expr];
  shape: CsgNode;
  hidden?: boolean;
};

export type JointType = "revolute" | "prismatic" | "fixed";

export type Joint = {
  id: string;
  name: string;
  parent: string | "world";
  child: string;
  type: JointType;
  origin: [Expr, Expr, Expr];
  axis?: [Expr, Expr, Expr];
  limits?: [number, number];
  value?: number;
  unit?: "deg" | "mm";
};

export type DemoStep = {
  joint: string;
  to: number;
  duration: number;
  hold?: number;
};

export type CadSpec = {
  version: 1;
  name: string;
  subtitle?: string;
  units: "mm";
  parameters: Parameter[];
  parts: Part[];
  joints: Joint[];
  demo?: DemoStep[];
  notes?: string[];
  sourcePrompt?: string;
};

export type PartMesh = {
  id: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  volume: number;
  bounds: { min: Vec3; max: Vec3 };
  triangles: number;
};

export type CompileResult = {
  parts: PartMesh[];
  errors: { part: string; message: string }[];
  totalVolume: number;
  bounds: { min: Vec3; max: Vec3 } | null;
  ms: number;
};

export type PartRuntime = PartMesh & {
  material: MaterialId;
  name: string;
};

export type Bounds = { min: Vec3; max: Vec3 };

export const EMPTY_BOUNDS: Bounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};
