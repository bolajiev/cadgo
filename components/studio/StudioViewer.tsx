"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  PerspectiveCamera,
  Vector3,
} from "three";
import type { ScadMesh } from "@/lib/scad/types";
import type { OrbitView } from "@/lib/view";

type Props = {
  mesh: ScadMesh | null;
  view: OrbitView;
  fitKey: number;
  showEdges: boolean;
  showGrid: boolean;
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

function StudioCamera({
  center,
  radius,
  view,
  fitKey,
}: {
  center: Vector3;
  radius: number;
  view: OrbitView;
  fitKey: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as ControlsLike | null;
  const size = useThree((state) => state.size);

  useEffect(() => {
    const frame = () => {
      const cameraObj = camera as PerspectiveCamera;
      const fov = view === "front" ? 25 : view === "top" ? 25 : 32;
      if ("fov" in cameraObj) {
        cameraObj.fov = fov;
        cameraObj.updateProjectionMatrix();
      }
      const direction =
        view === "front"
          ? new Vector3(0, -1, 0.12)
          : view === "top"
            ? new Vector3(0.12, -0.16, 1)
            : new Vector3(0.9, -1.15, 0.7);
      direction.normalize();
      const aspect = size.width / Math.max(1, size.height);
      const halfVertical = (fov * Math.PI) / 360;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      const half = Math.min(halfVertical, halfHorizontal);
      const distance = (radius / Math.sin(half)) * 1.05;
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      camera.near = Math.max(0.5, radius * 0.01);
      camera.far = Math.max(5000, radius * 40);
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    };
    frame();
    const raf = requestAnimationFrame(frame);
    const timer = window.setTimeout(frame, 140);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [camera, controls, center, radius, view, fitKey, size.width, size.height]);

  return null;
}

function ModelMesh({
  mesh,
  center,
  showEdges,
}: {
  mesh: ScadMesh;
  center: [number, number, number];
  showEdges: boolean;
}) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(mesh.positions, 3));
    geo.setAttribute("color", new BufferAttribute(mesh.colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [mesh]);

  const edges = useMemo(() => {
    if (!showEdges || mesh.triangles > 160000) return null;
    const edgeGeometry = new EdgesGeometry(geometry, 28);
    return edgeGeometry;
  }, [geometry, mesh.triangles, showEdges]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => edges?.dispose(), [edges]);

  return (
    <group position={center}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          metalness={0.26}
          roughness={0.44}
          flatShading
          envMapIntensity={0.9}
        />
      </mesh>
      {edges ? (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#26241f" transparent opacity={0.3} depthWrite={false} />
        </lineSegments>
      ) : null}
    </group>
  );
}

function GridFloor({ visible, radius }: { visible: boolean; radius: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const majors: number[] = [];
    const cell = radius > 60 ? 10 : radius > 20 ? 5 : 1;
    const extent = Math.max(240, radius * 8);
    const count = Math.ceil(extent / cell);
    for (let index = -count; index <= count; index++) {
      const value = index * cell;
      const target = index % 5 === 0 ? majors : points;
      target.push(-extent, value, 0.03, extent, value, 0.03);
      target.push(value, -extent, 0.03, value, extent, 0.03);
    }
    const minor = new BufferGeometry();
    minor.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    const major = new BufferGeometry();
    major.setAttribute("position", new BufferAttribute(new Float32Array(majors), 3));
    return { minor, major };
  }, [radius]);

  useEffect(
    () => () => {
      geometry.minor.dispose();
      geometry.major.dispose();
    },
    [geometry],
  );

  if (!visible) return null;
  return (
    <group>
      <lineSegments geometry={geometry.minor}>
        <lineBasicMaterial color="#b8b0a0" transparent opacity={0.2} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={geometry.major}>
        <lineBasicMaterial color="#a49b8b" transparent opacity={0.34} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function SoftShadow({ radius }: { radius: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(128, 128, 10, 128, 128, 126);
      gradient.addColorStop(0, "rgba(35,31,25,0.34)");
      gradient.addColorStop(0.55, "rgba(35,31,25,0.16)");
      gradient.addColorStop(1, "rgba(35,31,25,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }
    const map = new CanvasTexture(canvas);
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0, 0.015]} rotation={[0, 0, 0]}>
      <planeGeometry args={[radius * 2.6, radius * 2.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function Scene({ mesh, view, fitKey, showEdges, showGrid }: Props) {
  const bounds = mesh?.bounds;
  const center = useMemo<[number, number, number]>(() => {
    if (!bounds) return [0, 0, 0];
    const cx = (bounds.min[0] + bounds.max[0]) / 2;
    const cy = (bounds.min[1] + bounds.max[1]) / 2;
    const minZ = bounds.min[2];
    return [-cx, -cy, -minZ];
  }, [bounds]);
  const cameraCenter = useMemo(() => {
    if (!bounds) return new Vector3(0, 0, 20);
    return new Vector3(0, 0, (bounds.max[2] - bounds.min[2]) / 2);
  }, [bounds]);
  const radius = useMemo(() => {
    if (!bounds) return 60;
    const sx = bounds.max[0] - bounds.min[0];
    const sy = bounds.max[1] - bounds.min[1];
    const sz = bounds.max[2] - bounds.min[2];
    return Math.max(10, Math.hypot(sx, sy, sz) / 2);
  }, [bounds]);

  return (
    <>
      <ZUpCamera />
      <color attach="background" args={["#ede9de"]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[radius * 2.2, -radius * 2.6, radius * 3.2]}
        intensity={2.45}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius * 2.2}
        shadow-camera-right={radius * 2.2}
        shadow-camera-top={radius * 2.2}
        shadow-camera-bottom={-radius * 2.2}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 12}
        shadow-bias={-0.0003}
      />
      <directionalLight position={[-radius * 2, radius, radius * 2]} intensity={0.55} />
      <directionalLight position={[0, radius * 3, radius]} intensity={0.6} />
      <Environment resolution={64} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.8}
          position={[0, -radius * 1.8, radius * 2]}
          scale={[radius * 4, radius * 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          position={[radius * 2.2, radius * 0.8, radius]}
          scale={[radius * 2.5, radius * 2.5, 1]}
          rotation={[0, -1.1, 0]}
        />
      </Environment>
      <GridFloor visible={showGrid} radius={radius} />
      <SoftShadow radius={radius} />
      <mesh position={[0, 0, 0.02]} receiveShadow>
        <planeGeometry args={[radius * 30, radius * 30]} />
        <shadowMaterial transparent opacity={0.15} />
      </mesh>
      {mesh ? <ModelMesh mesh={mesh} center={center} showEdges={showEdges} /> : null}
      <StudioCamera center={cameraCenter} radius={radius} view={view} fitKey={fitKey} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={radius * 0.35}
        maxDistance={radius * 15}
        maxPolarAngle={Math.PI * 0.96}
      />
    </>
  );
}

export function StudioViewer(props: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      camera={{ fov: 32, near: 0.5, far: 20000, position: [200, -260, 180] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.02;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
