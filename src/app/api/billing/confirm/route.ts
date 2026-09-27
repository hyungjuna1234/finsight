import { z } from "zod";

import { confirmCheckout } from "@/server/actions/billing";
import { handler } from "@/server/handler";

export const maxDuration = 30;

const body = z.object({
  checkoutId: z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export const POST = handler({ auth: "user", body }, async ({ user, body: input }) =>
  confirmCheckout(user!.id, input.checkoutId));
