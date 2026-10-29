"use client";

import { useEffect, useRef } from "react";
import { Topbar } from "./Topbar";
import { Landing } from "./landing/Landing";
import { Workbench } from "./workbench/Workbench";
import { Toast } from "./ui/Toast";
import { useProject } from "@/lib/store/project";

let hydrated = false;

export function CadgoApp() {
  const screen = useProject((state) => state.screen);
  const refreshRecents = useProject((state) => state.refreshRecents);
  const loadFromHash = useProject((state) => state.loadFromHash);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __cadgo?: unknown }).__cadgo = useProject;
    }
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    refreshRecents();
    if (!hydrated) {
      hydrated = true;
      loadFromHash();
    }
  }, [loadFromHash, refreshRecents]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "slider");
      const state = useProject.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (typing) return;
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (typing) return;
      if (!state.spec) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (state.playing) state.pause();
        else state.play();
      } else if (event.key === "Escape") {
        if (state.pickMode === "hole") state.cancelHolePick();
        else if (state.plate) state.setPlate(false);
        else if (state.selectedPartId || state.selectedJointId) {
          state.selectPart(null);
        }
      } else if (event.key.toLowerCase() === "f") {
        state.fit();
      } else if (event.key === "1") {
        state.setView("iso");
      } else if (event.key === "2") {
        state.setView("front");
      } else if (event.key === "3") {
        state.setView("top");
      } else if (event.key.toLowerCase() === "p") {
        state.setPlate(!state.plate);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell" data-screen={screen}>
      <Topbar mode={screen} />
      {screen === "landing" ? <Landing /> : <Workbench />}
      <Toast />
    </div>
  );
}
