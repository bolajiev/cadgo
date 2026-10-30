"use client";

import dynamic from "next/dynamic";

export const StudioViewer = dynamic(
  () => import("./StudioViewer").then((module) => module.StudioViewer),
  {
    ssr: false,
    loading: () => (
      <div className="studio-viewer-loading">
        <span className="eyebrow">Waking the CAD kernel</span>
      </div>
    ),
  },
);
