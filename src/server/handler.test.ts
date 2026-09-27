import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/domain/errors";

const { getPublicEnvMock, getServerEnvMock, loggerErrorMock, requireConsentMock, requireUserMock } = vi.hoisted(() => ({
  getPublicEnvMock: vi.fn(() => ({ appUrl: "https://finsight.example" })),
  getServerEnvMock: vi.fn(() => ({ cronSecret: "cron-secret" })),
  loggerErrorMock: vi.fn(),
  requireConsentMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("./auth", () => ({ requireConsent: requireConsentMock, requireUser: requireUserMock }));
vi.mock("./env", () => ({ getPublicEnv: getPublicEnvMock, getServerEnv: getServerEnvMock }));
vi.mock("./logger", () => ({ logger: { error: loggerErrorMock } }));

import { handler } from "./handler";

const route = { params: Promise.resolve({ id: "upload-1" }) };

describe("handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user-1", email: null });
    requireConsentMock.mockResolvedValue(undefined);
  });

  it("checks consent after authenticating and before the callback", async () => {
    const order: string[] = [];
    requireUserMock.mockImplementation(async () => {
      order.push("auth");
      return { id: "user-1", email: null };
    });
    requireConsentMock.mockImplementation(async () => { order.push("consent"); });
    const fn = vi.fn(async () => { order.push("callback"); });

    const response = await handler({ auth: "user", consent: true }, fn)(
      new Request("https://finsight.example/api/test"),
      route,
    );

    expect(response.status).toBe(204);
    expect(requireConsentMock).toHaveBeenCalledWith("user-1");
    expect(order).toEqual(["auth", "consent", "callback"]);
  });

  it("rejects a mismatched Origin before authentication", async () => {
    const fn = vi.fn();
    const response = await handler({ auth: "user" }, fn)(
      new Request("https://finsight.example/api/uploads", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
      route,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(requireUserMock).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects a cross-site mutation without an Origin", async () => {
    const response = await handler({ auth: "public" }, vi.fn())(
      new Request("https://finsight.example/api/test", {
        method: "DELETE",
        headers: { "sec-fetch-site": "cross-site" },
      }),
      route,
    );

    expect(response.status).toBe(403);
  });

  it("rejects an invalid cron secret", async () => {
    const response = await handler({ auth: "cron" }, vi.fn())(
      new Request("https://finsight.example/api/cron/cleanup", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
      route,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });

  it("converts missing user authentication to a 401 response", async () => {
    requireUserMock.mockRejectedValue(new AppError("UNAUTHENTICATED"));

    const response = await handler({ auth: "user" }, vi.fn())(
      new Request("https://finsight.example/api/test"),
      route,
    );

    expect(response.status).toBe(401);
  });

  it.each([
    ["text/plain", "{}"],
    ["application/json", "not json"],
    ["application/json", JSON.stringify({ count: 0 })],
  ])("returns 400 for invalid JSON input (%s)", async (contentType, body) => {
    const response = await handler(
      { auth: "public", body: z.object({ count: z.number().int().positive() }) },
      vi.fn(),
    )(
      new Request("https://finsight.example/api/test", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      }),
      route,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_FAILED" } });
  });

  it("passes parsed body, user, request, and awaited params to the callback", async () => {
    const fn = vi.fn(async (context) => ({ id: context.params.id, count: context.body.count }));
    const response = await handler(
      { auth: "user", body: z.object({ count: z.number() }) },
      fn,
    )(
      new Request("https://finsight.example/api/uploads/upload-1", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://finsight.example" },
        body: JSON.stringify({ count: 2 }),
      }),
      route,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "upload-1", count: 2 });
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ user: { id: "user-1", email: null }, body: { count: 2 }, params: { id: "upload-1" } }),
    );
  });

  it("converts AppError to its public response", async () => {
    const response = await handler({ auth: "public" }, async () => {
      throw new AppError("NOT_FOUND", "private database detail");
    })(new Request("https://finsight.example/api/test"), route);

    expect(response.status).toBe(404);
    const output = JSON.stringify(await response.json());
    expect(output).toContain("NOT_FOUND");
    expect(output).not.toContain("private database detail");
  });

  it("converts a failed Pro guard to the public 402 response", async () => {
    const response = await handler({ auth: "user" }, async () => {
      throw new AppError("PRO_REQUIRED");
    })(new Request("https://finsight.example/api/insights"), route);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: { code: "PRO_REQUIRED", message: "Pro에서 이용할 수 있어요." },
    });
  });

  it("logs an unexpected error safely and hides its original text", async () => {
    const response = await handler({ auth: "public" }, async () => {
      throw new Error("스타벅스 5000 secret");
    })(new Request("https://finsight.example/api/test?token=secret"), route);

    expect(response.status).toBe(500);
    const output = JSON.stringify(await response.json());
    expect(output).not.toContain("스타벅스");
    expect(output).not.toContain("5000");
    expect(loggerErrorMock).toHaveBeenCalledWith("handler.unexpected", expect.any(Error), {
      path: "/api/test",
    });
  });

  it.each([undefined, null])("returns 204 for an empty result", async (result) => {
    const response = await handler({ auth: "public" }, async () => result)(
      new Request("https://finsight.example/api/test"),
      route,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns a Response unchanged", async () => {
    const expected = new Response("created", { status: 201 });
    const response = await handler({ auth: "public" }, async () => expected)(
      new Request("https://finsight.example/api/test"),
      route,
    );

    expect(response).toBe(expected);
  });
});
