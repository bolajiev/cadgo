"use client";

import { useEffect, useRef } from "react";
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
  const prompt = useStudio((state) => state.prompt);
  const refine = useStudio((state) => state.refine);
  const activeTab = useStudio((state) => state.activeTab);
  const view = useStudio((state) => state.view);
  const fitKey = useStudio((state) => state.fitKey);
  const showEdges = useStudio((state) => state.showEdges);
  const showGrid = useStudio((state) => state.showGrid);
  const model = useStudio((state) => state.model);
  const setPrompt = useStudio((state) => state.setPrompt);
  const setRefine = useStudio((state) => state.setRefine);
  const generate = useStudio((state) => state.generate);
  const refineModel = useStudio((state) => state.refineModel);
  const loadExample = useStudio((state) => state.loadExample);
  const setActiveTab = useStudio((state) => state.setActiveTab);
  const setView = useStudio((state) => state.setView);
  const fit = useStudio((state) => state.fit);
  const setShowEdges = useStudio((state) => state.setShowEdges);
  const setShowGrid = useStudio((state) => state.setShowGrid);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, status]);

  const draft = status === "drafting" || status === "repairing";
  const canGenerate = prompt.trim().length > 2 && !draft;
  const canRefine = refine.trim().length > 1 && !!code && !draft;
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
          <span className={`status-dot ${draft || status === "compiling" || status === "booting" ? "busy" : ""}`} />
          <span className="studio-title-mini">{title}</span>
          <span className="studio-status mono">{statusLabel(status)}</span>
        </div>
        <div className="studio-header-actions">
          <button
            className="btn"
            onClick={() => window.open(`${window.location.origin}/`, "_blank", "noopener,noreferrer")}
            title="Open a blank studio in a new page"
          >
            <Icon name="plus" /> <span>New page</span>
          </button>
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
          {mesh ? <ExportMenu /> : <span className="btn" aria-disabled="true" style={{ opacity: 0.45 }}>Export</span>}
        </div>
      </header>

      <main className="studio-main">
        <aside className="studio-left">
          <section className="studio-card studio-prompt-card">
            <div className="studio-card-head">
              <span className="eyebrow">New part</span>
              <span className="studio-model-chip mono">{model ? "AI" : "CAD"}</span>
            </div>
            <label className="studio-prompt-label" htmlFor="studio-prompt">
              Describe what to make.
            </label>
            <textarea
              id="studio-prompt"
              className="studio-textarea"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  generate();
                }
              }}
              placeholder="A honeycomb mounting bracket with 80 mm flanges, four M5 holes and a filleted inside corner…"
            />
            <div className="studio-prompt-actions">
              <span className="mono studio-hint">⌘↵ · OpenSCAD · mm</span>
              <button className="draft-btn" onClick={() => generate()} disabled={!canGenerate}>
                {draft ? "Drafting…" : "Generate"} <Icon name="arrow" />
              </button>
            </div>
            <div className="studio-examples">
              {SCAD_EXAMPLES.map((example, index) => (
                <button
                  className="studio-example"
                  key={example.id}
                  onClick={() => loadExample(example.id)}
                  disabled={draft}
                >
                  <span className="studio-example-num mono">0{index + 1}</span>
                  <span className="studio-example-name">{example.title}</span>
                  <span className="studio-example-load mono">Load</span>
                </button>
              ))}
            </div>
          </section>

          <section className="studio-card studio-chat-card">
            <div className="studio-card-head">
              <span className="eyebrow">Bench notes</span>
              <span className="mono studio-hint">{messages.length ? `${messages.length}` : ""}</span>
            </div>
            <div className="studio-messages" ref={messagesRef}>
              {messages.length === 0 ? (
                <div className="studio-message ai">
                  <span className="studio-message-role mono">Cadgo</span>
                  <p>Describe a part, or load a bench study. Parameters rebuild locally; the AI only writes the design.</p>
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
              {draft ? (
                <div className="studio-message ai pending">
                  <span className="status-dot busy" />
                  <p>{status === "repairing" ? "Repairing the compiler error…" : "Drafting in OpenSCAD…"}</p>
                </div>
              ) : null}
            </div>
            <div className="studio-refine">
              <label className="sr-only" htmlFor="studio-refine">
                Refine the current part
              </label>
              <input
                id="studio-refine"
                className="studio-refine-input"
                value={refine}
                onChange={(event) => setRefine(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    refineModel();
                  }
                }}
                placeholder="Refine: add a chamfer, change the bore, make it 20% wider…"
              />
              <button className="btn" onClick={() => refineModel()} disabled={!canRefine}>
                Refine
              </button>
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
                {mesh ? "OpenSCAD · parameters · millimetres" : "No model yet · describe it or open a bench study"}
              </span>
            </div>
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
                  Describe a part on the left, or open one of the bench studies. The model, code and
                  sliders all start empty.
                </p>
                <div className="studio-empty-actions">
                  <button className="btn btn-primary" onClick={() => document.querySelector<HTMLTextAreaElement>("#studio-prompt")?.focus()}>
                    <Icon name="cursor" /> Write a brief
                  </button>
                  <button
                    className="btn"
                    onClick={() => window.open(`${window.location.origin}/`, "_blank", "noopener,noreferrer")}
                  >
                    <Icon name="plus" /> Open in new page
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

          {draft && mesh ? (
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

        <aside className="studio-right">
          <div className="studio-tabs">
            <button
              className={`studio-tab ${activeTab === "parameters" ? "active" : ""}`}
              onClick={() => setActiveTab("parameters")}
            >
              Parameters <span className="mono">{params.length}</span>
            </button>
            <button
              className={`studio-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              OpenSCAD
            </button>
          </div>
          <div className="studio-panel-body">
            {activeTab === "parameters" ? <StudioParameters /> : <StudioCode />}
          </div>
          <div className="studio-kernel-strip">
            <span className="status-dot" />
            <span className="mono">OpenSCAD 2025.03 · manifold</span>
            <span className="mono">{mesh ? `${formatNumber(mesh.triangles)} tris` : "—"}</span>
          </div>
        </aside>
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
