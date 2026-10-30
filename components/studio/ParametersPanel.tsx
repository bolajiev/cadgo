"use client";

import type { CSSProperties } from "react";
import { useStudio } from "@/lib/studio/store";

export function StudioParameters() {
  const params = useStudio((state) => state.params);
  const status = useStudio((state) => state.status);
  const setParam = useStudio((state) => state.setParam);
  const groups = params.reduce<Record<string, typeof params>>((result, param) => {
    const key = param.group ?? "Dimensions";
    result[key] = [...(result[key] ?? []), param];
    return result;
  }, {});

  if (!params.length) {
    return (
      <div className="studio-empty-panel">
        No model yet. Describe a part or open a bench study; its dimensions will appear here as
        sliders.
      </div>
    );
  }

  return (
    <div className="studio-params">
      <div className="studio-params-note">
        <span className="eyebrow">Local rebuild</span>
        <span className="mono">{status === "compiling" ? "recutting…" : "no AI round-trip"}</span>
      </div>
      {Object.entries(groups).map(([group, items]) => (
        <section className="studio-group" key={group}>
          <div className="studio-group-label">{group}</div>
          {items.map((param) => {
            const fill =
              param.type === "number"
                ? Math.min(100, Math.max(0, ((Number(param.value) - param.min) / (param.max - param.min || 1)) * 100))
                : 0;
            return (
              <div className="studio-param" key={param.name}>
                <div className="studio-param-head">
                  <div className="studio-param-label">
                    <span>{param.label}</span>
                    {param.description ? <small>{param.description}</small> : null}
                  </div>
                  <span className="studio-param-value mono">
                    {param.type === "number"
                      ? Math.round(Number(param.value) * 100) / 100
                      : param.value
                        ? "on"
                        : "off"}
                  </span>
                </div>
                {param.type === "number" ? (
                  <input
                    className="range studio-range"
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={Number(param.value)}
                    style={{ "--fill": `${fill}%` } as CSSProperties}
                    onChange={(event) => setParam(param.name, Number(event.target.value))}
                    aria-label={param.label}
                  />
                ) : (
                  <label className="studio-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(param.value)}
                      onChange={(event) => setParam(param.name, event.target.checked)}
                    />
                    <span className="studio-toggle-track" />
                    <span>{param.value ? "Enabled" : "Disabled"}</span>
                  </label>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
