import { poseSpec } from '../lib/cad/pose';
import { normalizeSpec } from '../lib/cad/validate';
import { lampSpec } from '../lib/cad/examples/lamp';
const spec = normalizeSpec(lampSpec);
const values: Record<string, number> = {};
for (const j of spec.joints) values[j.id] = j.value ?? 0;
const pose = poseSpec(spec, values);
for (const p of spec.parts) {
  const m = pose.matrices[p.id];
  const pos = m.elements.slice(12,15).map(v=>Math.round(v*10)/10);
  console.log(p.id, 'pos', pos, 'restpos', p.position);
}
for (const [id, j] of Object.entries(pose.joints)) console.log('joint', id, j.origin.map(v=>Math.round(v)));
