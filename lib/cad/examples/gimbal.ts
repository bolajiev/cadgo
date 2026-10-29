import type { CadSpec } from "../types";

export const gimbalSpec: CadSpec = {
  version: 1,
  name: "PT-2 camera head",
  subtitle: "Pan yoke, tilt axle and a locking knob",
  units: "mm",
  parameters: [
    { id: "base_d", label: "Base diameter", value: 164, min: 120, max: 210, unit: "mm" },
    { id: "post_h", label: "Post height", value: 70, min: 40, max: 120, unit: "mm" },
    { id: "camera_w", label: "Camera width", value: 108, min: 80, max: 140, unit: "mm" },
    { id: "camera_d", label: "Camera depth", value: 64, min: 45, max: 90, unit: "mm" },
    { id: "lens_d", label: "Lens diameter", value: 58, min: 35, max: 80, unit: "mm" },
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
          ["base_d / 2 - 4", 16],
          [30, 20],
          [24, 26],
          [22, "post_h"],
          [0, "post_h"],
        ],
      },
    },
    {
      id: "yoke",
      name: "Pan yoke",
      material: "anodised",
      position: [0, 0, "post_h"],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "translate",
              by: [0, 0, 6],
              child: { op: "cylinder", radius: 54, height: 12, segments: 72 },
            },
            b: {
              op: "translate",
              by: [58, 0, 47],
              child: { op: "box", size: [14, 80, 70] },
            },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [-58, 0, 47],
              child: { op: "box", size: [14, 80, 70] },
            },
            b: {
              op: "translate",
              by: [0, 34, 30],
              child: { op: "box", size: [108, 10, 24] },
            },
          },
        },
        b: {
          op: "translate",
          by: [0, 0, 76],
          child: {
            op: "rotate",
            degrees: [0, 90, 0],
            child: { op: "cylinder", radius: 8.5, height: 150, segments: 48 },
          },
        },
      },
    },
    {
      id: "camera",
      name: "Camera body",
      material: "aluminium",
      position: [0, 0, "post_h + 76"],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "union",
              a: {
                op: "translate",
                by: [0, 0, 0],
                child: { op: "box", size: ["camera_w", "camera_d", 70] },
              },
              b: {
                op: "translate",
                by: [0, "-camera_d / 2 - 22", 0],
                child: {
                  op: "rotate",
                  degrees: [90, 0, 0],
                  child: {
                    op: "cylinder",
                    radius: "lens_d / 2",
                    height: 44,
                    segments: 64,
                    center: true,
                  },
                },
              },
            },
            b: {
              op: "translate",
              by: [0, "-camera_d / 2 - 42", 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: {
                  op: "cylinder",
                  radius: "lens_d / 2 + 4",
                  height: 8,
                  segments: 64,
                  center: true,
                },
              },
            },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [0, 0, 45],
              child: { op: "box", size: [66, 16, 8] },
            },
            b: {
              op: "union",
              a: {
                op: "translate",
                by: [26, 20, 40],
                child: { op: "box", size: [30, 22, 14] },
              },
              b: {
                op: "translate",
                by: [0, -16, 40],
                child: { op: "box", size: [34, 14, 18] },
              },
            },
          },
        },
        b: {
          op: "rotate",
          degrees: [90, 0, 0],
          child: { op: "cylinder", radius: 7.2, height: "camera_w + 30", segments: 40 },
        },
      },
    },
    {
      id: "axle",
      name: "Tilt axle",
      material: "steel",
      position: [0, 0, "post_h + 76"],
      shape: {
        op: "union",
        a: {
          op: "rotate",
          degrees: [0, 90, 0],
          child: { op: "cylinder", radius: 7, height: 136, segments: 40 },
        },
        b: {
          op: "union",
          a: {
            op: "translate",
            by: [66, 0, 0],
            child: {
              op: "rotate",
              degrees: [0, 90, 0],
              child: { op: "cylinder", radius: 11, height: 4, segments: 40 },
            },
          },
          b: {
            op: "translate",
            by: [-66, 0, 0],
            child: {
              op: "rotate",
              degrees: [0, 90, 0],
              child: { op: "cylinder", radius: 11, height: 4, segments: 40 },
            },
          },
        },
      },
    },
    {
      id: "knob",
      name: "Tilt lock knob",
      material: "brass",
      position: [70, 0, "post_h + 76"],
      shape: {
        op: "union",
        a: {
          op: "rotate",
          degrees: [0, 90, 0],
          child: { op: "cylinder", radius: 17, height: 18, segments: 64, center: true },
        },
        b: {
          op: "translate",
          by: [11, 0, 0],
          child: {
            op: "rotate",
            degrees: [0, 90, 0],
            child: { op: "cylinder", radius: 11, height: 6, segments: 6, center: true },
          },
        },
      },
    },
  ],
  joints: [
    {
      id: "pan",
      name: "Pan",
      parent: "base",
      child: "yoke",
      type: "revolute",
      origin: [0, 0, "post_h"],
      axis: [0, 0, 1],
      limits: [-80, 80],
      value: 0,
    },
    {
      id: "tilt",
      name: "Tilt",
      parent: "yoke",
      child: "camera",
      type: "revolute",
      origin: [0, 0, "post_h + 76"],
      axis: [1, 0, 0],
      limits: [-35, 35],
      value: 0,
    },
    {
      id: "axle_mount",
      name: "Axle mount",
      parent: "camera",
      child: "axle",
      type: "fixed",
      origin: [0, 0, "post_h + 76"],
    },
    {
      id: "knob_mount",
      name: "Knob mount",
      parent: "yoke",
      child: "knob",
      type: "fixed",
      origin: [70, 0, "post_h + 76"],
    },
  ],
  demo: [
    { joint: "pan", to: 52, duration: 900, hold: 200 },
    { joint: "tilt", to: 24, duration: 700, hold: 300 },
    { joint: "pan", to: -44, duration: 1000, hold: 200 },
    { joint: "tilt", to: -22, duration: 700, hold: 300 },
    { joint: "pan", to: 0, duration: 900 },
    { joint: "tilt", to: 0, duration: 700 },
  ],
  notes: [
    "Two axes at right angles: pan on Z, tilt on X.",
    "The axle is carried by the camera; the lock knob stays on the yoke.",
    "The lens and camera body move as one rigid part.",
  ],
  sourcePrompt:
    "A compact pan-tilt camera head with a round base, a U-shaped yoke and a brass locking knob",
};
