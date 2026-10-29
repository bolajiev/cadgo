"use client";

import { useEffect, useMemo, useState } from "react";
import { Viewer } from "@/components/viewer/ViewerClient";
import { Icon } from "@/components/ui/Icon";
import { Transport } from "./Transport";
import { useProject } from "@/lib/store/project";
import { useToast } from "@/lib/store/ui";
import { massGrams } from "@/lib/cad/materials";
import { formatMass, formatVolume } from "@/lib/format";
import { downloadPlate } from "@/lib/export/plate";
import { lampSpec } from "@/lib/cad/examples/lamp";

function DraftClock() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return <span className="mono">{String(minutes).padStart(2, "0")}:{String(rest).padStart(2, "0")}</span>;
}

export function ViewportPanel() {
  const spec = useProject((state) => state.spec);
  const meshes = useProject((state) => state.meshes);
  const bounds = useProject((state) => state.bounds);
  const offset = useProject((state) => state.offset);
  const jointValues = useProject((state) => state.jointValues);
  const view = useProject((state) => state.view);
  const plate = useProject((state) => state.plate);
  const explode = useProject((state) => state.explode);
  const fitKey = useProject((state) => state.fitKey);
  const status = useProject((state) => state.status);
  const stages = useProject((state) => state.stages);
  const error = useProject((state) => state.error);
  const compileMs = useProject((state) => state.compileMs);
  const selectedPartId = useProject((state) => state.selectedPartId);
  const selectedJointId = useProject((state) => state.selectedJointId);
  const hoveredPartId = useProject((state) => state.hoveredPartId);
  const hiddenParts = useProject((state) => state.hiddenParts);
  const pickMode = useProject((state) => state.pickMode);
  const captureRequest = useProject((state) => state.captureRequest);
  const lastPrompt = useProject((state) => state.lastPrompt);
  const setView = useProject((state) => state.setView);
  const setPlate = useProject((state) => state.setPlate);
  const fit = useProject((state) => state.fit);
  const selectPart = useProject((state) => state.selectPart);
  const selectJoint = useProject((state) => state.selectJoint);
  const setHoveredPart = useProject((state) => state.setHoveredPart);
  const setJoint = useProject((state) => state.setJoint);
  const setFacePick = useProject((state) => state.setFacePick);
  const cancelHolePick = useProject((state) => state.cancelHolePick);
  const generate = useProject((state) => state.generate);
  const loadExample = useProject((state) => state.loadExample);
  const dismissError = useProject((state) => state.dismissError);
  const notify = useToast((state) => state.notify);

  const stats = useMemo(() => {
    if (!spec) return { mass: 0, volume: 0 };
    const mass = meshes.reduce((sum, part) => {
      const source = spec.parts.find((item) => item.id === part.id);
      return sum + massGrams(part.volume, source?.material ?? "aluminium");
    }, 0);
    const volume = meshes.reduce((sum, part) => sum + part.volume, 0);
    return { mass, volume };
  }, [meshes, spec]);

  const loading = !spec && (status === "drafting" || status === "compiling");

  return (
    <section className={`panel viewport-panel ${plate ? "plate-mode" : ""}`}>
      <div className="viewport">
        <div className="viewport-grid" />
        {spec ? (
          <Viewer
            spec={spec}
            meshes={meshes}
            bounds={bounds}
            offset={offset}
            jointValues={jointValues}
            selectedPartId={selectedPartId}
            selectedJointId={selectedJointId}
            hoveredPartId={hoveredPartId}
            hiddenParts={hiddenParts}
            view={view}
            plate={plate}
            explode={explode}
            fitKey={fitKey}
            pickMode={pickMode}
            captureRequest={captureRequest}
            onSelectPart={selectPart}
            onSelectJoint={selectJoint}
            onHoverPart={setHoveredPart}
            onJointChange={setJoint}
            onFacePick={(pick) => {
              setFacePick(pick);
              notify("Face picked — set the hole diameter");
            }}
            onCapture={(dataUrl) => {
              downloadPlate(dataUrl, spec, stats.volume, stats.mass, meshes.length)
                .then(() => notify("Plate PNG saved"))
                .catch(() => notify("Plate render could not be composed", "accent"));
            }}
          />
        ) : null}

        {!plate ? (
          <>
            <div className="viewport-top">
              <div className="plate-title">
                <span className="plate-fig">
                  {spec ? "Fig. 01 / assembly" : "Fig. 00 / drafting"}
                </span>
                <span className="plate-name">{spec?.name ?? (loading ? "Drafting a mechanism" : "The bench is clear")}</span>
                <span className="plate-sub">
                  {spec?.subtitle ??
                    (loading
                      ? "Parts, joints and a working motion are being resolved."
                      : "Describe a mechanism below, or open a study from the benchbook.")}
                </span>
              </div>
              <div className="view-controls">
                <button
                  className={`icon-btn ${view === "iso" ? "active" : ""}`}
                  onClick={() => setView("iso")}
                  aria-label="Isometric view"
                >
                  ISO
                </button>
                <button
                  className={`icon-btn ${view === "front" ? "active" : ""}`}
                  onClick={() => setView("front")}
                  aria-label="Front view"
                >
                  FR
                </button>
                <button
                  className={`icon-btn ${view === "top" ? "active" : ""}`}
                  onClick={() => setView("top")}
                  aria-label="Top view"
                >
                  TP
                </button>
                <button className="icon-btn tooltip" data-tip="Fit" onClick={fit} aria-label="Fit view">
                  <Icon name="fit" />
                </button>
                <button
                  className={`icon-btn tooltip ${plate ? "active" : ""}`}
                  data-tip="Plate mode"
                  onClick={() => setPlate(!plate)}
                  aria-label="Toggle plate mode"
                >
                  <Icon name="plate" />
                </button>
              </div>
            </div>

            {spec ? (
              <>
                <div className="viewport-hint">
                  <kbd>drag</kbd> orbit <kbd>scroll</kbd> zoom <kbd>ring</kbd> move joint
                </div>
                <div className="viewport-readout">
                  <div className="readout-item">
                    <span className="readout-label">Mass</span>
                    <span className="readout-value">{formatMass(stats.mass)}</span>
                  </div>
                  <div className="readout-item">
                    <span className="readout-label">Volume</span>
                    <span className="readout-value">{formatVolume(stats.volume)}</span>
                  </div>
                  <div className="readout-item">
                    <span className="readout-label">Kernel</span>
                    <span className="readout-value">
                      {compileMs}
                      <em>ms</em>
                    </span>
                  </div>
                </div>
                <Transport />
              </>
            ) : null}
          </>
        ) : (
          <div className="plate-mode-bar">
            <span className="eyebrow">Plate mode / ink on paper</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" onClick={() => setPlate(false)}>
                <Icon name="cube" /> Back to bench
              </button>
            </div>
          </div>
        )}

        {pickMode === "hole" ? (
          <div className="pick-banner">
            <Icon name="cursor" />
            <span>Click a face to place the hole.</span>
            <button className="icon-btn" onClick={cancelHolePick} aria-label="Cancel hole">
              <Icon name="close" />
            </button>
          </div>
        ) : null}

        {status === "drafting" && spec ? (
          <div className="busy-strip">
            <span className="status-dot busy" />
            <span className="mono">Revising the assembly…</span>
          </div>
        ) : null}

        {error && spec ? (
          <div className="viewport-error">
            <Icon name="warning" />
            <span>{error}</span>
            <button className="icon-btn" onClick={dismissError} aria-label="Dismiss error">
              <Icon name="close" />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="loading-veil">
            <div className="loading-card">
              <span className="eyebrow">Cadgo drafting engine</span>
              <h2 className="loading-title">Setting the bench</h2>
              <p className="loading-sub">A brief becomes a jointed assembly.</p>
              <div className="drafting-live">
                <span className="status-dot busy" />
                <span className="mono">LIVE DRAFT</span>
                <DraftClock />
              </div>
              <div className="drafting-animation">
                <span className="drafting-rail" />
                <span className="drafting-pen" />
              </div>
              <div className="stage-list">
                {stages.map((stage) => (
                  <div key={stage.id} className={`stage-row ${stage.status}`}>
                    <span className="stage-mark" />
                    <span>{stage.label}</span>
                    <span>{stage.status === "done" ? "ok" : stage.status === "active" ? "…" : ""}</span>
                  </div>
                ))}
              </div>
              <p className="loading-note">
                Complex briefs take 20–60 seconds. The bench stays live; you can load a proven study
                instead.
              </p>
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => loadExample(lampSpec, "Show me the springline lamp study")}
              >
                Use a bench study <Icon name="arrow" />
              </button>
            </div>
          </div>
        ) : null}

        {!spec && !loading && status !== "error" ? (
          <div className="empty-state">
            <div className="empty-inner">
              <span className="eyebrow">The bench is clear</span>
              <h2 className="empty-title">Describe a small machine.</h2>
              <p className="empty-text">
                Cadgo drafts named parts, real millimetre dimensions, joints with limits, and a motion
                you can test. Start with one of these:
              </p>
              <div className="chip-row">
                {["A bench vise with a sliding jaw", "A pan-tilt camera head", "A desk monitor arm"].map(
                  (suggestion) => (
                    <button key={suggestion} className="chip" onClick={() => generate(suggestion)}>
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
              <button
                className="btn"
                style={{ marginTop: 14 }}
                onClick={() => loadExample(lampSpec, "Show me the springline lamp study")}
              >
                Load the lamp study <Icon name="arrow" />
              </button>
            </div>
          </div>
        ) : null}

        {!spec && status === "error" ? (
          <div className="empty-state">
            <div className="empty-inner">
              <span className="eyebrow" style={{ color: "var(--accent)" }}>
                Draft interrupted
              </span>
              <h2 className="empty-title">The bench note needs a second look.</h2>
              <p className="empty-text">{error ?? "The drafter did not return a buildable assembly."}</p>
              <div className="chip-row">
                <button
                  className="btn btn-primary"
                  onClick={() => lastPrompt && generate(lastPrompt)}
                  disabled={!lastPrompt}
                >
                  <Icon name="refresh" /> Try again
                </button>
                <button
                  className="btn"
                  onClick={() => loadExample(lampSpec, "Show me the springline lamp study")}
                >
                  Load a proven study
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <span className="plate-corner tl" />
        <span className="plate-corner tr" />
        <span className="plate-corner bl" />
        <span className="plate-corner br" />
      </div>

      <div className="viewport-footer">
        <div className="footer-left">
          <span className="status-dot" />
          <span className="mono">{spec ? "assembly live" : "kernel ready"}</span>
        </div>
        <div className="footer-center">
          {spec ? `${spec.parts.length} parts · ${spec.joints.filter((joint) => joint.type !== "fixed").length} moving joints` : "browser-native CAD"}
        </div>
        <div className="footer-right">
          <span className="mono">{spec ? `${meshes.reduce((sum, part) => sum + part.triangles, 0).toLocaleString()} tris` : "manifold 3.5"}</span>
        </div>
      </div>
    </section>
  );
}
