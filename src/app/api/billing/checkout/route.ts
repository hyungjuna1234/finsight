import { z } from "zod";
import { startCheckout } from "@/server/actions/billing";
import { handler } from "@/server/handler";
import { clientIp } from "@/server/request";

export const maxDuration = 30;
const body = z.object({ returnTo: z.string().max(200).optional() }).strict();
export const POST = handler({ auth: "user", consent: true, body }, async ({ req, user, body: input }) =>
  startCheckout(user!, { returnTo: input.returnTo, ipAddress: clientIp(req.headers) }));
