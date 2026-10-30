export type ScadBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

export type ScadMesh = {
  positions: Float32Array;
  colors: Float32Array;
  triangles: number;
  components: number;
  floating: number;
  bounds: ScadBounds;
};

export type ScadPreview = ScadMesh & {
  stderr: string;
  duration: number;
};

export type ScadParamValue = number | boolean;
