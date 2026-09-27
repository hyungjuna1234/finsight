import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSb: vi.fn() }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
import { setCategory } from "./transactions";

function chain(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "update", "upsert", "maybeSingle"]) q[name] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  q.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
  return q;
}

beforeEach(() => vi.clearAllMocks());

describe("setCategory", () => {
  it("updates one owned transaction", async () => {
    const read = chain({ data: { merchant_key: "m" }, error: null });
    const update = chain({ error: null });
    mocks.createSb.mockResolvedValue({ from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) });
    await expect(setCategory("u1", "t1", { category: "식비", scope: "one" })).resolves.toEqual({ updated: 1 });
    expect(read.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(update.eq).toHaveBeenCalledWith("user_id", "u1");
  });
  it("upserts an override and updates every owned matching merchant", async () => {
    const read = chain({ data: { merchant_key: "m" }, error: null });
    const override = chain({ error: null });
    const update = chain({ data: [{ id: "1" }, { id: "2" }], error: null });
    const from = vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(override).mockReturnValueOnce(update);
    mocks.createSb.mockResolvedValue({ from });
    await expect(setCategory("u1", "t1", { category: "교통", scope: "merchant" })).resolves.toEqual({ updated: 2 });
    expect(override.upsert).toHaveBeenCalledWith({ user_id: "u1", merchant_key: "m", category: "교통" }, { onConflict: "user_id,merchant_key" });
    expect(update.eq).toHaveBeenCalledWith("user_id", "u1");
  });
  it("returns NOT_FOUND without updates when the id is not owned", async () => {
    const read = chain({ data: null, error: null });
    const from = vi.fn().mockReturnValue(read);
    mocks.createSb.mockResolvedValue({ from });
    await expect(setCategory("u1", "other", { category: "기타", scope: "one" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
