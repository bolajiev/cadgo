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

const T = {
  towerHeight: 1600,
  towerBaseDiameter: 150,
  towerTopDiameter: 80,
  baseFlangeDiameter: 320,
  baseFlangeThickness: 24,
  nacelleWidth: 240,
  nacelleLength: 480,
  nacelleHeight: 220,
  nacelleBodyRatio: 0.66,
  nacelleNoseWidthRatio: 0.55,
  nacelleNoseHeightRatio: 0.62,
  hubDiameter: 150,
  hubLength: 110,
  hubOverlap: 12,
  noseLength: 70,
  bladeCount: 3,
  bladeLength: 1100,
  bladeRootChord: 140,
  bladeTipChord: 60,
  bladeRootThickness: 36,
  bladeTipThickness: 12,
  bladePitch: 16,
};

const MATERIALS: Record<string, MaterialRef> = {
  tower: { color: "#d7dade", metalness: 0.15, roughness: 0.55, opacity: 1 },
  nacelle: { color: "#eef1f4", metalness: 0.25, roughness: 0.4, opacity: 1 },
  rotor: { color: "#f2f5f7", metalness: 0.35, roughness: 0.3, opacity: 1 },
};

const towerSource = `// Wind turbine tower
base_diameter = ${T.towerBaseDiameter}; // [100:220]
top_diameter = ${T.towerTopDiameter}; // [50:140]
height = ${T.towerHeight}; // [800:2400]
flange_diameter = ${T.baseFlangeDiameter}; // [220:460]
flange_thickness = ${T.baseFlangeThickness}; // [10:50]
$fn = 64;
module turbine_tower() {
  cylinder(h = height, d1 = base_diameter, d2 = top_diameter);
  cylinder(h = flange_thickness, d = flange_diameter);
}
color([0.78, 0.8, 0.82]) turbine_tower();`;

const nacelleSource = `// Wind turbine nacelle
width = ${T.nacelleWidth}; // [180:320]
length = ${T.nacelleLength}; // [360:640]
height = ${T.nacelleHeight}; // [160:300]
body_ratio = ${T.nacelleBodyRatio}; // [0.45:0.85]
nose_width_ratio = ${T.nacelleNoseWidthRatio}; // [0.3:0.9]
nose_height_ratio = ${T.nacelleNoseHeightRatio}; // [0.35:0.95]
$fn = 48;
body_length = length * body_ratio;
nose_length = length - body_length;
module turbine_nacelle() {
  hull() {
    translate([0, -length / 2 + body_length / 2, 0])
      cube([width, body_length, height], center = true);
    translate([0, -length / 2 + body_length + nose_length / 2, 0])
      cube([width * nose_width_ratio, nose_length, height * nose_height_ratio], center = true);
  }
}
color([0.9, 0.91, 0.93]) turbine_nacelle();`;

const rotorSource = `// Wind turbine rotor
hub_diameter = ${T.hubDiameter}; // [90:240]
hub_length = ${T.hubLength}; // [60:180]
nose_length = ${T.noseLength}; // [30:140]
blade_count = ${T.bladeCount}; // [2:5]
blade_length = ${T.bladeLength}; // [600:1600]
blade_root_chord = ${T.bladeRootChord}; // [70:220]
blade_tip_chord = ${T.bladeTipChord}; // [30:120]
blade_root_thickness = ${T.bladeRootThickness}; // [16:70]
blade_tip_thickness = ${T.bladeTipThickness}; // [6:30]
blade_pitch = ${T.bladePitch}; // [0:40]
root_radius = hub_diameter / 2;
$fn = 48;
module turbine_rotor() {
  rotate([90, 0, 0]) cylinder(h = hub_length, d = hub_diameter, center = true);
  translate([0, hub_length / 2, 0])
    rotate([-90, 0, 0]) cylinder(h = nose_length, d1 = hub_diameter, d2 = 0);
  for (i = [0 : blade_count - 1])
    rotate([0, i * 360 / blade_count, 0])
      rotate([blade_pitch, 0, 0])
        hull() {
          translate([root_radius + blade_root_chord / 2, 0, 0])
            cube([blade_root_chord, blade_root_thickness, blade_root_chord], center = true);
          translate([blade_length - blade_tip_chord / 2, 0, 0])
            cube([blade_tip_chord, blade_tip_thickness, blade_tip_chord], center = true);
        }
}
color([0.86, 0.88, 0.9]) turbine_rotor();`;

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

function group(id: string, name: string, position: Vec3): GroupNode {
  const transform = identityTransform();
  transform.position = position;
  return {
    id,
    name,
    parentId: null,
    transform,
    visible: true,
    locked: false,
    expanded: true,
    revision: 1,
  };
}

export function createWindTurbineStudy(): CadDocument {
  const document = createEmptyDocument("Wind turbine");
  const nacelleZ = T.towerHeight + T.nacelleHeight / 2;
  const hubY = T.nacelleLength / 2 + T.hubLength / 2 - T.hubOverlap;

  document.groups = [group("group-rotor", "Rotor", [0, hubY, nacelleZ])];

  document.definitions = [
    definition("def-tower", "Tower", towerSource, "tower"),
    definition("def-nacelle", "Nacelle", nacelleSource, "nacelle"),
    definition("def-rotor", "Rotor", rotorSource, "rotor"),
  ];

  document.instances = [
    instance("inst-tower", "def-tower", "Tower", null, [0, 0, 0]),
    instance("inst-nacelle", "def-nacelle", "Nacelle", null, [0, 0, nacelleZ]),
    instance("inst-rotor", "def-rotor", "Rotor", "group-rotor", [0, 0, 0]),
  ];

  document.drivers = [
    {
      id: "driver-rotor",
      name: "rotor_angle",
      value: 0,
      min: 0,
      max: 360,
      step: 1,
      unit: "deg",
      revision: 1,
    },
  ];

  const joints: Joint[] = [
    {
      id: "joint-rotor",
      name: "Rotor spin",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-nacelle",
      childGroupId: "group-rotor",
      origin: [0, 0, 0],
      axis: [0, 1, 0],
      driverId: "driver-rotor",
      expression: "angle",
    },
  ];
  document.joints = joints;

  return document;
}
