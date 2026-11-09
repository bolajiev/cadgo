import { describe, expect, it } from "vitest";
import {
  assertPublicUrl,
  isAllowedHttpUrl,
  isPrivateAddress,
  readLimitedText,
  stripHtml,
} from "../lib/research/fetch";
import { researchWeb } from "../lib/research/service";

describe("research URL guard", () => {
  it("rejects private IPv4 and IPv6 ranges", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "198.18.0.1",
      "203.0.113.5",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("allows only public HTTP(S) URLs on standard ports", () => {
    expect(isAllowedHttpUrl("https://en.wikipedia.org/wiki/ISO_4762")).toBe(true);
    expect(isAllowedHttpUrl("http://example.com/")).toBe(true);
    expect(isAllowedHttpUrl("ftp://example.com/file")).toBe(false);
    expect(isAllowedHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedHttpUrl("https://user:pass@example.com/")).toBe(false);
    expect(isAllowedHttpUrl("http://localhost/")).toBe(false);
    expect(isAllowedHttpUrl("http://service.internal/")).toBe(false);
    expect(isAllowedHttpUrl("http://example.com:8080/")).toBe(false);
  });

  it("rejects a private address after DNS resolution", async () => {
    await expect(assertPublicUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(/Private/);
  });

  it("strips markup and entities from readable text", () => {
    expect(stripHtml("<p>Hello&nbsp;<strong>world</strong></p>")).toBe("Hello world");
  });

  it("rejects unsupported response content types", async () => {
    const response = new Response("binary", { headers: { "content-type": "image/png" } });
    await expect(readLimitedText(response)).rejects.toThrow(/Unsupported content type/);
  });

  it("reads a text response", async () => {
    const response = new Response("hello", { headers: { "content-type": "text/plain" } });
    await expect(readLimitedText(response)).resolves.toBe("hello");
  });
});

describe("research service", () => {
  it("rejects an empty request without touching the network", async () => {
    const result = await researchWeb({});
    expect(result.error).toContain("query or URL");
    expect(result.sources).toEqual([]);
  });

  it("rejects a private URL without fetching it", async () => {
    const result = await researchWeb({ url: "http://127.0.0.1/private" });
    expect(result.error).toBeTruthy();
    expect(result.sources).toEqual([]);
  });
});
