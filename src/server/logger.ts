import "server-only";

type SafeValue = string | number | boolean | null;

type SafeFields = Record<string, SafeValue>;

function truncate(value: SafeValue): SafeValue {
  return typeof value === "string" ? value.slice(0, 200) : value;
}

function sanitizeFields(fields?: SafeFields): SafeFields {
  if (!fields) return {};

  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => key !== "level" && key !== "event" && key !== "error")
      .map(([key, value]) => [key, truncate(value)]),
  );
}

function errorIdentity(error: unknown): { name: string; code: string | number | null } {
  if (typeof error !== "object" || error === null) {
    return { name: "UnknownError", code: null };
  }

  const candidate = error as { name?: unknown; code?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name.slice(0, 200) : "UnknownError";
  const code =
    typeof candidate.code === "string"
      ? candidate.code.slice(0, 200)
      : typeof candidate.code === "number"
        ? candidate.code
        : null;

  return { name, code };
}

function write(level: "info" | "warn", event: string, fields?: SafeFields): void {
  console.log(JSON.stringify({ ...sanitizeFields(fields), level, event: event.slice(0, 200) }));
}

export const logger: {
  info(event: string, fields?: SafeFields): void;
  warn(event: string, fields?: SafeFields): void;
  error(event: string, error: unknown, fields?: SafeFields): void;
} = {
  info(event, fields) {
    write("info", event, fields);
  },
  warn(event, fields) {
    write("warn", event, fields);
  },
  error(event, error, fields) {
    console.error(
      JSON.stringify({
        ...sanitizeFields(fields),
        level: "error",
        event: event.slice(0, 200),
        error: errorIdentity(error),
      }),
    );
  },
};
