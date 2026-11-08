import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("agent output limit", () => {
  it("returns partial content with a truncated flag instead of a stopgap message", async () => {
    process.env.OPENCODE_GO_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: "partial answer" },
              },
            ],
          }),
      })),
    );
    const { runAgentTurnV2 } = await import("../lib/ai/agent2");
    const result = await runAgentTurnV2(
      [{ role: "user", content: "continue" }],
      "test",
      new AbortController().signal,
      "",
    );
    expect(result.truncated).toBe(true);
    expect(result.content).toBe("partial answer");
    expect(result.tool_calls).toEqual([]);
  });
});
