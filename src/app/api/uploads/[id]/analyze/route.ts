import { analyzeUpload } from "@/server/actions/uploads";
import { handler } from "@/server/handler";

export const maxDuration = 60;
export const POST = handler<undefined, { id: string }>({ auth: "user", consent: true }, async ({ user, params }) => analyzeUpload(user!.id, params.id));
