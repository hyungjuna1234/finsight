import { z } from "zod";
import { isYearMonth } from "@/lib/domain/month";
import { generateInsight } from "@/server/actions/insights";
import { handler } from "@/server/handler";
export const maxDuration = 120;
const body = z.object({ month: z.string().refine(isYearMonth) }).strict();
export const POST = handler({ auth: "user", consent: true, body }, async ({ user, body: input }) => generateInsight(user!.id, input.month));
