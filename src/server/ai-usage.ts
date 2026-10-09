import "server-only";

import { recordAiUsage } from "@/server/limits";
import { AiCallError, type AiFeature, type ClaudeUsage } from "@/services/claude/models";

/** 실패한 Claude 호출이 이미 쓴 토큰을 ai_usage에 남긴다. 기록하지 않으면 실패를 유도해 일일 상한을 피할 수 있다. */
export async function recordFailedAiCall(userId: string, feature: AiFeature, error: unknown): Promise<void> {
  if (error instanceof AiCallError) await recordAiUsage(userId, feature, error.usage);
}

/** Claude를 부르고, 성공이든 실패든 호출 직후 쓴 토큰을 기록한다. */
export async function withAiUsage<T extends { usage: ClaudeUsage }>(userId: string, feature: AiFeature, call: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch (error) {
    await recordFailedAiCall(userId, feature, error);
    throw error;
  }
  await recordAiUsage(userId, feature, result.usage);
  return result;
}
