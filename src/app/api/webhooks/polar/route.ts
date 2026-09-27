import { ERROR_MESSAGES } from "@/lib/domain/errors";
import { handlePolarWebhook } from "@/server/actions/billing";

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const { status } = await handlePolarWebhook(rawBody, req.headers);
  if (status === 200) return Response.json({ received: true });
  const code = status === 403 ? "FORBIDDEN" : "INTERNAL";
  return Response.json({ error: { code, message: ERROR_MESSAGES[code] } }, { status });
}
