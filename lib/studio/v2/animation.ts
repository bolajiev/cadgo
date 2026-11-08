import {
  AnimationClip,
  Matrix4,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type Object3D,
} from "three";
import type { CadDocument } from "../document/types";
import { motionLocalTransforms } from "./motion";

export type SceneAnimationOptions = {
  samples?: number;
  duration?: number;
};

type Frame = {
  groups: Map<string, Matrix4>;
  instances: Map<string, Matrix4>;
};

function visibleInHierarchy(object: Object3D): boolean {
  let cursor: Object3D | null = object;
  while (cursor) {
    if (!cursor.visible) return false;
    cursor = cursor.parent;
  }
  return true;
}

function animatedNameMap(root: Object3D): Map<string, string> {
  const names = new Map<string, string>();
  root.traverse((object) => {
    const id = object.userData?.cadgoId;
    if (typeof id !== "string" || !object.name) return;
    if (!visibleInHierarchy(object)) return;
    names.set(id, object.name);
  });
  return names;
}

function addTracks(
  tracks: (VectorKeyframeTrack | QuaternionKeyframeTrack)[],
  name: string,
  times: number[],
  matrices: Matrix4[],
): void {
  if (!matrices.length) return;
  const first = matrices[0];
  let changed = false;
  const positions: number[] = [];
  const quaternions: number[] = [];
  const scales: number[] = [];
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  let previous: Quaternion | null = null;

  for (const matrix of matrices) {
    matrix.decompose(position, quaternion, scale);
    if (previous && previous.dot(quaternion) < 0) {
      quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
    }
    previous = quaternion.clone();
    positions.push(position.x, position.y, position.z);
    quaternions.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    scales.push(scale.x, scale.y, scale.z);
    if (!matrix.equals(first)) changed = true;
  }

  if (!changed) return;
  tracks.push(new VectorKeyframeTrack(`${name}.position`, times, positions));
  tracks.push(new QuaternionKeyframeTrack(`${name}.quaternion`, times, quaternions));
  tracks.push(new VectorKeyframeTrack(`${name}.scale`, times, scales));
}

export function buildSceneAnimations(
  document: CadDocument,
  root: Object3D,
  options: SceneAnimationOptions = {},
): AnimationClip[] {
  if (!document.drivers.length) return [];
  const names = animatedNameMap(root);
  if (!names.size) return [];
  const clips: AnimationClip[] = [];

  for (const driver of document.drivers) {
    const span = driver.max - driver.min;
    if (!Number.isFinite(span) || span <= 0) continue;
    const samples = Math.max(2, Math.min(240, Math.floor(options.samples ?? 36)));
    const duration = Math.max(0.1, options.duration ?? span / 90);
    const times: number[] = [];
    const frames: Frame[] = [];

    for (let index = 0; index < samples; index += 1) {
      const progress = index / (samples - 1);
      const value = driver.min + span * progress;
      const motion = motionLocalTransforms(document, { [driver.id]: value });
      const errors = Object.entries(motion.errors);
      if (errors.length) {
        throw new Error(
          `Cannot export ${driver.name} animation: ${errors.map(([id, message]) => `${id}: ${message}`).join("; ")}`,
        );
      }
      times.push(progress * duration);
      frames.push({ groups: motion.groups, instances: motion.instances });
    }

    const tracks: (VectorKeyframeTrack | QuaternionKeyframeTrack)[] = [];
    for (const group of document.groups) {
      const name = names.get(group.id);
      if (!name) continue;
      const matrices = frames.map((frame) => frame.groups.get(group.id)).filter((matrix): matrix is Matrix4 => Boolean(matrix));
      if (matrices.length === frames.length) addTracks(tracks, name, times, matrices);
    }
    for (const instance of document.instances) {
      const name = names.get(instance.id);
      if (!name) continue;
      const matrices = frames
        .map((frame) => frame.instances.get(instance.id))
        .filter((matrix): matrix is Matrix4 => Boolean(matrix));
      if (matrices.length === frames.length) addTracks(tracks, name, times, matrices);
    }

    if (tracks.length) clips.push(new AnimationClip(driver.name, duration, tracks));
  }

  return clips;
}
