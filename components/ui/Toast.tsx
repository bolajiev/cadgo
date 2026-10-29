"use client";

import { useToast } from "@/lib/store/ui";

export function Toast() {
  const message = useToast((state) => state.message);
  const tone = useToast((state) => state.tone);
  if (!message) return null;
  return (
    <div
      className="toast"
      style={{
        borderColor: tone === "accent" ? "var(--accent)" : "var(--ink)",
        color: tone === "accent" ? "var(--accent-deep)" : "var(--ink)",
      }}
      role="status"
    >
      <span className="mono">↳</span>
      <span>{message}</span>
    </div>
  );
}
