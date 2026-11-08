"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStudioV2 } from "@/lib/studio/v2/store";
import { assemblyBounds, assemblyStl, groupVisible, placedVariants } from "@/lib/studio/v2/geometry";
import { buildPartStlBundle, buildSceneGlb } from "@/lib/studio/v2/export";
import { buildScadBundle } from "@/lib/studio/v2/bundle";
import { encodeDocumentShare, serializeDocument } from "@/lib/studio/document/serialize";
import { formatNumber } from "@/lib/format";
import { PartTree } from "./PartTree";
import { AgentPanel } from "./AgentPanel";
import { AssemblyStage } from "./AssemblyStage";
import { PartInspector } from "./PartInspector";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "cadgo";
}

function closeMenu(event: React.MouseEvent<HTMLButtonElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

function ExportMenu({
  onStl,
  onGlb,
  onParts,
  onScad,
  onJson,
  onShare,
}: {
  onStl: () => void;
  onGlb: () => void;
  onParts: () => void;
  onScad: () => void;
  onJson: () => void;
  onShare: () => void;
}) {
  return (
    <details className="menu v2-export">
      <summary className="btn">
        <Icon name="download" size={11} /> Export
      </summary>
      <div className="menu-pop">
        <div className="menu-label">Output</div>
        <button className="menu-item" onClick={(event) => { onStl(); closeMenu(event); }}>
          <span>Assembly STL</span><span className="mono">.stl</span>
        </button>
        <button className="menu-item" onClick={(event) => { onGlb(); closeMenu(event); }}>
          <span>Scene GLB</span><span className="mono">.glb</span>
        </button>
        <button className="menu-item" onClick={(event) => { onParts(); closeMenu(event); }}>
          <span>Part STLs</span><span className="mono">.zip</span>
        </button>
        <button className="menu-item" onClick={(event) => { onScad(); closeMenu(event); }}>
          <span>SCAD bundle</span><span className="mono">.zip</span>
        </button>
        <button className="menu-item" onClick={(event) => { onJson(); closeMenu(event); }}>
          <span>Cadgo document</span><span className="mono">.json</span>
        </button>
        <div className="menu-rule" />
        <button className="menu-item" onClick={(event) => { onShare(); closeMenu(event); }}>
          <span>Share link</span><span className="mono">url</span>
        </button>
      </div>
    </details>
  );
}

export function StudioV2App() {
  const document = useStudioV2((state) => state.document);
  const booted = useStudioV2((state) => state.booted);
  const boot = useStudioV2((state) => state.boot);
  const notice = useStudioV2((state) => state.notice);
  const setNotice = useStudioV2((state) => state.setNotice);
  const undo = useStudioV2((state) => state.undo);
  const redo = useStudioV2((state) => state.redo);
  const newPart = useStudioV2((state) => state.newPart);
  const setTitle = useStudioV2((state) => state.setTitle);
  const variants = useStudioV2((state) => state.variants);
  const instanceVariants = useStudioV2((state) => state.instanceVariants);
  const compileStates = useStudioV2((state) => state.compileStates);
  const instanceStates = useStudioV2((state) => state.instanceStates);
  const printProfile = useStudioV2((state) => state.printProfile);
  const agentStatus = useStudioV2((state) => state.agentStatus);
  const pendingQuestion = useStudioV2((state) => state.pendingQuestion);
  const [title, setTitleDraft] = useState(document.name);
  const [leftTab, setLeftTab] = useState<"model" | "agent">("model");
  const [leftWidth, setLeftWidth] = useState(340);
  const [rightWidth, setRightWidth] = useState(344);
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);

  useEffect(() => {
    const storedLeft = Number(localStorage.getItem("cadgo:v2:left-width"));
    const storedRight = Number(localStorage.getItem("cadgo:v2:right-width"));
    if (Number.isFinite(storedLeft) && storedLeft >= 240) {
      leftWidthRef.current = storedLeft;
      setLeftWidth(storedLeft);
    }
    if (Number.isFinite(storedRight) && storedRight >= 240) {
      rightWidthRef.current = storedRight;
      setRightWidth(storedRight);
    }
  }, []);

  function setWidth(side: "left" | "right", width: number) {
    if (side === "left") {
      leftWidthRef.current = width;
      setLeftWidth(width);
    } else {
      rightWidthRef.current = width;
      setRightWidth(width);
    }
  }

  function persistWidths() {
    localStorage.setItem("cadgo:v2:left-width", String(leftWidthRef.current));
    localStorage.setItem("cadgo:v2:right-width", String(rightWidthRef.current));
  }

  function beginResize(side: "left" | "right") {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = side === "left" ? leftWidthRef.current : rightWidthRef.current;
      const previousCursor = window.document.body.style.cursor;
      const previousSelect = window.document.body.style.userSelect;
      window.document.body.style.cursor = "col-resize";
      window.document.body.style.userSelect = "none";
      const move = (moveEvent: PointerEvent) => {
        const rawDelta = side === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
        const available = window.innerWidth - (side === "left" ? rightWidthRef.current : leftWidthRef.current) - 430;
        const max = Math.max(260, Math.min(520, available));
        const next = Math.max(240, Math.min(max, startWidth + rawDelta));
        setWidth(side, next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.document.body.style.cursor = previousCursor;
        window.document.body.style.userSelect = previousSelect;
        persistWidths();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
  }

  function resetWidth(side: "left" | "right") {
    setWidth(side, side === "left" ? 340 : 344);
    persistWidths();
  }

  useEffect(() => {
    boot().catch((error) => {
      console.error("Cadgo v2 boot failed", error);
      setNotice(error instanceof Error ? error.message : "The local CAD kernel did not start.");
    });
  }, [boot, setNotice]);

  useEffect(() => setTitleDraft(document.name), [document.name]);
  useEffect(() => {
    if (pendingQuestion) setLeftTab("agent");
  }, [pendingQuestion]);

  const busy =
    Object.values(compileStates).some(
      (state) => state.status === "queued" || state.status === "compiling" || state.status === "stale",
    ) ||
    Object.values(instanceStates).some(
      (state) => state.status === "queued" || state.status === "compiling" || state.status === "stale",
    );
  const errors =
    Object.values(compileStates).filter((state) => state.status === "error").length +
    Object.values(instanceStates).filter((state) => state.status === "error").length;
  const triangles = useMemo(() => {
    let total = 0;
    for (const instance of document.instances) {
      if (!instance.visible || instance.suppressed) continue;
      if (!groupVisible(document, instance.parentId)) continue;
      const variant = instanceVariants[instance.id] ?? variants[instance.definitionId];
      if (variant) total += variant.metrics.triangles;
    }
    return total;
  }, [document.instances, instanceVariants, variants]);

  const compileIssues = useMemo(() => {
    const issues: string[] = [];
    for (const instance of document.instances) {
      if (!instance.visible || instance.suppressed) continue;
      if (!groupVisible(document, instance.parentId)) continue;
      const state = instanceStates[instance.id] ?? compileStates[instance.definitionId];
      if (!state || state.status === "queued" || state.status === "compiling" || state.status === "stale") {
        issues.push(`${instance.name} is still compiling`);
        continue;
      }
      if (state.status === "error") {
        issues.push(`${instance.name} failed to compile`);
        continue;
      }
      const variant = instanceVariants[instance.id] ?? variants[instance.definitionId];
      if (!variant) {
        issues.push(`${instance.name} has no compiled mesh`);
      }
    }
    return issues;
  }, [compileStates, document.instances, instanceStates, instanceVariants, variants]);

  const printIssues = useMemo(() => {
    const issues = [...compileIssues];
    for (const instance of document.instances) {
      if (!instance.visible || instance.suppressed) continue;
      if (!groupVisible(document, instance.parentId)) continue;
      const variant = instanceVariants[instance.id] ?? variants[instance.definitionId];
      if (!variant) continue;
      if (variant.metrics.boundaryEdges > 0 || variant.metrics.nonManifoldEdges > 0) {
        issues.push(`${instance.name} is not watertight`);
      }
    }
    if (printProfile?.purpose === "3d-print" && printProfile.bed) {
      const bounds = assemblyBounds(document, variants, instanceVariants);
      if (bounds) {
        const dims = [
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1],
          bounds.max[2] - bounds.min[2],
        ];
        const axes = ["X", "Y", "Z"];
        dims.forEach((dim, index) => {
          const limit = printProfile.bed ? [printProfile.bed.x, printProfile.bed.y, printProfile.bed.z][index] : 0;
          if (dim > limit) issues.push(`Assembly exceeds the ${axes[index]} bed by ${(dim - limit).toFixed(1)} mm`);
        });
      }
    }
    return issues;
  }, [compileIssues, document, instanceVariants, printProfile, variants]);

  const downloadStl = () => {
    if (printIssues.length) {
      setNotice(printIssues.slice(0, 2).join("; "));
      return;
    }
    const stl = assemblyStl(document, variants, instanceVariants);
    if (!stl) {
      setNotice("Nothing is compiled yet. Wait for a part to finish compiling.");
      return;
    }
    downloadBlob(new Blob([stl.buffer as ArrayBuffer], { type: "model/stl" }), `${safeName(document.name)}.stl`);
    setNotice("Assembly STL downloaded · millimetres.");
  };

  const downloadGlb = async () => {
    if (compileIssues.length) {
      setNotice(compileIssues.slice(0, 2).join("; "));
      return;
    }
    try {
      const glb = await buildSceneGlb(document, variants, instanceVariants);
      downloadBlob(
        new Blob([glb], { type: "model/gltf-binary" }),
        `${safeName(document.name)}.glb`,
      );
      setNotice("Scene GLB downloaded · millimetres.");
    } catch (error) {
      console.error("Cadgo scene GLB export failed", error);
      setNotice(error instanceof Error ? error.message : "Scene GLB export failed.");
    }
  };

  const downloadPartStls = () => {
    if (printIssues.length) {
      setNotice(printIssues.slice(0, 2).join("; "));
      return;
    }
    try {
      const bundle = buildPartStlBundle(document, variants, instanceVariants);
      const count = placedVariants(document, variants, undefined, undefined, instanceVariants).length;
      downloadBlob(
        new Blob([bundle.buffer as ArrayBuffer], { type: "application/zip" }),
        `${safeName(document.name)}-parts.zip`,
      );
      setNotice(`Part STLs downloaded: ${count} part${count === 1 ? "" : "s"} plus the merged assembly.`);
    } catch (error) {
      console.error("Cadgo part STL export failed", error);
      setNotice(error instanceof Error ? error.message : "Part STL export failed.");
    }
  };

  const downloadScad = () => {
    if (!document.definitions.length) {
      setNotice("There are no parts to export.");
      return;
    }
    const bundle = buildScadBundle(document);
    downloadBlob(
      new Blob([bundle.buffer as ArrayBuffer], { type: "application/zip" }),
      `${safeName(document.name)}-scad.zip`,
    );
    setNotice(
      `SCAD bundle downloaded: ${document.definitions.length} parts, assembly manifest and document.`,
    );
  };

  const share = async () => {
    const origin = window.location.origin;
    const encoded = encodeDocumentShare(document);
    let link = `${origin}/studio${encoded}`;
    let large = false;
    if (link.length > 24000) {
      large = true;
      setNotice("Creating a large share link…");
      try {
        const response = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encoded.slice(3) }),
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!response.ok || !data.id) {
          setNotice(data.error ?? "Could not create a share link. Use the ZIP or JSON export.");
          return;
        }
        link = `${origin}/studio?share=${encodeURIComponent(data.id)}`;
      } catch {
        setNotice("Could not reach the share service. Use the ZIP or JSON export.");
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setNotice(large ? "Large share link copied. It expires automatically." : "Share link copied.");
    } catch {
      window.prompt("Copy the share link", link);
    }
  };

  const downloadDocument = () => {
    downloadBlob(
      new Blob([serializeDocument(document)], { type: "application/json" }),
      `${safeName(document.name)}.cadgo.json`,
    );
    setNotice("Document exported. It can be re-imported with all parts intact.");
  };

  if (!booted) {
    return (
      <div className="studio-shell v2-shell">
        <div className="v2-boot">
          <span className="status-dot busy" />
          <span className="mono">Waking the local OpenSCAD kernel…</span>
          {notice ? <span className="v2-boot-error">{notice}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell v2-shell">
      <header className="studio-header">
        <a className="studio-brand" href="/" aria-label="Cadgo">
          <span className="brand-word">
            cad<span>go</span>
          </span>
          <span className="studio-badge mono">Assembly studio</span>
        </a>
        <div className="studio-header-center">
          <span className={`status-dot ${busy ? "busy" : ""}`} />
          <input
            className="v2-title-input"
            value={title}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => setTitle(title.trim() || "Untitled assembly")}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Document title"
          />
          <span className="mono studio-status">
            {busy ? "Compiling" : errors ? `${errors} failed` : "Ready"}
          </span>
        </div>
        <div className="studio-header-actions">
          <button className="icon-btn tooltip" data-tip="Undo" aria-label="Undo" onClick={undo}>
            <Icon name="undo" />
          </button>
          <button className="icon-btn tooltip" data-tip="Redo" aria-label="Redo" onClick={redo}>
            <Icon name="redo" />
          </button>
          <button className="btn" onClick={newPart}>
            <Icon name="plus" size={11} /> New part
          </button>
          <ExportMenu
            onStl={downloadStl}
            onGlb={() => void downloadGlb()}
            onParts={downloadPartStls}
            onScad={downloadScad}
            onJson={downloadDocument}
            onShare={() => void share()}
          />
          <a
            className="icon-btn tooltip"
            href="https://github.com/bolajiev/cadgo"
            target="_blank"
            rel="noreferrer"
            data-tip="GitHub"
            aria-label="GitHub"
          >
            <Icon name="github" />
          </a>
        </div>
      </header>

      <main
        className="v2-main"
        style={
          {
            "--v2-left-width": `${leftWidth}px`,
            "--v2-right-width": `${rightWidth}px`,
          } as CSSProperties
        }
      >
        <div className="v2-left">
          <div className="v2-left-tabs">
            <button
              className={`v2-left-tab ${leftTab === "model" ? "active" : ""}`}
              onClick={() => setLeftTab("model")}
            >
              <Icon name="cube" size={11} /> Model
            </button>
            <button
              className={`v2-left-tab ${leftTab === "agent" ? "active" : ""}`}
              onClick={() => setLeftTab("agent")}
            >
              <Icon name="spark" size={11} /> Agent
              {agentStatus === "thinking" ? <span className="status-dot busy" /> : null}
              {pendingQuestion ? <span className="v2-tab-dot" /> : null}
            </button>
          </div>
          <div className="v2-left-body">
            {leftTab === "model" ? <PartTree /> : <AgentPanel />}
          </div>
        </div>
        <div
          className="v2-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize model panel"
          onPointerDown={beginResize("left")}
          onDoubleClick={() => resetWidth("left")}
        />
        <AssemblyStage />
        <div
          className="v2-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
          onPointerDown={beginResize("right")}
          onDoubleClick={() => resetWidth("right")}
        />
        <PartInspector />
      </main>

      {notice ? (
        <div className="v2-notice">
          <Icon name="info" size={12} />
          <span>{notice}</span>
          <button className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <Icon name="close" size={11} />
          </button>
        </div>
      ) : null}

      <footer className="studio-statusbar">
        <span className="mono">CADGO / ASSEMBLY STUDIO</span>
        <span className="mono">
          {document.definitions.length} parts · {document.instances.length} instances · {formatNumber(triangles)} tris
        </span>
        <span className="mono">
          {Object.keys(variants).length + Object.keys(instanceVariants).length} compiled · {errors ? `${errors} failed` : "local kernel"}
        </span>
      </footer>
    </div>
  );
}
