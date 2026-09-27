import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TxFiltersForm } from "./tx-filters";

describe("TxFiltersForm", () => {
  it("renders a GET form with category, card, and search controls", () => {
    render(<TxFiltersForm month={"2026-09" as never} availableMonths={["2026-09" as never]} filters={{ month: "2026-09" as never, category: null, cardId: null, q: null, cursor: 0 }} cards={[{ id: "c1", name: "생활 카드" }]} />);
    expect(screen.getByRole("form", { name: "거래 필터" })).toHaveAttribute("method", "get");
    expect(screen.getByRole("combobox", { name: "카테고리" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "가맹점 검색" })).toHaveAttribute("maxLength", "50");
  });
});
