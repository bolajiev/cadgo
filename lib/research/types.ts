export type ResearchDepth = "quick" | "deep";

export type ResearchSource = {
  title: string;
  url: string;
  host: string;
  snippet: string;
  text?: string;
};

export type ResearchResult = {
  query: string;
  url?: string;
  provider: string;
  sources: ResearchSource[];
  fetchedAt: string;
  warning: string;
  error?: string;
};

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};
