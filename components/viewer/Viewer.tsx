"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import type { CadSpec, PartMesh, Vec3 } from "@/lib/cad/types";
import { poseSpec, type JointState } from "@/lib/cad/pose";
import { MATERIALS } from "@/lib/cad/materials";
import type { OrbitView } from "@/lib/view";
import type { FacePick } from "@/lib/store/project";

type ViewerProps = {
  spec: CadSpec;
  meshes: PartMesh[];
  offset: Vec3;
  bounds: { min: Vec3; max: Vec3 } | null;
  jointValues: Record<string, number>;
  selectedPartId: string | null;
  selectedJointId: string | null;
  hoveredPartId: string | null;
  hiddenParts: Record<string, boolean>;
  view: OrbitView;
  plate: boolean;
  explode: number;
  fitKey: number;
  pickMode: "none" | "hole";
  captureRequest: number;
  autoRotate?: boolean;
  onSelectPart: (id: string | null) => void;
  onSelectJoint: (id: string | null) => void;
  onHoverPart: (id: string | null) => void;
  onJointChange: (id: string, value: number) => void;
  onFacePick: (pick: FacePick) => void;
  onCapture: (dataUrl: string) => void;
};

type ControlsLike = {
  enabled: boolean;
  target: Vector3;
  update: () => void;
};

function ZUpCamera() {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function CameraRig({
  center,
  radius,
  view,
  plate,
  fitKey,
}: {
  center: Vector3;
  radius: number;
  view: OrbitView;
  plate: boolean;
  fitKey: number;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as ControlsLike | null;

  useEffect(() => {
    const frameCamera = () => {
      const cameraObj = camera as PerspectiveCamera;
      const fov = plate ? 18 : view === "front" ? 26 : 32;
      if ("fov" in cameraObj) {
        cameraObj.fov = fov;
        cameraObj.updateProjectionMatrix();
      }
      const direction =
        view === "front"
          ? new Vector3(0, -1, 0.12)
          : view === "top"
            ? new Vector3(0.12, -0.16, 1)
            : new Vector3(0.92, -1.1, 0.72);
      direction.normalize();
      const aspect = size.width / Math.max(1, size.height);
      const halfVertical = (fov * Math.PI) / 360;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      const half = Math.min(halfVertical, halfHorizontal);
      const distance = (radius / Math.sin(half)) * (plate ? 1.12 : 1.2);
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      camera.near = Math.max(1, radius * 0.02);
      camera.far = Math.max(4000, radius * 30);
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
      if (process.env.NODE_ENV === "development") {
        (window as unknown as { __cadgoCamera?: unknown }).__cadgoCamera = {
          position: camera.position.toArray(),
          target: controls ? controls.target.toArray() : center.toArray(),
          fov: "fov" in cameraObj ? cameraObj.fov : null,
          radius,
          center: center.toArray(),
        };
      }
    };
    frameCamera();
    const raf = requestAnimationFrame(frameCamera);
    const timer = window.setTimeout(frameCamera, 180);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [camera, controls, center, radius, view, plate, fitKey, size.width, size.height]);

  return null;
}

function Grid({ visible }: { visible: boolean }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (let index = -60; index <= 60; index++) {
      const value = index * 10;
      const major = index % 10 === 0;
      const alpha = major ? 1 : 0.5;
      points.push(-600, value, 0.05, 600, value, 0.05);
      points.push(value, -600, 0.05, value, 600, 0.05);
      void alpha;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geo;
  }, []);

  const majorGeometry = useMemo(() => {
    const points: number[] = [];
    for (let index = -6; index <= 6; index++) {
      const value = index * 100;
      points.push(-600, value, 0.08, 600, value, 0.08);
      points.push(value, -600, 0.08, value, 600, 0.08);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geo;
  }, []);

  if (!visible) return null;
  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={1}>
        <lineBasicMaterial color="#9b9588" transparent opacity={0.16} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={majorGeometry} renderOrder={1}>
        <lineBasicMaterial color="#7d776b" transparent opacity={0.24} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function PartView({
  part,
  spec,
  matrix,
  center,
  radius,
  selected,
  hovered,
  plate,
  explode,
  pickMode,
  onSelect,
  onHover,
  onFacePick,
}: {
  part: PartMesh;
  spec: CadSpec;
  matrix: Matrix4;
  center: Vector3;
  radius: number;
  selected: boolean;
  hovered: boolean;
  plate: boolean;
  explode: number;
  pickMode: "none" | "hole";
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onFacePick: (pick: FacePick) => void;
}) {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(part.positions.slice(), 3));
    geo.setAttribute("normal", new BufferAttribute(part.normals.slice(), 3));
    geo.setIndex(new BufferAttribute(part.indices.slice(), 1));
    geo.computeBoundingSphere();
    return geo;
  }, [part]);
  const edges = useMemo(() => new EdgesGeometry(geometry, 22), [geometry]);

  useEffect(
    () => () => {
      geometry.dispose();
      edges.dispose();
    },
    [geometry, edges],
  );

  const source = spec.parts.find((item) => item.id === part.id);
  const materialDef = MATERIALS[source?.material ?? "aluminium"];
  const transform = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, quaternion, scale);
    const localCenter = new Vector3(
      (part.bounds.min[0] + part.bounds.max[0]) / 2,
      (part.bounds.min[1] + part.bounds.max[1]) / 2,
      (part.bounds.min[2] + part.bounds.max[2]) / 2,
    ).applyMatrix4(matrix);
    const direction = localCenter.clone().sub(center);
    if (direction.lengthSq() < 0.01) direction.set(0, 0, 0.2);
    direction.normalize();
    position.addScaledVector(direction, explode * radius * 1.05);
    return { position, quaternion };
  }, [matrix, part.bounds, center, explode, radius]);

  const material = useMemo(() => {
    if (plate) {
      return new MeshBasicMaterial({ color: "#fffdf7" });
    }
    return new MeshStandardMaterial({
      color: materialDef.color,
      metalness: materialDef.metalness,
      roughness: materialDef.roughness,
      envMapIntensity: 0.95,
      emissive: new Color(hovered ? "#8f6c50" : "#000000"),
      emissiveIntensity: hovered ? 0.04 : 0,
    });
  }, [materialDef, plate, selected, hovered]);

  const edgeColor = plate ? "#24231f" : selected ? "#c4472a" : materialDef.edge;

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (pickMode === "hole" && meshRef.current) {
        const localPoint = meshRef.current.worldToLocal(event.point.clone());
        const localNormal = (event.face?.normal ?? new Vector3(0, 0, 1)).clone().normalize();
        onFacePick({
          partId: part.id,
          point: [localPoint.x, localPoint.y, localPoint.z],
          normal: [localNormal.x, localNormal.y, localNormal.z],
        });
        return;
      }
      onSelect(part.id);
    },
    [onFacePick, onSelect, part.id, pickMode],
  );

  return (
    <group position={transform.position} quaternion={transform.quaternion}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(part.id);
          document.body.style.cursor = pickMode === "hole" ? "crosshair" : "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
      />
      <lineSegments geometry={edges} renderOrder={4}>
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={plate ? 0.78 : selected ? 0.95 : 0.38}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function JointGizmo({
  joint,
  radius,
  selected,
  plate,
  onChange,
  onSelect,
}: {
  joint: JointState;
  radius: number;
  selected: boolean;
  plate: boolean;
  onChange: (id: string, value: number) => void;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const controls = useThree((state) => state.controls) as ControlsLike | null;
  const origin = useMemo(() => new Vector3(...joint.origin), [joint.origin]);
  const axis = useMemo(() => new Vector3(...joint.axis).normalize(), [joint.axis]);
  const quaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis),
    [axis],
  );
  const size = Math.max(15, radius * 0.2);
  const color = selected ? "#c4472a" : hovered ? "#3d3932" : "#625c50";

  const tickGeometry = useMemo(() => {
    const points: number[] = [];
    for (let index = 0; index < 36; index++) {
      const angle = (index / 36) * Math.PI * 2;
      const inner = index % 3 === 0 ? size * 0.86 : size * 0.93;
      points.push(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        0,
        Math.cos(angle) * size,
        Math.sin(angle) * size,
        0,
      );
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geo;
  }, [size]);

  const arcGeometry = useMemo(() => {
    const points: number[] = [];
    const end = (joint.value * Math.PI) / 180;
    const count = 28;
    let previous: [number, number, number] | null = null;
    for (let index = 0; index <= count; index++) {
      const angle = (end * index) / count;
      const point: [number, number, number] = [
        Math.cos(angle) * size,
        Math.sin(angle) * size,
        0.4,
      ];
      if (previous) points.push(...previous, ...point);
      previous = point;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    return geo;
  }, [joint.value, size]);

  const handlePosition = useMemo(() => {
    const angle = (joint.value * Math.PI) / 180;
    return new Vector3(Math.cos(angle) * size, Math.sin(angle) * size, 0.6);
  }, [joint.value, size]);

  const startDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (plate) return;
      event.stopPropagation();
      onSelect(joint.id);
      const controlsState = controls;
      if (controlsState) controlsState.enabled = false;
      const rect = gl.domElement.getBoundingClientRect();
      const startX = event.nativeEvent.clientX;
      const startY = event.nativeEvent.clientY;
      const startValue = joint.value;
      const raycaster = new Raycaster();
      const ndc = new Vector2(
        ((startX - rect.left) / rect.width) * 2 - 1,
        -((startY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const u = new Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
      const v = new Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
      const normal = axis.clone();
      const cameraDirection = new Vector3();
      camera.getWorldDirection(cameraDirection);
      let plane = new Plane().setFromNormalAndCoplanarPoint(normal, origin);
      let startAngle = 0;
      let startAxisOffset = 0;
      let dragging = false;
      if (joint.type !== "prismatic") {
        const hit = raycaster.ray.intersectPlane(plane, new Vector3());
        if (hit) {
          const delta = hit.clone().sub(origin);
          startAngle = Math.atan2(delta.dot(v), delta.dot(u));
        }
      } else {
        const side = new Vector3().crossVectors(normal, cameraDirection).normalize();
        if (side.lengthSq() < 0.1) side.set(1, 0, 0);
        plane = new Plane().setFromNormalAndCoplanarPoint(side, origin);
        const hit = raycaster.ray.intersectPlane(plane, new Vector3());
        if (hit) startAxisOffset = hit.clone().sub(origin).dot(normal);
      }

      const move = (moveEvent: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;
          dragging = true;
        }
        const moveNdc = new Vector2(
          ((moveEvent.clientX - rect.left) / rect.width) * 2 - 1,
          -((moveEvent.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(moveNdc, camera);
        if (joint.type !== "prismatic") {
          const hit = raycaster.ray.intersectPlane(plane, new Vector3());
          if (!hit) return;
          const delta = hit.clone().sub(origin);
          const angle = Math.atan2(delta.dot(v), delta.dot(u));
          let difference = angle - startAngle;
          while (difference > Math.PI) difference -= Math.PI * 2;
          while (difference < -Math.PI) difference += Math.PI * 2;
          onChange(joint.id, startValue + (difference * 180) / Math.PI);
        } else {
          const hit = raycaster.ray.intersectPlane(plane, new Vector3());
          if (!hit) return;
          const offset = hit.clone().sub(origin).dot(normal);
          onChange(joint.id, startValue + (offset - startAxisOffset));
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (controlsState) controlsState.enabled = true;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [axis, camera, controls, gl, joint, onChange, onSelect, origin, plate, quaternion],
  );

  if (plate) return null;

  return (
    <group ref={groupRef} position={origin} quaternion={quaternion}>
      <mesh
        onPointerDown={startDrag}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <torusGeometry args={[size, 5, 8, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[size, 0.7, 8, 96]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.9 : 0.42} depthTest={false} />
      </mesh>
      <lineSegments geometry={tickGeometry}>
        <lineBasicMaterial color={color} transparent opacity={selected ? 0.55 : 0.24} depthTest={false} />
      </lineSegments>
      <lineSegments geometry={arcGeometry}>
        <lineBasicMaterial color="#c4472a" transparent opacity={0.9} depthTest={false} />
      </lineSegments>
      <mesh position={handlePosition}>
        <sphereGeometry args={[size * 0.055, 16, 16]} />
        <meshBasicMaterial color={selected ? "#c4472a" : "#3d3932"} depthTest={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[size * 0.025, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthTest={false} />
      </mesh>
    </group>
  );
}

function Scene({
  spec,
  meshes,
  offset,
  bounds,
  jointValues,
  selectedPartId,
  selectedJointId,
  hoveredPartId,
  hiddenParts,
  view,
  plate,
  explode,
  fitKey,
  pickMode,
  captureRequest,
  autoRotate = false,
  onSelectPart,
  onSelectJoint,
  onHoverPart,
  onJointChange,
  onFacePick,
  onCapture,
}: ViewerProps) {
  const pose = useMemo(() => poseSpec(spec, jointValues), [spec, jointValues]);
  const offsetMatrix = useMemo(() => new Matrix4().makeTranslation(...offset), [offset]);
  const matrices = useMemo(() => {
    const result: Record<string, Matrix4> = {};
    for (const [id, matrix] of Object.entries(pose.matrices)) {
      result[id] = new Matrix4().multiplyMatrices(offsetMatrix, matrix);
    }
    return result;
  }, [pose, offsetMatrix]);
  const joints = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pose.joints).map(([id, state]) => [
          id,
          {
            ...state,
            origin: [
              state.origin[0] + offset[0],
              state.origin[1] + offset[1],
              state.origin[2] + offset[2],
            ] as Vec3,
          },
        ]),
      ),
    [pose, offset],
  );

  const center = useMemo(() => {
    if (!bounds) return new Vector3(0, 0, 100);
    return new Vector3(
      (bounds.min[0] + bounds.max[0]) / 2 + offset[0],
      (bounds.min[1] + bounds.max[1]) / 2 + offset[1],
      (bounds.min[2] + bounds.max[2]) / 2 + offset[2],
    );
  }, [bounds, offset]);
  const radius = useMemo(() => {
    if (!bounds) return 200;
    return Math.max(
      60,
      Math.max(
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
      ) / 2,
    );
  }, [bounds]);

  return (
    <>
      <ZUpCamera />
      <color attach="background" args={[plate ? "#fffdf7" : "#ede9de"]} />
      <fog attach="fog" args={[plate ? "#fffdf7" : "#ede9de", radius * 5, radius * 18]} />
      <ambientLight intensity={plate ? 2.2 : 0.98} />
      <directionalLight
        position={[420, -520, 760]}
        intensity={plate ? 0 : 1.9}
        castShadow={!plate}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius * 2.2}
        shadow-camera-right={radius * 2.2}
        shadow-camera-top={radius * 2.2}
        shadow-camera-bottom={-radius * 2.2}
        shadow-camera-near={1}
        shadow-camera-far={radius * 8}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-520, 240, 420]} intensity={plate ? 1.2 : 0.62} />
      <directionalLight position={[120, 620, 340]} intensity={plate ? 0.8 : 0.78} />

      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.2}
          position={[0, -380, 480]}
          scale={[900, 900, 1]}
          rotation={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[500, 200, 300]}
          scale={[500, 500, 1]}
          rotation={[0, -1.1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[-450, -100, 250]}
          scale={[500, 500, 1]}
          rotation={[0, 1.1, 0]}
        />
      </Environment>

      <Grid visible={!plate} />
      <mesh position={[0, 0, 0.03]} receiveShadow rotation={[0, 0, 0]}>
        <planeGeometry args={[radius * 30, radius * 30]} />
        <shadowMaterial transparent opacity={plate ? 0 : 0.1} />
      </mesh>

      {meshes.map((part) => {
        if (hiddenParts[part.id]) return null;
        return (
          <PartView
            key={part.id}
            part={part}
            spec={spec}
            matrix={matrices[part.id] ?? new Matrix4()}
            center={center}
            radius={radius}
            selected={selectedPartId === part.id}
            hovered={hoveredPartId === part.id}
            plate={plate}
            explode={explode}
            pickMode={pickMode}
            onSelect={onSelectPart}
            onHover={onHoverPart}
            onFacePick={onFacePick}
          />
        );
      })}

      {Object.values(joints).map((joint) => {
        const source = spec.joints.find((item) => item.id === joint.id);
        if (!source || source.type === "fixed") return null;
        return (
          <JointGizmo
            key={joint.id}
            joint={joint}
            radius={radius}
            selected={selectedJointId === joint.id}
            plate={plate}
            onChange={onJointChange}
            onSelect={onSelectJoint}
          />
        );
      })}

      <CameraRig center={center} radius={radius} view={view} plate={plate} fitKey={fitKey} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
        minDistance={radius * 0.35}
        maxDistance={radius * 14}
        maxPolarAngle={Math.PI * 0.96}
        onStart={() => {
          document.body.style.cursor = "grabbing";
        }}
        onEnd={() => {
          document.body.style.cursor = "";
        }}
      />
      <CaptureBridge captureRequest={captureRequest} onCapture={onCapture} />
    </>
  );
}

function CaptureBridge({
  captureRequest,
  onCapture,
}: {
  captureRequest: number;
  onCapture: (dataUrl: string) => void;
}) {
  const gl = useThree((state) => state.gl);
  const last = useRef(0);
  useEffect(() => {
    if (!captureRequest || captureRequest === last.current) return;
    last.current = captureRequest;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        onCapture(gl.domElement.toDataURL("image/png"));
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [captureRequest, gl, onCapture]);
  return null;
}

export function Viewer(props: ViewerProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ fov: 32, near: 1, far: 16000, position: [420, -520, 420] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={() => props.onSelectPart(null)}
    >
      <Scene {...props} />
    </Canvas>
  );
}
