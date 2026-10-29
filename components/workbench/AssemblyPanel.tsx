"use client";

import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { useProject } from "@/lib/store/project";
import { MATERIALS, massGrams } from "@/lib/cad/materials";
import { formatMass, formatMeasure, formatVolume } from "@/lib/format";
import type { MaterialId } from "@/lib/cad/types";

export function AssemblyPanel() {
  const spec = useProject((state) => state.spec);
  const meshes = useProject((state) => state.meshes);
  const selectedPartId = useProject((state) => state.selectedPartId);
  const selectedJointId = useProject((state) => state.selectedJointId);
  const hiddenParts = useProject((state) => state.hiddenParts);
  const jointValues = useProject((state) => state.jointValues);
  const selectPart = useProject((state) => state.selectPart);
  const selectJoint = useProject((state) => state.selectJoint);
  const togglePart = useProject((state) => state.togglePart);
  const setJoint = useProject((state) => state.setJoint);
  const startHolePick = useProject((state) => state.startHolePick);
  const pickMode = useProject((state) => state.pickMode);

  if (!spec) {
    return (
      <section className="panel assembly-panel">
        <div className="panel-head">
          <span className="panel-label">Assembly</span>
          <span className="panel-hint">empty</span>
        </div>
        <div className="panel-body">
          <div className="brief-empty">The parts tree, joints and bill of materials land here.</div>
        </div>
      </section>
    );
  }

  const massOf = (partId: string) => {
    const mesh = meshes.find((part) => part.id === partId);
    const source = spec.parts.find((part) => part.id === partId);
    return massGrams(mesh?.volume ?? 0, (source?.material ?? "aluminium") as MaterialId);
  };
  const totalMass = meshes.reduce((sum, part) => sum + massOf(part.id), 0);
  const totalVolume = meshes.reduce((sum, part) => sum + part.volume, 0);
  const selectedPart = spec.parts.find((part) => part.id === selectedPartId);
  const selectedMesh = meshes.find((part) => part.id === selectedPartId);
  const selectedJoint = spec.joints.find((joint) => joint.id === selectedJointId);
  const jointValue = selectedJoint ? (jointValues[selectedJoint.id] ?? selectedJoint.value ?? 0) : 0;
  const activeJointCount = spec.joints.filter((joint) => joint.type !== "fixed").length;

  return (
    <section className="panel assembly-panel">
      <div className="panel-head">
        <span className="panel-label">Assembly</span>
        <span className="panel-hint">{spec.parts.length} parts</span>
      </div>
      <div className="panel-body assembly-scroll">
        <div className="assembly-summary">
          <div>
            <span className="readout-label">Mass</span>
            <strong>{formatMass(totalMass)}</strong>
          </div>
          <div>
            <span className="readout-label">Volume</span>
            <strong>{formatVolume(totalVolume)}</strong>
          </div>
          <div>
            <span className="readout-label">Joints</span>
            <strong>{activeJointCount}</strong>
          </div>
        </div>

        <div className="tree">
          <div className="tree-group-label">
            <span>Parts</span>
            <span>vol · eye</span>
          </div>
          {spec.parts.map((part, index) => {
            const mesh = meshes.find((item) => item.id === part.id);
            const material = MATERIALS[part.material];
            const hidden = !!hiddenParts[part.id];
            return (
              <div
                key={part.id}
                className={`tree-row ${selectedPartId === part.id ? "selected" : ""} ${hidden ? "hidden" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => selectPart(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectPart(part.id);
                }}
              >
                <span className="tree-index mono">{String(index + 1).padStart(2, "0")}</span>
                <span className="swatch" style={{ background: material.color }} />
                <span className="name">{part.name}</span>
                <span className="meta">{mesh ? `${(mesh.volume / 1000).toFixed(0)} cm³` : "—"}</span>
                <button
                  className="icon-btn eye"
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePart(part.id);
                  }}
                  aria-label={hidden ? `Show ${part.name}` : `Hide ${part.name}`}
                >
                  <Icon name={hidden ? "eye-off" : "eye"} size={13} />
                </button>
              </div>
            );
          })}

          <div className="tree-group-label">
            <span>Joints</span>
            <span>{activeJointCount} live</span>
          </div>
          {[...spec.joints]
            .sort((a, b) => Number(a.type === "fixed") - Number(b.type === "fixed"))
            .map((joint) => {
              const [min, max] =
                joint.limits ?? (joint.type === "prismatic" ? [-50, 50] : [-180, 180]);
              const value = jointValues[joint.id] ?? joint.value ?? 0;
              return (
                <button
                  key={joint.id}
                  className={`joint-row ${selectedJointId === joint.id ? "selected" : ""} ${
                    joint.type === "fixed" ? "fixed" : ""
                  }`}
                  onClick={() => selectJoint(joint.id)}
                >
                  <span className="joint-glyph" />
                  <span className="name">{joint.name}</span>
                  <span className="angle">
                    {joint.type === "fixed" ? "locked" : `${formatMeasure(value, joint.unit ?? (joint.type === "prismatic" ? "mm" : "deg"))}`}
                  </span>
                  <span className="sr-only">
                    limits {min} to {max}
                  </span>
                </button>
              );
            })}
        </div>

        {selectedPart ? (
          <div className="selected-card">
            <div className="selected-title">
              <strong>{selectedPart.name}</strong>
              <span className="mono" style={{ fontSize: 8, color: "var(--faint)" }}>
                {selectedPart.id}
              </span>
            </div>
            <div className="selected-grid">
              <div className="cell">
                <span>Material</span>
                <strong>{MATERIALS[selectedPart.material].label}</strong>
              </div>
              <div className="cell">
                <span>Mass</span>
                <strong>{formatMass(massOf(selectedPart.id))}</strong>
              </div>
              <div className="cell">
                <span>Volume</span>
                <strong>{selectedMesh ? formatVolume(selectedMesh.volume) : "—"}</strong>
              </div>
              <div className="cell">
                <span>Envelope</span>
                <strong>
                  {selectedMesh
                    ? `${Math.round(selectedMesh.bounds.max[0] - selectedMesh.bounds.min[0])}×${Math.round(
                        selectedMesh.bounds.max[1] - selectedMesh.bounds.min[1],
                      )}×${Math.round(selectedMesh.bounds.max[2] - selectedMesh.bounds.min[2])}`
                    : "—"}
                </strong>
              </div>
            </div>
            <div className="selected-actions">
              <button className="btn" onClick={startHolePick} disabled={pickMode === "hole"}>
                <Icon name="cursor" /> Cut a hole
              </button>
              <button
                className="btn"
                onClick={() => togglePart(selectedPart.id)}
                aria-label={hiddenParts[selectedPart.id] ? "Show part" : "Hide part"}
              >
                <Icon name={hiddenParts[selectedPart.id] ? "eye" : "eye-off"} />
              </button>
            </div>
          </div>
        ) : null}

        {selectedJoint ? (
          <div className="selected-card">
            <div className="selected-title">
              <strong>{selectedJoint.name}</strong>
              <span className="mono" style={{ fontSize: 8, color: "var(--faint)" }}>
                {selectedJoint.type}
              </span>
            </div>
            <div className="selected-grid">
              <div className="cell">
                <span>Parent</span>
                <strong>{selectedJoint.parent}</strong>
              </div>
              <div className="cell">
                <span>Child</span>
                <strong>{selectedJoint.child}</strong>
              </div>
            </div>
            {selectedJoint.type !== "fixed" ? (
              <div style={{ marginTop: 9 }}>
                <div className="param-top">
                  <span className="param-name">Position</span>
                  <span className="param-value">
                    {formatMeasure(jointValue, selectedJoint.unit ?? (selectedJoint.type === "prismatic" ? "mm" : "deg"))}
                  </span>
                </div>
                <input
                  className="range"
                  type="range"
                  min={selectedJoint.limits?.[0] ?? -180}
                  max={selectedJoint.limits?.[1] ?? 180}
                  step={selectedJoint.type === "prismatic" ? 0.5 : 1}
                  value={jointValue}
                  style={
                    {
                      "--fill": `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((jointValue - (selectedJoint.limits?.[0] ?? -180)) /
                            ((selectedJoint.limits?.[1] ?? 180) - (selectedJoint.limits?.[0] ?? -180) || 1)) *
                            100,
                        ),
                      )}%`,
                    } as CSSProperties
                  }
                  onChange={(event) => setJoint(selectedJoint.id, Number(event.target.value))}
                  aria-label={`${selectedJoint.name} position`}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="bom-note">
          <span className="eyebrow">Bill of materials</span>
          <span className="mono">{formatMass(totalMass)} total</span>
        </div>
      </div>
    </section>
  );
}
