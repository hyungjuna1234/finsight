import { deleteUpload } from "@/server/actions/uploads";
import { handler } from "@/server/handler";

export const DELETE = handler<undefined, { id: string }>({ auth: "user" }, async ({ user, params }) => deleteUpload(user!.id, params.id));
