import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LEGAL_DRAFT_NOTICE } from "@/lib/domain/legal";
import { LegalDocument } from "./legal-document";
import { RefundPolicy } from "./refund-policy";

it("renders the refund conditions and Polar process", () => {
  render(<LegalDocument title="환불 정책"><RefundPolicy /></LegalDocument>);

  expect(screen.getByRole("note")).toHaveTextContent(LEGAL_DRAFT_NOTICE);
  expect(screen.getByRole("heading", { name: "구독과 해지" })).toBeInTheDocument();
  expect(screen.getByText(/7일 이내/)).toBeInTheDocument();
  expect(screen.getByText(/Polar를 통해/)).toBeInTheDocument();
});
