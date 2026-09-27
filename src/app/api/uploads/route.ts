import { handler } from "@/server/handler";
import { createUpload, createUploadBody } from "@/server/actions/uploads";

export const POST = handler({ auth: "user", consent: true, body: createUploadBody }, async ({ body, user }) => createUpload(user!.id, body));
