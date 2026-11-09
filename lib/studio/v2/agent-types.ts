import type { ResearchSource } from "../../research/types";

export type AgentToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Record<string, unknown>[];
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
};

export type PendingQuestion = {
  toolCallId: string;
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
  allowCustom: boolean;
};

export type ChatEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  note?: string;
  images?: string[];
  streaming?: boolean;
  reasoning?: string;
  sources?: ResearchSource[];
};

export type Inspection = {
  dataUrl: string;
  views: string[];
  title: string;
};
