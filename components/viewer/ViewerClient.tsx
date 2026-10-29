"use client";

import dynamic from "next/dynamic";

export const Viewer = dynamic(() => import("./Viewer").then((module) => module.Viewer), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">
      <span className="eyebrow">Calibrating the bench</span>
    </div>
  ),
});
