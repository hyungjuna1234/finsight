import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ISSUER_GUIDES } from "@/lib/domain/guides";
import { IssuerPicker } from "./issuer-picker";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/components/ui/track", () => ({ trackEvent }));

beforeEach(() => vi.clearAllMocks());

it("카드사를 선택할 때 4단계를 열고 다시 누르면 접는다", async () => {
  const user = userEvent.setup();
  render(<IssuerPicker guides={ISSUER_GUIDES} />);
  const button = screen.getByRole("button", { name: "신한카드" });

  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(button).toHaveAttribute("aria-pressed", "false");

  await user.click(button);
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(trackEvent).toHaveBeenCalledWith("guide_open", {
    issuer: "shinhan",
    where: "upload",
  });

  await user.click(button);
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledTimes(1);
});
