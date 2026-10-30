export type ScadExample = {
  id: string;
  title: string;
  prompt: string;
  code: string;
};

const knob = `// Knurled control knob
// [Body]
// Overall diameter
diameter = 42; // [24:70]
// Overall height
height = 24; // [12:40]
// Shaft bore diameter
shaft = 6; // [3:12]
// Number of knurl ridges
ridges = 24; // [10:40]
// Depth of each knurl groove
knurl_depth = 1.4; // [0.4:2.8]
// Set screw hole diameter
set_screw = 3; // [2:5]

$fn = 96;

module body() {
  difference() {
    union() {
      cylinder(h = height - 2, d = diameter);
      translate([0, 0, height - 2])
        cylinder(h = 2, d1 = diameter, d2 = diameter - 4);
      translate([0, 0, height - 1])
        cylinder(h = 1.6, d = diameter * 0.38);
    }

    for (i = [0 : ridges - 1]) {
      rotate([0, 0, i * 360 / ridges])
        translate([diameter / 2 - knurl_depth + 0.2, 0, height / 2])
          cube([knurl_depth * 2, knurl_depth * 1.2, height + 2], center = true);
    }

    translate([0, 0, -1]) cylinder(h = height + 2, d = shaft);
    translate([-shaft / 2, 0, -1]) cube([shaft / 2, shaft * 0.35, height + 2]);
    translate([0, 0, height - 1.6]) cylinder(h = 2, d = shaft * 2.4);

    translate([0, 0, height - 7])
      rotate([0, 90, 0]) cylinder(h = diameter + 2, d = set_screw, center = true);
  }
}

color([0.30, 0.31, 0.33]) body();

color([0.80, 0.24, 0.10])
  translate([diameter * 0.16, 0, height + 0.6])
    linear_extrude(height = 1.3)
      polygon([[0, -2.2], [diameter * 0.30, 0], [0, 2.2]]);
`;

const bracket = `// Honeycomb angle bracket
// [Flange]
// Width of both flanges
width = 84; // [50:140]
// Depth of the foot
depth = 80; // [50:140]
// Height of the upright
height = 80; // [40:140]
// Plate thickness
thickness = 5; // [3:10]
// Mounting hole diameter
hole = 5; // [3:8]
// Hex cell across flats
cell = 11; // [6:20]
// Outer corner radius
corner = 7; // [2:14]

$fn = 72;

module plate(w, d) {
  hull() {
    for (x = [corner, w - corner], y = [corner, d - corner])
      translate([x, y, 0]) circle(r = corner);
  }
}

module base() {
  linear_extrude(height = thickness) plate(width, depth);
}

module upright() {
  translate([0, depth - thickness, 0])
    rotate([-90, 0, 0])
      linear_extrude(height = thickness)
        plate(width, height - thickness + 1);
}

module hex_cut(x, y, h) {
  translate([x, y, -1]) cylinder(h = h + 2, d = cell, $fn = 6);
}

module hex_cut_y(x, z) {
  translate([x, depth - thickness / 2, z])
    rotate([90, 0, 0])
      cylinder(h = thickness + 4, d = cell, $fn = 6, center = true);
}

color([0.62, 0.64, 0.66])
  difference() {
    union() {
      base();
      translate([0, 0, thickness]) upright();
    }
    for (x = [13, width - 13], y = [13, depth - 13])
      translate([x, y, -1]) cylinder(h = thickness + 2, d = hole);
    for (x = [width * 0.33, width * 0.67])
      for (y = [depth * 0.4, depth * 0.68])
        hex_cut(x, y, thickness);
    for (x = [13, width - 13])
      translate([x, depth - thickness / 2, thickness + 18])
        rotate([90, 0, 0]) cylinder(h = thickness + 4, d = hole, center = true);
    for (x = [width * 0.33, width * 0.67])
      for (z = [height * 0.35, height * 0.65])
        hex_cut_y(x, thickness + z);
  }

`;

const vase = `// Twisted hexagonal vase
// [Form]
// Overall height
height = 150; // [80:220]
// Base diameter
base_d = 70; // [40:110]
// Mouth diameter
mouth_d = 50; // [30:90]
// Wall thickness
wall = 2.4; // [1.2:5]
// Twist from bottom to top
twist = 120; // [0:240]
// Number of facets
sides = 6; // [3:12]

$fn = 96;

module shell() {
  linear_extrude(height = height, twist = twist, slices = 64, scale = mouth_d / base_d)
    difference() {
      circle(d = base_d, $fn = sides);
      circle(d = base_d - 2 * wall, $fn = sides);
    }
}

color([0.80, 0.74, 0.62]) shell();
color([0.68, 0.61, 0.50])
  linear_extrude(height = wall) circle(d = base_d, $fn = sides);
`;

const gear = `// Spur gear with lightening holes
// [Gear]
// Number of teeth
teeth = 24; // [12:48]
// Module (tooth size)
module_size = 2; // [1:4]
// Gear thickness
thickness = 8; // [4:16]
// Shaft bore
bore = 6; // [3:12]
// Number of lightening holes
holes = 5; // [0:8]
// Hub diameter
hub_d = 16; // [10:26]

$fn = 96;
pitch_d = module_size * teeth;

module teeth() {
  union() {
    circle(d = pitch_d);
    for (i = [0 : teeth - 1]) {
      rotate([0, 0, i * 360 / teeth])
        translate([pitch_d / 2, 0, 0])
          square([module_size * 1.25, module_size * 1.7], center = true);
    }
  }
}

color([0.58, 0.60, 0.63]) {
  difference() {
    union() {
      linear_extrude(height = thickness) teeth();
      cylinder(h = thickness * 1.48, d = hub_d);
    }
    translate([0, 0, -1]) cylinder(h = thickness * 2 + 2, d = bore);
    if (holes > 0)
      for (i = [0 : holes - 1])
        rotate([0, 0, i * 360 / holes])
          translate([pitch_d * 0.28, 0, thickness / 2])
            rotate([90, 0, 0])
              cylinder(h = thickness + 2, d = pitch_d * 0.17, center = true);
  }
}
color([0.82, 0.18, 0.10])
  difference() {
    cylinder(h = thickness * 1.49, d = hub_d * 0.62);
    translate([0, 0, -1]) cylinder(h = thickness * 1.49 + 2, d = bore);
  }
`;

export const SCAD_EXAMPLES: ScadExample[] = [
  {
    id: "knob",
    title: "Knurled control knob",
    prompt:
      "A knurled control knob 42 mm in diameter and 24 mm tall, with a 6 mm D-shaped shaft bore, an M3 set screw and a red pointer on top",
    code: knob,
  },
  {
    id: "bracket",
    title: "Honeycomb angle bracket",
    prompt:
      "A 90 degree mounting bracket with 84 x 80 mm flanges, 5 mm thick, lightened with hexagonal cutouts, four 5 mm mounting holes and rounded corners",
    code: bracket,
  },
  {
    id: "vase",
    title: "Twisted hex vase",
    prompt:
      "A twisted hexagonal vase 150 mm tall, tapering from a 70 mm base to a 50 mm mouth, with 2.4 mm walls and a closed bottom",
    code: vase,
  },
  {
    id: "gear",
    title: "Spur gear",
    prompt:
      "A 24 tooth spur gear with module 2, 8 mm thick, a 6 mm shaft bore, five lightening holes and a raised hub",
    code: gear,
  },
];

export const DEFAULT_EXAMPLE = SCAD_EXAMPLES[0];
