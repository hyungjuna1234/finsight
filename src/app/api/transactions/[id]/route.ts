import { z } from "zod";
import { CATEGORIES } from "@/lib/domain/categories";
import { AppError } from "@/lib/domain/errors";
import { setCategory } from "@/server/actions/transactions";
import { handler } from "@/server/handler";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PATCH = handler({ auth: "user", consent: true, body: z.object({ category: z.enum(CATEGORIES), scope: z.enum(["one", "merchant"]) }).strict() }, async ({ user, body, params }: { user: { id: string } | null; body: { category: (typeof CATEGORIES)[number]; scope: "one" | "merchant" }; params: { id: string } }) => {
  if (!UUID.test(params.id)) throw new AppError("NOT_FOUND"); return setCategory(user!.id, params.id, body);
});
