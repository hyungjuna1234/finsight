import { confirmUpload, confirmUploadBody } from "@/server/actions/uploads";
import { handler } from "@/server/handler";

export const maxDuration = 120;
export const POST = handler<typeof confirmUploadBody._output, { id: string }>({ auth: "user", consent: true, body: confirmUploadBody }, async ({ body, user, params }) => confirmUpload(user!.id, params.id, body));
