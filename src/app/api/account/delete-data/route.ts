import { z } from "zod";
import { DELETE_DATA_PHRASE } from "@/lib/domain/account";
import { deleteAllData } from "@/server/actions/account";
import { handler } from "@/server/handler";

const body = z.object({ confirm: z.literal(DELETE_DATA_PHRASE) }).strict();
export const POST = handler({ auth: "user", body }, async ({ user }) => deleteAllData(user!.id));
