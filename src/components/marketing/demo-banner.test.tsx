import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/track", () => ({ trackEvent }));
import { DemoBanner } from "./demo-banner";

it("labels the sample and tracks starting with user data", async () => {
  const { container } = render(<DemoBanner />);
  expect(screen.getByText("샘플 데이터예요 · 실제 화면과 같아요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "내 데이터로 시작" })).toHaveAttribute("href", "/login?next=%2Fupload");
  await userEvent.click(screen.getByRole("link", { name: "내 데이터로 시작" }));
  expect(trackEvent).toHaveBeenCalledOnce();
  expect(trackEvent).toHaveBeenCalledWith("demo_cta", {});
  expect(container.firstElementChild).not.toHaveClass("text-center");
});
