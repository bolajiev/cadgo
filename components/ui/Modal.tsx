"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({
  title,
  children,
  onClose,
  actions,
  eyebrow,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-veil" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head" style={{ margin: "-16px -16px 12px", padding: "0 12px" }}>
          <span className="panel-label">{eyebrow ?? "Cadgo"}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <h2 className="modal-title">{title}</h2>
        <div className="modal-text">{children}</div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
