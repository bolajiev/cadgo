import OpenSCAD from "./openscad.js";

const scope = self;

function send(message, transfer = []) {
  scope.postMessage(message, transfer);
}

function cleanLogs(lines) {
  return lines
    .join("\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-30)
    .join("\n");
}

function paramArgs(params) {
  const args = [];
  for (const [name, value] of Object.entries(params || {})) {
    if (typeof value === "number" && Number.isFinite(value)) {
      args.push(`-D${name}=${value}`);
    } else if (typeof value === "boolean") {
      args.push(`-D${name}=${value ? "true" : "false"}`);
    } else if (typeof value === "string") {
      args.push(`-D${name}="${value.replace(/["\\]/g, "\\$&")}"`);
    }
  }
  return args;
}

function parseOff(text) {
  const raw = text.replace(/\r/g, "").split("\n");
  const lines = raw.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  if (!lines.length) throw new Error("The kernel returned an empty mesh");
  let cursor = 0;
  const header = lines[cursor++];
  if (!/^OFF(\s|$)/.test(header)) throw new Error("The kernel did not return an OFF mesh");
  const countsLine = header.length > 3 ? header.slice(3).trim() : lines[cursor++];
  const counts = countsLine.split(/\s+/).map(Number);
  const vertexCount = counts[0];
  const faceCount = counts[1];
  if (!Number.isFinite(vertexCount) || !Number.isFinite(faceCount)) {
    throw new Error("The OFF mesh header is invalid");
  }
  const vertices = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const parts = lines[cursor++].split(/\s+/).map(Number);
    vertices[i * 3] = parts[0];
    vertices[i * 3 + 1] = parts[1];
    vertices[i * 3 + 2] = parts[2];
  }
  const positions = [];
  const colors = [];
  const fallback = [0.42, 0.4, 0.36];
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const unite = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  const used = new Uint8Array(vertexCount);
  const faces = [];
  for (let i = 0; i < faceCount; i++) {
    const parts = lines[cursor++].split(/\s+/).map(Number);
    const n = parts[0];
    if (!Number.isFinite(n) || n < 3) continue;
    const ids = parts.slice(1, 1 + n);
    for (let j = 1; j < ids.length; j++) unite(ids[0], ids[j]);
    for (const id of ids) if (id >= 0 && id < vertexCount) used[id] = 1;
    faces.push(parts);
  }
  const components = new Map();
  for (let i = 0; i < vertexCount; i++) {
    if (!used[i]) continue;
    const root = find(i);
    let box = components.get(root);
    if (!box) {
      box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      components.set(root, box);
    }
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];
    const z = vertices[i * 3 + 2];
    if (x < box.min[0]) box.min[0] = x;
    if (y < box.min[1]) box.min[1] = y;
    if (z < box.min[2]) box.min[2] = z;
    if (x > box.max[0]) box.max[0] = x;
    if (y > box.max[1]) box.max[1] = y;
    if (z > box.max[2]) box.max[2] = z;
  }
  const boxes = [...components.values()];
  const touches = (a, b) => {
    const gaps = [0, 1, 2].map((axis) =>
      Math.max(0, b.min[axis] - a.max[axis], a.min[axis] - b.max[axis]),
    );
    return gaps.every((gap) => gap <= 0.5);
  };
  const floating =
    boxes.length <= 1
      ? 0
      : boxes.filter((box, index) =>
          boxes.every((other, otherIndex) => otherIndex === index || !touches(box, other)),
        ).length;
  for (const parts of faces) {
    const n = parts[0];
    const tail = parts.slice(1 + n);
    let color = fallback;
    if (tail.length >= 3 && tail.slice(0, 3).every((value) => Number.isFinite(value))) {
      const rgb = tail.slice(0, 3);
      const scale = rgb.some((value) => value > 1) ? 255 : 1;
      color = rgb.map((value) => {
        const srgb = Math.max(0, Math.min(1, value / scale));
        return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
      });
    }
    for (let triangle = 0; triangle < n - 2; triangle++) {
      const ids = [parts[1], parts[2 + triangle], parts[3 + triangle]];
      for (const id of ids) {
        if (!Number.isFinite(id) || id < 0 || id >= vertexCount) continue;
        positions.push(vertices[id * 3], vertices[id * 3 + 1], vertices[id * 3 + 2]);
        colors.push(color[0], color[1], color[2]);
      }
    }
  }
  if (!positions.length) throw new Error("The model has no solid faces");
  const positionsArray = new Float32Array(positions);
  const colorsArray = new Float32Array(colors);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positionsArray.length; i += 3) {
    const x = positionsArray[i];
    const y = positionsArray[i + 1];
    const z = positionsArray[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return {
    positions: positionsArray,
    colors: colorsArray,
    triangles: positionsArray.length / 9,
    components: boxes.length,
    floating,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
  };
}

function makeStl(positions) {
  const triangles = positions.length / 9;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const header = "Cadgo OpenSCAD export - millimetres";
  for (let i = 0; i < 80; i++) view.setUint8(i, i < header.length ? header.charCodeAt(i) : 32);
  view.setUint32(80, triangles, true);
  let cursor = 84;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];
  for (let triangle = 0; triangle < triangles; triangle++) {
    const base = triangle * 9;
    for (let i = 0; i < 3; i++) {
      a[i] = positions[base + i];
      b[i] = positions[base + 3 + i];
      c[i] = positions[base + 6 + i];
    }
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const acx = c[0] - a[0];
    const acy = c[1] - a[1];
    const acz = c[2] - a[2];
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    view.setFloat32(cursor, nx, true);
    view.setFloat32(cursor + 4, ny, true);
    view.setFloat32(cursor + 8, nz, true);
    const points = [a, b, c];
    for (let corner = 0; corner < 3; corner++) {
      view.setFloat32(cursor + 12 + corner * 12, points[corner][0], true);
      view.setFloat32(cursor + 16 + corner * 12, points[corner][1], true);
      view.setFloat32(cursor + 20 + corner * 12, points[corner][2], true);
    }
    view.setUint16(cursor + 48, 0, true);
    cursor += 50;
  }
  return new Uint8Array(buffer);
}

async function compile(code, params) {
  const started = performance.now();
  const logs = [];
  const instance = await OpenSCAD({
    noInitialRun: true,
    locateFile: (path) => `/openscad/${path}`,
    print: (line) => logs.push(String(line)),
    printErr: (line) => logs.push(String(line)),
    onAbort: (reason) => logs.push(String(reason)),
  });
  instance.FS.writeFile("/input.scad", code);
  let exitCode = 0;
  try {
    exitCode = instance.callMain([
      "/input.scad",
      "-o",
      "/out.off",
      "--backend=manifold",
      "--enable=lazy-union",
      "--enable=roof",
      ...paramArgs(params),
    ]);
  } catch (error) {
    throw new Error(cleanLogs(logs) || (error instanceof Error ? error.message : "OpenSCAD failed"));
  }
  const stderr = cleanLogs(logs);
  if (exitCode !== 0) {
    throw new Error(stderr || `OpenSCAD exited with code ${exitCode}`);
  }
  let text;
  try {
    text = instance.FS.readFile("/out.off", { encoding: "utf8" });
  } catch {
    throw new Error(stderr || "OpenSCAD did not produce a 3D mesh. The model may be 2D or empty.");
  }
  const mesh = parseOff(text);
  return { mesh, stderr, duration: Math.round(performance.now() - started) };
}

scope.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message.id === "undefined") return;
  try {
    if (message.type === "warm") {
      send({ id: message.id, type: "warm", ok: true });
      return;
    }
    if (message.type === "preview") {
      const result = await compile(message.code, message.params);
      send(
        {
          id: message.id,
          type: "preview",
          ok: true,
          positions: result.mesh.positions,
          colors: result.mesh.colors,
          triangles: result.mesh.triangles,
          bounds: result.mesh.bounds,
          components: result.mesh.components,
          floating: result.mesh.floating,
          stderr: result.stderr,
          duration: result.duration,
        },
        [result.mesh.positions.buffer, result.mesh.colors.buffer],
      );
      return;
    }
    if (message.type === "export") {
      if (message.format === "scad") {
        send({ id: message.id, type: "export", ok: true, text: message.code });
        return;
      }
      const result = await compile(message.code, message.params);
      if (message.format === "stl") {
        const stl = makeStl(result.mesh.positions);
        send({ id: message.id, type: "export", ok: true, stl, stderr: result.stderr }, [stl.buffer]);
        return;
      }
      send({ id: message.id, type: "export", ok: false, error: "Unsupported format" });
      return;
    }
    send({ id: message.id, type: "error", ok: false, error: "Unknown request" });
  } catch (error) {
    send({
      id: message.id,
      type: "error",
      ok: false,
      error: error instanceof Error ? error.message : "OpenSCAD failed",
    });
  }
};
