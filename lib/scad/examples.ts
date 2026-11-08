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
// Top chamfer depth
chamfer = 4; // [1:8]
// Cap height
cap_height = 1.6; // [0.8:3]
// Cap diameter ratio
cap_ratio = 0.38; // [0.2:0.6]
// Knurl clearance
knurl_clearance = 0.2; // [0.05:0.4]
// Knurl width ratio
knurl_width_ratio = 1.2; // [0.8:1.6]
// D-flat ratio
flat_ratio = 0.35; // [0.2:0.5]
// Shaft boss ratio
shaft_boss_ratio = 2.4; // [1.8:3.2]
// Set screw drop from top
set_screw_drop = 7; // [3:12]
// Pointer x ratio
pointer_x_ratio = 0.16; // [0.1:0.25]
// Pointer lift above the body
pointer_lift = 0.6; // [0.2:1.2]
// Pointer height
pointer_height = 1.3; // [0.6:2]
// Pointer tip half-width
pointer_tip = 2.2; // [1:4]
// Pointer length ratio
pointer_length_ratio = 0.30; // [0.2:0.4]

$fn = 96;

module body() {
  difference() {
    union() {
      cylinder(h = height - 2, d = diameter);
      translate([0, 0, height - 2])
        cylinder(h = 2, d1 = diameter, d2 = diameter - chamfer);
      translate([0, 0, height - 1])
        cylinder(h = cap_height, d = diameter * cap_ratio);
    }

    for (i = [0 : ridges - 1]) {
      rotate([0, 0, i * 360 / ridges])
        translate([diameter / 2 - knurl_depth + knurl_clearance, 0, height / 2])
          cube([knurl_depth * 2, knurl_depth * knurl_width_ratio, height + 2], center = true);
    }

    translate([0, 0, -1]) cylinder(h = height + 2, d = shaft);
    translate([-shaft / 2, 0, -1]) cube([shaft / 2, shaft * flat_ratio, height + 2]);
    translate([0, 0, height - cap_height]) cylinder(h = 2, d = shaft * shaft_boss_ratio);

    translate([0, 0, height - set_screw_drop])
      rotate([0, 90, 0]) cylinder(h = diameter + 2, d = set_screw, center = true);
  }
}

color([0.30, 0.31, 0.33]) body();

color([0.80, 0.24, 0.10])
  translate([diameter * pointer_x_ratio, 0, height + pointer_lift])
    linear_extrude(height = pointer_height)
      polygon([[0, -pointer_tip], [diameter * pointer_length_ratio, 0], [0, pointer_tip]]);
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
// Hex cutter clearance
hex_margin = 4; // [1:8]
// Mounting hole inset
hole_inset = 13; // [8:24]
// First hex column ratio
hex_x_1 = 0.33; // [0.2:0.45]
// Second hex column ratio
hex_x_2 = 0.67; // [0.55:0.8]
// First hex row ratio
hex_y_1 = 0.4; // [0.25:0.5]
// Second hex row ratio
hex_y_2 = 0.68; // [0.5:0.8]
// Upright mounting hole lift
upright_hole_lift = 18; // [10:30]
// First upright hex ratio
hex_z_1 = 0.35; // [0.2:0.45]
// Second upright hex ratio
hex_z_2 = 0.65; // [0.55:0.8]
// Hex cutter sides
hex_sides = 6; // [4:8]

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
  translate([x, y, -1]) cylinder(h = h + 2, d = cell, $fn = hex_sides);
}

module hex_cut_y(x, z) {
  translate([x, depth - thickness / 2, z])
    rotate([90, 0, 0])
      cylinder(h = thickness + hex_margin, d = cell, $fn = hex_sides, center = true);
}

color([0.62, 0.64, 0.66])
  difference() {
    union() {
      base();
      translate([0, 0, thickness]) upright();
    }
    for (x = [hole_inset, width - hole_inset], y = [hole_inset, depth - hole_inset])
      translate([x, y, -1]) cylinder(h = thickness + 2, d = hole);
    for (x = [width * hex_x_1, width * hex_x_2])
      for (y = [depth * hex_y_1, depth * hex_y_2])
        hex_cut(x, y, thickness);
    for (x = [hole_inset, width - hole_inset])
      translate([x, depth - thickness / 2, thickness + upright_hole_lift])
        rotate([90, 0, 0]) cylinder(h = thickness + hex_margin, d = hole, center = true);
    for (x = [width * hex_x_1, width * hex_x_2])
      for (z = [height * hex_z_1, height * hex_z_2])
        hex_cut_y(x, thickness + z);
  }
`;



const plate = `// Mounting plate
// Overall length
length = 100; // [40:240]
// Overall width
width = 60; // [30:160]
// Plate thickness
thickness = 8; // [3:20]
// Corner radius
corner = 3; // [1:12]
// Mounting hole diameter
hole = 5; // [2:10]
// Hole inset from the edge
inset = 10; // [5:30]

$fn = 48;

module mounting_plate() {
  difference() {
    hull() {
      for (x = [-length / 2 + corner, length / 2 - corner])
        for (y = [-width / 2 + corner, width / 2 - corner])
          translate([x, y, 0]) cylinder(h = thickness, r = corner, center = true);
    }
    for (x = [-length / 2 + inset, length / 2 - inset])
      for (y = [-width / 2 + inset, width / 2 - inset])
        translate([x, y, 0]) cylinder(h = thickness + 2, d = hole, center = true);
  }
}

color([0.55, 0.58, 0.62]) mounting_plate();
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
// Tooth width ratio
tooth_width_ratio = 1.25; // [1:1.6]
// Tooth height ratio
tooth_height_ratio = 1.7; // [1.3:2.2]
// Hub height ratio
hub_height_ratio = 1.48; // [1.2:1.8]
// Lightening hole radius ratio
hole_radius_ratio = 0.28; // [0.15:0.4]
// Lightening hole diameter ratio
hole_diameter_ratio = 0.17; // [0.08:0.3]
// Hub cap height ratio
hub_cap_ratio = 1.49; // [1.2:1.8]
// Hub cap diameter ratio
hub_cap_diameter_ratio = 0.62; // [0.4:0.8]

$fn = 96;
pitch_d = module_size * teeth;

module teeth() {
  union() {
    circle(d = pitch_d);
    for (i = [0 : teeth - 1]) {
      rotate([0, 0, i * 360 / teeth])
        translate([pitch_d / 2, 0, 0])
          square([module_size * tooth_width_ratio, module_size * tooth_height_ratio], center = true);
    }
  }
}

color([0.58, 0.60, 0.63]) {
  difference() {
    union() {
      linear_extrude(height = thickness) teeth();
      cylinder(h = thickness * hub_height_ratio, d = hub_d);
    }
    translate([0, 0, -1]) cylinder(h = thickness * 2 + 2, d = bore);
    if (holes > 0)
      for (i = [0 : holes - 1])
        rotate([0, 0, i * 360 / holes])
          translate([pitch_d * hole_radius_ratio, 0, thickness / 2])
            rotate([90, 0, 0])
              cylinder(h = thickness + 2, d = pitch_d * hole_diameter_ratio, center = true);
  }
}
color([0.82, 0.18, 0.10])
  difference() {
    cylinder(h = thickness * hub_cap_ratio, d = hub_d * hub_cap_diameter_ratio);
    translate([0, 0, -1]) cylinder(h = thickness * hub_cap_ratio + 2, d = bore);
  }
`;

const cover = `// Project box cover
// [Plate]
length = 120; // [60:240]
width = 80; // [40:180]
thickness = 4; // [2:10]
corner = 6; // [2:20]
// [Lip]
lip_height = 4; // [1:12]
lip_thickness = 2; // [1:6]
lip_clearance = 0.3; // [0.1:1.5]
// [Screws]
screw_diameter = 4.2; // [2:8]
screw_inset = 10; // [4:30]
screw_count_x = 2; // [2:4]
screw_count_y = 2; // [2:4]
$fn = 64;

module rounded_box(l, w, h, r) {
  hull() {
    for (x = [-l / 2 + r, l / 2 - r])
      for (y = [-w / 2 + r, w / 2 - r])
        translate([x, y, 0]) cylinder(h = h, r = r);
  }
}

module cover() {
  difference() {
    union() {
      translate([0, 0, lip_height]) rounded_box(length, width, thickness, corner);
      difference() {
        rounded_box(length - lip_clearance * 2, width - lip_clearance * 2, lip_height, max(corner - lip_clearance, lip_thickness));
        translate([0, 0, -1])
          rounded_box(
            length - lip_clearance * 2 - lip_thickness * 2,
            width - lip_clearance * 2 - lip_thickness * 2,
            lip_height + 2,
            max(corner - lip_clearance - lip_thickness, lip_thickness)
          );
      }
    }
    for (i = [0 : screw_count_x - 1])
      for (j = [0 : screw_count_y - 1]) {
        x = -length / 2 + screw_inset + i * (length - screw_inset * 2) / (screw_count_x - 1);
        y = -width / 2 + screw_inset + j * (width - screw_inset * 2) / (screw_count_y - 1);
        translate([x, y, lip_height - 1]) cylinder(h = thickness + 2, d = screw_diameter);
      }
  }
}
color([0.82, 0.84, 0.86]) cover();`;

const adapter = `// Stepped pipe adapter
large_diameter = 34; // [18:80]
small_diameter = 22; // [12:60]
large_length = 24; // [10:80]
small_length = 36; // [10:120]
flange_diameter = 46; // [24:100]
flange_thickness = 5; // [2:12]
bore_large = 28; // [10:70]
bore_small = 16; // [6:50]
$fn = 64;

module pipe_adapter() {
  difference() {
    union() {
      cylinder(h = flange_thickness, d = flange_diameter);
      translate([0, 0, flange_thickness])
        cylinder(h = large_length, d = large_diameter);
      translate([0, 0, flange_thickness + large_length])
        cylinder(h = small_length, d1 = large_diameter, d2 = small_diameter);
    }
    translate([0, 0, -1])
      cylinder(h = flange_thickness + large_length + 2, d = bore_large);
    translate([0, 0, -1])
      cylinder(h = flange_thickness + large_length + small_length + 2, d = bore_small);
  }
}
color([0.62, 0.64, 0.66]) pipe_adapter();`;

const foot = `// Replacement furniture foot
top_diameter = 42; // [20:90]
bottom_diameter = 34; // [16:80]
height = 26; // [10:60]
pad_diameter = 28; // [10:70]
pad_depth = 2; // [1:8]
pilot_diameter = 4; // [2:8]
pilot_depth = 12; // [4:30]
$fn = 64;

module furniture_foot() {
  difference() {
    cylinder(h = height, d1 = bottom_diameter, d2 = top_diameter);
    translate([0, 0, height - pilot_depth])
      cylinder(h = pilot_depth + 1, d = pilot_diameter);
    translate([0, 0, -1])
      cylinder(h = pad_depth + 1, d = pad_diameter);
  }
}
color([0.24, 0.22, 0.2]) furniture_foot();`;

const clip = `// Screw-mounted desk cable clip
cable_diameter = 8; // [3:20]
wall = 3; // [1.5:6]
clip_width = 12; // [6:30]
gap = 4; // [1:10]
base_length = 36; // [20:80]
base_width = 18; // [10:40]
base_thickness = 4; // [2:10]
screw_diameter = 4; // [2:8]
screw_inset = 6; // [3:15]
ring_overlap = 2; // [1:4]
$fn = 64;
ring_radius = cable_diameter / 2 + wall;
ring_x = -base_length / 2 + ring_radius + wall;
ring_z = base_thickness + ring_radius - ring_overlap;

module desk_cable_clip() {
  difference() {
    union() {
      translate([-base_length / 2, -base_width / 2, 0])
        cube([base_length, base_width, base_thickness]);
      translate([ring_x, 0, ring_z])
        rotate([90, 0, 0])
          cylinder(h = clip_width, d = ring_radius * 2, center = true);
    }
    translate([ring_x, 0, ring_z])
      rotate([90, 0, 0])
        cylinder(h = clip_width + 2, d = cable_diameter, center = true);
    translate([ring_x, 0, ring_z + (ring_radius + cable_diameter / 2 + 1) / 2])
      cube([gap, clip_width + 2, ring_radius - cable_diameter / 2 + 1], center = true);
    translate([base_length / 2 - screw_inset, 0, -1])
      cylinder(h = base_thickness + 2, d = screw_diameter);
  }
}
color([0.18, 0.2, 0.22]) desk_cable_clip();`;


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
    id: "plate",
    title: "Mounting plate",
    prompt:
      "A 100 x 60 x 8 mm mounting plate with four 5 mm holes inset 10 mm from the edges and 3 mm rounded corners",
    code: plate,
  },
  {
    id: "gear",
    title: "Spur gear",
    prompt:
      "A 24 tooth spur gear with module 2, 8 mm thick, a 6 mm shaft bore, five lightening holes and a raised hub",
    code: gear,
  },
  {
    id: "cover",
    title: "Project box cover",
    prompt:
      "A screw-down project box cover, 120 x 80 mm, with a locating lip, rounded corners and four M4 clearance holes",
    code: cover,
  },
  {
    id: "adapter",
    title: "Pipe adapter",
    prompt:
      "A stepped pipe adapter with a 46 mm flange, a 34 mm large end, a 22 mm small end and a through bore",
    code: adapter,
  },
  {
    id: "foot",
    title: "Furniture foot",
    prompt:
      "A replacement furniture foot with a tapered body, a blind screw pilot and a recessed felt pad seat",
    code: foot,
  },
  {
    id: "clip",
    title: "Desk cable clip",
    prompt:
      "A screw-mounted desk cable clip for an 8 mm cable, with a C-ring, a snap-in slot and one mounting hole",
    code: clip,
  },
];

export const DEFAULT_EXAMPLE = SCAD_EXAMPLES[0];
