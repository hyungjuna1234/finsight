import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/server/env";

let client: Anthropic | undefined;

export function getClaude(): Anthropic {
  client ??= new Anthropic({
    apiKey: getServerEnv().anthropicApiKey,
    maxRetries: 2,
  });
  return client;
}
