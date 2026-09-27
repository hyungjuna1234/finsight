import { z } from "zod";
import { DELETE_ACCOUNT_PHRASE } from "@/lib/domain/account";
import { deleteAccount } from "@/server/actions/account";
import { handler } from "@/server/handler";

export const maxDuration = 60;

const body = z.object({ confirm: z.literal(DELETE_ACCOUNT_PHRASE) }).strict();

export const POST = handler({ auth: "user", body }, async ({ user }) => {
  await deleteAccount(user!.id);
});
