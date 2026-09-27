import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

describe("ChatInput", () => {
  it("limits input to 500 characters and submits with Enter", async () => {
    const onChange = vi.fn(); const onSubmit = vi.fn();
    const { rerender } = render(<ChatInput value="" onChange={onChange} onSubmit={onSubmit} disabled={false} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("maxlength", "500");
    fireEvent.change(input, { target: { value: "가".repeat(501) } });
    expect(onChange).toHaveBeenCalledWith("가".repeat(500));
    rerender(<ChatInput value="질문" onChange={onChange} onSubmit={onSubmit} disabled={false} />);
    await userEvent.type(input, "{enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not submit with Shift+Enter or while Korean IME is composing", () => {
    const onSubmit = vi.fn();
    render(<ChatInput value="질문" onChange={vi.fn()} onSubmit={onSubmit} disabled={false} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables whitespace-only and loading submissions", () => {
    const { rerender } = render(<ChatInput value="   " onChange={vi.fn()} onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
    rerender(<ChatInput value="질문" onChange={vi.fn()} onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });
});
