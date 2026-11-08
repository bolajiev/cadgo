"use client";

import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="v2-markdown">
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }: ComponentProps<"a">) => (
            <a href={href} target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          ),
          pre: ({ children }: ComponentProps<"pre">) => (
            <pre className="v2-md-pre">{children}</pre>
          ),
          code: ({ className, children, ...props }: ComponentProps<"code">) => (
            <code className={`v2-md-code ${className ?? ""}`} {...props}>
              {children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
