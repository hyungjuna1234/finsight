import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageList } from "./message-list";

describe("MessageList", () => {
  it("renders user text plainly and assistant markdown safely", () => {
    const { container } = render(<MessageList messages={[{ role: "user", content: "**그대로**" }, { role: "assistant", content: "[링크](https://evil.example) ![x](https://evil.example/x) **답변**" }]} loading={false} />);
    expect(screen.getByText("**그대로**")).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("답변");
    expect(container.querySelectorAll("a,img")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("shows a polite loading status and renders nothing when idle and empty", () => {
    const { container, rerender } = render(<MessageList messages={[]} loading={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MessageList messages={[]} loading />);
    expect(screen.getByText("답을 찾고 있어요…")).toHaveAttribute("aria-live", "polite");
  });
});
