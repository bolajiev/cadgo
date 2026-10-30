import dns from "node:dns/promises";
import net from "node:net";

export type WebLookupResult = {
  query: string;
  source_url?: string;
  results: {
    title: string;
    url: string;
    snippet: string;
    text?: string;
  }[];
  error?: string;
};

const cache = new Map<string, { at: number; value: WebLookupResult }>();
const CACHE_MS = 10 * 60 * 1000;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublicUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https links can be fetched");
  }
  if (parsed.username || parsed.password) throw new Error("Credentialed URLs are not allowed");
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private hosts are not allowed");
  }
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Private network addresses are not allowed");
  }
}

async function safeFetch(url: string): Promise<Response> {
  let current = url;
  for (let redirects = 0; redirects < 3; redirects++) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": "Cadgo/0.2 (technical reference lookup)",
        Accept: "application/json,text/html,text/plain",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without a destination");
      current = new URL(location, current).href;
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects");
}


async function duckDuckSearch(query: string) {
  const searchUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const response = await safeFetch(searchUrl);
  if (!response.ok) throw new Error(`Web search returned HTTP ${response.status}`);
  const html = await response.text();
  const results: WebLookupResult["results"] = [];
  const anchors = html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
  for (const match of anchors) {
    if (results.length >= 3) break;
    const href = match[1].replace(/&amp;/g, "&");
    let url = "";
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      const target = parsed.searchParams.get("uddg");
      url = target ? decodeURIComponent(target) : href;
      if (url.startsWith("//")) url = `https:${url}`;
      const clean = new URL(url);
      if (clean.protocol !== "https:" && clean.protocol !== "http:") continue;
      if (clean.hostname.endsWith("duckduckgo.com")) continue;
      url = clean.href;
    } catch {
      continue;
    }
    const title = stripHtml(match[2]);
    if (!title || !url) continue;
    results.push({ title, url, snippet: "" });
  }
  if (!results.length) throw new Error("No web results found");
  return results;
}

async function wikipediaSearch(query: string) {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=" +
    encodeURIComponent(query);
  const response = await safeFetch(searchUrl);
  if (!response.ok) throw new Error(`Wikipedia search returned HTTP ${response.status}`);
  const data = (await response.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };
  return (data.query?.search ?? []).map((result) => ({
    title: result.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, "_"))}`,
    snippet: stripHtml(result.snippet),
  }));
}

async function wikipediaExtract(title: string) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&redirects=1&titles=" +
    encodeURIComponent(title);
  const response = await safeFetch(url);
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return {
    title: page?.title ?? title,
    text: (page?.extract ?? "").slice(0, 4200),
  };
}

async function fetchReadable(url: string) {
  const response = await safeFetch(url);
  if (!response.ok) throw new Error(`Fetch returned HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!/text|html|json/i.test(type)) throw new Error(`Unsupported content type ${type}`);
  const raw = await response.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  return {
    title: title ? stripHtml(title[1]) : url,
    text: stripHtml(raw).slice(0, 4200),
  };
}

export async function webLookup(query: string, url?: string): Promise<WebLookupResult> {
  const clean = query.trim().slice(0, 240);
  const explicitUrl = url?.trim();
  if (!clean && !explicitUrl) return { query: clean, results: [], error: "Empty lookup" };
  const key = `${clean}|${explicitUrl ?? ""}`.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const results: WebLookupResult["results"] = [];
  try {
    if (explicitUrl) {
      const page = await fetchReadable(explicitUrl);
      results.push({
        title: page.title,
        url: explicitUrl,
        snippet: page.text.slice(0, 240),
        text: page.text,
      });
    } else {
      let hits: { title: string; url: string; snippet: string }[] = [];
      try {
        hits = await duckDuckSearch(clean);
      } catch {
        hits = [];
      }
      if (!hits.length) hits = await wikipediaSearch(clean);
      if (!hits.length) throw new Error("No reference pages found");
      for (const hit of hits.slice(0, 2)) {
        let text = hit.snippet;
        try {
          const page = await fetchReadable(hit.url);
          if (page.text) text = page.text;
        } catch {
          if (!text && /wikipedia\.org/i.test(hit.url)) {
            try {
              const page = await wikipediaExtract(hit.title);
              if (page.text) text = page.text;
            } catch {
              // Keep the search result without an extract.
            }
          }
        }
        results.push({ ...hit, text: text.slice(0, 3600) });
      }
    }
    const value = { query: clean, results };
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
    return value;
  } catch (error) {
    const value = {
      query: clean,
      results,
      error: error instanceof Error ? error.message : "Lookup failed",
    };
    return value;
  }
}
