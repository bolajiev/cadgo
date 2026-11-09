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
