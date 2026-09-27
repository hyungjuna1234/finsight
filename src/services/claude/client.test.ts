import { beforeEach, describe, expect, it, vi } from "vitest";

const { anthropicConstructor, getServerEnvMock } = vi.hoisted(() => ({
  anthropicConstructor: vi.fn(function AnthropicMock() {
    return { messages: {} };
  }),
  getServerEnvMock: vi.fn(() => ({ anthropicApiKey: "test-api-key" })),
}));

vi.mock("@anthropic-ai/sdk", () => ({ default: anthropicConstructor }));
vi.mock("@/server/env", () => ({ getServerEnv: getServerEnvMock }));

describe("getClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates one lazy client with the configured retry policy", async () => {
    const { getClaude } = await import("./client");

    expect(getServerEnvMock).not.toHaveBeenCalled();
    const first = getClaude();
    const second = getClaude();

    expect(first).toBe(second);
    expect(getServerEnvMock).toHaveBeenCalledTimes(1);
    expect(anthropicConstructor).toHaveBeenCalledOnce();
    expect(anthropicConstructor).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      maxRetries: 2,
    });
  });
});
