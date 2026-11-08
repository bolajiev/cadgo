import { parseParameters } from "../../../scad/params";
import type {
  CadDocument,
  GroupNode,
  Joint,
  MaterialRef,
  PartDefinition,
  PartInstance,
  Vec3,
} from "../../document/types";
import { createEmptyDocument, identityTransform } from "../../document/defaults";

const H = {
  torsoWidth: 320,
  torsoDepth: 180,
  torsoHeight: 420,
  pelvisWidth: 260,
  pelvisDepth: 160,
  pelvisHeight: 140,
  headWidth: 160,
  headDepth: 150,
  headHeight: 160,
  visorWidthRatio: 0.7,
  visorHeightRatio: 0.28,
  visorThickness: 4,
  visorOffset: 1,
  upperArmDiameter: 70,
  upperArmLength: 260,
  forearmDiameter: 60,
  forearmLength: 240,
  handWidth: 80,
  handDepth: 40,
  handHeight: 100,
  thighDiameter: 100,
  thighLength: 300,
  shinDiameter: 80,
  shinLength: 300,
  footWidth: 140,
  footDepth: 220,
  footHeight: 70,
  hipX: 90,
  shoulderX: 205,
  hipZ: 670,
  torsoZ: 1020,
  pelvisZ: 740,
  shoulderZ: 1170,
  neckZ: 1230,
  headZ: 80,
  walkCycle: 360,
  hipSwing: 26,
  kneeLift: 52,
  kneeBend: 6,
  armSwing: 20,
  elbowBend: 16,
  elbowSwing: 18,
  headTurn: 6,
  torsoTwist: 6,
  jointScale: 1.25,
};

const MATERIALS: Record<string, MaterialRef> = {
  torso: { color: "#8d949a", metalness: 0.35, roughness: 0.45, opacity: 1 },
  pelvis: { color: "#4d545a", metalness: 0.4, roughness: 0.42, opacity: 1 },
  head: { color: "#6b737a", metalness: 0.4, roughness: 0.4, opacity: 1 },
  limb: { color: "#b0b7bd", metalness: 0.55, roughness: 0.32, opacity: 1 },
  joint: { color: "#30363b", metalness: 0.5, roughness: 0.38, opacity: 1 },
  foot: { color: "#3d4348", metalness: 0.35, roughness: 0.5, opacity: 1 },
};

const torsoSource = `// Humanoid torso
width = ${H.torsoWidth}; // [200:480]
depth = ${H.torsoDepth}; // [100:280]
height = ${H.torsoHeight}; // [260:620]
$fn = 32;
module humanoid_torso() {
  cube([width, depth, height], center = true);
}
color([0.55, 0.58, 0.62]) humanoid_torso();`;

const pelvisSource = `// Humanoid pelvis
width = ${H.pelvisWidth}; // [160:380]
depth = ${H.pelvisDepth}; // [90:240]
height = ${H.pelvisHeight}; // [80:220]
$fn = 32;
module humanoid_pelvis() {
  cube([width, depth, height], center = true);
}
color([0.28, 0.31, 0.34]) humanoid_pelvis();`;

const headSource = `// Humanoid head
width = ${H.headWidth}; // [90:240]
depth = ${H.headDepth}; // [80:220]
height = ${H.headHeight}; // [90:240]
visor_width_ratio = ${H.visorWidthRatio}; // [0.4:0.9]
visor_height_ratio = ${H.visorHeightRatio}; // [0.1:0.5]
visor_thickness = ${H.visorThickness}; // [2:10]
visor_offset = ${H.visorOffset}; // [0:6]
$fn = 32;
module humanoid_head() {
  cube([width, depth, height], center = true);
  color([0.06, 0.08, 0.1])
    translate([0, -depth / 2 - visor_offset, 0])
      cube([width * visor_width_ratio, visor_thickness, height * visor_height_ratio], center = true);
}
color([0.38, 0.42, 0.46]) humanoid_head();`;

const upperArmSource = `// Humanoid upper arm
diameter = ${H.upperArmDiameter}; // [40:120]
length = ${H.upperArmLength}; // [160:380]
joint_scale = ${H.jointScale}; // [1:2]
$fn = 32;
module humanoid_upper_arm() {
  cylinder(h = length, d = diameter, center = true);
  translate([0, 0, length / 2]) sphere(d = diameter * joint_scale);
}
color([0.68, 0.72, 0.76]) humanoid_upper_arm();`;

const forearmSource = `// Humanoid forearm
diameter = ${H.forearmDiameter}; // [30:100]
length = ${H.forearmLength}; // [140:340]
joint_scale = ${H.jointScale}; // [1:2]
$fn = 32;
module humanoid_forearm() {
  cylinder(h = length, d = diameter, center = true);
  translate([0, 0, length / 2]) sphere(d = diameter * joint_scale);
}
color([0.74, 0.78, 0.82]) humanoid_forearm();`;

const handSource = `// Humanoid hand
width = ${H.handWidth}; // [50:140]
depth = ${H.handDepth}; // [24:80]
height = ${H.handHeight}; // [60:180]
$fn = 32;
module humanoid_hand() {
  cube([width, depth, height], center = true);
}
color([0.48, 0.52, 0.56]) humanoid_hand();`;

const thighSource = `// Humanoid thigh
diameter = ${H.thighDiameter}; // [60:150]
length = ${H.thighLength}; // [180:420]
joint_scale = ${H.jointScale}; // [1:2]
$fn = 32;
module humanoid_thigh() {
  cylinder(h = length, d = diameter, center = true);
  translate([0, 0, length / 2]) sphere(d = diameter * joint_scale);
}
color([0.62, 0.66, 0.7]) humanoid_thigh();`;

const shinSource = `// Humanoid shin
diameter = ${H.shinDiameter}; // [50:130]
length = ${H.shinLength}; // [180:420]
joint_scale = ${H.jointScale}; // [1:2]
$fn = 32;
module humanoid_shin() {
  cylinder(h = length, d = diameter, center = true);
  translate([0, 0, length / 2]) sphere(d = diameter * joint_scale);
}
color([0.7, 0.74, 0.78]) humanoid_shin();`;

const footSource = `// Humanoid foot
width = ${H.footWidth}; // [80:220]
depth = ${H.footDepth}; // [120:320]
height = ${H.footHeight}; // [40:120]
joint_scale = ${H.jointScale}; // [1:2]
$fn = 32;
module humanoid_foot() {
  cube([width, depth, height], center = true);
  translate([0, 0, height / 2]) sphere(d = height * joint_scale);
}
color([0.22, 0.25, 0.28]) humanoid_foot();`;

function definition(id: string, name: string, source: string, material: string): PartDefinition {
  return {
    id,
    name,
    source,
    params: parseParameters(source),
    material: MATERIALS[material],
    materialMode: "override",
    locked: false,
    revision: 1,
  };
}

function instance(
  id: string,
  definitionId: string,
  name: string,
  parentId: string | null,
  position: Vec3,
): PartInstance {
  const transform = identityTransform();
  transform.position = position;
  return {
    id,
    definitionId,
    name,
    parentId,
    transform,
    visible: true,
    locked: false,
    suppressed: false,
    revision: 1,
  };
}

function group(id: string, name: string, parentId: string | null, position: Vec3): GroupNode {
  const transform = identityTransform();
  transform.position = position;
  return {
    id,
    name,
    parentId,
    transform,
    visible: true,
    locked: false,
    expanded: true,
    revision: 1,
  };
}

export function createHumanoidStudy(): CadDocument {
  const document = createEmptyDocument("Humanoid robot");
  const waistZ = H.torsoZ - H.torsoHeight / 2;
  document.groups = [
    group("group-upper", "Upper body", null, [0, 0, waistZ]),
    group("group-head", "Head", "group-upper", [0, 0, H.neckZ - waistZ]),
    group("group-arm-l", "Left arm", "group-upper", [H.shoulderX, 0, H.shoulderZ - waistZ]),
    group("group-arm-r", "Right arm", "group-upper", [-H.shoulderX, 0, H.shoulderZ - waistZ]),
    group("group-forearm-l", "Left forearm", "group-arm-l", [0, 0, -H.upperArmLength]),
    group("group-forearm-r", "Right forearm", "group-arm-r", [0, 0, -H.upperArmLength]),
    group("group-leg-l", "Left leg", null, [H.hipX, 0, H.hipZ]),
    group("group-leg-r", "Right leg", null, [-H.hipX, 0, H.hipZ]),
    group("group-shin-l", "Left shin", "group-leg-l", [0, 0, -H.thighLength]),
    group("group-shin-r", "Right shin", "group-leg-r", [0, 0, -H.thighLength]),
    group("group-foot-l", "Left foot", "group-shin-l", [0, 0, -H.shinLength]),
    group("group-foot-r", "Right foot", "group-shin-r", [0, 0, -H.shinLength]),
  ];

  document.definitions = [
    definition("def-torso", "Torso", torsoSource, "torso"),
    definition("def-pelvis", "Pelvis", pelvisSource, "pelvis"),
    definition("def-head", "Head", headSource, "head"),
    definition("def-upper-arm", "Upper arm", upperArmSource, "limb"),
    definition("def-forearm", "Forearm", forearmSource, "limb"),
    definition("def-hand", "Hand", handSource, "limb"),
    definition("def-thigh", "Thigh", thighSource, "limb"),
    definition("def-shin", "Shin", shinSource, "limb"),
    definition("def-foot", "Foot", footSource, "foot"),
  ];

  document.instances = [
    instance("inst-torso", "def-torso", "Torso", "group-upper", [0, 0, H.torsoHeight / 2]),
    instance("inst-pelvis", "def-pelvis", "Pelvis", null, [0, 0, H.pelvisZ]),
    instance("inst-head", "def-head", "Head", "group-head", [0, 0, H.headZ]),
  ];

  for (const side of ["l", "r"] as const) {
    const sign = side === "l" ? 1 : -1;
    const armGroup = `group-arm-${side}`;
    const forearmGroup = `group-forearm-${side}`;
    const legGroup = `group-leg-${side}`;
    const shinGroup = `group-shin-${side}`;
    const footGroup = `group-foot-${side}`;
    document.instances.push(
      instance(`inst-upper-arm-${side}`, "def-upper-arm", `Upper arm ${side.toUpperCase()}`, armGroup, [0, 0, -H.upperArmLength / 2]),
      instance(`inst-forearm-${side}`, "def-forearm", `Forearm ${side.toUpperCase()}`, forearmGroup, [0, 0, -H.forearmLength / 2]),
      instance(`inst-hand-${side}`, "def-hand", `Hand ${side.toUpperCase()}`, forearmGroup, [0, 0, -H.forearmLength - H.handHeight / 2]),
      instance(`inst-thigh-${side}`, "def-thigh", `Thigh ${side.toUpperCase()}`, legGroup, [0, 0, -H.thighLength / 2]),
      instance(`inst-shin-${side}`, "def-shin", `Shin ${side.toUpperCase()}`, shinGroup, [0, 0, -H.shinLength / 2]),
      instance(`inst-foot-${side}`, "def-foot", `Foot ${side.toUpperCase()}`, footGroup, [0, -(H.footDepth / 2 - H.footHeight / 2), -H.footHeight / 2]),
    );
    void sign;
  }

  document.drivers = [
    {
      id: "driver-walk",
      name: "walk_phase",
      value: 0,
      min: 0,
      max: H.walkCycle,
      step: 1,
      unit: "deg",
      revision: 1,
    },
  ];

  const joints: Joint[] = [
    {
      id: "joint-waist",
      name: "Waist twist",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-pelvis",
      childGroupId: "group-upper",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-walk",
      expression: `${H.torsoTwist} * sin(angle)`,
    },
    {
      id: "joint-head",
      name: "Head turn",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-torso",
      childGroupId: "group-head",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-walk",
      expression: `${H.headTurn} * sin(angle)`,
    },
  ];

  for (const side of ["l", "r"] as const) {
    const sign = side === "l" ? 1 : -1;
    const hipExpr = `${-sign} * ${H.hipSwing} * sin(angle)`;
    const kneeExpr = `${H.kneeBend} + ${H.kneeLift} * max(0, ${sign} * cos(angle))`;
    joints.push(
      {
        id: `joint-shoulder-${side}`,
        name: `Shoulder ${side.toUpperCase()}`,
        type: "revolute",
        enabled: true,
        revision: 1,
        parentInstanceId: "inst-torso",
        childGroupId: `group-arm-${side}`,
        origin: [0, 0, 0],
        axis: [1, 0, 0],
        driverId: "driver-walk",
        expression: `${sign} * ${H.armSwing} * sin(angle)`,
      },
      {
        id: `joint-elbow-${side}`,
        name: `Elbow ${side.toUpperCase()}`,
        type: "revolute",
        enabled: true,
        revision: 1,
        parentInstanceId: `inst-upper-arm-${side}`,
        childGroupId: `group-forearm-${side}`,
        origin: [0, 0, 0],
        axis: [1, 0, 0],
        driverId: "driver-walk",
        expression: `-(${H.elbowBend} + ${H.elbowSwing} * max(0, ${-sign} * sin(angle)))`,
      },
      {
        id: `joint-hip-${side}`,
        name: `Hip ${side.toUpperCase()}`,
        type: "revolute",
        enabled: true,
        revision: 1,
        parentInstanceId: "inst-pelvis",
        childGroupId: `group-leg-${side}`,
        origin: [0, 0, 0],
        axis: [1, 0, 0],
        driverId: "driver-walk",
        expression: hipExpr,
      },
      {
        id: `joint-knee-${side}`,
        name: `Knee ${side.toUpperCase()}`,
        type: "revolute",
        enabled: true,
        revision: 1,
        parentInstanceId: `inst-thigh-${side}`,
        childGroupId: `group-shin-${side}`,
        origin: [0, 0, 0],
        axis: [1, 0, 0],
        driverId: "driver-walk",
        expression: kneeExpr,
      },
      {
        id: `joint-ankle-${side}`,
        name: `Ankle ${side.toUpperCase()}`,
        type: "revolute",
        enabled: true,
        revision: 1,
        parentInstanceId: `inst-shin-${side}`,
        childGroupId: `group-foot-${side}`,
        origin: [0, 0, 0],
        axis: [1, 0, 0],
        driverId: "driver-walk",
        expression: `-(${hipExpr}) - (${kneeExpr})`,
      },
    );
  }
  document.joints = joints;

  return document;
}
