import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), track: vi.fn() }));
vi.mock("@/components/ui/api-fetch", () => ({ apiFetch: mocks.apiFetch, ApiError: class ApiError extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("@vercel/analytics", () => ({ track: mocks.track }));
import { CheckoutStatus } from "./checkout-status";

describe("CheckoutStatus", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  it("confirms once on mount and reports active Pro", async () => {
    mocks.apiFetch.mockResolvedValue({ plan: "pro", checkout: "succeeded" });
    render(<CheckoutStatus checkoutId="co_1" next="/dashboard" />);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pro가 열렸어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "계속하기" })).toHaveAttribute("href", "/dashboard");
    expect(mocks.track).toHaveBeenCalledWith("checkout_pro_active");
  });
  it("retries a succeeded checkout at 2, 4, 6, 8, and 10 second delays", async () => {
    mocks.apiFetch.mockResolvedValue({ plan: "free", checkout: "succeeded" });
    render(<CheckoutStatus checkoutId="co_1" next="/dashboard" />);
    await act(async () => { await Promise.resolve(); });
    for (const delay of [2000, 4000, 6000, 8000, 10000]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    }
    expect(mocks.apiFetch).toHaveBeenCalledTimes(6);
    expect(screen.getByText(/Pro 적용까지 몇 분 걸릴 수 있어요/)).toBeInTheDocument();
  });
  it("does not call confirm without checkout information", () => {
    render(<CheckoutStatus checkoutId={null} next="/dashboard" />);
    expect(screen.getByText("결제 정보를 확인할 수 없어요")).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
