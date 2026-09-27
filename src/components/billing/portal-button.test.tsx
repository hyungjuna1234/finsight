import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/components/ui/api-fetch", () => ({ apiFetch: mocks.apiFetch, ApiError: class ApiError extends Error { constructor(public code: string) { super(code); } } }));
import { PortalButton } from "./portal-button";
import { ApiError } from "@/components/ui/api-fetch";

it("shows a pricing path when no subscription record exists", async () => {
  mocks.apiFetch.mockRejectedValue(new ApiError("NOT_FOUND" as never, 404, ""));
  render(<PortalButton label="구독 관리" />); await userEvent.click(screen.getByRole("button", { name: "구독 관리" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("구독 기록이 없어요");
  expect(screen.getByRole("link", { name: "Pro 보기" })).toHaveAttribute("href", "/pricing");
});
