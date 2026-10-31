export type BuildPurpose = "3d-print" | "visualization" | "cnc" | "assembly";

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
  scaleNote?: string;
};
