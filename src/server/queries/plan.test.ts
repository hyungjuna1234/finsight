import { expect, it, vi } from "vitest";

const { getPlanMock, requireUserMock } = vi.hoisted(() => ({ getPlanMock: vi.fn(), requireUserMock: vi.fn() }));
vi.mock("@/server/auth", () => ({ getPlan: getPlanMock, requireUser: requireUserMock }));

import { getViewerPlan } from "./plan";

it("authenticates before loading the viewer plan", async () => {
  const order: string[] = [];
  requireUserMock.mockImplementation(async () => { order.push("user"); return { id: "user-1", email: null }; });
  getPlanMock.mockImplementation(async () => { order.push("plan"); return { plan: "free", isPro: false, freeInsightAvailable: true }; });

  await expect(getViewerPlan()).resolves.toEqual({ plan: "free", isPro: false, freeInsightAvailable: true });
  expect(getPlanMock).toHaveBeenCalledWith("user-1");
  expect(order).toEqual(["user", "plan"]);
});
