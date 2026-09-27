import { recategorizeUpload } from "@/server/actions/uploads";
import { handler } from "@/server/handler";

export const maxDuration = 120;
export const POST = handler<undefined, { id: string }>({ auth: "user", consent: true }, async ({ user, params }) => recategorizeUpload(user!.id, params.id));
