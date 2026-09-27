import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { ZodType } from "zod";

import { AppError, ERROR_MESSAGES, ERROR_STATUS, isAppError, type ErrorCode } from "@/lib/domain/errors";
import { requireConsent, requireUser, type SessionUser } from "@/server/auth";
import { getPublicEnv, getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";

type AuthMode = "user" | "public" | "cron";

interface HandlerOptions<B> {
  auth: AuthMode;
  body?: ZodType<B>;
  consent?: boolean;
}

interface HandlerContext<B, P> {
  req: Request;
  user: SessionUser | null;
  body: B;
  params: P;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function errorResponse(code: ErrorCode): Response {
  return Response.json({ error: { code, message: ERROR_MESSAGES[code] } }, { status: ERROR_STATUS[code] });
}

function sameSecret(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

function checkOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (origin) {
    let expectedOrigin: string;
    try {
      expectedOrigin = new URL(getPublicEnv().appUrl).origin;
    } catch {
      throw new AppError("INTERNAL");
    }
    if (origin !== expectedOrigin) throw new AppError("FORBIDDEN");
    return;
  }

  if (req.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    throw new AppError("FORBIDDEN");
  }
}

async function parseBody<B>(req: Request, schema: ZodType<B>): Promise<B> {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new AppError("VALIDATION_FAILED");

  let value: unknown;
  try {
    value = await req.json();
  } catch {
    throw new AppError("VALIDATION_FAILED");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED");
  return parsed.data;
}

export function handler<B = undefined, P = Record<string, string>>(
  opts: HandlerOptions<B>,
  fn: (ctx: HandlerContext<B, P>) => Promise<unknown>,
): (req: Request, route: { params: Promise<P> }) => Promise<Response> {
  return async (req, route) => {
    try {
      if (MUTATION_METHODS.has(req.method.toUpperCase()) && opts.auth !== "cron") checkOrigin(req);

      let user: SessionUser | null = null;
      if (opts.auth === "user") {
        user = await requireUser();
        if (opts.consent) await requireConsent(user.id);
      } else if (opts.auth === "cron") {
        const authorization = req.headers.get("authorization") ?? "";
        const received = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!sameSecret(received, getServerEnv().cronSecret)) throw new AppError("UNAUTHENTICATED");
      }

      const body = opts.body ? await parseBody(req, opts.body) : (undefined as B);
      const params = await route.params;
      const result = await fn({ req, user, body, params });

      if (result instanceof Response) return result;
      if (result === undefined || result === null) return new Response(null, { status: 204 });
      return Response.json(result);
    } catch (error) {
      if (isAppError(error)) return errorResponse(error.code);

      logger.error("handler.unexpected", error, { path: new URL(req.url).pathname });
      return errorResponse("INTERNAL");
    }
  };
}
