"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStudio } from "@/lib/studio/store";
import { useToast } from "@/lib/store/ui";

export function StudioCode() {
  const code = useStudio((state) => state.code);
  const codeDraft = useStudio((state) => state.codeDraft);
  const setCodeDraft = useStudio((state) => state.setCodeDraft);
  const applyCode = useStudio((state) => state.applyCode);
  const status = useStudio((state) => state.status);
  const [editing, setEditing] = useState(false);
  const notify = useToast((state) => state.notify);
  const lines = code.split("\n").length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      notify("OpenSCAD source copied");
    } catch {
      notify("Clipboard unavailable", "accent");
    }
  };

  return (
    <div className="studio-code-panel">
      <div className="studio-code-toolbar">
        <span className="mono">{lines} lines</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="icon-btn tooltip" data-tip="Copy" onClick={copy} aria-label="Copy code">
            <Icon name="copy" size={13} />
          </button>
          {editing ? null : (
            <button
              className="icon-btn tooltip"
              data-tip="Edit code"
              onClick={() => {
                setCodeDraft(code);
                setEditing(true);
              }}
              aria-label="Edit code"
            >
              <Icon name="cursor" size={13} />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <>
          <textarea
            className="studio-code-editor"
            value={codeDraft}
            onChange={(event) => setCodeDraft(event.target.value)}
            spellCheck={false}
            aria-label="OpenSCAD source editor"
          />
          <div className="studio-code-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCodeDraft(code);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={status === "compiling" || status === "drafting"}
              onClick={async () => {
                await applyCode(codeDraft);
                setEditing(false);
              }}
            >
              <Icon name="check" /> Compile
            </button>
          </div>
        </>
      ) : (
        <pre className="studio-code">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
