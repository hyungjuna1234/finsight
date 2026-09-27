import "server-only";

import { getPlan, requireUser, type ViewerPlan } from "@/server/auth";

export async function getViewerPlan(): Promise<ViewerPlan> {
  const user = await requireUser();
  return getPlan(user.id);
}
