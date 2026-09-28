import { analyzeUpload, analyzeUploadBody } from "@/server/actions/uploads";
import { handler } from "@/server/handler";

export const maxDuration = 60;
export const POST = handler<typeof analyzeUploadBody._output, { id: string }>({ auth: "user", consent: true, body: analyzeUploadBody }, async ({ body, user, params }) => analyzeUpload(user!.id, params.id, body));
