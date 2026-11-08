export function binaryStl(positions: Float32Array, componentIds?: Uint32Array, componentId?: number): Uint8Array {
  const total = positions.length / 9;
  let count = 0;
  for (let triangle = 0; triangle < total; triangle++) {
    if (componentId !== undefined && componentIds && componentIds[triangle] !== componentId) continue;
    count++;
  }
  const buffer = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buffer);
  const header = "Cadgo OpenSCAD part export - millimetres";
  for (let i = 0; i < 80; i++) view.setUint8(i, i < header.length ? header.charCodeAt(i) : 32);
  view.setUint32(80, count, true);
  let cursor = 84;
  for (let triangle = 0; triangle < total; triangle++) {
    if (componentId !== undefined && componentIds && componentIds[triangle] !== componentId) continue;
    const offset = triangle * 9;
    const ax = positions[offset];
    const ay = positions[offset + 1];
    const az = positions[offset + 2];
    const bx = positions[offset + 3];
    const by = positions[offset + 4];
    const bz = positions[offset + 5];
    const cx = positions[offset + 6];
    const cy = positions[offset + 7];
    const cz = positions[offset + 8];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length > 0) {
      nx /= length;
      ny /= length;
      nz /= length;
    }
    view.setFloat32(cursor, nx, true);
    view.setFloat32(cursor + 4, ny, true);
    view.setFloat32(cursor + 8, nz, true);
    view.setFloat32(cursor + 12, ax, true);
    view.setFloat32(cursor + 16, ay, true);
    view.setFloat32(cursor + 20, az, true);
    view.setFloat32(cursor + 24, bx, true);
    view.setFloat32(cursor + 28, by, true);
    view.setFloat32(cursor + 32, bz, true);
    view.setFloat32(cursor + 36, cx, true);
    view.setFloat32(cursor + 40, cy, true);
    view.setFloat32(cursor + 44, cz, true);
    view.setUint16(cursor + 48, 0, true);
    cursor += 50;
  }
  return new Uint8Array(buffer);
}
