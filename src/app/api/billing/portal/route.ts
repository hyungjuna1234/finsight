import { openPortal } from "@/server/actions/billing";
import { handler } from "@/server/handler";

export const maxDuration = 30;
export const POST = handler({ auth: "user" }, async ({ user }) => openPortal(user!.id));
