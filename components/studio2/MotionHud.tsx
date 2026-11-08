"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStudioV2 } from "@/lib/studio/v2/store";
import { motionWorldMatrices } from "@/lib/studio/v2/motion";

const SPEEDS = [30, 90, 180, 360];

export function MotionHud() {
  const document = useStudioV2((state) => state.document);
  const values = useStudioV2((state) => state.driverValues);
  const playing = useStudioV2((state) => state.driverPlaying);
  const speed = useStudioV2((state) => state.driverSpeed);
  const setValue = useStudioV2((state) => state.setDriverValue);
  const setPlaying = useStudioV2((state) => state.setDriverPlaying);
  const setSpeed = useStudioV2((state) => state.setDriverSpeed);
  const commitDriver = useStudioV2((state) => state.commitDriver);
  const [selectedId, setSelectedId] = useState<string | null>(document.drivers[0]?.id ?? null);

  const selected = document.drivers.find((driver) => driver.id === selectedId) ?? document.drivers[0];
  const motion = useMemo(() => motionWorldMatrices(document, values), [document, values]);
  const errorCount = Object.keys(motion.errors).length;

  useEffect(() => {
    if (!document.drivers.length) {
      setSelectedId(null);
      return;
    }
    if (!document.drivers.some((driver) => driver.id === selectedId)) {
      setSelectedId(document.drivers[0].id);
    }
  }, [document.drivers, selectedId]);

  useEffect(() => {
    if (!playing) return;
    const driver = document.drivers.find((item) => item.id === playing);
    if (!driver) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const state = useStudioV2.getState();
      const current = state.driverValues[driver.id] ?? driver.value;
      let next = current + speed * delta;
      if (next > driver.max) next = driver.min + ((next - driver.max) % (driver.max - driver.min || 1));
      state.setDriverValue(driver.id, next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [document.drivers, playing, speed]);

  if (!document.drivers.length || !selected) return null;
  const value = values[selected.id] ?? selected.value;
  const isPlaying = playing === selected.id;

  const toggle = () => {
    if (isPlaying) {
      setPlaying(null);
      commitDriver(selected.id);
    } else {
      setPlaying(selected.id);
    }
  };

  return (
    <div className="v2-motion-hud">
      <div className="v2-motion-head">
        <span className="eyebrow">Motion</span>
        {document.drivers.length > 1 ? (
          <select
            className="v2-motion-select mono"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {document.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="mono">{selected.name}</span>
        )}
        {errorCount ? <span className="mono v2-motion-error">{errorCount} joint error</span> : null}
      </div>
      <div className="v2-motion-row">
        <button className="icon-btn" onClick={toggle} aria-label={isPlaying ? "Pause motion" : "Play motion"}>
          <Icon name={isPlaying ? "pause" : "play"} />
        </button>
        <input
          className="v2-motion-slider"
          type="range"
          min={selected.min}
          max={selected.max}
          step={selected.step}
          value={value}
          onChange={(event) => setValue(selected.id, Number(event.target.value))}
          onPointerUp={() => commitDriver(selected.id)}
          onKeyUp={() => commitDriver(selected.id)}
        />
        <span className="mono v2-motion-value">
          {Math.round(value)}
          <em>{selected.unit}</em>
        </span>
        <select
          className="v2-motion-select mono"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
          aria-label="Motion speed"
        >
          {SPEEDS.map((item) => (
            <option key={item} value={item}>
              {item}°/s
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
