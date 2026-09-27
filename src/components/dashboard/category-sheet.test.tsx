import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("@/components/ui/api-fetch", async (original) => ({ ...(await original<typeof import("@/components/ui/api-fetch")>()), apiFetch: mocks.apiFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
import { CategorySheet } from "./category-sheet";

beforeEach(() => { vi.clearAllMocks(); mocks.apiFetch.mockResolvedValue({ updated: 3 }); });
describe("CategorySheet", () => {
  it.each([["이번 건만", "one"], ["같은 가맹점 모두", "merchant"]] as const)("sends %s scope", async (label, scope) => {
    render(<CategorySheet tx={{ id: "t1", merchantRaw: "상점", category: "기타" }} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "식비" })); await userEvent.click(screen.getByRole("button", { name: label }));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/transactions/t1", { method: "PATCH", body: { category: "식비", scope } });
    expect(await screen.findByRole("status")).toHaveTextContent(scope === "one" ? "분류를 바꿨어요" : "같은 가맹점 3건을 바꿨어요");
  });
});
