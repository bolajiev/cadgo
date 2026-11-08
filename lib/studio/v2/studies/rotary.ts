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

const R = {
  plate: 260,
  plateHeight: 16,
  plateCorner: 40,
  rotorOffset: 80,
  rotorHousing: 104,
  rotorHousingHeight: 26,
  rotorHousingWall: 5,
  centerHole: 90,
  rotorDiameter: 74,
  rotorHeight: 20,
  rotorLobe: 18,
  rotorLobes: 3,
  rotorBore: 16,
  gearDiameter: 84,
  gearThickness: 18,
  gearTeeth: 18,
  gearToothWidth: 1.25,
  gearToothHeight: 1.7,
  gearHub: 30,
  gearHubHeight: 1.2,
  ringOuter: 130,
  ringInner: 108,
  ringThickness: 18,
  sidePlate: 260,
  sidePlateThickness: 5,
  sidePlateCorner: 40,
  shaftDiameter: 16,
  shaftLength: 54,
  boltDiameter: 6,
  boltLength: 14,
  boltHead: 10,
  boltHeadHeight: 4,
  boltCount: 12,
  boltRadius: 112,
};

const MATERIALS: Record<string, MaterialRef> = {
  plate: { color: "#c8d0d8", metalness: 0.2, roughness: 0.35, opacity: 0.24 },
  housing: { color: "#aeb8c2", metalness: 0.3, roughness: 0.3, opacity: 0.35 },
  side: { color: "#d6dde4", metalness: 0.2, roughness: 0.4, opacity: 0.4 },
  rotor: { color: "#42474d", metalness: 0.5, roughness: 0.35, opacity: 1 },
  gear: { color: "#1fd14b", metalness: 0.45, roughness: 0.3, opacity: 1 },
  ring: { color: "#2b3036", metalness: 0.55, roughness: 0.3, opacity: 1 },
  shaft: { color: "#9aa2a8", metalness: 0.65, roughness: 0.3, opacity: 1 },
  bolt: { color: "#b9c0c6", metalness: 0.6, roughness: 0.3, opacity: 1 },
};

const plateSource = `// Rotary mechanism base plate
length = ${R.plate}; // [180:340]
width = ${R.plate}; // [180:340]
height = ${R.plateHeight}; // [8:30]
corner = ${R.plateCorner}; // [20:60]
rotor_offset = ${R.rotorOffset}; // [60:110]
rotor_hole = ${R.rotorHousing}; // [70:140]
center_hole = ${R.centerHole}; // [50:120]
$fn = 64;
module rotary_plate() {
  difference() {
    hull() {
      for (x = [-length / 2 + corner, length / 2 - corner])
        for (y = [-width / 2 + corner, width / 2 - corner])
          translate([x, y, 0]) cylinder(h = height, r = corner, center = true);
    }
    cylinder(h = height + 2, d = center_hole, center = true);
    for (x = [-rotor_offset, rotor_offset])
      for (y = [-rotor_offset, rotor_offset])
        translate([x, y, 0]) cylinder(h = height + 2, d = rotor_hole, center = true);
  }
}
color([0.80, 0.83, 0.87]) rotary_plate();`;

const housingSource = `// Rotary rotor housing
diameter = ${R.rotorHousing}; // [70:140]
height = ${R.rotorHousingHeight}; // [16:42]
wall = ${R.rotorHousingWall}; // [3:10]
$fn = 64;
module rotary_housing() {
  difference() {
    cylinder(h = height, d = diameter, center = true);
    cylinder(h = height + 2, d = diameter - 2 * wall, center = true);
  }
}
color([0.68, 0.73, 0.78]) rotary_housing();`;

const rotorSource = `// Rotary rotor
diameter = ${R.rotorDiameter}; // [50:110]
height = ${R.rotorHeight}; // [12:34]
lobe = ${R.rotorLobe}; // [10:30]
lobes = ${R.rotorLobes}; // [2:5]
bore = ${R.rotorBore}; // [8:24]
$fn = 48;
module rotary_rotor() {
  difference() {
    hull() {
      for (i = [0 : lobes - 1])
        rotate([0, 0, i * 360 / lobes])
          translate([diameter / 2 - lobe / 2, 0, 0])
            cylinder(h = height, d = lobe, center = true);
      cylinder(h = height, d = diameter / 2, center = true);
    }
    cylinder(h = height + 2, d = bore, center = true);
  }
}
color([0.28, 0.30, 0.33]) rotary_rotor();`;

const gearSource = `// Rotary central gear
diameter = ${R.gearDiameter}; // [50:130]
thickness = ${R.gearThickness}; // [10:30]
teeth = ${R.gearTeeth}; // [10:30]
tooth_width = ${R.gearToothWidth}; // [1:1.8]
tooth_height = ${R.gearToothHeight}; // [1:2.2]
hub = ${R.gearHub}; // [16:50]
hub_height = ${R.gearHubHeight}; // [1:1.8]
bore = ${R.rotorBore}; // [8:24]
$fn = 64;
pitch_d = diameter;
module rotary_gear() {
  difference() {
    union() {
      linear_extrude(height = thickness) {
        circle(d = pitch_d);
        for (i = [0 : teeth - 1])
          rotate([0, 0, i * 360 / teeth])
            translate([pitch_d / 2, 0, 0])
              square([pitch_d / teeth * tooth_width, pitch_d / teeth * tooth_height], center = true);
      }
      cylinder(h = thickness * hub_height, d = hub);
    }
    translate([0, 0, -1]) cylinder(h = thickness * hub_height + 2, d = bore);
  }
}
color([0.16, 0.72, 0.30]) rotary_gear();`;

const ringSource = `// Rotary ring gear
outer = ${R.ringOuter}; // [90:180]
inner = ${R.ringInner}; // [70:140]
thickness = ${R.ringThickness}; // [10:30]
$fn = 64;
module rotary_ring() {
  difference() {
    cylinder(h = thickness, d = outer, center = true);
    cylinder(h = thickness + 2, d = inner, center = true);
  }
}
color([0.20, 0.22, 0.25]) rotary_ring();`;

const sideSource = `// Rotary side plate
length = ${R.sidePlate}; // [180:340]
width = ${R.sidePlate}; // [180:340]
thickness = ${R.sidePlateThickness}; // [3:10]
corner = ${R.sidePlateCorner}; // [20:60]
$fn = 64;
module rotary_side() {
  hull() {
    for (x = [-length / 2 + corner, length / 2 - corner])
      for (y = [-width / 2 + corner, width / 2 - corner])
        translate([x, y, 0]) cylinder(h = thickness, r = corner, center = true);
  }
}
color([0.78, 0.81, 0.85]) rotary_side();`;

const shaftSource = `// Rotary shaft
diameter = ${R.shaftDiameter}; // [8:30]
length = ${R.shaftLength}; // [24:90]
$fn = 32;
module rotary_shaft() {
  cylinder(h = length, d = diameter, center = true);
}
color([0.55, 0.58, 0.61]) rotary_shaft();`;

const boltSource = `// Rotary bolt
diameter = ${R.boltDiameter}; // [3:12]
length = ${R.boltLength}; // [8:30]
head = ${R.boltHead}; // [6:18]
head_height = ${R.boltHeadHeight}; // [2:8]
$fn = 24;
module rotary_bolt() {
  cylinder(h = length, d = diameter, center = true);
  translate([0, 0, length / 2 + head_height / 2])
    cylinder(h = head_height, d = head, center = true);
}
color([0.72, 0.75, 0.78]) rotary_bolt();`;

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
  rotation: Vec3 = [0, 0, 0],
  paramOverrides?: Record<string, number>,
): PartInstance {
  const transform = identityTransform();
  transform.position = position;
  transform.rotation = rotation;
  return {
    id,
    definitionId,
    name,
    parentId,
    transform,
    paramOverrides,
    visible: true,
    locked: false,
    suppressed: false,
    revision: 1,
  };
}

function group(id: string, name: string): GroupNode {
  return {
    id,
    name,
    parentId: null,
    transform: identityTransform(),
    visible: true,
    locked: false,
    expanded: true,
    revision: 1,
  };
}

export function createRotaryStudy(): CadDocument {
  const document = createEmptyDocument("Rotary mechanism");
  document.groups = [
    group("group-housing", "Housing"),
    group("group-rotors", "Rotors"),
    group("group-drive", "Drive"),
    group("group-fasteners", "Fasteners"),
  ];

  document.definitions = [
    definition("def-plate", "Base plate", plateSource, "plate"),
    definition("def-housing", "Rotor housing", housingSource, "housing"),
    definition("def-rotor", "Rotor", rotorSource, "rotor"),
    definition("def-gear", "Central gear", gearSource, "gear"),
    definition("def-ring", "Ring gear", ringSource, "ring"),
    definition("def-side", "Side plate", sideSource, "side"),
    definition("def-shaft", "Shaft", shaftSource, "shaft"),
    definition("def-bolt", "Bolt", boltSource, "bolt"),
  ];

  const sideZ = R.plateHeight / 2 + R.sidePlateThickness / 2;
  document.instances = [
    instance("inst-plate", "def-plate", "Base plate", "group-housing", [0, 0, 0]),
    instance("inst-side-top", "def-side", "Top side plate", "group-housing", [0, 0, sideZ]),
    instance("inst-side-bottom", "def-side", "Bottom side plate", "group-housing", [0, 0, -sideZ]),
    instance("inst-gear", "def-gear", "Central gear", "group-drive", [0, 0, 0]),
    instance("inst-ring", "def-ring", "Ring gear", "group-drive", [0, 0, 0]),
    instance("inst-center-shaft", "def-shaft", "Center shaft", "group-drive", [0, 0, 0]),
    instance("inst-center-bolt", "def-bolt", "Center bolt", "group-drive", [0, 0, sideZ]),
  ];

  const phases = [0, 90, 180, 270];
  for (let index = 0; index < phases.length; index++) {
    const x = index % 2 === 0 ? -R.rotorOffset : R.rotorOffset;
    const y = index < 2 ? -R.rotorOffset : R.rotorOffset;
    const phase = phases[index];
    document.instances.push(
      instance(
        `inst-housing-${index + 1}`,
        "def-housing",
        `Rotor housing ${index + 1}`,
        "group-housing",
        [x, y, 0],
      ),
      instance(
        `inst-rotor-${index + 1}`,
        "def-rotor",
        `Rotor ${index + 1}`,
        "group-rotors",
        [x, y, 0],
        [0, 0, phase],
      ),
      instance(
        `inst-shaft-${index + 1}`,
        "def-shaft",
        `Rotor shaft ${index + 1}`,
        "group-drive",
        [x, y, 0],
      ),
    );
  }

  for (let index = 0; index < R.boltCount; index++) {
    const angle = (index / R.boltCount) * Math.PI * 2;
    document.instances.push(
      instance(
        `inst-bolt-${index + 1}`,
        "def-bolt",
        `Housing bolt ${index + 1}`,
        "group-fasteners",
        [Math.cos(angle) * R.boltRadius, Math.sin(angle) * R.boltRadius, sideZ],
      ),
    );
  }

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
      id: "joint-gear",
      name: "Central gear rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-plate",
      childInstanceId: "inst-gear",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-rotor",
      expression: "angle",
    },
    {
      id: "joint-center-shaft",
      name: "Center shaft rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-plate",
      childInstanceId: "inst-center-shaft",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-rotor",
      expression: "angle",
    },
  ];

  for (let index = 0; index < phases.length; index++) {
    const phase = phases[index];
    joints.push({
      id: `joint-rotor-${index + 1}`,
      name: `Rotor ${index + 1} rotation`,
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-plate",
      childInstanceId: `inst-rotor-${index + 1}`,
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-rotor",
      expression: `angle + ${phase}`,
    });
    joints.push({
      id: `joint-shaft-${index + 1}`,
      name: `Rotor shaft ${index + 1} rotation`,
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-plate",
      childInstanceId: `inst-shaft-${index + 1}`,
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-rotor",
      expression: `angle + ${phase}`,
    });
  }
  document.joints = joints;

  return document;
}
