"use client";

import type { CSSProperties } from "react";
import { useProject } from "@/lib/store/project";

export function ParametersPanel() {
  const spec = useProject((state) => state.spec);
  const status = useProject((state) => state.status);
  const setParameter = useProject((state) => state.setParameter);

  return (
    <section className="panel parameters-panel">
      <div className="panel-head">
        <span className="panel-label">Parameters</span>
        <span className="panel-hint">
          {status === "compiling" ? "recutting" : spec ? `${spec.parameters.length} live` : "—"}
        </span>
      </div>
      {!spec ? (
        <div className="panel-body">
          <div className="brief-empty">Parameters appear here once an assembly is on the bench.</div>
        </div>
      ) : (
        <div className="param-list">
          {spec.parameters.map((parameter) => {
            const min = parameter.min ?? 0;
            const max = parameter.max ?? Math.max(parameter.value * 2, 1);
            const span = max - min || 1;
            const fill = Math.min(100, Math.max(0, ((parameter.value - min) / span) * 100));
            return (
              <div className="param-row" key={parameter.id}>
                <div className="param-top">
                  <span className="param-name">{parameter.label}</span>
                  <span className="param-value">
                    {Math.round(parameter.value * 10) / 10}
                    {parameter.unit ? <em> {parameter.unit}</em> : null}
                  </span>
                </div>
                <input
                  className="range"
                  type="range"
                  min={min}
                  max={max}
                  step={1}
                  value={parameter.value}
                  style={{ "--fill": `${fill}%` } as CSSProperties}
                  onChange={(event) => setParameter(parameter.id, Number(event.target.value))}
                  aria-label={parameter.label}
                />
              </div>
            );
          })}
          <div className="param-foot">
            <span className="eyebrow">Local rebuild</span>
            <span className="mono">No AI round-trip</span>
          </div>
        </div>
      )}
    </section>
  );
}
