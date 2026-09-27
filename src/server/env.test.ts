import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/domain/errors";
import { getPublicEnv, getServerEnv } from "./env";

const publicEnv = {
  NEXT_PUBLIC_APP_URL: "https://finsight.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
};

const serverEnv = {
  ...publicEnv,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  ANTHROPIC_API_KEY: "anthropic-secret",
  POLAR_ACCESS_TOKEN: "polar-token-secret",
  POLAR_WEBHOOK_SECRET: "polar-webhook-secret",
  POLAR_SERVER: "sandbox",
  POLAR_PRO_PRODUCT_ID: "product-id",
  CRON_SECRET: "cron-secret",
};

function stub(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

afterEach(() => vi.unstubAllEnvs());

describe("environment validation", () => {
  it("public 환경변수를 반환한다", () => {
    stub(publicEnv);
    expect(getPublicEnv()).toEqual({
      appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  });

  it("서버 환경변수를 반환한다", () => {
    stub(serverEnv);
    expect(getServerEnv()).toEqual({
      appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
      supabaseUrl: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      anthropicApiKey: serverEnv.ANTHROPIC_API_KEY,
      polarAccessToken: serverEnv.POLAR_ACCESS_TOKEN,
      polarWebhookSecret: serverEnv.POLAR_WEBHOOK_SECRET,
      polarServer: "sandbox",
      polarProProductId: serverEnv.POLAR_PRO_PRODUCT_ID,
      cronSecret: serverEnv.CRON_SECRET,
    });
  });

  it("누락된 이름만 detail에 담고 비밀값은 노출하지 않는다", () => {
    stub(serverEnv);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("CRON_SECRET", "");

    try {
      getServerEnv();
      expect.fail("오류가 발생해야 한다");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.message).toBe("서비스 설정을 확인해 주세요.");
      expect(appError.detail).toContain("ANTHROPIC_API_KEY");
      expect(appError.detail).toContain("CRON_SECRET");
      expect(appError.message + appError.detail).not.toContain("service-role-secret");
      expect(appError.message + appError.detail).not.toContain("polar-token-secret");
    }
  });

  it("URL과 Polar 서버 값의 형식을 검증한다", () => {
    stub(serverEnv);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-url");
    vi.stubEnv("POLAR_SERVER", "invalid");
    expect(() => getServerEnv()).toThrow(AppError);
  });
});
