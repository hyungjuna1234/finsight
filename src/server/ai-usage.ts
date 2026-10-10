import "server-only";

import { recordAiUsage } from "@/server/limits";
import { AiCallError, type AiFeature, type ClaudeUsage } from "@/services/claude/models";

/**
 * 실패한 Claude 호출이 이미 쓴 토큰을 ai_usage에 남긴다. 기록하지 않으면 실패를 유도해 일일 상한을 피할 수 있다.
 * 응답 전 실패(타임아웃·연결 오류)도 토큰 0인 행으로 남겨 한 번으로 센다. 타임아웃 중에도 생성된 토큰은 과금되기 때문이다.
 * 대신 Anthropic 장애 때 재시도하면 그만큼 상한이 줄어든다(상한이 넉넉해서 받아들인다).
 */
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
