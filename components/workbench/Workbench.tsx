"use client";

import { AssemblyPanel } from "./AssemblyPanel";
import { BriefPanel } from "./BriefPanel";
import { HoleModal } from "./HoleModal";
import { ParametersPanel } from "./ParametersPanel";
import { ViewportPanel } from "./ViewportPanel";

export function Workbench() {
  return (
    <>
      <div className="workbench">
        <div className="left-rail">
          <BriefPanel />
          <ParametersPanel />
        </div>
        <ViewportPanel />
        <div className="right-rail">
          <AssemblyPanel />
        </div>
      </div>
      <HoleModal />
    </>
  );
}
