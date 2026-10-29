import type { MaterialId } from "./types";

export type MaterialDef = {
  id: MaterialId;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  density: number;
  edge: string;
};

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  aluminium: {
    id: "aluminium",
    label: "Aluminium",
    color: "#c8c5bb",
    metalness: 0.82,
    roughness: 0.32,
    density: 2.7,
    edge: "#3f3d37",
  },
  anodised: {
    id: "anodised",
    label: "Anodised black",
    color: "#30302e",
    metalness: 0.55,
    roughness: 0.38,
    density: 2.7,
    edge: "#111110",
  },
  brass: {
    id: "brass",
    label: "Brass",
    color: "#b08548",
    metalness: 0.9,
    roughness: 0.28,
    density: 8.5,
    edge: "#4b3717",
  },
  steel: {
    id: "steel",
    label: "Steel",
    color: "#9c9d9b",
    metalness: 0.9,
    roughness: 0.3,
    density: 7.85,
    edge: "#383938",
  },
  rubber: {
    id: "rubber",
    label: "Rubber",
    color: "#242422",
    metalness: 0.05,
    roughness: 0.82,
    density: 1.15,
    edge: "#0d0d0c",
  },
  wood: {
    id: "wood",
    label: "Oiled wood",
    color: "#9b7249",
    metalness: 0.04,
    roughness: 0.62,
    density: 0.7,
    edge: "#43301d",
  },
  accent: {
    id: "accent",
    label: "Safety orange",
    color: "#c4472a",
    metalness: 0.35,
    roughness: 0.42,
    density: 1.2,
    edge: "#5c1b0e",
  },
  bulb: {
    id: "bulb",
    label: "Warm glass",
    color: "#f4dfb2",
    metalness: 0.05,
    roughness: 0.22,
    density: 0.02,
    edge: "#6e5734",
  },
};

export function massGrams(volumeMm3: number, material: MaterialId): number {
  return (volumeMm3 / 1000) * MATERIALS[material].density;
}
