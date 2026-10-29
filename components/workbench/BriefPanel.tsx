"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useProject } from "@/lib/store/project";

export function BriefPanel() {
  const messages = useProject((state) => state.messages);
  const stages = useProject((state) => state.stages);
  const status = useProject((state) => state.status);
  const spec = useProject((state) => state.spec);
  const error = useProject((state) => state.error);
  const generate = useProject((state) => state.generate);
  const edit = useProject((state) => state.edit);
  const dismissError = useProject((state) => state.dismissError);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (status === "drafting" || status === "compiling" || messages.length > 2) {
      node.scrollTop = node.scrollHeight;
    } else {
      node.scrollTop = 0;
    }
  }, [messages, stages, error, status]);

  const busy = status === "drafting";
  const submit = () => {
    const clean = draft.trim();
    if (!clean || busy) return;
    setDraft("");
    if (spec) edit(clean);
    else generate(clean);
  };

  return (
    <section className="panel brief-panel">
      <div className="panel-head">
        <span className="panel-label">Brief</span>
        <span className="panel-hint">{messages.length ? `${messages.length} slips` : "waiting"}</span>
      </div>
      <div className="brief-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="brief-empty">
            Describe a mechanism in plain language. Cadgo drafts the parts, joints and a motion you can
            test — then you can keep changing it.
          </div>
        ) : null}

        {messages.map((message) => (
          <article key={message.id} className={`slip ${message.role === "user" ? "user" : "ai"}`}>
            <div className="slip-head">
              <span className="slip-who">{message.role === "user" ? "You" : "Cadgo"}</span>
              <span className="slip-time">{message.time}</span>
            </div>
            <div className="slip-text">{message.text}</div>
            {message.notes?.length ? (
              <ul className="slip-notes">
                {message.notes.map((note, index) => (
                  <li key={`${message.id}-${index}`}>{note}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}

        {status === "drafting" || (status === "compiling" && !spec) ? (
          <div className="slip ai">
            <div className="slip-head">
              <span className="slip-who">
                {status === "compiling" ? "Kernel" : "Cadgo is drafting"}
              </span>
              <span className="slip-time">
                <span className="status-dot busy" />
              </span>
            </div>
            <div className="stage-list">
              {stages.map((stage) => (
                <div key={stage.id} className={`stage-row ${stage.status}`}>
                  <span className="stage-mark" />
                  <span>{stage.label}</span>
                  <span>{stage.status === "done" ? "ok" : stage.status === "active" ? "…" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="error-banner">
            <Icon name="warning" />
            <div style={{ flex: 1 }}>
              <strong>Bench note.</strong> {error}
            </div>
            <button className="icon-btn" onClick={dismissError} aria-label="Dismiss">
              <Icon name="close" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="brief-compose">
        <label className="sr-only" htmlFor="brief-message">
          Refine the assembly
        </label>
        <textarea
          id="brief-message"
          className="brief-input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={spec ? "Refine: widen the base, add a switch, change the shade to brass…" : "Describe a mechanism…"}
        />
        <div className="brief-actions">
          <span className="hint">⌘↵ to send</span>
          <button className="draft-btn" onClick={submit} disabled={!draft.trim() || busy}>
            {spec ? "Revise" : "Draft"} <Icon name="arrow" />
          </button>
        </div>
      </div>
    </section>
  );
}
