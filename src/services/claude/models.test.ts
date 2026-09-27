import { describe, expect, it } from "vitest";

import { MODELS, toUsage, type AiFeature } from "./models";

describe("Claude models", () => {
  it("keeps the feature model IDs centralized", () => {
    const features: AiFeature[] = ["mapping", "classify", "insight", "chat"];

    expect(Object.keys(MODELS)).toEqual(features);
    expect(MODELS.mapping).toBe(MODELS.classify);
    expect(MODELS.insight).toBe(MODELS.chat);
    expect(MODELS.mapping).toContain("haiku");
    expect(MODELS.insight).toContain("sonnet");
    expect(MODELS.mapping).not.toMatch(/\d{8}$/);
    expect(MODELS.insight).not.toMatch(/\d{8}$/);
  });

  it("normalizes SDK token usage", () => {
    expect(toUsage("model-name", { input_tokens: 12, output_tokens: 7 })).toEqual({
      model: "model-name",
      inputTokens: 12,
      outputTokens: 7,
    });
  });
});
