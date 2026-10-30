"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useProject } from "@/lib/store/project";
import { useToast } from "@/lib/store/ui";
import { EXAMPLES } from "@/lib/cad/examples";

function BrandMark() {
  return (
    <svg width="27" height="27" viewBox="0 0 27 27" aria-hidden="true">
      <rect width="27" height="27" fill="#191816" />
      <path d="M7 19.5 17.5 8.5" stroke="#f1eee5" strokeWidth="1.1" />
      <circle cx="7" cy="19.5" r="2.8" fill="#191816" stroke="#f1eee5" strokeWidth="1.1" />
      <circle cx="17.5" cy="8.5" r="2.8" fill="#191816" stroke="#f1eee5" strokeWidth="1.1" />
      <circle cx="21.5" cy="20" r="1.5" fill="#c4472a" />
    </svg>
  );
}

function ExportMenu() {
  const details = useRef<HTMLDetailsElement>(null);
  const exportStl = useProject((state) => state.exportStl);
  const exportGlb = useProject((state) => state.exportGlb);
  const exportJson = useProject((state) => state.exportJson);
  const setPlate = useProject((state) => state.setPlate);
  const setCaptureRequest = useProject((state) => state.setCaptureRequest);
  const notify = useToast((state) => state.notify);

  const close = () => details.current?.removeAttribute("open");

  return (
    <details className="menu" ref={details}>
      <summary className="btn">
        <Icon name="download" />
        <span>Export</span>
      </summary>
      <div className="menu-pop">
        <div className="menu-label">Output</div>
        <button
          className="menu-item"
          onClick={() => {
            exportStl();
            notify("STL written in millimetres");
            close();
          }}
        >
          <span>STL mesh</span>
          <span className="mono">.stl</span>
        </button>
        <button
          className="menu-item"
          onClick={() => {
            exportGlb();
            notify("GLB written with materials");
            close();
          }}
        >
          <span>GLB scene</span>
          <span className="mono">.glb</span>
        </button>
        <button
          className="menu-item"
          onClick={() => {
            exportJson();
            notify("CadSpec saved");
            close();
          }}
        >
          <span>CadSpec</span>
          <span className="mono">.json</span>
        </button>
        <div className="menu-rule" />
        <button
          className="menu-item"
          onClick={() => {
            setPlate(true);
            window.setTimeout(() => setCaptureRequest(), 80);
            notify("Rendering the plate");
            close();
          }}
        >
          <span>Plate PNG</span>
          <span className="mono">.png</span>
        </button>
      </div>
    </details>
  );
}

export function Topbar({ mode }: { mode: "landing" | "workbench" }) {
  const projectName = useProject((state) => state.spec?.name);
  const status = useProject((state) => state.status);
  const historyIndex = useProject((state) => state.historyIndex);
  const historyLength = useProject((state) => state.history.length);
  const undo = useProject((state) => state.undo);
  const redo = useProject((state) => state.redo);
  const goHome = useProject((state) => state.goHome);
  const shareLink = useProject((state) => state.shareLink);
  const loadRecent = useProject((state) => state.loadRecent);
  const loadExample = useProject((state) => state.loadExample);
  const recents = useProject((state) => state.recents);
  const notify = useToast((state) => state.notify);

  const openBench = async () => {
    if (recents[0]) await loadRecent(recents[0].id);
    else await loadExample(EXAMPLES[0].spec, EXAMPLES[0].prompt);
  };

  const share = async () => {
    const link = shareLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      notify("Share link copied");
    } catch {
      window.prompt("Copy the share link", link);
    }
  };

  return (
    <header className="topbar">
      <a
        className="brand"
        href="#top"
        onClick={(event) => {
          event.preventDefault();
          if (mode === "workbench") goHome();
          else window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label="Cadgo home"
      >
        <BrandMark />
        <span className="brand-word">
          cad<span>go</span>
        </span>
      </a>

      {mode === "landing" ? (
        <>
          <nav className="topnav" aria-label="Sections">
            <a href="/">Part studio</a>
            <a href="#benchbook">Benchbook</a>
            <a href="#how">How it works</a>
            <a href="https://github.com/bolajiev/cadgo" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <div className="topbar-center" />
          <div className="top-actions">
            <span className="hackathon-tag mono">AI Builder Hackathon 2026</span>
            <button className="btn" onClick={openBench}>
              Open bench <Icon name="arrow" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="topbar-center">
            <span className={`status-dot ${status === "drafting" || status === "compiling" ? "busy" : ""}`} />
            <span className="project-name">{projectName ?? "Untitled assembly"}</span>
            <span className="topbar-meta">
              {status === "drafting"
                ? "Drafting"
                : status === "compiling"
                  ? "Cutting"
                  : status === "error"
                    ? "Needs attention"
                    : "Ready"}
            </span>
          </div>
          <div className="top-actions">
            <div className="history-controls">
              <button
                className="icon-btn tooltip"
                data-tip="Undo"
                onClick={undo}
                disabled={historyIndex <= 0}
                aria-label="Undo"
              >
                <Icon name="undo" />
              </button>
              <button
                className="icon-btn tooltip"
                data-tip="Redo"
                onClick={redo}
                disabled={historyIndex >= historyLength - 1}
                aria-label="Redo"
              >
                <Icon name="redo" />
              </button>
            </div>
            <button className="btn" onClick={goHome}>
              <Icon name="plus" /> <span>New</span>
            </button>
            <button className="btn" onClick={share}>
              <Icon name="share" /> <span>Share</span>
            </button>
            <ExportMenu />
          </div>
        </>
      )}
    </header>
  );
}
