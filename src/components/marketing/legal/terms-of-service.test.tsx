import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LEGAL_DRAFT_NOTICE } from "@/lib/domain/legal";
import { LegalDocument } from "./legal-document";
import { TermsOfService } from "./terms-of-service";

it("renders core terms sections and the advice disclaimer", () => {
  render(<LegalDocument title="이용약관"><TermsOfService /></LegalDocument>);

  expect(screen.getByRole("note")).toHaveTextContent(LEGAL_DRAFT_NOTICE);
  expect(screen.getByRole("heading", { name: "서비스 범위" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "조언이 아님" })).toBeInTheDocument();
  expect(screen.getByText(/재무·투자·세무 조언이 아님/)).toBeInTheDocument();
});
