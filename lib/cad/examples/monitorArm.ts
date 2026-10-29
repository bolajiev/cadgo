import type { CadSpec } from "../types";

export const monitorArmSpec: CadSpec = {
  version: 1,
  name: "MA-3 monitor arm",
  subtitle: "Two horizontal arms with a tilting VESA plate",
  units: "mm",
  parameters: [
    { id: "base_d", label: "Base diameter", value: 154, min: 120, max: 200, unit: "mm" },
    { id: "post_h", label: "Post height", value: 92, min: 60, max: 130, unit: "mm" },
    { id: "arm1", label: "Lower arm", value: 220, min: 160, max: 280, unit: "mm" },
    { id: "arm2", label: "Upper arm", value: 190, min: 140, max: 250, unit: "mm" },
    { id: "vesa", label: "VESA plate", value: 100, min: 75, max: 130, unit: "mm" },
  ],
  parts: [
    {
      id: "base",
      name: "Base and post",
      material: "anodised",
      position: [0, 0, 0],
      shape: {
        op: "revolve",
        segments: 96,
        profile: [
          [0, 0],
          ["base_d / 2", 0],
          ["base_d / 2 + 4", 6],
          ["base_d / 2 - 5", 16],
          [32, 20],
          [26, 28],
          [24, "post_h"],
          [0, "post_h"],
        ],
      },
    },
    {
      id: "lower_arm",
      name: "Lower arm",
      material: "aluminium",
      position: [0, 0, "post_h"],
      shape: {
        op: "difference",
        a: {
          op: "translate",
          by: ["arm1 / 2", 0, 0],
          child: {
            op: "extrude",
            height: 26,
            center: true,
            profile: { type: "rect", width: "arm1", height: 42, radius: 21 },
          },
        },
        b: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "cylinder",
              radius: 10,
              height: 50,
              segments: 40,
              center: true,
            },
            b: {
              op: "translate",
              by: ["arm1", 0, 0],
              child: { op: "cylinder", radius: 10, height: 50, segments: 40, center: true },
            },
          },
          b: {
            op: "pattern",
            mode: "linear",
            count: 3,
            step: ["arm1 * 0.16", 0, 0],
            child: {
              op: "translate",
              by: ["arm1 * 0.34", 0, 0],
              child: { op: "cylinder", radius: 7, height: 40, segments: 32, center: true },
            },
          },
        },
      },
    },
    {
      id: "upper_arm",
      name: "Upper arm",
      material: "aluminium",
      position: ["arm1", 0, "post_h"],
      rotation: [0, 0, -22],
      shape: {
        op: "difference",
        a: {
          op: "translate",
          by: ["arm2 / 2", 0, 0],
          child: {
            op: "extrude",
            height: 24,
            center: true,
            profile: { type: "rect", width: "arm2", height: 38, radius: 19 },
          },
        },
        b: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "cylinder",
              radius: 10,
              height: 46,
              segments: 40,
              center: true,
            },
            b: {
              op: "translate",
              by: ["arm2", 0, 0],
              child: { op: "cylinder", radius: 10, height: 46, segments: 40, center: true },
            },
          },
          b: {
            op: "pattern",
            mode: "linear",
            count: 3,
            step: ["arm2 * 0.16", 0, 0],
            child: {
              op: "translate",
              by: ["arm2 * 0.34", 0, 0],
              child: { op: "cylinder", radius: 6, height: 36, segments: 32, center: true },
            },
          },
        },
      },
    },
    {
      id: "vesa",
      name: "VESA plate",
      material: "anodised",
      position: ["arm1 + arm2 * cos(22)", "-arm2 * sin(22)", "post_h"],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "translate",
            by: [0, 0, -26],
            child: { op: "box", size: [24, 24, 52] },
          },
          b: {
            op: "translate",
            by: [0, -24, -30],
            child: { op: "box", size: ["vesa", 8, "vesa"] },
          },
        },
        b: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "translate",
              by: [-30, -24, -60],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 4, height: 20, segments: 28, center: true },
              },
            },
            b: {
              op: "translate",
              by: [30, -24, -60],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 4, height: 20, segments: 28, center: true },
              },
            },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [-30, -24, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 4, height: 20, segments: 28, center: true },
              },
            },
            b: {
              op: "translate",
              by: [30, -24, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 4, height: 20, segments: 28, center: true },
              },
            },
          },
        },
      },
    },
    {
      id: "knob",
      name: "Elbow knob",
      material: "brass",
      position: ["arm1", 0, "post_h"],
      shape: {
        op: "union",
        a: {
          op: "cylinder",
          radius: 17,
          height: 30,
          segments: 64,
          center: true,
        },
        b: {
          op: "translate",
          by: [0, 0, 19],
          child: { op: "cylinder", radius: 10, height: 8, segments: 6, center: true },
        },
      },
    },
  ],
  joints: [
    {
      id: "pan",
      name: "Base pan",
      parent: "base",
      child: "lower_arm",
      type: "revolute",
      origin: [0, 0, "post_h"],
      axis: [0, 0, 1],
      limits: [-85, 85],
      value: 0,
    },
    {
      id: "elbow",
      name: "Elbow",
      parent: "lower_arm",
      child: "upper_arm",
      type: "revolute",
      origin: ["arm1", 0, "post_h"],
      axis: [0, 0, 1],
      limits: [-85, 85],
      value: 0,
    },
    {
      id: "wrist",
      name: "VESA tilt",
      parent: "upper_arm",
      child: "vesa",
      type: "revolute",
      origin: ["arm1 + arm2 * cos(22)", "-arm2 * sin(22)", "post_h"],
      axis: [1, 0, 0],
      limits: [-24, 24],
      value: 0,
    },
    {
      id: "knob_mount",
      name: "Knob mount",
      parent: "upper_arm",
      child: "knob",
      type: "fixed",
      origin: ["arm1", 0, "post_h"],
    },
  ],
  demo: [
    { joint: "pan", to: 38, duration: 900, hold: 200 },
    { joint: "elbow", to: -32, duration: 800, hold: 200 },
    { joint: "wrist", to: 14, duration: 600, hold: 200 },
    { joint: "pan", to: -26, duration: 1000, hold: 200 },
    { joint: "elbow", to: 24, duration: 800, hold: 200 },
    { joint: "wrist", to: -10, duration: 600, hold: 200 },
    { joint: "pan", to: 0, duration: 900 },
    { joint: "elbow", to: 0, duration: 800 },
    { joint: "wrist", to: 0, duration: 600 },
  ],
  notes: [
    "Two vertical-axis joints sweep the arm across the desk.",
    "The VESA plate has its own horizontal tilt axis.",
    "The elbow knob is carried by the upper arm.",
  ],
  sourcePrompt:
    "A desk monitor arm with a round base, two jointed arms and a tilting VESA plate, in aluminium and brass",
};
