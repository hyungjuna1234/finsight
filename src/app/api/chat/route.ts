import { ChatRequestSchema } from "@/lib/domain/chat";
import { sendChatMessage } from "@/server/actions/chat";
import { handler } from "@/server/handler";

export const maxDuration = 60;

export const POST = handler({ auth: "user", consent: true, body: ChatRequestSchema }, async ({ user, body }) => sendChatMessage(user!.id, body));
