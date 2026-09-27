import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeMarkdown } from "./safe-markdown";

describe("SafeMarkdown", () => {
  it("unwraps links without retaining their URL and drops image destinations", () => {
    const { container } = render(<SafeMarkdown text={'[클릭](https://evil.example) ![x](https://evil.example/p.png?q=secret)'} />);
    expect(container).toHaveTextContent("클릭");
    expect(container.querySelectorAll("a,img,script,iframe,h1,h2")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("drops raw HTML and unwraps disallowed headings while allowing emphasis", () => {
    const { container } = render(<SafeMarkdown text={'<img src=x onerror=alert(1)><script>alert(1)</script><iframe src="x"></iframe>\n\n# 제목\n\n**굵게**'} />);
    expect(container.querySelectorAll("a,img,script,iframe,h1,h2")).toHaveLength(0);
    expect(container).toHaveTextContent("제목");
    expect(container.querySelector("strong")).toHaveTextContent("굵게");
  });
});
