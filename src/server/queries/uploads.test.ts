import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireUserMock, createMock } = vi.hoisted(() => ({ requireUserMock: vi.fn(), createMock: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createMock }));
import { getUploadReview } from "./uploads";

describe("upload queries", () => {
  beforeEach(() => { vi.clearAllMocks(); requireUserMock.mockResolvedValue({ id: "user-1" }); });
  it("잘못된 uuid는 DB를 조회하지 않고 null을 반환한다", async () => {
    expect(await getUploadReview("bad")).toBeNull(); expect(createMock).not.toHaveBeenCalled();
  });
});
