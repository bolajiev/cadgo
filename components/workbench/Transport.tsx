"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useProject } from "@/lib/store/project";

export function Transport() {
  const playing = useProject((state) => state.playing);
  const timeline = useProject((state) => state.timeline);
  const spec = useProject((state) => state.spec);
  const play = useProject((state) => state.play);
  const pause = useProject((state) => state.pause);
  const seek = useProject((state) => state.seek);
  const resetJoints = useProject((state) => state.resetJoints);
  const explode = useProject((state) => state.explode);
  const setExplode = useProject((state) => state.setExplode);
  const rail = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (!spec) return null;

  const seekAt = (clientX: number) => {
    const node = rail.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    seek((clientX - rect.left) / rect.width);
  };

  return (
    <div className="transport" aria-label="Motion controls">
      <button
        className={`transport-btn ${playing ? "playing" : ""}`}
        onClick={() => (playing ? pause() : play())}
        aria-label={playing ? "Pause motion" : "Play motion"}
      >
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <button className="transport-btn" onClick={resetJoints} aria-label="Reset pose">
        <Icon name="refresh" />
      </button>
      <div className="transport-divider" />
      <div
        className="timeline"
        ref={rail}
        role="slider"
        aria-label="Motion timeline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(timeline * 100)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") seek(timeline + 0.02);
          if (event.key === "ArrowLeft") seek(timeline - 0.02);
          if (event.key === "Home") seek(0);
          if (event.key === "End") seek(1);
        }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekAt(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging.current) seekAt(event.clientX);
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <div className="timeline-track">
          <div className="timeline-fill" style={{ width: `${timeline * 100}%` }} />
          <div className="timeline-thumb" style={{ left: `${timeline * 100}%` }} />
        </div>
      </div>
      <span className="transport-label">{playing ? "RUN" : `${Math.round(timeline * 100)}%`}</span>
      <div className="transport-divider" />
      <button
        className={`transport-btn ${explode > 0.5 ? "playing" : ""}`}
        onClick={() => setExplode(explode > 0.5 ? 0 : 1)}
        aria-label="Toggle exploded view"
        title="Exploded view"
      >
        <Icon name="explode" />
      </button>
    </div>
  );
}
