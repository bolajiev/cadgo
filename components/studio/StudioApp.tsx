"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { StudioViewer } from "./StudioViewerClient";
import { StudioParameters } from "./ParametersPanel";
import { StudioCode } from "./CodePanel";
import { useStudio } from "@/lib/studio/store";
import { useToast } from "@/lib/store/ui";
import { SCAD_EXAMPLES } from "@/lib/scad/examples";
import { formatNumber } from "@/lib/format";

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

function statusLabel(status: string) {
  if (status === "booting") return "Waking kernel";
  if (status === "drafting") return "Drafting";
  if (status === "compiling") return "Recutting";
  if (status === "repairing") return "Fixing";
  if (status === "error") return "Needs attention";
  return "Ready";
}

function ExportMenu() {
  const details = useRef<HTMLDetailsElement>(null);
  const exportStl = useStudio((state) => state.exportStl);
  const exportScad = useStudio((state) => state.exportScad);
  const shareLink = useStudio((state) => state.shareLink);
  const notify = useToast((state) => state.notify);
  const close = () => details.current?.removeAttribute("open");

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
    <details className="menu" ref={details}>
      <summary className="btn">
        <Icon name="download" />
        <span>Export</span>
      </summary>
      <div className="menu-pop">
        <div className="menu-label">Output</div>
        <button
          className="menu-item"
          onClick={async () => {
            await exportStl();
            close();
          }}
        >
          <span>STL mesh</span>
          <span className="mono">.stl</span>
        </button>
        <button
          className="menu-item"
          onClick={() => {
            exportScad();
            close();
          }}
        >
          <span>OpenSCAD source</span>
          <span className="mono">.scad</span>
        </button>
        <div className="menu-rule" />
        <button
          className="menu-item"
          onClick={() => {
            share();
            close();
          }}
        >
          <span>Share link</span>
          <span className="mono">#s</span>
        </button>
      </div>
    </details>
  );
}

export function StudioApp() {
  const boot = useStudio((state) => state.boot);
  const booted = useStudio((state) => state.booted);
  const title = useStudio((state) => state.title);
  const code = useStudio((state) => state.code);
  const mesh = useStudio((state) => state.mesh);
  const status = useStudio((state) => state.status);
  const error = useStudio((state) => state.error);
  const compileMs = useStudio((state) => state.compileMs);
  const params = useStudio((state) => state.params);
  const messages = useStudio((state) => state.messages);
  const newPart = useStudio((state) => state.newPart);

  const view = useStudio((state) => state.view);
  const fitKey = useStudio((state) => state.fitKey);
  const showEdges = useStudio((state) => state.showEdges);
  const showGrid = useStudio((state) => state.showGrid);
  const model = useStudio((state) => state.model);
  const shareLink = useStudio((state) => state.shareLink);
  const exportStl = useStudio((state) => state.exportStl);
  const generate = useStudio((state) => state.generate);
  const refineModel = useStudio((state) => state.refineModel);
  const loadExample = useStudio((state) => state.loadExample);

  const setView = useStudio((state) => state.setView);
  const fit = useStudio((state) => state.fit);
  const setShowEdges = useStudio((state) => state.setShowEdges);
  const setShowGrid = useStudio((state) => state.setShowGrid);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [chatText, setChatText] = useState("");
  const [inspector, setInspector] = useState<"dimensions" | "source" | null>(null);
  const importScad = useStudio((state) => state.importScad);

  const openImporter = () => fileRef.current?.click();
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 240000) {
      useToast.getState().notify("OpenSCAD source must be under 240 KB", "accent");
      return;
    }
    const text = await file.text();
    await importScad(text, file.name);
  };

  useEffect(() => {
    boot();
  }, [boot]);

  const sendChat = () => {
    const text = chatText.trim();
    if (!text || busy) return;
    setChatText("");
    if (code) refineModel(text);
    else generate(text);
  };

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, status]);

  const busy = status === "drafting" || status === "repairing" || status === "compiling";
  const working = status === "drafting" || status === "repairing";
  const canSend = chatText.trim().length > 1 && !busy;
  const bounds = mesh?.bounds;
  const dims = bounds
    ? [
        Math.round(bounds.max[0] - bounds.min[0]),
        Math.round(bounds.max[1] - bounds.min[1]),
        Math.round(bounds.max[2] - bounds.min[2]),
      ]
    : null;

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <a className="studio-brand" href="/" aria-label="Cadgo part studio">
          <BrandMark />
          <span className="brand-word">
            cad<span>go</span>
          </span>
          <span className="studio-badge mono">Part studio</span>
        </a>
        <div className="studio-header-center">
          <span className={`status-dot ${busy || status === "booting" ? "busy" : ""}`} />
          <span className="studio-title-mini">{title}</span>
          <span className="studio-status mono">{statusLabel(status)}</span>
        </div>
        <div className="studio-header-actions">
          <button
            className="icon-btn tooltip"
            data-tip="Open this part in a new page"
            aria-label="Open this part in a new page"
            onClick={() => {
              const link = shareLink();
              window.open(link ?? `${window.location.origin}/`, "_blank", "noopener,noreferrer");
            }}
          >
            <Icon name="arrow" />
          </button>
          <button
            className="btn"
            onClick={() => window.open(`${window.location.origin}/`, "_blank", "noopener,noreferrer")}
            title="Open a blank studio in a new page"
          >
            <Icon name="plus" /> <span>New page</span>
          </button>
          <button className="btn" disabled={!mesh} onClick={() => exportStl()} title="Download the current part as STL">
            <Icon name="download" /> <span>Download</span>
          </button>
          {mesh ? <ExportMenu /> : <span className="btn" aria-disabled="true" style={{ opacity: 0.45 }}>Export</span>}
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

      <main className="studio-main">
        <aside className="studio-left">
          <section className="studio-card studio-chat-card">
            <div className="studio-card-head">
              <span className="eyebrow">Brief / chat</span>
              <span className="mono studio-hint">{code ? "editing this part" : "new part"}</span>
            </div>

            <div className="studio-chat-tools">
              <details className="studio-benchbook">
                <summary>Benchbook</summary>
                <div className="studio-examples">
                  {SCAD_EXAMPLES.map((example, index) => (
                    <button
                      className="studio-example"
                      key={example.id}
                      onClick={() => loadExample(example.id)}
                      disabled={busy}
                    >
                      <span className="studio-example-num mono">0{index + 1}</span>
                      <span className="studio-example-name">{example.title}</span>
                      <span className="studio-example-load mono">Load</span>
                    </button>
                  ))}
                </div>
              </details>
              <button className="studio-import" onClick={openImporter} disabled={busy}>
                <Icon name="folder" size={11} /> Import .scad
              </button>
              <button className="studio-import" onClick={() => { newPart(); setInspector(null); }} disabled={busy}>
                <Icon name="plus" size={11} /> New part
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".scad,text/plain"
                className="studio-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  importFile(file);
                }}
              />
            </div>

            <div className="studio-impact-line">
              {code
                ? "Chat edits this part in place. Every change stays local and reports the changed lines."
                : "Plain language in, parametric solid out. Dimensions stay live; source stays optional."}
            </div>

            <div className="studio-messages" ref={messagesRef}>
              {messages.length === 0 ? (
                <div className="studio-message ai">
                  <span className="studio-message-role mono">Cadgo</span>
                  <p>
                    Describe a part to make. Once it lands, reply here to change it — the agent edits
                    the current model, it does not start over.
                  </p>
                </div>
              ) : (
                messages.map((item) => (
                  <div className={`studio-message ${item.role}`} key={item.id}>
                    <div className="studio-message-top">
                      <span className="studio-message-role mono">
                        {item.role === "user" ? "You" : item.role === "system" ? "Bench" : "Cadgo"}
                      </span>
                      <span className="mono studio-message-time">{item.time}</span>
                    </div>
                    <p>{item.text}</p>
                    {item.note ? <span className="studio-message-note mono">{item.note}</span> : null}
                  </div>
                ))
              )}
              {working ? (
                <div className="studio-message ai pending">
                  <span className="status-dot busy" />
                  <p>
                    {status === "drafting"
                      ? code
                        ? "Editing the current part…"
                        : "Drafting in OpenSCAD…"
                      : status === "repairing"
                        ? "Repairing the compiler error…"
                        : "Compiling locally…"}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="studio-compose">
              <textarea
                ref={composerRef}
                id="studio-chat-input"
                className="studio-compose-input"
                rows={2}
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    sendChat();
                  }
                }}
                placeholder={
                  code
                    ? "Ask for a change — make the flange 6 mm thicker, add a cable slot…"
                    : "Describe a part — a 100 × 60 × 8 mm mounting plate with four 5 mm holes…"
                }
              />
              <div className="studio-compose-actions">
                <span className="mono studio-hint">⌘↵ · {code ? "edits this part" : "creates a part"}</span>
                <button className="draft-btn" onClick={sendChat} disabled={!canSend}>
                  {busy ? "Working…" : code ? "Send" : "Generate"} <Icon name="arrow" />
                </button>
              </div>
            </div>
          </section>
        </aside>

        <section className="studio-stage">
          <div className="studio-stage-grid" />
          {mesh ? (
            <StudioViewer mesh={mesh} view={view} fitKey={fitKey} showEdges={showEdges} showGrid={showGrid} />
          ) : null}

          <div className="studio-stage-top">
            <div className="studio-fig">
              <span className="mono studio-fig-label">FIG. 01 / PART</span>
              <strong>{mesh ? title : "New part"}</strong>
              <span className="mono studio-fig-sub">
                {mesh ? "Parametric solid · local kernel · millimetres" : "No model yet · describe it or open a bench study"}
              </span>
            </div>
            <div className="studio-stage-controls">
              <div className="view-controls">
                <button className={`icon-btn ${view === "iso" ? "active" : ""}`} onClick={() => setView("iso")} aria-label="Isometric view">
                  ISO
                </button>
                <button className={`icon-btn ${view === "front" ? "active" : ""}`} onClick={() => setView("front")} aria-label="Front view">
                  FR
                </button>
                <button className={`icon-btn ${view === "top" ? "active" : ""}`} onClick={() => setView("top")} aria-label="Top view">
                  TP
                </button>
                <button className="icon-btn tooltip" data-tip="Fit" onClick={fit} aria-label="Fit view">
                  <Icon name="fit" />
                </button>
                <button
                  className={`icon-btn tooltip ${showGrid ? "active" : ""}`}
                  data-tip="Grid"
                  onClick={() => setShowGrid(!showGrid)}
                  aria-label="Toggle grid"
                >
                  <Icon name="grid" />
                </button>
                <button
                  className={`icon-btn tooltip ${showEdges ? "active" : ""}`}
                  data-tip="Ink edges"
                  onClick={() => setShowEdges(!showEdges)}
                  aria-label="Toggle edges"
                >
                  <Icon name="layers" />
                </button>
              </div>
              <div className="studio-inspect-controls">
                <button
                  className={`studio-inspect-button ${inspector === "dimensions" ? "active" : ""}`}
                  disabled={!mesh}
                  onClick={() => setInspector(inspector === "dimensions" ? null : "dimensions")}
                >
                  <Icon name="sliders" size={12} /> Dimensions
                </button>
                <button
                  className={`studio-inspect-button ${inspector === "source" ? "active" : ""}`}
                  disabled={!code}
                  onClick={() => setInspector(inspector === "source" ? null : "source")}
                >
                  <Icon name="code" size={12} /> Source
                </button>
              </div>
            </div>
          </div>

          {mesh ? (
            <>
              <div className="studio-stage-hint">
                <kbd>drag</kbd> orbit <kbd>scroll</kbd> zoom <kbd>⌘↵</kbd> generate
              </div>
              <div className="studio-readout">
                <div>
                  <span className="readout-label">Envelope</span>
                  <span className="readout-value">
                    {dims ? `${dims[0]}×${dims[1]}×${dims[2]}` : "—"}
                    <em>mm</em>
                  </span>
                </div>
                <div>
                  <span className="readout-label">Triangles</span>
                  <span className="readout-value">{formatNumber(mesh.triangles)}</span>
                </div>
                <div>
                  <span className="readout-label">Compile</span>
                  <span className="readout-value">
                    {compileMs}
                    <em>ms</em>
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {!mesh && status === "idle" ? (
            <div className="studio-empty-state">
              <div className="studio-empty-card">
                <span className="eyebrow">New part</span>
                <h2>A clean sheet.</h2>
                <p>
                  Describe a part and get an editable parametric solid with real dimensions, or
                  bring an existing<strong> .scad</strong>. The model and dimensions start empty.
                </p>
                <div className="studio-empty-steps">
                  <span><b>01</b> Describe or import</span>
                  <span><b>02</b> Compile locally</span>
                  <span><b>03</b> Tune dimensions</span>
                </div>
                <div className="studio-empty-actions">
                  <button className="btn btn-primary" onClick={() => composerRef.current?.focus()}>
                    <Icon name="cursor" /> Write a brief
                  </button>
                  <button className="btn" onClick={openImporter}>
                    <Icon name="folder" /> Import .scad
                  </button>
                  <button
                    className="btn"
                    onClick={() => window.open(`${window.location.origin}/`, "_blank", "noopener,noreferrer")}
                  >
                    <Icon name="plus" /> New page
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!mesh && (status === "drafting" || status === "compiling" || status === "repairing") ? (
            <div className="studio-veil">
              <div className="studio-loading-card">
                <span className="eyebrow">{status === "drafting" ? "Design compiler" : "Local kernel"}</span>
                <h2>{status === "drafting" ? "Writing the part" : status === "repairing" ? "Fixing the mesh" : "Compiling locally"}</h2>
                <p>
                  {status === "drafting"
                    ? "DeepSeek is writing OpenSCAD; the local kernel will compile it here."
                    : "OpenSCAD WebAssembly is waking up. This happens once per page."}
                </p>
                <div className="studio-progress">
                  <span />
                </div>
                <span className="mono studio-hint">No server geometry · no upload</span>
              </div>
            </div>
          ) : null}

          {busy && mesh ? (
            <div className="studio-busy-strip">
              <span className="status-dot busy" />
              <span className="mono">
                {status === "repairing" ? "Repairing compiler error" : "Drafting design"}
              </span>
              <span className="mono studio-hint">DeepSeek + GLM fast pass</span>
            </div>
          ) : null}

          {status === "compiling" ? (
            <div className="studio-busy-strip">
              <span className="status-dot busy" />
              <span className="mono">Rebuilding locally</span>
            </div>
          ) : null}

          {mesh && mesh.floating > 0 ? (
            <div className="studio-geometry-warning">
              <Icon name="warning" />
              <span>
                {mesh.floating} detached solid{mesh.floating === 1 ? "" : "s"}. Ask Cadgo to connect it
                to the body.
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="studio-error">
              <Icon name="warning" />
              <div>
                <strong>Bench note.</strong> {error.length > 220 ? `${error.slice(0, 220)}…` : error}
              </div>
            </div>
          ) : null}

          {!mesh && status === "error" ? (
            <div className="studio-veil">
              <div className="studio-loading-card">
                <span className="eyebrow">Kernel</span>
                <h2>The bench did not wake.</h2>
                <p>{error ?? "OpenSCAD could not start in this browser."}</p>
                <div className="chip-row">
                  {SCAD_EXAMPLES.map((example) => (
                    <button key={example.id} className="chip" onClick={() => loadExample(example.id)}>
                      {example.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <span className="plate-corner tl" />
          <span className="plate-corner tr" />
          <span className="plate-corner bl" />
          <span className="plate-corner br" />
        </section>

        {inspector ? (
          <aside className="studio-inspector">
            <div className="studio-inspector-head">
              <span className="panel-label">
                {inspector === "dimensions" ? "Dimensions" : "Source"}
              </span>
              <button className="icon-btn" onClick={() => setInspector(null)} aria-label="Close inspector">
                <Icon name="close" />
              </button>
            </div>
            <div className="studio-tab-purpose">
              {inspector === "dimensions"
                ? "Live dimensions — local rebuilds, no AI"
                : "The actual OpenSCAD — inspect, edit, compile"}
            </div>
            <div className="studio-panel-body">
              {inspector === "dimensions" ? <StudioParameters /> : <StudioCode />}
            </div>
            <div className="studio-kernel-strip">
              <span className="status-dot" />
              <span className="mono">OpenSCAD 2025.03 · manifold</span>
              <span className="mono">{mesh ? `${formatNumber(mesh.triangles)} tris` : "—"}</span>
            </div>
          </aside>
        ) : null}
      </main>

      <footer className="studio-statusbar">
        <span className="mono">CADGO / PART STUDIO</span>
        <span className="mono">PARAMETRIC · WATER TIGHT · MILLIMETRES</span>
        <span className="mono">{params.length} params · {compileMs} ms local kernel</span>
      </footer>
      <Toast />
    </div>
  );
}
