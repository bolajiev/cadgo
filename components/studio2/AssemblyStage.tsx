"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, GizmoHelper, GizmoViewport, Html, Line, OrbitControls, TransformControls } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { Icon } from "@/components/ui/Icon";
import type { CompiledVariant } from "@/lib/studio/compile/types";
import { useStudioV2 } from "@/lib/studio/v2/store";
import { MotionHud } from "./MotionHud";
import {
  assemblyBounds,
  groupMatrix,
  placedVariants,
  type PlacedVariant,
} from "@/lib/studio/v2/geometry";
import { motionsForInstance, motionWorldMatrices } from "@/lib/studio/v2/motion";
import { inferMaterialMode } from "@/lib/studio/v2/material";

type View = "iso" | "front" | "top" | "side";

function useVariantGeometries(
  variants: Record<string, CompiledVariant>,
  instanceVariants: Record<string, CompiledVariant>,
) {
  const cache = useRef(new Map<string, BufferGeometry>());
  const geometries = useMemo(() => {
    const next = new Map<string, BufferGeometry>();
    const all = [...Object.values(variants), ...Object.values(instanceVariants)];
    for (const variant of all) {
      let geometry = cache.current.get(variant.key);
      if (!geometry) {
        geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(variant.mesh.positions, 3));
        geometry.setAttribute("color", new BufferAttribute(variant.mesh.colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        cache.current.set(variant.key, geometry);
      }
      next.set(variant.key, geometry);
    }
    return next;
  }, [instanceVariants, variants]);

  useEffect(() => {
    const valid = new Set(
      [...Object.values(variants), ...Object.values(instanceVariants)].map((variant) => variant.key),
    );
    for (const [key, geometry] of [...cache.current]) {
      if (valid.has(key)) continue;
      geometry.dispose();
      cache.current.delete(key);
    }
  }, [instanceVariants, variants]);

  return geometries;
}

function CameraRig({
  bounds,
  view,
  fitKey,
}: {
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  view: View;
  fitKey: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: Vector3; update: () => void }
    | null;
  const size = useThree((state) => state.size);

  useEffect(() => {
    camera.up.set(0, 0, 1);
    const center = bounds
      ? new Vector3(
          (bounds.min[0] + bounds.max[0]) / 2,
          (bounds.min[1] + bounds.max[1]) / 2,
          (bounds.min[2] + bounds.max[2]) / 2,
        )
      : new Vector3(0, 0, 20);
    const radius = bounds
      ? Math.max(
          10,
          Math.hypot(
            bounds.max[0] - bounds.min[0],
            bounds.max[1] - bounds.min[1],
            bounds.max[2] - bounds.min[2],
          ) / 2,
        )
      : 60;
    const direction =
      view === "front"
        ? new Vector3(0, -1, 0.16)
        : view === "top"
          ? new Vector3(0.12, -0.18, 1)
          : view === "side"
            ? new Vector3(1, 0, 0.16)
            : new Vector3(0.95, -1.15, 0.72);
    direction.normalize();
    const distance = radius * 4;
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center);
    camera.near = Math.max(0.1, radius * 0.001);
    camera.far = Math.max(5000, radius * 40);
    if (camera instanceof OrthographicCamera) {
      const aspect = size.width / Math.max(1, size.height);
      const halfHeight = radius * 1.35;
      const halfWidth = halfHeight * aspect;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.zoom = 1;
    } else if (camera instanceof PerspectiveCamera) {
      const fov = 32;
      const aspect = size.width / Math.max(1, size.height);
      const halfVertical = (fov * Math.PI) / 360;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      const half = Math.min(halfVertical, halfHorizontal);
      camera.position.copy(center).addScaledVector(direction, (radius / Math.sin(half)) * 1.08);
      camera.fov = fov;
    }
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }, [bounds, camera, controls, fitKey, size.height, size.width, view]);

  return null;
}


function InstanceMesh({
  item,
  geometry,
  selected,
  definitionSelected,
  groupRef,
}: {
  item: PlacedVariant;
  geometry: BufferGeometry;
  selected: boolean;
  definitionSelected: boolean;
  groupRef?: RefObject<Group | null>;
}) {
  const selectInstance = useStudioV2((state) => state.selectInstance);
  const document = useStudioV2((state) => state.document);
  const playing = useStudioV2((state) => state.driverPlaying);
  const setPlaying = useStudioV2((state) => state.setDriverPlaying);
  const commitDriver = useStudioV2((state) => state.commitDriver);
  const motions = useMemo(() => motionsForInstance(document, item.instance.id), [document, item.instance.id]);
  const materialMode = item.materialMode ?? inferMaterialMode(item.material);
  const override = materialMode === "override";
  const opacity = item.material?.opacity ?? 1;
  const decomposed = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    item.matrix.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }, [item.matrix]);

  return (
    <group
      ref={groupRef}
      position={decomposed.position}
      quaternion={decomposed.quaternion}
      scale={decomposed.scale}
    >
      <mesh
        geometry={geometry}
        onClick={(event) => {
          event.stopPropagation();
          selectInstance(item.instance.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          const motion = motions[0];
          if (!motion) return;
          if (playing === motion.driver.id) {
            setPlaying(null);
            commitDriver(motion.driver.id);
            return;
          }
          if (playing) commitDriver(playing);
          setPlaying(motion.driver.id);
        }}
      >
        <meshStandardMaterial
          vertexColors={!override}
          color={override ? item.material?.color ?? "#ffffff" : "#ffffff"}
          metalness={item.material?.metalness ?? 0.2}
          roughness={item.material?.roughness ?? 0.48}
          emissive={selected ? "#5bc0eb" : definitionSelected ? "#1f4254" : "#000000"}
          emissiveIntensity={selected ? 0.38 : definitionSelected ? 0.16 : 0}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
          flatShading
        />
        {selected ? <Edges threshold={22} color="#5bc0eb" /> : null}
      </mesh>
    </group>
  );
}

function BoundsDimensions({
  bounds,
}: {
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
}) {
  if (!bounds) return null;
  const size: [number, number, number] = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const offset = Math.max(8, Math.max(...size) * 0.14);
  const y = bounds.min[1] - offset;
  const x = bounds.max[0] + offset;
  const z = bounds.min[2] - offset;
  const label = (value: number) => `${Math.round(value)} mm`;
  const color = "#8b98a8";
  return (
    <group>
      <Line points={[[bounds.min[0], y, z], [bounds.max[0], y, z]]} color={color} lineWidth={1} />
      <Line points={[[bounds.min[0], y, z], [bounds.min[0], y - offset / 2, z]]} color={color} lineWidth={1} />
      <Line points={[[bounds.max[0], y, z], [bounds.max[0], y - offset / 2, z]]} color={color} lineWidth={1} />
      <Html position={[(bounds.min[0] + bounds.max[0]) / 2, y, z]} center style={{ pointerEvents: "none" }}>
        <span className="v2-dim-label">{label(size[0])}</span>
      </Html>

      <Line points={[[x, bounds.min[1], z], [x, bounds.max[1], z]]} color={color} lineWidth={1} />
      <Line points={[[x, bounds.min[1], z], [x + offset / 2, bounds.min[1], z]]} color={color} lineWidth={1} />
      <Line points={[[x, bounds.max[1], z], [x + offset / 2, bounds.max[1], z]]} color={color} lineWidth={1} />
      <Html position={[x, (bounds.min[1] + bounds.max[1]) / 2, z]} center style={{ pointerEvents: "none" }}>
        <span className="v2-dim-label">{label(size[1])}</span>
      </Html>

      <Line points={[[x, y, bounds.min[2]], [x, y, bounds.max[2]]]} color={color} lineWidth={1} />
      <Line points={[[x, y, bounds.min[2]], [x + offset / 2, y, bounds.min[2]]]} color={color} lineWidth={1} />
      <Line points={[[x, y, bounds.max[2]], [x + offset / 2, y, bounds.max[2]]]} color={color} lineWidth={1} />
      <Html position={[x, y, (bounds.min[2] + bounds.max[2]) / 2]} center style={{ pointerEvents: "none" }}>
        <span className="v2-dim-label">{label(size[2])}</span>
      </Html>
    </group>
  );
}

function Scene({ view, fitKey, gizmoMode }: { view: View; fitKey: number; gizmoMode: "translate" | "rotate" }) {
  const document = useStudioV2((state) => state.document);
  const variants = useStudioV2((state) => state.variants);
  const selectedInstanceId = useStudioV2((state) => state.selectedInstanceId);
  const selectedDefinitionId = useStudioV2((state) => state.selectedDefinitionId);
  const driverValues = useStudioV2((state) => state.driverValues);
  const instanceVariants = useStudioV2((state) => state.instanceVariants);
  const run = useStudioV2((state) => state.run);
  const selectedRef = useRef<Group>(null);
  const geometries = useVariantGeometries(variants, instanceVariants);
  const motion = useMemo(() => motionWorldMatrices(document, driverValues), [document, driverValues]);
  const isolated = useStudioV2((state) => state.isolatedInstanceId);
  const placed = useMemo(() => {
    const items = placedVariants(document, variants, undefined, motion.matrices, instanceVariants);
    return isolated ? items.filter((item) => item.instance.id === isolated) : items;
  }, [document, instanceVariants, isolated, motion.matrices, variants]);
  const selectedPlaced = placed.find((item) => item.instance.id === selectedInstanceId) ?? null;
  const bounds = useMemo(() => {
    if (!isolated) return assemblyBounds(document, variants, instanceVariants);
    if (!selectedPlaced) return null;
    const box = { min: [Infinity, Infinity, Infinity] as [number, number, number], max: [-Infinity, -Infinity, -Infinity] as [number, number, number] };
    const variantBounds = selectedPlaced.variant.mesh.bounds;
    const point = new Vector3();
    for (const x of [variantBounds.min[0], variantBounds.max[0]]) {
      for (const y of [variantBounds.min[1], variantBounds.max[1]]) {
        for (const z of [variantBounds.min[2], variantBounds.max[2]]) {
          point.set(x, y, z).applyMatrix4(selectedPlaced.matrix);
          box.min[0] = Math.min(box.min[0], point.x);
          box.min[1] = Math.min(box.min[1], point.y);
          box.min[2] = Math.min(box.min[2], point.z);
          box.max[0] = Math.max(box.max[0], point.x);
          box.max[1] = Math.max(box.max[1], point.y);
          box.max[2] = Math.max(box.max[2], point.z);
        }
      }
    }
    return box;
  }, [document, instanceVariants, isolated, selectedPlaced, variants]);

  const commitGizmo = () => {
    const group = selectedRef.current;
    const item = selectedPlaced;
    if (!group || !item) return;
    const world = new Matrix4().compose(group.position, group.quaternion, group.scale);
    const local = groupMatrix(document, item.instance.parentId).invert().multiply(world);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    local.decompose(position, quaternion, scale);
    const euler = new Euler().setFromQuaternion(quaternion, "XYZ");
    const current =
      useStudioV2.getState().document.instances.find((instance) => instance.id === item.instance.id) ??
      item.instance;
    run({
      kind: "update_instance",
      payload: {
        instanceId: item.instance.id,
        patch: {
          transform: {
            position: [position.x, position.y, position.z],
            rotation: [
              (euler.x * 180) / Math.PI,
              (euler.y * 180) / Math.PI,
              (euler.z * 180) / Math.PI,
            ],
            scale: [scale.x, scale.y, scale.z],
          },
        },
      },
      targetRevision: current.revision,
      label: "Move instance",
    });
  };
  const radius = bounds
    ? Math.max(
        20,
        Math.hypot(
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1],
          bounds.max[2] - bounds.min[2],
        ) / 2,
      )
    : 80;

  return (
    <>
      <color attach="background" args={["#08090c"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[radius * 2, -radius * 2.4, radius * 3]} intensity={2.1} />
      <directionalLight position={[-radius * 1.8, radius, radius * 2]} intensity={0.55} />
      <directionalLight position={[0, radius * 2.5, radius]} intensity={0.5} />
      <gridHelper
        args={[Math.max(240, radius * 12), 24, "#2b332b", "#1a201b"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.01]}
      />
      {placed.map((item) => {
        const geometry = geometries.get(item.variant.key);
        if (!geometry) return null;
        return (
          <InstanceMesh
            key={item.instance.id}
            item={item}
            geometry={geometry}
            selected={selectedInstanceId === item.instance.id}
            definitionSelected={
              !selectedInstanceId && selectedDefinitionId === item.instance.definitionId
            }
            groupRef={selectedInstanceId === item.instance.id ? selectedRef : undefined}
          />
        );
      })}
      <BoundsDimensions bounds={bounds} />
      <GizmoHelper alignment="bottom-right" margin={[62, 62]}>
        <GizmoViewport axisColors={["#d95b5b", "#5fbf7f", "#5b8fe0"]} labelColor="#e8e8e8" />
      </GizmoHelper>
      {selectedPlaced ? (
        <TransformControls
          key={selectedPlaced.instance.id}
          object={selectedRef as unknown as RefObject<Object3D>}
          mode={gizmoMode}
          onMouseUp={commitGizmo}
          size={0.8}
        />
      ) : null}
      <CameraRig bounds={bounds} view={view} fitKey={fitKey} />
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

export function AssemblyStage() {
  const document = useStudioV2((state) => state.document);
  const variants = useStudioV2((state) => state.variants);
  const instanceVariants = useStudioV2((state) => state.instanceVariants);
  const compileStates = useStudioV2((state) => state.compileStates);
  const instanceStates = useStudioV2((state) => state.instanceStates);
  const selectInstance = useStudioV2((state) => state.selectInstance);
  const loadExample = useStudioV2((state) => state.loadExample);
  const loadV8Study = useStudioV2((state) => state.loadV8Study);
  const [view, setView] = useState<View>("iso");
  const [fitKey, setFitKey] = useState(0);
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate">("translate");
  const selectedInstanceId = useStudioV2((state) => state.selectedInstanceId);
  const isolatedInstanceId = useStudioV2((state) => state.isolatedInstanceId);
  const isolateInstance = useStudioV2((state) => state.isolateInstance);
  const placed = useMemo(() => placedVariants(document, variants), [document, variants]);
  const visibleCount = isolatedInstanceId
    ? document.instances.some((instance) => instance.id === isolatedInstanceId)
      ? 1
      : 0
    : placed.length;
  const pending = [...Object.values(compileStates), ...Object.values(instanceStates)].filter(
    (state) => state.status === "queued" || state.status === "compiling" || state.status === "stale",
  );
  const errors = [...Object.values(compileStates), ...Object.values(instanceStates)].filter(
    (state) => state.status === "error",
  );

  return (
    <section className="v2-stage">
      <Canvas
        shadows={false}
        orthographic
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ zoom: 1, near: 0.5, far: 20000, position: [200, -260, 180] }}
        onPointerMissed={() => selectInstance(null)}
      >
        <Scene view={view} fitKey={fitKey} gizmoMode={gizmoMode} />
      </Canvas>

      <MotionHud />

      <div className="v2-stage-top">
        <div className="v2-stage-label">
          <span className="mono">ASSEMBLY</span>
          <strong>{document.name}</strong>
          <span className="mono">
            {visibleCount} visible · {Object.keys(variants).length + Object.keys(instanceVariants).length} compiled
          </span>
        </div>
        <div className="view-controls">
          {selectedInstanceId ? (
            <>
              <button
                className={`icon-btn ${gizmoMode === "translate" ? "active" : ""}`}
                onClick={() => setGizmoMode("translate")}
                title="Move"
                aria-label="Move selected part"
              >
                <Icon name="move" size={12} />
              </button>
              <button
                className={`icon-btn ${gizmoMode === "rotate" ? "active" : ""}`}
                onClick={() => setGizmoMode("rotate")}
                title="Rotate"
                aria-label="Rotate selected part"
              >
                <Icon name="orbit" size={12} />
              </button>
            </>
          ) : null}
          <button className={`icon-btn ${view === "iso" ? "active" : ""}`} onClick={() => setView("iso")}>
            ISO
          </button>
          <button className={`icon-btn ${view === "front" ? "active" : ""}`} onClick={() => setView("front")}>
            FR
          </button>
          <button className={`icon-btn ${view === "top" ? "active" : ""}`} onClick={() => setView("top")}>
            TP
          </button>
          <button className={`icon-btn ${view === "side" ? "active" : ""}`} onClick={() => setView("side")}>
            SD
          </button>
          <button className="icon-btn tooltip" data-tip="Fit all" onClick={() => setFitKey((value) => value + 1)}>
            <Icon name="fit" />
          </button>
        </div>
      </div>

      {isolatedInstanceId ? (
        <div className="v2-isolate-banner">
          <span className="mono">Isolated part</span>
          <button className="btn v2-small" onClick={() => isolateInstance(null)}>
            Show all
          </button>
        </div>
      ) : null}

      {!document.instances.length ? (
        <div className="v2-stage-empty">
          <div>
            <span className="eyebrow">New part</span>
            <h2>Describe it, load a study, or import source.</h2>
            <p>
              Parts stay separate. Select one in the tree or stage, edit its dimensions, and the rest of the
              assembly stays live. The agent can build alongside you.
            </p>
            <div className="v2-actions">
              <button className="btn btn-primary" onClick={() => loadExample("plate")}>
                <Icon name="cube" size={12} /> Mounting plate
              </button>
              <button className="btn" onClick={() => loadExample("bracket")}>
                Honeycomb bracket
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending.length ? (
        <div className="v2-stage-chip">
          <span className="status-dot busy" />
          <span className="mono">
            Compiling {pending.length} part{pending.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      {errors.length ? (
        <div className="v2-stage-chip v2-stage-chip-error">
          <Icon name="warning" size={11} />
          <span className="mono">
            {errors.length} part{errors.length === 1 ? "" : "s"} failed
          </span>
        </div>
      ) : null}
    </section>
  );
}
