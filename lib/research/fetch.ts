import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 1_200_000;
const MAX_CHARS = 5000;
const USER_AGENT = "Mozilla/5.0 (compatible; CadgoResearch/0.1; +https://github.com/bolajiev/cadgo)";

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

export function stripHtml(value: string) {
  const decoded = decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  return decoded.replace(/\s+/g, " ").trim();
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
    if (a === 203 && b === 0) return true;
    return false;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    if (value === "::" || value === "::1") return true;
    if (value.startsWith("fc") || value.startsWith("fd")) return true;
    if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
    if (value.startsWith("ff")) return true;
    if (value.startsWith("2001:db8")) return true;
    if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
    return false;
  }
  return true;
}

export function isAllowedHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
      return false;
    }
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (port !== 80 && port !== 443) return false;
    return true;
  } catch {
    return false;
  }
}

export async function assertPublicUrl(value: string): Promise<void> {
  if (!isAllowedHttpUrl(value)) {
    throw new Error("Only public HTTP(S) URLs on ports 80/443 are allowed.");
  }
  const host = new URL(value).hostname;
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Private or unresolved network addresses are not allowed.");
  }
}

export async function safeFetch(value: string): Promise<Response> {
  let current = value;
  for (let redirects = 0; redirects < MAX_REDIRECTS; redirects += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,text/plain,application/json",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without a destination.");
      current = new URL(location, current).href;
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects.");
}

export async function readLimitedText(response: Response): Promise<string> {
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/json|application\/xhtml\+xml/i.test(type)) {
    throw new Error(`Unsupported content type: ${type || "unknown"}`);
  }
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, MAX_CHARS);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, merged.length - offset);
    if (take <= 0) break;
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder().decode(merged);
}

export async function fetchReadable(url: string): Promise<{ title: string; text: string }> {
  const response = await safeFetch(url);
  if (!response.ok) throw new Error(`Fetch returned HTTP ${response.status}.`);
  const raw = await readLimitedText(response);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1];
  return {
    title: title ? stripHtml(title) : new URL(url).hostname,
    text: stripHtml(raw).slice(0, MAX_CHARS),
  };
}
