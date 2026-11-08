import { describe, expect, it } from "vitest";
import { createEmptyDocument, defaultMaterial, identityTransform } from "../lib/studio/document/defaults";
import type { CadDocument } from "../lib/studio/document/types";
import { buildSceneGroup } from "../lib/studio/v2/export";
import { buildSceneAnimations } from "../lib/studio/v2/animation";

function animatedDocument(): CadDocument {
  const document = createEmptyDocument("Animated");
  const transform = identityTransform();
  transform.position = [1, 0, 0];
  document.groups.push({
    id: "group-arm",
    name: "Arm group",
    parentId: null,
    transform,
    visible: true,
    locked: false,
    expanded: true,
    revision: 1,
  });
  document.definitions.push({
    id: "def-part",
    name: "Part",
    source: "cube([1, 1, 1]);",
    params: [],
    material: defaultMaterial(),
    materialMode: "source",
    locked: false,
    revision: 1,
  });
  document.instances.push(
    {
      id: "inst-base",
      definitionId: "def-part",
      name: "Base",
      parentId: null,
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    },
    {
      id: "inst-arm",
      definitionId: "def-part",
      name: "Arm",
      parentId: "group-arm",
      transform: identityTransform(),
      visible: true,
      locked: false,
      suppressed: false,
      revision: 1,
    },
  );
  document.drivers.push({
    id: "driver-angle",
    name: "angle",
    value: 0,
    min: 0,
    max: 360,
    step: 1,
    unit: "deg",
    revision: 1,
  });
  document.joints.push({
    id: "joint-arm",
    name: "Arm spin",
    type: "revolute",
    enabled: true,
    revision: 1,
    parentInstanceId: "inst-base",
    childGroupId: "group-arm",
    origin: [0, 0, 0],
    axis: [0, 0, 1],
    driverId: "driver-angle",
    expression: "angle",
  });
  return document;
}

describe("scene animation export", () => {
  it("creates one clip per driver with tracks for animated groups", () => {
    const document = animatedDocument();
    const root = buildSceneGroup(document, {});
    const clips = buildSceneAnimations(document, root, { samples: 5, duration: 1 });

    expect(clips).toHaveLength(1);
    expect(clips[0].name).toBe("angle");
    expect(clips[0].duration).toBe(1);
    expect(clips[0].tracks.some((track) => track.name === "Arm group.quaternion")).toBe(true);
    expect(clips[0].tracks.some((track) => track.name === "Arm group.position")).toBe(true);
    expect(clips[0].tracks.some((track) => track.name === "Base.position")).toBe(false);
    expect(clips[0].tracks.some((track) => track.name === "Arm.position")).toBe(false);
  });

  it("returns no clips when the document has no drivers", () => {
    const document = animatedDocument();
    document.drivers = [];
    document.joints = [];
    const root = buildSceneGroup(document, {});
    expect(buildSceneAnimations(document, root)).toEqual([]);
  });

  it("skips hidden groups", () => {
    const document = animatedDocument();
    document.groups[0].visible = false;
    const root = buildSceneGroup(document, {});
    expect(buildSceneAnimations(document, root)).toEqual([]);
  });
});
