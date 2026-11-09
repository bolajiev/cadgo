import { isAllowedHttpUrl, readLimitedText, safeFetch, stripHtml } from "./fetch";
import type { SearchHit } from "./types";

export type SearchProvider = {
  name: string;
  search(query: string, limit: number): Promise<SearchHit[]>;
};

function cleanHit(title: unknown, url: unknown, snippet: unknown): SearchHit | null {
  if (typeof url !== "string" || typeof title !== "string" || !isAllowedHttpUrl(url)) return null;
  return {
    title: stripHtml(title).slice(0, 240) || url,
    url,
    snippet: typeof snippet === "string" ? stripHtml(snippet).slice(0, 500) : "",
  };
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
      "User-Agent": "CadgoResearch/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}.`);
  return response.json();
}

function braveProvider(key: string): SearchProvider {
  return {
    name: "brave",
    async search(query, limit) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.max(1, limit)}&safesearch=moderate`;
      const data = (await fetchJson(url, {
        headers: { "X-Subscription-Token": key },
      })) as { web?: { results?: { title?: unknown; url?: unknown; description?: unknown }[] } };
      return (data.web?.results ?? [])
        .map((hit) => cleanHit(hit.title, hit.url, hit.description))
        .filter((hit): hit is SearchHit => Boolean(hit))
        .slice(0, limit);
    },
  };
}

function tavilyProvider(key: string): SearchProvider {
  return {
    name: "tavily",
    async search(query, limit) {
      const data = (await fetchJson("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          max_results: Math.max(1, limit),
          search_depth: "basic",
          include_answer: false,
        }),
      })) as { results?: { title?: unknown; url?: unknown; content?: unknown }[] };
      return (data.results ?? [])
        .map((hit) => cleanHit(hit.title, hit.url, hit.content))
        .filter((hit): hit is SearchHit => Boolean(hit))
        .slice(0, limit);
    },
  };
}

function serperProvider(key: string): SearchProvider {
  return {
    name: "serper",
    async search(query, limit) {
      const data = (await fetchJson("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": key },
        body: JSON.stringify({ q: query, num: Math.max(1, limit) }),
      })) as { organic?: { title?: unknown; link?: unknown; snippet?: unknown }[] };
      return (data.organic ?? [])
        .map((hit) => cleanHit(hit.title, hit.link, hit.snippet))
        .filter((hit): hit is SearchHit => Boolean(hit))
        .slice(0, limit);
    },
  };
}

const duckduckgoProvider: SearchProvider = {
  name: "duckduckgo",
  async search(query, limit) {
    const response = await safeFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`DuckDuckGo returned HTTP ${response.status}.`);
    const html = await readLimitedText(response);
    const snippets = [...html.matchAll(/<(?:a|div)[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/g)].map(
      (match) => stripHtml(match[1]).slice(0, 500),
    );
    const results: SearchHit[] = [];
    const anchors = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    for (let index = 0; index < anchors.length; index += 1) {
      if (results.length >= limit) break;
      const match = anchors[index];
      const href = match[1].replace(/&amp;/g, "&");
      let target = "";
      try {
        const parsed = new URL(href, "https://duckduckgo.com");
        const redirected = parsed.searchParams.get("uddg");
        target = redirected ? decodeURIComponent(redirected) : href;
        if (target.startsWith("//")) target = `https:${target}`;
        if (!isAllowedHttpUrl(target)) continue;
        if (new URL(target).hostname.endsWith("duckduckgo.com")) continue;
      } catch {
        continue;
      }
      const title = stripHtml(match[2]).slice(0, 240);
      if (!title) continue;
      results.push({ title, url: target, snippet: snippets[index] ?? "" });
    }
    if (!results.length) throw new Error("DuckDuckGo returned no results.");
    return results;
  },
};

const wikipediaProvider: SearchProvider = {
  name: "wikipedia",
  async search(query, limit) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${Math.max(1, limit)}&srsearch=${encodeURIComponent(query)}`;
    const response = await safeFetch(url);
    if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}.`);
    const data = (await response.json()) as { query?: { search?: { title?: unknown; snippet?: unknown }[] } };
    const results = (data.query?.search ?? [])
      .map((hit) => {
        if (typeof hit.title !== "string") return null;
        return {
          title: hit.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
          snippet: typeof hit.snippet === "string" ? stripHtml(hit.snippet).slice(0, 500) : "",
        };
      })
      .filter((hit): hit is SearchHit => Boolean(hit))
      .slice(0, limit);
    if (!results.length) throw new Error("Wikipedia returned no results.");
    return results;
  },
};

export function searchProviders(): SearchProvider[] {
  const preferred = process.env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const keyed: SearchProvider[] = [];
  if (braveKey) keyed.push(braveProvider(braveKey));
  if (tavilyKey) keyed.push(tavilyProvider(tavilyKey));
  if (serperKey) keyed.push(serperProvider(serperKey));
  const fallback = [duckduckgoProvider, wikipediaProvider];

  if (preferred === "duckduckgo") return [duckduckgoProvider, wikipediaProvider, ...keyed];
  if (preferred === "wikipedia") return [wikipediaProvider, duckduckgoProvider, ...keyed];
  const selected = preferred ? keyed.find((provider) => provider.name === preferred) : undefined;
  if (selected) return [selected, ...keyed.filter((provider) => provider !== selected), ...fallback];
  return [...keyed, ...fallback];
}
