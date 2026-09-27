import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EFFECTIVE_DATE, LEGAL_DRAFT_NOTICE } from "@/lib/domain/legal";
import { LegalDocument } from "./legal-document";

it("renders the title, prominent draft notice, and document content", () => {
  render(<LegalDocument title="문서 제목"><section><h2 id="section">본문 제목</h2></section></LegalDocument>);

  expect(screen.getByRole("heading", { level: 1, name: "문서 제목" })).toBeInTheDocument();
  const notice = screen.getByRole("note");
  expect(notice).toHaveTextContent(LEGAL_DRAFT_NOTICE);
  expect(notice).toHaveTextContent(`시행일 ${EFFECTIVE_DATE}`);
  expect(screen.getByRole("heading", { level: 2, name: "본문 제목" })).toHaveAttribute("id", "section");
});
