import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from "@/lib/domain/errors";

export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK";
  readonly status: number;

  constructor(code: ErrorCode | "NETWORK", status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ApiFetchInit {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

function isAllowedPath(path: string): boolean {
  return path.startsWith("/api/") || path.startsWith("/auth/");
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export async function apiFetch<T>(
  path: `/api/${string}` | `/auth/${string}`,
  init: ApiFetchInit = {},
): Promise<T> {
  if (!isAllowedPath(path)) throw new ApiError("NETWORK", 0, "허용되지 않은 요청 경로예요.");

  const requestInit: RequestInit = {
    method: init.method,
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  };

  let response: Response;
  try {
    response = await fetch(path, requestInit);
  } catch {
    throw new ApiError("NETWORK", 0, "네트워크 연결을 확인해 주세요.");
  }

  if (response.status === 204) return undefined as T;
  if (response.ok) return (await response.json()) as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("INTERNAL", response.status, ERROR_MESSAGES.INTERNAL);
  }

  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  const code = isErrorCode(error?.code) ? error.code : "INTERNAL";
  const message = typeof error?.message === "string" ? error.message : ERROR_MESSAGES[code];
  throw new ApiError(code, response.status, message);
}

export function redirectPathForError(code: ApiError["code"], currentPath: string): string | null {
  if (code === "UNAUTHENTICATED") return `/login?next=${encodeURIComponent(currentPath)}`;
  if (code === "CONSENT_REQUIRED") return "/onboarding/consent";
  if (code === "PRO_REQUIRED") return "/pricing";
  return null;
}
