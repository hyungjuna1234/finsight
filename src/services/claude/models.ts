import "server-only";

export const MODELS = {
  mapping: "claude-haiku-4-5",
  classify: "claude-haiku-4-5",
  insight: "claude-sonnet-5",
  chat: "claude-sonnet-5",
} as const;

export type AiFeature = keyof typeof MODELS;

export interface ClaudeUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function toUsage(model: string, usage: {
  input_tokens: number;
  output_tokens: number;
}): ClaudeUsage {
  return {
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}
