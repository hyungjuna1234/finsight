import "server-only";

import { AppError } from "@/lib/domain/errors";

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

/** Claude 호출이 실패했지만 이미 토큰을 썼을 수 있을 때 던진다. 호출자가 usage를 ai_usage에 기록한다. */
export class AiCallError extends AppError {
  readonly usage: ClaudeUsage;

  constructor(usage: ClaudeUsage) {
    super("AI_UNAVAILABLE");
    this.usage = usage;
  }
}
