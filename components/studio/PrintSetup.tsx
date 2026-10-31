"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { BuildPurpose, PrintBed, PrintProfile } from "@/lib/studio/profile";

const PURPOSES: { id: BuildPurpose; label: string }[] = [
  { id: "3d-print", label: "3D printing" },
  { id: "visualization", label: "Visualization" },
  { id: "cnc", label: "CNC / laser" },
  { id: "assembly", label: "Mechanical assembly" },
];

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Resin", "Other"];

export function PrintSetup({
  initial,
  hasImage,
  onSave,
  onCancel,
}: {
  initial?: PrintProfile | null;
  hasImage?: boolean;
  onSave: (profile: PrintProfile) => void;
  onCancel: () => void;
}) {
  const [purpose, setPurpose] = useState<BuildPurpose>(initial?.purpose ?? "3d-print");
  const [printer, setPrinter] = useState(initial?.printer ?? "");
  const [bed, setBed] = useState<PrintBed>(initial?.bed ?? { x: 220, y: 220, z: 250 });
  const [material, setMaterial] = useState(initial?.material ?? "PLA");
  const [supports, setSupports] = useState<"none" | "allowed">(initial?.supports ?? "none");
  const [scaleNote, setScaleNote] = useState(initial?.scaleNote ?? "");
  const validBed = bed.x > 0 && bed.y > 0 && bed.z > 0;
  const canSave = purpose !== "3d-print" || validBed;

  const save = () => {
    if (!canSave) return;
    const profile: PrintProfile = { purpose };
    if (purpose === "3d-print") {
      if (printer.trim()) profile.printer = printer.trim();
      profile.bed = bed;
      profile.material = material;
      profile.supports = supports;
    }
    if (scaleNote.trim()) profile.scaleNote = scaleNote.trim();
    onSave(profile);
  };

  return (
    <div className="studio-setup">
      <div className="studio-setup-head">
        <div>
          <span className="eyebrow">Agent setup</span>
          <strong>{hasImage ? "I can model the image — what is it for?" : "What is this part for?"}</strong>
        </div>
        <button className="icon-btn" onClick={onCancel} aria-label="Close setup">
          <Icon name="close" />
        </button>
      </div>

      <div className="studio-purpose-grid">
        {PURPOSES.map((item) => (
          <button
            key={item.id}
            className={`studio-purpose ${purpose === item.id ? "active" : ""}`}
            onClick={() => setPurpose(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {purpose === "3d-print" ? (
        <>
          <div className="studio-setup-fields">
            <label className="studio-setup-wide">
              <span>Known scale <em>optional, e.g. overall width 80 mm</em></span>
              <input
                value={scaleNote}
                onChange={(event) => setScaleNote(event.target.value)}
                placeholder="A ruler in the photo, or a measured dimension"
              />
            </label>
            <label className="studio-setup-wide">
              <span>Printer model <em>optional</em></span>
              <input
                value={printer}
                onChange={(event) => setPrinter(event.target.value)}
                placeholder="Bambu Lab A1, Ender 3…"
              />
            </label>
            <label>
              <span>Bed X <em>mm</em></span>
              <input
                type="number"
                min={20}
                max={2000}
                value={bed.x || ""}
                onChange={(event) => setBed({ ...bed, x: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Bed Y <em>mm</em></span>
              <input
                type="number"
                min={20}
                max={2000}
                value={bed.y || ""}
                onChange={(event) => setBed({ ...bed, y: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Bed Z <em>mm</em></span>
              <input
                type="number"
                min={20}
                max={2000}
                value={bed.z || ""}
                onChange={(event) => setBed({ ...bed, z: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>Material</span>
              <select value={material} onChange={(event) => setMaterial(event.target.value)}>
                {MATERIALS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Supports</span>
              <select
                value={supports}
                onChange={(event) => setSupports(event.target.value as "none" | "allowed")}
              >
                <option value="none">None — self-supporting</option>
                <option value="allowed">Allowed</option>
              </select>
            </label>
          </div>
          <p className="studio-setup-hint">
            <Icon name="info" size={11} />
            {printer.trim()
              ? `I will research ${printer.trim()} and the bed before drawing.`
              : "I will research this build volume and FDM print constraints before drawing."}
          </p>
        </>
      ) : (
        <p className="studio-setup-hint">
          <Icon name="info" size={11} />
          {purpose === "visualization"
            ? "Visual model only — no print constraints."
            : "Tell me the process constraints in your brief; I will state assumptions."}
        </p>
      )}

      <div className="studio-setup-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={!canSave}>
          <Icon name="check" /> Use setup
        </button>
      </div>
    </div>
  );
}
