import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "./copy-link-button";

describe("CopyLinkButton", () => {
  afterEach(() => vi.restoreAllMocks());

  it("절대 주소를 클립보드에 복사하고 완료 문구를 표시한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CopyLinkButton path="/upload" label="PC에서 열 링크 복사" />);

    await userEvent.click(
      screen.getByRole("button", { name: "PC에서 열 링크 복사" }),
    );

    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/upload");
    expect(screen.getByText("링크를 복사했어요")).toBeInTheDocument();
  });

  it("클립보드를 쓸 수 없으면 선택된 읽기 전용 주소를 표시한다", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const select = vi
      .spyOn(HTMLInputElement.prototype, "select")
      .mockImplementation(() => undefined);
    render(<CopyLinkButton path="/upload" label="PC에서 열 링크 복사" />);

    await userEvent.click(
      screen.getByRole("button", { name: "PC에서 열 링크 복사" }),
    );

    const input = screen.getByRole("textbox", { name: "복사할 링크" });
    expect(input).toHaveValue("http://localhost:3000/upload");
    expect(input).toHaveAttribute("readonly");
    expect(select).toHaveBeenCalled();
  });
});
