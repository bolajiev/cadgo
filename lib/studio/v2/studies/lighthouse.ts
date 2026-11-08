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

const L = {
  rockDiameter: 1800,
  rockTopRatio: 0.82,
  rockHeight: 260,
  rockSides: 7,
  padDiameter: 840,
  padHeight: 40,
  towerBaseDiameter: 420,
  towerTopDiameter: 250,
  towerHeight: 2600,
  towerBandCount: 4,
  towerBandPhase: 0.5,
  towerBandHeight: 28,
  towerBandRatio: 1.04,
  doorWidth: 120,
  doorHeight: 220,
  doorDepth: 60,
  doorZ: 20,
  windowCount: 4,
  windowDiameter: 54,
  windowDepth: 60,
  windowStart: 700,
  windowStep: 520,
  lampDeckDiameter: 620,
  lampDeckThickness: 40,
  lampGlassDiameter: 520,
  lampGlassHeight: 460,
  lampMullionCount: 8,
  lampMullionWidth: 24,
  lampMullionDepth: 20,
  lampTopHeight: 30,
  capRimDiameter: 660,
  capRimHeight: 40,
  capConeHeight: 260,
  capFinialDiameter: 60,
  beaconMastDiameter: 36,
  beaconMastHeight: 220,
  beaconDrumDiameter: 180,
  beaconDrumHeight: 140,
  beaconLensDiameter: 120,
  beaconLensHeight: 90,
  beaconFinCount: 4,
  beaconFinWidth: 18,
  beaconFinDepth: 80,
  beaconFinHeight: 120,
};

const MATERIALS: Record<string, MaterialRef> = {
  rock: { color: "#666a6d", metalness: 0.05, roughness: 0.95, opacity: 1 },
  tower: { color: "#e8e6de", metalness: 0.05, roughness: 0.7, opacity: 1 },
  lamp: { color: "#bcd8e8", metalness: 0.1, roughness: 0.15, opacity: 0.32 },
  cap: { color: "#b3271e", metalness: 0.2, roughness: 0.4, opacity: 1 },
  beacon: { color: "#2c3034", metalness: 0.6, roughness: 0.3, opacity: 1 },
};

const rockSource = `// Lighthouse rock base
rock_diameter = ${L.rockDiameter}; // [1200:2600]
rock_top_ratio = ${L.rockTopRatio}; // [0.6:0.98]
rock_height = ${L.rockHeight}; // [120:520]
rock_sides = ${L.rockSides}; // [5:12]
pad_diameter = ${L.padDiameter}; // [500:1200]
pad_height = ${L.padHeight}; // [10:100]
$fn = 48;
module lighthouse_rock() {
  cylinder(h = rock_height, d1 = rock_diameter, d2 = rock_diameter * rock_top_ratio, $fn = rock_sides);
  translate([0, 0, rock_height - pad_height / 2])
    cylinder(h = pad_height, d = pad_diameter);
}
color([0.4, 0.41, 0.42]) lighthouse_rock();`;

const towerSource = `// Lighthouse tower
base_diameter = ${L.towerBaseDiameter}; // [260:600]
top_diameter = ${L.towerTopDiameter}; // [160:380]
height = ${L.towerHeight}; // [1800:4200]
band_count = ${L.towerBandCount}; // [2:8]
band_phase = ${L.towerBandPhase}; // [0.1:0.9]
band_height = ${L.towerBandHeight}; // [10:60]
band_ratio = ${L.towerBandRatio}; // [1:1.15]
door_width = ${L.doorWidth}; // [70:200]
door_height = ${L.doorHeight}; // [140:320]
door_depth = ${L.doorDepth}; // [30:120]
door_z = ${L.doorZ}; // [0:100]
window_count = ${L.windowCount}; // [2:8]
window_diameter = ${L.windowDiameter}; // [24:100]
window_depth = ${L.windowDepth}; // [30:120]
window_start = ${L.windowStart}; // [300:1200]
window_step = ${L.windowStep}; // [300:800]
$fn = 48;
module lighthouse_tower() {
  difference() {
    union() {
      cylinder(h = height, d1 = base_diameter, d2 = top_diameter);
      for (i = [0 : band_count - 1]) {
        z = height * (i + band_phase) / band_count;
        translate([0, 0, z])
          cylinder(h = band_height, d1 = base_diameter * band_ratio, d2 = top_diameter * band_ratio, center = true);
      }
    }
    translate([0, -base_diameter / 2 + door_depth / 2, door_z + door_height / 2])
      cube([door_width, door_depth, door_height], center = true);
    for (i = [0 : window_count - 1]) {
      z = window_start + i * window_step;
      rotate([0, 0, i * 360 / window_count])
        translate([0, -base_diameter / 2, z])
          rotate([90, 0, 0])
            cylinder(h = window_depth, d = window_diameter, center = true);
    }
  }
}
color([0.91, 0.9, 0.86]) lighthouse_tower();`;

const lampSource = `// Lighthouse lamp room
deck_diameter = ${L.lampDeckDiameter}; // [420:900]
deck_thickness = ${L.lampDeckThickness}; // [20:80]
glass_diameter = ${L.lampGlassDiameter}; // [320:760]
glass_height = ${L.lampGlassHeight}; // [280:700]
mullion_count = ${L.lampMullionCount}; // [4:16]
mullion_width = ${L.lampMullionWidth}; // [10:50]
mullion_depth = ${L.lampMullionDepth}; // [8:40]
top_height = ${L.lampTopHeight}; // [10:60]
$fn = 48;
module lighthouse_lamp_room() {
  cylinder(h = deck_thickness, d = deck_diameter);
  translate([0, 0, deck_thickness])
    cylinder(h = glass_height, d = glass_diameter);
  for (i = [0 : mullion_count - 1])
    rotate([0, 0, i * 360 / mullion_count])
      translate([glass_diameter / 2, 0, deck_thickness + glass_height / 2])
        cube([mullion_depth, mullion_width, glass_height], center = true);
  translate([0, 0, deck_thickness + glass_height])
    cylinder(h = top_height, d = deck_diameter);
}
color([0.62, 0.78, 0.86]) lighthouse_lamp_room();`;

const capSource = `// Lighthouse cap
rim_diameter = ${L.capRimDiameter}; // [460:900]
rim_height = ${L.capRimHeight}; // [20:80]
cone_height = ${L.capConeHeight}; // [120:420]
finial_diameter = ${L.capFinialDiameter}; // [20:120]
$fn = 48;
module lighthouse_cap() {
  cylinder(h = rim_height, d = rim_diameter);
  translate([0, 0, rim_height])
    cylinder(h = cone_height, d1 = rim_diameter, d2 = 0);
  translate([0, 0, rim_height + cone_height])
    sphere(d = finial_diameter);
}
color([0.72, 0.14, 0.11]) lighthouse_cap();`;

const beaconSource = `// Lighthouse beacon
mast_diameter = ${L.beaconMastDiameter}; // [18:70]
mast_height = ${L.beaconMastHeight}; // [120:360]
drum_diameter = ${L.beaconDrumDiameter}; // [100:320]
drum_height = ${L.beaconDrumHeight}; // [80:260]
lens_diameter = ${L.beaconLensDiameter}; // [60:220]
lens_height = ${L.beaconLensHeight}; // [40:180]
fin_count = ${L.beaconFinCount}; // [2:8]
fin_width = ${L.beaconFinWidth}; // [8:40]
fin_depth = ${L.beaconFinDepth}; // [30:140]
fin_height = ${L.beaconFinHeight}; // [40:220]
$fn = 32;
module lighthouse_beacon() {
  cylinder(h = mast_height, d = mast_diameter);
  translate([0, 0, mast_height])
    cylinder(h = drum_height, d = drum_diameter);
  translate([0, 0, mast_height + drum_height])
    cylinder(h = lens_height, d = lens_diameter);
  for (i = [0 : fin_count - 1])
    rotate([0, 0, i * 360 / fin_count])
      translate([drum_diameter / 2, 0, mast_height + drum_height / 2])
        cube([fin_depth, fin_width, fin_height], center = true);
}
color([0.18, 0.19, 0.21]) lighthouse_beacon();`;

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

export function createLighthouseStudy(): CadDocument {
  const document = createEmptyDocument("Lighthouse");
  const rockTop = L.rockHeight + L.padHeight / 2;
  const towerTop = rockTop + L.towerHeight;
  const lampDeckTop = towerTop + L.lampDeckThickness;
  const lampTop = lampDeckTop + L.lampGlassHeight + L.lampTopHeight;

  document.groups = [group("group-beacon", "Beacon", [0, 0, lampDeckTop])];

  document.definitions = [
    definition("def-rock", "Rock base", rockSource, "rock"),
    definition("def-tower", "Tower", towerSource, "tower"),
    definition("def-lamp", "Lamp room", lampSource, "lamp"),
    definition("def-cap", "Cap", capSource, "cap"),
    definition("def-beacon", "Beacon", beaconSource, "beacon"),
  ];

  document.instances = [
    instance("inst-rock", "def-rock", "Rock base", null, [0, 0, 0]),
    instance("inst-tower", "def-tower", "Tower", null, [0, 0, rockTop]),
    instance("inst-lamp", "def-lamp", "Lamp room", null, [0, 0, towerTop]),
    instance("inst-cap", "def-cap", "Cap", null, [0, 0, lampTop]),
    instance("inst-beacon", "def-beacon", "Beacon", "group-beacon", [0, 0, 0]),
  ];

  document.drivers = [
    {
      id: "driver-beacon",
      name: "beacon_angle",
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
      id: "joint-beacon",
      name: "Beacon spin",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-lamp",
      childGroupId: "group-beacon",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-beacon",
      expression: "angle",
    },
  ];
  document.joints = joints;

  return document;
}
