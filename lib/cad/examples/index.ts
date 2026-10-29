import type { CadSpec } from "../types";
import { lampSpec } from "./lamp";
import { viseSpec } from "./vise";
import { gimbalSpec } from "./gimbal";
import { monitorArmSpec } from "./monitorArm";

export type Example = {
  id: string;
  spec: CadSpec;
  prompt: string;
  category: string;
  specimen: string;
};

export const EXAMPLES: Example[] = [
  {
    id: "lamp",
    spec: lampSpec,
    prompt:
      "A compact desk lamp with a heavy round base, two hinged arms, a conical shade and brass joints, 300 mm reach",
    category: "Lighting",
    specimen: "3 hinges / 9 parts",
  },
  {
    id: "vise",
    spec: viseSpec,
    prompt:
      "A heavy bench vise with a sliding jaw, two guide rods, a lead screw and a brass handwheel",
    category: "Workholding",
    specimen: "1 slide / 1 screw",
  },
  {
    id: "gimbal",
    spec: gimbalSpec,
    prompt:
      "A compact pan-tilt camera head with a round base, a U-shaped yoke and a brass locking knob",
    category: "Motion",
    specimen: "pan + tilt",
  },
  {
    id: "monitor-arm",
    spec: monitorArmSpec,
    prompt:
      "A desk monitor arm with a round base, two jointed arms and a tilting VESA plate, in aluminium and brass",
    category: "Workstation",
    specimen: "2 sweeps / 1 tilt",
  },
];

export { lampSpec, viseSpec, gimbalSpec, monitorArmSpec };
