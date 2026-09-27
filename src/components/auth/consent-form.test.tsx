import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_ITEMS } from "@/lib/domain/consent";

const { apiFetchMock, pushMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn(), pushMock: vi.fn() }));

vi.mock("@/components/ui/api-fetch", () => ({ apiFetch: apiFetchMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { ConsentForm } from "./consent-form";

describe("ConsentForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts unchecked and enables submission only after individual checks", async () => {
    const user = userEvent.setup();
    render(<ConsentForm items={CONSENT_ITEMS} />);

    const submit = screen.getByRole("button", { name: "시작하기" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("필수 항목에 모두 동의해야 이용할 수 있어요.")).toBeInTheDocument();

    for (const item of CONSENT_ITEMS) await user.click(screen.getByRole("checkbox", { name: new RegExp(item.label) }));
    expect(submit).toBeEnabled();
    expect(screen.queryByText("필수 항목에 모두 동의해야 이용할 수 있어요.")).not.toBeInTheDocument();
  });

  it("checks and unchecks every item with the convenience checkbox", async () => {
    const user = userEvent.setup();
    render(<ConsentForm items={CONSENT_ITEMS} />);

    const all = screen.getByRole("checkbox", { name: "모두 동의" });
    await user.click(all);
    expect(screen.getAllByRole("checkbox")).toSatisfy((boxes: HTMLInputElement[]) => boxes.every((box) => box.checked));
    expect(screen.getByRole("button", { name: "시작하기" })).toBeEnabled();

    await user.click(all);
    expect(screen.getAllByRole("checkbox")).toSatisfy((boxes: HTMLInputElement[]) => boxes.every((box) => !box.checked));
  });

  it("submits all separate kinds and moves to upload", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue(undefined);
    render(<ConsentForm items={CONSENT_ITEMS} />);

    await user.click(screen.getByRole("checkbox", { name: "모두 동의" }));
    await user.click(screen.getByRole("button", { name: "시작하기" }));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/consents", {
      method: "POST",
      body: { kinds: ["privacy", "overseas_transfer", "terms", "age14"] },
    });
    expect(pushMock).toHaveBeenCalledWith("/upload");
  });

  it("provides a separate POST signout form", () => {
    render(<ConsentForm items={CONSENT_ITEMS} />);
    const button = screen.getByRole("button", { name: "동의하지 않고 나가기" });
    expect(button.closest("form")).toHaveAttribute("action", "/auth/signout");
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });
});
