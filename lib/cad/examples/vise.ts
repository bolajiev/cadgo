import type { CadSpec } from "../types";

export const viseSpec: CadSpec = {
  version: 1,
  name: "Bench vise No. 4",
  subtitle: "Sliding jaw with a spinning lead screw",
  units: "mm",
  parameters: [
    { id: "base_len", label: "Base length", value: 224, min: 170, max: 280, unit: "mm" },
    { id: "jaw_width", label: "Jaw width", value: 112, min: 80, max: 150, unit: "mm" },
    { id: "jaw_height", label: "Jaw height", value: 78, min: 50, max: 110, unit: "mm" },
    { id: "screw_d", label: "Screw diameter", value: 18, min: 10, max: 26, unit: "mm" },
  ],
  parts: [
    {
      id: "body",
      name: "Body and fixed jaw",
      material: "anodised",
      position: [0, 0, 0],
      shape: {
        op: "difference",
        a: {
          op: "union",
          a: {
            op: "union",
            a: {
              op: "translate",
              by: [0, 0, 11],
              child: { op: "box", size: ["base_len", "jaw_width", 22] },
            },
            b: {
              op: "translate",
              by: ["base_len / 2 - 28", 0, "11 + jaw_height / 2"],
              child: { op: "box", size: [30, "jaw_width", "jaw_height"] },
            },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [0, "jaw_width / 2 - 24", 25],
              child: {
                op: "rotate",
                degrees: [0, 90, 0],
                child: { op: "cylinder", radius: 7, height: "base_len - 20", segments: 40 },
              },
            },
            b: {
              op: "translate",
              by: [0, "-jaw_width / 2 + 24", 25],
              child: {
                op: "rotate",
                degrees: [0, 90, 0],
                child: { op: "cylinder", radius: 7, height: "base_len - 20", segments: 40 },
              },
            },
          },
        },
        b: {
          op: "translate",
          by: ["base_len / 2 - 28", 0, "11 + jaw_height / 2"],
          child: {
            op: "rotate",
            degrees: [0, 90, 0],
            child: {
              op: "cylinder",
              radius: "screw_d / 2 + 0.4",
              height: 60,
              segments: 48,
              center: true,
            },
          },
        },
      },
    },
    {
      id: "jaw",
      name: "Sliding jaw",
      material: "aluminium",
      position: [-34, 0, 0],
      shape: {
        op: "difference",
        a: {
          op: "difference",
          a: {
            op: "translate",
            by: [0, 0, "11 + jaw_height / 2"],
            child: { op: "box", size: [34, "jaw_width", "jaw_height"] },
          },
          b: {
            op: "union",
            a: {
              op: "translate",
              by: [0, "jaw_width / 2 - 24", 25],
              child: {
                op: "rotate",
                degrees: [0, 90, 0],
                child: { op: "cylinder", radius: 7.7, height: 44, segments: 40 },
              },
            },
            b: {
              op: "translate",
              by: [0, "-jaw_width / 2 + 24", 25],
              child: {
                op: "rotate",
                degrees: [0, 90, 0],
                child: { op: "cylinder", radius: 7.7, height: 44, segments: 40 },
              },
            },
          },
        },
        b: {
          op: "rotate",
          degrees: [0, 90, 0],
          child: {
            op: "cylinder",
            radius: "screw_d / 2 + 0.4",
            height: 44,
            segments: 48,
            center: true,
          },
        },
      },
    },
    {
      id: "screw",
      name: "Lead screw",
      material: "brass",
      position: [58, 0, "11 + jaw_height / 2"],
      shape: {
        op: "union",
        a: {
          op: "union",
          a: {
            op: "rotate",
            degrees: [0, 90, 0],
            child: {
              op: "cylinder",
              radius: "screw_d / 2",
              height: 300,
              segments: 48,
              center: true,
            },
          },
          b: {
            op: "translate",
            by: [148, 0, 0],
            child: {
              op: "rotate",
              degrees: [0, 90, 0],
              child: {
                op: "cylinder",
                radius: "screw_d * 1.35",
                height: 24,
                segments: 64,
                center: true,
              },
            },
          },
        },
        b: {
          op: "translate",
          by: [161, 0, 0],
          child: {
            op: "rotate",
            degrees: [0, 90, 0],
            child: { op: "cylinder", radius: "screw_d * 0.62", height: 8, segments: 6, center: true },
          },
        },
      },
    },
  ],
  joints: [
    {
      id: "slide",
      name: "Jaw slide",
      parent: "body",
      child: "jaw",
      type: "prismatic",
      origin: [-34, 0, "11 + jaw_height / 2"],
      axis: [1, 0, 0],
      limits: [-34, 62],
      value: 0,
    },
    {
      id: "screw_spin",
      name: "Lead screw",
      parent: "body",
      child: "screw",
      type: "revolute",
      origin: [58, 0, "11 + jaw_height / 2"],
      axis: [1, 0, 0],
      limits: [-180, 180],
      value: 0,
    },
  ],
  demo: [
    { joint: "slide", to: 58, duration: 900, hold: 200 },
    { joint: "screw_spin", to: 160, duration: 700, hold: 200 },
    { joint: "slide", to: -24, duration: 900, hold: 200 },
    { joint: "screw_spin", to: 0, duration: 700, hold: 200 },
    { joint: "slide", to: 0, duration: 700 },
  ],
  notes: [
    "A prismatic jaw and a revolute lead screw on parallel X axes.",
    "Two guide rods carry the jaw; the screw only turns.",
    "Jaw faces stay parallel through the full stroke.",
  ],
  sourcePrompt:
    "A heavy bench vise with a sliding jaw, two guide rods, a lead screw and a brass handwheel",
};
