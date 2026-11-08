export type BuildPurpose = "3d-print" | "visualization" | "cnc" | "assembly";

export const DEFAULT_MAX_OVERHANG_PERCENT = 35;

export type StudioImage = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
};

export type PrintBed = {
  x: number;
  y: number;
  z: number;
};

export type PrintProfile = {
  purpose: BuildPurpose;
  printer?: string;
  bed?: PrintBed;
  material?: string;
  supports?: "none" | "allowed";
  maxOverhangPercent?: number;
  scaleNote?: string;
  scaleEstimated?: boolean;
};
