import "server-only";

import { getPlan, requireUser, type ViewerPlan } from "@/server/auth";

export async function getViewerPlan(): Promise<ViewerPlan> {
  const user = await requireUser();
  return getPlan(user.id);
}

export async function getChatViewer(): Promise<{ ownerId: string; isPro: boolean }> {
  const user = await requireUser();
  return { ownerId: user.id, isPro: (await getPlan(user.id)).isPro };
}
