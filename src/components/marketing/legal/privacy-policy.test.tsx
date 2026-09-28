import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { LEGAL_DRAFT_NOTICE } from "@/lib/domain/legal";
import { LegalDocument } from "./legal-document";
import { PrivacyPolicy } from "./privacy-policy";

it("renders the privacy sections and accurate overseas-transfer draft", () => {
  render(<LegalDocument title="개인정보 처리방침"><PrivacyPolicy /></LegalDocument>);

  expect(screen.getByRole("note")).toHaveTextContent(LEGAL_DRAFT_NOTICE);
  expect(screen.getByRole("heading", { name: "수집하는 개인정보" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "개인정보의 국외 이전" })).toBeInTheDocument();
  expect(screen.getByText(/90일/)).toBeInTheDocument();
  expect(screen.getAllByText(/탈퇴/).length).toBeGreaterThan(0);

  const table = screen.getByRole("table", { name: "개인정보 국외 이전 내역" });
  for (const provider of ["Anthropic PBC", "Polar", "Vercel Inc."]) {
    expect(within(table).getByText(new RegExp(provider))).toBeInTheDocument();
  }

  const anthropicRow = within(table).getByText("Anthropic PBC", { exact: true }).closest("tr");
  expect(anthropicRow).not.toBeNull();
  expect(within(anthropicRow!).getByText(/최대 30건/)).toBeInTheDocument();
});
