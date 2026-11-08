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
import { createEmptyDocument, defaultMaterial, identityTransform } from "../../document/defaults";

const D = {
  blockLength: 200,
  blockWidth: 120,
  blockHeight: 70,
  bankAngle: 45,
  bore: 34,
  boreSpacing: 44,
  boreCount: 4,
  headLength: 200,
  headWidth: 64,
  headHeight: 18,
  coverLength: 200,
  coverWidth: 54,
  coverHeight: 22,
  coverRibs: 5,
  coverRibWidth: 6,
  coverRibHeight: 4,
  panLength: 200,
  panWidth: 100,
  panHeight: 30,
  crankLength: 210,
  crankJournal: 22,
  crankThrow: 16,
  crankPin: 14,
  pistonBore: 34,
  pistonHeight: 30,
  pistonPin: 10,
  rodLength: 90,
  rodWidth: 14,
  rodBig: 18,
  rodSmall: 10,
  camLength: 200,
  camJournal: 14,
  camLobe: 18,
  valveStem: 6,
  valveHead: 16,
  valveLength: 42,
  intakeLength: 120,
  intakeWidth: 50,
  intakeHeight: 30,
  intakeRunner: 12,
  intakeRunnerLength: 18,
  endCoverWidth: 120,
  endCoverHeight: 90,
  endCoverThickness: 8,
  endCoverBoss: 30,
  exhaustLength: 190,
  exhaustDiameter: 24,
  exhaustRunner: 14,
  exhaustRunnerLength: 55,
  pulleyDiameter: 50,
  pulleyWidth: 18,
  pulleyHoles: 4,
  pulleyHoleDiameter: 8,
  pulleyHoleMargin: 8,
  flywheelDiameter: 100,
  flywheelWidth: 12,
  flywheelHoles: 6,
  flywheelHoleDiameter: 10,
  flywheelHoleMargin: 12,
  plugDiameter: 10,
  plugLength: 24,
  pistonClearance: 15,
  headClearance: 30,
};

const COLORS: Record<string, MaterialRef> = {
  block: { color: "#5b6168", metalness: 0.35, roughness: 0.52 },
  head: { color: "#8d949a", metalness: 0.42, roughness: 0.44 },
  cover: { color: "#3f464b", metalness: 0.3, roughness: 0.55 },
  pan: { color: "#4a4f54", metalness: 0.28, roughness: 0.58 },
  intake: { color: "#6d7f8c", metalness: 0.25, roughness: 0.5 },
  exhaust: { color: "#a9845a", metalness: 0.55, roughness: 0.38 },
  crank: { color: "#b0b6bc", metalness: 0.65, roughness: 0.3 },
  piston: { color: "#d2d6da", metalness: 0.6, roughness: 0.28 },
  rod: { color: "#9aa2a8", metalness: 0.62, roughness: 0.32 },
  cam: { color: "#b7bdc2", metalness: 0.66, roughness: 0.28 },
  valve: { color: "#c9ced3", metalness: 0.7, roughness: 0.25 },
  plug: { color: "#d8c7a2", metalness: 0.4, roughness: 0.45 },
  pulley: { color: "#7c848a", metalness: 0.45, roughness: 0.42 },
  flywheel: { color: "#6d757b", metalness: 0.5, roughness: 0.4 },
};

const blockSource = `// V8 block
length = ${D.blockLength}; // [140:280]
width = ${D.blockWidth}; // [90:180]
height = ${D.blockHeight}; // [50:120]
bore = ${D.bore}; // [24:50]
bore_spacing = ${D.boreSpacing}; // [32:70]
cylinders = ${D.boreCount}; // [2:6]
$fn = 32;
module v8_block() {
  difference() {
    cube([length, width, height], center = true);
    for (i = [0 : cylinders - 1]) {
      x = (i - (cylinders - 1) / 2) * bore_spacing;
      translate([x, width / 2 / 2, 0])
        cylinder(h = height, d = bore, center = true);
      translate([x, -width / 2 / 2, 0])
        cylinder(h = height, d = bore, center = true);
    }
  }
}
color([0.36, 0.38, 0.4]) v8_block();`;

const headSource = `// V8 cylinder head
length = ${D.headLength}; // [140:280]
width = ${D.headWidth}; // [40:100]
height = ${D.headHeight}; // [10:30]
bore = ${D.bore}; // [24:50]
bore_spacing = ${D.boreSpacing}; // [32:70]
cylinders = ${D.boreCount}; // [2:6]
$fn = 32;
module v8_head() {
  difference() {
    cube([length, width, height], center = true);
    for (i = [0 : cylinders - 1]) {
      x = (i - (cylinders - 1) / 2) * bore_spacing;
      translate([x, 0, 0])
        cylinder(h = height, d = bore, center = true);
    }
  }
}
color([0.55, 0.58, 0.6]) v8_head();`;

const coverSource = `// V8 valve cover
length = ${D.coverLength}; // [140:280]
width = ${D.coverWidth}; // [30:90]
height = ${D.coverHeight}; // [12:40]
ribs = ${D.coverRibs}; // [3:9]
rib_width = ${D.coverRibWidth}; // [2:12]
rib_height = ${D.coverRibHeight}; // [1:8]
$fn = 32;
module v8_cover() {
  cube([length, width, height], center = true);
  for (i = [0 : ribs - 1]) {
    x = (i - (ribs - 1) / 2) * (length / ribs);
    translate([x, 0, height / 2])
      cube([rib_width, width, rib_height], center = true);
  }
}
color([0.24, 0.27, 0.29]) v8_cover();`;

const panSource = `// V8 oil pan
length = ${D.panLength}; // [140:280]
width = ${D.panWidth}; // [60:140]
height = ${D.panHeight}; // [18:60]
$fn = 32;
module v8_pan() {
  cube([length, width, height], center = true);
}
color([0.28, 0.3, 0.32]) v8_pan();`;

const intakeSource = `// V8 intake manifold
length = ${D.intakeLength}; // [80:180]
width = ${D.intakeWidth}; // [30:80]
height = ${D.intakeHeight}; // [18:60]
stacks = ${D.boreCount}; // [2:6]
bore_spacing = ${D.boreSpacing}; // [32:70]
runner = ${D.intakeRunner}; // [6:20]
runner_length = ${D.intakeRunnerLength}; // [8:40]
$fn = 32;
module v8_intake() {
  cube([length, width, height], center = true);
  for (i = [0 : stacks - 1]) {
    x = (i - (stacks - 1) / 2) * bore_spacing;
    translate([x, width / 2 / 2, height / 2 + runner_length / 2])
      cylinder(h = runner_length, d = runner, center = true);
    translate([x, -width / 2 / 2, height / 2 + runner_length / 2])
      cylinder(h = runner_length, d = runner, center = true);
  }
}
color([0.42, 0.5, 0.55]) v8_intake();`;

const endCoverSource = `// V8 end cover
width = ${D.endCoverWidth}; // [80:180]
height = ${D.endCoverHeight}; // [50:140]
thickness = ${D.endCoverThickness}; // [4:20]
boss = ${D.endCoverBoss}; // [16:50]
$fn = 32;
module v8_end_cover() {
  difference() {
    cube([thickness, width, height], center = true);
    rotate([0, 90, 0]) cylinder(h = thickness, d = boss, center = true);
  }
}
color([0.32, 0.35, 0.37]) v8_end_cover();`;

const exhaustSource = `// V8 exhaust manifold
length = ${D.exhaustLength}; // [120:260]
diameter = ${D.exhaustDiameter}; // [14:40]
runner = ${D.exhaustRunner}; // [8:24]
runner_length = ${D.exhaustRunnerLength}; // [30:90]
cylinders = ${D.boreCount}; // [2:6]
bore_spacing = ${D.boreSpacing}; // [32:70]
$fn = 24;
module v8_exhaust() {
  rotate([0, 90, 0]) cylinder(h = length, d = diameter, center = true);
  for (i = [0 : cylinders - 1]) {
    x = (i - (cylinders - 1) / 2) * bore_spacing;
    translate([x, -runner_length / 2, 0])
      rotate([90, 0, 0]) cylinder(h = runner_length, d = runner, center = true);
  }
}
color([0.62, 0.47, 0.32]) v8_exhaust();`;

const crankSource = `// V8 crankshaft
length = ${D.crankLength}; // [150:300]
journal = ${D.crankJournal}; // [14:36]
throw = ${D.crankThrow}; // [8:30]
pin = ${D.crankPin}; // [8:24]
cylinders = ${D.boreCount}; // [2:6]
throws = cylinders;
bore_spacing = ${D.boreSpacing}; // [32:70]
$fn = 32;
module v8_crank() {
  rotate([0, 90, 0]) cylinder(h = length, d = journal, center = true);
  for (i = [0 : throws - 1]) {
    x = (i - (throws - 1) / 2) * bore_spacing;
    translate([x, 0, throw])
      rotate([0, 90, 0]) cylinder(h = pin, d = pin, center = true);
  }
}
color([0.66, 0.69, 0.72]) v8_crank();`;

const pistonSource = `// V8 piston
bore = ${D.pistonBore}; // [24:50]
height = ${D.pistonHeight}; // [18:50]
pin = ${D.pistonPin}; // [5:16]
crank_radius = ${D.crankThrow}; // [8:30]
rod_length = ${D.rodLength}; // [50:140]
$fn = 32;
module v8_piston() {
  difference() {
    cylinder(h = height, d = bore, center = true);
    rotate([0, 90, 0]) cylinder(h = bore, d = pin, center = true);
  }
}
color([0.78, 0.8, 0.82]) v8_piston();`;

const rodSource = `// V8 connecting rod
length = ${D.rodLength}; // [50:140]
width = ${D.rodWidth}; // [8:24]
big = ${D.rodBig}; // [10:30]
small = ${D.rodSmall}; // [6:20]
$fn = 24;
module v8_rod() {
  hull() {
    cylinder(h = width, d = big, center = true);
    translate([0, 0, length]) cylinder(h = width, d = small, center = true);
  }
}
color([0.58, 0.62, 0.65]) v8_rod();`;

const camSource = `// V8 camshaft
length = ${D.camLength}; // [140:280]
journal = ${D.camJournal}; // [8:24]
lobe = ${D.camLobe}; // [10:30]
cylinders = ${D.boreCount}; // [2:6]
bore_spacing = ${D.boreSpacing}; // [32:70]
$fn = 32;
module v8_cam() {
  rotate([0, 90, 0]) cylinder(h = length, d = journal, center = true);
  for (i = [0 : cylinders - 1]) {
    x = (i - (cylinders - 1) / 2) * bore_spacing;
    translate([x, 0, 0]) rotate([0, 0, 90])
      cylinder(h = journal, d = lobe, center = true);
  }
}
color([0.68, 0.71, 0.74]) v8_cam();`;

const valveSource = `// V8 valve
stem = ${D.valveStem}; // [3:10]
head = ${D.valveHead}; // [8:26]
length = ${D.valveLength}; // [24:64]
$fn = 24;
module v8_valve() {
  cylinder(h = length, d = stem, center = true);
  translate([0, 0, -length / 2]) cylinder(h = stem, d = head, center = true);
}
color([0.76, 0.79, 0.82]) v8_valve();`;

const plugSource = `// V8 spark plug
diameter = ${D.plugDiameter}; // [6:18]
length = ${D.plugLength}; // [14:40]
$fn = 16;
module v8_plug() {
  cylinder(h = length, d = diameter, center = true);
}
color([0.8, 0.72, 0.55]) v8_plug();`;

const pulleySource = `// V8 crank pulley
diameter = ${D.pulleyDiameter}; // [30:90]
width = ${D.pulleyWidth}; // [8:30]
bore = ${D.crankJournal}; // [14:36]
holes = ${D.pulleyHoles}; // [3:8]
hole_diameter = ${D.pulleyHoleDiameter}; // [4:16]
hole_margin = ${D.pulleyHoleMargin}; // [4:20]
hole_angle = 360 / holes;
hole_radius = diameter / 2 - hole_margin;
$fn = 32;
module v8_pulley() {
  difference() {
    cylinder(h = width, d = diameter, center = true);
    cylinder(h = width, d = bore, center = true);
    for (i = [0 : holes - 1]) {
      rotate([0, 0, i * hole_angle])
        translate([hole_radius, 0, 0])
          cylinder(h = width, d = hole_diameter, center = true);
    }
  }
}
color([0.45, 0.48, 0.51]) v8_pulley();`;

const flywheelSource = `// V8 flywheel
diameter = ${D.flywheelDiameter}; // [60:150]
width = ${D.flywheelWidth}; // [6:24]
bore = ${D.crankJournal}; // [14:36]
holes = ${D.flywheelHoles}; // [3:10]
hole_diameter = ${D.flywheelHoleDiameter}; // [4:20]
hole_margin = ${D.flywheelHoleMargin}; // [6:30]
hole_angle = 360 / holes;
hole_radius = diameter / 2 - hole_margin;
$fn = 48;
module v8_flywheel() {
  difference() {
    cylinder(h = width, d = diameter, center = true);
    cylinder(h = width, d = bore, center = true);
    for (i = [0 : holes - 1]) {
      rotate([0, 0, i * hole_angle])
        translate([hole_radius, 0, 0])
          cylinder(h = width, d = hole_diameter, center = true);
    }
  }
}
color([0.38, 0.41, 0.44]) v8_flywheel();`;

function definition(id: string, name: string, source: string, color: string): PartDefinition {
  return {
    id,
    name,
    source,
    params: parseParameters(source),
    material: COLORS[color] ?? defaultMaterial(),
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
  visible = true,
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
    visible,
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

export function createV8Study(): CadDocument {
  const document = createEmptyDocument("V8 concept");
  document.library = "";
  document.groups = [
    group("group-block", "Block"),
    group("group-bottom", "Crank train"),
    group("group-heads", "Heads"),
    group("group-valvetrain", "Valvetrain"),
    group("group-induction", "Intake & exhaust"),
    group("group-accessories", "Accessories"),
  ];

  document.definitions = [
    definition("def-block", "Block", blockSource, "block"),
    definition("def-head", "Cylinder head", headSource, "head"),
    definition("def-cover", "Valve cover", coverSource, "cover"),
    definition("def-pan", "Oil pan", panSource, "pan"),
    definition("def-intake", "Intake manifold", intakeSource, "intake"),
    definition("def-end-cover", "End cover", endCoverSource, "cover"),
    definition("def-exhaust", "Exhaust manifold", exhaustSource, "exhaust"),
    definition("def-crank", "Crankshaft", crankSource, "crank"),
    definition("def-piston", "Piston", pistonSource, "piston"),
    definition("def-rod", "Connecting rod", rodSource, "rod"),
    definition("def-cam", "Camshaft", camSource, "cam"),
    definition("def-valve", "Valve", valveSource, "valve"),
    definition("def-plug", "Spark plug", plugSource, "plug"),
    definition("def-pulley", "Crank pulley", pulleySource, "pulley"),
    definition("def-flywheel", "Flywheel", flywheelSource, "flywheel"),
  ];

  const halfLength = D.blockLength / 2;
  const halfWidth = D.blockWidth / 2;
  const halfHeight = D.blockHeight / 2;
  const headY = halfWidth + D.headWidth / 4;
  const pistonZ = halfHeight + D.pistonHeight / 2 + D.pistonClearance;
  const headZ = halfHeight + D.pistonHeight / 2 + D.headHeight / 2 + D.headClearance / 4;
  const coverZ = headZ + D.headHeight / 2 + D.coverHeight / 2;
  const pistonX = (index: number) => {
    const cylinder = index % D.boreCount;
    return (cylinder - (D.boreCount - 1) / 2) * D.boreSpacing;
  };
  const bankRotation = (side: 1 | -1): Vec3 => [D.bankAngle * side, 0, 0];

  document.instances = [
    instance("inst-block", "def-block", "Block", "group-block", [0, 0, 0]),
    instance("inst-pan", "def-pan", "Oil pan", "group-block", [0, 0, -halfHeight - D.panHeight / 2]),
    instance("inst-crank", "def-crank", "Crankshaft", "group-bottom", [0, 0, -halfHeight - D.crankThrow]),
    instance(
      "inst-timing-cover",
      "def-end-cover",
      "Timing cover",
      "group-block",
      [halfLength + D.endCoverThickness / 2, 0, 0],
    ),
    instance(
      "inst-rear-cover",
      "def-end-cover",
      "Rear cover",
      "group-block",
      [-halfLength - D.endCoverThickness / 2, 0, 0],
    ),
    instance(
      "inst-pulley",
      "def-pulley",
      "Crank pulley",
      "group-accessories",
      [halfLength + D.endCoverThickness + D.pulleyWidth / 2, 0, -halfHeight - D.crankThrow],
      [0, 90, 0],
    ),
    instance(
      "inst-flywheel",
      "def-flywheel",
      "Flywheel",
      "group-accessories",
      [-halfLength - D.endCoverThickness - D.flywheelWidth / 2, 0, -halfHeight - D.crankThrow],
      [0, 90, 0],
    ),
    instance("inst-intake", "def-intake", "Intake manifold", "group-induction", [0, 0, halfHeight + D.intakeHeight / 2]),
    instance("inst-exhaust-left", "def-exhaust", "Exhaust left", "group-induction", [0, headY + D.headWidth / 2 + D.exhaustDiameter / 2, halfHeight + D.headHeight / 2]),
    instance("inst-exhaust-right", "def-exhaust", "Exhaust right", "group-induction", [0, -headY - D.headWidth / 2 - D.exhaustDiameter / 2, halfHeight + D.headHeight / 2], [0, 0, 180]),
    instance("inst-head-left", "def-head", "Left head", "group-heads", [0, headY, headZ], bankRotation(1)),
    instance("inst-head-right", "def-head", "Right head", "group-heads", [0, -headY, headZ], bankRotation(-1)),
    instance("inst-cover-left", "def-cover", "Left valve cover", "group-valvetrain", [0, headY, coverZ], bankRotation(1)),
    instance("inst-cover-right", "def-cover", "Right valve cover", "group-valvetrain", [0, -headY, coverZ], bankRotation(-1)),
    instance("inst-cam-left", "def-cam", "Left camshaft", "group-valvetrain", [0, headY, headZ + D.headHeight / 2], bankRotation(1), undefined, false),
    instance("inst-cam-right", "def-cam", "Right camshaft", "group-valvetrain", [0, -headY, headZ + D.headHeight / 2], bankRotation(-1), undefined, false),
  ];

  for (let index = 0; index < D.boreCount * 2; index++) {
    const side: 1 | -1 = index < D.boreCount ? 1 : -1;
    const x = pistonX(index);
    const y = (side * D.blockWidth) / 4;
    const phase = index * 90;
    document.instances.push(
      instance(
        `inst-piston-${index + 1}`,
        "def-piston",
        `Piston ${index + 1}`,
        "group-bottom",
        [x, y, pistonZ],
        bankRotation(side),
        undefined,
        false,
      ),
    );
    document.instances.push(
      instance(
        `inst-rod-${index + 1}`,
        "def-rod",
        `Rod ${index + 1}`,
        "group-bottom",
        [x, y, pistonZ - D.pistonHeight / 2 - D.rodLength / 2],
        [0, 0, 0],
        undefined,
        false,
      ),
    );
    document.instances.push(
      instance(
        `inst-valve-intake-${index + 1}`,
        "def-valve",
        `Intake valve ${index + 1}`,
        "group-valvetrain",
        [x, y, headZ + D.headHeight / 2 + D.valveLength / 2],
        bankRotation(side),
        undefined,
        false,
      ),
      instance(
        `inst-valve-exhaust-${index + 1}`,
        "def-valve",
        `Exhaust valve ${index + 1}`,
        "group-valvetrain",
        [x, y + side * D.headWidth / 2 / 2, headZ + D.headHeight / 2 + D.valveLength / 2],
        bankRotation(side),
        undefined,
        false,
      ),
      instance(
        `inst-plug-${index + 1}`,
        "def-plug",
        `Spark plug ${index + 1}`,
        "group-valvetrain",
        [x, y, headZ + D.headHeight / 2 + D.plugLength / 2],
        bankRotation(side),
        undefined,
        false,
      ),
    );
  }

  document.drivers = [
    {
      id: "driver-crank",
      name: "crank_angle",
      value: 0,
      min: 0,
      max: 720,
      step: 1,
      unit: "deg",
      revision: 1,
    },
  ];

  const phaseExpression = (phase: number) =>
    `(crank_radius * cos(angle - ${phase}) + sqrt(rod_length * rod_length - crank_radius * crank_radius * sin(angle - ${phase}) * sin(angle - ${phase}))) - (crank_radius + rod_length)`;

  const joints: Joint[] = [
    {
      id: "joint-crank",
      name: "Crank rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: "inst-crank",
      origin: [0, 0, 0],
      axis: [1, 0, 0],
      driverId: "driver-crank",
      expression: "angle",
    },
    {
      id: "joint-pulley",
      name: "Pulley rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: "inst-pulley",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-crank",
      expression: "angle",
    },
    {
      id: "joint-flywheel",
      name: "Flywheel rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: "inst-flywheel",
      origin: [0, 0, 0],
      axis: [0, 0, 1],
      driverId: "driver-crank",
      expression: "angle",
    },
    {
      id: "joint-cam-left",
      name: "Left cam rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: "inst-cam-left",
      origin: [0, 0, 0],
      axis: [1, 0, 0],
      driverId: "driver-crank",
      expression: "angle / 2",
    },
    {
      id: "joint-cam-right",
      name: "Right cam rotation",
      type: "revolute",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: "inst-cam-right",
      origin: [0, 0, 0],
      axis: [1, 0, 0],
      driverId: "driver-crank",
      expression: "angle / 2",
    },
  ];

  for (let index = 0; index < D.boreCount * 2; index++) {
    const phase = index * 90;
    joints.push({
      id: `joint-piston-${index + 1}`,
      name: `Piston ${index + 1} stroke`,
      type: "prismatic",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-block",
      childInstanceId: `inst-piston-${index + 1}`,
      axis: [0, 0, 1],
      driverId: "driver-crank",
      expression: phaseExpression(phase),
    });
    joints.push({
      id: `joint-rod-${index + 1}`,
      name: `Rod ${index + 1} link`,
      type: "link",
      enabled: true,
      revision: 1,
      parentInstanceId: "inst-crank",
      childInstanceId: `inst-rod-${index + 1}`,
      targetInstanceId: `inst-piston-${index + 1}`,
      parentPoint: [pistonX(index), 0, D.crankThrow],
      childPoint: [0, 0, 0],
      targetPoint: [0, 0, 0],
      stretch: true,
    });
  }
  document.joints = joints;

  return document;
}
