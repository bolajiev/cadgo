"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useProject } from "@/lib/store/project";

export function HoleModal() {
  const facePick = useProject((state) => state.facePick);
  const spec = useProject((state) => state.spec);
  const cutHole = useProject((state) => state.cutHole);
  const cancelHolePick = useProject((state) => state.cancelHolePick);
  const [diameter, setDiameter] = useState(6);

  useEffect(() => {
    if (facePick) setDiameter(6);
  }, [facePick]);

  if (!facePick || !spec) return null;
  const part = spec.parts.find((item) => item.id === facePick.partId);

  return (
    <Modal
      title="Cut a hole"
      eyebrow="Direct edit / no AI round-trip"
      onClose={cancelHolePick}
      actions={
        <>
          <button className="btn btn-ghost" onClick={cancelHolePick}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => cutHole(diameter)}
            disabled={!Number.isFinite(diameter) || diameter < 0.5 || diameter > 120}
          >
            Cut Ø {diameter.toFixed(1)} mm
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        A through-hole will be cut along the picked face normal on <strong>{part?.name ?? facePick.partId}</strong>.
        It becomes a real feature in the CadSpec, so it survives parameter changes and exports.
      </p>
      <div className="field">
        <label htmlFor="hole-diameter">Hole diameter (mm)</label>
        <input
          id="hole-diameter"
          type="number"
          min={0.5}
          max={120}
          step={0.5}
          value={diameter}
          onChange={(event) => setDiameter(Number(event.target.value))}
        />
      </div>
      <div className="hole-readout mono">
        X {facePick.point[0].toFixed(1)} · Y {facePick.point[1].toFixed(1)} · Z {facePick.point[2].toFixed(1)}
      </div>
      <div className="modal-hint">
        <Icon name="info" /> The cut is local to the part and rebuilt by the kernel.
      </div>
    </Modal>
  );
}
