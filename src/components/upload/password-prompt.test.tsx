import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordPrompt } from "./password-prompt";

describe("PasswordPrompt", () => {
  it("비밀번호를 입력해야 열기를 누를 수 있고, 입력값을 넘긴다", async () => {
    const user = userEvent.setup(); const onSubmit = vi.fn();
    render(<PasswordPrompt wrong={false} onSubmit={onSubmit} />);
    const input = screen.getByLabelText("PDF 비밀번호");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("button", { name: "열기" })).toBeDisabled();
    expect(screen.getByText(/저장하지 않아요/)).toBeInTheDocument();
    await user.type(input, "900101");
    await user.click(screen.getByRole("button", { name: "열기" }));
    expect(onSubmit).toHaveBeenCalledWith("900101");
    expect(input).toHaveValue("");
  });

  it("틀린 비밀번호를 알린다", () => {
    render(<PasswordPrompt wrong onSubmit={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("비밀번호가 맞지 않아요");
  });
});
