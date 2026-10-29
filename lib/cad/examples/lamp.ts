import type { CadSpec } from "../types";

export const lampSpec: CadSpec = {
  version: 1,
  name: "Springline desk lamp",
  subtitle: "Articulated task lamp with brass hinge bosses",
  units: "mm",
  parameters: [
    { id: "base_d", label: "Base diameter", value: 172, min: 130, max: 220, unit: "mm" },
    { id: "lower_len", label: "Lower arm", value: 190, min: 140, max: 240, unit: "mm" },
    { id: "upper_len", label: "Upper arm", value: 170, min: 120, max: 220, unit: "mm" },
    { id: "shoulder_z", label: "Shoulder height", value: 100, min: 80, max: 140, unit: "mm" },
    { id: "lower_angle", label: "Lower angle", value: 55, min: 35, max: 70, unit: "deg" },
    { id: "upper_angle", label: "Upper angle", value: 15, min: 5, max: 35, unit: "deg" },
    { id: "shade_angle", label: "Shade tilt", value: 15, min: -10, max: 40, unit: "deg" },
  ],
  parts: [
    {
      id: "base",
      name: "Base and column",
      material: "anodised",
      position: [0, 0, 0],
      shape: {
        op: "revolve",
        segments: 96,
        profile: [
          [0, 0],
          ["base_d / 2", 0],
          ["base_d / 2 + 5", 8],
          ["base_d / 2 - 4", 20],
          ["28", 24],
          ["24", 34],
          ["23", "shoulder_z - 16"],
          ["27", "shoulder_z - 6"],
          ["22", "shoulder_z"],
          [0, "shoulder_z"],
        ],
      },
    },
    {
      id: "feet",
      name: "Rubber feet",
      material: "rubber",
      position: [0, 0, 0],
      shape: {
        op: "pattern",
        mode: "circular",
        count: 3,
        axis: "z",
        center: [0, 0, 0],
        child: {
          op: "translate",
          by: ["base_d / 2 - 24", 0, -4],
          child: {
            op: "cylinder",
            radius: 12,
            height: 8,
            segments: 32,
          },
        },
      },
    },
    {
      id: "boss",
      name: "Shoulder boss",
      material: "brass",
      position: [0, 0, "shoulder_z"],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: {
              op: "cylinder",
              radius: 20,
              height: 44,
              segments: 64,
            },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [0, 20, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 25, height: 6, segments: 64 },
              },
            },
            b: {
              op: "translate",
              by: [0, -20, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 25, height: 6, segments: 64 },
              },
            },
          },
        },
        b: {
          op: "rotate",
          degrees: [90, 0, 0],
          child: { op: "cylinder", radius: 7, height: 64, segments: 48 },
        },
      },
    },
    {
      id: "lower_arm",
      name: "Lower arm",
      material: "aluminium",
      position: [0, 0, "shoulder_z"],
      rotation: [0, "-lower_angle", 0],
      shape: {
        op: "difference",
        a: {
          op: "translate",
          by: ["lower_len / 2", 0, 0],
          child: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: {
              op: "extrude",
              height: 26,
              center: true,
              profile: {
                type: "rect",
                width: "lower_len",
                height: 30,
                radius: 15,
              },
            },
          },
        },
        b: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "rotate",
              degrees: [90, 0, 0],
              child: { op: "cylinder", radius: 7.5, height: 44, segments: 48 },
            },
            b: {
              op: "translate",
              by: ["lower_len", 0, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 7.5, height: 44, segments: 48 },
              },
            },
          },
          b: {
            op: "pattern",
            mode: "linear",
            count: 3,
            step: ["lower_len * 0.18", 0, 0],
            child: {
              op: "translate",
              by: ["lower_len * 0.32", 0, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 6, height: 34, segments: 32 },
              },
            },
          },
        },
      },
    },
    {
      id: "upper_arm",
      name: "Upper arm",
      material: "aluminium",
      position: [
        "lower_len * cos(lower_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle)",
      ],
      rotation: [0, "-upper_angle", 0],
      shape: {
        op: "difference",
        a: {
          op: "translate",
          by: ["upper_len / 2", 0, 0],
          child: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: {
              op: "extrude",
              height: 22,
              center: true,
              profile: {
                type: "rect",
                width: "upper_len",
                height: 26,
                radius: 13,
              },
            },
          },
        },
        b: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "rotate",
              degrees: [90, 0, 0],
              child: { op: "cylinder", radius: 7, height: 38, segments: 48 },
            },
            b: {
              op: "translate",
              by: ["upper_len", 0, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 7, height: 38, segments: 48 },
              },
            },
          },
          b: {
            op: "pattern",
            mode: "linear",
            count: 3,
            step: ["upper_len * 0.2", 0, 0],
            child: {
              op: "translate",
              by: ["upper_len * 0.3", 0, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 5, height: 30, segments: 32 },
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
      position: [
        "lower_len * cos(lower_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle)",
      ],
      shape: {
        op: "union",
        a: {
          op: "union",
          a: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: { op: "cylinder", radius: 17, height: 30, segments: 64 },
          },
          b: {
            op: "translate",
            by: [0, 19, 0],
            child: {
              op: "rotate",
              degrees: [90, 0, 0],
              child: { op: "cylinder", radius: 12, height: 8, segments: 64 },
            },
          },
        },
        b: {
          op: "translate",
          by: [0, 24, 0],
          child: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: { op: "cylinder", radius: 7, height: 6, segments: 6 },
          },
        },
      },
    },
    {
      id: "shade",
      name: "Shade",
      material: "anodised",
      position: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle)",
      ],
      rotation: [0, "-shade_angle", 0],
      shape: {
        op: "union",
        a: {
          op: "revolve",
          segments: 96,
          profile: [
            [24, 0],
            [30, 0],
            [48, -16],
            [72, -40],
            [92, -72],
            [96, -82],
            [90, -82],
            [86, -72],
            [66, -40],
            [44, -16],
          ],
        },
        b: {
          op: "translate",
          by: [0, 0, -2.5],
          child: { op: "cylinder", radius: 31, height: 5, segments: 64 },
        },
      },
    },
    {
      id: "head_pin",
      name: "Head pin",
      material: "brass",
      position: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle)",
      ],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "rotate",
            degrees: [90, 0, 0],
            child: { op: "cylinder", radius: 7, height: 74, segments: 48 },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [0, 36, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 12, height: 4, segments: 48 },
              },
            },
            b: {
              op: "translate",
              by: [0, -36, 0],
              child: {
                op: "rotate",
                degrees: [90, 0, 0],
                child: { op: "cylinder", radius: 12, height: 4, segments: 48 },
              },
            },
          },
        },
        b: {
          op: "rotate",
          degrees: [90, 0, 0],
          child: { op: "cylinder", radius: 3, height: 84, segments: 32 },
        },
      },
    },
    {
      id: "bulb",
      name: "Warm bulb",
      material: "bulb",
      position: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle) + 35 * sin(shade_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle) - 35 * cos(shade_angle)",
      ],
      shape: { op: "sphere", radius: 20, segments: 48 },
    },
  ],
  joints: [
    {
      id: "shoulder",
      name: "Shoulder",
      parent: "base",
      child: "lower_arm",
      type: "revolute",
      origin: [0, 0, "shoulder_z"],
      axis: [0, 1, 0],
      limits: [-30, 60],
      value: 0,
    },
    {
      id: "elbow",
      name: "Elbow",
      parent: "lower_arm",
      child: "upper_arm",
      type: "revolute",
      origin: [
        "lower_len * cos(lower_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle)",
      ],
      axis: [0, 1, 0],
      limits: [-70, 55],
      value: 0,
    },
    {
      id: "head",
      name: "Head tilt",
      parent: "upper_arm",
      child: "shade",
      type: "revolute",
      origin: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle)",
      ],
      axis: [0, 1, 0],
      limits: [-55, 45],
      value: 0,
    },
    {
      id: "knob_mount",
      name: "Knob mount",
      parent: "upper_arm",
      child: "knob",
      type: "fixed",
      origin: [
        "lower_len * cos(lower_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle)",
      ],
    },
    {
      id: "head_pin_mount",
      name: "Head pin mount",
      parent: "shade",
      child: "head_pin",
      type: "fixed",
      origin: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle)",
      ],
    },
    {
      id: "bulb_mount",
      name: "Bulb mount",
      parent: "shade",
      child: "bulb",
      type: "fixed",
      origin: [
        "lower_len * cos(lower_angle) + upper_len * cos(upper_angle) + 35 * sin(shade_angle)",
        0,
        "shoulder_z + lower_len * sin(lower_angle) + upper_len * sin(upper_angle) - 35 * cos(shade_angle)",
      ],
    },
    {
      id: "feet_mount",
      name: "Feet mount",
      parent: "base",
      child: "feet",
      type: "fixed",
      origin: [0, 0, 0],
    },
    {
      id: "boss_mount",
      name: "Boss mount",
      parent: "base",
      child: "boss",
      type: "fixed",
      origin: [0, 0, "shoulder_z"],
    },
  ],
  demo: [
    { joint: "shoulder", to: 24, duration: 900 },
    { joint: "elbow", to: -34, duration: 700 },
    { joint: "head", to: 18, duration: 600, hold: 300 },
    { joint: "shoulder", to: -10, duration: 900 },
    { joint: "elbow", to: 18, duration: 700 },
    { joint: "head", to: -14, duration: 600, hold: 400 },
    { joint: "shoulder", to: 0, duration: 800 },
    { joint: "elbow", to: 0, duration: 800 },
    { joint: "head", to: 0, duration: 800 },
  ],
  notes: [
    "Three revolute joints on parallel axes.",
    "Brass bosses carry the hinge loads; the arms are lightened between them.",
    "The bulb is carried by the shade so it stays aimed with the head.",
  ],
  sourcePrompt:
    "A compact desk lamp with a heavy round base, two hinged arms, a conical shade and brass joints, 300 mm reach",
};
