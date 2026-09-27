import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), track: vi.fn(), redirect: vi.fn(() => null) }));
vi.mock("@/components/ui/api-fetch", () => ({
  apiFetch: mocks.apiFetch,
  ApiError: class ApiError extends Error { constructor(public code: string) { super(code); } },
  redirectPathForError: mocks.redirect,
}));
vi.mock("@vercel/analytics", () => ({ track: mocks.track }));
import { CheckoutButton } from "./checkout-button";
import { ApiError } from "@/components/ui/api-fetch";

describe("CheckoutButton", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("tracks and creates only one checkout while pending", async () => {
    mocks.apiFetch.mockReturnValue(new Promise(() => undefined));
    render(<CheckoutButton returnTo="/dashboard" />);
    const button = screen.getByRole("button", { name: "Pro 시작하기" });
    await userEvent.click(button); await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(mocks.track).toHaveBeenCalledWith("checkout_start");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/billing/checkout", { method: "POST", body: { returnTo: "/dashboard" } });
  });
  it("shows fixed billing-unavailable copy and a retry", async () => {
    const error = new ApiError("BILLING_UNAVAILABLE" as never, 503, "");
    mocks.apiFetch.mockRejectedValue(error);
    render(<CheckoutButton />); await userEvent.click(screen.getByRole("button", { name: "Pro 시작하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("결제 서비스에 연결하지 못했어요");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
  it("opens the portal after ALREADY_SUBSCRIBED", async () => {
    const error = new ApiError("ALREADY_SUBSCRIBED" as never, 409, "");
    mocks.apiFetch.mockRejectedValueOnce(error).mockReturnValueOnce(new Promise(() => undefined));
    render(<CheckoutButton />); await userEvent.click(screen.getByRole("button", { name: "Pro 시작하기" }));
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/api/billing/portal", { method: "POST" });
  });
});
