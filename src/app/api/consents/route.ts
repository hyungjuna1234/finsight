import { z } from "zod";

import { CONSENT_KINDS } from "@/lib/domain/consent";
import { recordConsents } from "@/server/actions/consents";
import { handler } from "@/server/handler";

const bodySchema = z.object({ kinds: z.array(z.enum(CONSENT_KINDS)) });

export const POST = handler({ auth: "user", body: bodySchema }, async ({ body, user }) => {
  await recordConsents(user!.id, body.kinds);
});
