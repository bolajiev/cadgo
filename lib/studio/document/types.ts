import type { ParameterDef } from "../../scad/params";

export type Id = string;
export type Vec3 = [number, number, number];

export type Transform = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type MaterialRef = {
  color: string;
  metalness: number;
  roughness: number;
  opacity?: number;
};

export type MaterialMode = "source" | "override";

export type GroupNode = {
  id: Id;
  name: string;
  parentId: Id | null;
  transform: Transform;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  revision: number;
};

export type PartDefinition = {
  id: Id;
  name: string;
  source: string;
  params: ParameterDef[];
  material: MaterialRef;
  materialMode?: MaterialMode;
  locked: boolean;
  revision: number;
};

export type PartInstance = {
  id: Id;
  definitionId: Id;
  name: string;
  parentId: Id | null;
  transform: Transform;
  material?: MaterialRef;
  materialMode?: MaterialMode;
  paramOverrides?: Record<string, number | boolean>;
  visible: boolean;
  locked: boolean;
  suppressed: boolean;
  revision: number;
};

export type Driver = {
  id: Id;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  revision: number;
};

export type Joint =
  | {
      id: Id;
      name: string;
      type: "revolute";
      enabled: boolean;
      revision: number;
      parentInstanceId: Id;
      childInstanceId?: Id;
      childGroupId?: Id;
      origin: Vec3;
      axis: Vec3;
      driverId?: Id;
      expression: string;
      limits?: [number, number];
    }
  | {
      id: Id;
      name: string;
      type: "prismatic";
      enabled: boolean;
      revision: number;
      parentInstanceId: Id;
      childInstanceId?: Id;
      childGroupId?: Id;
      axis: Vec3;
      driverId?: Id;
      expression: string;
      limits?: [number, number];
    }
  | {
      id: Id;
      name: string;
      type: "link";
      enabled: boolean;
      revision: number;
      parentInstanceId: Id;
      childInstanceId: Id;
      targetInstanceId: Id;
      parentPoint: Vec3;
      childPoint: Vec3;
      targetPoint: Vec3;
      stretch: boolean;
    };

export type JointDraft =
  | Omit<Extract<Joint, { type: "revolute" }>, "revision">
  | Omit<Extract<Joint, { type: "prismatic" }>, "revision">
  | Omit<Extract<Joint, { type: "link" }>, "revision">;

export type CadDocument = {
  schemaVersion: 2;
  id: Id;
  name: string;
  revision: number;
  units: "mm";
  library: string;
  groups: GroupNode[];
  definitions: PartDefinition[];
  instances: PartInstance[];
  joints: Joint[];
  drivers: Driver[];
  createdAt: string;
  updatedAt: string;
};
