import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKey } from "../lib/ai/limit";
import { isEmptyAgentResponse } from "../lib/studio/v2/agent-runner";

vi.mock("../lib/studio/v2/store", () => ({ useStudioV2: {} }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("isEmptyAgentResponse", () => {
  it("treats an empty payload without tool calls as empty", () => {
    expect(isEmptyAgentResponse({})).toBe(true);
    expect(isEmptyAgentResponse({ content: "" })).toBe(true);
    expect(isEmptyAgentResponse({ content: "  \n\t " })).toBe(true);
    expect(isEmptyAgentResponse({ content: "", tool_calls: [] })).toBe(true);
  });

  it("keeps responses that contain content", () => {
    expect(isEmptyAgentResponse({ content: "Done.", tool_calls: [] })).toBe(false);
  });

  it("keeps responses that contain tool calls", () => {
    expect(isEmptyAgentResponse({ content: " ", tool_calls: [{ id: "call-1" }] })).toBe(false);
  });

  it("never treats truncated responses as empty", () => {
    expect(isEmptyAgentResponse({ content: "", tool_calls: [], truncated: true })).toBe(false);
  });
});

describe("clientKey session scoping", () => {
  const request = (session?: string) =>
    new Request("https://cadgo.test/api/studio2/agent", {
      headers: {
        "x-forwarded-for": "203.0.113.7",
        ...(session ? { "x-cadgo-session": session } : {}),
      },
    });

  it("separates sessions on the same IP", () => {
    const first = clientKey(request("session-a"), "studio2-agent", "session-a");
    const second = clientKey(request("session-b"), "studio2-agent", "session-b");
    expect(first).not.toBe(second);
    expect(first).toBe(clientKey(request("session-a"), "studio2-agent", "session-a"));
  });

  it("sanitizes the subject", () => {
    expect(clientKey(request("bad session!"), "scope", "bad session!")).toBe(
      clientKey(request("ignored"), "scope", "badsession"),
    );
  });

  it("falls back to anonymous when no subject is supplied", () => {
    expect(clientKey(request(), "scope")).toBe("scope:203.0.113.7:anonymous");
  });
});

describe("runAgentTurnV2 upstream timeout", () => {
  const abortableFetch = () =>
    vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (signal?.aborted) abort();
          else signal?.addEventListener("abort", abort, { once: true });
        }),
    );

  it("fails with a 504 timeout message", async () => {
    vi.useFakeTimers();
    process.env.OPENCODE_GO_API_KEY = "test-key";
    process.env.CADGO_AGENT_UPSTREAM_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", abortableFetch());
    const { runAgentTurnV2 } = await import("../lib/ai/agent2");
    const pending = runAgentTurnV2(
      [{ role: "user", content: "build it" }],
      "test",
      new AbortController().signal,
      "",
    );
    const assertion = expect(pending).rejects.toMatchObject({
      status: 504,
      message: "The model did not finish one response within 1 minute. Your work is safe. Retry, or split the request into a smaller edit.",
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("leaves client aborts untouched", async () => {
    vi.useFakeTimers();
    process.env.OPENCODE_GO_API_KEY = "test-key";
    process.env.CADGO_AGENT_UPSTREAM_TIMEOUT_MS = "60000";
    vi.stubGlobal("fetch", abortableFetch());
    const controller = new AbortController();
    controller.abort();
    const { runAgentTurnV2 } = await import("../lib/ai/agent2");
    const pending = runAgentTurnV2(
      [{ role: "user", content: "build it" }],
      "test",
      controller.signal,
      "",
    );
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
