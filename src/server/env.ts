import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/domain/errors";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  POLAR_ACCESS_TOKEN: z.string().min(1),
  POLAR_WEBHOOK_SECRET: z.string().min(1),
  POLAR_SERVER: z.enum(["sandbox", "production"]),
  POLAR_PRO_PRODUCT_ID: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

function parseEnvironment<T>(schema: z.ZodType<T>, values: unknown): T {
  const result = schema.safeParse(values);
  if (result.success) return result.data;

  const missingNames = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "UNKNOWN")))];
  throw new AppError("INTERNAL", `환경변수 확인 필요: ${missingNames.join(", ")}`);
}

export function getPublicEnv(): { appUrl: string; supabaseUrl: string; supabaseAnonKey: string } {
  const env = parseEnvironment(publicEnvSchema, process.env);
  return {
    appUrl: env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getServerEnv(): {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string;
  polarAccessToken: string;
  polarWebhookSecret: string;
  polarServer: "sandbox" | "production";
  polarProProductId: string;
  cronSecret: string;
} {
  const env = parseEnvironment(serverEnvSchema, process.env);
  return {
    appUrl: env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    polarAccessToken: env.POLAR_ACCESS_TOKEN,
    polarWebhookSecret: env.POLAR_WEBHOOK_SECRET,
    polarServer: env.POLAR_SERVER,
    polarProProductId: env.POLAR_PRO_PRODUCT_ID,
    cronSecret: env.CRON_SECRET,
  };
}
